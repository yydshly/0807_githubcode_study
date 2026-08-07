# ShadowBroker 完整来源入口手册

> 源码审计日期：2026-08-07  
> 上游基线：`8676a98945a31503180bc84f7c9dd092a3cc743d`（v0.9.84）  
> 目标：回答“官网做什么、从哪里进入、项目如何获取、走什么协议、是否免费、是否需要设备或多点部署”。

## 1. “所有来源”的范围

本手册列出上游代码中实际存在的外部数据提供者、默认新闻源、摄像头目录、地图底图以及操作员可接入的本地设备入口。测试 URL、示例域名、Wikipedia 仅作为标签链接的情况不计为数据源。

“代码中存在”不等于“默认启用”，也不等于“当前一定可用”。公共接口、网页结构、免费额度和许可都可能变化；因此每个入口分开记录：

- 官网入口：人先到哪里了解、注册或申请密钥。
- 机器入口：程序实际连接的 API、Feed、Broker 或本地端口。
- 获取动作：拉取、订阅、接收推送、网页解析、文件下载或本地计算。
- 免费性质：免费公开、免费注册、贡献后免费、免费额度、付费/待确认。
- 设备性质：完全不需要设备、可选自有设备、必须运行本地软件或接收机。

## 2. 先理解 12 种入口和交互方式

| 入口类型 | 谁先发起 | 连接形态 | 常见格式 | 在本项目中的例子 | 研究重点 |
|---|---|---|---|---|---|
| REST API 拉取 | ShadowBroker | 每隔一段时间发 HTTP 请求 | JSON/GeoJSON/CSV | OpenSky、USGS、OpenAQ | Key、分页、限流、缓存、重试 |
| OAuth2 API | ShadowBroker | 先换取短期 Token，再请求数据 | JSON | OpenSky、Copernicus | Token 过期、权限、刷新 |
| WebSocket 订阅 | ShadowBroker | 建立长连接，服务端连续推消息 | JSON | AISStream | 心跳、断线重连、背压、去重 |
| 原始 TCP 流 | ShadowBroker 或本地软件 | 长连接、逐行消息 | 文本/JSON Line | APRS-IS、JS8Call | 登录握手、消息边界、重连 |
| MQTT 订阅 | ShadowBroker | 连接 Broker 并订阅 Topic | 二进制/Protobuf/JSON | Meshtastic | Topic、QoS、保留消息、身份 |
| RSS/Atom | ShadowBroker | 周期 HTTP 拉取 | XML | 新闻、USNI | ETag、发布时间、正文版权 |
| 静态/批量文件 | ShadowBroker | 偶尔下载整个文件 | CSV/JSON/ZIP/KML | OurAirports、OpenSky 元数据 | 版本、校验、增量更新、许可证 |
| 地理服务协议 | ShadowBroker/浏览器 | 查询目录或按瓦片请求 | STAC、WMTS、WMS、WFS | Copernicus、NASA GIBS | 坐标系、切片、云掩膜、资产签名 |
| 政府数据平台 | ShadowBroker | 调用目录式查询 | Socrata、ArcGIS REST、KML | 多地交通摄像头 | 字段漂移、分页、机构条款 |
| 网页/RSS 抓取 | ShadowBroker | 下载 HTML，必要时执行浏览器 | HTML/DOM | Telegram 预览、LiveUAMap | 页面变化、反爬、合法性、稳定性 |
| 本地 HTTP 推送 | 接收设备 | 设备主动把观测 POST 给后端 | JSON | AIS-catcher → `/api/ais/feed` | 鉴权、幂等、节点身份、断网缓存 |
| 浏览器媒体/瓦片 | 用户浏览器 | 点击或移动地图时直接请求 | PNG/JPEG/HLS/MJPEG | CARTO、Esri、CCTV | 客户端 IP 暴露、代理、跨域、带宽 |

一句话区分：轮询是“我定时问一次”，流式协议是“保持连接等消息”，本地推送是“设备主动报给我”，静态文件是“整包下载后在本地解析”。

## 3. 航空入口

| 来源及官网作用 | 项目机器入口与抓取方法 | 交互/频率 | 免费与认证 | 设备/多点 | 代码入口 |
|---|---|---|---|---|---|
| [OpenSky Network](https://opensky-network.org/)：由接收站网络聚合飞机状态向量 | OAuth2 Client Credentials 后调用 REST states API | 后端拉取，快层约 60 秒 | 免费注册可研究使用；长期自动化、运营及商业用途需重新核对官方许可 | 不需要 | `backend/services/fetchers/flights.py` |
| [Airplanes.live](https://airplanes.live/api-guide/)：社区 ADS-B 全球航班 API | 公开 v2 REST，在主源失败或补充军机时查询 | HTTP 拉取；官方限制 1 请求/秒，免费层 500 次/日 | 免费 Pull 层，无 Key；非商业、无 SLA，鼓励贡献接收站 | 使用 API 不需要；贡献数据才需要 ADS-B 接收机 | `backend/services/fetchers/flights.py` |
| [ADSB.fi](https://github.com/adsbfi/opendata)：社区 ADS-B 开放接口 | 兼容型 REST JSON 备用入口 | HTTP 拉取，作为故障回退 | 公开接口；频率和再利用条件应在启用前复核 | 不需要 | `backend/services/fetchers/flights.py` |
| [adsb.lol](https://adsb.lol/)：社区 ADS-B 聚合与开放数据 | REST JSON 获取飞机；静态 VRS standing-data 获取航线/机场补充 | 航班约 60 秒；路线数据约 5 天刷新 | 无 Key；开放数据需署名并遵守 ODbL/站点条款 | 不需要 | `backend/services/fetchers/flights.py`、路线服务 |
| [OpenSky S3 aircraft database](https://opensky-network.org/data/data-sources)：飞机注册与机型元数据快照 | 下载公开 S3 月度 CSV/ZIP 快照，本地建索引 | 约 5 天检查一次，但原始快照按月 | 公开下载；数据授权与 OpenSky 条款分开核对 | 不需要 | 飞机元数据服务 |
| [OurAirports](https://ourairports.com/data/)：全球机场、跑道、频率开放表 | 下载 CSV 后本地解析 | 低频批量更新 | 免费公开，需遵守其开放数据说明 | 不需要 | 路线/机场数据服务 |
| [Airframes](https://docs.airframes.io/api/)：ACARS/VDL 消息、飞机与接收站信息 | `AIRFRAMES_API_KEY` 调 REST，按对象或通信记录查询 | 默认约 15 分钟/按需 | 有效 Key；贡献高质量接收数据者可获得最小免费 API 账户，其余方案待确认 | API 不需要；成为贡献者需要航空接收设备 | Airframes 服务 |
| 项目内飞机关注名单与 GPS 干扰推断 | 本地规则匹配 ICAO/注册号，并用 ADS-B NAC-P 等字段聚合异常 | 随每次航班刷新 | 派生结果，不是独立免费源 | 不需要 | `backend/data`、军机/GPS 推断服务 |

实际链路是：`全球接收站 → 聚合服务 → ShadowBroker HTTP 拉取 → 标准化/去重 → 地图`。因此默认运行不需要你在各地部署 ADS-B 设备。

## 4. 船舶与海洋入口

| 来源及官网作用 | 项目机器入口与抓取方法 | 交互/频率 | 免费与认证 | 设备/多点 | 代码入口 |
|---|---|---|---|---|---|
| [AISStream](https://aisstream.io/documentation)：全球 AIS 流聚合 | `wss://stream.aisstream.io/v0/stream`，发送订阅条件后接收 JSON 消息 | WebSocket 持续流；指数退避重连 | 免费注册 Key；Beta、无 SLA | 不需要 | `backend/services/ais_stream.py` |
| [AISHub](https://www.aishub.net/api)：交换式 AIS 聚合 | `https://data.aishub.net/ws.php`，用户名参数，JSON/XML/CSV | REST 回退，默认约 20 分钟；官方要求最多每分钟一次 | 不是普通免注册 API；必须贡献自己的 AIS 站，达标后免费使用聚合 API | 要取得账户必须有 AIS 接收站；多地贡献不是硬要求 | `backend/services/fetchers/aishub_fallback.py` |
| [Global Fishing Watch](https://globalfishingwatch.org/our-apis/)：捕鱼、靠港、相遇和船舶事件 | Bearer Token 调 v3 REST API | 周期拉取，约小时级 | 免费申请 Key；非商业与署名限制 | 不需要 | `backend/services/fetchers/geo.py` |
| 本地 AIS 接收 | `RTL-SDR + VHF 天线 + AIS-catcher` 解码后 HTTP POST `/api/ais/feed` | 设备推送，秒级 | 软件免费、硬件自购 | 单点覆盖附近海域；只有追求多地区自有覆盖才部署多点 | `backend/routers/ais.py` |
| [USNI News Fleet Tracker](https://news.usni.org/category/fleet-tracker)：公开舰队动态文章 | RSS 拉取后提取舰队/航母位置线索 | RSS，约小时到日级 | 公开阅读；文章版权不等于可整篇再分发 | 不需要 | `backend/services/fetchers/usni_fleet_tracker.py` |
| 航母/军舰估算 | 合并 AIS、MMSI 名单、GDELT/USNI 新闻线索 | 派生，不定期 | 不是独立数据授权 | 不需要 | `backend/services/carrier_tracker.py` |

本地 AIS 是项目中最明确的“设备主动向中心推送”入口。若以后做多点，应设计 `节点证书 → 本地缓存 → 安全上传 → 中心去重`，而不是把每个边缘节点都部署完整前端。

## 5. 卫星、遥感与地球观测入口

| 来源及官网作用 | 获取与协议 | 频率/实时性 | 免费/认证 | 设备 |
|---|---|---|---|---|
| [CelesTrak](https://celestrak.org/)：卫星 TLE 目录 | HTTP 下载 TLE，本地用 SGP4 推算轨道 | 地图位置可每分钟重算；原始 TLE 并非逐秒遥测 | 公开读取，需合理限速 | 无 |
| [SatNOGS](https://satnogs.org/)：开源卫星地面站网络 | REST JSON 拉取站点/观测 | 项目慢层约 5 分钟 | 公共 API | 无；贡献才需地面站 |
| [TinyGS](https://tinygs.com/)：LoRa 卫星地面站网络 | REST JSON 拉取 | 慢层约 5 分钟 | 公共社区服务 | 无；贡献才需 LoRa 站 |
| [NASA GIBS](https://gibs.earthdata.nasa.gov/)：NASA 全球影像瓦片 | 浏览器请求 WMTS/瓦片 | 日级产品，常有 24–48 小时延迟 | 公开，要求 NASA 署名 | 无 |
| [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/docs)：云端地球观测目录 | STAC 搜索，获取签名资产 URL | 按需 | 公共目录；遵守各数据集许可 | 无 |
| [Copernicus Data Space](https://dataspace.copernicus.eu/)：Sentinel 目录、处理与下载 | OAuth2、STAC/Process API；`SENTINEL_CLIENT_ID/SECRET` | 搜索按需；项目趋势任务约 24 小时 | 免费注册，有配额/公平使用限制 | 无 |
| [ASF Search](https://search.asf.alaska.edu/)：SAR 目录 | REST 搜索目录；产品下载可走 Earthdata Token | 目录约 1 小时，产品约 30 分钟且默认关闭 | 目录公开；部分资产需 Earthdata 登录 | 无 |
| NASA OPERA、EGMS、GFM、Copernicus EMS、UNOSAT | 官方目录/GeoJSON/产品文件 | 产品发布后拉取，非实时原始雷达 | 多为公共产品；逐源保留署名 | 无 |
| VIIRS Nightlights / Google Earth Engine | GEE 账户或公开资产计算夜光变化 | 项目约 12 小时 | 研究通常可申请；商业/高用量另审 | 无 |

这些入口的关键不在“抓网页”，而在 STAC 项目、资产签名 URL、坐标系、云量筛选、瓦片层级和产品发布时间。卫星动画常是“轨道参数在本地推算”，遥感图层常是“延迟产品”，都不应标成真正实时。

## 6. 灾害、环境、天气与异常观测

| 来源 | 官网作用与机器入口 | 协议/项目频率 | 免费与认证 | 备注 |
|---|---|---|---|---|
| [USGS Earthquake](https://earthquake.usgs.gov/earthquakes/feed/) | 官方全球地震 GeoJSON Feed | HTTP/GeoJSON；快层/分钟级 | 公开免费 | 最适合做第一个零 Key 实验 |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) | 卫星火点/热异常 CSV/API | HTTP CSV；慢层约 5 分钟 | 免费，增强范围需 `FIRMS_MAP_KEY` | 观测受卫星过境、云和误报影响 |
| [Smithsonian GVP](https://volcano.si.edu/) | 全球火山目录 | 静态文件/缓存 | 公开使用，保留署名 | 目录，不是实时喷发传感器 |
| [OpenAQ](https://docs.openaq.org/) | 全球空气质量统一 API | v3 REST JSON；慢层约 5 分钟 | 当前需免费 `X-API-Key`；60/分钟、2,000/小时 | 上游说明“无需 Key”已过时 |
| [NOAA/NWS](https://www.weather.gov/documentation/services-web-api) | 美国天气警报、多边形 | REST/GeoJSON；约 5 分钟 | 无 Key，需规范 User-Agent | 区域覆盖为主 |
| [NOAA SWPC](https://services.swpc.noaa.gov/) | 太空天气、Kp、太阳活动 | JSON Feed；约 5 分钟 | 公开免费 | 属官方观测 Feed |
| [RainViewer](https://www.rainviewer.com/api.html) | 全球天气雷达时间轴和瓦片 | JSON 清单 + 地图瓦片；上游约 5 分钟更新 | 无 Key；个人、教育、小型社区免费，需署名，无 SLA | 浏览器会直接取瓦片 |
| [IODA](https://ioda.inetintel.cc.gatech.edu/) | 国家/区域互联网中断指标 | REST JSON；慢层约 5 分钟 | 公共学术服务 | 结果是指标，不是单一“断网事实” |
| [NUFORC](https://nuforc.org/) | 公开不明空中现象报告 | HTML/AJAX 表格抓取；每周一 12:00 UTC | 公开页面，网页结构和再利用条款需复核 | 可选 Mapbox Tilequery 定位；失败时可用 Hugging Face 镜像数据集 |
| [WastewaterSCAN](https://data.wastewaterscan.org/) | 污水病原体监测 | 项目从公开 Google Cloud Storage JSON 下载；每日 | 公开读取状态按项目实现，正式复用需核对数据条款 | 公共卫生数据有发布时间与覆盖偏差 |

## 7. 网络、基础设施与地理解析

| 来源 | 作用 | 接入方式 | 免费/设备 | 代码入口 |
|---|---|---|---|---|
| [RIPE Atlas](https://atlas.ripe.net/docs/apis/rest-api-manual/introduction/) | 全球网络探针、测量和连接状态 | REST API 读取公开 probes；项目慢层约 5 分钟 | 多数公开读取无需认证；创建测量需账户、Key 和 Credits；不必自建探针 | 数据抓取器/基础设施服务 |
| [WRI Global Power Plant Database](https://datasets.wri.org/) | 全球发电厂静态资料 | 文件下载、本地缓存 | 免费开放，CC BY 署名 | `fetchers/infrastructure.py` |
| DC Map | 数据中心位置 | GitHub 数据文件，约 7 天缓存 | 公开仓库；逐文件核对许可证 | `fetchers/infrastructure.py` |
| 项目军事基地资料 | 设施坐标 | 内置静态数据 | 无 API；来源新鲜度需审计 | `backend/data` |
| TeleGeography 派生海缆 | 海底光缆路线 | 项目静态 GeoJSON | 可视化公开不等于可再分发 | `backend/data` |
| [Photon](https://photon.komoot.io/) | OSM 地名搜索/反向地理编码 | REST JSON，文本事件定位时按需调用 | 公共实例免费但须限流 | 地理解析服务 |
| [Nominatim](https://operations.osmfoundation.org/policies/nominatim/) | OSM 地理编码 | REST JSON，缓存后调用 | 公共实例约 1 请求/秒，禁止大批量 | dossier/解析服务 |
| [RestCountries](https://restcountries.com/)、[Wikidata](https://query.wikidata.org/)、[Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) | 国家、实体、摘要和图像上下文 | REST/SPARQL/MediaWiki，约 24 小时缓存 | 公开；各自有署名/限流要求 | region dossier/OSINT |

RIPE Atlas 也能做真正的多点网络测量，但 ShadowBroker 当前主要读取现有探针/结果；只有你要主动从不同网络发起 ping、traceroute、DNS 测量时，才进入“申请/托管探针和消耗 Credits”的研究。

## 8. 新闻、冲突、公开社交与操作员自定义源

| 来源 | 获取入口 | 交互/频率 | 免费/风险 |
|---|---|---|---|
| [GDELT](https://www.gdeltproject.org/) | 批量 ZIP/Feed 下载并抽取事件 | 项目约 30 分钟，每轮可下载多批文件 | 公开免费；重复、误分类和原文核验是核心问题 |
| [DeepState Map](https://deepstatemap.live/) | GeoJSON/镜像数据 | 约 30 分钟 | 公开可见；立场、许可、镜像完整性需标记 |
| Telegram 公共预览 | 拉取 `t.me/s/<channel>` HTML | 默认每小时，最低 15 分钟 | 不需要 Bot Token；页面结构、平台条款、隐私需审计 |
| LiveUAMap | Playwright 执行动态页面并解析 | 约 30 分钟，默认关闭 | 技术与条款风险高，不建议首轮启用 |
| [alerts.in.ua](https://alerts.in.ua/) | Token API | 约 2 分钟 | 免费 Token/条款以官网为准 |
| [EUvsDisinfo](https://euvsdisinfo.eu/) / FIMI | RSS/公开条目 | 约 12 小时，默认关闭 | 公共信息；标签带有来源立场，需要证据链 |
| CrowdThreat | 公共威胁众包 API | 每日，默认关闭 | 公开接口状态需运行前复核；不可直接当已证实事实 |
| 操作员自定义 Feed | 配置任意受信任 JSON/GeoJSON URL | 最低约 60 秒轮询 | 费用/许可由目标源决定；必须防 SSRF、超大响应和恶意字段 |

### 默认 22 个 RSS/Atom 新闻入口

它们统一由 `feedparser` 通过 HTTP 拉取，差别主要在来源权重和内容许可。公开阅读通常免费，但标题/摘要可抓取不代表正文可再分发。

| 默认源 | 默认源 | 默认源 |
|---|---|---|
| NPR | BBC | Al Jazeera |
| New York Times | GDACS | The War Zone |
| Bellingcat | The Guardian | TASS |
| Xinhua | Channel NewsAsia | MercoPress |
| South China Morning Post | The Diplomat | Yonhap |
| Asia Times | Defense News | The Japan Times |
| Christian Science Monitor | PBS NewsHour | France 24 |
| Deutsche Welle |  |  |

配置入口：`backend/config/news_feeds.json`；抓取入口：`backend/services/fetchers/news.py`。

## 9. 网络安全与公开侦察入口

| 来源 | 作用 | 协议/认证 | 免费判断与边界 |
|---|---|---|---|
| [Shodan](https://developer.shodan.io/api/requirements) | 互联网设备、端口、Banner | API Key + REST | 免费账户有 Key，但完整搜索、分页、流和 Credits 受方案限制；只查合法授权目标 |
| [OpenSanctions](https://www.opensanctions.org/) / OFAC SDN | 制裁实体 | 数据集下载，本地日缓存 | 数据集许可分别核对并署名 |
| [abuse.ch](https://abuse.ch/) Feodo/URLhaus | C2 与恶意 URL Feed | HTTP Feed/API；约 5 分钟 | 公开免费；必须处理过期和误报 |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | 已知被利用漏洞 | JSON/CSV Feed；约 5 分钟 | 美国政府公开数据 |
| ip-api.com | IP 地理位置 | REST 按需 | 免费层有频率、协议和非商业限制 |
| Google Public DNS | DNS 记录 | DNS-over-HTTPS | 免费；查询会向 Google 暴露 |
| RDAP.org | 域名/IP 注册数据 | REST/重定向到权威注册局 | 公开，字段因注册局而异 |
| crt.sh | 证书透明度/子域 | 非正式 HTTP JSON 查询 | 免费但无 SLA，需严格缓存限速 |
| BGPView | ASN、前缀、路由 | REST JSON | 公共服务，无生产 SLA |
| OTX、MITRE CVE、Tor 列表、GitHub | 威胁脉冲、漏洞、出口节点、账户上下文 | REST/公开列表；部分需免费 Key | 合法授权、个人信息和误报处理比“能抓到”更重要 |

## 10. 预测市场与金融入口

| 来源 | 官网作用 | 接入方式/频率 | 免费与认证 |
|---|---|---|---|
| [Polymarket](https://docs.polymarket.com/quickstart) | 公开事件市场、价格和成交数据 | 公共 REST；项目默认关闭，启用后约 7 分钟并加抖动 | 数据读取无需 Key；交易另需钱包/认证 |
| [Kalshi](https://docs.kalshi.com/getting_started/quick_start_market_data) | 受监管事件合约市场 | 公共 REST 获取市场；WebSocket 需要认证握手 | 公共市场数据 REST 无需认证；交易和实时流不同 |
| [Finnhub](https://finnhub.io/pricing) | 股票报价、公司与市场数据 | `FINNHUB_API_KEY` REST；金融约 30 分钟，适配器约 15 分钟 | 免费个人层 60 次/分钟；商业/更全数据付费 |
| [Yahoo Finance via yfinance](https://github.com/ranaroussi/yfinance) | 市场历史与报价的非官方客户端 | Python 库发 HTTP 请求，约 30 分钟 | 非官方接口；个人研究可实验，不应当作有 SLA 的生产 API |

这里的入口价值在于比较“公开 REST 拉取”和“需要认证的实时 WebSocket/交易接口”是两套完全不同的权限面。ShadowBroker 主要做公开读，不是交易客户端。

## 11. 无线电、社区接收网络和本地软件入口

| 来源/设备 | 数据链路 | 交互方式 | 免费/设备/多点判断 |
|---|---|---|---|
| [KiwiSDR](https://kiwisdr.com/) | 公共接收机目录 → 用户打开远端调谐界面/音频 | 目录 HTTP 抓取约 5 分钟；音频交互实时 | 使用公开站通常免费、无 SLA；无需自有设备 |
| [OpenMHz](https://openmhz.com/) | 公共 trunked radio 系统 → 录音/API | HTTP/API/媒体 | 覆盖有限；注意当地监听和隐私法律 |
| [Meshtastic 公共地图 API](https://meshtastic.liamcottle.net/) | 聚合节点目录 | HTTP JSON，每日一次并加 0–180 分钟抖动 | 无 Key；无需设备 |
| [Meshtastic 公共 MQTT](https://meshtastic.org/docs/software/integrations/mqtt/) | `mqtt.meshtastic.org:1883` → Topic 订阅 | MQTT v3.1.1 长连接，默认关闭 | 公共 Broker；无需设备。自建私有覆盖才需 LoRa 节点 |
| [APRS-IS](https://www.aprs-is.net/) | 全球 APRS 聚合 → `rotate.aprs2.net:14580` | 原始 TCP 长连接；接收可用 `N0CALL` | 接收不需设备；发送需合法呼号/passcode并遵守业余无线电规则 |
| [PSKReporter](https://www.pskreporter.info/) | 数字模式接收报告与传播观测 | `retrieve.pskreporter.info/query` HTTP 查询；慢层约 5 分钟 | 公共查询；发送报告通常由电台解码软件完成 |
| [JS8Call](https://js8call.com/) 本地软件 | 电台/声卡 → JS8Call 解码 → 本地 API | ShadowBroker 连 `127.0.0.1:2442` 原始 TCP，接收 JSON Line | 必须在同机/局域网运行 JS8Call 并启用 API；收发硬件取决于研究目标 |

三种“设备”不能混为一谈：

1. 使用聚合官网：不需要设备，例如 APRS-IS、PSKReporter、KiwiSDR 目录。
2. 本地软件桥：需要另一个程序，例如 JS8Call API，但 ShadowBroker 本身不直接控制射频。
3. 自有接收节点：需要天线、SDR/LoRa、电源和网络，例如本地 AIS、ADS-B feeder、Meshtastic 节点。

## 12. 列车与交通摄像头入口

列车入口包括 Amtrak 公共/非正式位置接口、芬兰 DigiTraffic 官方 REST，以及新加坡 LTA DataMall。后端快层约 60 秒拉取列车；摄像头目录由独立流水线约 10 分钟刷新。

### 21 个摄像头目录

| 目录 | 国家/地区 | 目录协议 | Key | 用户点击后的媒体交互 |
|---|---|---|---|---|
| TfL JamCam | 英国伦敦 | REST JSON | 否 | 图片/视频经后端代理 |
| Singapore LTA | 新加坡 | REST JSON | `LTA_ACCOUNT_KEY` | 图片 URL |
| Austin TX | 美国 | Socrata/REST | 通常否 | 图片 |
| NYC DOT | 美国 | 公开目录/REST | 否 | 图片/流 |
| Caltrans | 美国 | 公开目录/HTML/XML | 否 | 图片 |
| Colorado DOT | 美国 | 公开目录/API | 否 | 图片 |
| WSDOT | 美国 | REST/API | 依接口 | 图片 |
| Georgia DOT | 美国 | 公开目录/API | 否 | 图片 |
| Illinois DOT | 美国 | 公开目录/API | 否 | 图片 |
| Michigan DOT | 美国 | 公开目录/API | 否 | 图片 |
| Windy Webcams | 全球 | REST JSON | `WINDY_API_KEY` | 有时效的图片 URL |
| Spain DGT | 西班牙 | KML/目录 | 否 | 图片/视频 |
| Madrid City | 西班牙马德里 | 开放数据目录 | 否 | 图片 |
| OSM traffic camera | 全球 | Overpass QL | 否 | OSM 标签中的媒体/站点链接 |
| ASFINAG | 奥地利 | 公开目录/API | 否 | 图片/流 |
| OSM ALPR camera | 全球 | Overpass QL | 否 | 元数据为主 |
| Ontario 511 | 加拿大 | ArcGIS/511 API | 否 | 图片 |
| Alberta 511 | 加拿大 | 511 API | 否 | 图片 |
| Florida 511 | 美国 | 511 API/目录 | 否 | 图片 |
| Australia LiveTraffic | 澳大利亚 | 政府交通 API | 否 | 图片 |
| Rijkswaterstaat/NDW | 荷兰 | 遗留目录接口 | 否 | 代码注明旧入口经常下线/退役 |

这里发生两次交互：后端先抓“相机 ID、位置、媒体 URL”等目录元数据；用户点击后，浏览器或后端代理再获取 JPEG、MJPEG、HLS 或嵌入页。项目代理会补某些机构要求的 `Referer/Origin`，但这不改变上游授权条件。

## 13. 地图底图和浏览器直接外联

| 来源 | 作用 | 交互 | 风险点 |
|---|---|---|---|
| CARTO/OSM | 暗色街道底图 | 浏览器按视野直接请求 raster tiles | 第三方可看到用户 IP、视野与访问时间；必须显示署名 |
| MapLibre demo tiles | 默认/演示地图资源 | 浏览器请求样式和瓦片 | 不应默认当高流量生产 CDN |
| Esri World Imagery | 卫星底图 | 浏览器瓦片请求 | 可视化权利不代表允许批量下载再分发 |
| NASA GIBS | MODIS 等科学图层 | WMTS/瓦片 | 需要科学数据署名 |
| RainViewer | 雷达覆盖层 | 时间轴 JSON + 瓦片 | 免费条款要求可见署名、无 SLA |
| Mapbox Tilequery（可选） | NUFORC 坐标补全 | Token REST | 需要 `NUFORC_MAPBOX_TOKEN`，按 Mapbox 套餐计费 |

如果要求“所有请求只从服务端发出”，必须自建合法的瓦片/媒体代理与缓存；默认前端不是这种隐私模型。

## 14. 真实调度节奏

| 调度层 | 上游代码默认 |
|---|---|
| 快层 | 航班、军机、船舶、卫星、SIGINT、列车约 60 秒 |
| 慢层 | 新闻、地震、FIRMS、天气、网络、摄像头缓存、无线电目录、基础设施、恶意软件等约 5 分钟 |
| 特殊 | alerts.in.ua 2 分钟；Telegram 1 小时；GDELT/LiveUAMap 30 分钟；金融 30 分钟；预测市场约 7 分钟并加抖动 |
| 低频 | 航线/飞机元数据约 5 天；Meshtastic 公共地图每日并加抖动；NUFORC 每周；WastewaterSCAN/CrowdThreat 每日 |
| 遥感 | VIIRS 12 小时；Sentinel 趋势 24 小时；SAR 目录 1 小时、产品 30 分钟且需显式开启 |

“实时”因此应拆成四个时间：`observed_at`（传感器观测）、`published_at`（上游发布）、`fetched_at`（本项目抓取）、`rendered_at`（用户看到）。只看 60 秒定时器会误判数据新鲜度。

## 15. 入口优先级：你应该先研究什么

| 优先级 | 入口 | 原因 |
|---|---|---|
| P0 | USGS GeoJSON、CelesTrak TLE、RSS、OurAirports CSV | 零 Key，分别覆盖 API、轨道计算、Feed、批量文件四种基础模式 |
| P0 | AISStream WebSocket、APRS-IS TCP、Meshtastic MQTT | 三种长连接协议的典型样本 |
| P1 | OpenSky OAuth2、OpenAQ API Key、Copernicus OAuth/STAC | 学习认证、Token、限流与空间数据目录 |
| P1 | 摄像头 REST/KML/ArcGIS/Overpass + 媒体代理 | 同一业务下的多协议适配非常有研究价值 |
| P1 | 本地 AIS POST、JS8Call TCP | 学习设备/边缘软件怎样进入中心系统 |
| P2 | GDELT、Telegram、NUFORC | 学习网页/批量数据的解析、去重、溯源与误报 |
| P3 | LiveUAMap 自动化、付费/高风险源 | 维护成本和条款风险高，不宜作为公共源研究起点 |

## 16. 每个来源的标准“入口卡”

后续把来源做成独立实验时，每张卡至少记录：

```text
source_id / 官网 / 文档 / 机器端点
数据拥有者与原始传感器是谁
协议、方法、认证头、分页或订阅条件
免费条件、商业限制、署名和再分发权
默认启用与否、轮询频率、上游真实延迟
坐标系、时间字段、唯一键、删除/修订语义
超时、429、断线、指数退避、缓存和熔断
observed_at / published_at / fetched_at
原始响应哈希与标准化映射版本
是否需要本地设备、设备覆盖半径、节点身份
最后成功验证日期和已知故障
```

机器可读台账包括 `data/source-catalog.csv`、`data/default-rss-feeds.csv` 和 `data/cctv-providers.csv`；部署选择见 `docs/deployment-assessment.md`。
