# David Ondrej Skills 研究档案交付记录

## 设计契约

```text
Entry mode: brief-led
Request revision: 1
Target user and context: 当前仓库维护者；需要快速检索、理解并判断第三方 Agent Skill 是否值得储备或改造
Desired first impression: 这是一个覆盖广但个人化明显的工作流样本库，应该按需吸收，不应整库照搬
Visual ambition: Functional with editorial hierarchy
Experience architecture: Editorial Flow
Visual constraints: 中文优先；清晰、克制、研究档案感；不依赖外部图片或字体；支持浅色与深色
Information constraints: 完整覆盖 47 个技能；区分能力、依赖、适配度和风险；不把文档能力误写成已安装或已验证能力
Operation constraints: 支持搜索、分类筛选、采用建议筛选、主题切换和清空条件；鼠标与键盘均可操作
State constraints: 默认、筛选结果、无结果、浅色、深色；筛选状态与结果计数必须同步
Environment constraints: 纯静态 HTML/CSS/JS；无构建步骤、后端、API Key 或第三方运行服务；Windows/Codex 作为主要适配判断基线
Primary journey: 进入专题 → 理解总体判断 → 按分类或建议筛选 → 阅读具体技能 → 查看我们的采用策略和 Markdown 档案
User-defined phases: 分类整理、直观网页、价值 README、总入口登记
Required artifacts: README、分类技能目录、采用矩阵、静态专题页、样式、交互脚本、总入口与根 README 登记、浏览器验收记录
Autonomy authorization: 用户明确要求整理并用网页展示，允许在当前研究仓库内直接实现
User-decision boundary: 不安装或执行上游技能；不接入付费 API、账号、生产数据库、部署服务或远端发布
Observable completion criteria: 47 个技能均可检索；分类和采用建议计数正确；桌面与 390px 页面无横向溢出；浅色与深色可读；Markdown 说明与网页判断一致；静态资源、链接和脚本检查通过
```

## 设计方向

| 决策 | 方向 | 可观察约束 | 验收标准 |
|---|---|---|---|
| 首屏判断 | 先给“按需吸收、不要整库照搬”的结论 | 结论先于完整清单 | 首次浏览可在一屏内理解定位 |
| 信息结构 | 总览、分类、47 项目录、采用策略、边界 | 每个技能同时有分类和建议等级 | 搜索与双维筛选均可定位技能 |
| 视觉语言 | 编辑式研究索引，深墨色配少量分类色 | 装饰不压过文字和控件 | 断开外部资源后页面完整 |
| 响应式 | 桌面双栏/多栏，手机单栏 | 控件可换行，卡片不裁切 | 1280px 和 390px 无横向溢出 |
| 主题 | 浅色与深色使用语义变量 | 文字、边框、焦点和状态均可辨认 | 双向切换后内容保持可读 |
| 动效 | 只用于筛选结果和状态反馈 | reduced-motion 下关闭非必要过渡 | 信息不依赖动画出现 |

## 覆盖清单

| 用户阶段 | 要求或产物 | 表面 / 状态 | 证据 | 阶段 | 状态 | 下一步 |
|---|---|---|---|---|---|---|
| 分类整理 | 47 项分类 Markdown | 文件 | 47 行技能表、5 类计数、依赖和上游链接核对 | Stage 0–3 | pass | 无 |
| 价值 README | 对我们的意义、价值和使用原则 | 文件 | README、四级采用矩阵和研究边界一致 | Stage 0–3 | pass | 无 |
| 直观网页 | 首屏、分类概览、技能目录、采用策略 | 桌面浅色 | 1280×720 截图、DOM 阅读顺序和 47 行目录 | Stage 1–3 | pass | 无 |
| 直观网页 | 搜索、分类、建议筛选和无结果 | 桌面浅色 | macOS=4；Agent 编排=13；Agent 编排×优先吸收=3；无结果与重置通过 | Stage 4–6 | pass | 无 |
| 直观网页 | 深色主题 | 桌面深色 | 主题属性、按钮状态、计算颜色和截图 | Stage 6–7 | pass | 无 |
| 直观网页 | 响应式布局 | 390×844 | 页面、筛选按钮和技能行边界测量 | Stage 7 | pass | 视口与滚动宽度均为 390px，无横向溢出 |
| 直观网页 | 键盘焦点 | 桌面 | 原生语义控件、`:focus-visible` 计算样式和两条 Tab 注入路线 | Stage 7 | defer | 焦点轮廓可见；内置浏览器 Tab 注入未移动焦点，使用物理键盘或支持原生 Tab 的浏览器时复测完整顺序 |
| 直观网页 | reduced-motion | CSS/系统偏好 | 媒体查询和浏览器能力检查 | Stage 7–8 | defer | 已实现媒体查询；当前浏览器没有动作偏好模拟能力，在系统开启“减少动态效果”时复测 |
| 总入口登记 | 根门户项目卡片和 README 表格 | 默认/筛选 | 默认 5 张卡片；Agent 框架筛选得到 AgentScope 与 David Ondrej Skills | Stage 3–6 | pass | 无 |
| 工程交付 | HTML/CSS/JS/Markdown 质量 | 静态文件 | JS 语法、diff、HTTP 资源、浏览器日志 | Stage 9 | pass | 专题 HTML/CSS/JS 均返回 200；页面日志为空 |

## 本地浏览器验收

- 验证日期：2026-08-07（Asia/Shanghai）
- 启动方式：在仓库根目录运行静态 HTTP 服务
- 验证地址：`http://127.0.0.1:49327/davidondrej-skills.html`
- 桌面：1280×720，浅色首屏、47 项目录、分类统计和采用统计完整；页面宽度与滚动宽度一致
- 交互：`macOS` 搜索显示 4 项；Agent 编排显示 13 项；与“优先吸收”组合后显示 `git-worktree`、`goal-loop`、`handoff` 3 项；无结果和重置通过
- 深色：主题属性、按钮标签、背景/文字计算颜色和目录内容通过
- 手机：390×844，页面、筛选面板、筛选按钮和技能行均在视口内；Skill 创作筛选正确显示 4 项
- 总入口：默认 5 张项目卡片；Agent 框架筛选正确显示 2 张
- 运行状态：专题页与总入口浏览器错误/警告日志均为空
- 验收边界：没有安装或执行上游技能；键盘连续 Tab 和 reduced-motion 需在具备对应原生能力的环境复测
