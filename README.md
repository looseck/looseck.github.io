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

## Live2D 看板娘

页面右下角有一个全局 Live2D 看板娘，它不属于任何 hash 视图。首页、列表页和工具页会保留角色；进入 `#game/{id}` 游戏详情时自动收起，避免遮挡棋盘和触控区域，离开游戏后自动恢复。

| 操作 | 效果 |
| --- | --- |
| 左键点击角色 | 按模型内点击区域触发不同动作：头部、左手、右手、下半身/尾巴各有独立动作池；点击与拖拽会区分 |
| 右键点击角色 | 在指针附近打开动作菜单；10 个动作全部可选，支持键盘方向键、Home/End 和 Escape |
| 鼠标拖拽 | 移动角色；松手后按速度继续滑动，碰到视口边缘会反弹 |
| 右上角菜单按钮 | 打开同一动作菜单；可用“隐藏角色”收起，再用右下角 `L2D` 按钮恢复 |
| 移动鼠标 | 角色眼睛和头部平滑跟随指针；离开/失焦后回到正视 |

实现要点：

- `live2d.js` 在页面 `load` 后通过 `requestIdleCallback` 才加载 `vendor/live2d/` 下的 PixiJS、Cubism Core 和 pixi-live2d-display，不阻塞首屏；模型和纹理之后才请求。如果直接打开游戏详情，角色和运行时都不会加载，离开游戏后才开始懒加载。
- 桌面优先加载 `assets/live2d/model-hd.json` 和 `tex-hd/` 高分辨率 WebP；加载失败自动回退到 `model-2k.json`。移动端加载 `model-1k.json` 和 `tex-1k/`。桌面画布至少按 1.5 倍分辨率渲染，减少缩放造成的发虚。
- 修正后的 4K 源图备份在 `assets/live2d/backup/texture_00.current.png`；`texture_00.png` 右上角的黑色鼻影已擦除，HD/2K/1K WebP 均由修正后的原图重新导出。
- `texture_00` 的鼻影修复只清除透明贴图区中的黑色长条，保留眼部、脸部轮廓和灰色鼻影；备份目录保留当前 4K 版本，便于后续重新导出。
- `assets/live2d/Actions/` 是 10 个动作的一次性副本（7 个手部动作 + 3 个特殊动作，`Meta.Loop = false`）；原始 `Animation/` 文件没有改动。`Idle` 仍循环播放。
- 10 个动作始终可选，不再按手部状态禁用；连续点击会先合并，松开后再按点击区域播放。
- 特殊动作包括害羞、爱心眼、生气，位于菜单的 `特殊 / SPECIAL` 组；它们通过一次性 motion3 驱动头部角度和表情开关参数。
- 点击区域按模型实际渲染边界归一化：头部随机害羞/爱心眼/生气，左手随机举手/放下手，右手随机竖指/收指/狗尾草，下半身或尾巴触发挣脱，身体其他区域只显示吐槽气泡。
- 鼠标移动通过 `model.focus()` 驱动 Cubism 的焦点控制器，眼睛和头部平滑跟随；气泡为独立的固定定位元素，带 Q 弹缩放，不会撑开页面。
- 角色底部有柔和的悬浮阴影，画布使用 CSS 上下微浮动呼吸动画；均只改变合成层，不触发布局。
- 拖拽只改变 `transform`，不触发页面布局；惯性使用 `requestAnimationFrame`，速度低于阈值自动停止。桌面 60fps，移动端和减少动态效果模式降到 30fps。
- 页面隐藏、切换标签页或收起角色时暂停渲染；恢复时继续。未使用 `backdrop-filter`、大面积模糊或持续重绘的阴影动画。
- 没有 WebGL 或模型加载失败时只隐藏小组件，不抛页面级异常；动画失败不会影响其他页面功能。
- 控件支持键盘：聚焦角色后 `Enter` / `Space` 播放随机动作，`Shift+F10` 或菜单键打开菜单。

模型清单只新增了 `Motions` / `Expressions` 引用，角色参数和物理未改写；仅擦除了 `texture_00` 中导致黑鼻的透明贴图区域。特殊动作使用 motion3 参数曲线；Exp3 表情仍保留在清单中，后续可以继续接入独立的表情菜单。点击区域、气泡文案和动作池定义在 `live2d.js` 顶部的 `REGIONS` / `ACTION_LINES` 中，调整区域阈值时同步更新这里即可。

## 电费自动采集

`#tool/electricity` 现在只保留自动采集数据，顶部直接展示当前余额、今日已用、昨日同期和两日累计用量曲线。采集与展示是分开的：

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
python -m pip install requests curl_cffi
python scrape.py
```

### GitHub Actions 返回 405 时

如果本地直接打开计量表页面正常，但 Action 在 `Fetch balance` 步骤报：

```text
405 Client Error: Not Allowed for url: https://www.wap.cnyiot.com/nat/pay.aspx...
```

这通常不是脚本正则或页面结构问题，而是上游 **Alibaba Cloud WAF 对 GitHub 云出口 IP 的拦截或临时限流**。同一个请求从当前国内网络访问仍会返回 `200`。检测到这种情况时：

1. **不要连续手动重跑。** 短时间内重复触发可能延长临时封禁。先等待 30–60 分钟，让下一次定时任务尝试。
2. **配置固定出口代理（推荐）**：在 GitHub 仓库 **Settings → Secrets and variables → Actions** 新建 `SCRAPE_PROXY_URL`，填入一个可访问该站点的 HTTP(S) 代理地址（例如中国境内的稳定出口）。工作流已经把这个 Secret 传入脚本，`requests` 和 `curl_cffi` 都会走该代理。
3. **换到非 GitHub 云出口**：使用家里/办公室的常开设备运行 GitHub Actions self-hosted runner，或在本地定时运行 `python scrape.py` 后提交 `data.json`。这是最稳定的长期方案。
4. 如果服务商提供正式 API，优先使用正式 API，而不是抓取 HTML 页面。

脚本现在在 GitHub Actions 环境中使用 `curl_cffi` 的浏览器 TLS 指纹发起**一次**请求；如果 `curl_cffi` 安装失败则退回 `requests`。不会再降级到 HTTP，也不会从同一 runner IP 连续打两次，避免延长 WAF 限流。请求失败时只退出、不写 `data.json`，日志会打印上游响应片段，便于确认是不是 WAF 页面。本地运行仍保持 `requests` 优先、`curl_cffi` 备用。

### 性能与容错

- **按需加载**：`data.json` 只在进入电费工具时请求，首页、游戏页和工具箱列表都不会请求。
- **缓存优先**：最近一次成功数据写入带 `mod-electricity-` 前缀的 `localStorage`，再次进入时立即渲染；5 分钟内不重复请求。
- **单次后台刷新**：缓存过期后只发一次同源请求，不轮询、不阻塞工具渲染。
- **离开即中断**：路由切走时会通过 `AbortController` 取消未完成的请求。
- **离线回退**：请求失败时保留最后一次缓存，并显示“同步失败”；没有缓存时显示“数据生成中，请稍候...”。
- **轻量图表**：使用原生 SVG 绘制今天和昨天两条累计用量曲线，不加载 Chart.js/CDN，也不使用图表动画。
- **余额提醒**：最新余额低于 `20` 元时，余额数字和文字警告变红。
- **集成式展示**：没有另建文档中的独立 `power.html`，而是直接接入 `#tool/electricity`，避免多一个页面跳转；用原生 SVG 替代 Chart.js，省掉 CDN 依赖和额外的脚本加载。

页面停留在电费工具时不会轮询。自动采集每 2 小时更新一次，重新进入工具或点击“同步”即可看到最新版本；这样既能保持余额新鲜度，也不会让静态页面持续产生请求。

### 今日用量和两日对比口径

- 每次采集保存的是余额，因此“今日已用”用当天相邻两次采集的**余额下降量之和**估算；充值等余额上升不计入。
- “昨日同期”指标使用最新一条采集的时间切点，例如今天截至 `18:44`，昨天也只累计到 `18:44` 左右的采集点，避免拿今天的半天和昨天的全天直接比较；图表仍保留昨天全天曲线作为走势背景。
- 两次采集间隔超过 6 小时的空档不计入用量，避免把长时间断采后的余额变化误算成一次消耗。
- 当前版本需要至少 2 条采集记录才能计算用量；昨日对比还需要前一天的数据。新接入的站点不会凭空生成历史数据，曲线会随着每 2 小时的采集自动积累。
- 手工记录功能和对应的本地存储读写已经移除，页面只展示自动采集结果。

`data.json` 的格式固定为：

```json
[
  { "time": "2026-11-13 18:20", "balance": 84.61 }
]
```

自动采集的历史记录保存在 `data.json`，属于站点公开静态文件；今日/昨日用量在浏览器端根据这些记录实时计算，不会额外上传任何本地数据。

## 桌面滚动性能

这次针对桌面端滚动掉帧做了样式层排查。页面没有滚动监听或滚动动画 JS，问题来自大面积合成层：

- 粘性导航、首页卡片、Hero HUD 等位置使用了多处 `backdrop-filter` 毛玻璃；滚动时浏览器需要不断重新采样背景并模糊，桌面大视口同时覆盖多个大面积模糊区域，是最主要的开销。
- 环境光斑使用了 `filter: blur(90px)` 加无限位移动画，形成超大且持续变化的滤镜层。
- 首页大标题的渐变动画和卡片悬停时的 `box-shadow` 呼吸动画会持续触发大区域重绘。

对应修复：

- 移除全站所有 `backdrop-filter`，改用更高不透明度的分层渐变保留玻璃质感。
- 光斑改为静态、预软化的 `radial-gradient`，去掉 90px 滤镜、`will-change` 和漂移动画。
- 大标题渐变改为静态；移除卡片悬停呼吸动画。
- 保留低频、小面积的装饰动画（光标闪烁、跑马灯等），不再让滚动路径承担大面积模糊和重绘。

如果更换浏览器或显卡后仍偶发掉帧，可以直接用开发者工具 Performance 面板录制滚动并观察 `Paint` / `Composite Layers` 耗时；当前版本已经移除了最典型的滚动成本来源。

GitHub Pages 对 CSS 有约 10 分钟的缓存。部署后如果看到的仍是旧视觉效果，请强制刷新一次页面，或等缓存过期后再测滚动。

## 文件结构

```text
index.html                     唯一入口和 6 个 data-view 视图
app.js                         hash 路由、排序、卡片渲染、模块加载
data.js                        GAMES / TOOLS 元数据（唯一数据源）
style.css                      站点级样式、视图壳、共用卡片样式
live2d.js                      看板娘加载、动作菜单、拖拽惯性/边缘反弹
live2d.css                     看板娘、动作菜单、恢复按钮样式
scrape.py                      服务器端余额抓取、JSON 校验与原子写入
data.json                      自动采集的历史余额（由 Action 更新）
.github/workflows/scrape.yml   每 2 小时运行一次的 GitHub Actions
vendor/live2d/                 懒加载的 PixiJS / Cubism Core / 显示插件
assets/live2d/                 模型、物理、动作、表情、HD/2K/1K WebP 纹理
assets/live2d/FILES.md         运行时必需文件与可选源文件清单
shared/
  dom.js                       HTML 转义等共享工具
  storage.js                   带异常保护的 localStorage 封装
modules/
  games/
    snake.js / snake.css       霓虹贪吃蛇
    number-merge.js / .css     数字合并占位模块
  tools/
    electricity.js / .css      自动余额、今日用量、两日对比
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
