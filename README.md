# MY GEEK BASE / 数字基地

原生 HTML + CSS + JavaScript 搭建的个人门户。游戏与工具使用 hash 路由、数据驱动卡片和独立模块文件，可直接部署到 GitHub Pages。

## 本地运行

项目使用 ES Modules 和动态 `import()`，不能直接双击 `index.html`（浏览器会拦截 `file://` 模块加载）。在项目根目录启动静态服务器：

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

非法 hash 会自动回退到 `#portals`。切换视图时会清理上一个模块，然后回到页首、更新标题并聚焦当前 `h2`。

## 电费自动采集

`#tool/electricity` 顶部现在包含自动余额卡和最近 50 次余额趋势图。采集与展示是分开的：

1. `.github/workflows/scrape.yml` 每 2 小时的第 5 分钟运行一次，也可以手动触发。
2. `scrape.py` 从计量表页面读取“剩余金额”，把 `{time, balance}` 追加到根目录的 `data.json`，然后由 Action 自动提交、推送。
3. 静态页面只在用户打开电费工具时，向同源地址请求一次 `data.json`。浏览器不会直接访问外部缴费页面，因此没有 CORS 或第三方页面卡顿问题。

### 首次部署

1. 把项目推到 GitHub，确认包含 `.github/workflows/scrape.yml`、`scrape.py` 和 `data.json`。
2. 仓库 **Settings → Actions → General → Workflow permissions** 选择 **Read and write permissions**，否则 Action 无法推送 `data.json`。
3. 确认 GitHub Pages 的发布源是同一分支的根目录（通常是 `main`）。如果 Pages 使用其他分支，请同时调整工作流里的 checkout/push 目标。
4. 打开仓库 **Actions → Scrape electricity balance → Run workflow**，先手动跑一次。之后会自动按计划执行。
5. 如果分支保护规则禁止 `github-actions[bot]` 直接推送，需要给该机器人放行，或改用受保护分支的 Pull Request 流程。

工作流的 cron 按 **UTC** 调度；`scrape.py` 写入 `data.json` 时会转换为 **UTC+8（北京时间）**，所以页面显示的“最后更新”和记录时间都是本地时间。

本地测试抓取：

```powershell
python -m pip install requests
python scrape.py
```

### 性能与容错

- **按需加载**：`data.json` 只在进入电费工具时请求，首页、游戏页和工具箱列表都不会请求。
- **缓存优先**：最近一次成功数据写入带 `mod-electricity-` 前缀的 `localStorage`，再次进入时立即渲染；5 分钟内不重复请求。
- **单次后台刷新**：缓存过期后只发一次同源请求，不轮询、不阻塞工具表单和本地账本渲染。
- **离开即中断**：路由切走时会通过 `AbortController` 取消未完成的请求。
- **离线回退**：请求失败时保留最后一次缓存，并显示“同步失败”；没有缓存时显示“数据生成中，请稍候...”。
- **轻量图表**：使用原生 SVG 绘制最近 50 个点，不加载 Chart.js/CDN，也不使用图表动画。
- **余额提醒**：最新余额低于 `20` 元时，数字、折线图和文字警告同步变红。
- **集成式展示**：没有另建文档中的独立 `power.html`，而是直接接入 `#tool/electricity`，避免多一个页面跳转；用原生 SVG 替代 Chart.js，省掉 CDN 依赖和额外的脚本加载。

页面停留在电费工具时不会轮询。自动采集每 2 小时更新一次，重新进入工具或点击“同步”即可看到最新版本；这样既能保持余额新鲜度，也不会让静态页面持续产生请求。

`data.json` 的格式固定为：

```json
[
  { "time": "2026-11-13 18:20", "balance": 84.61 }
]
```

手工账本仍只保存在浏览器 `localStorage`；自动采集的历史记录保存在 `data.json`，属于站点公开静态文件。

## 文件结构

```text
index.html                     唯一入口和 6 个 data-view 视图
app.js                         hash 路由、排序、卡片渲染、模块加载
data.js                        GAMES / TOOLS 元数据（唯一数据源）
style.css                      站点级样式、视图壳、共用卡片样式
scrape.py                      服务器端余额抓取、JSON 校验与原子写入
data.json                      自动采集的历史余额（由 Action 更新）
.github/workflows/scrape.yml   每 2 小时运行一次的 GitHub Actions
shared/
  dom.js                       HTML 转义等共享工具
  storage.js                   带异常保护的 localStorage 封装
modules/
  games/
    snake.js / snake.css       霓虹贪吃蛇
    number-merge.js / .css     数字合并占位模块
  tools/
    electricity.js / .css      自动余额 + 本地手工账本
assets/covers/snake.webp       封面图
preview/                       界面预览图
```

## 增加模块

1. 在 `data.js` 的 `GAMES` 或 `TOOLS` 中增加元数据，`id` 必须与模块文件名一致。
2. 在 `app.js` 的 `GAME_MODULES` 或 `TOOL_MODULES` 中注册动态 `import()`。
3. 新建 `modules/{games|tools}/{id}.js`，导出 `id`、`title`、`status`、`mount(container)`；`mount` 返回清理函数。
4. 模块样式必须使用 `.mod-{module}-*` 前缀，并在 `index.html` 中按需加载 CSS。
5. 清理函数需要释放事件监听、定时器、RAF 和请求。

## 样式

- 根字号固定 `16px`，正文 `1rem / 1.7`。
- 面向用户的字号使用 `rem`；导航和状态至少 `0.9rem`，卡片标题至少 `1.15rem`，简介至少 `0.9rem`，标签至少 `0.8rem`。
- 等宽字体栈包含 `Microsoft YaHei`、`PingFang SC`、`Noto Sans SC`，中文不会落到不可读的等宽字体。
