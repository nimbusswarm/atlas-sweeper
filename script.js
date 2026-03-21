// Atlas Sweeper - Game Logic
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
    focusedCell: null
  };

  const elements = {
    grid: document.getElementById('grid'),
    mineCounter: document.getElementById('mineCounter'),
    timer: document.getElementById('timer'),
    difficulty: document.getElementById('difficulty'),
    restartBtn: document.getElementById('restartBtn'),
    messageOverlay: document.getElementById('messageOverlay'),
    messageTitle: document.getElementById('messageTitle'),
    messageText: document.getElementById('messageText'),
    overlayCloseBtn: document.getElementById('overlayCloseBtn')
  };

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

    createGrid();
    setupGridLayout();
    renderGrid();
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

  function setupGridLayout() {
    const gap = getComputedStyle(document.documentElement).getPropertyValue('--grid-gap').trim() || '2px';
    const gapPx = parseInt(gap, 10) || 2;
    const cellSize = window.innerWidth < 480 ? 20 : window.innerWidth < 768 ? 24 : 30;
    const containerWidth = state.cols * cellSize + (state.cols - 1) * gapPx + 8;
    const containerHeight = state.rows * cellSize + (state.rows - 1) * gapPx + 8;
    elements.grid.style.gridTemplateColumns = `repeat(${state.cols}, ${cellSize}px)`;
    elements.grid.style.gridTemplateRows = `repeat(${state.rows}, ${cellSize}px)`;
    elements.grid.style.width = `${containerWidth}px`;
    elements.grid.style.height = `${containerHeight}px`;
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
        cellEl.tabIndex = -1; // we'll manage focus manually
        cellEl.addEventListener('click', handleClick.bind(null, cellData));
        cellEl.addEventListener('contextmenu', handleRightClick.bind(null, cellData));
        cellEl.addEventListener('focus', () => { state.focusedCell = cellData; });
        cellData.element = cellEl;
        elements.grid.appendChild(cellEl);
      }
    }
  }

  function placeMines(excludeRow, excludeCol) {
    let minesPlaced = 0;
    while (minesPlaced < state.totalMines) {
      const r = Math.floor(Math.random() * state.rows);
      const c = Math.floor(Math.random() * state.cols);
      // Exclude the first clicked cell and its immediate neighbors to ensure safe start
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
    // Set focus to grid for keyboard navigation
    elements.grid.focus();
  }

  // Keyboard navigation
  function handleKeyDown(event) {
    if (state.gameOver && event.key !== 'r' && event.key !== 'R') return;

    const key = event.key.toLowerCase();
    if (key === 'r') {
      restartGame();
      return;
    }

    if (state.focusedCell === null) {
      // Focus on first cell
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
      case 'escape': hideOverlay(); return;
      default: return;
    }

    const nextCell = state.grid[nextRow][nextCol];
    if (nextCell && nextCell.element) {
      nextCell.element.focus();
    }
  }

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
    elements.grid.focus();
  }

  // Event listeners
  elements.restartBtn.addEventListener('click', restartGame);
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

  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', () => {
    setupGridLayout();
  });

  // Boot
  initGame();
  elements.grid.focus();
})();