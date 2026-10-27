/* --------------------------------------------------------------------------
   Module metadata
   GAMES / TOOLS are the single source of truth for list cards.
   The `id` here must match both the registry key in app.js and module.id.
   -------------------------------------------------------------------------- */

export const GAMES = [
  {
    id: 'snake',
    title: '霓虹贪吃蛇',
    summary: '在霓虹网格中吞噬能量核心，避开边界与自己的身体，挑战更高分。',
    tags: ['Canvas', '原生 JS', '触屏'],
    status: 'available',
    featured: true,
    order: 1,
    accent: '#64e7ff',
    cover: 'assets/covers/snake.webp',
    coverAlt: ''
  },
  {
    id: 'number-merge',
    title: '极简 2048',
    summary: '在 4×4 网格中滑动合并数字方块，向 2048 出发。模块仍在组装中。',
    tags: ['键盘', '触屏', '数字合并'],
    status: 'wip',
    order: 2,
    accent: '#b08cff'
  }
];

export const TOOLS = [
  {
    id: 'electricity',
    title: '电费管家',
    summary: '记录电费余额与每日消耗，数据只保存在本机，轻量、私密、离线可用。',
    tags: ['localStorage', '离线', '数据'],
    status: 'available',
    featured: true,
    order: 1,
    accent: '#ffd166'
  }
];
