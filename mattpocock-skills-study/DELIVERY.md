# Matt Pocock Skills 专题交付记录

## 设计契约

```text
Entry mode: brief-led
Request revision: 3
Target user and context: 使用 Codex、Claude Code 或其他 Agent 持续开发真实软件项目的中文读者
Desired first impression: 这不是“更多提示词”，而是一套把软件工程纪律交给 Agent 执行的流程积木
Visual ambition: Editorial with functional controls
Experience architecture: Editorial Flow
Visual constraints: 中文优先；编辑式工程手册；清晰、克制；不依赖外部图片或字体；支持浅色与深色
Information constraints: 按开发流程组织；完整覆盖上游 README 当前登记的 25 个 Skill；区分能力、实现原理、调用方式、输入输出与边界；明确区分上游显式引用的工程思想与根据 Skill 机制归纳的设计理念
Operation constraints: 支持流程阶段筛选、调用方式筛选、关键词搜索、主题切换和清空条件；使用语义化原生控件
State constraints: 默认、组合筛选、无结果、浅色、深色；结果计数和流程阶段说明同步
Environment constraints: 纯静态 HTML/CSS/JS；无构建步骤、后端、API Key 或外部运行服务；作为当前研究门户的独立专题页
Primary journey: 进入专题 → 理解底层机制 → 沿开发流程浏览 → 理解软件工程思想谱系 → 查看阶段对应技能 → 搜索单项能力与实现原理 → 与 David Ondrej Skills 对比 → 阅读 Markdown 档案和采用建议
User-defined phases: 按开发流程整理、软件工程设计理念梳理、功能对应、Skill 能力与实现原理说明、与 David Ondrej Skills 对比、网页和 Markdown 双交付
Required artifacts: 综合 Markdown、软件工程思想谱系、双库对比、静态专题页、样式、交互脚本、研究门户和根 README 登记、双向文档关联、浏览器验收记录
Autonomy authorization: 用户明确要求用网页和 Markdown 方式整理此库，允许在当前研究仓库内直接实现
User-decision boundary: 不安装或执行上游技能；不修改外部仓库；不接入账号、Issue Tracker、生产系统或远端发布
Observable completion criteria: 25 个 Skill 均可检索；八个开发阶段与对应输入输出可见；能力和原理字段完整；网页与 Markdown 都说明核心软件工程理念、在库中的转译和对应 Skill，并区分显式出处与分析归纳；网页与 Markdown 都能比较 Matt 和 David 两个库并说明重名冲突；根 README、两个专题 README 和两个专题网页正确互链；桌面与 390px 无横向溢出；浅色与深色可读；静态资源和脚本检查通过
```

## 设计方向

| 决策 | 方向 | 可观察约束 | 验收标准 |
|---|---|---|---|
| 首屏判断 | 先解释“工程工作流层，不是模型能力层” | 判断先于技能清单 | 一屏内理解项目定位与价值 |
| 主阅读路径 | 原理 → 生命周期 → Skill 目录 → 采用建议 → 边界 | 页面章节顺序对应理解顺序 | 不使用筛选也能完整阅读 |
| 流程映射 | 八阶段生命周期，不强迫线性瀑布 | 每阶段显示目标、输入、输出和技能 | 点击阶段可筛选相关 Skill |
| 思想谱系 | 四个思想簇连接软件工程来源、核心命题、仓库转译与 Skill | 显式引用和分析归纳使用不同标签 | 读者能看出 Skill 不是孤立提示词，而是经典工程思想的 Agent 化 |
| 目录表达 | 每项同时显示能力、原理、产物和调用方式 | 不用一句宣传语代替机制 | 25 项均有四类信息 |
| 视觉语言 | 工程蓝图、流程轨道和编辑式长文 | 装饰不压过文字与控件 | 断开外部资源后页面仍完整 |
| 响应式 | 桌面多栏，移动端单栏与横向可滚动流程轨道 | 卡片、筛选器和长技能名不裁切 | 1280px 和 390px 无页面横向溢出 |
| 主题与动效 | 语义变量支持双主题；动效只解释筛选和状态 | 内容不依赖颜色或动画 | 双向主题切换、reduced-motion 样式存在 |

## 覆盖清单

| 用户阶段 | 要求或产物 | 表面 / 状态 | 证据 | 阶段 | 状态 | 下一步 |
|---|---|---|---|---|---|---|
| 按开发流程整理 | 八阶段流程、输入、输出和 Skill 映射 | Markdown / 网页 | 文件核对、8 个 tab 与阶段详情浏览器观察 | Stage 0–3 | pass | 无 |
| 软件工程设计理念 | 理念来源、核心命题、在库中的转译和 Skill 对应 | Markdown / 网页 | 4 个思想簇、14 项理念、5 个上游明确来源、出处标签与浏览器阅读顺序 | Stage 0–3 | pass | 无 |
| 功能对应 | 25 项可搜索目录与组合筛选 | 网页默认/筛选/无结果 | 默认 25；小步实现 3；叠加模型调用 2；搜索 TDD 2；无结果 0；重置 25 | Stage 3–6 | pass | 无 |
| 能力与原理 | 每项能力、机制、产物和调用类型 | Markdown / 网页 | 25 条数据、14 用户调用、11 模型调用，与上游 README 和核心 SKILL.md 核对 | Stage 3 | pass | 无 |
| 网页交付 | 首屏、机制、流程、目录、建议、边界 | 桌面浅色/深色 | 1280×720 截图、主题属性、按钮状态与计算颜色 | Stage 1–7 | pass | 无 |
| 响应式 | 可读布局和无页面级横向溢出 | 1280×720 / 1024×768 / 390×844 | 三档浏览器宽度、页面 scrollWidth、组件边界和手机首屏截图 | Stage 7 | pass | 无 |
| 键盘与焦点 | 语义控件与可见焦点 | 桌面 | Skip link 获得焦点时显示 3px 焦点轮廓；原生 link/button/input 结构通过 | Stage 7 | defer | 当前内置浏览器的连续 Tab 注入未推进焦点；在支持原生 Tab 的浏览器或物理键盘环境复测完整顺序 |
| reduced-motion | 关闭非必要动画 | 系统偏好 | CSS 媒体查询存在，内容不依赖动画 | Stage 7–8 | defer | 当前浏览器没有动作偏好模拟能力；系统开启“减少动态效果”时复测 |
| Markdown 交付 | 综合研究文档 | 文件 | README 与专题页互链，HTTP 200 | Stage 9 | pass | 无 |
| 双库对比 | 定位、调度、依赖、状态、风险、采用和重名冲突 | Markdown / 网页 | 6 维网页对比表、Markdown 详细对比、`handoff` / `teach` 重名告警与浏览器观察 | Stage 3–7 | pass | 无 |
| 双向关联 | 根 README、两个专题 README、两个专题网页互链 | 文件 / 浏览器 | 根 README 选择表；两个专题 README 与两个专题网页双向链接；目标均存在且 HTTP 200 | Stage 3–9 | pass | 无 |
| 门户登记 | 根项目卡片与 README 条目 | 默认/Agent 筛选 | 默认 6 张卡片；Agent 框架筛选显示 AgentScope、David Ondrej、Matt Pocock 三项 | Stage 3–6 | pass | 无 |
| 工程检查 | HTML/CSS/JS/Markdown 质量 | 静态文件 | 两个 JS 语法检查、diff 检查、6 个本地 HTTP 资源和浏览器日志 | Stage 9 | pass | 无 |

## 本地浏览器验收

- 验证日期：2026-08-07（Asia/Shanghai）
- 启动方式：在仓库根目录启动静态 HTTP 服务
- 验证地址：`http://127.0.0.1:49327/mattpocock-skills.html`
- 桌面：1280×720，首屏层级、25 项目录和 8 个流程阶段完整；页面 `scrollWidth` 小于视口宽度
- 思想谱系：4 个思想簇、14 项设计理念和 5 个上游明确来源均可见；显式来源、分析归纳及混合关系分别标记
- 流程：切换到“05 小步实现”后，详情正确显示输入、输出和 `implement`、`tdd`、`wizard`
- 筛选：本阶段显示 3 项；叠加“模型调用”显示 2 项；搜索 `TDD` 显示 `implement` 与 `tdd` 2 项；不存在关键词显示空状态；重置回到 25 项
- 主题：浅色切换深色后主题属性、按钮标签和状态同步，正文背景为 `rgb(14, 23, 28)`、文字为 `rgb(237, 244, 246)`；再切回浅色通过
- 平板：1024×768，首屏转单栏，机制卡片转两列，页面无横向溢出
- 手机：390×844，首屏、摘要卡、思想谱系、筛选面板、Skill 卡片与双库对比均在视口内；对比表转单列并显示库名标签；页面无横向溢出
- 双库对比：网页显示 6 个比较维度与重名冲突；Matt README 给出功能重叠和组合建议；David README 与专题页均能反向进入 Matt 对比区
- 门户：默认 6 张项目卡片；“Agent 框架”筛选正确显示 3 张，其中包含 Matt Pocock Skills
- 运行状态：Matt、David 与门户三个页面的浏览器错误/警告日志均为空；相关 HTML、CSS、JS 和 Markdown 均返回 HTTP 200
- 验收边界：没有安装或执行上游 Skill；连续原生 Tab 与 reduced-motion 偏好需要在具备对应能力的环境复测
