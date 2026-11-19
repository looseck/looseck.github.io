/* ==========================================================================
   Live2D companion
   Lazy-loaded, pointer-draggable, with inertia and viewport-edge bounce.
   No framework or build step; the vendor runtime is loaded only after idle.
   ========================================================================== */

(() => {
  'use strict';

  const VENDOR = [
    'vendor/live2d/pixi.min.js',
    'vendor/live2d/live2dcubismcore.min.js',
    'vendor/live2d/cubism4.min.js',
  ];

  const ACTIONS = [
    { id: 'RaiseHand', label: '举手', code: 'RAISE_HAND', duration: 1.133, kind: 'hand' },
    { id: 'LowerHand', label: '放下手', code: 'LOWER_HAND', duration: 1.017, kind: 'hand' },
    { id: 'ShowGrass', label: '掏出狗尾草', code: 'SHOW_GRASS', duration: 1.233, kind: 'hand' },
    { id: 'HideGrass', label: '收起狗尾草', code: 'HIDE_GRASS', duration: 1.133, kind: 'hand' },
    { id: 'PointFinger', label: '竖起手指', code: 'POINT_FINGER', duration: 1.25, kind: 'hand' },
    { id: 'RetractFinger', label: '收回手指', code: 'RETRACT_FINGER', duration: 1.25, kind: 'hand' },
    { id: 'Struggle', label: '挣脱', code: 'STRUGGLE', duration: 13.15, kind: 'hand' },
  ];

  const SPECIAL_ACTIONS = [
    { id: 'Shy', label: '害羞', code: 'SHY', duration: 2.7, kind: 'special' },
    { id: 'Heart', label: '爱心眼', code: 'HEART', duration: 2.5, kind: 'special' },
    { id: 'Angry', label: '生气', code: 'ANGRY', duration: 2.6, kind: 'special' },
  ];

  const ALL_ACTIONS = [...ACTIONS, ...SPECIAL_ACTIONS];

  // Click zones are percentages of the rendered model bounds, not the whole
  // transparent canvas. This keeps the hand/tail hit areas accurate at any size.
  const REGIONS = {
    head: {
      actions: ['Shy', 'Heart', 'Angry'],
      fallback: '再戳头就要生气了。'
    },
    leftHand: {
      actions: ['RaiseHand', 'LowerHand'],
      fallback: '别扯我袖子。'
    },
    rightHand: {
      actions: ['PointFinger', 'RetractFinger', 'ShowGrass', 'HideGrass'],
      fallback: '手上没有东西啦。'
    },
    lower: {
      actions: ['Struggle'],
      fallback: '别碰尾巴！'
    },
    body: {
      actions: [],
      fallback: '这里不可以乱碰。'
    }
  };

  const ACTION_LINES = {
    Shy: '别、别盯着看啦…',
    Heart: '看这里也没用哦。',
    Angry: '再戳头就要生气了。',
    RaiseHand: '手举起来啦。',
    LowerHand: '别扯我袖子。',
    ShowGrass: '狗尾草，拿去。',
    HideGrass: '这个不能给你。',
    PointFinger: '指向你了。',
    RetractFinger: '不指了。',
    Struggle: '别碰尾巴！'
  };

  const UTILITY = [
    { id: 'random', label: '随机动作', code: 'RANDOM' },
    { id: 'idle', label: '回到待机', code: 'IDLE' },
    { id: 'reset', label: '重置位置', code: 'RESET' },
    { id: 'hide', label: '隐藏角色', code: 'HIDE', danger: true },
  ];

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = window.matchMedia('(max-width: 720px)').matches;
  const root = document.documentElement;

  let widget;
  let stage;
  let canvas;
  let statusEl;
  let menuButton;
  let menu;
  let restore;
  let loadingEl;
  let app = null;
  let model = null;
  let ready = false;
  let failed = false;
  let initialised = false;
  let initScheduled = false;
  let manualHidden = false;
  let statusTimer = 0;
  let lastAction = '';
  let renderFrame = 0;
  let resizeFrame = 0;
  let inertiaFrame = 0;
  let menuCloseTimer = 0;
  let menuOpen = false;
  let drag = null;
  let clickTimer = 0;
  let bubble;
  let bubbleTimer = 0;
  let bubbleHideTimer = 0;
  let gazeFrame = 0;
  let gazeX = 0;
  let gazeY = 0;

  const pos = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    positioned: false,
    userMoved: false,
  };

  const PRIORITY = {
    idle: 1,
    force: 3,
  };

  // A single click still feels immediate, but a burst of clicks collapses into
  // one action after the pointer stops.
  const CLICK_DEBOUNCE = 260;

  function makeWidget() {
    widget = document.createElement('div');
    widget.className = 'live2d-widget';
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', 'Live2D 看板娘');
    widget.innerHTML = `
      <div class="live2d-widget__plate" aria-hidden="true"></div>
      <div class="live2d-widget__shadow" aria-hidden="true"></div>
      <div class="live2d-widget__hud">
        <span class="live2d-widget__signal" aria-hidden="true"></span>
        <span class="live2d-widget__label">LIVE2D // 大肥鱼</span>
        <span class="live2d-widget__status" aria-live="polite">LOADING</span>
        <button class="live2d-widget__menu-btn" type="button" aria-label="打开动作菜单" aria-haspopup="menu" aria-expanded="false" aria-controls="live2d-menu" disabled>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="currentColor">
            <circle cx="3" cy="8" r="1.3"></circle>
            <circle cx="8" cy="8" r="1.3"></circle>
            <circle cx="13" cy="8" r="1.3"></circle>
          </svg>
        </button>
      </div>
      <div class="live2d-widget__stage" role="button" tabindex="0" aria-label="点击模型不同位置触发动作，拖动移动角色，右键打开动作菜单">
        <canvas class="live2d-widget__canvas" aria-hidden="true"></canvas>
        <div class="live2d-widget__loading">LIVE2D // LOADING</div>
      </div>
      <p class="live2d-widget__hint">点模型互动 · 右键菜单 · 拖动移动</p>
    `;

    stage = widget.querySelector('.live2d-widget__stage');
    canvas = widget.querySelector('.live2d-widget__canvas');
    statusEl = widget.querySelector('.live2d-widget__status');
    menuButton = widget.querySelector('.live2d-widget__menu-btn');
    loadingEl = widget.querySelector('.live2d-widget__loading');

    bubble = document.createElement('div');
    bubble.className = 'live2d-bubble';
    bubble.hidden = true;
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');

    restore = document.createElement('button');
    restore.className = 'live2d-restore';
    restore.type = 'button';
    restore.hidden = true;
    restore.setAttribute('aria-label', '显示 Live2D 看板娘');
    restore.textContent = 'L2D';

    document.body.append(widget, restore, bubble);
    widget.classList.add('is-mounted');
    layoutWidget(true);
  }

  function makeMenu() {
    menu = document.createElement('div');
    menu.className = 'live2d-menu';
    menu.id = 'live2d-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Live2D 动作菜单');
    menu.innerHTML = `
      <div class="live2d-menu__head">
        <p class="live2d-menu__title">ACTION_MENU</p>
        <p class="live2d-menu__eyebrow">大肥鱼 // 10 ACTIONS</p>
      </div>
      <div class="live2d-menu__group">
        <p class="live2d-menu__group-label">动作 / MOTION</p>
        ${ACTIONS.map((action) => `
          <button class="live2d-menu__item" type="button" role="menuitem" data-action="${action.id}">
            <span>${action.label}</span>
            <span class="live2d-menu__code">${action.code}</span>
          </button>
        `).join('')}
      </div>
      <div class="live2d-menu__group">
        <p class="live2d-menu__group-label">特殊 / SPECIAL</p>
        ${SPECIAL_ACTIONS.map((action) => `
          <button class="live2d-menu__item live2d-menu__item--special" type="button" role="menuitem" data-action="${action.id}">
            <span>${action.label}</span>
            <span class="live2d-menu__code">${action.code}</span>
          </button>
        `).join('')}
      </div>
      <div class="live2d-menu__divider" aria-hidden="true"></div>
      <div class="live2d-menu__group">
        <p class="live2d-menu__group-label">控制 / SYSTEM</p>
        ${UTILITY.map((item) => `
          <button class="live2d-menu__item${item.danger ? ' live2d-menu__item--danger' : ' live2d-menu__item--utility'}" type="button" role="menuitem" data-menu="${item.id}">
            <span>${item.label}</span>
            <span class="live2d-menu__code">${item.code}</span>
          </button>
        `).join('')}
      </div>
    `;
    document.body.append(menu);
  }

  function viewport() {
    return {
      w: root.clientWidth || window.innerWidth,
      h: window.innerHeight,
    };
  }

  function bounds() {
    const view = viewport();
    const margin = view.w <= 720 ? 8 : 16;
    return {
      minX: margin,
      minY: margin,
      maxX: Math.max(margin, view.w - pos.w - margin),
      maxY: Math.max(margin, view.h - pos.h - margin),
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function layoutWidget(reset) {
    if (!widget || !widget.offsetWidth) return;
    pos.w = widget.offsetWidth;
    pos.h = widget.offsetHeight;
    const view = viewport();
    const box = bounds();
    if (reset || !pos.positioned || !pos.userMoved) {
      pos.x = box.maxX;
      pos.y = box.maxY;
    } else {
      pos.x = clamp(pos.x, box.minX, box.maxX);
      pos.y = clamp(pos.y, box.minY, box.maxY);
    }
    pos.positioned = true;
    renderPosition();
  }

  function renderPosition() {
    if (!widget) return;
    widget.style.transform = `translate3d(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px, 0)`;
  }

  function scheduleRender() {
    if (renderFrame) return;
    renderFrame = window.requestAnimationFrame(() => {
      renderFrame = 0;
      renderPosition();
    });
  }

  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone || '';
  }

  function positionBubble() {
    if (!bubble || bubble.hidden) return;
    const rect = widget.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;
    const margin = 8;
    let left = rect.left + Math.min(24, rect.width * 0.08);
    let top = rect.top - height - 14;

    if (top < margin) {
      top = Math.min(rect.top + 52, viewport().h - height - margin);
    }

    left = clamp(left, margin, viewport().w - width - margin);
    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;
  }

  function hideBubble(immediate) {
    if (!bubble) return;
    window.clearTimeout(bubbleTimer);
    window.clearTimeout(bubbleHideTimer);
    bubble.classList.remove('is-visible');
    if (immediate) {
      bubble.hidden = true;
    } else {
      bubbleHideTimer = window.setTimeout(() => {
        if (!bubble.classList.contains('is-visible')) bubble.hidden = true;
      }, 220);
    }
  }

  function showBubble(text) {
    if (!bubble || !text) return;
    window.clearTimeout(bubbleTimer);
    window.clearTimeout(bubbleHideTimer);
    bubble.textContent = text;
    bubble.hidden = false;
    bubble.classList.remove('is-visible');
    positionBubble();

    // Restart the Q-spring animation for repeated lines.
    void bubble.offsetWidth;
    bubble.classList.add('is-visible');
    bubbleTimer = window.setTimeout(() => hideBubble(false), 3000);
  }

  function classifyRegion(clientX, clientY) {
    if (!model) return 'body';
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return 'body';

    let bounds;
    try {
      bounds = model.getBounds();
    } catch (error) {
      bounds = null;
    }

    let nx;
    let ny;
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      nx = (clientX - rect.left - bounds.x) / bounds.width;
      ny = (clientY - rect.top - bounds.y) / bounds.height;
    } else {
      nx = (clientX - rect.left) / rect.width;
      ny = (clientY - rect.top) / rect.height;
    }

    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return 'body';
    if (ny < 0.33 && nx > 0.16 && nx < 0.84) return 'head';
    if (ny >= 0.68) return 'lower';
    if (ny >= 0.27 && nx < 0.43) return 'leftHand';
    if (ny >= 0.27 && nx > 0.57) return 'rightHand';
    return 'body';
  }

  function handleRegionClick(clientX, clientY) {
    const regionKey = classifyRegion(clientX, clientY);
    const region = REGIONS[regionKey] || REGIONS.body;
    if (!region.actions.length) {
      setStatus('互动', 'idle');
      showBubble(region.fallback);
      return;
    }

    let index = Math.floor(Math.random() * region.actions.length);
    if (region.actions.length > 1 && region.actions[index] === lastAction) {
      index = (index + 1) % region.actions.length;
    }
    const action = ALL_ACTIONS.find((item) => item.id === region.actions[index]);
    if (action) playAction(action);
  }

  function queueRegionClick(clientX, clientY) {
    cancelQueuedClick();
    clickTimer = window.setTimeout(() => {
      clickTimer = 0;
      handleRegionClick(clientX, clientY);
    }, CLICK_DEBOUNCE);
  }

  function updateGaze(clientX, clientY) {
    if (!ready || !model || !model.focus) return;
    const rect = widget.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.36;
    gazeX = clamp((clientX - centerX) / (viewport().w * 0.55), -1, 1);
    gazeY = clamp((clientY - centerY) / (viewport().h * 0.55), -1, 1);

    if (gazeFrame) return;
    gazeFrame = window.requestAnimationFrame(() => {
      gazeFrame = 0;
      if (!ready || !model || !model.focus) return;
      // Cubism's focus coordinates use +Y upward.
      model.focus(gazeX, -gazeY);
    });
  }

  function resetGaze() {
    gazeX = 0;
    gazeY = 0;
    if (gazeFrame) {
      window.cancelAnimationFrame(gazeFrame);
      gazeFrame = 0;
    }
    if (ready && model && model.focus) {
      model.focus(0, 0);
    }
  }

  function fitModel() {
    if (!model || !app) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;

    app.renderer.resize(w, h);
    const naturalWidth = model.internalModel.width || model.width;
    const naturalHeight = model.internalModel.height || model.height;
    const scale = Math.min(w / naturalWidth, h / naturalHeight) * 0.985;

    model.anchor.set(0.5, 0.5);
    model.scale.set(scale);
    model.x = w / 2;
    model.y = h / 2;
  }

  function scheduleFit() {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      fitModel();
    });
  }

  function applyModelState(paused) {
    if (!model) return;
    if ('autoUpdate' in model) {
      model.autoUpdate = !paused;
    }
  }

  function pause() {
    if (app && !app.ticker.started) return;
    if (app) app.stop();
    applyModelState(true);
  }

  function resume() {
    if (!ready || failed || !app || document.hidden) return;
    if (widget && (widget.classList.contains('is-hidden') || widget.classList.contains('is-route-hidden'))) return;
    applyModelState(false);
    if (!app.ticker.started) app.start();
  }

  function routeShouldHide() {
    return window.location.hash.startsWith('#game/');
  }

  function syncRoute() {
    if (!widget) return;
    const hide = routeShouldHide();

    if (hide) {
      closeMenu(false);
      stopInertia();
      cancelQueuedClick();
      hideBubble(true);
      resetGaze();
      widget.classList.add('is-route-hidden');
      restore.hidden = true;
      pause();
      return;
    }

    widget.classList.remove('is-route-hidden');
    if (manualHidden) {
      restore.hidden = false;
      return;
    }

    restore.hidden = true;
    layoutWidget(false);
    resume();
    scheduleFit();

    if (!initialised && !initScheduled && document.readyState === 'complete') {
      scheduleInit();
    }
  }

  function playAction(action) {
    if (!ready || !model || !action) return;

    cancelQueuedClick();
    window.clearTimeout(statusTimer);
    const tier = (window.PIXI && PIXI.live2d && PIXI.live2d.MotionPriority)
      ? PIXI.live2d.MotionPriority.FORCE
      : PRIORITY.force;

    let played = false;
    try {
      played = model.motion(action.id, 0, tier) !== false;
    } catch (error) {
      played = false;
    }

    if (!played) {
      setStatus('不可用', 'error');
      return;
    }

    lastAction = action.id;
    setStatus(action.label, 'action');
    showBubble(ACTION_LINES[action.id] || '……');
    statusTimer = window.setTimeout(() => {
      setStatus('IDLE', 'idle');
    }, Math.max(900, action.duration * 1000 + 360));
  }

  function playIdle() {
    if (!ready || !model) return;
    cancelQueuedClick();
    window.clearTimeout(statusTimer);
    hideBubble(false);
    const tier = (window.PIXI && PIXI.live2d && PIXI.live2d.MotionPriority)
      ? PIXI.live2d.MotionPriority.FORCE
      : PRIORITY.force;
    try {
      model.motion('Idle', 0, tier);
    } catch (error) {
      // Keep the current pose if the idle group is unavailable.
    }
    setStatus('IDLE', 'idle');
  }

  function playRandom() {
    if (!ready || !ALL_ACTIONS.length) return;
    let index = Math.floor(Math.random() * ALL_ACTIONS.length);
    if (ALL_ACTIONS.length > 1 && ALL_ACTIONS[index].id === lastAction) {
      index = (index + 1) % ALL_ACTIONS.length;
    }
    playAction(ALL_ACTIONS[index]);
  }

  function cancelQueuedClick() {
    if (!clickTimer) return;
    window.clearTimeout(clickTimer);
    clickTimer = 0;
  }

  function resetPosition() {
    pos.userMoved = false;
    layoutWidget(true);
  }

  function openMenu(x, y, anchor) {
    if (!menu || !ready) return;
    cancelQueuedClick();
    hideBubble(false);
    window.clearTimeout(menuCloseTimer);
    menu.hidden = false;
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.disabled = false;
    menuOpen = true;

    let left = x;
    let top = y;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      left = rect.left;
      top = rect.bottom + 7;
    }

    const margin = 8;
    menu.style.left = '0px';
    menu.style.top = '0px';
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;

    if (!anchor && top + menuHeight + margin > viewport().h) {
      const above = y - menuHeight - margin;
      if (above >= margin) top = above;
    }

    left = clamp(left, margin, viewport().w - menuWidth - margin);
    top = clamp(top, margin, viewport().h - menuHeight - margin);

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.classList.add('is-open');

    const first = menu.querySelector('[role="menuitem"]:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }

  function closeMenu(focusStage) {
    if (!menu || !menuOpen) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    window.clearTimeout(menuCloseTimer);
    menuCloseTimer = window.setTimeout(() => {
      if (!menuOpen) menu.hidden = true;
    }, 160);
    if (focusStage) stage.focus({ preventScroll: true });
  }

  function hideWidget() {
    if (!ready) return;
    closeMenu(false);
    stopInertia();
    cancelQueuedClick();
    hideBubble(true);
    manualHidden = true;
    widget.classList.add('is-hidden');
    restore.hidden = false;
    pause();
    restore.focus({ preventScroll: true });
  }

  function showWidget() {
    if (!widget || routeShouldHide()) return;
    manualHidden = false;
    restore.hidden = true;
    widget.classList.remove('is-hidden');
    layoutWidget(false);
    resume();
    stage.focus({ preventScroll: true });
  }

  function beginDrag(event) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.target.closest('button')) return;
    if (menuOpen) closeMenu(false);
    cancelQueuedClick();
    hideBubble(false);
    stopInertia();

    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: pos.x,
      baseY: pos.y,
      lastX: pos.x,
      lastY: pos.y,
      lastTime: performance.now(),
      velocityX: 0,
      velocityY: 0,
      moved: false,
    };

    stage.classList.add('is-dragging');
    stage.focus({ preventScroll: true });
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved && Math.hypot(dx, dy) > 4) {
      drag.moved = true;
      widget.classList.add('is-moving');
    }

    if (!drag.moved) return;

    const box = bounds();
    const nextX = clamp(drag.baseX + dx, box.minX, box.maxX);
    const nextY = clamp(drag.baseY + dy, box.minY, box.maxY);
    const now = performance.now();
    const elapsed = Math.max(now - drag.lastTime, 1);
    const instantX = (nextX - drag.lastX) / elapsed * 1000;
    const instantY = (nextY - drag.lastY) / elapsed * 1000;

    drag.velocityX = drag.velocityX * 0.68 + instantX * 0.32;
    drag.velocityY = drag.velocityY * 0.68 + instantY * 0.32;
    drag.lastX = nextX;
    drag.lastY = nextY;
    drag.lastTime = now;
    drag.moved = true;
    pos.x = nextX;
    pos.y = nextY;
    pos.userMoved = true;
    scheduleRender();
    event.preventDefault();
  }

  function endDrag(event, cancelled) {
    if (!drag || event.pointerId !== drag.id) return;
    const wasMoved = drag.moved;
    const velocityX = drag.velocityX;
    const velocityY = drag.velocityY;
    drag = null;
    stage.classList.remove('is-dragging');
    widget.classList.remove('is-moving');

    try {
      stage.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture may already have been released by the browser.
    }

    if (cancelled) return;
    if (wasMoved) {
      startInertia(velocityX, velocityY);
    } else {
      queueRegionClick(event.clientX, event.clientY);
    }
  }

  function startInertia(velocityX, velocityY) {
    stopInertia();
    if (reducedMotion) return;

    let vx = clamp(velocityX, -2200, 2200);
    let vy = clamp(velocityY, -2200, 2200);
    if (Math.hypot(vx, vy) < 24) return;

    widget.classList.add('is-moving');
    let last = performance.now();

    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      const box = bounds();
      let nextX = pos.x + vx * dt;
      let nextY = pos.y + vy * dt;

      if (nextX < box.minX) {
        nextX = box.minX;
        vx = Math.abs(vx) * 0.56;
      } else if (nextX > box.maxX) {
        nextX = box.maxX;
        vx = -Math.abs(vx) * 0.56;
      }

      if (nextY < box.minY) {
        nextY = box.minY;
        vy = Math.abs(vy) * 0.56;
      } else if (nextY > box.maxY) {
        nextY = box.maxY;
        vy = -Math.abs(vy) * 0.56;
      }

      pos.x = nextX;
      pos.y = nextY;
      pos.userMoved = true;
      renderPosition();

      const friction = Math.exp(-2.65 * dt);
      vx *= friction;
      vy *= friction;

      if (Math.hypot(vx, vy) > 18) {
        inertiaFrame = window.requestAnimationFrame(step);
      } else {
        inertiaFrame = 0;
        widget.classList.remove('is-moving');
      }
    };

    inertiaFrame = window.requestAnimationFrame(step);
  }

  function stopInertia() {
    if (inertiaFrame) {
      window.cancelAnimationFrame(inertiaFrame);
      inertiaFrame = 0;
    }
    if (widget) widget.classList.remove('is-moving');
  }

  function onMenuClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const action = ALL_ACTIONS.find((item) => item.id === actionButton.dataset.action);
      closeMenu(true);
      playAction(action);
      return;
    }

    const utilityButton = event.target.closest('[data-menu]');
    if (!utilityButton) return;
    const action = utilityButton.dataset.menu;
    closeMenu(false);

    if (action === 'random') playRandom();
    if (action === 'idle') playIdle();
    if (action === 'reset') {
      resetPosition();
      setStatus('RESET', 'idle');
      stage.focus({ preventScroll: true });
    }
    if (action === 'hide') hideWidget();
  }

  function onMenuKeydown(event) {
    if (menu.hidden) return;
    const items = [...menu.querySelectorAll('[role="menuitem"]:not([disabled])')];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === 'Tab') {
      closeMenu(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      let next = index;
      if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
      if (event.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = items.length - 1;
      items[next].focus({ preventScroll: true });
    }
  }

  function onStageKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      playRandom();
      return;
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      openMenu(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }

  function bindInteractions() {
    stage.addEventListener('pointerdown', beginDrag);
    stage.addEventListener('pointermove', moveDrag);
    stage.addEventListener('pointerup', (event) => endDrag(event, false));
    stage.addEventListener('pointercancel', (event) => endDrag(event, true));
    stage.addEventListener('keydown', onStageKeydown);
    stage.addEventListener('dragstart', (event) => event.preventDefault());

    widget.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (!ready) return;
      openMenu(event.clientX, event.clientY);
    });

    menuButton.addEventListener('click', () => {
      if (menuOpen) {
        closeMenu(true);
      } else {
        openMenu(0, 0, menuButton);
      }
    });

    menu.addEventListener('click', onMenuClick);
    menu.addEventListener('keydown', onMenuKeydown);
    restore.addEventListener('click', showWidget);

    document.addEventListener('pointerdown', (event) => {
      if (stage) stage.classList.remove('is-keyboard');
      if (!menuOpen) return;
      if (menu.contains(event.target) || menuButton.contains(event.target)) return;
      closeMenu(false);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (stage) stage.classList.add('is-keyboard');
      if (event.key === 'Escape' && menuOpen) closeMenu(true);
    }, true);

    window.addEventListener('resize', () => {
      closeMenu(false);
      layoutWidget(false);
      scheduleFit();
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (menuOpen) closeMenu(false);
    }, { passive: true });

    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') updateGaze(event.clientX, event.clientY);
    }, { passive: true });

    window.addEventListener('blur', resetGaze);

    window.addEventListener('hashchange', syncRoute);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        pause();
      } else {
        resume();
      }
    });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => {
        layoutWidget(false);
        scheduleFit();
      });
      observer.observe(widget);
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.append(script);
    });
  }

  async function loadRuntime() {
    if (window.PIXI && window.PIXI.live2d) return;
    for (const src of VENDOR) {
      // The plugin needs a real global PIXI, and Cubism Core must exist first.
      await loadScript(src);
    }
  }

  function fail(error) {
    failed = true;
    ready = false;
    pause();
    if (widget) {
      widget.classList.add('is-failed');
      if (statusEl) setStatus('OFFLINE', 'error');
      if (loadingEl) loadingEl.textContent = 'LIVE2D // UNAVAILABLE';
      if (menuButton) menuButton.disabled = true;
    }
    if (window.console && console.warn) {
      console.warn('[Live2D] companion disabled:', error && error.message ? error.message : error);
    }
  }

  async function createModel() {
    await loadRuntime();

    if (!window.PIXI || !PIXI.live2d) {
      throw new Error('Live2D runtime unavailable');
    }

    if (PIXI.live2d.config) {
      PIXI.live2d.config.motionFadingDuration = 360;
      PIXI.live2d.config.idleMotionFadingDuration = 700;
      PIXI.live2d.config.expressionFadingDuration = 420;
    }

    const stageWidth = Math.max(stage.clientWidth, 1);
    const stageHeight = Math.max(stage.clientHeight, 1);
    const resolution = compact
      ? Math.min(window.devicePixelRatio || 1, 2)
      : Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2);

    app = new PIXI.Application({
      view: canvas,
      width: stageWidth,
      height: stageHeight,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution,
      powerPreference: 'high-performance',
    });
    app.stop();
    app.ticker.maxFPS = compact || reducedMotion ? 30 : 60;

    const modelUrls = compact
      ? ['assets/live2d/model-1k.json']
      : ['assets/live2d/model-hd.json', 'assets/live2d/model-2k.json'];
    let lastModelError = null;

    for (const modelUrl of modelUrls) {
      try {
        model = await PIXI.live2d.Live2DModel.from(modelUrl, { autoInteract: false });
        if (model) break;
      } catch (error) {
        lastModelError = error;
      }
    }

    if (!model) throw lastModelError || new Error('Live2D model did not load');

    app.stage.addChild(model);
    fitModel();

    try {
      model.motion('Idle', 0, PRIORITY.idle);
    } catch (error) {
      // Idle is optional; the model can still be moved and actioned.
    }

    if (model.focus) model.focus(0, 0);

    ready = true;
    widget.classList.add('is-ready');
    widget.dataset.ready = 'true';
    if (statusEl) setStatus('IDLE', 'idle');
    if (menuButton) menuButton.disabled = false;

    if (!document.hidden && !routeShouldHide()) {
      applyModelState(false);
      app.start();
    }
  }

  function scheduleInit() {
    if (initialised || initScheduled || routeShouldHide()) return;
    initScheduled = true;

    const start = () => {
      initScheduled = false;
      if (initialised || routeShouldHide()) return;
      if (document.hidden) {
        document.addEventListener('visibilitychange', start, { once: true });
        return;
      }
      initialised = true;
      createModel().catch(fail);
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(start, { timeout: 1800 });
    } else {
      window.setTimeout(start, 900);
    }
  }

  function init() {
    if (!document.body) return;
    makeWidget();
    makeMenu();
    bindInteractions();
    syncRoute();

    if (document.readyState === 'complete') {
      if (!routeShouldHide()) scheduleInit();
    } else {
      window.addEventListener('load', () => {
        if (!routeShouldHide()) scheduleInit();
      }, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
