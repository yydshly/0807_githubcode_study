# LiveKit Agents 本地部署与真实房间演示

> 上游项目：[livekit/agents](https://github.com/livekit/agents)
>
> 当前组合：`LiveKit Server 1.13.5` · `livekit-agents 1.6.8` · `livekit-client 2.21.0`
>
> GitHub Pages：[LiveKit Agents 专题页](https://yydshly.github.io/0807_githubcode_study/livekit-agents.html) · [产品能力页](https://yydshly.github.io/0807_githubcode_study/livekit-agents-study/local-app/product.html) · [研究控制台界面](https://yydshly.github.io/0807_githubcode_study/livekit-agents-study/local-app/index.html)
>
> 技术总结与产品边界：[TECHNICAL_SUMMARY.md](TECHNICAL_SUMMARY.md) · 本地真实链路：`http://127.0.0.1:17828/product.html`

**LiveKit Agents 是 LiveKit 实时应用中 AI Agent 的运行与编排核心。** 它管理 AI 怎样成为房间参与者、接收文字/音视频、组织回合、调用模型和工具、切换 Agent 角色，并由 Job/Worker 调度运行。它不自带 ASR、LLM、TTS 或业务数据，也不替代 LiveKit Server、权限系统和业务控制面。

第一次了解本库，建议按这个顺序阅读：

1. [技术总结与产品边界](TECHNICAL_SUMMARY.md)：先理解库、媒体服务器、模型和业务系统的职责；
2. `http://127.0.0.1:17828/product.html`：运行后查看产品能力与三类场景预览；
3. `http://127.0.0.1:17828/`：进入研究控制台验证真实房间、工具、handoff、工作流、Worker 和视觉；
4. [能力矩阵](CAPABILITY_MATRIX.md) 与 [实测报告](REPORT.md)：核对证据和未完成边界。

## 现在已经做到什么

这不再只是静态回放。当前子项目已经能在 Windows 本机运行完整的 LiveKit 房间基础链路：

```text
浏览器
  ├─ 向本地后端申请临时 Token
  ├─ 加入唯一 LiveKit Room
  ├─ 发布/关闭真实麦克风轨道
  └─ 通过 LiveKit 数据通道发送文字
         ↓
LiveKit Server 1.13.5（127.0.0.1:7880）
         ↓
LiveKit Agent Worker
  ├─ 经自动或显式调度成为第二个 Participant
  ├─ AgentSession 接收文字
  ├─ 调用 Python 工具读取真实房间参与者
  ├─ 在同一会话中 handoff 到不同专家 Agent
  └─ 通过 lk.transcription Text Stream 返回回答
```

当前有三种 Agent：

- `local_text_agent.py`：不需要任何云 Key，真实入房、真实调用工具，但只接受文字；
- `minimax_agent.py`：使用小米 MiMo-V2.5-ASR 识别麦克风、MiniMax M3 生成回答、Speech 2.8 合成语音；未配置小米 Key 时自动退回文字输入；
- `voice_agent_template.py`：使用 OpenAI Realtime 进行真实语音理解和回答，需要你自己的 `OPENAI_API_KEY`。

本地部署 LiveKit 只解决房间、参与者和实时媒体传输，不会自动附带 STT、LLM 或 TTS 模型。

## 直接开始

首次从总仓库运行时，进入子项目并安装依赖：

```powershell
cd .\livekit-agents-study
.\install-local.cmd
```

不配置云 Key 也可以先启动真实房间和基础文字 Agent：

```powershell
.\start-local.cmd
```

已经在被 Git 忽略的 `.env.local` 中配置 MiniMax 与小米 MiMo Key 时，再启动完整的稳定单轮语音模式：

```powershell
.\start-minimax-local.cmd
```

MiniMax 研究模式默认启动两个同名 Worker；可用 `-MiniMaxWorkers 1` 到 `4` 调整本机副本数。

终端保持打开。先访问产品说明，再按需要进入真实实验：

```text
http://127.0.0.1:17828/product.html  产品能力演示（不调用模型或媒体权限）
http://127.0.0.1:17828/
```

控制台固定使用 `17828`，避开 Windows 常见的动态保留端口段；旧地址 `49328` 在部分启动周期会被系统临时保留，从而出现“服务明明启动过但页面拒绝连接”。

页面中的操作顺序：

1. 确认三个状态卡中 LiveKit Server 和 Token Service 为绿色；
2. 点击“加入真实房间”，先观察房间保持为 1 人；
3. 点击“调度命名 Agent”，等待 Agent 成为第二个参与者，并观察 Dispatch、Job 与 Worker ID；
4. 在 `CAPABILITY LAB` 点击“读取真实房间”，观察 SDK 工具执行证据和实际房间回答；
5. 点击“交给工作流专家”，观察当前角色从 `research-guide` 切换到 `workflow-specialist`；
6. 可点击“返回研究向导”验证反向 handoff；
7. 可选：点击“开始说一句”体验小米 MiMo ASR → MiniMax M3 → TTS；
8. 完成后点击“离开”。

## 第二阶段：研究库能力

本阶段不再只证明“AI 能在房间里说话”，而是逐项验证 LiveKit Agents 相比普通聊天接口多出的框架能力。页面现在提供三个可重复实验：真实 Function Tool、研究向导到工作流专家的 Agent handoff、专家返回研究向导。实验只有收到 LiveKit Agents SDK 发出的执行事件才会显示“已验证”，不会根据模型回答文字自行判断。

完整分类、扩展点和后续实验见 [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md)。目前已验证工具调用、双向 Agent handoff、有状态工作流、本机持久化恢复、参与者隔离、过期终态、陈旧写保护、命名 Agent 显式调度、Worker 池负载分配、满载保护、显式故障恢复，以及按需单帧视觉理解。连续视频理解、SIP、可靠自动重派和生产部署仍明确标为后续方向。

## 第三阶段：有业务状态的工作流

页面的预约实验验证了一个任务对象可以跨三个 Agent 保持一致：

```text
research-guide
  → start_appointment_workflow
appointment-intake
  → submit_appointment_draft(name, time, request)
appointment-review
  → confirm_appointment
research-guide
```

示例草稿包含姓名、预约时间和需求。第三阶段先验证同一个 Python 状态对象跨 Agent 传递；第四阶段再把它升级为本机 SQLite 记录。页面会显示 workflow ID、版本和五步状态，并提供暂停、恢复、过期与取消。服务重启后可恢复当前参与者最近一个未完成任务；第六阶段的确认必须先进入人工审批门。批准、拒绝、取消和过期是终态。这里的 SQLite 只用于单机研究，不会创建生产预约；本地 identity 隔离和乐观并发仍不等于登录鉴权、生产数据库或分布式锁。

## 第四阶段：可恢复工作流

真实验收链路如下：

```text
创建 apt-d8866c3c → 写入三项字段 → 暂停（version 3）
停止并重启 LiveKit / 网页 / Agent
新房间恢复同一 ID（version 4）→ 确认（version 5）
新建 apt-324855c7 → 取消 → 不再进入可恢复集合
```

SQLite 文件位于 `.local-state/workflows.sqlite3`，该目录已被 Git 忽略。`tests/test_workflow_store.py` 还验证了 store 重建后的恢复、重复确认只有一条记录、取消任务不可恢复。

## 第五阶段：身份隔离与生命周期安全

第五阶段研究的是“多个参与者和长任务会不会串数据”。每个预约任务现在绑定 LiveKit 参与者 identity；恢复和写入只能命中自己的记录。浏览器 identity 在当前标签页会话中保持稳定，但每次重新加载都会使用新房间，既能恢复同一任务，也能单独验证新的显式房间调度。

真实验收链路如下：

```text
visitor-1b2dcac4 创建 apt-3dff5a54（version 1）
刷新页面 → 新房间、同一 identity → 恢复同一任务
visitor-82ae2a60 尝试恢复 → 名下没有任务
提交草稿（version 2）→ 用 version 1 写入 → 被拒绝且内容不变
标记过期（version 3）→ 返回研究向导 → 再次恢复为空
```

每次写入都携带 `expected_version`，SQLite 只在版本相符时更新；旧页面或迟到请求不能静默覆盖新数据。未完成任务有 `expires_at`，超时或显式过期后不会再进入恢复集合。页面会显示所有者、版本、有效期和冲突反馈。身份目前来自浏览器本地会话，不是正式登录凭据，因此生产场景仍需服务端认证、租户范围、审计和生产数据库。

## 第六阶段：人工审批门与审计

审核 Agent 现在不再拥有直接确认工具。草稿必须先调用 `request_appointment_approval` 进入 `pending_approval`，然后 handoff 到只拥有 `approve_appointment` 和 `reject_appointment` 的 `appointment-approval`。页面仅在这个状态显示“人工批准/人工拒绝”，因此模型不能在审核阶段自行越过高风险决策点。

SQLite 新增追加式审计表，记录 event ID、workflow ID、操作者、动作、前后状态、版本、原因和时间。真实验收完成了两条分支：

```text
apt-e24fdf7a：review → pending_approval → confirmed
决策者：human:visitor-1e29df95

apt-c6e20814：review → pending_approval → rejected
决策者：human:visitor-1e29df95
原因：需要重新确认演示时间
```

待审批任务也可跨新房间恢复到同一个 Approval Agent，并重放完整审计时间线。当前页面保留 `apt-0546487f / version 3 / pending_approval`，可直接体验批准或拒绝。这里的 `human:*` 只证明决策来自本地页面参与者，不是生产身份认证；正式系统仍需可信登录、审批权限、不可篡改日志、通知和合规留存。

## 第七阶段：命名 Agent 与显式调度

MiniMax Worker 现在以 `livekit-research-minimax` 注册。命名 Worker 不会自动进入新房间：浏览器先作为唯一参与者加入，再由本地后端调用 LiveKit `AgentDispatch.createDispatch`，把指定 Agent 派进指定房间。页面会显示 `agent_name`、Dispatch ID、Job ID/状态和 Worker ID；Agent 进程还会从真实 `JobContext` 回报同一个 Job，避免只相信前端或接口文案。

真实浏览器同时保持了两个房间：

```text
local-demo-5b97a992 → AD_tNNyo2KbtMJW → AJ_Wra7EzhNYZQD
local-demo-f7d41324 → AD_JPXCjz5xjvuz → AJ_4GgPvWiUoyDD
共同 Worker：AW_w7xmknKTe877；两边均为 2 人 / running
```

随后第三个房间 `local-demo-22f0b634` 也由同一 Worker 接管，说明同一个 Worker 进程可以承载多个独立房间 Job。对第一个房间重复创建调度返回 HTTP 200、`created: false`，并复用原 Dispatch ID，不会重复派出第二个 Agent。这个实验验证的是任务路由和并发机制，不代表已经完成生产容量规划；负载阈值、拒绝任务、Worker 池、崩溃重派与跨机部署仍是下一阶段。

## 第八阶段：容量保护与等待任务重投

SDK 默认生产负载阈值是 `0.7`，默认负载函数读取系统 CPU。它适合通用保护，但无法稳定回答“这个 Worker 最多同时接几个房间”。本地研究模式因此把负载策略改为：

```text
worker_load = active_room_jobs / AGENT_MAX_CONCURRENT_JOBS
默认上限 = 2，load_threshold = 1.0
```

页面直接读取 AgentServer 自带的 `/worker` 状态，显示活动 Job、上限、负载和 `AVAILABLE/FULL`。真实实验中，前两个房间分别获得 running Job 后，Worker 为 `2/2、100%、FULL`；第三个房间只创建了 Dispatch，没有 Job，保持 1 位参与者，证明没有超额接单。

释放第一个房间后，Worker 恢复为 `1/2、50%、AVAILABLE`，但第三个无 Job Dispatch 等待 9 秒仍未自动重新投递。这说明这里不能当作可靠队列。页面会明确提示“重新提交等待任务”；点击后，本地后端删除旧等待 Dispatch、创建带 `retry_of` 元数据的新 Dispatch。真实结果：

```text
等待房间：local-demo-8debb104
旧 Dispatch：AD_hvCTqeYuLKT7（无 Job）
新 Dispatch：AD_dSHpuS2hBNiN
新 Job：AJ_QNF4g5zPCPKC / running
Worker：AW_GZViCBQwvJvQ
参与者：1 → 2
```

`AGENT_MAX_CONCURRENT_JOBS` 只是本地 Worker 的研究上限，不是 MiniMax 套餐并发额度。正式系统需要把等待任务、退避、最大重试、幂等键和失败终态放在自己的调度层。

## 第九阶段：Job 崩溃、陈旧状态与显式恢复

LiveKit Agents 1.6.8 在 Windows 默认使用线程执行房间 Job，直接终止会连 Worker 一起退出。本地研究 Worker 因此显式改为 `JobExecutorType.PROCESS`；故障按钮只在 `AGENT_FAILURE_LAB_ENABLED=true`、`ON_FAILURE` policy、独立进程和房间 Agent 在线时启用。

真实实验只终止了 `AJ_huqbzZugiuzo` 对应的 Job 子进程（退出码 70）：Worker `AW_8sCzgGEWjRLy`、LiveKit Server 和网页服务保持在线，Worker 容量从 `1/2` 回到 `0/2`，约 21 秒后 Agent 参与者离房。完整观察 30 秒后没有新 Job；更重要的是 Dispatch API 仍把旧 Job 报为 `running`，因此页面同时使用“房间是否还有 Agent”和 Worker 活动 Job 判断健康度，不再把这条陈旧 API 状态显示为可用。

页面随后提供显式恢复：后端先确认房间内没有 Agent、Worker 有空位，再删除陈旧 Dispatch 并创建携带 `recovery_of` 的新 `ON_FAILURE` Dispatch。真实结果：

```text
房间：local-demo-a46bd17b
旧 Dispatch / Job：AD_orcjUCdhDVeu / AJ_huqbzZugiuzo
新 Dispatch / Job：AD_c6AZRBXvPL2d / AJ_jmoRYJCML3MM
Worker：AW_8sCzgGEWjRLy（崩溃前后未变化）
参与者：2 → 1 → 2
```

结论不是“配置 ON_FAILURE 就一定自动重启”，而是：Job 进程隔离真实有效；当前本地 Server/SDK 组合没有完成自动替代和可靠终态同步；生产调度层必须以参与者心跳、Worker 活动 Job、超时和幂等重派共同判断。

## 第十阶段：同名 Worker 池与跨 Worker 恢复

MiniMax 研究模式现在默认启动两个相互独立、但都注册为 `livekit-research-minimax` 的 Worker。它们分别使用 `8081/worker`、`8082/worker` 状态端点和独立 ready 文件；页面聚合池容量，同时保留实例 ID、Worker ID、活动 Job 与在线状态。真实两个房间的分配结果是：

```text
local-demo-5d39b3c4 → worker-1 / AW_fryxW7rWPFyV / AJ_6ckJkwZmqAfn
local-demo-91e92e99 → worker-2 / AW_bowASz5ZzAmX / AJ_u5XFDHpLPLqY
池状态：2/2 Worker 在线，各 1/2 Job
```

这证明同名 Worker 不只是“随机副本”：当第一个实例已有 Job、第二个为空闲时，下一个房间实际落到了第二个实例。故障按钮只在两名 Worker 均在线、当前 Worker 恰好只承载这一项 Job 时启用。终止 `worker-1` 的进程树后，LiveKit Server、网页、`worker-2` 和它原有的第二个房间均保持在线；但 30 秒内没有自动跨 Worker 改派，旧 Dispatch 仍显示陈旧 `running`。

页面随后显式删除旧 Dispatch，创建新的 `ON_FAILURE` Dispatch；新 Job `AJ_UiKe5voup85m` 落到存活的 `AW_bowASz5ZzAmX`，房间从 2 人变 1 人再回到 2 人。降级为 1/2 Worker 后，真实 `smoke-minimax.cmd` 仍完成房间工具、MiniMax 文字、Speech 2.8 音频、状态与指标，`passed: true`。

因此，Worker 池已经证明了负载分配、单实例故障隔离与显式跨实例恢复；尚未证明的是可靠自动重派、跨机器部署、共享状态的分布式事务、心跳仲裁和滚动升级。生产系统应把这些能力放在自己的控制面，而不能只依赖 `restart_policy`。

终端按 `Ctrl+C` 可停止本次启动的进程；也可以另开终端运行：

```powershell
.\stop-local.cmd
```

重复运行 `start-local.cmd` 会被安全拒绝，避免启动第二套 Agent 或覆盖进程记录；需要重启时先执行停止命令。

## 一键启动包含哪些服务

| 服务 | 地址/方式 | 作用 |
|---|---|---|
| LiveKit Server | `ws://127.0.0.1:7880` | 房间信令、WebRTC 和数据通道 |
| 本地网页与 Token API | `http://127.0.0.1:17828` | 提供控制台并在后端签发短期 JWT |
| MiniMax 命名 Agent Worker 池 | 默认 2 个 LiveKit Agent Worker | 由本地后端显式调度到指定房间，执行语音、工具、handoff、工作流与单实例故障隔离 |
| Text Agent Worker | LiveKit Agent Worker | 非 MiniMax 基础模式下自动调度到新房间，执行无 Key 的工具循环 |

LiveKit 开发模式还会使用 `7881/TCP` 和 `7882/UDP` 传输媒体。所有服务默认只绑定本机地址，没有开放到局域网或公网。

## 安装、检查与测试

新电脑需要先安装 Git、Python、Node.js（含 npm）和 `uv`，然后运行：

```powershell
.\install-local.cmd
```

安装脚本会：

- 自动获取 LiveKit Agents 上游源码并固定到提交 `2f218b6fb9c9a65c8b8499c103aa1262cff73158`；已有源码版本不匹配时会安全停止，不覆盖本地改动；
- 下载 LiveKit 官方 Windows x64 `1.13.5` 发布包；
- 验证 SHA-256：`3ec7eaa76ef64063bf21f78364733703e0969612cb92ffd60661ed45fa4a8906`；
- 安装本地 editable `livekit-agents`、OpenAI/Anthropic 兼容插件、MiniMax TTS 插件与 Silero 停顿检测；
- 安装 `livekit-client 2.21.0`。

服务运行时检查三项 HTTP 状态：

```powershell
.\check-local.cmd
```

运行真实房间集成烟雾测试：

```powershell
.\smoke-local.cmd
```

MiniMax 模式使用 `smoke-minimax.cmd`：它会创建临时参与者、显式 dispatch 命名 Agent、发送数据包，并断言真实工具回答、文字、音频与指标。当前结果：`passed: true`。

视觉模式使用 `smoke-minimax-visual.cmd`：它会发布一条确定性的 640×360 合成视频轨道，先断言 Agent 回传真实帧尺寸与哈希，再把同一帧包装为 `llm.ImageContent` 交给 MiniMax M3。当前真实结果：视频传输通过，模型回答“橙色、三角形、742”，三项语义校验全部通过。该命令会产生少量 M3 用量。

运行全部自动测试：

```powershell
.\run-validation.cmd
```

`run-validation.cmd` 当前汇总 `14` 项关键检查；本项目完整 pytest 契约为 `46 passed`，覆盖前端、Token/HTTP、显式调度幂等性、单 Worker 与 Worker 池容量、等待 Dispatch 重投、Job/Worker 序列化、受保护的 Worker 故障、跨实例恢复、状态工作流、身份隔离、并发版本、过期、审批门、审计、视觉传输/理解分层契约与产品能力页边界。

原来的无房间离线演示仍可独立运行：

```powershell
.\run-offline.cmd
```

## 使用 MiniMax Token Plan

这是已有 MiniMax Plus/Plus-极速版套餐时的推荐方式。当前电脑已经安装 LiveKit 官方 MiniMax TTS 插件，并准备好：

```text
页面文字 → MiniMax M3 → MiniMax Speech 2.8 → LiveKit 语音播放

麦克风 → LiveKit → Silero 停顿切句 → 小米 MiMo ASR → MiniMax M3 → MiniMax Speech 2.8
```

如果同一工作区的 `agentscope-study/config.local.json` 已配置 MiniMax，启动器会在本项目仍为占位 Key 时直接读取该本地配置；密钥不会被复制、打印或提交。否则，在 MiniMax 开放平台“订阅管理 → Token Plan”复制 **Token Plan Key**，编辑被 Git 忽略的 `.env.local`：

```text
MINIMAX_API_KEY=你的-Token-Plan-Key
MINIMAX_LLM_MODEL=MiniMax-M3
MINIMAX_TTS_MODEL=speech-2.8-turbo
```

如果需要直接开口对话，再添加独立的小米 MiMo API Key（它不属于 MiniMax Token Plan）：

```text
MIMO_API_KEY=你的小米-MiMo-API-Key
MIMO_ASR_MODEL=mimo-v2.5-asr
MIMO_ASR_LANGUAGE=zh
MIMO_ASR_STREAM_OUTPUT=true
```

小米 Key 有两种，不能混用地址：`sk-` 按量 Key 可使用示例中的默认地址；`tp-` Token Plan Key 必须把套餐页面展示的专属 OpenAI-compatible Base URL 填入 `MIMO_ASR_BASE_URL`。项目会在启动前检查这个组合，避免错误请求。

当前首版以 `MiniMax-M3` 为验收目标。虽然配置允许改模型，M2.x 的 thinking 与多轮工具上下文尚未在这条 LiveKit 链路中实测，不作为当前保证能力。

不要把 Key 写进网页或提交到 Git。配置后运行：

```powershell
.\stop-local.cmd
.\start-minimax-local.cmd
```

打开 `http://127.0.0.1:17828/`。配置 `MIMO_API_KEY` 后，点击“开始说一句”，说完点击“说完，提交”；停顿约 0.8 秒也会自动提交。小米 MiMo 会把这一句转成文字，再交给 MiniMax 回答；仍可使用页面文字输入。未配置小米 Key 时，启动器会明确提示并安全退回文字输入。`AGENT_MIN_SILENCE_SECONDS` 可在 `.env.local` 调整，建议保持在 `0.7–1.0` 秒之间。

MiniMax 语音模式默认使用“稳定单轮”：识别、思考、重试或播放期间会锁定新的文字与语音输入；麦克风检测到一句结束后会自动停止发布，单句最长 20 秒。AgentSession 同时关闭自动打断和预生成，避免批量 ASR 较慢时出现多个回合抢答、晚到转写或 TTS 被中途取消。页面出现“云服务波动，正在重试”时无需重复发送；只有显示最终错误后才需要重试。

页面的 `PHASE 11 · VISUAL INPUT` 用分层证据研究多模态。“发布合成测试视频”只生成本地 Canvas 视频，不会申请物理摄像头权限；“打开真实摄像头”才会在用户点击后请求权限，并显示本地实时预览。两种来源互斥，都会作为真实 LiveKit 视频轨道发布；只有 Agent 回传尺寸、帧数和哈希后，页面才标记“LiveKit 视频传输已验证”。随后点击分析，Agent 会显式把最新 `rtc.VideoFrame` 包装为 `llm.ImageContent`。确定性画面只有同时识别橙色、三角形和 `742` 才标记“视觉理解已验证”；摄像头内容不固定，因此只标记“已返回描述（未自动校验）”，需要对照左侧预览人工确认。

当前 Agents `1.6.8` 的普通 STT→LLM→TTS 管线不会像 Realtime 视频模型那样持续把每一帧自动送给 LLM。本项目采用按需抽帧：视频轨道持续走 LiveKit，用户明确请求时才把最新一帧交给 M3。这种方式更可控，也能减少视觉 token、避免无意上传连续画面。真正的连续视频理解仍应选择支持实时视频输入的 Realtime 模型，并另行评估帧率、成本、隐私和延迟。

MiniMax TTS 在本项目中使用 PCM 输出。插件默认的分块 MP3 在连续 Agent handoff 后偶发音频解码错误；PCM 由 LiveKit 直接按音频帧读取，最终三阶段工作流复验没有新增解码错误。

页面的 `04 · STABLE TURN` 状态卡现在直接给出本轮观察结果：`回合` 是浏览器从开始输入到播放完成的整轮时间；语音回合出现的 `响应首声` 是 LiveKit SDK 定义的“用户停止说话到 Agent 开始发声”，不是整轮结束时间。`ASR流式`、`M3首字`、`TTS首帧` 分别用于定位识别、模型首字和语音首帧的等待。它们的计时起点不同，不能简单相加。事件区同时记录识别、思考、播放、完成以及重试阶段，复制诊断时也会包含回合时间、首声、重试次数和失败阶段。

该接法是“按停顿切句”的近实时对话，不是边说边上传的双向流式 ASR。根据[小米语音识别使用指南](https://mimo.mi.com/docs/zh-CN/usage-guide/Speech-Recognition)与[接口说明](https://mimo.mi.com/docs/zh-CN/api/audio/Speech-Recognition)，输入仍是完整 WAV/MP3 的 Base64；`stream=true` 只让识别文字通过 SSE 分块返回。项目默认启用该输出模式，也可用 `MIMO_ASR_STREAM_OUTPUT=false` 回退到单次 JSON 响应。

真实同音频对比中，4.272 秒中文语音的普通响应耗时 3.224 秒；SSE 首字 1.254 秒、完整文本 1.451 秒，内容逐字一致。正式 smoke 另用 4.872 秒中文语音验证了适配器的 SSE 路径与准确结果。用户已手动完成物理麦克风的完整房间体验；自动验收环境仍不控制硬件权限，因此相关自动回归继续使用已授权的人工复验和合成音频证据。

可重复运行 `smoke-xiaomi-asr.cmd` 验证 MiniMax TTS → 小米 MiMo ASR；该命令会产生少量真实模型用量。

可选的真实验收命令是 `smoke-minimax.cmd`。它会把一次测试房间名与参与者标识发送给 MiniMax，并消耗少量 M3 与 Speech 2.8 额度，因此只应在明确同意后运行。本轮已在获得同意后执行并通过：M3 调用了真实房间状态工具，页面侧同时收到了文字与 Speech 2.8 音频。

## 使用 OpenAI Realtime

如果接受“LiveKit 本地运行、OpenAI 负责语音模型”，按以下方式继续。

新电脑先复制配置；当前电脑已经生成了被 Git 忽略的 `.env.local`：

```powershell
Copy-Item .env.local.example .env.local
```

编辑 `.env.local`，填入你自己的：

```text
OPENAI_API_KEY=...
```

先停止当前无 Key 文字演示，再以语音模式一键启动整套本地栈：

```powershell
.\stop-local.cmd
.\start-local.cmd -VoiceAgent
```

打开 `http://127.0.0.1:17828/`，点击“加入真实房间”，等待 Agent 成为第二个参与者，再点击“开启麦克风”。语音 Agent 也会接收页面的文字输入，方便在没有麦克风时先验证模型连接。

此时房间与实时媒体路由仍由你本机的 LiveKit Server 承担，但语音内容会流式发送给 OpenAI Realtime 完成理解、推理和生成，因此会产生外部数据传输与对应模型费用。模板默认模型为 `gpt-realtime-2.1`，声音为 `marin`，都可以在 `.env.local` 中修改。

如果要求 STT、LLM、TTS 也完全本地运行，则还需要选择并部署本地模型服务。这会涉及模型体积、GPU/内存和中文质量，是独立于 LiveKit Server 的下一阶段。

## 安全边界

- `devkey / secret` 是 LiveKit 官方 `--dev` 模式固定凭据，只允许本机开发使用；
- API secret 不会发送到浏览器；它存在于本地开发进程和脚本环境中，供 LiveKit dev server 与 Python Token 服务使用，前端只收到有时效的 Participant Token；
- `.env.local`、`.runtime/`、`.local-state/`、`node_modules/` 和 `.venv/` 均被 Git 忽略；
- 当前没有 TLS、TURN/TLS、Redis、生产密钥、访问控制、监控或公网防火墙配置；
- 不要把这套开发配置直接暴露到局域网或互联网。

## 验证边界

已经直接验证：

- LiveKit Server 原生 Windows 程序启动并返回 `HTTP 200 OK`；
- Token API 能签发限定房间、允许发布/订阅的 JWT，且响应中不包含 secret；
- 浏览器真实加入自托管房间；基础 Agent 可自动调度，命名 MiniMax Agent 经显式 Dispatch 后成为第二个 Participant；
- 用户已在普通浏览器完成物理麦克风真实回合，小米 MiMo ASR → MiniMax M3 → Speech 2.8 进入完整房间链路；自动化浏览器不控制硬件授权，因此不把物理设备采集纳入无人值守回归；
- 确定性 640×360 视频轨道真实进入房间，Agent 回传 `camera`、帧数、尺寸与帧哈希；同一帧经 `llm.ImageContent` 交给 MiniMax M3 后正确回答“橙色、三角形、742”；
- 浏览器通过 LiveKit 数据通道触发 AgentSession 工具调用并收到完整 Text Stream；
- MiniMax M3 真实调用 `get_room_status`，页面收到 `function_tools_executed`；研究向导与工作流专家完成双向 `agent_handoff`，角色进入提示禁用工具以避免历史意图造成循环交接；
- 预约流程执行参数化工具和多次 handoff；`张晓 / 明天下午三点 / 产品演示` 跨 Agent 保持一致，并在完整服务重启后以同一个 workflow ID 从 SQLite 恢复；
- 暂停、恢复、确认与取消均通过真实房间按钮验证；确认幂等和取消不可恢复另有 SQLite 自动化契约；
- 离开、重新连接、服务离线状态、深浅主题与 390px 手机布局；
- 麦克风按钮调用真实 `setMicrophoneEnabled()` 发布路径并处理权限拒绝。

尚未直接验证：

- 未提供 `OPENAI_API_KEY`，所以真实语音 AI 模板已安装但未产生模型调用；
- 未验证多人会议的全员轨道聚合、说话人区分和会议总结；
- 未验证生产公网、弱网、规模并发、SIP、录制、数字人或完全本地 AI 模型。

详细证据见 [REPORT.md](REPORT.md) 和 [WEB_DEMO.md](WEB_DEMO.md)。

## 主要文件

```text
livekit-agents-study/
├─ CAPABILITY_MATRIX.md       库能力、扩展方式、当前证据与下一实验
├─ local-app/                 真实房间浏览器控制台
├─ scripts/                   安装、启动、停止、检查与语音入口
├─ src/
│  ├─ local_demo_server.py    本地网页与 Token API
│  ├─ local_text_agent.py     无 Key、真实入房的文字 Agent
│  ├─ minimax_agent.py        MiniMax LLM + Speech 2.8 Agent
│  ├─ xiaomi_mimo_stt.py      小米 MiMo-V2.5-ASR 的 LiveKit STT 适配器
│  ├─ local_room_smoke.py     端到端房间烟雾测试
│  ├─ minimax_room_smoke.py   MiniMax 文字、工具与语音真实验收
│  ├─ minimax_visual_smoke.py MiniMax 视频传输与视觉理解真实验收
│  ├─ offline_agent_demo.py   无房间确定性 AgentSession 演示
│  └─ voice_agent_template.py OpenAI Realtime 语音 Agent
├─ tests/                     自动测试
├─ package.json               LiveKit 浏览器 SDK
├─ install-local.cmd
├─ start-local.cmd
├─ start-minimax-local.cmd
├─ stop-local.cmd
├─ check-local.cmd
├─ smoke-local.cmd
├─ smoke-minimax.cmd
├─ smoke-minimax-visual.cmd
└─ run-validation.cmd
```
