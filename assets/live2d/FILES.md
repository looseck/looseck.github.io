# Live2D 文件清单

本目录只用于 Live2D 看板娘。网站运行时只会按需加载下面标为“必需”的文件；其余文件是源文件、备用文件或 VTube Studio 元数据，可以删除以减小仓库体积。

## 运行时必需

| 路径 | 用途 |
| --- | --- |
| `model-hd.json` | 桌面端模型清单，优先加载 |
| `model-2k.json` | 桌面端回退清单 |
| `model-1k.json` | 移动端模型清单 |
| `大肥鱼.moc3` | 模型本体，不可缺 |
| `大肥鱼.physics3.json` | 头发、衣服和尾巴物理 |
| `大肥鱼.cdi3.json` | 显示名称/参数信息，保留 |
| `tex-hd/texture_00~04.webp` | 桌面高清纹理，共约 3.9 MB |
| `tex-2k/texture_00~04.webp` | 桌面回退纹理，共约 1.6 MB |
| `tex-1k/texture_00~04.webp` | 移动端纹理，共约 0.7 MB |
| `Actions/RaiseHand.motion3.json` | 举手 |
| `Actions/LowerHand.motion3.json` | 放下手 |
| `Actions/ShowGrass.motion3.json` | 掏出狗尾草 |
| `Actions/HideGrass.motion3.json` | 收起狗尾草 |
| `Actions/PointFinger.motion3.json` | 竖起手指 |
| `Actions/RetractFinger.motion3.json` | 收回手指 |
| `Actions/Struggle.motion3.json` | 挣脱 |
| `Actions/Shy.motion3.json` | 害羞 |
| `Actions/Heart.motion3.json` | 爱心眼 |
| `Actions/Angry.motion3.json` | 生气 |
| `Animation/IDLE.motion3.json` | 待机循环动作 |

## 建议保留（不直接加载）

| 路径 | 说明 |
| --- | --- |
| `backup/texture_00.current.png` | 修正后的 4K 源图，8.1 MB；用于以后重新导出 |
| `大肥鱼.4096/texture_00~04.png` | 原始 4K/8K 源纹理，共约 43 MB；只是素材源，不参与网页加载 |
| `大肥鱼.png` | 角色参考图，网站不加载 |
| `Exp3/*.exp3.json` | 23 个表情文件；目前动作菜单没有接入表情，可留作后续扩展 |
| `Animation/` 中除 `IDLE.motion3.json` 外的文件 | 原始 VTube Studio 动作，当前播放使用 `Actions/` 副本 |
| `大肥鱼.model3.json` | VTube Studio 原始清单；网站使用 `model-hd.json` / `model-2k.json` / `model-1k.json` |

## 可以删除

| 路径 | 原因 |
| --- | --- |
| `大肥鱼.vtube.json` | VTube Studio 配置，网页不读取 |
| `items_pinned_to_model.json` | VTube Studio 道具固定信息，网页不读取 |
| `AdvancedARKitSettings.vbridger` | VTube Studio 的 ARKit 设置，网页不读取 |
| `大肥鱼.png` | 参考图，不影响运行；想保留视觉资料可留着 |
| `大肥鱼.model3.json` | 原始清单，网站不使用 |
| `Exp3/` | 当前菜单没有表情入口；删除不影响 10 个动作 |
| `Animation/` 中非 IDLE 的原始动作 | 网站播放的是 `Actions/` 中的一次性副本 |
| `大肥鱼.4096/` | 原始大图，约 43 MB；确认不需要再重新导出后可删除 |

## 网站根目录

必须保留：`index.html`、`app.js`、`data.js`、`style.css`、`live2d.js`、`live2d.css`、`modules/`、`shared/`、`vendor/`、`assets/covers/`、`assets/live2d/` 中的运行时必需文件，以及 `data.json`（电费工具的数据）。

可选：`README.md`、`preview/`、`scrape.py`、`.github/workflows/scrape.yml`（需要自动更新电费时保留）、`power-tracker.txt`、设计文档、所有 `.tmp*` 测试目录。
