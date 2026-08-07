# 采用与风险矩阵

## 四级判断

| 等级 | 定义 | 行动 |
|---|---|---|
| 优先吸收 | 方法通用、依赖少、可明显改善我们现有流程 | 阅读并提炼到我们的规范；出现重复任务时创建本地版本 |
| 改造后用 | 能力方向有价值，但绑定作者工具、路径、平台或调用方式 | 替换依赖和权限模型，测试后单项安装 |
| 条件储备 | 只在特定服务、平台、模型或基础设施出现时有价值 | 保留索引，不进入默认技能集合 |
| 不原样用 | 高度个人化、生产绑定、破坏性强或与现有能力明显冲突 | 只保留设计思想或反例，不直接执行 |

## 建议矩阵

### 优先吸收

| 技能 | 值得吸收的部分 | 注意 |
|---|---|---|
| effective-agent-skills | 路由描述、渐进加载、验证循环、技能测试与安全审计 | 与我们已有 `skill-creator` 重叠，优先合并原则而非重复安装 |
| goal-loop | 目标、约束、验证命令、停止条件和防止“奖励作弊” | 具体命令和功能状态需以当前 Codex 文档为准 |
| git-worktree | 多代理隔离、依赖和端口复制、合并与清理 | Windows 路径和现有工作树策略需要本地化 |
| handoff | 跨会话保留背景、原因、进度、验证与剩余工作 | 当前 Codex 已有线程和压缩机制，可提炼输出结构 |
| research-prompt | 单一任务、完整上下文、子问题和事实/推断分离 | 不需要绑定 DeepAPI，可用于任何研究代理 |
| before-building | 在构建前暴露 1–3 个关键决策 | 与直接实施的任务边界结合，避免所有小改动都被问询打断 |
| next-decision | 每次推进一个最重要的未决问题 | 适用于产品或架构选择，不适合机械执行任务 |
| decisions | 复盘代理不确定的自主选择 | 应与 diff、测试和风险记录结合 |
| prompt-me | 用有针对性的问题提取真实目标与优先级 | 只在意图不清或用户明确希望被访谈时启用 |
| setup-help | 一步一步引导，并保留剩余步骤视图 | 适合非技术用户，但要避免隐藏关键风险和总体范围 |

### 改造后使用

| 技能 | 改造重点 |
|---|---|
| agent-self-scheduling | 对接 Codex 自动化而不是作者的 cron/心跳脚本；明确时区、失败和通知 |
| codex-subagent / launch-subagent | 映射到当前原生子代理和线程能力，删除硬编码模型与旧 CLI 假设 |
| brain-to-docs | 保留访谈和文档沉淀，但 ADR 必须由用户明确批准 |
| folder-specific-claude-and-agents-md | 以 `AGENTS.md` 为主，去除必须创建 CLAUDE.md 符号链接的假设 |
| global-agent-guardrails | 从黑名单升级为沙箱、审批、目标解析和最小权限的组合；Windows 需要独立实现 |
| browser-harness | 优先使用当前浏览器控制能力，保留 CDP 安装和故障诊断作为备用 |
| deep-research / youtube-transcript / online-shopping | 替换为已有 web、研究或视频能力；只有 DeepAPI 有独特优势时才引入密钥和成本 |
| create-readonly-db-role | 根据实际数据库、密钥保管和审计策略重写；创建角色必须单独批准 |
| google-safe-browsing | 保留上线前域名与安全告警检查清单，实时规则需要重新核对 |
| teach / level-up | 保留学习记录与评估结构，重写作者个人工作区和文件约定 |

### 条件储备

- `cmux`、`herdr`、`corral-launch-agents`：只有采用对应编排环境时使用。
- `fable-review`、`gpt-review`、`fable-safe-prompt`：绑定特定模型、路由或服务策略。
- `run-deep-swe`：只有正式进行模型基准测试时使用，成本和基准完整性需单独审批。
- `deepapi`、`pi-web-search`、`pi-custom-model`：绑定 DeepAPI 或 Pi Agent。
- `fireflies-transcript`：只有存在 Fireflies 账号、授权和会议数据需求时使用。
- `read-all-adrs`：只有项目确实采用 ADR 且用户明确调用时使用。
- `short`、`remind`：属于交互偏好，可保留为手动命令，不必占用自动路由。
- `save-idea`：有价值但完全绑定作者的内容目录和栏目结构，应按我们的知识库重写。

### 不原样使用

- `anti-sleep`、`macbook-metrics-setup`：macOS 专用，与当前 Windows 环境不匹配。
- `nuke-cursor-app`：终止进程动作具有破坏性，而且为作者的 Mac/Cursor 故障设计。
- `prod-push`：绑定作者仓库、CI 和 Vercel 生产发布，不得泛化为所有“push”。
- `read-prod-database`：绑定作者的 Supabase、角色、ADR 和客户口径，不能迁移为通用生产查询技能。
- `push-skill-to-github`、`distribute-skill-to-all-agents`：绑定作者私有仓库和多代理目录布局；应由我们的安装/发布流程替代。

## 安装前审计清单

1. 来源仓库、许可证和具体提交是否记录？
2. `SKILL.md` 的触发范围会不会与现有技能冲突？
3. 是否读取个人目录、密钥、Cookie、数据库或浏览器会话？
4. 是否执行脚本、下载依赖或访问网络？
5. 是否包含删除、杀进程、推送、部署、写生产数据等动作？
6. 路径、命令和工具是否支持 Windows？
7. 外部 API 的费用、限额、数据留存和隐私条件是否明确？
8. 是否有正向、反向和失败样例验证触发？
9. 是否有可观察的完成标准和回滚方案？
10. 安装后怎样跟踪上游变化和本地修改？
