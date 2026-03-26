// Atlas Sweeper - Game Logic with Mobile Support and High Scores
// Fully self-contained, no external dependencies

(() => {
  const CONFIG = {
    beginner: { cols: 9, rows: 9, mines: 10 },
    intermediate: { cols: 16, rows: 16, mines: 40 },
    expert: { cols: 30, rows: 16, mines: 99 }
  };

  const state = {
    grid: [],
    cols: 0,
    rows: 0,
    totalMines: 0,
    flaggedCount: 0,
    revealedCount: 0,
    gameOver: false,
    gameWon: false,
    firstClick: true,
    timer: 0,
    timerInterval: null,
    difficulty: 'intermediate',
    focusedCell: null,
    touchStartTime: 0,
    touchTarget: null,
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    touchHandled: false // flag to suppress subsequent mouse events after touch
  };

  const elements = {
    grid: document.getElementById('grid'),
    mineCounter: document.getElementById('mineCounter'),
    timer: document.getElementById('timer'),
    difficulty: document.getElementById('difficulty'),
    restartBtn: document.getElementById('restartBtn'),
    scoresBtn: document.getElementById('scoresBtn'),
    messageOverlay: document.getElementById('messageOverlay'),
    messageTitle: document.getElementById('messageTitle'),
    messageText: document.getElementById('messageText'),
    overlayCloseBtn: document.getElementById('overlayCloseBtn'),
    scoreEntryOverlay: document.getElementById('scoreEntryOverlay'),
    playerName: document.getElementById('playerName'),
    saveScoreBtn: document.getElementById('saveScoreBtn'),
    cancelScoreBtn: document.getElementById('cancelScoreBtn'),
    leaderboardOverlay: document.getElementById('leaderboardOverlay'),
    leaderboardContent: document.getElementById('leaderboardContent'),
    closeLeaderboardBtn: document.getElementById('closeLeaderboardBtn'),
    instructionsText: document.getElementById('instructionsText'),
    mobileUp: null,
    mobileDown: null,
    mobileLeft: null,
    mobileRight: null,
    mobileFlagBtn: null,
    mobileRevealBtn: null
  };

  // Mobile controls will be set after DOM loads
  function setupMobileControls() {
    elements.mobileUp = document.querySelector('.d-up');
    elements.mobileDown = document.querySelector('.d-down');
    elements.mobileLeft = document.querySelector('.d-left');
    elements.mobileRight = document.querySelector('.d-right');
    elements.mobileFlagBtn = document.getElementById('mobileFlagBtn');
    elements.mobileRevealBtn = document.getElementById('mobileRevealBtn');

    if (elements.mobileUp) elements.mobileUp.addEventListener('click', () => moveFocus('up'));
    if (elements.mobileDown) elements.mobileDown.addEventListener('click', () => moveFocus('down'));
    if (elements.mobileLeft) elements.mobileLeft.addEventListener('click', () => moveFocus('left'));
    if (elements.mobileRight) elements.mobileRight.addEventListener('click', () => moveFocus('right'));
    if (elements.mobileFlagBtn) elements.mobileFlagBtn.addEventListener('click', () => mobileAction('flag'));
    if (elements.mobileRevealBtn) elements.mobileRevealBtn.addEventListener('click', () => mobileAction('reveal'));
  }

  function moveFocus(direction) {
    if (state.gameOver || state.gameWon) return;
    if (state.focusedCell === null) {
      state.focusedCell = state.grid[0][0];
      state.focusedCell.element.focus();
      return;
    }
    let nextRow = state.focusedCell.row;
    let nextCol = state.focusedCell.col;
    switch (direction) {
      case 'up': nextRow = Math.max(0, nextRow - 1); break;
      case 'down': nextRow = Math.min(state.rows - 1, nextRow + 1); break;
      case 'left': nextCol = Math.max(0, nextCol - 1); break;
      case 'right': nextCol = Math.min(state.cols - 1, nextCol + 1); break;
    }
    const nextCell = state.grid[nextRow][nextCol];
    if (nextCell && nextCell.element) {
      nextCell.element.focus();
    }
  }

  function mobileAction(action) {
    if (state.gameOver || state.gameWon) return;
    if (state.focusedCell === null) {
      state.focusedCell = state.grid[0][0];
      state.focusedCell.element.focus();
    }
    const cell = state.focusedCell;
    if (!cell) return;
    if (action === 'flag') {
      handleRightClick(cell, { preventDefault: () => {} });
    } else if (action === 'reveal') {
      handleClick(cell, { preventDefault: () => {} });
    }
  }

  // High Score Management
  const STORAGE_KEY = 'atlas_sweeper_scores';

  function getScores() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { beginner: [], intermediate: [], expert: [] };
    } catch (e) {
      return { beginner: [], intermediate: [], expert: [] };
    }
  }

  function saveScore(difficulty, time, name) {
    const scores = getScores();
    scores[difficulty].push({ time, name, date: new Date().toISOString() });
    scores[difficulty].sort((a, b) => a.time - b.time);
    scores[difficulty] = scores[difficulty].slice(0, 10); // Keep top 10
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }

  function renderLeaderboard(difficulty) {
    const scores = getScores();
    const list = scores[difficulty] || [];
    if (list.length === 0) {
      elements.leaderboardContent.innerHTML = '<p class="text-dim">No scores yet.</p>';
      return;
    }
    const html = `
      <table style="width:100%; border-collapse: collapse; font-size: 1.1rem;">
        <thead>
          <tr style="border-bottom: 1px solid var(--fg-dim);">
            <th style="padding: 5px; text-align: left;">RANK</th>
            <th style="padding: 5px; text-align: left;">TIME</th>
            <th style="padding: 5px; text-align: left;">NAME</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((entry, idx) => `
            <tr style="border-bottom: 1px dotted #004400;">
              <td style="padding: 5px;">${idx + 1}</td>
              <td style="padding: 5px;" class="glow-text">${entry.time}s</td>
              <td style="padding: 5px;">${entry.name}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    elements.leaderboardContent.innerHTML = html;
  }

  function showLeaderboard() {
    renderLeaderboard(state.difficulty);
    elements.leaderboardOverlay.classList.remove('hidden');
  }

  function hideLeaderboard() {
    elements.leaderboardOverlay.classList.add('hidden');
    elements.grid.focus();
  }

  // Constants matching CSS
  const GRID_OUTER_MARGIN = 12; // --grid-outer in px
  const CONTAINER_PADDING = 4;  /* px */
  const CONTAINER_BORDER = 2;   /* px */
  const GAP = 2;               /* px */

  // Calculate responsive cell size
  function calculateCellSize() {
    const cfg = CONFIG[state.difficulty];
    // Estimate space taken by other UI elements
    const headerHeight = 80;
    const hudHeight = 50;
    const footerHeight = 40;
    // Measure mobile controls height if present (include margin)
    const mobileControlsEl = document.querySelector('.mobile-controls');
    const mobileHeight = mobileControlsEl ? (mobileControlsEl.offsetHeight + parseFloat(getComputedStyle(mobileControlsEl).marginTop) + parseFloat(getComputedStyle(mobileControlsEl).marginBottom)) : 0;
    // Read CSS variables for padding
    const computedStyle = getComputedStyle(document.documentElement);
    const hPadding = parseInt(computedStyle.getPropertyValue('--h-padding')) || 16;
    const vPadding = parseInt(computedStyle.getPropertyValue('--v-padding')) || 12;
    // Available space inside screen-container content area
    const availableWidth = window.innerWidth - 2 * hPadding - 2 * GRID_OUTER_MARGIN;
    const availableHeight = window.innerHeight - headerHeight - hudHeight - footerHeight - 2 * vPadding - 2 * GRID_OUTER_MARGIN - mobileHeight;
    const totalGapWidth = (cfg.cols - 1) * GAP;
    const totalGapHeight = (cfg.rows - 1) * GAP;
    const extraWidth = 2 * CONTAINER_PADDING + 2 * CONTAINER_BORDER;
    const extraHeight = 2 * CONTAINER_PADDING + 2 * CONTAINER_BORDER;
    const maxCellWidth = Math.floor((availableWidth - totalGapWidth - extraWidth) / cfg.cols);
    const maxCellHeight = Math.floor((availableHeight - totalGapHeight - extraHeight) / cfg.rows);
    // Clamp to reasonable range
    return Math.max(12, Math.min(maxCellWidth, maxCellHeight, 40));
  }

  function setupGridLayout() {
    const cellSize = calculateCellSize();
    const totalGapWidth = (state.cols - 1) * GAP;
    const totalGapHeight = (state.rows - 1) * GAP;
    const extraWidth = 2 * CONTAINER_PADDING + 2 * CONTAINER_BORDER;
    const extraHeight = 2 * CONTAINER_PADDING + 2 * CONTAINER_BORDER;
    const containerWidth = state.cols * cellSize + totalGapWidth + extraWidth;
    const containerHeight = state.rows * cellSize + totalGapHeight + extraHeight;
    const gridEl = elements.grid;
    gridEl.style.gridTemplateColumns = `repeat(${state.cols}, ${cellSize}px)`;
    gridEl.style.gridTemplateRows = `repeat(${state.rows}, ${cellSize}px)`;
    gridEl.style.width = `${containerWidth}px`;
    gridEl.style.height = `${containerHeight}px`;
  }

  // Initialize game
  function initGame() {
    const cfg = CONFIG[state.difficulty];
    state.cols = cfg.cols;
    state.rows = cfg.rows;
    state.totalMines = cfg.mines;
    state.flaggedCount = 0;
    state.revealedCount = 0;
    state.gameOver = false;
    state.gameWon = false;
    state.firstClick = true;
    state.timer = 0;
    state.focusedCell = null;

    stopTimer();
    updateTimerDisplay();
    updateMineCounter();
    hideOverlay();
    hideScoreEntry();
    hideLeaderboard();

    createGrid();
    setupGridLayout();
    renderGrid();
    updateInstructions();
  }

  function createGrid() {
    state.grid = [];
    for (let r = 0; r < state.rows; r++) {
      const row = [];
      for (let c = 0; c < state.cols; c++) {
        row.push({
          row: r,
          col: c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0,
          element: null
        });
      }
      state.grid.push(row);
    }
  }

  function renderGrid() {
    elements.grid.innerHTML = '';
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cellData = state.grid[r][c];
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.dataset.row = r;
        cellEl.dataset.col = c;
        cellEl.tabIndex = -1;
        // Mouse events
        cellEl.addEventListener('click', (e) => {
          if (state.touchHandled) {
            e.preventDefault();
            return;
          }
          handleClick(cellData, e);
        });
        cellEl.addEventListener('contextmenu', (e) => {
          if (state.touchHandled) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          handleRightClick(cellData, e);
        });
        cellEl.addEventListener('focus', () => { state.focusedCell = cellData; });
        // Touch events for mobile
        cellEl.addEventListener('touchstart', handleTouchStart.bind(null, cellData), { passive: false });
        cellEl.addEventListener('touchend', handleTouchEnd.bind(null, cellData), { passive: false });
        cellEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        // Prevent synthetic mouse events after touch
        cellEl.addEventListener('mouseup', (e) => {
          if (state.touchHandled) {
            e.preventDefault();
          }
        });
        cellData.element = cellEl;
        elements.grid.appendChild(cellEl);
      }
    }
  }

  let touchMoved = false;

  function handleTouchStart(cellData, event) {
    if (state.gameOver || state.gameWon) return;
    event.preventDefault();
    state.touchHandled = false;
    touchMoved = false;
    state.touchStartTime = Date.now();
    state.touchTarget = cellData;
  }

  function handleTouchMove(event) {
    touchMoved = true;
  }

  function handleTouchEnd(cellData, event) {
    if (state.gameOver || state.gameWon) return;
    event.preventDefault();
    const duration = Date.now() - state.touchStartTime;
    // Long press: > 500ms
    if (duration > 500 && state.touchTarget === cellData && !touchMoved) {
      state.touchHandled = true;
      handleRightClick(cellData, { preventDefault: () => {} });
    } else if (!touchMoved) {
      state.touchHandled = true;
      handleClick(cellData, { preventDefault: () => {} });
    }
    state.touchTarget = null;
    // Reset touchHandled after a short delay to allow suppression of synthetic mouse events
    setTimeout(() => { state.touchHandled = false; }, 100);
  }

  function placeMines(excludeRow, excludeCol) {
    let minesPlaced = 0;
    while (minesPlaced < state.totalMines) {
      const r = Math.floor(Math.random() * state.rows);
      const c = Math.floor(Math.random() * state.cols);
      if (Math.abs(r - excludeRow) <= 1 && Math.abs(c - excludeCol) <= 1) continue;
      if (state.grid[r][c].isMine) continue;
      state.grid[r][c].isMine = true;
      minesPlaced++;
    }
    calculateNeighbors();
  }

  function calculateNeighbors() {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (state.grid[r][c].isMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) continue;
            if (state.grid[nr][nc].isMine) count++;
          }
        }
        state.grid[r][c].neighborMines = count;
      }
    }
  }

  function startTimer() {
    stopTimer();
    state.timer = 0;
    state.timerInterval = setInterval(() => {
      state.timer++;
      if (state.timer > 999) state.timer = 999;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    elements.timer.textContent = state.timer.toString().padStart(3, '0');
  }

  function updateMineCounter() {
    const remaining = state.totalMines - state.flaggedCount;
    elements.mineCounter.textContent = Math.max(0, remaining).toString().padStart(3, '0');
  }

  function handleClick(cellData, event) {
    if (state.gameOver || state.gameWon) return;
    if (cellData.isFlagged) return;
    if (cellData.isRevealed) return;

    if (state.firstClick) {
      state.firstClick = false;
      placeMines(cellData.row, cellData.col);
      startTimer();
    }

    revealCell(cellData);
    checkWinCondition();
  }

  function handleRightClick(cellData, event) {
    event.preventDefault();
    if (state.gameOver || state.gameWon) return;
    if (cellData.isRevealed) return;

    cellData.isFlagged = !cellData.isFlagged;
    state.flaggedCount += cellData.isFlagged ? 1 : -1;
    cellData.element.classList.toggle('flagged', cellData.isFlagged);
    updateMineCounter();
  }

  function revealCell(cellData) {
    if (cellData.isRevealed || cellData.isFlagged) return;
    cellData.isRevealed = true;
    state.revealedCount++;

    cellData.element.classList.add('revealed');
    if (cellData.isMine) {
      cellData.element.classList.add('mine');
      gameOver(false);
      return;
    }

    if (cellData.neighborMines > 0) {
      cellData.element.textContent = cellData.neighborMines;
      cellData.element.setAttribute('data-neighbors', cellData.neighborMines);
    } else {
      // Flood fill for zeros
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = cellData.row + dr, nc = cellData.col + dc;
          if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) continue;
          const neighbor = state.grid[nr][nc];
          if (!neighbor.isRevealed && !neighbor.isMine) {
            revealCell(neighbor);
          }
        }
      }
    }
  }

  function checkWinCondition() {
    const totalCells = state.rows * state.cols;
    const safeCells = totalCells - state.totalMines;
    if (state.revealedCount === safeCells) {
      gameOver(true);
    }
  }

  function gameOver(won) {
    state.gameOver = true;
    state.gameWon = won;
    stopTimer();

    if (won) {
      // Flag all remaining mines
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          const cell = state.grid[r][c];
          if (cell.isMine && !cell.isFlagged) {
            cell.isFlagged = true;
            cell.element.classList.add('flagged');
          }
        }
      }
      state.flaggedCount = state.totalMines;
      updateMineCounter();

      // Check for high score
      const scores = getScores();
      const currentBest = scores[state.difficulty][0]?.time || Infinity;
      if (state.timer < currentBest || scores[state.difficulty].length < 10) {
        // Show high score entry after brief delay
        setTimeout(() => {
          showOverlay('MISSION COMPLETE', `You cleared the field in ${state.timer} seconds!`, false);
          setTimeout(() => {
            hideOverlay();
            showScoreEntry();
          }, 1500);
        }, 500);
        return;
      }

      showOverlay('MISSION COMPLETE', `You cleared the field in ${state.timer} seconds.`, true);
    } else {
      // Reveal all mines
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          const cell = state.grid[r][c];
          if (cell.isMine) {
            cell.element.classList.add('revealed', 'mine');
          }
        }
      }
      showOverlay('MISSION FAILED', 'You triggered a mine!', true);
    }
  }

  function restartGame() {
    initGame();
    elements.grid.focus();
  }

  // Keyboard navigation (desktop)
  function handleKeyDown(event) {
    if (state.gameOver && event.key !== 'r' && event.key !== 'R') return;

    const key = event.key.toLowerCase();
    if (key === 'r') {
      restartGame();
      return;
    }

    // Close overlays with Escape
    if (key === 'escape') {
      hideOverlay();
      hideScoreEntry();
      hideLeaderboard();
      return;
    }

    // Disable arrow navigation on mobile to avoid scroll conflicts
    if (state.isTouchDevice) return;

    if (state.focusedCell === null) {
      state.focusedCell = state.grid[0][0];
      state.focusedCell.element.focus();
      return;
    }

    let nextRow = state.focusedCell.row;
    let nextCol = state.focusedCell.col;

    switch (key) {
      case 'arrowup': nextRow = Math.max(0, nextRow - 1); break;
      case 'arrowdown': nextRow = Math.min(state.rows - 1, nextRow + 1); break;
      case 'arrowleft': nextCol = Math.max(0, nextCol - 1); break;
      case 'arrowright': nextCol = Math.min(state.cols - 1, nextCol + 1); break;
      case ' ': case 'enter': event.preventDefault(); handleClick(state.focusedCell); return;
      case 'f': event.preventDefault(); handleRightClick(state.focusedCell, { preventDefault: () => {} }); return;
      default: return;
    }

    const nextCell = state.grid[nextRow]?.[nextCol];
    if (nextCell && nextCell.element) {
      nextCell.element.focus();
    }
  }

  // Overlay management
  function showOverlay(title, text, showButton = false) {
    elements.messageTitle.textContent = title;
    elements.messageText.textContent = text;
    elements.overlayCloseBtn.style.display = showButton ? 'inline-block' : 'none';
    elements.messageOverlay.classList.remove('hidden');
    if (showButton) {
      elements.overlayCloseBtn.focus();
    }
  }

  function hideOverlay() {
    elements.messageOverlay.classList.add('hidden');
    if (!state.gameOver) elements.grid.focus();
  }

  // High Score Entry
  function showScoreEntry() {
    elements.playerName.value = '';
    elements.scoreEntryOverlay.classList.remove('hidden');
    elements.playerName.focus();
  }

  function hideScoreEntry() {
    elements.scoreEntryOverlay.classList.add('hidden');
  }

  function saveHighScore() {
    const name = elements.playerName.value.trim() || 'PLAYER';
    saveScore(state.difficulty, state.timer, name);
    hideScoreEntry();
    showLeaderboard();
  }

  function cancelHighScore() {
    hideScoreEntry();
    restartGame();
  }

  // Update instructions based on device
  function updateInstructions() {
    if (state.isTouchDevice) {
      elements.instructionsText.innerHTML = 'TAP/REVEAL BUTTON: REVEAL &nbsp;|&nbsp; LONG PRESS/FLAG BUTTON: FLAG &nbsp;|&nbsp; ARROWS/BUTTONS: MOVE &nbsp;|&nbsp; R: RESTART';
    } else {
      elements.instructionsText.innerHTML = 'L-CLICK/SPACE: REVEAL &nbsp;|&nbsp; R-CLICK/F: FLAG &nbsp;|&nbsp; ARROWS: MOVE &nbsp;|&nbsp; R: RESTART';
    }
  }

  // Event listeners
  elements.restartBtn.addEventListener('click', restartGame);
  elements.scoresBtn.addEventListener('click', showLeaderboard);
  elements.overlayCloseBtn.addEventListener('click', () => {
    if (state.gameOver || state.gameWon) {
      restartGame();
    } else {
      hideOverlay();
    }
  });

  elements.difficulty.addEventListener('change', (e) => {
    state.difficulty = e.target.value;
    restartGame();
  });

  elements.saveScoreBtn.addEventListener('click', saveHighScore);
  elements.cancelScoreBtn.addEventListener('click', cancelHighScore);
  elements.closeLeaderboardBtn.addEventListener('click', hideLeaderboard);
  elements.playerName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveHighScore();
    if (e.key === 'Escape') cancelHighScore();
  });

  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', () => {
    setupGridLayout();
  });

  // Boot
  initGame();
  elements.grid.focus();
  setupMobileControls();
})();