# GitHub Pages 研究门户交付记录

## 设计契约

```text
Entry mode: brief-led
Request revision: 2
Target user and context: 仓库维护者与希望快速了解研究结论、项目状态和演示边界的访问者
Desired first impression: 清晰、可信、长期可扩展，而不是临时堆放两个项目
Visual ambition: Editorial
Experience architecture: Editorial Flow
Visual constraints: 中文优先；信息层级明确；克制的技术感；支持浅色与深色；不依赖图片或外部字体
Information constraints: 当前两个项目是首批案例；不得把本地入口伪装成在线演示；必须明确静态门户与完整后端的边界
Operation constraints: 项目搜索、分类筛选、主题切换和所有链接支持鼠标与键盘
State constraints: 项目列表包含默认、有筛选结果、无结果；主题状态可切换；链接状态明确
Environment constraints: GitHub Pages 纯静态托管；无构建步骤；无后端；无 API Key；资源使用仓库相对路径
Primary journey: 访问门户 → 理解总仓库定位 → 筛选并进入子项目 → 理解其部署状态和资料入口
User-defined phases: 部署并完善
Required artifacts: 静态门户、样式、交互脚本、上游原库直接入口、Pages 标记、自动发布工作流、README 说明、浏览器验收与发布验证
Autonomy authorization: 用户明确要求“请部署并完善”，并延续直接提交 main、不走 PR 的发布要求
User-decision boundary: 真实后端、付费服务、域名和凭据接入不在本次范围
Observable completion criteria: Pages 公网返回 200；入口和项目链接有效；桌面/平板/390px 无横向溢出；主题和筛选可用；本地与远端提交一致
```

## 设计方向

| 决策 | 方向 | 可观察约束 | 验收标准 |
|---|---|---|---|
| 信息层级 | 总仓库定位优先，项目入口其次，方法与部署边界随后 | 首屏不把任一子项目误写成总项目 | 首次浏览能识别“多项目研究总仓库” |
| 视觉语言 | 编辑式研究索引，使用纸张/墨色语义与少量状态色 | 不使用依赖网络的大图或字体 | 断开外部资源后主体仍完整 |
| 项目扩展 | 由脚本中的结构化项目清单生成卡片 | 新项目不需要复制整页结构 | 增加一条项目记录即可生成入口 |
| 主题 | 浅色、深色使用同一语义变量 | 文字、边框、状态和焦点均可辨认 | 两个主题完成浏览器检查 |
| 响应式 | 桌面双栏、平板收敛、手机单栏 | 390px 无裁切、无横向滚动 | 三类视口完成浏览器检查 |
| 动效 | 仅用于状态与悬停反馈 | 减少动画模式关闭非必要过渡 | 内容不依赖动效出现 |

## 覆盖清单

| 用户阶段 | 要求或产物 | 表面/状态 | 证据 | 阶段 | 状态 | 下一步 |
|---|---|---|---|---|---|---|
| 部署并完善 | 门户首屏与项目索引 | 桌面浅色 | 1280×720 浏览器截图与 DOM 观察 | Stage 2–3 | pass | 已验证两行标题、双栏首屏和 2 个项目卡片 |
| 部署并完善 | 项目筛选与无结果反馈 | 桌面浅色 | 搜索、Agent 筛选、重置交互 | Stage 4–6 | pass | 0 条空状态和 1 条筛选结果均正确 |
| 部署并完善 | 深色主题 | 桌面深色 | 浏览器截图、主题切换和计算样式 | Stage 6–7 | pass | 主题、按钮标签和页面颜色同步变化 |
| 部署并完善 | 响应式布局 | 1024×768、390×844 | 浏览器截图与页面宽度测量 | Stage 7 | pass | 两个视口均无横向溢出；手机标题使用语义断行 |
| 部署并完善 | 键盘和焦点 | 桌面 | 语义控件和可见焦点观察 | Stage 7 | defer | 焦点轮廓已验证；当前内置浏览器连续 Tab 注入未移动焦点，使用物理键盘或支持原生 Tab 的浏览器时复测完整顺序 |
| 部署并完善 | reduced-motion | 系统偏好 | 样式与浏览器能力检查 | Stage 7–8 | defer | 已实现媒体查询；当前浏览器没有动作偏好模拟能力，在系统开启“减少动态效果”时复测 |
| 部署并完善 | 工程检查 | 静态文件 | JS 语法、差异和本地 HTTP 资源检查 | Stage 9 | pass | `node --check`、`git diff --check` 通过，页面/CSS/JS/SVG 均返回 HTTP 200 |
| 部署并完善 | GitHub Pages | 公网 | HTTP 200、静态资源与浏览器内容 | Stage 9 | pass | Actions 部署成功；公网首屏、CSS、JS、图标和 2 个项目卡片已验证 |
| 关联原库 | 两个项目的上游仓库直接入口 | 桌面与手机项目卡片 | 链接目标、布局与公网浏览器检查 | Stage 3–7 | pass | 桌面三列、390px 手机三行均通过；两个上游地址正确 |

## 局部修正记录：上游仓库入口

```text
Current stage: Stage 3–7
User phase: 关联原库
Coverage item: 项目卡片和根索引的上游仓库入口
User goal: 从门户第一层直接分辨并进入“我们的研究资料”和“原始项目仓库”
Browser environment: GitHub Pages 公网，1280×720，浅色
Observed evidence: ShadowBroker 和 AgentScope 卡片均只有研究档案与报告，共两个入口
Problem category: 信息架构与控制可发现性
Root cause: 首版项目数据没有 upstreamUrl，原库地址只存在于 ShadowBroker 深层 README
Minimal intervention: 为每个项目增加 upstreamUrl，并将卡片操作区从两列扩展为三列
Adjacent regression surfaces: 桌面卡片宽度、390px 手机堆叠、根 README 和 AgentScope README
Observed result: 每张卡片包含研究档案、研究报告和原始仓库三个入口；桌面三列等宽，390px 手机纵向排列，无溢出
Decision: pass
Next executable action: 无
New authority required: 无
```

## 本地浏览器验收

- 验证时间：2026-08-07 15:59:00 +08:00
- 启动方式：在仓库根目录运行静态 HTTP 服务
- 验证地址：`http://127.0.0.1:49317/`
- 桌面：1280×720，浅色与深色首屏通过
- 平板：1024×768，双栏首屏无溢出
- 手机：390×844，单栏导航、项目卡片和筛选区无溢出
- 交互：项目搜索、分类筛选、无结果、重置和主题切换通过
- 运行状态：浏览器控制台无错误或警告

## 公网发布验收

- 公网地址：`https://yydshly.github.io/0807_githubcode_study/`
- 验证时间：2026-08-07 16:03:44 +08:00
- GitHub Actions：`Deploy research portal to GitHub Pages` 运行成功
- HTTP：主页、CSS、JavaScript 和 SVG 图标均返回 200
- 浏览器：标题、首屏、样式、脚本和 2 个项目卡片均已加载

## 后续增加项目

1. 在 `assets/site.js` 的 `projects` 数组增加一条记录。
2. 在根 README 的“当前研究项目”和“在线演示与运行入口”登记。
3. 如果项目有静态演示，给出公开地址；只有本地入口时使用代码文本，不创建误导性公网链接。
4. 推送到 `main` 后复查 Pages 页面和项目链接。

## 扩展契约：Yichen Skills 研究归档

```text
Entry mode: brief-led
Request revision: 3
Target user and context: 总项目维护者与未来需要评估中文内容平台接入的研发人员
Desired first impression: 先看到“按需参考、不整库集成”的判断，再快速比较各平台技术差异
Visual ambition: Editorial
Experience architecture: Editorial Flow
Visual constraints: 延续研究门户的纸张/墨色语义；中文优先；不依赖外部图片或字体；浅色与深色均可读
Information constraints: 必须区分上游公开设计、本次源码审计和真实运行验证；不得伪装成已部署抓取服务
Operation constraints: 平台路线可按匿名、登录态和媒体能力筛选；主题切换和链接支持鼠标与键盘
State constraints: 平台列表包含完整与筛选状态；主题可切换；静态页面无后端加载状态
Environment constraints: GitHub Pages静态托管；无后端、账号、Cookie、Token、付费ASR或实时抓取
Primary journey: 进入专题 → 理解阶段判断 → 查看Skill能力链 → 比较平台获取技术 → 查看处理产物与未来边界
User-defined phases: 总结归档、网页介绍、效果展示、总项目登记、提交
Required artifacts: 子项目README、阶段报告、平台矩阵、能力地图、静态专题页、样式、交互脚本、根门户入口、README登记、浏览器验收、Git提交
Autonomy authorization: 用户明确要求归档到总项目并提交
User-decision boundary: 不安装或执行上游Skill，不使用平台账号和凭据，不推送远端
Observable completion criteria: 档案完整；专题页在桌面/平板/手机无横向溢出；浅色/深色可读；筛选状态正确；根门户出现第四个项目；静态资源和链接有效；工程检查通过并产生提交
```

### 扩展覆盖清单

| 用户阶段 | 要求或产物 | 表面/状态 | 证据 | 阶段 | 状态 | 下一步 |
|---|---|---|---|---|---|---|
| 总结归档 | README、REPORT、平台矩阵、能力地图 | Markdown文件 | 文件、相对链接、结论和边界一致性检查 | Stage 0–3 | pass | 无 |
| 网页介绍 | 专题首屏、能力链、平台矩阵、处理链和边界 | 桌面浅色 | 1280×720截图与DOM阅读顺序观察 | Stage 1–3 | pass | 无 |
| 效果展示 | 平台路线筛选与结果计数 | 桌面浅色 | 全部10、匿名9、登录态4、媒体6 | Stage 4–6 | pass | 无 |
| 效果展示 | 主题切换 | 桌面浅色/深色 | 按钮状态、根主题属性、计算背景色和截图 | Stage 6–7 | pass | 无 |
| 效果展示 | 响应式专题页 | 1280×720、1024×768、390×844 | 截图、页面宽度与溢出测量 | Stage 7 | pass | 三个视口均无横向溢出 |
| 总项目登记 | 根门户第四个项目、无脚本入口和README表格 | 门户默认/筛选 | 4张卡片；“信息获取”筛选显示ShadowBroker与Yichen Skills | Stage 3–6 | pass | 无 |
| 工程交付 | HTML/CSS/JS/Markdown质量与Git提交 | 静态文件 | JS语法、diff、HTTP资源、git状态与提交 | Stage 9 | pass | 提交后记录哈希 |

### Yichen Skills 本地浏览器验收

- 验证时间：2026-08-07 17:40:01 +08:00
- 验证地址：`http://127.0.0.1:49319/yichen-skills.html`
- 桌面：1280×720，浅色和深色专题页可读，10类信息源完整呈现
- 平板：1024×768，双栏平台卡片无横向溢出
- 手机：390×844，首屏、按钮和单栏内容无裁切，页面宽度与视口一致
- 交互：全部、匿名公开、需要登录态、媒体下载四种筛选结果正确；主题状态同步
- 可访问性：原生链接与按钮具备语义，键盘聚焦后焦点轮廓可见，提供跳过导航入口
- 总项目：首页渲染4张项目卡片；“信息获取”筛选准确显示2张卡片
- 运行状态：专题页与根门户的浏览器日志均为空
- 验收边界：仅验证静态研究页面；未登录任何平台、未执行媒体下载或付费ASR

## 扩展契约：QM 组织级 Agent 运行平台研究

```text
Entry mode: brief-led
Request revision: 4
Target user and context: 总项目维护者，以及需要判断 QM 是否适合作为组织级 Agent 基础设施的研发与技术决策人员
Desired first impression: 先明确“权限驱动的隔离与运行环境装配”这一核心，再理解能力、实现链路、适用场景和采用边界
Visual ambition: Editorial
Experience architecture: Editorial Flow
Visual constraints: 延续门户的纸张/墨色研究语言；以架构关系和边界为主，不依赖外部图片或字体；浅色与深色均可读
Information constraints: 必须区分 QM 与多 Agent 编排器；能力说明必须和 Scope、ACL、Harness、Sandbox、Memory、Keychain、Queue 等实现机制对应；不得暗示已部署 QM 后端
Operation constraints: 页面目录和能力映射支持鼠标与键盘；主题切换可用；外部与内部文档链接清晰
State constraints: 浅色/深色状态完整；桌面/平板/手机阅读顺序稳定；静态页面不模拟虚假的后端运行状态
Environment constraints: GitHub Pages 静态托管；不克隆、安装或部署 QM；不使用云账号、模型 Key、Slack、Postgres 或生产凭据
Primary journey: 进入专题 → 识别核心判断 → 理解一次 Turn 的执行链 → 对照能力与实现 → 查看风险和对我们的意义 → 进入详细文档
User-defined phases: 信息整理、Web描述、Markdown文档、根README合并、提交并推送main
Required artifacts: qm-study/README、阶段报告、架构实现文档、采用与风险文档、静态专题页、专题样式与交互、根门户项目入口、根README登记、浏览器验收、Git提交与main推送
Autonomy authorization: 用户明确要求整理、实现、合并到根README并直接提交远端main
User-decision boundary: 不部署QM真实服务，不接入账号或凭据，不创建PR，不改动其他研究专题的结论
Observable completion criteria: 文档结论与代码证据一致；专题页在1280/1024/390宽度无横向溢出；浅色/深色可读；目录交互和主题切换正确；首页出现第七个项目且筛选可发现；静态资源、相对链接和JS语法检查通过；提交成功并推送origin/main
```

### QM 扩展覆盖清单

| 用户阶段 | 要求或产物 | 表面/状态 | 证据 | 阶段 | 状态 | 下一步 |
|---|---|---|---|---|---|---|
| 信息整理 | 核心判断、能力与实现机制、边界和采用建议 | Markdown | README、REPORT与两份专题文档的链接和结论一致 | Stage 0–3 | pass | 保持研究边界说明 |
| Web描述 | 专题首屏、执行链、能力实现映射、风险和意义 | 桌面浅色 | 1280×720截图与DOM阅读顺序观察 | Stage 1–3 | pass | 无 |
| Web描述 | 目录定位、主题切换与链接 | 桌面浅色/深色 | 点击状态、主题属性、焦点和目标区段 | Stage 4–6 | pass | 无 |
| Web描述 | 响应式阅读 | 1280×720、1024×768、390×844 | 截图、scrollWidth与可见内容检查 | Stage 7 | pass | 无 |
| 根README合并 | 第七个项目、协作关系、总体理解和在线入口 | Markdown/门户 | README相对链接、首页7张卡片、Agent筛选显示4张卡片 | Stage 3–6 | pass | 无 |
| 工程交付 | HTML/CSS/JS/Markdown质量 | 静态文件 | JS语法、4个相对资源HTTP 200、diff检查与浏览器空日志 | Stage 9 | pass | 无 |
| 提交并推送main | 本次文件提交并同步origin/main | Git | commit哈希、分支状态与远端同步状态 | Stage 9 | continue | 显式暂存、提交和推送后回填 |

### QM 浏览器验收记录

- 1280×720、1024×768、390×844 三档视口均满足 `scrollWidth = clientWidth`，没有横向溢出。
- 浅色与深色首屏均完成可视检查；手机端标题、摘要、主操作和核心公式保持连续阅读顺序。
- 能力筛选结果：全部 8 项、隔离与授权 3 项、执行与适配 3 项、持久化 3 项；状态文案与卡片数量一致。
- 根门户渲染 7 张项目卡片；“Agent 框架”筛选显示 AgentScope、David Ondrej Skills、Matt Pocock Skills 与 QM 共 4 项。
- 主题按钮、锚点、筛选按钮可聚焦，浏览器运行日志为空。
