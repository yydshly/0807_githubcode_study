# 47 个 Skill 的调度与实现详解

审计对象：[davidondrej/skills](https://github.com/davidondrej/skills)

审计日期：2026-08-07

这份文档回答的不是“它能做什么”，而是更实际的五个问题：它怎样被选中、谁在推动下一步、真正执行的载体是什么、怎样判断完成、哪里不能直接照搬。

## 先建立统一心智模型

一个 Skill 本身通常不是常驻程序。它的基本调度分三层：

```text
用户请求
→ Agent 先看到所有 Skill 的 name + description
→ 语义匹配或用户显式点名
→ 读取对应 SKILL.md
→ 按文档调用模型、文件、CLI、脚本、浏览器或远端 API
→ 根据验证条件结束、等待用户或继续轮询
```

本仓库的 47 项能力实际混合了七种执行引擎：

| 引擎 | 谁推动下一步 | 典型 Skill |
|---|---|---|
| 单轮提示规则 | 当前 Agent | `before-building`、`short`、`research-prompt` |
| 多轮对话状态机 | 用户回答后由 Agent 继续 | `setup-help`、`brain-to-docs`、`level-up` |
| 本地文件状态 | 文件保存进度，后续会话重新读取 | `teach`、`save-idea`、`handoff` |
| CLI/子进程编排 | Shell、Git、终端工具或子 Agent | `codex-subagent`、`herdr`、`git-worktree` |
| 远端异步 API | 请求 ID + 轮询状态 | `deepapi`、`deep-research`、`youtube-transcript` |
| 外部时钟/常驻调度器 | cron、launchd、Hermes gateway | `agent-self-scheduling`、`macbook-metrics-setup` |
| Agent 内部持续循环 | Goal 状态机自动续轮 | `goal-loop` |

### 路由数字

- 30 项在 Codex 侧没有禁止隐式调用，属于“语义路由候选”。这不表示每次都会触发，更不表示可以未经授权执行外部写操作。
- 17 项同时用 `disable-model-invocation: true` 和 `agents/openai.yaml` 的 `allow_implicit_invocation: false` 设为手动调用。
- 18 项带 `agents/openai.yaml`：17 项用于关闭 Codex 隐式调用，`corral-launch-agents` 只提供显示名称、简介和默认提示。
- 只有 2 项真正捆绑了可执行脚本：`anti-sleep` 和 `corral-launch-agents`。其余绝大多数是调用已有工具的操作规程，或纯提示流程。

> 重要区别：**Skill 路由**决定“是否读取操作手册”；**任务调度**决定“谁让任务继续运行”。两者不是一回事。

## A. Agent 编排（13）

### 1. `agent-self-scheduling`

- **启动方式：**语义路由；“每 N 分钟运行、定时、循环、heartbeat”等表达会命中。
- **调度链：**先判断 Agent 有没有内置调度器。Codex/Claude/Pi 被归为一次运行后退出的 Camp A，由 cron、systemd 或 `while + sleep` 提供时钟；Hermes 被归为 Camp B，由 gateway 每 60 秒扫描到期任务。
- **实现载体：**没有捆绑程序，只提供 CLI 模板。一次性 Agent 用 JSON 输出方便外层解析；跨轮状态靠 `resume` 或持久文件。Heartbeat 用一个高频总 tick 读取任务表和 `last_run`，只执行真正到期的子任务。
- **完成信号：**日志在一个周期后增长、命令单次运行返回干净 JSON/退出码 0，或 Hermes 显示合理的 `next_run`；无任务到期时 heartbeat 必须保持安静。
- **心里要有底：**它不是调度器，只是教 Agent 选择调度器。cron 分钟级，不适合高频 LLM 轮询；权限弹窗、会话无记忆和上下文不完整是无人值守时的主要失败点。

### 2. `cmux`

- **启动方式：**技术上可语义路由，但 description 明确要求只有用户说出 `cmux` 才触发。
- **调度链：**识别当前 window/workspace/pane/surface → 用带前缀的 ID 定位目标 → 创建或复用 pane/surface → 发送输入 → 读取屏幕或等待事件 → 用截图、状态和输出验证。
- **实现载体：**macOS cmux CLI 与 `/tmp/cmux.sock` JSON-RPC；还能控制其 WKWebView 浏览器、通知、侧栏状态和 Markdown viewer。它本身没有 timer，循环仍由外层 sleep、事件 Hook 或 Agent 推动。
- **完成信号：**目标 surface 健康、输出或截图发生预期变化、Agent 状态变化；不能仅凭命令退出就认为 UI 操作成功。
- **心里要有底：**macOS 14+ 专用。裸数字会被当成索引而非 ID；错误目标可能读到或操作自己的 pane。对我们当前 Windows/Codex 环境属于平台参考，不是可直接能力。

### 3. `codex-subagent`

- **启动方式：**手动；必须明确委派一个独立编码任务。
- **调度链：**检查 Codex CLI 与订阅登录 → 生成包含全部上下文的任务提示 → `codex exec` 启动非交互子进程 → 最终消息写临时文件 → 主 Agent 检查输出和 Git 差异 → 必要时 `resume --last`。
- **实现载体：**Codex CLI 子进程。并行时要求“一任务一 worktree”，提前分配文件所有权；stderr 承载过程，stdout/输出文件承载最终结果。
- **完成信号：**输出文件存在、子进程结束、Git 差异符合范围、主 Agent 复核并运行验证。
- **心里要有底：**子 Agent 看不到父对话，所有背景必须写进提示。文档把模型名和 reasoning 写死，容易随产品更新失效；`</dev/null` 是其脚本环境防卡住措施，不等于所有平台都需要照搬。

### 4. `corral-launch-agents`

- **启动方式：**语义路由，但创建任务是外部状态变更，只有用户明确要求 launch/spawn/resume 才允许执行。
- **调度链：**区分“新任务、现有 Corral 任务、现有外部 worktree” → `doctor`/preset 检查 → dry-run 展示将创建的资源 → 调用 helper → Corral 创建 branch、worktree、Herdr workspace、pane、Agent 进程和持久任务记录 → `status --live` 双重验证。
- **实现载体：**仓库内约 38 KB 的 `corral_agents.py`，包含运行时发现、preset 解析、Git 主检出识别、launch plan、命令脱敏、单任务/批处理、状态读取和最多三路准备并发。
- **完成信号：**同时拿到 Corral task ID、worktree path、pane ID、持久 launch 状态和 live Herdr Agent 状态。
- **心里要有底：**这是强平台适配层，不是通用子 Agent。恢复旧会话与创建新任务是两条不同路径；失败后要求保留 worktree 诊断，不自动清理。

### 5. `fable-review`

- **启动方式：**语义路由候选；description 主要绑定 `/fable-review`、`fable review` 等显式表达，但没有 OpenAI 手动策略文件。
- **调度链：**主 Agent 组织中立、宽范围的评审提示 → 宿主原生子 Agent 机制启动指定 Fable 模型 → 等待评审 → 原样返回报告。
- **实现载体：**纯提示规程，没有启动命令、脚本、模型探测或失败恢复代码；能否运行完全依赖宿主是否真的提供该模型和子 Agent API。
- **完成信号：**得到独立评审报告，并明确是否存在阻止生产合并的严重问题。
- **心里要有底：**“原样转发、不重写”有助于保留独立意见，但也会把错误、冗余或不合规内容原样带回。它是评审角色模板，不是完整评审系统。

### 6. `fable-safe-prompt`

- **启动方式：**手动。
- **调度链：**只处理 `<prompt>` 内文本 → 找出高风险表述 → 做最小替换 → 输出完整改写版本 → macOS `pbcopy` 复制 → 列出改动。
- **实现载体：**纯文本转换规则和一个剪贴板命令；没有安全分类器调用，也不能验证改写是否真的通过服务端分类。
- **完成信号：**完整提示可复制、改动点可审计；如果任务本质上是攻击性行为，应停止而不是改写。
- **心里要有底：**它试图降低误报，但很容易被误用为规避安全系统。对我们只可保留“把合法防御目标写清楚”的方法，不能承诺绕过分类器，也不能抽象掉真实风险。

### 7. `git-worktree`

- **启动方式：**手动。
- **调度链：**检测当前是否主检出 → 主检出只负责集成，任务在新 worktree/分支执行 → 复制环境文件、安装依赖、处理数据库与端口 → Agent 独立工作 → 人工审查 → merge/squash → 清理 worktree。
- **实现载体：**标准 Git CLI 和可选的 Cursor worktree 配置，没有自带脚本。
- **完成信号：**每个任务拥有独立目录与分支，验证通过后由主检出逐个合并；删除前已有提交或确认放弃。
- **心里要有底：**worktree 只隔离工作文件，不隔离 Git refs、stash 和部分配置。缺失 `.env`、依赖、生成物和端口冲突是最常见的“看似代码失败，实际环境不完整”。

### 8. `goal-loop`

- **启动方式：**语义路由；用户提到 `/goal`、长任务或持久循环时加载。
- **调度链：**把任务写成 objective、constraints、validation、documentation、stop condition 契约 → Goal 状态机执行 `plan → act → test → review → iterate` → 每轮结束自动检查契约 → 未完成则自动续轮 → 达成、暂停、阻塞或预算耗尽时进入终态。
- **实现载体：**依赖宿主 Agent 的 Goal 功能，不由本 Skill 自己实现循环。它主要负责生成合格契约、指导暂停/恢复和防止奖励投机。
- **完成信号：**精确验证命令通过且停止条件满足，或进一步推进确实需要用户/产品决策；不是“Agent 说完成了”。
- **心里要有底：**只有可机械验证、通常超过 30 分钟且仓库已有测试的任务才适合。它不是无限运行、预算扩展或安全授权；目标写得含糊会把偏差自动放大。

### 9. `gpt-review`

- **启动方式：**语义路由候选；通常由 `/gpt-review` 或明确要求 GPT 评审触发。
- **调度链：**与 `fable-review` 相同：主 Agent 写中立评审 brief → 宿主启动指定 GPT reviewer → 等待 → 原样返回。
- **实现载体：**纯提示规程，无脚本、无确定的启动 API、无 diff 收集和验证实现。
- **完成信号：**得到简洁、独立、覆盖严重问题和修复建议的报告。
- **心里要有底：**它和 `fable-review` 只有模型偏好不同，存在重复。写死模型版本会腐化；更合理的本地化方式是复用原生代码审查 Agent，并把模型当可选参数。

### 10. `handoff`

- **启动方式：**手动。
- **调度链：**先读项目级 `AGENTS.md/CLAUDE.md` 和旧 handoff → 只提取本次会话新增状态、原因、陷阱、关键文件和开放工作 → 脱敏 → 输出单个代码块 → 同内容保存到系统临时目录。
- **实现载体：**模板驱动的总结与文件写入，没有脚本。持久性来自生成的 Markdown 文件，而不是模型记忆。
- **完成信号：**新 Agent 可以只读 handoff 指向的文件恢复上下文，不需要重新追问；文件路径已告知用户。
- **心里要有底：**它刻意写“状态而非命令”，可以减少旧会话替新会话越权决策。仍需让接手者核验代码，handoff 不是事实来源。

### 11. `herdr`

- **启动方式：**语义路由，但仅在用户明确提到 Herdr 或要求操作 Herdr Agent 时适用。
- **调度链：**检查 `HERDR_ENV`/workspace → 列出 pane → 先读目标近期输出 → 需要时发送文本和 Enter → 等待 `working/idle/done/blocked` 或输出事件 → 再读结果 → 主 Agent 汇总。
- **实现载体：**Herdr CLI 经本地 socket 控制 Ghostty pane；本质是终端编排，不是 Agent 共享内存。可接 Cursor、Codex、Claude、Pi 等 TUI。
- **完成信号：**原生 Agent 状态和 pane 输出相互印证，而不是只看屏幕有变化或 sleep 到期。
- **心里要有底：**Skill 中建议用各 Agent 的自动批准/跳过权限参数，并把安全寄托在全局 denylist 上，这不符合我们的默认权限原则，不能原样采用。平台、终端输入时序和 session 定位也高度专用。

### 12. `launch-subagent`

- **启动方式：**语义路由；任何准备启动子 Agent 的请求都应先读，但正文又要求必须由用户明确授权。
- **调度链：**判断是否值得委派 → 只拆无依赖、边界明确的任务 → 为子 Agent 写全量 brief → 分隔文件所有权 → 并行运行 → 主 Agent 集成和复核。
- **实现载体：**治理策略，不包含实际 spawn 工具调用。模型选择、授权和并行限制都由宿主实现。
- **完成信号：**子任务返回短而具体的结果，主 Agent 完成验证和整合。
- **心里要有底：**模型白名单是作者个人偏好且会过时。真正可复用的是“子 Agent 无上下文、只委派独立任务、主 Agent 负责验收”三条原则。

### 13. `run-deep-swe`

- **启动方式：**手动。
- **调度链：**检查 uv/Git/Docker/API Key → 安装 DeepSWE/Pier → 确认模型 slug → 单任务 smoke test → 固定种子小样本 → 用户批准后才跑完整 113 项 → 用 Pier 分析 jobs。
- **实现载体：**外部 DeepSWE 仓库、Pier、mini-swe-agent、Docker/Modal 和 OpenRouter API；本 Skill 只是可复现命令编排。
- **完成信号：**记录精确命令、任务数、随机种子、模型路由、score、trajectory 和失败原因。
- **心里要有底：**完整评测花费时间与 token，必须先 smoke test 并再次确认。它测试的是“模型 + agent harness + sandbox + 配置”的组合，不是纯模型智力。

## B. 运维与设置（11）

### 14. `anti-sleep`

- **启动方式：**语义路由；Mac 防休眠、长构建、过夜任务等命中。
- **调度链：**`status` → 若已有会话则替换 → `start <seconds>` 或 `start-pid` → 独立调用 `verify` → 到期后 LaunchAgent 不再运行，或用户调用 `stop`。
- **实现载体：**仓库自带约 340 行 shell 脚本。它加锁、生成一次性 plist、写状态文件、用 `launchctl bootstrap` 启动 `caffeinate`，按精确 label/PID 停止，避免宽泛 `pkill`。
- **完成信号：**`verify` 同时返回运行状态和 assertion flags，且 PID、到期时间正确。
- **心里要有底：**这是少数真正“代码实现”的 Skill，但完全绑定 macOS launchd/caffeinate。自动替换已有会话属于状态变更；Windows 要重新实现为电源 API/受控后台任务，不能翻译几条命令了事。

### 15. `create-readonly-db-role`

- **启动方式：**语义路由。
- **调度链：**检查角色是否存在 → 与用户确定敏感表 denylist → 把 SQL 写进仓库文档 → 由人类在生产库执行 DDL → 本地保存只读连接串 → 运行双层写入阻断、敏感表拒绝和查询超时验证 → 再创建项目专用查询 Skill。
- **实现载体：**Postgres grants、default privileges、`default_transaction_read_only`、statement timeout 和可选 `bypassrls`；没有自动执行脚本。
- **完成信号：**写操作分别被只读事务和权限两层阻断，denylist/auth schema 不可见，正常表能读到真实数据。
- **心里要有底：**“未来表默认可读 + 敏感表 denylist”需要持续维护；`bypassrls` 会放大数据可见范围。最稳妥之处是明确规定 Agent 不运行生产 DDL，由人类应用。

### 16. `cyber-audit`

- **启动方式：**手动。
- **调度链：**从公告提取包名、版本、平台和攻击面 → 只选择相关的只读检查并行执行 → 汇总版本、路径、进程、端口和配置 → 写一份日期化报告 → 给出 affected/partially/not affected 结论。
- **实现载体：**系统只读命令菜单和固定 Markdown 模板；允许写入的唯一位置是作者的安全审计目录。
- **完成信号：**每次调用都落一份报告，即使结论是不受影响；任何需要安装、升级、重启或网络访问的检查都明确标记未执行。
- **心里要有底：**Mac 路径和包管理器强绑定；安全公告本身需要实时、可信来源。它是暴露面核查，不是恶意软件查杀或漏洞利用验证。

### 17. `global-agent-guardrails`

- **启动方式：**语义路由；配置或调试命令安全 Hook 时使用。
- **调度链：**所有 Agent 在 Shell 工具执行前把命令 JSON 交给 Hook → Hook 从统一 patterns 文件逐行匹配 → 命中则按各宿主协议阻断 → 未命中放行 → 修改 pattern 后运行允许/阻断测试和多语言正则编译验证。
- **实现载体：**根目录提供 `deny-dangerous.sh` 示例：用 `jq` 兼容三种 payload 路径、用 POSIX ERE denylist 检测、Claude/Codex 用退出码 2、Cursor 用 deny JSON；其他 Agent 需要 TypeScript/Python adapter。
- **完成信号：**测试套件零失败，并在非 Git 临时目录用无害的 `git push --force` 探针验证每个 Agent 真正阻断。
- **心里要有底：**正则 Hook 是安全带，不是沙箱；混淆命令或用 Python 删除文件可能绕过。示例在缺少 `jq`/patterns 时 fail-open，部分后台 Agent 根本不经过本地 Hook。

### 18. `google-safe-browsing`

- **启动方式：**语义路由；新公共网站、登录页、危险网站提示等命中。
- **调度链：**查询 apex 与 www 的 Safe Browsing 状态 → 匿名抓取 Googlebot 可见页面 → 判断品牌、登录表单、重定向和用户内容风险 → 修改并部署公共表面 → 人类在 Search Console 发起复审 → 轮询到状态恢复。
- **实现载体：**Google Transparency Report 查询、curl/WHOIS、站点修改部署和 Search Console 人工流程。
- **完成信号：**API 状态恢复 clean，浏览器不再出现红色拦截页。
- **心里要有底：**这是分类与申诉流程，不是代码漏洞排查。政策和接口会变化，执行时必须重新核实官方规则；含他人商标的域名即使暂时解封也可能反复被标记。

### 19. `macbook-metrics-setup`

- **启动方式：**语义路由。
- **调度链：**按架构新建 Swift collector → `collect` 每分钟采样一次写 SQLite → launchd 每 60 秒启动一次短进程 → 第二个 launchd 每三小时安全快照 DB 并推到私有 GitHub → doctor/最新时间戳持续验收。
- **实现载体：**这是建造说明，不包含完整 collector 源码。建议 SwiftPM、IOKit/Mach、SQLite WAL、rollup 表、两个 LaunchAgent 和 Git 备份脚本。
- **完成信号：**launchd 上次退出码 0、数据库最新样本小于一分钟、doctor 能暴露失效的私有指标读取。
- **心里要有底：**“持续调度”来自 launchd，不来自 Agent。指标会泄露作息，备份仓库必须私有；GPU/SMC 等未公开接口要允许 null，不能伪造数值。

### 20. `nuke-cursor-app`

- **启动方式：**手动，只有明确说 `/nuke-cursor-app` 或 “nuke cursor” 才运行。
- **调度链：**按 Cursor.app bundle path 列出进程 → 先 AppleScript 优雅退出 → 等待三秒 → 精确 `pkill` bundle path → 检查残留 → 必要时逐 PID `kill -9` → 最终空列表验证。
- **实现载体：**macOS 进程和 AppleScript 命令，无捆绑脚本。
- **完成信号：**Cursor bundle 下所有进程消失。
- **心里要有底：**会终止本地 Agent 和未保存状态，是明显破坏性操作。按 bundle path 精确匹配的思想可复用，但 Windows 实现和确认规则必须重写。

### 21. `pi-custom-model`

- **启动方式：**手动。
- **调度链：**确认真实 provider/model slug → 检查认证 → 把模型元数据写入 Pi `models.json` → 在 `settings.json` 设置完全相同的默认 ID → 重启 Pi → 列表与实际调用验证。
- **实现载体：**Pi 全局 JSON 配置和其内置 provider registry；没有程序，只是精确配置修复。
- **完成信号：**`pi --list-models` 能找到完整 ID，重启后 footer/调用没有静默回退。
- **心里要有底：**这是 Pi 专用问题。成本、上下文、兼容字段应复制真实基础模型而不是猜；只改 defaultModel 不注册模型不会生效。

### 22. `prod-push`

- **启动方式：**语义路由，但正文明确只有用户说 push/ship/deploy 后才可执行。
- **调度链：**确认主检出和 main → 检查身份、事故状态和干净树 → 只暂存自己的文件 → commit/pull-rebase/push → 按精确 SHA 找 CI 并 watch → 查 Vercel deployment → 健康检查 → 失败则修复后从新 SHA 重启循环。
- **实现载体：**作者 DeepAPI 仓库的 Git、GitHub Actions、Vercel 和健康接口操作手册，没有通用脚本。
- **完成信号：**同一个最终 SHA 同时满足 CI 绿色、Production deployment success、生产 health OK。
- **心里要有底：**这是高度项目化的生产 runbook，写死作者身份、main 直推、工作流名、Vercel 项目和事故机制。可借鉴“追踪精确 SHA 到生产”，不能复制其直推策略。

### 23. `read-prod-database`

- **启动方式：**语义路由。
- **调度链：**读取只读 URL → 验证 current_user → 每次明确 customer-only 或 all-workspaces 统计口径 → 查 schema/migration → 执行带过滤和 limit 的 SELECT → 在答案中标注口径。
- **实现载体：**`psql` 和作者 DeepAPI 数据模型；安全边界依赖前一个只读角色真正配置正确。
- **完成信号：**查询在 10 秒内返回、口径清晰、没有 PII 被写入代码/文档；拒绝或超时按规则处理。
- **心里要有底：**项目表名、内部 workspace 和公司域名全部是作者专用。`bypassrls` 意味着读权限很广，聊天内容同样需要数据最小化。

### 24. `setup-help`

- **启动方式：**手动。
- **调度链：**Agent 内部维护完整 checklist → 每轮只展示一个原子步骤和最多八项剩余标题 → 用户确认完成 → 推进到下一步 → 发现新前置条件时插入正确位置 → 清单归零时结束。
- **实现载体：**纯对话状态机，没有持久文件或脚本。状态依赖当前会话上下文。
- **完成信号：**canonical checklist 所有项目完成，而不是剩余列表碰巧为空。
- **心里要有底：**它优化的是非技术用户的认知负担。长时间或跨会话设置最好把 canonical checklist 持久化，否则上下文压缩后可能丢步骤。

## C. 研究与网络（8）

### 25. `browser-harness`

- **启动方式：**语义路由；需要点击、登录态、表单、JS 页面或视觉验证时使用；纯内容读取先路由到抓取 API。
- **调度链：**连接用户已运行 Chrome/Brave 的 CDP → `new_tab` 避免覆盖当前标签 → 截图理解页面 → 坐标点击/键盘输入 → 每个重要动作后重截图 → 必要时 DOM/原始 CDP → 读取结果。
- **实现载体：**假设系统已安装 `browser-harness` Python CLI 和 daemon，仓库只带操作说明与安装 reference；远程并行浏览器通过 `BU_NAME` 隔离并由 Browser Use API 计费。
- **完成信号：**截图、页面信息、Agent 状态或提取文件证明页面达到目标状态；不能只凭 click 命令无报错。
- **心里要有底：**会接触真实登录会话，权限面很大。其“坐标优先”与我们当前语义浏览器方式不同；登录墙应停下让用户登录，不能从页面读取或填写凭据。

### 26. `deepapi`

- **启动方式：**广泛语义路由；它试图接管普通搜索、深度研究、网站/平台抓取、邮件、图片、部署、记忆和 X 发帖。
- **调度链：**先按目标平台选择最窄 endpoint → 检查环境与 Skill 版本 → 可先 dry-run 估价 → POST 带 bearer、版本头和唯一幂等键 → 若 `running` 按 `next.afterSecs/path` 轮询 → 根据结构化 error 自修请求或停止 → 返回 output/requestId。
- **实现载体：**约 1,432 行的远端 API 手册，覆盖数十个 endpoint；Skill 本身没有 SDK，只用 curl/JSON。它还要求发现版本漂移时从 deepapi.co 覆盖更新自身。
- **完成信号：**请求进入 `succeeded/failed` 终态，输出可用；发送邮件、部署、发 X 等副作用还必须有对应远端资源证据。
- **心里要有底：**这是典型“mega skill”，既是路由器又是 API 文档，和其自己提倡的一 Skill 一职责相矛盾。费用、API Key、外部数据处理、邮件/发帖/部署写操作风险都很高；自动覆盖 Skill 也破坏版本锁定和本地审计，应拆分并固定版本。

### 27. `deep-research`

- **启动方式：**手动。
- **调度链：**按 `research-prompt` 生成一个完整段落 → 写请求体 → POST DeepAPI 并保存幂等键 → 等待最多约一分钟 → 读取 answer/sources → 保存带引用 Markdown；大主题拆成多个子问题并最终综合。
- **实现载体：**DeepAPI `/v1/research/deep`、curl、jq 和临时文件；每次调用有预算上限。
- **完成信号：**状态成功、报告文件存在、引用 URL 可列出；失败时报告 requestId/error，不无限重试。
- **心里要有底：**单次输出约 700 词，复杂问题需要多次付费请求。幂等键防止重试重复收费，但不同子问题必须用不同键。

### 28. `fireflies-transcript`

- **启动方式：**语义路由。
- **调度链：**加载 Fireflies Key → GraphQL 列最近会议并本地匹配日期/标题 → 用 meeting ID 拉 sentences → 写入临时/项目文件 → 检查句子数、说话人和主题。
- **实现载体：**Fireflies GraphQL API、curl 和 jq；只读。
- **完成信号：**sentence count > 0，前几行与用户指定会议匹配，长内容保存到文件而非灌入聊天上下文。
- **心里要有底：**标题过滤是精确匹配，临时会议标题不可靠；会议内容可能含高度敏感信息，必须获得授权并限制保存位置。

### 29. `online-shopping`

- **启动方式：**语义路由；任何购买、比价、商品截图或店铺可信度问题都可能触发。
- **调度链：**先给 1–2 句初步判断 → 推断购买用途、国家和优先级 → 按价格分层决定零搜索/一次搜索/多搜索+抓取/深度研究 → 比较真实价格和店铺信号 → 输出一屏内结论。
- **实现载体：**Agent 判断 + DeepAPI 搜索、抓取、研究和社交反馈 endpoint；明确禁止下单、支付、注册账户。
- **完成信号：**给出 fair price、2–3 个真实购买来源和不可信店铺提醒，所有价格来自实际结果。
- **心里要有底：**研究强度与商品价格绑定是很好的成本控制，但硬编码“优先 Fable”和只能用 DeepAPI 是作者偏好。真正推荐时价格和库存必须实时核验。

### 30. `pi-web-search`

- **启动方式：**语义路由，但只适用于 Pi Agent。
- **调度链：**根据用户措辞设定最少查询数（普通 2、广泛 4、deep 8）→ 分批 `web_search(workflow:none)` → 需要代码用 `code_search`，需要正文用 `fetch_content` → 大页面按需续取 → 结果不足时 DeepAPI fallback。
- **实现载体：**全局 `pi-web-access` 包，默认 Exa，失败后 Perplexity/Gemini；GitHub URL 会 clone，PDF/YouTube 有特定处理。
- **完成信号：**达到最少多角度查询数并综合带引用结果；大内容没有无节制塞进上下文。
- **心里要有底：**查询数量是机械下限，不保证研究质量。`workflow:none` 是为了避免弹出交互 UI；这套工具名与 Codex 不兼容，只参考路由思想。

### 31. `research-prompt`

- **启动方式：**语义路由。
- **调度链：**读取项目上下文 → 识别唯一研究决策 → 写 3–6 个内联编号子问题 → 加范围、来源层级、矛盾处理和完成标准 → 压缩成一个自包含段落。
- **实现载体：**纯提示编译器，不执行搜索；产物可交给人类研究员或 `deep-research`。
- **完成信号：**研究者零背景也无需追问，最终段落覆盖目标、上下文、子问题、证据标准和固定输出格式。
- **心里要有底：**最有价值的是把“研究主题”改成“支持某项决策的可验证任务”。强制一段落适合 API 字段，但不一定适合所有人类研究 brief。

### 32. `youtube-transcript`

- **启动方式：**语义路由。
- **调度链：**确定输出目录和文件名 → DeepAPI POST + 幂等键 → `running` 时轮询 → 提取 text/segments → 保存；Key 缺失、余额不足或连续失败时才转 `yt-dlp` → json3 去重并扁平化。
- **实现载体：**DeepAPI、yt-dlp、jq 和一个内联 Python 文本清洗片段。
- **完成信号：**`Channel_Title.txt` 存在且非空；无字幕则明确报告，不循环重试。
- **心里要有底：**本地 YouTube 下载容易遇到 429/机器人验证，必须停止而非猛烈重试。音频下载+Whisper 不在默认授权范围。

## D. Skill 创作（4）

### 33. `distribute-skill-to-all-agents`

- **启动方式：**语义路由；用户要求同步/分发 Skill 时使用。
- **调度链：**在 `~/.agents/skills` 创作 canonical copy → 检查 Claude 与 Pi symlink → 只复制到独立 Hermes 目录 → 对四个路径比较字节数 → Hermes 新会话重载。
- **实现载体：**文件复制、symlink、`cp/rsync` 和四个产品的固定目录约定。
- **完成信号：**四处 `SKILL.md` 字节数一致，symlink 没有被误当普通目录。
- **心里要有底：**这是作者机器布局，不是 Agent Skills 标准的一部分。Windows symlink、Codex 本机目录和插件缓存策略不同，应该由安装器/插件机制管理，而不是照搬四份。

### 34. `effective-agent-skills`

- **启动方式：**语义路由；创建、修改、评审、调试 Skill 时加载。
- **调度链：**发现重复失败 → 判断 capability/process primitive → 先写 description 路由契约 → 写最小正文 → 确定性逻辑下沉脚本 → 引用资料按需加载 → 测试应该触发/不该触发/执行结果/对抗边界 → 版本控制。
- **实现载体：**纯方法论，是整个仓库的“Skill 编译规范”。它解释 discovery、activation、execution 三级渐进披露，以及 OpenAI/Claude 手动调用配置差异。
- **完成信号：**名称/目录合法、路由准确、执行可验证、失败方式明确、弱模型也能运行、第三方脚本经过审计。
- **心里要有底：**这是库中普适价值最高的内容，但仓库自己也违反了部分原则，例如 `deepapi` 过长、绝对路径和时间敏感模型名较多。应把它作为检查表，不把作者实践视为全部合格样本。

### 35. `folder-specific-claude-and-agents-md`

- **启动方式：**语义路由，也声明为 user-invocable。
- **调度链：**确认目标目录值得长期说明 → 读目录关键文件 → 先向用户展示候选内容 → 用户反馈迭代 → 写简短 `CLAUDE.md` → 创建指向它的 `AGENTS.md` symlink → 验证。
- **实现载体：**文件读取、Markdown 写入和 symlink；重点保存不能从代码直接推导的约束、决策与用户偏好。
- **完成信号：**两文件指向同一内容，用户批准的约束被记录且不重复根级说明。
- **心里要有底：**要求“读每个文件全文”和固定 `~/Documents/code/workspace` 路径可能代价很大且不可移植。对 Codex 更适合以 `AGENTS.md` 为主，并依据目录规模选择性读取。

### 36. `push-skill-to-github`

- **启动方式：**语义路由，但只有用户明确要求 push 才执行。
- **调度链：**进入作者的 canonical 私有 skills repo → 查看状态 → 只暂存相关 Skill → commit → push → 检查输出 `main -> main`；公共镜像由作者私有流水线自动生成。
- **实现载体：**普通 Git CLI，无脚本。
- **完成信号：**远端 main 更新且 push 输出明确成功。
- **心里要有底：**仓库名、目录、直接 main 推送和自动脱敏镜像全部是作者私人基础设施。我们应使用当前仓库的分支/PR/审查流程，不能复制这个发布策略。

## E. 思考与文档（11）

### 37. `before-building`

- **启动方式：**手动。
- **调度链：**收到构建想法后立即停止工具调用 → 只基于用户刚说的话提出 1–3 个后果最大的隐藏选择 → 每个给选项和直觉建议 → 等用户决定。
- **实现载体：**单轮提示规则，无文件和工具。
- **完成信号：**关键分叉在编码前暴露，Agent 没有提前实施。
- **心里要有底：**速度优先意味着没有代码证据，适合早期产品分叉，不适合技术可行性判断。和默认“能合理假设就推进”风格存在张力，应只在真正会改变方案时用。

### 38. `brain-to-docs`

- **启动方式：**语义路由。
- **调度链：**每轮先读 README/ADR → 一次提出五个不同角度的问题 → 用户任选回答 → 每个答案后立刻更新 README 或新 ADR → 再读最新文档 → 重复到用户说结束。
- **实现载体：**多轮访谈 + Git 管理的 Markdown 文件；文件就是跨会话状态。
- **完成信号：**愿景进入 README，决定进入编号 ADR，且每次回答都已经落盘。
- **心里要有底：**它默认把大量回答写成 ADR，容易制造文档噪音，也写死“不主动挑战用户”。我们应先判断哪些决定确实长期、跨会话且需要审计。

### 39. `decisions`

- **启动方式：**手动。
- **调度链：**回顾当前工作 → 只筛选重要且不确定的选择 → 排除已有明显最佳方案的选择 → 简短列出替代项。
- **实现载体：**单轮自我审查提示，不读取项目决策日志，也不自动保存。
- **完成信号：**用户看到少量真正需要复核的判断，而不是完整变更清单。
- **心里要有底：**模型对自己的“不确定性”估计不总可靠，最好结合 diff、测试和外部 reviewer；与 `next-decision` 的区别是它回顾已做选择。

### 40. `level-up`

- **启动方式：**手动。
- **调度链：**读 knowledge/learning-plan → 按历史水平选择新领域 → 七题严格一题一轮、答好升级/答弱降级 → 每题评分和短教学 → 立即把原话、评分、缺口写文件 → 第七题后生成综合画像。
- **实现载体：**对话状态机 + 两个持久 Markdown 文件。
- **完成信号：**七个问答均落盘，学习计划只新增真实缺口，并有总体分数、优势和重复模式。
- **心里要有底：**作者把用户定位为“用 Agent 架构而非写代码”，问题设计强个人化。评分是模型判断而非标准化测验，适合趋势跟踪，不适合作权威能力认证。

### 41. `next-decision`

- **启动方式：**语义路由。
- **调度链：**从计划/上下文找当前最重要未决项 → 给四个选项和推荐 → 停止等待用户 → 记录答案 → 下一轮再取下一个决策。
- **实现载体：**多轮对话状态机；有计划文档时以文档持久化，没有则依赖会话。
- **完成信号：**一次只关闭一个决定，记录与后续计划一致。
- **心里要有底：**固定四个选项可能人为限制方案空间；对二元决定或开放探索应调整。它是前瞻决策，`decisions` 是事后复盘。

### 42. `prompt-me`

- **启动方式：**语义路由。
- **调度链：**当前只有“采访用户，挖出优先级、回避事项和真正重要工作”的概念，没有题数、逐轮规则、保存位置和结束条件。
- **实现载体：**草稿级提示说明。
- **完成信号：**源码没有定义。
- **心里要有底：**这是 47 项中成熟度最低的之一。它更像 Skill idea，不是可靠 SOP；若要使用，应补充问题策略、记录结构、停止条件和对用户回答的更新机制。

### 43. `read-all-adrs`

- **启动方式：**手动。
- **调度链：**枚举 `docs/adr/*.md` → 每个从头到尾读取。
- **实现载体：**一句强制性提示，没有脚本、摘要格式、冲突检查和完成验证；源码仍含 TODO。
- **完成信号：**理论上应核对读取文件数和清单，但原 Skill 没写。
- **心里要有底：**意图合理，实现在规范上很弱。大型 ADR 集合会占满上下文；更稳妥的做法是先索引，再按当前任务加载必要 ADR，同时明确遗漏检查。

### 44. `remind`

- **启动方式：**手动。
- **调度链：**回看首次用户消息和最近回答 → 先写 3–5 句上下文 TLDR → 把上一回答改短、改简单 → 输出。
- **实现载体：**纯文本重写，无工具和文件。
- **完成信号：**保留实质、首个目标和当前下一步，同时明显更短。
- **心里要有底：**长会话里“重复第一条消息”可能与当前目标无关；压缩后的上下文也可能陈旧。更适合用户主动找回方向时使用。

### 45. `save-idea`

- **启动方式：**语义路由；`/save-idea`、video idea、topic 等触发。
- **调度链：**保留用户原话 → 按 `video:`/`topic:` 或规模路由到两个文件 → 读取最后编号 → 只追加新条目 → 生成 repo/chat/date 来源行 → 确认编号和文件。
- **实现载体：**作者 `~/content` 下两个 Markdown backlog 文件；跨会话状态由编号和 append-only 文件维持。
- **完成信号：**新编号唯一、原话未改、来源完整、旧条目未重排。
- **心里要有底：**目录和分类是作者个人内容系统。可复用的是“原话保存、append-only、带来源”，本地化前要换成我们的知识库路径和分类法。

### 46. `short`

- **启动方式：**手动。
- **调度链：**读取上一回答 → 去掉填充、简化措辞、压缩长度 → 不执行其他动作。
- **实现载体：**单句提示。
- **完成信号：**语义保留但更短。
- **心里要有底：**这是风格指令而非真正能力，按其自己的 `effective-agent-skills` 标准更适合用户偏好或系统设置。作为手动快捷键仍有便利价值。

### 47. `teach`

- **启动方式：**手动。
- **调度链：**读取/建立 MISSION、RESOURCES、learning-records、NOTES → 先确认学习动机和可信资料 → 判断最近发展区 → 每次生成一个短 HTML lesson → 通过测验/任务形成即时反馈 → 把关键知识压缩进 reference，把学习进展写 record → 后续会话继续读取。
- **实现载体：**持久教学工作区和四份格式 reference；主要输出是编号 HTML 课程，而不是聊天长文。
- **完成信号：**课程与 mission 对齐、有可信来源、有练习和反馈，学习记录/参考材料同步更新。
- **心里要有底：**这是一个小型学习管理系统，远超普通单 Skill，实施成本较高。强项是长期状态和检索练习；风险是文件体系过重、研究质量和教学评估仍依赖 Agent 判断。

## 综合判断：哪些是真的“会运行”，哪些主要是“教 Agent 怎么做”

| 层级 | 代表能力 | 判断 |
|---|---|---|
| 有仓库内确定性脚本 | `anti-sleep`、`corral-launch-agents` | 最接近软件组件，但平台耦合很强 |
| 调用成熟外部工具/API | `deepapi`、`browser-harness`、`herdr`、`codex-subagent`、`run-deep-swe` | 能力来自外部系统，Skill 是调度说明 |
| 持久文件工作流 | `handoff`、`teach`、`level-up`、`brain-to-docs`、`save-idea` | 通过文件解决跨会话状态问题 |
| 纯方法/提示纪律 | `effective-agent-skills`、`research-prompt`、`before-building`、`decisions`、`short` | 不新增工具能力，只改变思考和输出过程 |
| 草稿或薄包装 | `prompt-me`、`read-all-adrs`、`fable-review`、`gpt-review` | 需要宿主能力或进一步补齐才能可靠执行 |

## 对我们最稳妥的采用顺序

1. 先吸收不依赖作者平台的契约：`effective-agent-skills`、`goal-loop`、`handoff`、`research-prompt`、`before-building`。
2. 再把原生 Codex 已有能力映射进去：子 Agent、浏览器、自动化、Goal、GitHub 发布、Skill/插件运行时。
3. 只有真实项目出现重复需求时，才改造平台 Skill：数据库只读、生产发布、转录、比价、外部 API、终端编排。
4. 对任何自动批准、生产权限、凭据、付费 API、自更新 Skill 和破坏性命令，保留独立审批与沙箱，不让文字规则替代技术边界。
5. 对 `prompt-me`、`read-all-adrs`、review wrappers 等薄 Skill，先补充输入、执行器、完成标准和失败处理，再考虑安装。

最终可以把这 47 项理解成：**2 个捆绑脚本 + 一批外部工具 runbook + 一批对话/文档状态机 + 一批思考纪律**。它看起来像完整 Agent，是因为它覆盖了通用 Agent 的工作面；真正的模型、工具、权限、沙箱、时钟和持久化仍由 Codex、操作系统或第三方服务提供。
