# Horizon 安装与演示报告

## 环境与安装

| 项目 | 结果 |
|---|---|
| 验证日期 | 2026-08-07，Asia/Shanghai |
| 操作系统 | Windows / PowerShell |
| 上游提交 | `9dfee928a6709b6586dbad7c65afc943a197b7dd` |
| uv | 0.11.2 |
| 系统 Python | 3.10.11，不满足项目 `>=3.11` |
| 实际 Python | 3.12.13 |
| 安装位置 | `horizon-study/.venv/` |
| 安装结果 | 核心依赖和 dev 依赖安装成功，共安装 95 个包 |
| Docker | 当前机器未安装 |
| 模型 API Key | 当前环境未发现受支持供应商 Key |

上游源码保存在被 `.gitignore` 排除的 `horizon-study/upstream/`，不会把第三方完整历史嵌入研究仓库。配置中的真实密钥文件 `data/config.json` 同样被忽略。

## 演示策略

为了不把未完成的 AI 链路包装成成功演示，本次分开验证：

1. 本机使用 Horizon 原生 Scraper、`ContentItem` 和 URL 去重函数真实访问公开来源；
2. 生成只展示原始采集结果的本地页面，并明确标记 `LIVE FETCH · NO AI`；
3. 使用上游公开 GitHub Pages 检查完整 AI 日报的最终形态；
4. 没有伪造模型评分、语义去重或背景增强。

## 本地真实采集

配置启用了 GitHub Release、HN、RSS、Reddit、Telegram、OSS Insight、GDELT 和 Google News，时间窗口为 168 小时；Twitter 与 OpenBB 因认证或可选依赖未启用。

| 来源 | 状态 | 条目数 | 说明 |
|---|---|---:|---|
| GitHub | success | 2 | `astral-sh/uv` Release |
| Hacker News | success | 12 | Top Stories，并抓取评论 |
| RSS | success | 30 | Simon Willison Atom Feed |
| Reddit | success | 4 | `r/MachineLearning`，每帖最多 2 条评论 |
| Telegram | success | 5 | `zaihuapd` 公开频道预览 |
| Google News | success | 8 | AI open source 查询 |
| OSS Insight | empty | 0 | 本次没有映射出有效条目 |
| GDELT | empty | 0 | 实际日志为 HTTP 429；抓取器吞掉异常后返回空列表 |

总计 61 条，保守 URL 去重后仍为 61 条。Google News 中同一阿里模型事件出现多家媒体报道，证明 URL 去重不能代替后续 AI 话题去重。

## 浏览器验收

本地页面 `http://127.0.0.1:8879/` 实际检查结果：

- 标题和中文正文正常；
- 8 张来源状态卡、61 张内容卡全部进入 DOM；
- 指标显示 61 条抓取、61 条 URL 去重后、6 类有效来源；
- 页面控制台无 warning/error；
- 首次检查发现长 Google News URL 导致横向溢出，修正换行规则后 `scrollWidth=1265`、viewport `1280`，无横向溢出。

上游完整效果页 `https://thysrael.github.io/Horizon/` 检查结果：

- 主页可访问，中英文切换和每日索引可见；
- 2026-08-07 中文日报可打开；
- 页面显示“从 44 条内容中筛选出 16 条重要资讯”；
- 结果按科技新闻、科技博客、财经新闻分组；
- 每条包含分数、摘要、来源、日期、背景、影响、社区讨论、参考链接和标签；
- 浏览器控制台无 warning/error。

## 测试结果

核心测试在上游目录运行，通过 366 项。完整测试套件另有 23 项失败：

- 20 项 Webhook 测试和 1 项 Trafilatura 测试使用 `example.com`，当前受控环境把该域名解析到保留地址 `198.18.10.132`，Horizon 的 SSRF 防护在 Mock HTTP 调用之前将其拒绝；
- 2 项 Wizard 测试在 Windows 上得到 `data\\presets.json`，而断言固定写成 POSIX `data/presets.json`。

这些失败说明测试对 DNS/平台路径存在环境假设；它们没有影响本次真实来源采集，但完整跨平台测试目前不能标记为全绿。

## 实际结论

安装和采集主链路可用，失败隔离有效，生成日报的产品形态清晰。当前最需要补强的不是再增加更多抓取器，而是统一错误语义、来源健康度、原始证据留存和跨来源 canonical URL。完整 AI 成本与质量需要在配置真实模型 Key 后另行评估。
