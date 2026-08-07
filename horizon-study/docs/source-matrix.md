# Horizon 信息源与抓取方式清单

## 结论

截至审计提交，代码中的 `SourceType` 和 `SOURCE_REGISTRY` 注册了 10 类信息源。Twitter/X 有两种实现，因此实际是 11 条采集路径。上游 README 只列出其中 7 类，`docs/scrapers.md` 也没有覆盖全部新实现；判断能力边界时应以 `src/models.py`、`src/orchestrator.py` 和 `src/scrapers/` 为准。

## 抓取方式分类

| 方式 | 对应来源 | 特点 |
|---|---|---|
| 正式公开 API | Hacker News、GitHub、OSS Insight、GDELT | 结构化程度高；仍受限流、字段变化和时间窗口影响 |
| RSS/Atom | 通用 RSS、Google News RSS | 成本低、稳定、无需登录；正文常只是摘要 |
| 公开网页 HTML 解析 | Reddit 主路径、Telegram | 不需要密钥，但容易受页面结构和反爬变化影响 |
| JSON/RSS 降级路径 | Reddit | old.reddit HTML 失败后尝试 JSON，再以 RSS 补救帖子列表 |
| 托管抓取服务 | Twitter/X Apify 模式 | 相对省维护，但需要 Token、消耗额度并依赖第三方 Actor |
| 浏览器自动化与网络拦截 | Twitter/X Playwright 模式 | 使用登录 Cookie，拦截页面 GraphQL 响应；维护和账号风险较高 |
| 聚合 SDK | OpenBB | 由 OpenBB 再连接 yfinance、Benzinga 等金融数据提供方 |
| 二次正文提取 | RSS + Trafilatura | 抓取文章 HTML 并提取正文，失败时回退到 Feed 摘要 |

## 逐项清单

| 信息源 | 入口和抓取实现 | 认证/依赖 | 抓取内容 | 评论 | 主要限制 |
|---|---|---|---|---|---|
| Hacker News | Firebase HN API：`/topstories.json`、`/item/{id}.json` | 无 Key | 标题、链接、作者、分数、评论数、发布时间 | 前 5 条有效评论，单条截断 500 字符 | 只从 Top Stories 开始，先天不是 HN 全量 |
| GitHub | REST API：`/users/{user}/events/public`、`/repos/{owner}/{repo}/releases` | Token 可选；无 Token 约 60 请求/小时，有 Token 通常 5000/小时 | Push/Create/Release/Public/Watch 事件或仓库 Release | 无 | 只支持公开用户事件与 Release，不是仓库全量审计 |
| RSS/Atom | `httpx` 下载 Feed，`feedparser` 解析 | 通常无；私有 Feed 可通过环境变量注入 URL | 标题、链接、作者、Feed 摘要/正文、标签、日期 | 无 | 日期字段和正文完整度取决于发布者 |
| RSS 全文提取 | 对单个 RSS 源启用 Trafilatura，下载文章 HTML 后提取正文 | 核心依赖中已包含 Trafilatura；目标站必须可访问 | 用正文替换 Feed 摘要 | 无 | 付费墙、脚本渲染、反爬和抽取误差；失败回退 Feed 内容 |
| Reddit | 优先 `old.reddit.com` HTML；帖子列表失败后尝试 `.json`，再尝试 `.rss`；评论 HTML 失败后尝试 JSON | 无 Key，使用浏览器式请求头 | Subreddit 帖子、用户投稿、分数、upvote ratio、flair、自帖正文 | 可配置 Top N，排除版主置顶/区分评论 | 未认证端点不稳定；HTML 选择器易变；429 只等待并重试一次 |
| Telegram | 依次访问 `telegram.me/s`、`telegram.dog/s`、`t.me/s` 的公开频道预览 HTML | 无 Key；只支持公开频道 | 消息正文、时间、频道、首个外链 | 无 | 只能看到网页预览窗口；无历史全量、私有频道和媒体完整下载 |
| Twitter/X：Apify | 调用 Apify Actor，启动任务、轮询状态、读取 Dataset | `APIFY_TOKEN`；第三方额度 | 指定用户推文、互动数、浏览量 | 可为入选推文再次运行 Actor 抓回复 | 成本、Actor 可用性和 X 规则变化；Token 作为查询参数传给 Apify API |
| Twitter/X：Playwright | Playwright 加载导出的 Cookie，访问用户页并拦截 GraphQL 响应 | `twitter` 可选依赖、Chromium、有效 Cookie | 指定用户推文和基础互动信息 | 当前不支持二阶段回复扩展 | Cookie 失效、登录门槛、账号风险、前端 GraphQL 结构变化 |
| OpenBB | `obb.news.company()`，同步 SDK 通过 `asyncio.to_thread` 执行 | `openbb` 可选依赖；凭据由各 Provider 管理 | 股票观察列表对应公司新闻 | 无 | 数据质量、许可、费用和字段由具体 Provider 决定；一个 Watchlist 一次调用 |
| OSS Insight | `https://api.ossinsight.io/v1/trends/repos` | 无 Key | 按周期和语言统计的 Trending 仓库、Star/Fork/Push/PR 增量 | 无 | 是排名快照而非事件流；实现把 `published_at` 设为抓取时间 |
| GDELT | GDELT 2.0 DOC API，JSON `ArtList` | 无 Key | 查询命中的全球新闻标题、URL、域名、语言、国家和 `seendate` | 无 | 单次最多 250；会 429；当前实现将网络错误吞成空列表 |
| Google News | `news.google.com/rss/search`，用 `when:Nh` 或 `after:YYYY-MM-DD` 限定时间 | 无 Key | 搜索结果标题、Google News 跳转链接、发布者、日期和 Feed 摘要 | 无 | 链接多为 Google 中转 URL；同一事件不同媒体仍需语义去重 |

## 各源在本次演示中的表现

| 来源 | 本次结果 | 观察 |
|---|---:|---|
| GitHub | 2 | 成功获取 `astral-sh/uv` 近 168 小时 Release |
| Hacker News | 12 | Top 12 均成功，并带社区评论 |
| RSS | 30 | Simon Willison Feed 在时间窗口内返回 30 条 |
| Reddit | 4 | MachineLearning 热门帖成功，带最多 2 条评论 |
| Telegram | 5 | `zaihuapd` 公开预览成功 |
| Google News | 8 | 查询结果成功，来自 8 个发布者 |
| GDELT | 0 | 服务端返回 HTTP 429；代码日志记录后返回空列表 |
| OSS Insight | 0 | API 调用没有产生满足当前映射/过滤条件的条目 |
| Twitter/X | 未启用 | 缺少 Apify Token、浏览器 Cookie 和可选依赖 |
| OpenBB | 未启用 | 未安装 OpenBB 可选依赖，也没有选择金融 Provider |

## 对来源治理的含义

1. “支持某来源”只表示存在适配器，不表示来源稳定、完整或获得长期许可。
2. API/RSS 应优先于 HTML 和浏览器自动化；后两者适合作为降级路径而非可靠性承诺。
3. 应额外记录最后成功时间、HTTP 状态、连续失败次数、限流窗口和原始响应摘要。当前部分抓取器把异常转换为空列表，会让“真实无内容”和“抓取失败”在汇总层难以区分。
4. AI 评分不能代替来源可信度。来源等级、事实证据和编辑价值应是不同字段。
