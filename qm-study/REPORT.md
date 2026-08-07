# QM 阶段研究报告

## 研究问题

本次研究回答四个问题：

1. QM 是不是一个“管理多个 Agent 的 Agent”？
2. 它的主要能力如何由代码实现？
3. 权限、隔离和持久运行之间是什么关系？
4. 它对当前研究总项目有什么实际价值？

## 核心判断

QM 不是模型驱动的上级 Agent，也不是 AutoGen、CrewAI 一类角色协作图。它是一个 headless control plane：把来自 Slack 或 Web 的每次 Turn 转换成带身份、Scope、资源、凭据、安全策略和沙箱边界的受控执行。

可以将其核心公式写成：

```text
身份 + 会话参与者 + Scope + ACL + 组织策略
                    ↓
           计算本轮有效权限
                    ↓
上下文 + Workspace + Memory + Skills + Credentials + Sandbox
                    ↓
             Harness / Model 执行
                    ↓
            持久化、投递与审计
```

## 直接代码证据

| 结论 | 上游实现证据 |
|---|---|
| DM、群聊、频道映射成不同 Scope | `src/resolution/resolution-service.ts` |
| 组织资源只读、当前 Scope 可读写 | `Resolution.layers` 中的 `global: ro` 与当前 Scope `rw` |
| 群聊使用共同可见资源 | Audience Filter、ACL `handlesForAudience`、会话可见条目交集 |
| 模型运行时可替换 | `src/harness/harness.ts` 与 `harness-router.ts` |
| 命令执行前先做策略判断 | `src/tools/primitives.ts` 中 `evaluateCommandWithLayer` |
| 沙箱按本轮资源和凭据装配 | `src/core/orchestrator/sandboxes.ts` |
| 记忆按 Scope 读写 | `src/memory/memory-service.ts` 与 `memory/policy.ts` |
| Skill 有审查、发布和晋升过程 | `src/skills/skill-store.ts` |
| 凭据按 Scope 发放一次性或长期 Grant | `src/credentials/keychain.ts` |
| 后台任务采用租约和心跳 | `src/runs/run-store.ts` 与 `worker.ts` |

## 一次 Turn 的实现链路

1. Surface 插件把 Slack/Web 事件转换为 actor、conversation 与输入。
2. Orchestrator 检查内部身份、群成员版本、速率和预算。
3. Resolution Service 计算 Scope、Workspace Layers、系统规则、命令策略、出网边界和授权文件句柄。
4. 会话历史按所有参与者的共同权限过滤。
5. Keychain 仅物化个人自有凭据或已授权给该 Scope 的 standing grant。
6. Harness Router 选择组织批准且与模型兼容的 Adapter。
7. Agent 调用工具时，`execute` 先完成 deny/approval 判断，再延迟创建沙箱并执行。
8. 结果写入 Session、Memory、Run、File Artifact 与 Audit Log，并由 Delivery 返回原 Surface。

## 能力边界

QM 自己公开声明为早期实验软件，目标是降低跨 Scope 泄漏风险，而不是提供形式化不干扰证明或安全认证。尤其需要关注：

- 命令文本策略可被编码、脚本落盘等方式绕过。
- 浏览器动作没有全部重新进入核心命令审批链路。
- 凭据在沙箱中使用时为可读明文。
- 凭据 `purpose` 不是强制授权约束。
- 外部内容筛查是启发式并且覆盖不完整。
- 混合权限上下文的来源标签和过滤仍有缺口。
- 出网强制能力依赖具体沙箱后端。
- 管理员可以读取大量敏感内容。
- 会话、记忆、模型请求和文件可能长期保留。

## 阶段决策

| 判断项 | 结论 |
|---|---|
| 架构研究价值 | 很高 |
| 对当前总项目的补位价值 | 高，补齐组织运行和治理层 |
| 直接整库采用 | 暂不建议 |
| 非敏感受控 PoC | 建议在真实多人需求出现后进行 |
| 生产敏感数据 | 完成专项安全评审与泄漏测试前不建议 |

## 可靠性说明

本报告基于 2026-08-07 读取到的上游公开仓库、核心接口和安全说明。没有完成真实部署，因此关于可运维性、性能、成本和实际安全效果的结论仍需 PoC 验证。
