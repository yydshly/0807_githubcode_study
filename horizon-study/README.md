# Horizon 研究与本地演示

研究对象：[Thysrael/Horizon](https://github.com/Thysrael/Horizon)。本次审计基于提交 `9dfee928a6709b6586dbad7c65afc943a197b7dd`（2026-08-04）。

## 当前结论

Horizon 是一条可自托管的 AI 新闻编辑流水线。代码当前注册了 10 类信息源，并通过 11 条采集路径进入统一的 `ContentItem` 模型；Twitter/X 同时提供 Apify 和 Playwright 两种路径。它的主要价值不是某一个抓取器，而是把采集、保守 URL 去重、Profile 路由、AI 评分、语义去重、内容增强和多渠道发布组织成稳定阶段。

信息源决定输入上限，Profile 与筛选策略决定信噪比，发布层决定结果能否成为日常工具。Horizon 适合作为新闻/技术情报流水线，不应直接充当事实核验、完整档案或高风险决策系统。

## 本次完成内容

- [信息源与抓取方式清单](docs/source-matrix.md)
- [公开配置中的真实来源地址](docs/real-source-inventory.md)
- [信息源处理链路](docs/source-processing-pipeline.md)
- [安装与演示报告](docs/local-demo-report.md)
- [本次真实抓取报告](demo-output/fetch-report.md)
- [本地演示页面](demo-output/index.html)
- [公开 Horizon 专题总结](https://yydshly.github.io/0807_githubcode_study/horizon.html)
- 可重复执行的抓取脚本：`scripts/fetch_demo.py`
- 不含密钥的配置模板：`data/config.example.json`

## 实际验证结果

2026-08-07 使用 168 小时时间窗口运行真实采集，共得到 61 条：GitHub 2、Hacker News 12、RSS 30、Reddit 4、Telegram 5、Google News 8。GDELT 被远端以 HTTP 429 限流，OSS Insight 返回空结果；单个来源异常没有拖垮其他来源。

本机没有模型 API Key，因此本地演示只声称完成了真实采集、统一建模和 URL 去重。完整 AI 日报效果已在上游公开站点核验：2026-08-07 中文日报从 44 条内容中选出 16 条，并按科技新闻、科技博客和财经新闻编排。

## 远端效果查看

- [本仓库真实抓取快照](https://yydshly.github.io/0807_githubcode_study/horizon-study/demo-output/)：展示本次真实抓取、统一建模与 URL 去重结果，不包含伪造的 AI 评分。
- [Horizon 上游完整 AI 日报](https://thysrael.github.io/Horizon/)：展示上游定时抓取后经过 AI 评分、语义去重、内容增强和版面编排的日报。
- [本仓库 Horizon 专题总结](https://yydshly.github.io/0807_githubcode_study/horizon.html)：说明真实来源、抓取方式、时间窗口、处理链路以及与 AI 探测雷达的关系。

下面的 `127.0.0.1:8879` 仅用于重新生成或调试本地快照，不是提供给远端访问者的入口。

## 重新运行

安装环境位于 `horizon-study/.venv/`，上游审计副本位于被忽略的 `horizon-study/upstream/`。在上游目录执行：

```powershell
Copy-Item ..\data\config.example.json ..\data\config.json
..\.venv\Scripts\python.exe ..\scripts\fetch_demo.py --hours 168
..\.venv\Scripts\python.exe -m http.server 8879 --bind 127.0.0.1 --directory ..\demo-output
```

然后访问 `http://127.0.0.1:8879/`。该地址只在本机服务运行期间有效。

要运行完整 AI 链路，需要在本地 `.env` 或运行环境 Secrets 中配置一个受支持模型的 API Key，再将 `data/config.json` 的 `ai` 段改为相应供应商。不要把 Key 提交到仓库。

## 是否继续投入

建议保留为独立研究项目并按需集成：复用其来源适配器、Profile、MCP 分阶段接口与静态日报发布方式；来源许可、健康度、原始证据和事实核验仍由更上层的数据治理承担。
