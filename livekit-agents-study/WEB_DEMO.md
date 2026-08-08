# LiveKit Agents 演示页契约

## 修订 17：技术总结与产品能力演示

- 定位：**LiveKit Agents 是 LiveKit 实时应用中 AI Agent 的运行与编排核心**，不是模型、媒体服务器或业务控制面。
- 产品页：`http://127.0.0.1:17828/product.html`，只做本地流程预览，不调用模型、不申请麦克风/摄像头、不写入业务数据。
- 研究控制台：`http://127.0.0.1:17828/`，保留真实房间、工具、handoff、业务层工作流、Worker 池与单帧视觉证据。
- 内容边界：四类组件采用“房间 ↔ Agent Worker，Agent 分别调用模型与业务工具”的中心式关系，不表述成模型再调用业务系统的串行链路。
- 当前证据：`46 passed`；桌面浅色/深色、390×844、键盘场景切换、页面互链与视觉流程完成态通过。
- 多人边界：同一 Room 可有多人，但当前未验证全员轨道聚合、说话人区分和会议总结。

## 修订 2：本地 LiveKit 与真实房间

```text
Entry mode: revision-led
Request revision: 2
Target user and context: 希望在 Windows 本机完整理解并亲自操作 LiveKit 房间和 Agent 接入的项目维护者
Desired first impression: 打开页面即可看见本地服务是否就绪，并能用一个主按钮加入真实房间、授权麦克风、观察自己和 Agent 两个参与者
Visual ambition: Functional
Experience architecture: Editorial Flow
Visual constraints: 延续现有纸张/墨色系统；连接状态和主操作优先；真实控制台与原静态能力回放明确分区
Information constraints: 必须区分“LiveKit 服务已运行”“浏览器已入房”“麦克风已发布”“Agent 已入房”“真实 AI 模型已配置”；不得把模拟响应标成语义识别
Operation constraints: 用户可一键启动本地栈、加入/离开固定演示房间、开关麦克风、复制诊断信息；API secret 不发送到浏览器，只留在本地开发进程和脚本环境
State constraints: 覆盖服务离线、服务就绪、正在连接、已入房、麦克风开启/关闭、Agent 未运行/已加入、权限拒绝和连接错误
Environment constraints: Windows x64；不依赖 Docker/WSL；LiveKit Server 绑定 127.0.0.1；浏览器页面和令牌接口均由本地 Python 服务提供
Primary journey: 运行一键启动脚本 → 打开本地控制台 → 检查三项服务状态 → 加入房间 → 授权麦克风 → 观察参与者与事件 → 离开房间
User-defined phases: 本地部署 LiveKit、真实浏览器入房、真实麦克风发布、Agent 加入、模型接入边界、文档与验收
Required artifacts: 官方 LiveKit Server 二进制及校验记录、本地控制台、令牌端点、Agent 入口、一键启动/停止/检查脚本、自动测试、浏览器验收和更新后的 README
Autonomy authorization: 用户明确要求“在本地部署 LiveKit 然后继续”，允许下载官方二进制、安装子项目依赖、启动本机开发服务并实现可逆文件变更
User-decision boundary: 外部 STT/LLM/TTS 服务的 API Key、下载大体积本地模型、开放局域网/公网端口和生产部署需要新的明确选择或凭据
Observable completion criteria: LiveKit 127.0.0.1:7880 健康可用；令牌接口不向前端泄露 secret；浏览器可加入 demo-room 并发布/关闭麦克风；参与者和事件状态可观察；Agent 入口能连接本地服务；自动测试、静态检查及桌面/手机浏览器检查通过
```

### 修订 2 覆盖清单

| 用户阶段 | 要求或产物 | 表面/状态 | 证据 | 阶段 | 状态 | 下一步 |
|---|---|---|---|---|---|---|
| 本地部署 | Windows LiveKit Server | 127.0.0.1:7880 | 版本、校验和、健康请求 | Stage 1/9 | pass | 无 |
| 真实入房 | 令牌服务与浏览器连接 | 唯一 local-demo 房间 | API、DOM、参与者事件 | Stage 1/5 | pass | 无 |
| 麦克风 | 发布与静音 | 允许/拒绝/关闭 | 浏览器交互与轨道状态 | Stage 5/6 | defer | 内置浏览器无 mediaDevices/硬件授权能力；普通 Chrome/Edge 允许麦克风时复测 |
| Agent 加入 | 命名 Agent 显式调度 | 单人房间 → dispatch → Agent 入房 | Dispatch/Job/Worker、参与者列表、集成烟雾测试 | Stage 5/6 | pass | 无 |
| 跨表面 | 桌面和手机 | 1280/390；浅/深色 | 截图、宽度、状态检查 | Stage 7 | pass | 无 |
| 能力回退 | 服务离线/离开/重连 | 可恢复错误 | 浏览器状态与诊断提示 | Stage 6/8 | pass | 无 |
| 工程交付 | 启动/停止/检查/测试 | Windows 命令 | 命令输出 | Stage 9 | pass | 无 |
| 模型接入 | STT/LLM/TTS | MiniMax 与小米 ASR 已实测 | M3 工具调用、文字流、Speech 2.8 音频帧；MiMo ASR SSE 输出真实中文识别逐字一致；普通浏览器物理麦克风真实回合已通过 | Stage 9 | pass | 自动化不控制硬件授权；OpenAI Realtime 尚需用户 Key |

### 修订 2 浏览器与工程证据

- 规范地址：`http://127.0.0.1:17828/`；LiveKit：`ws://127.0.0.1:7880`。
- 桌面 `1280×800`：LiveKit/Token 状态就绪；加入后浏览器和 Agent 共 2 人；Agent 完整返回两段 Text Stream。
- 手机 `390×844`：`scrollWidth = clientWidth = 375`；连接、参与者、文字发送和最终工具回答均通过。
- 主题：浅色与深色均检查；深色背景计算值为 `rgb(23, 26, 24)`。
- 状态：离开后 `未连接 / 0 人`；再次加入恢复 `已连接 / 2 人`。
- 观察：状态卡区分整轮 `回合` 与 SDK `响应首声`，并显示 ASR、M3 首字、TTS 首帧；事件区记录阶段、完成和重试。真实文字回合显示 `回合 5.39s / M3首字 1.18s / TTS首帧 0.74s`。
- 能力回退：人为停止 LiveKit 后，服务卡显示离线、房间显示正在重连；修复了此前仍显示“已进入真实房间”的矛盾提示。
- 可访问性：7 个原生按钮；所有输入均有关联 label；`:focus-visible` 提供 3px 可见轮廓。
- 工程：官方发布包 SHA-256 通过；本项目当前 46 项自动化测试、无 Key 房间 smoke、MiniMax M3/Speech 2.8 smoke 与小米 SSE ASR smoke 均通过。
- 第二阶段能力实验：真实 `get_room_status` 工具事件通过；`research-guide → workflow-specialist → research-guide` 双向 handoff 通过，页面显示角色、工具名和 SDK 交接事件。首次实现发现专家不自动续答，补充 `on_enter`；返还时发现历史意图会造成循环交接，已用进入回复禁用工具修复并复验。
- 第三阶段工作流：`research-guide → appointment-intake → appointment-review → research-guide` 完成；三项参数化草稿在三个角色间一致。MiniMax TTS 改用 PCM 后最终日志无新增解码错误；390px 明暗主题无横向溢出。
- 第四阶段恢复：`apt-d8866c3c` 在审核阶段暂停，完整服务重启后于新房间恢复相同 ID 与字段，再确认成功；`apt-324855c7` 真实取消。页面显示 SQLite 版本和本地研究边界。
- 第五阶段安全：`visitor-1b2dcac4` 在新房间恢复自己的 `apt-3dff5a54`；`visitor-82ae2a60` 无法恢复该任务；version 1 对 version 2 的陈旧写入被拒绝；任务过期为 version 3 后不能再次恢复。深色主题可读，窄屏视口无横向溢出，两个最终标签页 console 均为 0 error。
- 第六阶段审批：审核角色只可请求审批；`appointment-approval` 只可批准或拒绝。`apt-e24fdf7a` 经人工批准为 confirmed，`apt-c6e20814` 经人工拒绝为 rejected 并保留原因；`apt-0546487f` 留在 pending_approval 供体验。390px 下 `scrollWidth=clientWidth=375`，审计卡和按钮无溢出；深色背景为 `rgb(23, 26, 24)`。
- 第七阶段调度：`livekit-research-minimax` 不再自动入房；浏览器先显示 1 人，再由后端显式 dispatch。`local-demo-5b97a992` 与 `local-demo-f7d41324` 同时为 2 人，分别拥有独立 Dispatch/Job，均由 `AW_w7xmknKTe877` 接管；第三个独立房间随后也运行。重复请求返回 `created=false` 并复用原 Dispatch。Agent 房间事件与 API Job 一致。
- 第八阶段容量：本地 Worker 按 active jobs / 2 计算负载。前两房间运行时显示 2/2、100%、FULL；第三房间只有 Dispatch、无 Job。释放一席后 Worker 变 AVAILABLE，但等待 9 秒仍未自动重投；页面如实提示并启用 requeue。旧 `AD_hvCTqeYuLKT7` 被 `AD_dSHpuS2hBNiN` 替换，随后获得 `AJ_QNF4g5zPCPKC / running`，房间从 1 人变 2 人。真实 MiniMax 工具/文字/音频/指标 smoke 保持通过。
- 第九阶段韧性：Windows MiniMax Worker 显式使用独立 Job 进程。`AJ_huqbzZugiuzo` 以 70 退出后，Worker `AW_8sCzgGEWjRLy` 与三项本地服务仍在线，容量 1/2→0/2，Agent 参与者离房；30 秒内 `ON_FAILURE` 没有生成替代 Job，Dispatch API 还保留陈旧 `running`。页面不再误报可用，并提供受保护的显式恢复：`AD_orcjUCdhDVeu → AD_c6AZRBXvPL2d → AJ_jmoRYJCML3MM`，同 Worker、参与者 1→2。41 tests 与真实 MiniMax smoke 通过。
- 第十阶段 Worker 池：两个同名 Worker 分别注册为 `AW_fryxW7rWPFyV` 和 `AW_bowASz5ZzAmX`；两个房间实际各落到一个实例，各 1/2。停止 `worker-1` 后，第二房间和 `worker-2` 不受影响；30 秒没有自动跨 Worker 重派，旧 Dispatch 仍陈旧 running。显式替换为 `AD_zafyjAK8QcqS → AJ_UiKe5voup85m` 后，当前房间由存活 Worker 接管。降级池上的真实 MiniMax smoke 仍 passed。
- 麦克风：用户已在普通浏览器完成物理采集与完整语音回合；内置自动化浏览器仍无法控制硬件权限，因此无人值守硬件回归为有效 defer。

### 修订 2 最终校准记录

```text
Current stage: Stage 9
User phase: 本地部署 LiveKit、真实浏览器入房、Agent 加入与语音入口
Coverage item: 服务、Token、唯一房间、参与者、Text Stream、离线恢复、主题和响应式
User goal: 在本机运行 LiveKit，并亲自看到浏览器与 Agent 位于同一真实房间
Browser environment: Codex 内置浏览器；127.0.0.1:17828；1280×800、390×844
Observed evidence: HTTP 三项通过；Agent smoke passed；浏览器 2 人入房并得到真实参与者工具回答；手机无溢出；离开/重连/服务离线状态可观察
Problem category: 控件状态、流式文本累积和断线提示的三处状态同步问题
Root cause: 参与者事件未刷新控件；Text Stream chunk 被覆盖；Reconnecting 未更新 notice
Minimal intervention: 在参与者事件更新 controls；逐 chunk 累积文字；为 Reconnecting 设置明确错误提示
Adjacent regression surfaces: 桌面/手机、离开/再加入、浅色/深色、Agent 未加入/已加入
Observed result: 发送按钮随 Agent 加入启用；回答完整；离线状态不再与成功提示矛盾
Decision: pass（物理麦克风已人工验证；自动化硬件授权为有效 defer）
Next executable action: 根据产品需要选择真实日历、CRM、工单或多人会议聚合，不再重复验证已通过的基础闭环
New authority required: MiniMax/OpenAI 模型 Key、完全本地模型下载、局域网/公网开放或生产部署
```

```text
Entry mode: brief-led
Request revision: 1
Target user and context: 需要理解 LiveKit 与 LiveKit Agents 区别，并判断实时 AI 能力是否值得采用的项目维护者
Desired first impression: 先看到“AI 作为可编程参与者进入房间”，再通过一次房间会话看懂听、想、调用工具、说和被打断的链路
Visual ambition: Editorial
Experience architecture: Editorial Flow
Visual constraints: 延续总门户纸张/墨色研究语言；不依赖外部图片或字体；浅色与深色均可读；能力演示优先于装饰
Information constraints: 必须区分 LiveKit 媒体层、Agents 会话层、模型层与业务工具；只把本地真实通过的测试标记为已验证；不得暗示已接入真实云模型、麦克风、LiveKit Cloud、SIP 或数字人
Operation constraints: 用户可以启动/重置演示、切换能力场景和主题；控件支持鼠标与键盘；页面在无脚本时仍保留完整结论
State constraints: 演示包含待机、连接、监听、思考、工具调用、说话、打断和完成状态；重置后回到待机；不同场景输出不同事件链
Environment constraints: GitHub Pages 静态托管；演示是基于真实测试证据的前端回放，不连接后端、不使用模型 Key、不采集麦克风
Primary journey: 进入页面 → 理解四层职责 → 选择场景 → 启动房间会话 → 观察 Agent 状态和事件 → 查看已验证边界 → 获取本地运行命令
User-defined phases: 获取源码、安装、运行验证、能力演示、总项目接入
Required artifacts: 上游审计副本、隔离虚拟环境、离线 AgentSession 演示、测试结果、README、REPORT、静态专题页、门户入口、运行脚本和验收记录
Autonomy authorization: 用户明确要求作为子项目获取、安装并演示，允许在当前总仓库内完成可逆实现与验证
User-decision boundary: 真实云模型 Key、LiveKit Cloud 凭据、SIP 号码、数字人账号和公开发布不在本次授权内
Observable completion criteria: livekit-agents 1.6.8 可导入；离线演示产生工具调用和会话事件；至少覆盖工具调用、完整管线指标与打断测试；专题页在桌面/平板/手机无横向溢出，浅色/深色、场景切换、启动/重置可用；根门户出现第八个项目；文档明确真实与模拟边界
```

## 覆盖清单

| 用户阶段 | 要求或产物 | 表面/状态 | 证据 | 阶段 | 状态 | 下一步 |
|---|---|---|---|---|---|---|
| 获取源码 | 上游源码与版本记录 | 本地文件 | commit、版本、目录检查 | Stage 0–1 | pass | 无 |
| 安装 | 隔离环境安装核心包 | Python 3.10 | import 与版本输出 | Stage 1 | pass | 无 |
| 运行验证 | 上游无云账号测试 | 工具、事件、指标、打断 | pytest 输出 | Stage 1/9 | pass | 写入报告 |
| 能力演示 | AgentSession 离线工具调用 | 命令行 | JSON 事件结果 | Stage 1/5 | pass | 无 |
| 能力演示 | 专题页主旅程 | 桌面浅色/深色 | 浏览器交互与截图 | Stage 2–6 | pass | 无 |
| 能力演示 | 主题与响应式 | 深浅色；1280/1024/390 | 浏览器截图、DOM 宽度 | Stage 7 | pass | 无 |
| 能力演示 | 键盘语义与焦点 | 可访问性 | 原生控件、焦点轮廓、交互观察 | Stage 7 | pass | 无 |
| 能力演示 | 无脚本与 reduced-motion | 能力回退 | 源码与浏览器能力检查 | Stage 8 | defer | 浏览器不能禁用 JS 或模拟系统 reduced-motion；在具备对应开关的环境复测 |
| 总项目接入 | 第八个项目入口与根文档 | 门户/README | DOM、链接与文件检查 | Stage 3/9 | pass | 无 |
| 交付 | 安装、运行和边界说明 | Markdown/脚本 | 文件与命令复现 | Stage 9 | pass | 无 |

## 设计方向

| 决策 | 方向 | 可观察约束 | 验收标准 |
|---|---|---|---|
| 首屏层级 | “AI 进入房间”结论优先，运行演示为主操作 | 一项主操作；版本与验证数据为辅助 | 首屏无需滚动即可理解定位并启动演示 |
| 能力表达 | 四层职责 + 单次会话事件轨迹 | LiveKit、Agents、模型、业务工具不得混写 | 用户能沿事件轨迹指出每层职责 |
| 状态反馈 | 房间参与者卡与事件日志同步变化 | 状态不只依赖颜色，包含文字和序号 | 启动、打断、完成、重置均有明确反馈 |
| 主题 | 复用门户的纸张/墨色语义 | 深浅主题信息层级一致 | 两个主题下文本、控件和状态均清晰 |
| 响应式 | 桌面双栏，窄屏单栏 | 390px 不裁切控制和日志 | 三档视口无横向溢出 |
| 动效 | 仅说明状态推进 | reduced-motion 下取消非必要过渡 | 无动效时信息和操作仍完整 |

## 浏览器验收记录

- 验收时间：2026-08-08（Asia/Shanghai）
- 规范地址：`http://127.0.0.1:49327/livekit-agents.html`
- 桌面 `1280×720`：浅色首屏层级、双栏房间卡、工具回放 `6/6`、深色主题与重置通过；控制台无错误或警告。
- 平板 `1024×768`：`scrollWidth = clientWidth = 1009`，首屏和演示双栏无横向溢出。
- 手机 `390×844`：`scrollWidth = clientWidth = 375`，首屏、单栏参与者、事件日志和场景控制无横向溢出；打断回放 `6/6`。
- 三个场景：工具调用、SDK 打断机制、Agent 交接均完成 `6/6`；交接后活动角色显示为 `Billing Agent`。其中打断场景是离线机制回放，不代表当前 MiMo 稳定单轮已启用自然打断。
- 主题与状态：浅色 → 深色、回放 → 重置均通过；重置后回到 `0/6`、待机和空事件状态。
- 门户：根页面渲染 8 张项目卡，`projectCount=08`，LiveKit Agents 卡片和 `./livekit-agents.html` 入口存在。
- 键盘：交互使用原生链接、按钮和 tab 语义；焦点元素显示 `2px solid` 轮廓。浏览器的原生连续 Tab 注入未移动焦点，因此未声称完整物理键盘顺序已复测。
- 能力回退：页面包含 `<noscript>` 说明和 `prefers-reduced-motion` 样式，但当前浏览器不能禁用 JavaScript 或模拟系统动作偏好；触发条件是换用具备对应 DevTools/OS 开关的浏览器复测。

## 最终校准记录

```text
Current stage: Stage 9
User phase: 能力演示与总项目接入
Coverage item: 主旅程、主题、响应式、场景状态和门户入口
User goal: 看懂 LiveKit Agents 的职责，并能本地复现已经验证的能力
Browser environment: Codex 内置浏览器；127.0.0.1:49327；1280×720、1024×768、390×844
Observed evidence: 三场景均完成 6/6；深浅主题可切换；重置回到 0/6；三档视口无横向溢出；门户显示 8 个项目；控制台为空
Problem category: 首屏中文标题断行
Root cause: 桌面字号与左栏宽度使“参与者”最后一个字孤立换行
Minimal intervention: 收敛桌面标题字号并为“参与者。”设置不可拆分短语
Adjacent regression surfaces: 桌面房间卡、手机标题、首屏按钮与指标
Observed result: 桌面标题按语义换行，手机无溢出，邻近内容保持可见
Decision: pass
Next executable action: 无
New authority required: 真实云模型、麦克风、房间、SIP 或数字人凭据才需要新授权
```
