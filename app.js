import { GAMES, TOOLS } from './data.js';
import { escapeHTML } from './shared/dom.js';

/* --------------------------------------------------------------------------
   Module registry
   Modules are loaded only when their detail route is opened.
   To add a module: append metadata to data.js, append one line below, create
   the module JS/CSS pair, and add its stylesheet link in index.html.
   -------------------------------------------------------------------------- */

const GAME_MODULES = Object.freeze({
  snake: () => import('./modules/games/snake.js'),
  'number-merge': () => import('./modules/games/number-merge.js')
});

const TOOL_MODULES = Object.freeze({
  electricity: () => import('./modules/tools/electricity.js')
});

const BASE_TITLE = '数字基地';
const VIEW_NAMES = {
  portals: '首页',
  arcade: '游戏大厅',
  game: '游戏详情',
  tools: '工具箱',
  tool: '工具详情',
  about: '关于我'
};

const sections = new Map(
  Array.from(document.querySelectorAll('main section[data-view]')).map((section) => [
    section.dataset.view,
    section
  ])
);

const gameList = document.getElementById('game-list');
const toolList = document.getElementById('tool-list');
const gameViewRoot = document.getElementById('game-view-root');
const toolViewRoot = document.getElementById('tool-view-root');
const navLinks = Array.from(document.querySelectorAll('.site-nav [data-nav]'));
const skipLink = document.querySelector('[data-skip-link]');

const zhCollator = new Intl.Collator('zh-CN', {
  sensitivity: 'base',
  numeric: true
});

let cleanupCurrent = null;
let routeVersion = 0;

/* --------------------------------------------------------------------------
   Sorting
   -------------------------------------------------------------------------- */

export function sortItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item && item.status !== 'hidden')
    .slice()
    .sort((first, second) => {
      // A WIP module must always stay at the bottom, even when marked featured.
      const firstWip = first.status === 'wip' ? 1 : 0;
      const secondWip = second.status === 'wip' ? 1 : 0;
      if (firstWip !== secondWip) return firstWip - secondWip;

      const firstFeatured = first.featured === true ? 0 : 1;
      const secondFeatured = second.featured === true ? 0 : 1;
      if (firstFeatured !== secondFeatured) return firstFeatured - secondFeatured;

      const firstOrder = Number.isFinite(first.order) ? first.order : 999;
      const secondOrder = Number.isFinite(second.order) ? second.order : 999;
      if (firstOrder !== secondOrder) return firstOrder - secondOrder;

      return zhCollator.compare(String(first.title || ''), String(second.title || ''));
    });
}

/* --------------------------------------------------------------------------
   Card list rendering
   -------------------------------------------------------------------------- */

export function renderCardList(root, items, kind) {
  if (!(root instanceof HTMLElement)) return;

  const visibleItems = sortItems(items);
  const emptyState = getOrCreateEmptyState(root);

  if (!visibleItems.length) {
    root.innerHTML = '';
    root.hidden = true;
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  root.hidden = false;

  const codePrefix = kind === 'game' ? 'GAME' : 'TOOL';
  const cards = visibleItems.map((item, index) => renderCardMarkup(item, kind, index, codePrefix));
  root.innerHTML = cards.join('');
}

function renderCardMarkup(item, kind, index, codePrefix) {
  const isAvailable = item.status === 'available';
  const statusText = getStatusText(kind, item.status);
  const title = escapeHTML(item.title);
  const summary = escapeHTML(item.summary);
  const id = escapeHTML(item.id);
  const accent = sanitizeAccent(item.accent);
  const route = kind === 'game' ? 'game' : 'tool';
  const indexLabel = `${codePrefix}_${String(index + 1).padStart(2, '0')}`;
  const anchorLabel = escapeHTML(`${item.title}，${statusText}`);
  const tags = (Array.isArray(item.tags) ? item.tags : [])
    .slice(0, 4)
    .map((tag) => `<li class="module-card__tag">${escapeHTML(tag)}</li>`)
    .join('');

  const coverMarkup = item.cover
    ? `<img class="module-card__img" src="${escapeHTML(item.cover)}" alt="" width="400" height="225" loading="lazy" decoding="async">`
    : '';

  const mediaMarkup = `
    <div class="module-card__media" aria-hidden="true">
      <span class="module-card__fallback"></span>
      ${coverMarkup}
      <span class="module-card__media-grid"></span>
      <span class="module-card__index">${indexLabel}</span>
    </div>
  `;

  const bodyMarkup = `
    <div class="module-card__body">
      <h3 class="module-card__title">${title}</h3>
      <p class="module-card__summary">${summary}</p>
      <ul class="module-card__tags" aria-label="技术标签">${tags}</ul>
    </div>
    <div class="module-card__status">
      <span class="module-card__status-text">${statusText}</span>
      ${isAvailable ? '<span class="module-card__arrow" aria-hidden="true">→</span>' : ''}
    </div>
  `;

  const content = mediaMarkup + bodyMarkup;
  const cardClasses = `module-card${isAvailable ? '' : ' module-card--wip'}`;
  const style = `--accent: ${accent}; --i: ${index};`;

  if (isAvailable) {
    return `
      <li class="${cardClasses}" style="${style}">
        <a class="module-card__link" href="#${route}/${id}" aria-label="${anchorLabel}">
          ${content}
        </a>
      </li>
    `;
  }

  return `
    <li class="${cardClasses}" style="${style}">
      <div class="module-card__link" aria-disabled="true">
        ${content}
      </div>
    </li>
  `;
}

function getOrCreateEmptyState(root) {
  let emptyState = root.nextElementSibling;
  if (emptyState && emptyState.matches(`[data-empty-for="${root.id}"]`)) {
    return emptyState;
  }

  emptyState = document.createElement('p');
  emptyState.className = 'module-empty';
  emptyState.dataset.emptyFor = root.id;
  emptyState.textContent = '暂无接入模块';
  root.insertAdjacentElement('afterend', emptyState);
  return emptyState;
}

function getStatusText(kind, status) {
  if (status === 'wip') return '开发中';
  if (status === 'available') return kind === 'game' ? '可玩' : '可用';
  return '开发中';
}

function sanitizeAccent(value) {
  const candidate = String(value || '').trim();
  if (
    /^#[0-9a-f]{3,8}$/i.test(candidate) ||
    /^rgba?\(\s*[\d.\s,%]+\)$/i.test(candidate) ||
    /^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(candidate)
  ) {
    return escapeHTML(candidate);
  }
  return '#00e5ff';
}

/* --------------------------------------------------------------------------
   Detail views & dynamic module mounting
   -------------------------------------------------------------------------- */

export function renderModule(kind, id) {
  const isGame = kind === 'game';
  const collection = isGame ? GAMES : TOOLS;
  const registry = isGame ? GAME_MODULES : TOOL_MODULES;
  const root = isGame ? gameViewRoot : toolViewRoot;
  const listRoute = isGame ? '#arcade' : '#tools';
  const listLabel = isGame ? '游戏大厅' : '工具箱';
  const currentVersion = routeVersion;
  const item = collection.find((entry) => entry.id === id);

  if (!root) return;
  root.replaceChildren();

  if (!item) {
    root.innerHTML = renderDetailShell({
      listRoute,
      listLabel,
      kicker: isGame ? 'ARCADE // UNKNOWN_MODULE' : 'UTIL // UNKNOWN_MODULE',
      title: '模块不存在',
      summary: '这个坐标没有对应的模块。它可能已经被移除，或者链接拼写有误。',
      status: 'missing',
      tags: [],
      body: '<p class="module-load-state">请返回列表检查可用模块。</p>'
    });
    return;
  }

  const loadState = item.status === 'wip'
    ? `<div class="module-load-state" role="status"><strong>正在接入中</strong><span>该模块仍在组装，完成后会出现在这里。</span></div>`
    : '<p class="module-load-state" role="status">正在加载模块…</p>';

  root.innerHTML = renderDetailShell({
    listRoute,
    listLabel,
    kicker: isGame ? 'ARCADE // GAME_MODULE' : 'UTIL // TOOL_MODULE',
    title: item.title,
    summary: item.summary,
    status: item.status,
    tags: item.tags,
    body: loadState
  });

  if (item.status === 'wip') return;

  const loader = registry[id];
  if (typeof loader !== 'function') {
    setDetailError(root, listRoute, listLabel, '模块未注册', '列表数据与模块注册表不一致，暂时无法进入。');
    return;
  }

  Promise.resolve()
    .then(() => loader())
    .then((module) => {
      if (currentVersion !== routeVersion) return;

      if (
        !module ||
        module.id !== item.id ||
        module.title !== item.title ||
        module.status !== item.status ||
        typeof module.mount !== 'function'
      ) {
        throw new Error('Module metadata does not match data.js or the registry.');
      }

      const mountElement = root.querySelector('[data-module-mount]');
      if (!mountElement) return;

      const cleanup = module.mount(mountElement);
      if (typeof cleanup !== 'function') {
        throw new Error('mount(container) must return a cleanup function.');
      }

      if (currentVersion !== routeVersion) {
        cleanup();
        return;
      }

      cleanupCurrent = cleanup;
    })
    .catch((error) => {
      if (currentVersion !== routeVersion) return;
      console.error(`[MY GEEK BASE] Failed to mount ${kind}/${id}:`, error);
      setDetailError(root, listRoute, listLabel, '模块加载失败', '模块没有正确完成挂载，请返回后重试。');
    });
}

function renderDetailShell({ listRoute, listLabel, kicker, title, summary, status, tags, body }) {
  const kind = listRoute === '#arcade' ? 'game' : 'tool';
  const statusText = getDetailStatusText(kind, status);
  const isReady = status === 'available';
  const tagsMarkup = (tags || [])
    .map((tag) => `<li class="detail-tag">${escapeHTML(tag)}</li>`)
    .join('');

  return `
    <div class="container detail-shell">
      <a class="view-back" href="${listRoute}">← 返回${listLabel}</a>
      <header class="detail-header">
        <p class="eyebrow">${escapeHTML(kicker)}</p>
        <h2 class="view-title detail-title" id="${listRoute === '#arcade' ? 'game' : 'tool'}-detail-title" tabindex="-1">${escapeHTML(title)}</h2>
        <p class="view-subtitle detail-summary">${escapeHTML(summary)}</p>
        <div class="detail-meta">
          <span class="detail-status detail-status--${isReady ? 'ready' : 'muted'}">${escapeHTML(statusText)}</span>
          <ul class="detail-tags" aria-label="技术标签">${tagsMarkup}</ul>
        </div>
      </header>
      <div class="detail-mount" data-module-mount>${body}</div>
    </div>
  `;
}

function getDetailStatusText(kind, status) {
  if (status === 'available') return kind === 'game' ? '可玩' : '可用';
  if (status === 'wip') return '开发中';
  if (status === 'error') return '加载失败';
  return '不可用';
}

function setDetailError(root, listRoute, listLabel, title, message) {
  if (!root) return;
  root.innerHTML = renderDetailShell({
    listRoute,
    listLabel,
    kicker: 'SYSTEM // MODULE_ERROR',
    title,
    summary: message,
    status: 'error',
    tags: [],
    body: `<p class="module-load-state module-load-state--error" role="alert">${escapeHTML(message)}</p>`
  });
}

function cleanupModule() {
  if (typeof cleanupCurrent === 'function') {
    try {
      cleanupCurrent();
    } catch (error) {
      console.error('[MY GEEK BASE] Module cleanup failed:', error);
    }
  }
  cleanupCurrent = null;
}

/* --------------------------------------------------------------------------
   Routing
   -------------------------------------------------------------------------- */

export function parseHash(hashValue = window.location.hash) {
  const rawHash = String(hashValue || '').replace(/^#/, '');

  if (!rawHash || rawHash === 'portals') {
    return { view: 'portals', id: null, invalid: false };
  }
  if (rawHash === 'arcade') {
    return { view: 'arcade', id: null, invalid: false };
  }
  if (rawHash === 'tools') {
    return { view: 'tools', id: null, invalid: false };
  }
  if (rawHash === 'about') {
    return { view: 'about', id: null, invalid: false };
  }

  const gameMatch = rawHash.match(/^game\/([a-z][a-z-]*)$/);
  if (gameMatch) {
    return { view: 'game', id: gameMatch[1], invalid: false };
  }

  const toolMatch = rawHash.match(/^tool\/([a-z][a-z-]*)$/);
  if (toolMatch) {
    return { view: 'tool', id: toolMatch[1], invalid: false };
  }

  return { view: 'portals', id: null, invalid: true };
}

export function setDocumentTitle(view, slug) {
  let title = BASE_TITLE;

  if (view === 'arcade') title = '游戏大厅 · 数字基地';
  if (view === 'tools') title = '工具箱 · 数字基地';
  if (view === 'about') title = '关于我 · 数字基地';

  if (view === 'game') {
    const item = GAMES.find((entry) => entry.id === slug);
    title = item ? `${item.title} · 数字基地` : '模块不存在 · 数字基地';
  }

  if (view === 'tool') {
    const item = TOOLS.find((entry) => entry.id === slug);
    title = item ? `${item.title} · 数字基地` : '模块不存在 · 数字基地';
  }

  document.title = title;
}

export function route() {
  const currentVersion = ++routeVersion;

  // Always clean the previous module before switching DOM or views.
  cleanupModule();
  if (gameViewRoot) gameViewRoot.replaceChildren();
  if (toolViewRoot) toolViewRoot.replaceChildren();

  const parsed = parseHash();

  if (parsed.invalid) {
    // Normalize invalid hashes through the hash itself, not a hand-rolled
    // History API router. The subsequent hashchange is idempotent.
    if (window.location.hash !== '#portals') {
      window.location.replace('#portals');
    }
  }

  const activeView = parsed.view;
  sections.forEach((section, name) => {
    section.hidden = name !== activeView;
  });

  if (activeView === 'arcade') {
    renderCardList(gameList, GAMES, 'game');
  }
  if (activeView === 'tools') {
    renderCardList(toolList, TOOLS, 'tool');
  }
  if (activeView === 'game' || activeView === 'tool') {
    renderModule(activeView, parsed.id);
  }

  updateNav(activeView);

  if (currentVersion !== routeVersion) return;

  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  root.style.scrollBehavior = previousScrollBehavior;

  setDocumentTitle(activeView, parsed.id);

  const activeSection = sections.get(activeView);
  const heading = activeSection?.querySelector('h2[tabindex="-1"]');
  if (heading) {
    heading.focus({ preventScroll: true });
  }

  document.body.dataset.view = activeView;
}

function updateNav(view) {
  const group = view === 'game' ? 'arcade' : view === 'tool' ? 'tools' : view;
  navLinks.forEach((link) => {
    if (link.dataset.nav === group) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function handleCardImageError(event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.classList.contains('module-card__img')) {
    return;
  }
  image.hidden = true;
}

function initSkipLink() {
  if (!skipLink) return;
  skipLink.addEventListener('click', (event) => {
    event.preventDefault();
    const activeSection = sections.get(document.body.dataset.view || 'portals');
    const heading = activeSection?.querySelector('h2[tabindex="-1"]');
    if (heading) {
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start' });
    } else {
      document.getElementById('main')?.focus({ preventScroll: true });
    }
  });
}

function init() {
  if (sections.size !== 6) {
    console.error('[MY GEEK BASE] Expected 6 data-view sections.');
  }

  gameList?.addEventListener('error', handleCardImageError, true);
  toolList?.addEventListener('error', handleCardImageError, true);
  initSkipLink();

  window.addEventListener('hashchange', route);
  route();
}

init();
