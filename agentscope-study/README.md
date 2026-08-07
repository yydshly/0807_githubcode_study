# AgentScope 效果研究

> 上游项目：[agentscope-ai/agentscope](https://github.com/agentscope-ai/agentscope)
>
> 公开 Web 演示：[AgentScope 研究专题页](https://yydshly.github.io/0807_githubcode_study/agentscope.html)
>
> 当前结论：**框架与 MiniMax M3 真实调用链路已经跑通，值得继续评测；尚不能据此证明真实业务研判质量达标。**

这个子项目用于判断 AgentScope 是否适合成为我们开发 Agent 的基础框架，并验证它作为 ShadowBroker 等数据系统上层研判服务的可行性。它不修改 ShadowBroker 本体。

## 一句话理解

AgentScope 不是 Pi、Codex 这类可以直接完成用户任务的成品 Agent，而是一套用于开发 Agent 的基础设施：

```text
用户目标
→ 大模型判断下一步动作
→ AgentScope 组织循环、校验并调度工具
→ 业务工具查询数据或执行操作
→ 结果回填到消息与记忆
→ 大模型继续决策
→ 输出经过校验的结构化结果
```

可以把它理解为：**大模型是大脑，工具是手脚，记忆是上下文，AgentScope 是把它们组织起来的运行骨架。**

## 谁提供什么

| 层级 | 负责内容 | 是否由 AgentScope 自动提供 |
|---|---|---|
| MiniMax M3 等大模型 | 理解目标、选择工具、综合信息、生成回答 | 否，需要按需配置模型和凭证 |
| AgentScope | 模型适配、消息格式、ReAct 循环、工具调度、记忆接口、多 Agent / 工作流、结构化输出 | 是，属于框架基础设施 |
| 我们的业务工具 | 查询事件、核验来源、时空计算、搜索数据库、调用内部 API | 否，需要我们编写或接入 |
| 我们的数据与规则 | 数据源、权限、证据标准、业务边界、安全策略 | 否，需要我们治理 |
| 运行环境 | Python、存储、网络、密钥、日志、监控和部署 | 否，需要我们建设 |

因此，更准确的说法是：**AgentScope 提供了工具接入和记忆接入的入口，也带有一些通用工具与实现，但真正决定业务能力的工具、数据、记忆策略和工作流仍由我们提供。**

## AgentScope 提供的主要能力

- **模型接入**：通过对应模型类和 Formatter 适配不同服务商与消息协议。
- **工具系统**：把 Python 函数和说明注册为模型可调用的工具，并负责参数校验、执行和结果回填。
- **Agent 循环**：组织“模型决策 → 工具调用 → 结果回填 → 继续决策”的多轮过程。
- **结构化输出**：结合 Pydantic 等数据模型约束最终结果，便于后续程序直接消费。
- **记忆接口**：支持进程内、持久化和外接长期记忆实现。
- **多 Agent 与工作流**：提供消息传递、协作编排、人工介入和扩展入口。
- **通用工具**：当前验证版本包含 Python / Shell 执行、文本文件读写以及部分图像和音频工具；生产环境是否开放这些高权限工具必须由我们决定。
- **观测与服务扩展**：可以记录工具调用过程，并接入存储、MCP 和服务化能力。

## 它有记忆能力吗

有，但要区分“接口存在”和“业务上已经拥有可靠长期记忆”。

| 类型 | AgentScope 可用实现 | 当前实验状态 | 说明 |
|---|---|---|---|
| 进程内记忆 | `InMemoryMemory` | 已启用 | 保存本次运行的消息与工具结果，程序退出后消失 |
| 持久化记忆 | Redis、SQLAlchemy、Tablestore 等 | 未启用 | 可跨进程保存，需要我们部署存储并定义数据生命周期 |
| 长期记忆 | Mem0、ReMe 等外接实现 | 未验证 | 仍需设计召回、遗忘、去重、隐私、权限和成本策略 |

记忆不会自动变得正确。生产接入前必须回答：记录什么、何时召回、如何纠错、多久删除、谁能访问，以及错误记忆怎样降级。

## 和 Pi、Codex 这类 Agent 的区别

| 对比项 | AgentScope | Pi / Codex 等成品 Agent |
|---|---|---|
| 定位 | 开发框架 / SDK | 可直接使用的 Agent 产品或运行时 |
| 初始能力 | 提供基础模块和扩展入口 | 已配置模型、工具、提示词、权限和交互界面 |
| 业务工具 | 主要由开发者接入 | 产品已经内置并治理 |
| 记忆与工作流 | 提供接口，按场景设计 | 产品侧已经做出默认选择 |
| 适合用途 | 开发自己的垂直 Agent | 直接完成编码、研究或个人助手任务 |

如果我们的目标是“马上完成一个具体任务”，优先使用成品 Agent；如果目标是“开发自己的 Agent 产品和业务流程”，AgentScope 才是合适的研究对象。

## 当前已经达到的目标

### 离线机制验证

- `ReActAgent` 可以连续执行多轮模型交互；
- Python 函数可以自动注册为工具 Schema；
- 多个来源核验工具可以在同一轮并行执行；
- 工具结果会回填到模型上下文；
- 确定性时空计算由工具完成，不依赖模型心算；
- 最终结果可以通过 Pydantic 结构和范围校验；
- 工具调用顺序和参数可以单独审计。

### MiniMax M3 首次真实运行

2026-08-07 使用 MiniMax 官方 Anthropic 兼容接口完成真实运行：

| 指标 | 结果 |
|---|---|
| 模型 / 协议 | `MiniMax-M3` / Anthropic Messages API |
| Thinking / 流式 | adaptive / 非流式 |
| 端到端时间 | 约 38 秒 |
| 实际工具调用 | `query_events × 1`、`get_source_evidence × 3`、`correlate_events × 2`、`generate_response × 1` |
| 结构化输出 | 通过 `EventAssessment` 校验 |
| 模型结果 | `likely_related=true`、`confidence=0.6` |

这次运行证明了鉴权、模型标识、Anthropic 消息格式、thinking 连续性、多轮 Function Call、并行工具调用和结构化输出链路可用。

示例数据是合成数据，不代表现实事件。模型还把未由工具提供的领域推断写进了 evidence，因此本次结果**不能证明业务研判质量已经可靠**。详细记录见 [REPORT.md](REPORT.md)。

## 用配置文件接入 MiniMax M3

接入依据：[MiniMax 官方 Anthropic API 手册](https://platform.minimaxi.com/docs/api-reference/text-anthropic-api)

```text
base URL: https://api.minimaxi.com/anthropic
model: MiniMax-M3
SDK protocol: Anthropic Messages API
```

### 1. 准备本地配置

```powershell
Copy-Item .\config.example.json .\config.local.json
```

打开 `config.local.json`，仅在本机填入 `api_key`：

```json
{
  "provider": "minimax",
  "model": "MiniMax-M3",
  "api_key": "填入本地密钥",
  "base_url": "https://api.minimaxi.com/anthropic",
  "max_tokens": 4096,
  "temperature": 1.0,
  "thinking": {"type": "adaptive"},
  "stream": false
}
```

`config.local.json` 已被 `.gitignore` 排除，程序也不会打印密钥。仓库只提交无密钥的 `config.example.json`。

### 2. 安装可复现依赖

2026-08-07 从 PyPI 安装得到 `agentscope==1.0.21`。它声明 `mcp>=1.13`，但与自动解析到的 `mcp==2.0.0` 不兼容，因此项目显式锁定：

```text
agentscope==1.0.21
mcp>=1.13,<2
```

### 3. 运行

离线验证：

```powershell
.\run-offline.cmd
```

MiniMax M3 真实验证：

```powershell
.\run-minimax.cmd
```

当前第一次验证采用非流式响应，以优先确认多轮工具调用兼容性。`thinking: {"type": "adaptive"}` 和 `temperature: 1.0` 按 MiniMax 官方建议配置；AgentScope 的 `AnthropicChatFormatter` 会在后续轮次保留 thinking、text 和 tool_use 内容块。

`live_demo.py` 也保留了 `openai` 和 `dashscope` 提供方入口，可通过另一个本地 JSON 文件配置，并用 `--config` 指定。

## 对我们的意义

AgentScope 最适合作为上层 Agent 服务底座：读取规范化事件，调用来源核验和时空计算工具，输出可审计的结构化结论。它能够减少重复搭建模型适配、工具循环、记忆接口和结构化输出的工作。

它不应替代：

- 数据采集、清洗、数据库和地图渲染；
- 业务工具、数据质量和权限治理；
- 事实核验、安全审批和失败降级；
- 对模型效果、成本和一致性的正式评测。

## 下一阶段目标

对同一批至少 20 个固定事件案例，比较 AgentScope + MiniMax M3 与“单次模型调用 + 固定查询代码”：

1. 工具选择是否正确；
2. 是否只引用真实工具证据；
3. 是否把相关性错误表述为因果；
4. 是否主动保留反证和不确定性；
5. 结构化输出成功率；
6. 每案轮数、延迟和费用；
7. 同题重复三次的一致性；
8. 工具报错或返回空数据时是否安全降级。

只有这些指标明显更好，才值得把它接入真实业务系统。

## 文件入口

- [REPORT.md](REPORT.md)：离线和 MiniMax M3 实测报告；
- [WEB_DEMO.md](WEB_DEMO.md)：专题页设计契约、覆盖范围与验收记录；
- [config.example.json](config.example.json)：无密钥配置模板；
- [offline_demo.py](offline_demo.py)：确定性离线机制验证；
- [live_demo.py](live_demo.py)：真实模型接入入口；
- [run-offline.cmd](run-offline.cmd) / [run-minimax.cmd](run-minimax.cmd)：Windows 运行入口。
