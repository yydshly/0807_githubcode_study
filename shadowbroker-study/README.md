# ShadowBroker 来源与接入研究

> 审计日期：2026-08-07  
> 上游项目：[BigBodyCobain/Shadowbroker](https://github.com/BigBodyCobain/Shadowbroker)
> 阶段状态：研究完成，作为“信息获取与展示类产品”参考案例归档

本目录用于研究 ShadowBroker 的数据来源、接入协议、免费条件、实时性、设备依赖与多点部署要求。

## 当前结论

- ShadowBroker 已在当前电脑以源码方式运行成功：本机 Node.js 22、Python 3.10，前端和后端依赖已安装。
- 当前本地地址为 [http://127.0.0.1:3000](http://127.0.0.1:3000)，后端健康接口为 [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)。
- 当前未安装 Docker Desktop，因此暂时不能直接使用官方推荐的 Docker Compose 方案。
- 核心地图不要求多点部署；一台电脑可以消费 OpenSky、AISStream、USGS、NASA、GDELT 等上游聚合服务。
- 真正的实时输入主要是 AIS WebSocket、APRS TCP、Meshtastic MQTT 和音视频流；大量图层只是 60 秒到数小时的轮询。
- 本地设备是可选增强能力。项目明确支持通过 RTL-SDR + AIS-catcher 接入本地船舶 AIS 数据。
- “无需 API Key”不等于“可无限免费使用”。一些服务要求注册、限制非商业用途、限制频率或禁止生产式自动化。
- 项目说明与服务现状可能不同。例如 ShadowBroker 的来源表把 OpenAQ 标为无需密钥，但 OpenAQ v3 当前要求免费 API Key。

## 研究资料

- [阶段研究总结与最终处理建议](docs/stage-summary.md)
- [整个项目对你的研究价值与值得复用的技术路线](docs/technical-routes-and-research-value.md)
- [P0–P2 技术路线逐项整理、依赖关系与实施里程碑](docs/p0-p2-technical-route-guide.md)
- [覆盖面归档](docs/coverage-archive.md)
- [项目作用与数据可靠性边界](docs/project-role-and-reliability.md)
- [本地部署与实际效果报告](docs/local-deployment-report.md)
- [完整来源入口手册：官网、作用、协议、抓取方式、设备与交互](docs/source-entry-guide.md)
- [数据源、接入方式与免费状态总表](docs/source-catalog.md)
- [是否需要部署及后续深入研究评估](docs/deployment-assessment.md)
- [机器可读 CSV 清单](data/source-catalog.csv)
- [22 个默认 RSS 的机器清单](data/default-rss-feeds.csv)
- [21 个摄像头入口的机器清单](data/cctv-providers.csv)

本地的 `upstream/` 是只用于核对实现的上游源码快照，不纳入本研究仓库版本控制。当前核对基线为 ShadowBroker 提交 `8676a98945a31503180bc84f7c9dd092a3cc743d`（2026-08-05，v0.9.84）。

## 免费等级

| 等级 | 含义 |
|---|---|
| A | 公开免费，通常无需账户；仍需遵守频率、署名和再分发条款 |
| B | 免费注册或免费申请密钥，有配额或用途限制 |
| C | 有免费额度，但完整能力、较高配额或商业用途可能收费 |
| D | 商业/付费为主，或当前价格与授权条件需要单独确认 |
| E | 数据接口本身免费，但需要自购硬件、带宽或部署节点 |

## 当前本地运行边界

本次运行只启用公共只读数据源，并关闭实验网络：

```env
MESH_INFONET_FLEET_JOIN=false
MESH_INFONET_FLEET_JOIN_DISABLED=true
MESH_BOOTSTRAP_DISABLED=true
MESH_NODE_MODE=perimeter
MESH_INFONET_RELAY_AUTO_WORMHOLE_DISABLED=true
MESH_PRIVACY_PREWARM_ENABLE=false
MESH_MQTT_ENABLED=false
SHADOWBROKER_ENABLE_LIVEUAMAP_SCRAPER=false
GT_ANALYTICS_ENABLED=false
PREDICTION_MARKETS_ENABLED=false
FIMI_ENABLED=false
CROWDTHREAT_ENABLED=false
```

先验证地震、卫星、军机、天气、静态基础设施等免费图层，再逐项申请 OpenSky、AISStream、GFW、FIRMS、Copernicus 等密钥。

## 范围说明

清单中的免费状态依据上游项目文档和服务商公开页面整理，不构成法律意见。服务商可能随时调整价格、配额和服务条款；实际接入前应再次核对官方文档。
