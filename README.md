# Atlas Sweeper

A retro CRT terminal-styled Minesweeper clone with mobile support and persistent high scores.

## Features

- Classic Minesweeper gameplay with three difficulty levels: **Beginner** (9×9, 10 mines), **Intermediate** (16×16, 40 mines), **Expert** (30×16, 99 mines)
- **Mobile-friendly** controls: tap to reveal, long press to flag
- **Responsive grid**: adapts to screen sizes (small, medium, large, XL)
- **Persistent high score leaderboard**: records fastest times per difficulty, synced across sessions via localStorage
- Full keyboard navigation for desktop
- Authentic CRT terminal aesthetic: scanlines, curvature, glow, phosphor fade
- Smooth animations: screen flicker on start, cell reveal, flag placement, timer ticks, win/loss overlays
- Fully offline; no external dependencies

## How to Play

### Desktop
- **Left Click** or **Space/Enter**: Reveal cell
- **Right Click** or **F**: Toggle flag
- **Arrow Keys**: Move selection
- **R**: Restart game
- **Esc**: Close overlays

### Mobile / Touch
- **Tap**: Reveal cell
- **Long Press** (≈0.5s): Toggle flag
- Note: Arrow key navigation is disabled on touch devices to avoid scrolling conflicts.

## High Scores

When you win a game, your time is eligible for the high score leaderboard. You'll be prompted to enter your name. The top 10 fastest times for each difficulty are saved locally and persist across sessions.

To view the leaderboard at any time, click the **SCORES** button in the header.

## Responsive Design

The game board automatically scales to fit your screen:
- **Small** (< 360px): 18px cells
- **Medium** (360–480px): 20px cells
- **Large** (480–768px): 24px cells
- **XL** (> 768px): 30px cells

The layout adjusts to maintain square cells and keep the full grid visible.

## Run Locally

Open `index.html` in any modern browser.

## GitHub Pages

Once enabled, the live site will be at: https://nimbusswarm.github.io/atlas-sweeper/

---
Built with plain HTML, CSS, and JavaScript.