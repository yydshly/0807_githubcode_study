# AgentScope Web 演示交付记录

## 设计契约

```text
Entry mode: brief-led
Request revision: 1
Target user and context: 希望判断 AgentScope 是否值得作为 Agent 二次开发底座的仓库访问者
Desired first impression: AgentScope 是开发框架，不是开箱即用的业务 Agent；模型、工具、记忆与工作流职责清晰
Visual ambition: Editorial
Experience architecture: Editorial Flow
Visual constraints: 延续总门户的纸张/墨色/荧光绿语义；中文优先；浅色与深色；无外部字体和图片依赖
Information constraints: 必须覆盖能力、原理、边界、记忆、MiniMax M3 接入、已验证结果、对我们的意义和下一阶段目标
Operation constraints: 专题页入口、能力切换、运行链路逐步演示、主题切换均支持鼠标和键盘
State constraints: 链路包含初始、逐步选中、自动播放、完成；内容切换包含选中与未选中；主题包含浅色和深色
Environment constraints: GitHub Pages 纯静态托管；无后端、无 API Key、无真实模型请求；固定结果来自 2026-08-07 本地真实运行
Primary journey: 理解定位 → 看懂职责分工 → 运行一次链路演示 → 检查真实结果与风险 → 按配置文件接入
User-defined phases: 补充必要描述、Web 演示、README、Git 提交
Required artifacts: agentscope.html、专题样式与脚本、门户入口、根 README、子项目 README、本交付记录
Autonomy authorization: 用户明确要求补充 Web 演示、README 并提交
User-decision boundary: 不上传密钥、不部署付费后端、不修改 MiniMax 账户、不推送远端
Observable completion criteria: 专题页资源 HTTP 200；桌面与 390px 手机无横向溢出；交互与主题可用；无控制台错误；README 与页面结论一致；创建独立 Git 提交
```

## 信息与交互覆盖

| 用户问题 | 页面表达 | 可观察状态 | 验收证据 | 状态 |
|---|---|---|---|---|
| 它是什么 | 首屏结论与职责边界 | 默认 | 首屏截图与正文检查 | pass |
| 它有什么能力 | 能力/边界切换面板 | 默认、切换 | 键盘与点击检查 | pass |
| 原理是什么 | Agent 运行链路 | 初始、逐步、自动播放、完成 | 交互检查 | pass |
| 工具和记忆谁提供 | 责任矩阵与记忆层级 | 默认 | 内容检查 | pass |
| 如何接 MiniMax M3 | 无密钥配置模板与四步接入 | 默认 | 内容与复制友好性检查 | pass |
| 我们验证了什么 | 真实运行结果、调用次数、耗时和输出 | 默认 | 与 `REPORT.md` 对照 | pass |
| 对我们有什么意义 | 适合/不适合/下一阶段决策 | 默认 | 内容检查 | pass |
| 静态演示的边界 | 页首和结果区显式说明 | 默认 | 内容检查 | pass |
| 主题与响应式 | 整页 | 浅色、深色、桌面、手机 | 浏览器截图与尺寸检查 | pass |
| 可访问性 | 跳转链接、按钮、标签页、焦点、减少动态效果 | 键盘、reduced-motion | 浏览器与源码检查 | pass |

## 真实性边界

- 页面中的工具调用路径和统计来自 `MiniMax-M3` 的首次真实运行。
- 事件内容使用合成样例，不代表现实事件，也不证明模型具有稳定的业务研判质量。
- 页面不会读取 `config.local.json`，不会接触 API Key，也不会从前端请求 MiniMax。
- 当前代码只启用了进程内记忆；持久化和长期记忆是 AgentScope 提供的可选接入能力，尚未在本实验启用。

## 本地浏览器验收

- 验证时间：2026-08-07（Asia/Shanghai）
- 验证地址：`http://127.0.0.1:8765/agentscope.html`
- 桌面：1440 × 900，首屏、浅色和深色主题通过；无控制台错误或警告。
- 手机：390 × 844，单列首屏、两列运行步骤和配置区无横向溢出。
- 交互：能力标签点击与左右方向键切换通过；运行链路自动完成 6 个步骤；配置模板复制反馈通过。
- 总门户：AgentScope 卡片显示“真实链路已通”，专题页相对链接正确，手机视口无溢出。
- 工程检查：专题页、CSS 和 JavaScript 返回 HTTP 200；JavaScript 语法与本地资源引用检查通过。
