import { readNumber, writeNumber } from '../../shared/storage.js';

export const id = 'snake';
export const title = '霓虹贪吃蛇';
export const status = 'available';

const GRID_SIZE = 20;
const INITIAL_TICK = 140;
const MIN_TICK = 70;
const TICK_STEP = 10;
const FOODS_PER_LEVEL = 3;
const SCORE_PER_FOOD = 10;
const BEST_KEY = 'mod-snake-best';

const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1, name: 'up' }),
  down: Object.freeze({ x: 0, y: 1, name: 'down' }),
  left: Object.freeze({ x: -1, y: 0, name: 'left' }),
  right: Object.freeze({ x: 1, y: 0, name: 'right' })
});

const KEY_DIRECTIONS = Object.freeze({
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right'
});

const STATE_LABELS = Object.freeze({
  idle: '待机',
  running: '运行中',
  paused: '已暂停',
  over: '已结束'
});

const TEMPLATE = `
  <div class="mod-snake-root">
    <div class="mod-snake-layout">
      <div class="mod-snake-board">
        <div class="mod-snake-board-head">
          <div class="mod-snake-ident">
            <span class="mod-snake-ident-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4.2 7.2h9.1a3 3 0 0 1 0 6H8.7a2.6 2.6 0 0 0 0 5.2h8.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                <circle cx="18.1" cy="5.6" r="1.5" fill="currentColor"/>
                <path d="M4.2 7.2v9.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
              </svg>
            </span>
            <div class="mod-snake-ident-copy">
              <p class="mod-snake-code">ARCADE_001 // CANVAS_20x20</p>
              <p class="mod-snake-name">NEON_SNAKE.EXE</p>
            </div>
          </div>

          <div class="mod-snake-status" data-state="idle">
            <span class="mod-snake-status-dot" aria-hidden="true"></span>
            <span class="mod-snake-status-label">待机</span>
          </div>
        </div>

        <dl class="mod-snake-scores" aria-label="本局数据">
          <div class="mod-snake-score mod-snake-score--primary">
            <dt class="mod-snake-score-label">SCORE</dt>
            <dd class="mod-snake-score-cell"><span class="mod-snake-score-value" id="mod-snake-score">000</span></dd>
          </div>
          <div class="mod-snake-score mod-snake-score--best">
            <dt class="mod-snake-score-label">BEST</dt>
            <dd class="mod-snake-score-cell"><span class="mod-snake-score-value" id="mod-snake-best">000</span></dd>
          </div>
          <div class="mod-snake-score">
            <dt class="mod-snake-score-label">LENGTH</dt>
            <dd class="mod-snake-score-cell"><span class="mod-snake-score-value" id="mod-snake-length">03</span></dd>
          </div>
          <div class="mod-snake-score">
            <dt class="mod-snake-score-label">SPEED</dt>
            <dd class="mod-snake-score-cell"><span class="mod-snake-score-value" id="mod-snake-speed">×1.0</span></dd>
          </div>
        </dl>

        <div class="mod-snake-stage">
          <div class="mod-snake-canvas-wrap" id="mod-snake-canvas-wrap">
            <canvas
              class="mod-snake-canvas"
              id="mod-snake-canvas"
              width="640"
              height="640"
              tabindex="0"
              role="img"
              aria-label="霓虹贪吃蛇游戏区域。使用方向键、WASD、屏幕方向键或滑动棋盘控制。"
            >你的浏览器不支持 Canvas。</canvas>

            <div class="mod-snake-overlay" id="mod-snake-ready">
              <p class="mod-snake-overlay-code">SYSTEM_READY // GRID_20x20</p>
              <h3 class="mod-snake-overlay-title">准备接入网格</h3>
              <p class="mod-snake-overlay-copy">吞噬能量核心，让身体变长。撞上边界或咬到自己，本局立即结束。</p>
              <button class="mod-snake-button mod-snake-button--primary" id="mod-snake-start" type="button">
                启动贪吃蛇
                <svg class="mod-snake-button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor"/>
                </svg>
              </button>
            </div>

            <div class="mod-snake-overlay" id="mod-snake-pause" hidden>
              <div class="mod-snake-pause-glyph" aria-hidden="true"><span></span><span></span></div>
              <p class="mod-snake-overlay-code">SIMULATION_PAUSED</p>
              <h3 class="mod-snake-overlay-title">进程已暂停</h3>
              <p class="mod-snake-overlay-copy">网格已冻结。继续时，霓虹蛇会从刚才的位置出发。</p>
              <button class="mod-snake-button mod-snake-button--primary" id="mod-snake-resume" type="button">
                继续游戏
              </button>
            </div>
          </div>
        </div>

        <div class="mod-snake-toolbar">
          <div class="mod-snake-hints" aria-hidden="true">
            <span class="mod-snake-hint">
              <kbd class="mod-snake-key">↑</kbd><kbd class="mod-snake-key">↓</kbd><kbd class="mod-snake-key">←</kbd><kbd class="mod-snake-key">→</kbd>
              移动
            </span>
            <span class="mod-snake-hint"><kbd class="mod-snake-key">SPACE</kbd>暂停</span>
          </div>
          <div class="mod-snake-actions">
            <button class="mod-snake-button mod-snake-button--ghost mod-snake-button--compact" id="mod-snake-pause-button" type="button" disabled>
              <svg class="mod-snake-button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path id="mod-snake-pause-icon" d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span id="mod-snake-pause-label">暂停</span>
            </button>
            <button class="mod-snake-button mod-snake-button--ghost mod-snake-button--compact" id="mod-snake-reset" type="button" disabled>
              <svg class="mod-snake-button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4.8 9.8A7.5 7.5 0 1 1 5 15.4M4.8 4.8v5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              重开
            </button>
          </div>
        </div>
      </div>

      <aside class="mod-snake-aside">
        <section class="mod-snake-panel" aria-labelledby="mod-snake-controls-title">
          <div class="mod-snake-panel-head">
            <h3 class="mod-snake-panel-title" id="mod-snake-controls-title">CONTROL_DECK</h3>
            <span class="mod-snake-panel-note">触控方向键</span>
          </div>
          <div class="mod-snake-dpad" role="group" aria-label="屏幕方向键">
            <button class="mod-snake-dpad-button mod-snake-dpad-up" type="button" data-dir="up" aria-label="向上移动" disabled>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 14 6-6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="mod-snake-dpad-button mod-snake-dpad-left" type="button" data-dir="left" aria-label="向左移动" disabled>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <span class="mod-snake-dpad-core" aria-hidden="true"></span>
            <button class="mod-snake-dpad-button mod-snake-dpad-right" type="button" data-dir="right" aria-label="向右移动" disabled>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m10 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="mod-snake-dpad-button mod-snake-dpad-down" type="button" data-dir="down" aria-label="向下移动" disabled>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 10 6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <p class="mod-snake-panel-copy">方向键 / WASD 移动，空格暂停。<br>手机可在棋盘上滑动，最高分会保存在本机。</p>
        </section>

        <section class="mod-snake-panel" aria-labelledby="mod-snake-mission-title">
          <div class="mod-snake-panel-head">
            <h3 class="mod-snake-panel-title" id="mod-snake-mission-title">MISSION_BRIEF</h3>
            <span class="mod-snake-panel-note">任务简报</span>
          </div>
          <ul class="mod-snake-missions">
            <li class="mod-snake-mission">
              <span class="mod-snake-mission-index" aria-hidden="true">01</span>
              <span>吞噬能量核心，每次得 <strong class="mod-snake-strong">10 分</strong>，身体增长一格。</span>
            </li>
            <li class="mod-snake-mission">
              <span class="mod-snake-mission-index" aria-hidden="true">02</span>
              <span>每吃下 3 个核心，移动速度提升一级，上限 <strong class="mod-snake-strong">×2.0</strong>。</span>
            </li>
            <li class="mod-snake-mission">
              <span class="mod-snake-mission-index" aria-hidden="true">03</span>
              <span>别撞上网格边界，也别让头部咬到身体。</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <dialog class="mod-snake-dialog" id="mod-snake-result" aria-labelledby="mod-snake-result-title" aria-describedby="mod-snake-result-reason">
      <div class="mod-snake-result-shell">
        <button class="mod-snake-result-close" id="mod-snake-result-close" type="button" aria-label="关闭结算窗口">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
        </button>
        <p class="mod-snake-result-kicker" id="mod-snake-result-kicker">SIMULATION_ENDED // SIGNAL_LOST</p>
        <h2 class="mod-snake-result-title" id="mod-snake-result-title">GAME <span>OVER</span></h2>
        <p class="mod-snake-result-reason" id="mod-snake-result-reason">信号中断：霓虹蛇撞上了网格边界。</p>
        <div class="mod-snake-result-score">
          <div>
            <span class="mod-snake-result-label">FINAL_SCORE</span>
            <strong class="mod-snake-result-value" id="mod-snake-result-score">000</strong>
          </div>
          <span class="mod-snake-result-best">
            PERSONAL_BEST
            <strong class="mod-snake-result-best-value" id="mod-snake-result-best">000</strong>
          </span>
        </div>
        <dl class="mod-snake-result-stats">
          <div class="mod-snake-result-stat">
            <dt class="mod-snake-result-stat-label">FINAL_LENGTH</dt>
            <dd class="mod-snake-result-stat-value" id="mod-snake-result-length">03</dd>
          </div>
          <div class="mod-snake-result-stat">
            <dt class="mod-snake-result-stat-label">RUN_SPEED</dt>
            <dd class="mod-snake-result-stat-value" id="mod-snake-result-speed">×1.0</dd>
          </div>
        </dl>
        <div class="mod-snake-result-actions">
          <button class="mod-snake-button mod-snake-button--primary" id="mod-snake-retry" type="button">再来一局</button>
          <button class="mod-snake-button mod-snake-button--ghost" id="mod-snake-back" type="button">返回待机</button>
        </div>
      </div>
    </dialog>

    <p class="mod-snake-sr-only" id="mod-snake-announcement" aria-live="polite"></p>
  </div>
`;

export function mount(container) {
  container.innerHTML = TEMPLATE;

  const $ = (selector) => container.querySelector(selector);
  const elements = {
    canvas: $('#mod-snake-canvas'),
    canvasWrap: $('#mod-snake-canvas-wrap'),
    readyOverlay: $('#mod-snake-ready'),
    pauseOverlay: $('#mod-snake-pause'),
    startButton: $('#mod-snake-start'),
    resumeButton: $('#mod-snake-resume'),
    pauseButton: $('#mod-snake-pause-button'),
    pauseLabel: $('#mod-snake-pause-label'),
    pauseIcon: $('#mod-snake-pause-icon'),
    resetButton: $('#mod-snake-reset'),
    statusPill: $('.mod-snake-status'),
    statusLabel: $('.mod-snake-status-label'),
    score: $('#mod-snake-score'),
    best: $('#mod-snake-best'),
    length: $('#mod-snake-length'),
    speed: $('#mod-snake-speed'),
    directionButtons: Array.from(container.querySelectorAll('.mod-snake-dpad-button')),
    announcement: $('#mod-snake-announcement'),
    dialog: $('#mod-snake-result'),
    resultClose: $('#mod-snake-result-close'),
    resultBack: $('#mod-snake-back'),
    resultRetry: $('#mod-snake-retry'),
    resultKicker: $('#mod-snake-result-kicker'),
    resultTitle: $('#mod-snake-result-title'),
    resultReason: $('#mod-snake-result-reason'),
    resultScore: $('#mod-snake-result-score'),
    resultBest: $('#mod-snake-result-best'),
    resultLength: $('#mod-snake-result-length'),
    resultSpeed: $('#mod-snake-result-speed')
  };

  const ctx = elements.canvas ? elements.canvas.getContext('2d') : null;
  if (!ctx) {
    container.innerHTML = '<p class="mod-snake-load-error" role="alert">当前浏览器不支持 Canvas，无法启动游戏。</p>';
    return () => {
      container.replaceChildren();
    };
  }

  const controller = new AbortController();
  const { signal } = controller;
  const timers = new Set();
  let disposed = false;
  let state = 'idle';
  let snake = [];
  let food = null;
  let direction = DIRECTIONS.right;
  let directionQueue = [];
  let score = 0;
  let bestScore = Math.max(0, Math.floor(readNumber(BEST_KEY, 0)));
  let foodsEaten = 0;
  let currentTick = INITIAL_TICK;
  let animationId = 0;
  let previousFrame = 0;
  let accumulator = 0;
  let viewSize = 0;
  let swipeStart = null;
  let announcementTimer = 0;
  let resizeObserver = null;

  resetRound();
  bindEvents();
  updateUI();
  renderHud();
  observeCanvas();
  resizeCanvas();
  draw(performance.now());

  function later(callback, delay) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!disposed) callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function bindEvents() {
    elements.startButton.addEventListener('click', startGame, { signal });
    elements.resumeButton.addEventListener('click', resumeGame, { signal });
    elements.pauseButton.addEventListener('click', togglePause, { signal });
    elements.resetButton.addEventListener('click', startGame, { signal });

    elements.directionButtons.forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          if (state !== 'running') return;
          queueDirection(button.dataset.dir);
          flashDirectionButton(button.dataset.dir);
        },
        { signal }
      );
    });

    elements.canvas.addEventListener('pointerdown', handlePointerDown, { signal });
    elements.canvas.addEventListener('pointerup', handlePointerUp, { signal });
    elements.canvas.addEventListener('pointercancel', clearSwipe, { signal });
    elements.canvas.addEventListener('lostpointercapture', clearSwipe, { signal });

    document.addEventListener('keydown', handleKeyDown, { signal });
    document.addEventListener('visibilitychange', handleVisibilityChange, { signal });
    window.addEventListener(
      'blur',
      () => {
        if (state === 'running') pauseGame(true);
      },
      { signal }
    );

    elements.resultRetry.addEventListener(
      'click',
      () => {
        closeResultDialog();
        startGame();
      },
      { signal }
    );
    elements.resultClose.addEventListener('click', closeResultDialog, { signal });
    elements.resultBack.addEventListener('click', closeResultDialog, { signal });
    elements.dialog.addEventListener('close', handleResultClosed, { signal });
    elements.dialog.addEventListener(
      'click',
      (event) => {
        if (event.target === elements.dialog) closeResultDialog();
      },
      { signal }
    );
  }

  function createInitialSnake() {
    return [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
  }

  function resetRound() {
    cancelAnimationFrame(animationId);
    animationId = 0;
    accumulator = 0;
    direction = DIRECTIONS.right;
    directionQueue = [];
    foodsEaten = 0;
    currentTick = INITIAL_TICK;
    score = 0;
    snake = createInitialSnake();
    food = spawnFood();
    swipeStart = null;
  }

  function startGame() {
    resetRound();
    state = 'running';
    clearResultState();
    updateUI();
    renderHud();
    draw(performance.now());
    announce('游戏开始。使用方向键、WASD 或滑动棋盘控制霓虹蛇。');

    cancelAnimationFrame(animationId);
    previousFrame = performance.now();
    accumulator = 0;
    animationId = window.requestAnimationFrame(updateFrame);
  }

  function pauseGame(autoPaused = false) {
    if (state !== 'running') return;
    cancelAnimationFrame(animationId);
    animationId = 0;
    accumulator = 0;
    directionQueue = [];
    state = 'paused';
    updateUI();
    draw(performance.now());
    announce(autoPaused ? '游戏已自动暂停。' : '游戏已暂停。');
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'running';
    updateUI();
    announce('继续游戏。');
    cancelAnimationFrame(animationId);
    previousFrame = performance.now();
    accumulator = 0;
    animationId = window.requestAnimationFrame(updateFrame);
  }

  function togglePause() {
    if (state === 'running') {
      pauseGame(false);
    } else if (state === 'paused') {
      resumeGame();
    }
  }

  function resetToIdle(options = {}) {
    cancelAnimationFrame(animationId);
    animationId = 0;
    state = 'idle';
    resetRound();
    updateUI();
    renderHud();
    draw(performance.now());

    if (options.announce) announce('已回到待机状态。');
  }

  function updateFrame(now) {
    if (disposed || state !== 'running') return;

    const delta = Math.min(now - previousFrame, 120);
    previousFrame = now;
    accumulator += delta;

    let processedTicks = 0;
    while (state === 'running' && accumulator >= currentTick && processedTicks < 4) {
      accumulator -= currentTick;
      step();
      processedTicks += 1;
    }

    if (state !== 'running') return;
    draw(now);
    animationId = window.requestAnimationFrame(updateFrame);
  }

  function step() {
    const queuedDirection = directionQueue.shift();
    if (queuedDirection) direction = queuedDirection;

    const head = snake[0];
    const nextHead = { x: head.x + direction.x, y: head.y + direction.y };

    if (
      nextHead.x < 0 ||
      nextHead.y < 0 ||
      nextHead.x >= GRID_SIZE ||
      nextHead.y >= GRID_SIZE
    ) {
      endGame('wall');
      return;
    }

    const willEat = food !== null && nextHead.x === food.x && nextHead.y === food.y;
    const bodyToCheck = willEat ? snake : snake.slice(0, -1);

    if (bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)) {
      endGame('self');
      return;
    }

    snake.unshift(nextHead);

    if (!willEat) {
      snake.pop();
      return;
    }

    score += SCORE_PER_FOOD;
    foodsEaten += 1;
    currentTick = getTickForFoods(foodsEaten);
    food = spawnFood();
    renderHud({ popScore: true });

    if (!food) endGame('win');
  }

  function endGame(reason) {
    if (state !== 'running') return;

    cancelAnimationFrame(animationId);
    animationId = 0;
    accumulator = 0;

    const isNewRecord = score > bestScore;
    state = 'over';

    if (isNewRecord) {
      bestScore = score;
      writeNumber(BEST_KEY, bestScore);
    }

    updateUI();
    renderHud();
    draw(performance.now());
    presentResult(reason, isNewRecord);
    announce(getGameOverAnnouncement(reason));
    later(openResultDialog, 40);
  }

  function queueDirection(dirName) {
    if (state !== 'running' || !DIRECTIONS[dirName]) return false;

    const nextDirection = DIRECTIONS[dirName];
    const lastDirection = directionQueue.length
      ? directionQueue[directionQueue.length - 1]
      : direction;

    const isSame =
      nextDirection.x === lastDirection.x && nextDirection.y === lastDirection.y;
    const isOpposite =
      nextDirection.x === -lastDirection.x && nextDirection.y === -lastDirection.y;

    if (isSame || isOpposite || directionQueue.length >= 2) return false;

    directionQueue.push(nextDirection);
    return true;
  }

  function handleKeyDown(event) {
    if (disposed || elements.dialog.open) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;

    const dirName = KEY_DIRECTIONS[event.code];
    if (dirName) {
      if (state === 'running') {
        event.preventDefault();
        if (!event.repeat) queueDirection(dirName);
      }
      return;
    }

    if (event.code !== 'Space' && event.code !== 'KeyP') return;
    if (state !== 'running' && state !== 'paused') return;
    if (isNativeControl(event.target)) return;

    event.preventDefault();
    if (!event.repeat) togglePause();
  }

  function handlePointerDown(event) {
    if (state !== 'running' || !event.isPrimary) return;
    swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };

    try {
      elements.canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // Swipes still work if pointer capture is unavailable.
    }
  }

  function handlePointerUp(event) {
    if (!swipeStart || event.pointerId !== swipeStart.id) return;

    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    const threshold = Math.max(16, viewSize * 0.04);
    clearSwipe();

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return;

    const dirName =
      Math.abs(deltaX) > Math.abs(deltaY)
        ? deltaX > 0 ? 'right' : 'left'
        : deltaY > 0 ? 'down' : 'up';

    if (queueDirection(dirName)) flashDirectionButton(dirName);
  }

  function clearSwipe() {
    swipeStart = null;
  }

  function handleVisibilityChange() {
    if (document.hidden && state === 'running') pauseGame(true);
  }

  function flashDirectionButton(dirName) {
    const button = elements.directionButtons.find((item) => item.dataset.dir === dirName);
    if (!button) return;

    button.classList.add('mod-snake-pressed');
    later(() => button.classList.remove('mod-snake-pressed'), 130);
  }

  function isTypingTarget(target) {
    return target instanceof Element && Boolean(
      target.closest('input, textarea, select, [contenteditable="true"]')
    );
  }

  function isNativeControl(target) {
    return target instanceof Element && Boolean(target.closest('button, a, summary, input, textarea, select'));
  }

  function observeCanvas() {
    if (!('ResizeObserver' in window)) {
      window.addEventListener('resize', resizeCanvas, { signal });
      return;
    }

    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(elements.canvasWrap);
  }

  function resizeCanvas() {
    if (disposed) return;

    const rect = elements.canvasWrap.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width, rect.height));
    if (size <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelSize = Math.max(1, Math.round(size * dpr));
    viewSize = size;

    if (elements.canvas.width !== pixelSize || elements.canvas.height !== pixelSize) {
      elements.canvas.width = pixelSize;
      elements.canvas.height = pixelSize;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    draw(performance.now());
  }

  function draw(now) {
    if (!viewSize) return;

    const cell = viewSize / GRID_SIZE;
    ctx.clearRect(0, 0, viewSize, viewSize);
    if (food) drawFood(food, cell, now);
    drawSnake(cell);
  }

  function drawSnake(cell) {
    if (!snake.length) return;

    const centers = snake.map((segment) => ({
      x: (segment.x + 0.5) * cell,
      y: (segment.y + 0.5) * cell
    }));
    const head = centers[0];
    const tail = centers[centers.length - 1];

    if (centers.length > 1) {
      const bodyGradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      bodyGradient.addColorStop(0, '#8059ff');
      bodyGradient.addColorStop(0.38, '#5d8dff');
      bodyGradient.addColorStop(0.72, '#4ecbff');
      bodyGradient.addColorStop(1, '#7cf4ff');

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = bodyGradient;
      ctx.lineWidth = cell * 0.6;
      ctx.shadowColor = 'rgba(91, 220, 255, 0.72)';
      ctx.shadowBlur = cell * 0.72;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      for (let index = centers.length - 2; index >= 0; index -= 1) {
        ctx.lineTo(centers[index].x, centers[index].y);
      }
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#e8feff';
      ctx.lineWidth = Math.max(1, cell * 0.11);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#8b65ff';
      ctx.shadowColor = 'rgba(128, 89, 255, 0.8)';
      ctx.shadowBlur = cell * 0.45;
      ctx.beginPath();
      ctx.arc(tail.x, tail.y, cell * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawSnakeHead(head, cell);
  }

  function drawSnakeHead(head, cell) {
    ctx.save();
    ctx.fillStyle = '#87f3ff';
    ctx.shadowColor = 'rgba(100, 231, 255, 0.9)';
    ctx.shadowBlur = cell * 0.8;
    ctx.beginPath();
    ctx.arc(head.x, head.y, cell * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(230, 254, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(
      head.x - direction.x * cell * 0.06,
      head.y - direction.y * cell * 0.06,
      cell * 0.16,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const perpendicularX = direction.y;
    const perpendicularY = -direction.x;
    const forwardOffset = cell * 0.11;
    const lateralOffset = cell * 0.14;

    ctx.fillStyle = '#04131c';
    [-1, 1].forEach((side) => {
      const eyeX = head.x + direction.x * forwardOffset + perpendicularX * lateralOffset * side;
      const eyeY = head.y + direction.y * forwardOffset + perpendicularY * lateralOffset * side;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, cell * 0.058, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  function drawFood(currentFood, cell, now) {
    const pulse = state === 'running' ? (Math.sin(now / 260) + 1) / 2 : 0.45;
    const centerX = (currentFood.x + 0.5) * cell;
    const centerY = (currentFood.y + 0.5) * cell;
    const coreSize = cell * (0.17 + pulse * 0.025);

    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, cell * 1.15);
    glow.addColorStop(0, 'rgba(255, 113, 202, 0.24)');
    glow.addColorStop(0.46, 'rgba(255, 113, 202, 0.1)');
    glow.addColorStop(1, 'rgba(255, 113, 202, 0)');

    ctx.save();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ff78cf';
    ctx.shadowColor = 'rgba(255, 80, 198, 0.95)';
    ctx.shadowBlur = cell * 0.7;
    roundedRectPath(-coreSize, -coreSize, coreSize * 2, coreSize * 2, cell * 0.1);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe2fa';
    roundedRectPath(-coreSize * 0.34, -coreSize * 0.34, coreSize * 0.68, coreSize * 0.68, cell * 0.04);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = `rgba(255, 114, 205, ${0.2 + pulse * 0.18})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * (0.38 + pulse * 0.05), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function roundedRectPath(x, y, width, height, radius) {
    const safeRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
  }

  function updateUI() {
    const isRunning = state === 'running';
    const canPause = isRunning || state === 'paused';

    elements.statusPill.dataset.state = state;
    elements.statusLabel.textContent = STATE_LABELS[state];
    elements.pauseButton.disabled = !canPause;
    elements.pauseLabel.textContent = state === 'paused' ? '继续' : '暂停';
    elements.pauseIcon.setAttribute(
      'd',
      state === 'paused' ? 'M8 5.5 19 12 8 18.5V5.5Z' : 'M8 5v14M16 5v14'
    );
    elements.pauseIcon.setAttribute('fill', state === 'paused' ? 'currentColor' : 'none');
    elements.resetButton.disabled = state === 'idle';
    elements.readyOverlay.hidden = state !== 'idle';
    elements.pauseOverlay.hidden = state !== 'paused';

    elements.directionButtons.forEach((button) => {
      button.disabled = !isRunning;
    });
  }

  function renderHud(options = {}) {
    elements.score.textContent = formatScore(score);
    elements.best.textContent = formatScore(bestScore);
    elements.length.textContent = formatLength(snake.length);
    elements.speed.textContent = formatSpeed();

    if (options.popScore) {
      elements.score.classList.remove('mod-snake-score-pulse');
      void elements.score.offsetWidth;
      elements.score.classList.add('mod-snake-score-pulse');
    }
  }

  function presentResult(reason, isNewRecord) {
    elements.resultTitle.innerHTML = reason === 'win' ? 'GRID <span>CLEAR</span>' : 'GAME <span>OVER</span>';
    elements.resultKicker.textContent =
      reason === 'win'
        ? 'GRID_COMPLETE // PERFECT_RUN'
        : isNewRecord
          ? 'NEW_PERSONAL_BEST // RUN_COMPLETE'
          : 'SIMULATION_ENDED // SIGNAL_LOST';
    elements.resultKicker.dataset.record = String(isNewRecord);
    elements.resultReason.textContent = getResultReason(reason);
    elements.resultScore.textContent = formatScore(score);
    elements.resultBest.textContent = formatScore(bestScore);
    elements.resultLength.textContent = formatLength(snake.length);
    elements.resultSpeed.textContent = formatSpeed();
  }

  function getResultReason(reason) {
    if (reason === 'self') return '信号中断：头部与自己的身体发生了碰撞。';
    if (reason === 'win') return '完美运行：霓虹蛇占满了整张网格，没有留下任何空格。';
    return '信号中断：霓虹蛇撞上了网格边界。';
  }

  function getGameOverAnnouncement(reason) {
    if (reason === 'win') return `完美通关。最终得分 ${score} 分，长度 ${snake.length}。`;
    const reasonText = reason === 'self' ? '咬到了自己' : '撞上了边界';
    return `游戏结束。${reasonText}，最终得分 ${score} 分。`;
  }

  function openResultDialog() {
    if (disposed || state !== 'over') return;

    if (typeof elements.dialog.showModal === 'function') {
      if (!elements.dialog.open) elements.dialog.showModal();
    } else {
      elements.dialog.setAttribute('open', '');
    }

    later(() => elements.resultRetry.focus({ preventScroll: true }), 30);
  }

  function closeResultDialog() {
    if (typeof elements.dialog.close === 'function' && elements.dialog.open) {
      elements.dialog.close();
      return;
    }

    if (elements.dialog.hasAttribute('open')) {
      elements.dialog.removeAttribute('open');
      handleResultClosed();
    }
  }

  function handleResultClosed() {
    if (disposed || state !== 'over') return;
    resetToIdle({ announce: true });
    later(() => {
      if (state === 'idle') elements.startButton.focus({ preventScroll: true });
    }, 30);
  }

  function clearResultState() {
    elements.resultKicker.dataset.record = 'false';
    elements.resultTitle.innerHTML = 'GAME <span>OVER</span>';
  }

  function announce(message) {
    window.clearTimeout(announcementTimer);
    elements.announcement.textContent = '';
    announcementTimer = window.setTimeout(() => {
      if (!disposed) elements.announcement.textContent = message;
    }, 40);
    timers.add(announcementTimer);
  }

  function getTickForFoods(count) {
    const level = Math.floor(count / FOODS_PER_LEVEL);
    return Math.max(MIN_TICK, INITIAL_TICK - level * TICK_STEP);
  }

  function spawnFood() {
    const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
    const freeCells = [];

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        if (!occupied.has(`${x},${y}`)) freeCells.push({ x, y });
      }
    }

    return freeCells.length
      ? freeCells[Math.floor(Math.random() * freeCells.length)]
      : null;
  }

  function formatScore(value) {
    return String(Math.max(0, value)).padStart(3, '0');
  }

  function formatLength(value) {
    return String(value).padStart(2, '0');
  }

  function formatSpeed() {
    return `×${(INITIAL_TICK / currentTick).toFixed(1)}`;
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    cancelAnimationFrame(animationId);
    animationId = 0;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();

    if (elements.dialog.open) {
      elements.dialog.close();
    }

    container.replaceChildren();
  }

  return cleanup;
}
