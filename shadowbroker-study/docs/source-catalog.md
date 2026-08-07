# ShadowBroker 数据源、接入方式与免费状态总表

> 审计日期：2026-08-07  
> 主要依据：[ShadowBroker 数据源表](https://github.com/BigBodyCobain/Shadowbroker#-data-sources--apis)、[环境变量样例](https://github.com/BigBodyCobain/Shadowbroker/blob/main/.env.example)、[数据署名与许可](https://github.com/BigBodyCobain/Shadowbroker/blob/main/DATA-ATTRIBUTION.md)、[外部连接审计](https://github.com/BigBodyCobain/Shadowbroker/blob/main/docs/OUTBOUND_DATA.md)

本页是快速总表。按源码提交 `8676a98945a31503180bc84f7c9dd092a3cc743d` 扫描得到的补充来源、22 个默认 RSS、21 个摄像头目录、具体机器入口和协议交互，见[完整来源入口手册](source-entry-guide.md)。

## 1. 先看结论

ShadowBroker 的来源可分为六种接入模式：

| 模式 | 原理 | 是否真正实时 | 是否需要多点部署 |
|---|---|---:|---:|
| REST/JSON/GeoJSON API | 后端定时发起 HTTP 请求 | 否，属于轮询 | 否 |
| WebSocket/TCP/MQTT | 保持长连接，接收连续消息 | 是或接近实时 | 默认否，上游已聚合多点数据 |
| HTML/RSS/浏览器抓取 | 解析公开网页、RSS 或动态页面 | 否 | 否 |
| 静态文件/数据库 | 下载 CSV、GeoJSON、KML 或项目内置数据 | 否 | 否 |
| 本地推导计算 | 用 TLE、ADS-B、新闻等原始数据计算轨道、风险或估算位置 | 展示可实时，但源不实时 | 否 |
| 本地硬件采集 | SDR、AIS、Meshtastic 等设备接收无线电信号 | 是 | 仅在需要自有地域覆盖时需要 |

免费等级：`A` 公开免费；`B` 免费注册/免费密钥；`C` 免费额度+付费扩展；`D` 付费或需单独确认；`E` 接口免费但需要硬件成本。

## 2. 航空

| 来源 | 数据 | 项目接入方式 | 更新 | 密钥 | 免费 | 多点/设备 | 重要限制 |
|---|---|---|---:|---:|---:|---|---|
| [OpenSky Network](https://opensky-network.org/) | 民航、私人飞机状态 | OAuth2 REST API 轮询 | ~60 秒 | 是 | B/D | 不需要 | 免费账户有频率限制；官方条款把自动化运营式 REST 接入和商业使用列为需书面许可，个人研究也应核对用途 |
| [adsb.lol](https://adsb.lol/) | 军机及区域航班补充 | 公开 HTTP/JSON API | ~60 秒 | 否 | A | 不需要 | ODbL，需保留署名；覆盖取决于全球志愿接收站 |
| [Airframes.io](https://airframes.io/) | ACARS/VDL 航空通信、飞机档案 | API 按需查询 | 按需 | 是 | C/D | 不需要 | 可选能力；额度和商业条件需在账户控制台确认 |
| 项目静态飞机名单 | 私人飞机所有者、特殊关注飞机 | 本地文件和 ICAO/MMSI 规则匹配 | 随版本 | 否 | A | 不需要 | 名单可能过期，不能等同实时观测 |
| GPS 干扰推断 | NAC-P 定位精度异常区 | 从 ADS-B 观测派生、聚合计算 | ~60 秒 | 随上游 | 派生 | 不需要 | 不是独立观测源，只是异常推断 |

代码入口：`backend/services/fetchers/flights.py`、`backend/services/fetchers/military.py`。

## 3. 船舶与海洋

| 来源 | 数据 | 项目接入方式 | 更新 | 密钥 | 免费 | 多点/设备 | 重要限制 |
|---|---|---|---:|---:|---:|---|---|
| [AISStream](https://aisstream.io/documentation) | AIS 船位、航向、船舶消息 | WSS WebSocket 长连接 | 实时 | 是 | B | 不需要 | 免费注册生成 Key；仍处于 Beta，无 SLA；全球覆盖来自第三方接收网络 |
| [Global Fishing Watch](https://globalfishingwatch.org/our-apis/) | 捕鱼、靠港、相遇等事件 | Bearer Token REST API | ~1 小时 | 是 | B | 不需要 | 免费 Key，官方 API 限非商业用途并要求署名；项目使用 v3 API |
| 本地 AIS Receiver | 本地海域船位 | RTL-SDR + AIS-catcher，HTTP POST 到 `/api/ais/feed` | 约 10 秒 | 否 | E | 可选设备 | 需要 SDR、VHF 天线；单点通常覆盖几十海里，多地区自有覆盖才需要多点部署 |
| 航母/军舰估算 | 军舰、航母位置线索 | AIS、静态 MMSI、GDELT/新闻交叉匹配 | 不定 | 混合 | 派生 | 不需要 | 部分位置是估算，不是官方/直接观测 |

代码入口：`backend/services/ais_stream.py`、`backend/services/fetchers/geo.py`、`backend/services/carrier_tracker.py`。

## 4. 卫星、遥感与地球观测

| 来源 | 数据 | 项目接入方式 | 更新 | 密钥 | 免费 | 多点/设备 | 重要限制 |
|---|---|---|---:|---:|---:|---|---|
| [CelesTrak](https://celestrak.org/) | 卫星 TLE 轨道参数 | HTTP 下载 TLE，本地 SGP4 传播计算 | 位置约 60 秒重算 | 否 | A | 不需要 | 动画位置来自本地计算；TLE 本身不是逐秒遥测 |
| [SatNOGS](https://satnogs.org/) | 业余卫星地面站 | API 轮询 | ~30 分钟 | 否 | A | 不需要 | 使用公共接收站聚合；自己不必部署地面站 |
| [TinyGS](https://tinygs.com/) | LoRa 卫星地面站 | API 轮询 | ~30 分钟 | 否 | A | 不需要 | 依赖社区节点覆盖 |
| [NASA GIBS](https://gibs.earthdata.nasa.gov/) | MODIS 每日卫星图层 | WMTS/地图瓦片 | 每日，约 24–48 小时延迟 | 否 | A | 不需要 | 不是实时卫星影像 |
| [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/docs) | Sentinel-2 等场景目录 | STAC API 按需检索，签名资产 URL | 按需 | 否 | A | 不需要 | 公开数据免费，需遵守各数据集许可和云端访问策略 |
| [Copernicus Data Space](https://dataspace.copernicus.eu/) | Sentinel-2、Process API、部分 SAR | OAuth2/STAC/Process API | 按需 | 是 | B/C | 不需要 | 免费注册并有配额；高计算量和特定商业服务可能受限 |
| [ASF Search](https://search.asf.alaska.edu/) | SAR 场景目录 | 搜索 API | 按需 | 目录通常否 | A/B | 不需要 | 下载部分产品可能需要 Earthdata 登录 |
| NASA OPERA / EGMS / GFM / EMS / UNOSAT | 地表变化、洪水、形变、灾损产品 | 官方产品目录、文件或 API | 产品发布周期 | 视源而定 | A/B | 不需要 | 多为延迟产品，不是实时原始雷达流 |
| VIIRS Nightlights | 夜间灯光及变化 | 静态数据或 Google Earth Engine | 日/月级 | 可选 | A/C | 不需要 | Earth Engine 非商业研究通常可用，商业和高用量条件不同 |

代码入口：`backend/services/fetchers/satellites.py`、`backend/services/sentinel_search.py`、SAR 相关服务目录。

## 5. 灾害、环境、天气与基础设施

| 来源 | 数据 | 项目接入方式 | 更新 | 密钥 | 免费 | 多点/设备 | 重要限制 |
|---|---|---|---:|---:|---:|---|---|
| [USGS Earthquake](https://earthquake.usgs.gov/earthquakes/feed/) | 全球地震 | GeoJSON Feed 轮询 | ~60 秒 | 否 | A | 不需要 | 美国联邦公共数据；仍应保留来源说明 |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) | 火点、热异常 | CSV/API；部分国家范围增强使用 MAP_KEY | ~120 秒 | 可选/部分需要 | A/B | 不需要 | 免费 MAP_KEY；卫星过境、云层和误报影响时效与精度 |
| [Smithsonian GVP](https://volcano.si.edu/) | 火山目录 | 静态数据下载/缓存 | 静态 | 否 | A | 不需要 | 历史目录，不是实时喷发遥测 |
| [OpenAQ](https://docs.openaq.org/) | 空气质量 | v3 REST API | ~120 秒 | 当前需要 | B/C | 不需要 | 项目 README 写“无需 Key”，但官方 v3 当前要求免费 API Key；免费配额为 60/分钟、2,000/小时 |
| NOAA/NWS | 恶劣天气警报和多边形 | 官方 JSON/GeoJSON API | ~120 秒 | 否 | A | 不需要 | 主要覆盖美国及相关区域 |
| [NOAA SWPC](https://services.swpc.noaa.gov/) | Kp 指数、太阳活动 | JSON Feed 轮询 | ~120 秒 | 否 | A | 不需要 | 公共数据 |
| [IODA](https://ioda.inetintel.cc.gatech.edu/) | 区域互联网中断 | API 轮询 | ~120 秒 | 否 | A/B | 不需要 | 学术服务，覆盖和可用性可能变化 |
| [WRI Global Power Plant Database](https://datasets.wri.org/) | 全球发电厂 | 静态数据集缓存 | 随数据版本 | 否 | A | 不需要 | CC BY，需署名 |
| 军事基地数据集 | 全球军事设施 | 项目内置/静态开源数据 | 随版本 | 否 | A/不明 | 不需要 | 多来源、更新与准确度不统一，应逐文件追踪来源 |
| [DC Map](https://github.com/dcmap) | 数据中心位置 | GitHub 数据集，缓存约 7 天 | 周期 | 否 | A | 不需要 | 仓库与数据许可需要逐项核对 |
| TeleGeography 派生数据 | 海底光缆路线 | 项目静态 GeoJSON | 静态 | 否 | A/不明 | 不需要 | “公开可见”不等于可自由再分发，需核对数据许可 |

代码入口：`backend/services/fetchers/earth_observation.py`、`backend/services/fetchers/infrastructure.py`。

## 6. 冲突、新闻与公开社交信息

| 来源 | 数据 | 项目接入方式 | 更新 | 密钥 | 免费 | 多点/设备 | 重要限制 |
|---|---|---|---:|---:|---:|---|---|
| [GDELT](https://www.gdeltproject.org/) | 全球新闻和事件 | API/批量数据下载、地理事件解析 | ~30 分钟 | 否 | A | 不需要 | 事件可能重复或分类错误，需回到原始报道验证；单轮会下载多批 ZIP |
| [DeepState Map](https://deepstatemap.live/) | 乌克兰前线 | GeoJSON/镜像仓库抓取 | ~30 分钟 | 否 | A/条款约束 | 不需要 | 项目支持固定镜像 commit；来源立场和许可需注意 |
| Telegram 公共预览 | 公开频道帖子 | 抓取 `t.me/s/<channel>` HTML，不使用 Bot Token | ~1 小时 | 否 | A/条款约束 | 不需要 | 页面结构可能变化；文本地理编码属于推断；只处理公开频道 |
| LiveUAMap | 地区事件 | Playwright + stealth 抓取动态网页 | 图层启用时 | 否 | D/条款风险 | 不需要 | Windows 默认要求用户同意；规避 Turnstile 有明显服务条款和稳定性风险，建议关闭 |
| RSS/Atom 新闻源 | 新闻与公告 | feedparser 定时抓取 | 分钟到小时 | 否 | A/按源 | 不需要 | 每个新闻源许可不同；正文和摘要不可默认再分发 |
| alerts.in.ua | 乌克兰空袭警报 | Token API | 实时/准实时 | 是 | B | 不需要 | 免费 Token，需遵守服务条款 |

代码入口：`backend/services/geopolitics.py`、`backend/services/fetchers/news.py`、`backend/services/fetchers/telegram_osint.py`、`backend/services/liveuamap_scraper.py`。

## 7. 网络安全与侦察

| 来源 | 数据 | 项目接入方式 | 更新 | 密钥 | 免费 | 多点/设备 | 重要限制 |
|---|---|---|---:|---:|---:|---|---|
| [Shodan](https://developer.shodan.io/api/requirements) | 联网设备、端口、Banner | REST API 按需查询 | 按需 | 是 | C | 不需要 | 免费账户可生成 Key，但完整搜索、更多页、流式能力与额度可能需要会员/订阅；只查询合法授权目标 |
| [OpenSanctions](https://www.opensanctions.org/) | OFAC SDN 制裁实体 | 下载索引，本地缓存约 24 小时 | 日级 | 否 | A/按数据集 | 不需要 | 项目使用 `us_ofac_sdn`；需保留数据集署名 |
| [abuse.ch Feodo/URLhaus](https://abuse.ch/) | 恶意 C2、恶意 URL | Feed/API 轮询 | ~5 分钟 | 否 | A | 不需要 | 威胁情报有误报和过期问题 |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | 已知被利用漏洞 | 官方 JSON/CSV Feed | ~5 分钟 | 否 | A | 不需要 | “已利用”不等于当前环境一定受影响 |
| [ip-api.com](https://ip-api.com/) | IP 地理位置 | REST API 按需 | 按需 | 否/高级版需要 | C | 不需要 | 免费接口有速率及非商业/协议限制，生产使用需核对方案 |
| [Google Public DNS](https://developers.google.com/speed/public-dns/docs/doh) | DNS 记录 | DNS-over-HTTPS | 按需 | 否 | A | 不需要 | 查询会暴露给 Google DNS |
| [RDAP.org](https://about.rdap.org/) | 域名/IP 注册信息 | RDAP REST API | 按需 | 否 | A | 不需要 | 会重定向到权威 RDAP 服务，字段完整性因注册局而异 |
| [crt.sh](https://crt.sh/) | 证书透明度、子域名 | HTTP/JSON 查询 | 按需 | 否 | A | 不需要 | 非正式高可用 API，无 SLA，需缓存和限速 |
| [BGPView](https://bgpview.io/) | ASN、前缀和路由 | REST API | 按需 | 否 | A | 不需要 | 公共服务无商业 SLA |
| AlienVault OTX | 威胁脉冲和信誉 | API 按需 | 按需 | 可选 | B | 不需要 | 免费账户/Key；结果需结合上下文 |
| MITRE CVE / Tor 列表 / GitHub | 漏洞、出口节点、公开账户信息 | 官方 API/公开列表 | 按需/周期 | 通常否或免费 Key | A/B | 不需要 | GitHub 高配额需 Token；遵守个人信息和平台条款 |

代码入口：`backend/services/osint/lookups.py`、`backend/services/shodan_connector.py`、`backend/services/sanctions/ofac.py`、`backend/services/fetchers/malware.py`、`backend/services/fetchers/cyber_status.py`。

## 8. 交通摄像头、列车与无线电

| 来源 | 数据 | 项目接入方式 | 更新 | 密钥 | 免费 | 多点/设备 | 重要限制 |
|---|---|---|---:|---:|---:|---|---|
| ASFINAG | 奥地利公路摄像头 | 公开目录/API 抓取 | ~10 分钟 | 否 | A/条款约束 | 不需要 | 流地址和页面结构可能变化 |
| Amtrak | 美国列车位置 | 公共接口轮询 | ~60 秒 | 否 | A/条款约束 | 不需要 | 非正式接口可能变化 |
| DigiTraffic | 芬兰/欧洲列车位置 | 官方 REST API | ~60 秒 | 否 | A | 不需要 | 依具体开放许可署名 |
| TfL、NYC DOT、TxDOT、Caltrans、WSDOT、GDOT、IDOT、MDOT | 英美交通摄像头 | API、XML/KML、HTML 目录；后端代理图片/视频 | ~10 分钟 | 通常否 | A/按机构 | 不需要 | 不同机构条款不同；项目会设置机构要求的 Referer/Origin |
| Spain DGT、Madrid City | 西班牙交通摄像头 | KML/目录抓取、后端代理 | ~10 分钟 | 否 | A/条款约束 | 不需要 | 项目采用 HTTPS 优先，但视频源仍可能变化 |
| [Singapore LTA DataMall](https://datamall.lta.gov.sg/) | 新加坡交通摄像头 | AccountKey REST API | ~10 分钟 | 是 | B | 不需要 | 免费注册；官方条款当前日调用阈值很高，但可调整 |
| [Windy Webcams](https://api.windy.com/webcams/pricing) | 全球摄像头 | API Key REST API | ~10 分钟 | 是 | B/C | 不需要 | 免费方案限制图片尺寸、URL 有效期和最大 offset；完整列表/无广告为专业付费方案 |
| [KiwiSDR](https://kiwisdr.com/) | 公共短波接收机目录与实时调谐 | 目录抓取约 30 分钟；用户打开远端接收机 | 目录周期/音频实时 | 否 | A/社区 | 不需要 | 使用他人公共接收机，容量和可用性不保证 |
| [OpenMHz](https://openmhz.com/) | 部分警消扫描内容 | API/音频流 | 实时 | 否 | A/条款约束 | 不需要 | 地区覆盖有限；注意当地法律和隐私规则 |
| [Meshtastic](https://meshtastic.org/) | 公共 Mesh 节点位置 | 公共 MQTT 订阅，默认应主动启用 | 实时 | 否 | A | 默认不需要 | 公共射频/MQTT 数据不是私密通信；自己部署节点仅用于自有覆盖 |
| [APRS-IS](https://www.aprs-is.net/) | 业余无线电位置 | TCP 长连接 | 实时 | 通常否 | A | 不需要 | 全球聚合网络；遵守业余无线电与呼号使用规则 |

代码入口：`backend/services/cctv_pipeline.py`、`backend/services/fetchers/trains.py`、`backend/services/radio_intercept.py`、`backend/services/kiwisdr_fetcher.py`、`backend/services/fetchers/sigint.py`。

## 9. 地理背景、实体关系和地图

| 来源 | 数据 | 项目接入方式 | 更新 | 密钥 | 免费 | 多点/设备 | 重要限制 |
|---|---|---|---:|---:|---:|---|---|
| [RestCountries](https://restcountries.com/) | 国家人口、语言等 | REST API，缓存 24 小时 | 按需 | 否 | A | 不需要 | 社区服务，无生产 SLA |
| [Wikidata SPARQL](https://query.wikidata.org/) | 国家元首、实体关系 | SPARQL，缓存 24 小时 | 按需 | 否 | A | 不需要 | CC0；公共端点要求限速 |
| [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) | 地区摘要、图片 | MediaWiki API | 按需 | 否 | A | 不需要 | 内容多为 CC BY-SA，需署名和遵守再利用条款 |
| [OSM Nominatim](https://operations.osmfoundation.org/policies/nominatim/) | 地名地理编码 | HTTP API | 按需 | 否 | A | 不需要 | 公共服务通常限制约 1 请求/秒，必须提供有效 User-Agent；不可用于大规模批量地理编码 |
| [CARTO Basemaps](https://carto.com/basemaps/) | 暗色地图瓦片 | 浏览器直接加载 CDN 瓦片 | 连续 | 否 | A/C | 不需要 | 服务商可看到客户端 IP 和浏览范围；需要保留 OSM/CARTO 署名 |
| [Esri World Imagery](https://www.arcgis.com/) | 高分辨率卫星底图 | 浏览器地图瓦片 | 周期更新 | 否 | A/条款约束 | 不需要 | 可视化服务不等于允许批量下载或再分发 |

代码入口：`backend/services/region_dossier.py`、`backend/services/osint_intel/resolve.py`、前端 MapLibre 样式文件。

## 10. 当前需要重点复核的差异

| 项目 | ShadowBroker 当前说明 | 当前官方情况 | 研究判断 |
|---|---|---|---|
| OpenAQ | 来源表标为无需 Key | v3 API 要求免费注册和 `X-API-Key` | 运行时可能出现空图层或 401；需要检查项目是否已经通过其他代理/旧路径兼容 |
| OpenSky | `.env.example` 称免费注册 | 官方条款对自动化运营式 REST 集成和商业用途限制更严格 | 本地教育研究可先小规模验证，但长期自动运行前应确认授权 |
| Windy Webcams | 项目写免费 Key | 免费方案存在 offset、图片尺寸和 URL 时效限制 | 可以演示，不能假定能免费拉取完整全球目录 |
| Shodan | 免费账户可得 API Key | 高级搜索、更多结果和流式能力依赖 Credits/会员 | 免费 Key 只适合有限实验 |
| LiveUAMap | 可通过浏览器自动化获取 | 项目使用 Playwright + stealth 处理 Turnstile | 技术上可用但维护与条款风险高，不建议作为首轮研究源 |

## 11. 多点部署判断

### 默认不需要

OpenSky、adsb.lol、AISStream、SatNOGS、TinyGS、APRS-IS、Meshtastic 公共 MQTT 等服务已经聚合了全球各地的传感器或志愿接收站。一台 ShadowBroker 后端只需连接这些上游。

### 只有以下目标才需要多点部署

1. 建立不依赖公共聚合商的自有数据源。
2. 获得某个港口、机场或地区更低延迟、更完整的无线电覆盖。
3. 在多个地理位置部署 SDR/AIS/Meshtastic 边缘节点。
4. 需要断网缓存、专网传输、节点认证和中心汇聚。

ShadowBroker 明确支持的本地设备链路主要是：

```text
VHF 天线 → RTL-SDR → AIS-catcher → HTTP POST /api/ais/feed → ShadowBroker
```

InfoNet/Wormhole 的多节点属于实验通信与同步层，不是飞机、船舶、地震等核心数据图层的必要条件。

## 12. 推荐接入顺序

### 第一批：零密钥验证

- adsb.lol
- CelesTrak
- USGS
- GDELT
- NASA GIBS
- NOAA/NWS、NOAA SWPC
- RestCountries、Wikidata、Wikipedia
- 静态基础设施

### 第二批：免费注册

- AISStream
- Global Fishing Watch
- NASA FIRMS MAP_KEY
- Copernicus Data Space
- OpenAQ v3
- Singapore LTA
- Windy Webcams 免费方案

### 第三批：授权或成本风险较高

- OpenSky 自动化长期使用
- Shodan 高级搜索
- Airframes.io
- Google Earth Engine 高用量/商业用途
- LiveUAMap 自动化抓取

### 第四批：本地硬件

- RTL-SDR + AIS-catcher
- 私有 Meshtastic 节点
- 自建地图瓦片、缓存和边缘采集节点

## 13. 正式接入每个来源时还要记录

```text
source_id
官方地址和文档地址
负责人/维护组织
数据许可证和商业限制
认证方式和密钥位置
接口协议及示例请求
分页、配额、超时和重试策略
更新频率与数据延迟
原始格式和统一模型映射
published_at / observed_at / fetched_at
去重键、过期策略和缓存 TTL
失败后的备用源
原始响应留存方式
数据质量与置信度
最后验证日期
```

## 14. 当前本机运行条件

| 项目 | 当前状态 | 判断 |
|---|---|---|
| Node.js | v22.15.0 | 满足 Node.js 18+ |
| Python | 3.10.11 | 属于项目支持版本 |
| Docker Desktop | 未安装 | 暂不能使用推荐的 Compose 镜像方案 |
| 端口 3000/8000 | ShadowBroker 正在监听 `127.0.0.1` | 已完成前后端 HTTP 200 验证 |
| 后端内存 | 项目默认上限 4GB | 建议整机至少 8GB 内存，并为首次缓存预留空间 |

当前结论是“已完成源码依赖安装、前后端启动、简体中文界面和主要图层实际验证”；具体结果见[本地部署与实际效果报告](local-deployment-report.md)。
