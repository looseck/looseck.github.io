# MY GEEK BASE / 数字基地

原生 HTML + CSS + JavaScript 搭建的个人门户。游戏与工具使用 hash 路由、数据驱动卡片和独立模块文件，可直接部署到 GitHub Pages。

## 本地运行

项目使用 ES Modules 和动态 `import()`，不能直接双击 `index.html`（浏览器会拦截 `file://` 模块加载）。在项目根目录启动任意静态服务器：

```powershell
python -m http.server 8000
```

然后打开 `http://localhost:8000/`。

## 路由

| Hash | 视图 |
| --- | --- |
| 空 / `#portals` | 首页入口 |
| `#arcade` | 游戏大厅卡片列表 |
| `#game/{id}` | 游戏详情 |
| `#tools` | 工具箱卡片列表 |
| `#tool/{id}` | 工具详情 |
| `#about` | 关于我 |

非法 hash 会自动回退到 `#portals`。切换视图时会先清理上一个模块，然后回到页首、更新标题并聚焦当前 `h2`。

## 排版规范

- `html` 基准字号固定为 `16px`，正文为 `1rem / 1.7`。
- 面向用户的字号统一使用 `rem`：导航链接与 `ONLINE` 状态至少 `0.9rem`，卡片标题至少 `1.15rem`，卡片简介至少 `0.9rem`，标签和状态至少 `0.8rem`。
- 等宽字体栈在 Latin 等宽字体后追加了 `Microsoft YaHei`、`PingFang SC`、`Noto Sans SC`，确保中文字符回退到清晰的无衬线字体。
- 全局与模块内边距、行高独立于字号设置，可在对应组件的 `padding` / `line-height` 中继续放大。

## 文件结构

```text
index.html                     唯一入口和 6 个 data-view 视图
app.js                         hash 路由、排序、卡片渲染、模块加载
data.js                        GAMES / TOOLS 元数据（唯一数据源）
style.css                      站点级样式、视图壳、共用卡片样式
shared/
  dom.js                       HTML 转义等共享工具
  storage.js                   带异常保护的 localStorage 封装
modules/
  games/
    snake.js / snake.css       霓虹贪吃蛇
    number-merge.js / .css     WIP 占位模块
  tools/
    electricity.js / .css      电费管家
assets/covers/
  snake.webp                   400×225 WebP 封面
```

## 新增一个模块

以新增游戏 `minesweeper` 为例：

1. 新建 `modules/games/minesweeper.js`，导出 `id`、`title`、`status` 和 `mount(container)`；`mount` 必须返回 cleanup。
2. 新建 `modules/games/minesweeper.css`，选择器全部使用 `.mod-minesweeper-` 前缀。
3. 在 `data.js` 的 `GAMES` 中追加一条元数据，`id` 为 `minesweeper`。
4. 在 `app.js` 的 `GAME_MODULES` 中追加一行动态 `import()` 注册。
5. 在 `index.html` 中通过 `<link>` 引入 `modules/games/minesweeper.css`。
6. 可选：把 `minesweeper.webp` 放入 `assets/covers/`，并在元数据中写入 `cover`。

模块之间不得互相 import；共享逻辑放进 `shared/`。模块自身的 localStorage key 必须以 `mod-{id}-` 开头，并在 cleanup 中清理监听器、定时器、RAF 和 ResizeObserver。
