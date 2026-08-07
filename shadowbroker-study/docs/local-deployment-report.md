# ShadowBroker 本地部署与实际效果报告

> 验证日期：2026-08-07  
> 版本：v0.9.84 / `8676a98945a31503180bc84f7c9dd092a3cc743d`  
> 部署方式：Windows 本机源码运行，只监听 `127.0.0.1`

## 1. 当前运行状态

| 服务 | 地址 | 实测结果 |
|---|---|---|
| 中文地图前端 | [http://127.0.0.1:3000](http://127.0.0.1:3000) | HTTP 200，页面可交互 |
| 后端 API | [http://127.0.0.1:8000](http://127.0.0.1:8000) | HTTP 200，FastAPI 正常运行 |
| 健康状态 | [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) | 能返回各来源数量、新鲜度和 SLO |

当前服务已留在本机后台运行。前端和后端均只绑定回环地址，没有开放为局域网或公网服务。

## 2. 已安装内容

- 前端：Node.js 22，`npm ci` 安装 576 个包。
- 后端：Python 3.10，独立环境位于 `upstream/backend/venv`。
- 后端主要依赖：FastAPI、Uvicorn、SGP4、Playwright、STAC、Meshtastic、yfinance 等。
- Docker Desktop 未安装，本次没有使用容器。

`npm ci` 报告 8 个 high severity 依赖审计问题。本次没有执行自动升级，因为自动修复可能改变锁文件或引入破坏性版本变化；正式长期部署前应单独审查。

## 3. 本地只读安全配置

在 `upstream/backend/.env` 中关闭：

```env
MESH_INFONET_FLEET_JOIN=false
MESH_INFONET_FLEET_JOIN_DISABLED=true
MESH_BOOTSTRAP_DISABLED=true
MESH_NODE_MODE=perimeter
MESH_INFONET_RELAY_AUTO_WORMHOLE=false
MESH_INFONET_RELAY_AUTO_WORMHOLE_DISABLED=true
MESH_PRIVACY_PREWARM_ENABLE=false
MESH_MQTT_ENABLED=false
SHADOWBROKER_ENABLE_LIVEUAMAP_SCRAPER=false
GT_ANALYTICS_ENABLED=false
PREDICTION_MARKETS_ENABLED=false
FIMI_ENABLED=false
CROWDTHREAT_ENABLED=false
```

首次启动发现：仅关闭 fleet join 和 MQTT 仍不足以阻止可选的 Wormhole/Tor 预热。增加 bootstrap、relay、privacy prewarm 和 perimeter 配置后，重启日志中不再尝试自动下载 Tor。

## 4. 实际抓取效果

以下是启动后数分钟内的观测，不是固定数据量：

| 图层 | 实际观察 | 数据性质 |
|---|---:|---|
| 商业/公共飞机 | 约 3,200–6,500 架之间波动 | ADS-B 聚合源近实时轮询；受限流和备用源切换影响 |
| 军机 | 约 29–32 架 | ADS-B 标签/呼号识别，不代表全球全部军机 |
| 卫星 | 490 个 | TLE/SGP4 推算位置，不是实时遥测 |
| 船舶 | 11 个 | 当前主要是航母/舰队 OSINT 种子；没有 AISStream Key，所以无全球 AIS 流 |
| 地震 | 32 个 | USGS Feed 在慢层完成后出现 |
| 天气警报 | 17 个 | NWS 公开警报 |
| 新闻 | 59 条 | RSS 聚合 |
| GDELT 事件 | 1,305 个 | 48 个导出文件解析得到，属于新闻事件聚合 |
| 列车 | 173 个 | Amtrak 48 + DigiTraffic 125 |
| 信号情报 | 约 1.4–1.6 万条 | 主要来自缓存的 Meshtastic 公共地图节点和 APRS；不等于本地收到这么多射频信号 |
| 摄像头 | 0 | 首轮尚未得到可用目录数据 |

飞机数量在几分钟内从约 6,500 降至约 3,200，日志同时出现 adsb.lol 420 限流。项目具有“数量骤降时暂时保留旧数据避免闪烁”的逻辑，所以页面上的数量还可能与某一瞬间的 API 健康值不同。这直接证明地图数字不能当作精确实时总量。

## 5. 为什么健康接口显示 `status: error`

前后端服务均正常，但健康接口使用的是“所有来源 SLO”口径。验证时：

- 11 个来源为绿色。
- 1 个来源为黄色：AIS 船舶只有 11 条，低于预期最少 50 条。
- 5 个来源为红色：NUFORC、WastewaterSCAN、FIRMS、火山和 LiveUAMap 尚未抓取或被主动关闭。

因此这里的 `error` 表示“部分数据来源未达健康目标”，不是“应用没有启动”。这是一个合理但容易误解的状态模型。

## 6. 已发现的问题

| 问题 | 实际影响 | 结论 |
|---|---|---|
| OpenSky 返回 401 `invalid_client` | 没有有效 OAuth 凭据，主源失败 | 航班使用公开备用源仍可显示；应申请正确凭据或让缺 Key 时完全跳过 |
| adsb.lol 返回 420 | 部分区域航班请求被限流 | 飞机数量明显波动，验证了免费源无稳定 SLA |
| Christian Science Monitor RSS 返回 404 | 该默认新闻源不可用 | 默认 RSS 地址已经漂移，应更新或移除 |
| 可选 `privacy-core` DLL 不存在 | Mesh 私密消息组件报错 | 不影响地图；本地研究配置应继续关闭 Mesh/Wormhole |
| 中文首屏 hydration mismatch | 浏览器自动选择中文，而服务端首屏先生成英文 | 页面会在客户端恢复；不阻塞使用，但属于前端缺陷 |
| 中文覆盖不完整 | 核心图层/导航中文，首次引导、更新说明、Time Machine、部分设置仍是英文 | 当前只能称“部分简体中文支持” |
| 摄像头为 0 | 暂时看不到道路摄像头效果 | 需要等待、逐提供者验证或配置 Windy/LTA Key |

## 7. 中文界面验收

已实际确认：

- 页面显示“全球威胁拦截系统”。
- 左侧分类显示“航空器、海事、太空、灾害、基础设施、信号情报”。
- 顶部导航显示“图层、情报、节点、终端、更新”。
- 搜索框显示“搜索坐标、地点或呼号”。
- 设置中的语言选项为“中文（简体）”。
- 卫星总数 490，开启太空图层后开关从 `Enable all 太空` 变为 `Disable all 太空`，交互有效。

仍未翻译的主要区域包括首次设置、更新说明、部分高级工具和英文新闻正文。新闻标题本身来自原始外文 RSS，是否翻译应与“保留原文和显示译文”策略分开设计。

## 8. 实际效果结论

项目能够工作，并能快速给出飞机、已编目卫星、新闻事件、基础设施、天气和无线电社区节点的大概全球布局。

但运行结果同时证明：

- 各图层的时间性质不同。
- 免费源会限流、失败或漂移。
- 缺 Key 时会出现空图层或备用源。
- 卫星位置是轨道推算。
- 航母位置明确标注为 `EST. POSITION — OSINT`。
- 页面数量会受到缓存、去重和防闪烁逻辑影响。

因此正确定位仍然是“公开来源态势总览和线索发现”，而不是“权威、完整、精确的全球实时监控”。

## 9. 后续运行

已安装依赖后，可在 `upstream/frontend` 中运行：

```powershell
npm run dev
```

项目会同时启动前端 `3000` 和后端 `8000`。结束时可以运行上游自带的 `stop.bat`，或只停止实际占用这两个端口的本项目进程。

