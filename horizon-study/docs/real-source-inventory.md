# Horizon 公开配置中的真实来源地址

## 先区分三种“来源”

Horizon 仓库里同时存在抓取器、候选预设和运行配置，三者不能混为一谈：

| 证据层级 | 文件 | 含义 |
|---|---|---|
| 实际自动化配置 | `data/config.github.json` | 最接近公开日报运行时真正启用的来源，本清单以它为主 |
| 示例配置 | `data/config.example.json` | 展示配置写法，不表示生产环境长期使用 |
| 安装向导预设 | `data/presets.json` | 可供用户勾选的候选目录，不会自动全部启用 |

代码“支持某类来源”只说明有适配器；真实信息覆盖面由运行配置决定。

## 公开自动化配置实际启用的入口

审计提交 `9dfee928a6709b6586dbad7c65afc943a197b7dd` 中，`config.github.json` 共启用 14 个来源入口。

| 类型 | 配置对象 | 真实地址或入口 | 抓取内容 |
|---|---|---|---|
| GitHub 用户 | `karpathy` | <https://github.com/karpathy> | 公开用户事件 |
| GitHub Release | `vllm-project/vllm` | <https://github.com/vllm-project/vllm/releases> | 新版本发布 |
| GitHub Release | `sgl-project/sglang` | <https://github.com/sgl-project/sglang/releases> | 新版本发布 |
| GitHub Release | `triton-lang/triton` | <https://github.com/triton-lang/triton/releases> | 新版本发布 |
| Hacker News | Top Stories | <https://news.ycombinator.com/> | Top 30，分数至少 150 |
| RSS/Atom | Simon Willison | <https://simonwillison.net/atom/everything/> | 站点文章 Feed |
| RSS + 全文 | vLLM Blog | <https://vllm.ai/blog/rss.xml> | Feed 后再提取文章正文 |
| RSS + 全文 | CNBC Finance | <https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664> | 财经 Feed 后再提取正文 |
| RSS | GitHub Trending Daily | <https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml> | 第三方生成的 Trending Feed |
| RSS | SemiAnalysis | <https://newsletter.semianalysis.com/feed> | Newsletter Feed |
| 私有 RSS | LWN Full Text | `https://lwn.net/headlines/full_text?key=${LWN_KEY}` | 需要订阅密钥的全文 Feed |
| Reddit | `r/MachineLearning` | <https://www.reddit.com/r/MachineLearning/> | Hot 10，分数至少 60，含评论 |
| Reddit | `r/LocalLLaMA` | <https://www.reddit.com/r/LocalLLaMA/> | Hot 10，分数至少 60，含评论 |
| Telegram | `zaihuapd` | <https://t.me/zaihuapd> | 公开频道预览中的最近消息 |

这套来源明显偏向 AI 推理基础设施、开源模型社区和技术新闻，不是覆盖广泛的综合信息网络。

## 官方源与第三方桥接

- 官方或来源自有入口：vLLM、SGLang、Triton、Simon Willison、CNBC、SemiAnalysis、LWN、Reddit 社区和 Telegram 频道。
- 第三方聚合入口：`mshibanami.github.io/GitHubTrendingRSS`，它把 GitHub Trending 页面转成 RSS，并非 GitHub 官方 API。
- 需要凭据：LWN 全文 Feed。配置通过环境变量注入 Key，不应把真实 URL 提交到仓库。

安装向导还提供量子位、新智元等微信公众号的 `wechat2rss.xlab.app` 第三方桥接地址。它们只是候选预设，并未出现在公开自动化配置中；稳定性、许可和内容完整度取决于桥接服务。

## 代码支持但公开配置未启用

Twitter/X、OpenBB、OSS Insight、GDELT 和 Google News 均有实现或示例，但 `config.github.json` 没有启用。不能因为仓库存在这些抓取器，就把它们计入公开日报的真实覆盖范围。

## 与 AI 探测雷达的关系

Horizon 和 AI 探测雷达属于同一能力类型：配置来源，按时间窗口批量抓取，统一结构，去重筛选，再生成阅读或研判结果。判断两者差异时应比较：

1. 真实启用的来源资产，而不是适配器数量；
2. 发布时间、抓取时间和事件时间是否分开保存；
3. 失败、限流与“本期确实无内容”能否区分；
4. URL 去重、事件级去重和证据合并的质量；
5. 评分依据、人工复核和最终交付形态。

对现有 AI 探测雷达最值得复用的是 Profile 路由、分阶段产物和日报编排；最不值得照搬的是把少量预设来源或通用抓取器包装成独有信息优势。

## 建议建立的来源资产表

每个来源至少记录：`source_id`、真实入口、所有者、官方/第三方、抓取方式、认证要求、更新时间语义、最近成功时间、连续失败次数、限流状态、覆盖范围、许可风险和替代入口。它比继续增加抓取器数量更能提升雷达的长期价值。
