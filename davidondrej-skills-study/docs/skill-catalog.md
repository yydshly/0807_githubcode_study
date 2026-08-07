# 完整技能分类目录

审计日期：2026-08-07

上游：[davidondrej/skills](https://github.com/davidondrej/skills)

统计：5 类、47 个 `SKILL.md`、18 个 `agents/openai.yaml`、2 个技能脚本、5 份 references。

> “建议”表示对我们当前 Windows + Codex 工作环境的储备判断，不表示上游技能质量高低。目录来自公开源码审计，没有执行这些技能。

## A. Agent 编排（13）

| 技能 | 能力概要 | 主要依赖/边界 | 对我们的建议 |
|---|---|---|---|
| [agent-self-scheduling](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/agent-self-scheduling) | 用 cron、心跳或代理内置调度器重复运行任务 | 调度器、长期运行环境、通知 | 改造后用：映射到 Codex 自动化 |
| [cmux](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/cmux) | 控制 cmux 工作区、面板、浏览器和通知 | cmux、macOS 14+ | 条件储备：仅采用 cmux 时 |
| [codex-subagent](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/codex-subagent) | 从其他代理启动 Codex CLI 执行独立子任务 | Codex CLI、订阅登录、进程管理 | 改造后用：优先映射原生子代理 |
| [corral-launch-agents](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/corral-launch-agents) | 在 Corral/Herdr 仓库创建或恢复代理任务 | Corral、Herdr、worktree、Python 脚本 | 条件储备：平台专用 |
| [fable-review](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/fable-review) | 启动指定 Fable 模型做独立代码评审 | 特定模型、子代理运行环境 | 条件储备：评审思想可复用 |
| [fable-safe-prompt](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/fable-safe-prompt) | 为特定 Fable 安全分类器重写双用途提示 | 特定模型和安全路由假设 | 不原样用：不得以规避安全边界为目标 |
| [git-worktree](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/git-worktree) | 用 worktree 隔离多个代理的代码、依赖、数据库和端口 | Git、环境复制、合并与清理 | 优先吸收：本地化 Windows 路径 |
| [goal-loop](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/goal-loop) | 为长任务定义目标、约束、验证与可检验停止条件 | 支持 Goal 的代理、可靠测试 | 优先吸收：保留契约和验证思想 |
| [gpt-review](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/gpt-review) | 启动指定 GPT 模型做独立高级代码评审 | 特定模型别名、子代理环境 | 条件储备：避免硬编码模型 |
| [handoff](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/handoff) | 把背景、原因、进度、验证和剩余工作压缩为交接消息 | 跨会话复制或持久文件 | 优先吸收：与线程/压缩机制结合 |
| [herdr](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/herdr) | 在 Ghostty 的 Herdr 环境中检查、通信和协调代理 | Herdr、Ghostty | 条件储备：平台专用 |
| [launch-subagent](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/launch-subagent) | 规定何时启动子代理、模型选择与共识原则 | 具体代理产品和模型政策 | 改造后用：对齐当前协作规则 |
| [run-deep-swe](https://github.com/davidondrej/skills/tree/main/skills/agent-orchestration/run-deep-swe) | 通过 OpenRouter 运行 DeepSWE 编码代理基准 | OpenRouter API、费用、mini-swe-agent | 条件储备：正式模型评测时启用 |

## B. 运维与设置（11）

| 技能 | 能力概要 | 主要依赖/风险 | 对我们的建议 |
|---|---|---|---|
| [anti-sleep](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/anti-sleep) | 用 `caffeinate` 保持 Mac 唤醒 | macOS、后台进程 | 不原样用：当前为 Windows |
| [create-readonly-db-role](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/create-readonly-db-role) | 创建强化的 Postgres 只读代理角色 | 数据库管理员权限、Supabase/Postgres | 改造后用：创建权限必须单独批准 |
| [cyber-audit](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/cyber-audit) | 针对 CVE、恶意包或泄露做只读暴露面审计并出报告 | Mac 路径、项目目录、安全信息时效 | 条件储备：保留审计方法，重写平台实现 |
| [global-agent-guardrails](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/global-agent-guardrails) | 用共享命令黑名单 Hook 阻止灾难性 Shell 操作 | Bash、jq、正则黑名单、代理 Hook | 改造后用：结合沙箱、审批和 Windows 规则 |
| [google-safe-browsing](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/google-safe-browsing) | 预防和处理网站被标记为危险或欺骗性页面 | 域名、上线页面、实时政策与申诉流程 | 改造后用：作为发布检查清单 |
| [macbook-metrics-setup](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/macbook-metrics-setup) | Swift + launchd + SQLite 的长期 Mac 指标采集 | macOS、Swift、launchd、私有 GitHub | 不原样用：架构可参考 |
| [nuke-cursor-app](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/nuke-cursor-app) | 强制退出所有 Cursor 桌面进程以恢复内存泄漏 | macOS、杀进程、未保存状态风险 | 不原样用：只保留故障恢复思路 |
| [pi-custom-model](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/pi-custom-model) | 给 Pi Agent 注册自定义或 OpenRouter 模型变体 | Pi Agent、模型注册配置 | 条件储备：仅使用 Pi 时 |
| [prod-push](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/prod-push) | 推送 main 并守护 CI/Vercel 直到生产可验证 | 作者仓库、GitHub、CI、Vercel、生产权限 | 不原样用：发布流程必须项目化 |
| [read-prod-database](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/read-prod-database) | 用只读角色查询生产 Supabase 数据并声明统计口径 | 生产库、psql、作者 ADR 与客户口径 | 不原样用：项目和数据治理强绑定 |
| [setup-help](https://github.com/davidondrej/skills/tree/main/skills/ops-and-setup/setup-help) | 每次只推进一个设置步骤，同时展示全部剩余步骤 | 需要持续用户反馈 | 优先吸收：适合非技术引导 |

## C. 研究与网络（8）

| 技能 | 能力概要 | 主要依赖/边界 | 对我们的建议 |
|---|---|---|---|
| [browser-harness](https://github.com/davidondrej/skills/tree/main/skills/research-and-web/browser-harness) | 通过 CDP 连接已运行 Chrome，执行自动化、抓取和测试 | Chrome 调试端口、CDP、浏览器会话 | 改造后用：优先现有浏览器工具 |
| [deep-research](https://github.com/davidondrej/skills/tree/main/skills/research-and-web/deep-research) | 构造严谨研究任务、调用 DeepAPI 并保存带来源报告 | DeepAPI Key、费用、网络、幂等处理 | 改造后用：工作流可复用，服务按需 |
| [deepapi](https://github.com/davidondrej/skills/tree/main/skills/research-and-web/deepapi) | 将搜索、抓取、研究、邮件和图像统一路由到 DeepAPI | DeepAPI Key、外部数据处理与费用 | 条件储备：不要替代所有现有工具 |
| [fireflies-transcript](https://github.com/davidondrej/skills/tree/main/skills/research-and-web/fireflies-transcript) | 从 Fireflies GraphQL API 读取会议原始转录 | Fireflies 账号、全局密钥、会议隐私 | 条件储备：只有授权会议需求时 |
| [online-shopping](https://github.com/davidondrej/skills/tree/main/skills/research-and-web/online-shopping) | 做价格、公平价、商店可信度和购买渠道研究，不下单 | DeepAPI、实时价格、地区差异 | 改造后用：可由现有 Web 能力完成 |
| [pi-web-search](https://github.com/davidondrej/skills/tree/main/skills/research-and-web/pi-web-search) | 教 Pi Agent 使用专用包搜索、读取网页/PDF/视频/GitHub | Pi Agent、pi-web-access | 条件储备：Codex 不需要 |
| [research-prompt](https://github.com/davidondrej/skills/tree/main/skills/research-and-web/research-prompt) | 写一段自包含研究任务，包含目标、子问题、来源与输出格式 | 无强制服务依赖 | 优先吸收：适用于任何研究流程 |
| [youtube-transcript](https://github.com/davidondrej/skills/tree/main/skills/research-and-web/youtube-transcript) | 获取 YouTube 字幕/转录，DeepAPI 主路径、yt-dlp 回退 | DeepAPI 或 yt-dlp、版权和地区限制 | 改造后用：优先已有视频/网页能力 |

## D. Skill 创作与分发（4）

| 技能 | 能力概要 | 主要依赖/边界 | 对我们的建议 |
|---|---|---|---|
| [distribute-skill-to-all-agents](https://github.com/davidondrej/skills/tree/main/skills/skill-authoring/distribute-skill-to-all-agents) | 将一个技能同步到 Codex、Claude Code、Pi 和 Hermes 目录 | 作者的 `~/.agents` 与符号链接布局 | 不原样用：改由本地安装/插件流程管理 |
| [effective-agent-skills](https://github.com/davidondrej/skills/tree/main/skills/skill-authoring/effective-agent-skills) | 系统说明技能结构、路由、渐进加载、测试、反模式与安全 | 文档较长，部分客户端行为需实时核对 | 优先吸收：与现有 skill-creator 合并原则 |
| [folder-specific-claude-and-agents-md](https://github.com/davidondrej/skills/tree/main/skills/skill-authoring/folder-specific-claude-and-agents-md) | 为特定目录创建局部代理上下文文件 | CLAUDE.md、AGENTS.md、符号链接 | 改造后用：以 AGENTS.md 和作用域为主 |
| [push-skill-to-github](https://github.com/davidondrej/skills/tree/main/skills/skill-authoring/push-skill-to-github) | 提交并推送作者的私有技能仓库 | 作者仓库、Git 凭据、全局目录 | 不原样用：发布必须确认目标和范围 |

## E. 思考与文档（11）

| 技能 | 能力概要 | 主要依赖/边界 | 对我们的建议 |
|---|---|---|---|
| [before-building](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/before-building) | 构建前立即暴露 1–3 个会改变结果的重要选择 | 过度触发可能阻塞简单任务 | 优先吸收：只用于真正高影响选择 |
| [brain-to-docs](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/brain-to-docs) | 通过问答把愿景、决策和偏好写入 README/ADR | 多轮访谈、文档写入、ADR 决策 | 改造后用：ADR 必须明确批准 |
| [decisions](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/decisions) | 回顾当前工作中代理不确定的自主选择 | 手动触发、需要诚实置信度 | 优先吸收：与 diff 和风险复盘结合 |
| [level-up](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/level-up) | 用 7 个自适应问题评估知识并形成学习计划 | 学习记录、评分标准、用户时间 | 改造后用：保留评估结构 |
| [next-decision](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/next-decision) | 每次提出一个最重要未决问题、选项与偏好 | 适合开放决策，不适合机械任务 | 优先吸收：减少一次性问题轰炸 |
| [prompt-me](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/prompt-me) | 用尖锐问题提取剩余工作、回避项和真正优先级 | 需要用户愿意参与访谈 | 优先吸收：意图不清时使用 |
| [read-all-adrs](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/read-all-adrs) | 显式调用时读取项目 `docs/adr/` 的全部决策记录 | 项目必须使用 ADR、上下文成本 | 条件储备：大型决策密集项目 |
| [remind](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/remind) | 先给会话 TLDR，再把上一回复改成更短的英语 | 手动交互偏好、英语输出 | 条件储备：当前对话可直接要求简化 |
| [save-idea](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/save-idea) | 把视频、播客或 AI 观察写入作者内容积压文件 | `~/content`、固定栏目和来源格式 | 改造后用：对接我们的知识库 |
| [short](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/short) | 压缩当前答案，去掉填充但保留实质 | 手动交互偏好 | 条件储备：无需自动触发 |
| [teach](https://github.com/davidondrej/skills/tree/main/skills/thinking-and-docs/teach) | 在工作区内教学，并维护任务、资源、术语和学习记录 | 多份固定模板和工作区写入 | 改造后用：适合长期学习项目 |

## 结构观察

- 47 个技能中只有 2 个提供 `scripts/`，说明该仓库主要保存的是**流程知识**，不是大量可执行软件。
- 18 个技能提供 `agents/openai.yaml`，说明作者已经考虑 Codex/插件表现，但没有配置的技能仍可能被 Codex 读取；是否兼容取决于内容和依赖，而不只取决于文件是否存在。
- `browser-harness`、`deepapi` 和 `corral-launch-agents` 使用 references 分离安装、服务说明或编排细节，体现了渐进式加载。
- 根目录的危险命令 Hook 不是普通 Skill，而是额外的执行前安全层；其正则黑名单和 fail-open 行为必须单独评估。
