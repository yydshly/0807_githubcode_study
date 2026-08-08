# LiveKit Agents 本地部署验证报告

## 验证对象

| 项目 | 值 |
|---|---|
| LiveKit Server | `1.13.5`，官方 Windows x64 发布包 |
| LiveKit Agents | `1.6.8`，上游提交 `2f218b6fb9c9a65c8b8499c103aa1262cff73158` |
| LiveKit Client | `2.21.0` |
| OpenAI Plugin | `livekit-plugins-openai 1.6.8` |
| Anthropic Plugin | `livekit-plugins-anthropic 1.6.8` |
| MiniMax Plugin | `livekit-plugins-minimax-ai 1.6.8` |
| Python / Node.js | `3.10.11` / `22.15.0` |
| 系统 | Windows x64，不使用 Docker 或 WSL |
| LiveKit Cloud | 未使用 |
| 外部模型 Key | MiniMax Token Plan，仅用于一次获授权的真实 smoke |

## 服务端安装

官方发布包：

```text
livekit_1.13.5_windows_amd64.zip
```

实测 SHA-256：

```text
3ec7eaa76ef64063bf21f78364733703e0969612cb92ffd60661ed45fa4a8906
```

与官方 `checksums.txt` 一致。运行命令：

```powershell
livekit-server.exe --dev --bind 127.0.0.1
```

安装脚本会预检 Git、Python、Node/npm 与 `uv`，并把上游源码固定到提交 `2f218b6fb9c9a65c8b8499c103aa1262cff73158`；检测到已有源码版本不一致时会停止，不重置或覆盖本地改动。

启动日志确认：

- HTTP/信令：`127.0.0.1:7880`；
- WebRTC TCP：`7881`；
- WebRTC UDP mux：`7882`；
- 开发凭据：`devkey / secret`；
- 根地址返回 `HTTP 200 OK`。

Windows 版本会记录“CPU capacity management unavailable”，这是平台能力提示，不影响本地单节点房间运行。

一键启动器使用项目级互斥锁拒绝重复 supervisor，并为每个子进程记录 PID、程序路径与启动时间。停止命令先发送优雅停止请求；只有 supervisor 无法响应时，才会回收身份校验仍匹配的进程，避免陈旧 PID 误杀。

## 本地 Token 服务

`src/local_demo_server.py` 同时提供静态控制台和 `/api/token`。

安全约束：

- 服务只绑定 `127.0.0.1:17828`；
- `devkey / secret` 不会发送到浏览器；它存在于本地开发进程和脚本环境中，供 LiveKit dev server 与 Python Token 服务使用；
- 浏览器只得到两小时有效的 Participant JWT；
- Token 限定具体房间，并允许发布、订阅和数据通道；
- 房间名与 identity 有字符和长度校验；
- Content Security Policy 只允许连接本地 LiveKit WebSocket。

本项目 4 项 HTTP/Token 测试均通过，包括 JWT grants、secret 不泄漏和非法 identity 拒绝。

## Agent 端到端验证

运行：

```powershell
.\smoke-local.cmd
```

实际链路：

```text
Python 临时参与者加入新房间
→ 本地后端创建命名 Agent Dispatch
→ LiveKit Server 把 Job 分配给指定 Worker
→ Agent 成为第二个 Participant
→ 临时参与者通过 local-agent-chat 数据通道发消息
→ AgentSession 生成 Function Call
→ Python 工具读取 ctx.room 中的真实参与者
→ Function Call Output 回填
→ Agent 通过 lk.transcription Text Stream 返回两段回答
```

通过结果示例：

```json
{
  "livekit_connected": true,
  "agent_present": true,
  "text_stream_sent": true,
  "passed": true
}
```

最终回答实际包含动态 Agent identity 和测试参与者 identity，而不是静态假数据。

MiniMax Agent Worker 使用 `start` 模式并以 `livekit-research-minimax` 注册。新房间创建本身不会让命名 Worker 自动入房；浏览器先加入，再由本地后端用 `AgentDispatch.createDispatch` 指定房间和 Agent。每个浏览器页面生成唯一 `local-demo-xxxxxxxx` 房间，因此每个标签页都有独立 Dispatch 与 Job。

## 自动测试

`run-validation.cmd` 共执行 `10` 项：

| 测试组 | 数量 | 结果 |
|---|---:|---|
| 本项目离线 AgentSession 工具循环 | 1 | 通过 |
| 本地 Token、HTTP 和输入校验 | 4 | 通过 |
| 上游会话事件与指标 | 1 | 通过 |
| 上游工具调用 | 1 | 通过 |
| 上游打断参数组合 | 2 | 通过 |
| 上游 Agent 更新/交接 | 1 | 通过 |

上游测试仍会出现 `pytest.mark.no_concurrent` 未注册警告，因为没有安装完整的上游开发依赖组；对应断言全部通过。

## 第二阶段：工具与 Agent handoff

本地控制台新增 `CAPABILITY LAB`，把框架事件作为实验通过条件，而不是根据模型是否声称“已经调用”来判断：

- 真实 Function Tool：MiniMax M3 调用 `get_room_status`，SDK 发出 `function_tools_executed`，回答使用当次真实房间名与 2 位参与者；
- 正向 handoff：`research-guide → workflow-specialist`，SDK 写入 `agent_handoff` 会话项，新角色在同一 `AgentSession` 中接管并输出文字与语音；
- 反向 handoff：`workflow-specialist → research-guide`，上下文保留，页面角色和可用实验同步恢复；
- 稳定性修复：Agent handoff 本身不会自动生成新角色回复，因此由 `on_enter` 明确启动；进入回复使用 `tools=[]`，防止模型重新解释历史交接请求并产生循环 handoff。

本项目测试目录当前 `44 passed`，JavaScript 语法与 Python 编译检查通过。能力边界和后续路线见 `CAPABILITY_MATRIX.md`。

## 第三阶段：有状态预约工作流

真实房间 `local-demo-34e58878` 完成以下链路：

1. `research-guide` 调用 `start_appointment_workflow`，状态进入 `collecting`；
2. `appointment-intake` 调用 `submit_appointment_draft(customer_name, appointment_time, request)`；
3. 同一个 `AppointmentDraft` 被 `appointment-review` 读取，页面显示 `张晓 / 明天下午三点 / 产品演示`；
4. `appointment-review` 调用 `confirm_appointment`，状态变为 `confirmed` 并返回 `research-guide`；
5. 页面四个步骤均为完成；这一阶段先明确验证的是进程内共享状态。

实现过程中发现 MiniMax 分块 MP3 在 handoff 后的新语音上偶发 `InvalidDataError`。将 MiniMax TTS 改为插件原生支持的 PCM 后，最终三轮工具、三次 handoff、进入提示和完成提示均播放完成，17:34–17:36 的最终日志没有新增解码错误。初始化时 `old_agent_id=null` 的 SDK 内部 Agent 项也已过滤，不再在房间连接前误发 handoff 状态。

## 第四阶段：SQLite 持久化与跨进程恢复

在第三阶段角色链路之上新增本地 `AppointmentStore`，每条记录有 `workflow_id`、业务字段、状态、版本和更新时间。真实房间完成：

1. 创建 `apt-d8866c3c`，提交后暂停为 `paused / version 3`；
2. 完整停止并重启 LiveKit、网页和 Agent，进入全新房间 `local-demo-fc428109`；
3. `resume_latest_appointment` 从 SQLite 恢复同一 ID、同一三项字段，并转回 `appointment-review / version 4`；
4. `confirm_appointment` 写入 `confirmed / version 5` 并返回研究向导；
5. 新任务 `apt-324855c7` 在 intake 阶段取消，页面和 SDK 事件均显示取消终态。

确认工具是幂等事务：重复确认返回原记录，不增加版本，也不会插入第二行。取消任务和已确认任务不属于可恢复集合。SQLite 是单机研究实现，不代替生产数据库、权限控制、跨 Worker 锁、审计和迁移。

该阶段项目测试结果为 `40 passed`；Python 编译与 JavaScript 语法检查通过。

## 第五阶段：参与者隔离、并发与过期

第五阶段把“可恢复”升级为“只能安全地恢复自己的任务”。`AppointmentStore` 迁移加入 `owner_id` 和 `expires_at`；所有创建、查询和写入都按 LiveKit 参与者 identity 限定，所有更新都校验 `expected_version`。浏览器会话保留 identity，但页面重新加载使用新的房间 ID，避免匿名 Worker 因重复房间而不再收到新任务。

真实浏览器完成以下验收：

1. `visitor-1b2dcac4` 在 `local-demo-1c8e913c` 创建 `apt-3dff5a54 / version 1`；
2. 页面重载后房间变为 `local-demo-d35b393c`，identity 不变，成功恢复同一 workflow ID；
3. 第二个参与者 `visitor-82ae2a60` 在独立房间尝试恢复，Agent 明确返回“当前参与者名下没有可恢复的预约任务”；
4. A 提交草稿进入 `appointment-review / version 2`，随后故意使用 version 1 写入，SQLite 拒绝并保持姓名、时间和需求不变；
5. A 将任务标记为 `expired / version 3` 后返回 `research-guide`，再次恢复得到“没有可恢复的未完成任务”。

实现期间还发现一个真实调度边界：Agent job 刚开始时 `remote_participants` 可能仍为空，不能据此确定任务所有者。入口改为等待实际参与者加入后读取 identity。自动化覆盖旧表迁移、跨 owner 隔离、陈旧版本冲突和自动过期；最终两个浏览器标签均无 console error。这里的 identity 仍是本地演示身份，不是认证系统，生产环境还需服务端用户/租户映射、授权、审计日志和支持多 Worker 的数据库事务。

## 第六阶段：人工审批门与追加式审计

第六阶段验证 Agent 的高风险工具不应只依赖提示词约束。`appointment-review` 已移除直接确认工具，只能调用 `request_appointment_approval`；任务写入 `pending_approval` 后 handoff 到 `appointment-approval`，该角色的工具集合严格限定为批准与拒绝。页面只在这个角色显示人工决策按钮。

真实房间完成三组证据：

1. `apt-e24fdf7a` 产生 4 条事件：创建、提交、`agent:appointment-review` 请求审批、`human:visitor-1e29df95` 批准；最终 `confirmed / version 4`；
2. `apt-c6e20814` 产生 4 条事件：人工拒绝写入 `rejected / version 4`，并保留原因“需要重新确认演示时间”；
3. `apt-0546487f` 当前停在 `pending_approval / version 3`，页面仅显示“人工批准/人工拒绝”，供后续直接体验。

待审批任务曾从房间 `local-demo-fcf4ebeb` 跨页面重载恢复到 `local-demo-91ea3804`，workflow ID、审批角色和前三条审计事件保持一致。审批进入提示改用确定性 `session.say()`，避免模型自由生成含糊状态说明；示例预约时间也明确按业务字符串原样写入，避免模型擅自换算“明天下午三点”。

审计表以自增 event ID 追加，包含操作者、动作、前后状态、版本、详情和时间。它证明了框架可把 Agent handoff、人工决策和本地任务状态串成可观察闭环，但 SQLite 文件仍可由本机用户修改，`human:*` 也不是可信身份。生产化仍需要服务端认证与 RBAC、独立审批人规则、不可篡改审计存储、通知/超时升级和多 Worker 事务。

## 第七阶段：显式调度与多房间并发

第七阶段把此前不透明的“Agent 自动出现”拆成可观察的任务路由。`AgentServer.rtc_session(agent_name=...)` 将 Worker 注册为 `livekit-research-minimax`；浏览器加入后房间先保持 1 人，用户点击调度按钮，本地后端才使用 LiveKit API 创建 Dispatch。后端持有开发环境 secret，浏览器只能看到结果字段。

页面和真实 SDK 事件共同显示：agent name、Dispatch ID、Job ID/状态、Worker ID 与 Agent participant identity。`agent_config` 直接读取 `ctx.job.agent_name`、`ctx.job.dispatch_id`、`ctx.job.id` 和 `ctx.worker_id`；只有它与 Dispatch API 返回同一 Job 时，页面才显示“双端一致”的验证文案。

同时在线验收：

| 房间 | Dispatch | Job | Worker | 参与者 |
|---|---|---|---|---:|
| `local-demo-5b97a992` | `AD_tNNyo2KbtMJW` | `AJ_Wra7EzhNYZQD / running` | `AW_w7xmknKTe877` | 2 |
| `local-demo-f7d41324` | `AD_JPXCjz5xjvuz` | `AJ_4GgPvWiUoyDD / running` | `AW_w7xmknKTe877` | 2 |
| `local-demo-22f0b634` | `AD_vSyRKhUqEfz8` | `AJ_GRZCHhFzHjVY / running` | `AW_w7xmknKTe877` | 2 |

前两个房间保持同时在线时，Dispatch 与 Job 均不同、Worker 相同；第三个房间随后也成功接管。重复请求第一个房间返回 `200 / created=false / AD_tNNyo2KbtMJW`，证明本地创建接口按“房间 + Agent”幂等。`smoke-minimax.cmd` 已改为先显式调度，再完成真实 `get_room_status`、MiniMax 文字、Speech 2.8 音频与同轮指标，最终 `passed: true`。

这说明 LiveKit Agents 的调度单元是房间 Job，Worker 是可以并发执行多个 Job 的服务进程；但本轮没有声称生产容量已验证。下一步应研究 Worker load、Job 拒绝、排队时间、崩溃/断线重派、跨进程 Worker 池和共享状态后端。

## 第八阶段：容量保护、FULL 状态与显式重投

AgentServer 1.6.8 默认生产 `load_threshold=0.7`，默认 `load_fnc` 使用系统 CPU。为了让容量实验可重复，本地 Worker 改用 `active_jobs / 2`，阈值为 `1.0`。这仍然走 SDK 的真实负载刷新和 `WS_AVAILABLE / WS_FULL` 上报；网页只读取 AgentServer 的 `/worker` 状态，没有自行决定 Worker 是否满载。

真实三房间实验：

| 时刻 | 房间/操作 | Worker 状态 | 结果 |
|---|---|---|---|
| 第 1 个 Job | `local-demo-19607237` | `1/2 · 50% · available` | `AJ_XXSkLNjzZ7f6 / running` |
| 第 2 个 Job | `local-demo-e4fd47fd` | `2/2 · 100% · full` | `AJ_eoUXvHeFP4Vt / running` |
| 第 3 个 Dispatch | `local-demo-8debb104` | `2/2 · full` | `AD_hvCTqeYuLKT7` 存在，但无 Job、房间 1 人 |
| 释放第 1 个房间 | 等待 9 秒 | `1/2 · 50% · available` | 第 3 个 Dispatch 仍无 Job，没有自动重投 |
| 显式 requeue | 删除旧 Dispatch 并新建 | 再次 `2/2 · full` | `AD_dSHpuS2hBNiN → AJ_QNF4g5zPCPKC / running`，房间变 2 人 |

这个结果修正了“满载请求会像队列一样等待并自动恢复”的假设。本地后端的 `/api/dispatch/retry` 只在 Worker available 时允许操作，要求目标 Dispatch 尚无 Job；随后删除旧 Dispatch，创建携带 `retry_of` 的新 Dispatch。页面在 full 时显示不可点击的“等待 Worker 空位”，恢复 available 后才启用“重新提交等待任务”。

回归结果：`40 passed`；真实 `smoke-minimax.cmd` 仍完成命名 Dispatch、JobContext 双端一致、`get_room_status` 工具、MiniMax 文字、Speech 2.8 音频和指标，`passed: true`。

## 第九阶段：Job 进程隔离与恢复真实性

SDK 1.6.8 在 Windows 默认选择 `THREAD` Job executor，因此不能用进程退出研究单房间故障。本阶段把 MiniMax 研究 Worker 显式切换到 `JobExecutorType.PROCESS`，并用本地开关保护故障入口。浏览器通过可靠数据包要求当前 Job 子进程以 70 退出；发起者必须是该 Job 等待到的房间 owner，不能从其他参与者触发。

真实观察如下：

| 观察点 | 结果 |
|---|---|
| Job 子进程 | `AJ_huqbzZugiuzo` 以 70 退出，Worker 日志记录 non-zero exit |
| Worker / 服务 | `AW_8sCzgGEWjRLy`、LiveKit Server、网页服务均存活 |
| 容量 | active jobs 从 1 降为 0，Worker 保持 available |
| 房间 | Agent 参与者离房，2 人变 1 人 |
| `JRP_ON_FAILURE` | 30 秒内没有产生替代 Job |
| Dispatch API | 旧 Job 仍显示 `running`，与房间和 Worker 状态矛盾 |
| 显式恢复 | `AD_orcjUCdhDVeu` 被 `AD_c6AZRBXvPL2d` 替换，新 Job `AJ_jmoRYJCML3MM` 在同一 Worker 运行，房间恢复 2 人 |

这暴露了比“是否重启”更重要的生产观察点：不能只相信 Dispatch 的单一状态。页面现在把 API `running` + Agent 缺席标为陈旧状态；恢复接口还会先查询房间参与者，避免在 Agent 仍在线时重复派发。项目测试增至 `41 passed`；独立进程模式下真实 MiniMax smoke 再次通过工具、文字、音频和指标，`passed: true`。

## 第十阶段：同名 Worker 池、分单与实例故障

启动器默认拉起两个 `livekit-research-minimax` Worker，并为每个实例分配独立 HTTP 端口、ready 文件和可验证 PID。网页聚合总容量，但不会抹掉实例边界。两房间同时在线的真实选择如下：

| 房间 | Job | Worker 实例 | Worker ID | 实例负载 |
|---|---|---|---|---:|
| `local-demo-5d39b3c4` | `AJ_6ckJkwZmqAfn` | `worker-1` | `AW_fryxW7rWPFyV` | 1/2 |
| `local-demo-91e92e99` | `AJ_u5XFDHpLPLqY` | `worker-2` | `AW_bowASz5ZzAmX` | 1/2 |

停止 `worker-1` 前，后端再次核对两名 Worker 在线、目标 Worker 只承载当前一个 Job，并确认房间 Dispatch 的 Job/Worker 一致。进程树退出后，supervisor 保留 LiveKit、网页与 `worker-2`；第二个房间的 Agent 未离房。第一个房间 30 秒内没有产生跨 Worker 替代 Job，旧 Dispatch 仍为陈旧 `running`。

显式恢复删除 `AD_Rjc4CutskwsZ` 并创建 `AD_zafyjAK8QcqS`；新 Job `AJ_UiKe5voup85m` 由幸存的 `AW_bowASz5ZzAmX` 接管，房间重新变为 2 人。此时 Worker 池为 1/2 在线、幸存实例 2/2 full。释放第二实验房间后，真实 MiniMax smoke 又在同一幸存 Worker 完成工具、文字、音频与指标。自动化为 `44 passed`。

结论：LiveKit 会对新任务在同名可用 Worker 间进行负载选择；整个 Worker 丢失不会在当前本地组合中可靠触发已有 Dispatch 的自动迁移。生产级恢复需要 Worker 心跳、房间 Participant 健康、Dispatch 幂等替换、任务状态共享与外部控制面的共同决策。

## 第十一阶段：视频传输与模型视觉理解

本阶段刻意把两个常被混淆的问题拆开：LiveKit 能否把视频送到 Agent，以及当前模型接口能否理解帧内容。浏览器页面生成固定的测试画面，不申请摄像头权限；画面包含橙色三角形、`LIVEKIT` 与数字 `742`。Agent 订阅 camera/screenshare 视频轨道，通过 `rtc.VideoStream` 保留最新帧，并每秒回报帧尺寸、序号、来源和短哈希。

真实 RTC 验收结果如下：

| 观察点 | 结果 |
|---|---|
| 房间 / Dispatch | 临时视觉房间显式创建 `AD_kDdusA6dCKmq` |
| 视频轨道 | `TR_VCNYtqvqdSZsT9`，来源 `camera` |
| Agent 收帧 | `640×360`，模型快照对应第 1 帧 |
| 帧证据 | 模型实际快照的 SHA-256 短哈希 `e9b6557ccf82` |
| 模型输入 | 最新 `rtc.VideoFrame` → `llm.ImageContent` → MiniMax Anthropic-compatible LLM |
| MiniMax 回答 | `橙色三角形，数字是742。` |
| 确定性校验 | color / shape / code 三项全部 `true`，`semantic_phase=verified` |

这个结果证明当前运行中的 MiniMax M3 接口确实接受 LiveKit Agents 序列化的图像块，而不只是 MiniMax 产品层面“宣称支持视觉”。同时也确认 Agents `1.6.8` 的普通 STT→LLM→TTS 管线不会自动把持续视频送给非 Realtime LLM；本项目因此使用按需抽帧，只有用户明确点击分析时才把最新帧加入一个模型回合。连续视频理解、屏幕共享、帧率策略、视觉 token 成本和隐私遮罩仍是后续实验。

视觉阶段的自动化契约增至 `45 passed`；增加产品能力页契约后，当前完整套件为 `46 passed`。独立验收命令为 `smoke-minimax-visual.cmd`；它会产生少量真实 M3 用量，并在结束时取消采集任务、取消发布视频轨道、离开临时房间。

后续交互排查确认，页面最初只有 Canvas 合成轨道，没有物理摄像头入口，因此“视频轨道已发布”容易被误解为“摄像头已打开”。当前页面已把两个来源拆开：合成画面用于可重复校验；真实摄像头只在用户点击并授权后打开，显示本地预览，再发布同一轨道。来源互斥，权限失败会明确提示，停止或离开房间会释放轨道。摄像头画面的模型回答只记为“已描述、未自动校验”，不伪装成客观正确。

## 浏览器验收

规范地址：`http://127.0.0.1:17828/`

直接观察到：

- 桌面 `1280×800`：首屏服务状态清晰，双栏控制台无重叠；
- 手机 `390×844`：`scrollWidth = clientWidth = 375`，无横向溢出；
- 浅色和深色主题均可读；
- 浏览器加入唯一房间后显示 2 个参与者；
- Agent 加入后发送按钮从禁用变为可用；
- 发送“请检查房间状态”后收到完整的工具说明和最终房间回答；
- 离开后回到未连接和 0 人状态；同一页面再次加入可以恢复为 2 人；
- 人为停止 LiveKit Server 后，服务卡变为“LiveKit Server 离线”，房间进入重连状态；
- 所有输入有可见 label，控件使用原生 button/input，`:focus-visible` 有 3px 轮廓。

浏览器验收发现并修复了三个真实问题：

1. Agent 加入后发送按钮没有刷新；
2. Text Stream 分块被覆盖，页面只显示末尾字符；
3. LiveKit 断开时状态徽章显示重连，但提示仍声称已连接。

## 麦克风验证边界

浏览器点击“开启麦克风”会调用 LiveKit Client 的：

```text
localParticipant.setMicrophoneEnabled(true)
```

并配置回声消除、降噪和自动增益；成功后由 `LocalTrackPublished` 更新页面，权限拒绝和持续静音都有恢复提示。

Codex 内置验收浏览器没有暴露可控制的物理麦克风权限，因此无人值守回归不能主动采集现场声音。随后用户已在普通浏览器授权麦克风并完成真实回合，小米 MiMo ASR → MiniMax M3 → Speech 2.8 成功进入完整房间链路；物理麦克风现标记为“人工真实验证通过、自动化硬件回归未覆盖”。

## OpenAI Realtime 语音模板（未实测）

`voice_agent_template.py` 已改为 OpenAI Realtime：

```python
openai.realtime.RealtimeModel(model="gpt-realtime-2.1", voice="marin")
```

当前模板默认使用 `gpt-realtime-2.1` 与 `marin`，具体值由被 Git 忽略的 `.env.local` 控制。`start-local.cmd -VoiceAgent` 会在启动任何服务前检查 Key，然后统一启动 LiveKit、网页与 Realtime Agent；语音 Agent 也监听演示页的 `local-agent-chat` 数据包。由于没有用户提供的 `OPENAI_API_KEY`，本次没有发起任何 OpenAI 请求，也没有把模型模板表述为已验证语音能力。

## MiniMax Token Plan Agent

已安装本地 editable `livekit-plugins-minimax-ai 1.6.8`，并新增 `minimax_agent.py` 与 `start-minimax-local.cmd`。链路设计为：

```text
LiveKit data text
→ MiniMax Anthropic-compatible LLM（默认 MiniMax-M3）
→ MiniMax Speech 2.8 Turbo
→ LiveKit 远端音频轨道与 lk.transcription
```

启动器会在任何服务启动前检查 `MINIMAX_API_KEY`。本项目仍为占位 Key 时，可只读复用同一工作区 `agentscope-study/config.local.json` 中已有的 MiniMax 配置，不复制或输出密钥；两处均未配置时立即停止。LLM 与 TTS 对象已经用无效测试 Key 完成本地构造检查。

真实验收脚本 `smoke-minimax.cmd` 已在用户明确授权后执行。结果全部通过：MiniMax Agent 加入临时房间、M3 调用 `get_room_status`、客户端收到 `lk.transcription` 文字流，并从 Agent 音频轨道读到 Speech 2.8 音频帧。模型返回：`当前房间名为 minimax-smoke-1786160579，共有 2 位参与者。`

MiniMax 模式已增加小米 `MiMo-V2.5-ASR` 的 LiveKit STT 适配器：本地 Silero VAD 在用户停顿后将一段音频封装为 WAV/Base64，再调用小米 ASR，识别文字进入 MiniMax M3，最后由 Speech 2.8 播放。未配置独立的 `MIMO_API_KEY` 时会安全退回“文字输入、文字与语音输出”。适配器默认使用小米官方 SSE 文字输出；它仍是整句音频上传，不是麦克风帧实时输入。4.272 秒同音频实测：普通响应 3.224 秒，SSE 首字 1.254 秒、完整文本 1.451 秒。正式 smoke 的 4.872 秒中文语音也逐字识别正确；用户物理麦克风回合已成功进入完整房间链路。

本地控制台已补齐每轮可观测结果。真实麦克风回合记录到 ASR 3.94 秒、M3 首字 2.59 秒、TTS 首帧 0.75 秒，以及 SDK `e2e_latency` 10.71 秒；后者准确标注为“响应首声”（用户停止说话到 Agent 开始发声）。浏览器另记录从输入开始到播放结束的“回合”时间。真实文字回归显示回合 5.39 秒、M3 首字 1.18 秒、TTS 首帧 0.74 秒，Room Text 用户/Agent 各一条。

首版只以默认 `MiniMax-M3` 为验收目标。M3 在 MiniMax Anthropic 兼容接口中默认关闭 thinking，流式正文为增量事件；M2.x 的 thinking 与多轮工具上下文尚未实测，因此不列入当前保证范围。

## 结论

本次已经证明 LiveKit 可以在该 Windows 电脑原生自托管，浏览器、Token 服务和 Agent Worker 能组成真实房间闭环。Agent 确实是房间中的第二个参与者，并能通过 LiveKit 数据通道执行 AgentSession 工具调用。

剩余外部条件：

- 若未来需要边说边出字、自然打断，需要接入真正支持音频帧双向流式输入的 ASR/Realtime 模型；当前小米公开接口是整句上传、文字 SSE 输出。
- 若要用于多人群聊或视频会议总结，需要另外实现全员轨道/转录聚合、说话人区分、权限和会议上下文；当前原型只验证了一个主要用户与 Agent 的交互链路。

生产部署仍需独立处理 TLS、TURN/TLS、生产密钥、Redis、监控、网络防火墙和容量验证。
