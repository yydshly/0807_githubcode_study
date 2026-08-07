# QM 架构与实现机制

## 1. 总体结构

QM 可以分为五层：

```text
Surface        Slack / Web / Admin / Portal
Control Plane  API / Identity / Resolution / Policy / Orchestrator
Agent Runtime  Harness Router / Codex / Claude Code / OpenCode / Pi
Execution      Sandbox / Tools / Processes / Deploy
Persistence    Postgres / Queue / Memory / Session / Audit / Artifacts
```

技术栈以 TypeScript 和 Node 为主，HTTP 使用 Fastify，Slack 使用 Bolt，Web UI 使用 Vite 与 Lit；持久层使用 Postgres，后台调度包含 pg-boss，文件可落本地或对象存储。

## 2. Scope：权限和隔离的主键

`ResolutionService.scopeFor()` 根据对话类型确定 Scope：

```text
dm      → personal:<actor>
group   → group:<conversation>
channel → channel:<conversation>
```

组织 Scope 与团队 Scope 不是当前写入目标，而是作为上层只读资源加入。典型 Workspace Layer：

```text
org:<orgId>       mount=global      mode=ro
channel:<id>      mount=/           mode=rw
team:<teamId>     mount=team-<id>   mode=ro（DM 中按需）
```

较低 Scope 的配置只能收紧或补充组织策略，不能覆盖组织级规则。出网策略也取会话受众的共同安全下限。

## 3. ACL 与共同可见性

文件、Skill、凭据和会话历史不是因为挂载了 Scope 就自动共享。系统还要检查：

- 资源所有 Scope；
- 被授权 Scope；
- 当前 actor 是否属于该 Scope；
- 会话所有参与者是否都能到达资源所有者或授权 Scope；
- 资源是否允许继续转授。

群聊历史采用参与者可见条目的交集。这样新加入项目的人不会让其他人的个人上下文进入群聊，成员列表变化时还会重置 Provider Session。

## 4. Harness Adapter

统一 Harness 抽象将不同 Agent 的差异限制在 Adapter 内：

```ts
interface Harness {
  profile: HarnessAdapterProfile;
  turns: { runTurn(); resetSession?(); close?() };
  models: { oneShot?(); compactHistory?(); screenSecurity?() };
  tools: HarnessToolPresentation;
}
```

Router 依次考虑组织批准列表、组织默认值、Scope 配置和本轮请求，并验证模型与 Harness 是否兼容。切换 Harness 时会清理两边的内部 Session。

这表示 QM 在一轮中通常选择一个 Agent Runtime；它没有在核心中定义“经理 Agent 拆任务给多个角色 Agent”的协作图。

## 5. Tool Context 与 Sandbox

Agent 获得的是固定、较小的工具面。最重要的 `execute` 在真正调用 `sandbox.run()` 前依次完成：

1. 检查只能选择 scoped、scratch、owner-auth 或 reached room 中的一种计算机。
2. 组合组织和部署层命令规则。
3. 返回 deny、require approval 或 allow。
4. 限制执行超时。
5. 按需物化 Skill Tree。
6. 延迟 provision 对应 Sandbox。
7. 使用 Tool Ledger 记录结果，支持安全重试。

Sandbox 接口统一 provision、run、文件读写、进程会话、备份和销毁。具体后端可以采用 resident disk 或 workspace snapshot 保持状态。

## 6. Memory

Memory 不是全组织共享向量库，而是按 Scope 读写。策略决定：

- 当前会话可以召回哪些 Scope；
- 哪个 Scope 是本轮可写记忆；
- 对话结束后是否自动提取事实；
- 是否进行合并、压缩或 scratch promotion。

默认逐轮策略通过 Harness 的一次性模型调用提取长期事实，并明确排除密钥、一次性琐事、纯系统机制以及由助手自行声称的用户偏好。

## 7. Skills

Skill Store 保存 Scope、Manifest、签名、版本、状态、能力申请和批准记录。生命周期为：

```text
draft → reviewed → published → archived
```

解析时按 Scope 优先级查找同名 Skill，并保留被遮蔽版本。执行前只将当前可见版本投影到沙箱的 Skills 目录，使用哈希和锁避免并发物化冲突。

## 8. Keychain

凭据分为环境变量、文件和 Broker 等交付方式。Grant 记录：

- credentialId；
- ownerId；
- audienceScopeId；
- once 或 standing；
- purpose；
- active/revoked/used；
- 过期时间。

Orchestrator 只在符合当前 Scope 时解密并注入，使用过程写入审计。共享自动化还可以使用单独的 owner-auth box，减少所有者凭据长期驻留在共享环境中的机会。

## 9. 后台任务

Cron 只负责计划与下一次触发时间，RunStore 负责持久运行状态。Worker 通过 lease claim 任务并定期 heartbeat：

```text
pending → running → done
             └→ retry → parked
```

自动任务最终仍调用同一个 Orchestrator，因此没有绕过身份、Scope、凭据和命令策略。Tool Ledger、dedupKey 和 slot claim 用于减少重复副作用。

## 10. 核心设计原则

QM 的核心不是“容器越多越安全”，而是让每次执行的边界由确定性数据计算：

```text
隔离：不同 Scope 默认不相通
装配：只加入本轮被授权的资源
执行：副作用经过策略、审批和预算
持久：状态可跨 Turn 和后台任务延续
审计：重要动作保留主体、资源和 Scope
```

隔离是基础，但真正完整的技术核心是“权限驱动的隔离、资源装配、执行控制和持久化审计”。
