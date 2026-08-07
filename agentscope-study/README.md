# AgentScope 效果研究

这个子项目用于验证 AgentScope 是否适合成为 ShadowBroker 上层的事件分析 Agent 框架，不修改 ShadowBroker 本体。

## 当前验证范围

- ReAct 多轮循环是否真实运行；
- Python 工具能否自动转成工具 Schema 并被调用；
- 多个取证工具能否并行执行；
- 工具结果是否会回填到模型上下文；
- 能否强制输出结构化研判；
- 安装、依赖和版本管理的真实成本。

示例数据是合成数据，不代表真实世界事件。离线模式使用确定性的模型替身，因此只证明框架机制，不证明大模型的分析质量。

## 已确认的版本问题

2026-08-07 从 PyPI 安装得到 `agentscope==1.0.21`。它声明 `mcp>=1.13`，但与自动解析到的 `mcp==2.0.0` 不兼容，首次导入会报错。因此本项目显式锁定：

```text
agentscope==1.0.21
mcp>=1.13,<2
```

不要在可复现环境中只写一个没有版本限制的 `agentscope`。

## 运行离线验证

```powershell
.\run-offline.cmd
```

预期过程：

1. 查询东海两小时事件；
2. 并行查询 AIS 事件和天气事件的来源证据；
3. 调用确定性的时空关联计算；
4. 生成带置信度、证据、反证和建议的结构化结果。

## 运行真实模型验证

### MiniMax M3（当前计划）

按照 [MiniMax 官方 Anthropic SDK 手册](https://platform.minimaxi.com/docs/api-reference/text-anthropic-api)，使用：

```text
base URL: https://api.minimaxi.com/anthropic
model: MiniMax-M3
SDK protocol: Anthropic Messages API
```

运行：

```powershell
Copy-Item .\config.example.json .\config.local.json
# 使用文本编辑器打开 config.local.json，将 api_key 填入
.\run-minimax.cmd
```

项目已经准备了本地文件 `config.local.json`，直接填入 `api_key` 即可。它已加入仓库忽略规则，不会被 Git 跟踪；程序输出也不会打印密钥。`config.example.json` 只作为无密钥模板提交。

配置字段：

```json
{
  "provider": "minimax",
  "model": "MiniMax-M3",
  "api_key": "填入密钥",
  "base_url": "https://api.minimaxi.com/anthropic",
  "max_tokens": 4096,
  "temperature": 1.0,
  "thinking": {"type": "adaptive"},
  "stream": false
}
```

第一次验证使用非流式响应，先确认多轮工具调用兼容性，再考虑把 `stream` 改为 `true`。

M3 的 thinking 默认为关闭。本项目显式使用 `thinking: {"type": "adaptive"}`，并使用 AgentScope 的 `AnthropicChatFormatter` 完整保留模型返回的 `thinking`、`text` 和 `tool_use` 内容块，满足官方对多轮 Function Call 的连续性要求。温度按官方建议设为 `1.0`。

如果 MiniMax 后续提供其他区域的 Anthropic 地址，修改配置中的 `base_url`；不要把 OpenAI 兼容的 `/v1` 地址混用到这个入口。

如果使用 Token Plan，适合个人交互式研究；正式多用户服务应根据 MiniMax 官方建议评估按量付费、限流和生产条款。

### 其他模型

`live_demo.py` 仍支持 `openai` 和 `dashscope`，通过另一个本地 JSON 配置文件设置对应的 `provider`、`model`、`api_key` 等字段，再使用 `--config` 指定文件。

真实模型实验必须与离线实验分开评价：重点观察它是否选择正确工具、是否遗漏反证、输出是否可重复，以及消耗的轮次和时间。
