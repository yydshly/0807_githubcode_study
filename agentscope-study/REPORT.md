# AgentScope 初步效果报告

审计日期：2026-08-07

## 结论

AgentScope 值得继续作为独立子项目研究。离线机制和 MiniMax M3 真实调用链路均已通过，但当前证据仍不能支持“真实业务分析效果好”。下一阶段应建立固定案例的同题对照评估。

它对 ShadowBroker 最有价值的位置是上层研判服务：读取规范化事件，调用来源核验和时空计算工具，输出可审计的结构化结论。它不应替代数据采集、清洗、数据库或地图渲染。

## 已实测通过

- `ReActAgent` 连续执行五轮模型交互；
- Toolkit 从 Python 函数和 docstring 生成工具定义；
- Agent 自动调用事件查询工具；
- 两个来源核验工具在同一轮被并行调度；
- Agent 调用确定性时空计算，而不是让模型心算；
- 工具结果被放回模型上下文；
- `structured_model` 临时注册 `generate_response` 工具；
- 最终结果通过 Pydantic 字段和范围校验；
- 工具调用顺序和参数可以单独审计。

本次离线结果进行了以下调用：

```text
query_events
├─ get_source_evidence(evt-ais-001)
├─ get_source_evidence(evt-weather-002)
└─ correlate_events(evt-ais-001, evt-weather-002)
   └─ generate_response(EventAssessment)
```

输出包含摘要、是否可能相关、`0.72` 置信度、三条证据、一条反证和两条后续建议。

## 发现的问题

### 1. PyPI 与 GitHub 版本线存在差异

本机通过 PyPI 可获得的最新版是 `1.0.21`，而 GitHub 仓库已经进入 2.x 开发和发布线。后续评估必须明确选择稳定 PyPI 版还是从源码跟进 2.x，不能混用两套文档和 API。

### 2. 裸依赖安装会失败

`agentscope==1.0.21` 的依赖声明允许安装 `mcp==2.0.0`，但运行时导入 `streamablehttp_client` 失败。锁定 `mcp>=1.13,<2` 后恢复正常。

### 3. 框架相对较重

最小安装同时带入模型 SDK、MCP、OpenTelemetry、SQLAlchemy、Socket.IO、音频等依赖。它更接近完整 Agent 应用框架，不是一个只有四个文件工具的轻量编码 Agent 核心。

### 4. 离线模型不代表智能质量

当前 `ScriptedStudyModel` 的决策是确定性的，只用于确认 AgentScope 的循环和数据通道。置信度 `0.72` 是测试输入，不是通过真实模型推理得到的概率。

## 下一阶段验收标准

对同一批至少 20 个固定事件案例，比较真实模型与规则基线：

1. 是否选择正确工具；
2. 是否引用了实际工具证据；
3. 是否把相关性错误表述为因果；
4. 是否主动保留反证和不确定性；
5. 结构化输出成功率；
6. 每案模型轮数、延迟和费用；
7. 同题重复三次的一致性；
8. 工具报错或返回空数据时是否安全降级。

只有这些指标明显优于“单次模型调用 + 固定查询代码”，才值得接入 ShadowBroker。

## MiniMax M3 接入设计

验证模型为 `MiniMax-M3`，按照 [MiniMax 官方 Anthropic SDK 手册](https://platform.minimaxi.com/docs/api-reference/text-anthropic-api)通过 AgentScope 的 Anthropic 兼容层接入：

```text
provider: minimax
model: MiniMax-M3
protocol: Anthropic Messages API
base URL: https://api.minimaxi.com/anthropic
credential: config.local.json -> api_key
thinking: adaptive
temperature: 1.0
```

实际项目改为从被 Git 忽略的 `config.local.json` 读取凭证及运行参数，不再依赖环境变量。报告和程序输出不得包含 `api_key`。

第一轮采用非流式模式，重点验证 Anthropic 兼容工具调用的请求和响应格式。AgentScope 的 Anthropic Formatter 会在后续轮次原样保留 thinking、text 和 tool_use 块，符合 MiniMax 官方对多轮 Function Call 的要求。通过后再测流式工具解析、长上下文、限流和费用。

## MiniMax M3 首次真实运行

运行日期：2026-08-07  
模式：Anthropic 兼容 API、adaptive thinking、非流式  
结果：成功  
端到端时间：约 38 秒

### 已验证能力

- MiniMax API Key 鉴权成功；
- `MiniMax-M3` 模型标识和 Anthropic Base URL 正确；
- 返回了 thinking 内容块，并在后续 Function Call 轮次继续工作；
- 首轮正确选择 `query_events`；
- 第二轮并行执行 3 次来源核验和 2 次时空关联；
- 正确使用工具计算出的 44.1 公里、11 分钟和 149.6 公里、14 分钟；
- 成功调用 `generate_response` 并通过 `EventAssessment` 校验；
- 最终输出明确区分了相关性与因果关系；
- 最终判断为 `likely_related=true`、`confidence=0.6`。

### 实际业务工具调用

```text
query_events × 1
get_source_evidence × 3
correlate_events × 2
generate_response × 1
```

### 暴露的问题

1. 模型把“典型强对流单体核心半径一般为 10–20 公里”写入反证，但工具结果没有提供这一事实，也没有外部来源支持。
2. 模型把“强对流可能造成 VHF/AIS 信号衰减或天线故障”写入证据；这是领域推断，不是本次工具返回的观测证据。
3. 模型主动扩展调查了航班事件，分析上有价值，但增加了调用数量和延迟；后续需要工具预算或调查范围约束。
4. adaptive thinking 会在当前终端输出详细推理，研究阶段有助于调试，生产环境不应直接展示给最终用户。

因此，M3 的 Agent 和工具使用能力已经得到初步确认，但下一版必须把输出分成“观测证据”“确定性计算”“模型推断”三类，并禁止无来源推断进入 evidence 字段。
