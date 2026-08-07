# QM 组织级 Agent 运行平台研究归档

上游仓库：[yc-software/qm](https://github.com/yc-software/qm)

公开专题页：[QM 权限驱动的 Agent 运行边界](https://yydshly.github.io/0807_githubcode_study/qm.html)

## 阶段结论

**QM 不是“管理多个子 Agent 的总管 Agent”，而是一套以 Scope 为单位、由权限驱动的组织级 Agent 运行平台。**

它首先解析“谁在什么会话中工作、会话里还有谁”，再计算这一轮共同可见的资源和最低安全边界，最后动态装配组织只读层、当前空间可写层、授权文件、Skills、凭据、记忆、出网规则与持久沙箱，并把这套受控环境交给 Codex、Claude Code、OpenCode 或 Pi 执行。

最值得参考的不是某一个模型适配器，而是四个组合起来的技术核心：

```text
Scope 隔离
+ 确定性权限控制
+ 可替换 Harness
+ 持久沙箱与任务状态
```

它把原本依赖模型自觉遵守的权限约束，尽量移到模型之外的确定性系统中：Agent 负责推理，核心系统负责身份、授权、审批、隔离、投递和审计。

## 能力与实现机制

| 能力 | 主要实现 | 解决的问题 |
|---|---|---|
| 个人与共享空间 | `ResolutionService` 将 DM、群聊、频道映射为 personal/group/channel Scope | 确定本轮属于谁、写入哪里 |
| 权限驱动的环境装配 | Workspace Layer、ACL、Audience Filter、Egress Floor | 只挂载参与者共同有权访问的资源 |
| 多 Agent Harness | 统一 `Harness` 接口与 `HarnessRouter` | 在不重建组织层的情况下切换 Codex、Claude Code、OpenCode、Pi |
| 持久计算机 | `Sandbox` 接口及 local/AWS/Sprites 等后端 | 保留文件、工具、登录状态、后台进程和项目环境 |
| 长期记忆 | 按 Scope 的 `MemoryService` 与逐轮事实提取策略 | 避免个人、频道、项目记忆混在一起 |
| 共享 Skills | 作用域所有权、draft/reviewed/published 生命周期、物化到沙箱 | 让能力可以个人创建、团队审查、组织发布 |
| 凭据与授权 | Keychain Credential、once/standing Grant、Scope Audience | 控制谁的凭据可以在哪个空间使用 |
| 后台工作 | Cron、RunStore、Worker Lease、Heartbeat、Retry | 让无人值守任务仍经过同一套权限与审计链路 |
| 安全与治理 | Command Policy、Approval、Security Screening、Audit、Budget | 把高风险副作用放在模型之外控制 |

完整实现链路见[架构与实现机制](docs/architecture-and-implementation.md)。

## 对总项目的意义

当前总项目已经覆盖数据获取、Agent 开发框架、内容工作流和软件工程 Skills，但缺少“多人如何安全、长期地共同使用 Agent”的组织运行层。QM 补的是这一层：

```text
ShadowBroker / Horizon / Yichen Skills：数据与外部能力
David / Matt Skills：可复用工作方法
AgentScope：模型、工具调用与 Agent 开发
QM：身份、Scope、权限、沙箱、任务和审计
```

QM 当前没有原生接入 AgentScope。若要组合，需要新增 Harness Adapter；否则它们代表两条不同侧重点的路线：AgentScope 偏 Agent 应用开发，QM 偏组织级运行和治理。

## 本次已验证内容

- 阅读上游 README、部署说明、SECURITY 和核心 TypeScript 接口。
- 核对 Scope 解析、Workspace Layer、ACL、Harness Router、Sandbox、Memory、Skill、Keychain、Cron 与 Worker 的代码结构。
- 将公开能力与实现机制逐项对应，避免仅复述产品宣传。
- 核对作者公开的安全边界和已知限制。

## 本次没有做什么

- 未克隆或安装上游仓库。
- 未部署 Fly.io、AWS、Postgres、Slack 或 Web 后端。
- 未使用模型 Key、OAuth、云账号、生产密钥或真实组织数据。
- 未进行跨 Scope 泄漏测试、命令策略绕过测试或负载测试。
- 未验证真实部署成本、长期稳定性和中文协作平台适配。

因此本阶段属于**源码与架构审计、能力归档和采用判断**，不是生产部署验收。

## 资料索引

- [阶段报告](REPORT.md)
- [架构与实现机制](docs/architecture-and-implementation.md)
- [采用建议与风险边界](docs/adoption-and-risk.md)
- [上游 README](https://github.com/yc-software/qm#readme)
- [上游安全说明](https://github.com/yc-software/qm/blob/main/SECURITY.md)
- [上游部署入门](https://github.com/yc-software/qm/blob/main/docs/getting-started.md)

## 当前决策

**建议保留为高价值组织级 Agent 架构参考，并在出现真实多人协作需求时做受控 PoC；当前不建议直接承载敏感生产数据。**

重新开启部署验证应同时满足：

1. 已明确至少一个多人、跨个人与共享空间的真实业务场景。
2. 能提供独立云账户、身份系统、Postgres、沙箱和审计环境。
3. 可以使用非生产凭据建立跨 Scope 泄漏、权限收缩、任务重试和密钥暴露测试。
4. 已确定 Slack 是否适用，或愿意开发飞书、企业微信、钉钉等 Surface Adapter。
5. 已完成部署级威胁建模、数据保留策略和管理员权限评审。
