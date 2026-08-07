(() => {
  const upstream = 'https://github.com/mattpocock/skills/blob/main/skills';

  const stages = [
    {
      id: 'foundation',
      number: '00',
      short: '基础配置',
      title: '让 Agent 先理解项目怎样工作',
      question: 'Issue 在哪里、标签叫什么、领域文档放在哪里、Agent 指令如何按需加载？',
      input: '代码库、远端、已有 Agent 文档',
      output: 'docs/agents 配置、指令入口和项目约定',
      skills: ['setup-matt-pocock-skills', 'writing-for-agents'],
    },
    {
      id: 'alignment',
      number: '01',
      short: '澄清建模',
      title: '把模糊目标变成共享理解',
      question: '真正的问题、边界、术语、异常场景和不可逆决定是什么？',
      input: '想法、已有代码、业务语言',
      output: '设计树、统一术语、必要 ADR',
      skills: ['ask-matt', 'grill-me', 'grilling', 'grill-with-docs', 'domain-modeling', 'wait-what'],
    },
    {
      id: 'discovery',
      number: '02',
      short: '探索决策',
      title: '用事实和原型照亮未知区域',
      question: '哪些事实还不知道，哪些交互或状态模型不能只靠文字判断？',
      input: '待验证假设、外部资料、设计问题',
      output: '引用研究、一次性原型、决策地图',
      skills: ['research', 'prototype', 'wayfinder', 'to-questionnaire'],
    },
    {
      id: 'planning',
      number: '03',
      short: '规格计划',
      title: '把对话变成可测试、可分工的契约',
      question: '怎样描述问题、范围、测试接缝、纵向切片和任务依赖？',
      input: '已达成理解、领域语言、代码现状',
      output: 'Spec、Ticket、blocking edges 和 Issue 状态',
      skills: ['to-spec', 'to-tickets', 'triage'],
    },
    {
      id: 'architecture',
      number: '04',
      short: '架构接口',
      title: '把复杂行为藏在更小、更稳的接口后',
      question: '模块边界在哪里，公共接口和测试接缝是否具有足够杠杆？',
      input: 'Spec、代码结构、领域模型',
      output: '深模块、稳定接口和架构改进候选',
      skills: ['codebase-design', 'improve-codebase-architecture', 'domain-modeling'],
    },
    {
      id: 'implementation',
      number: '05',
      short: '小步实现',
      title: '用短反馈环完成一个纵向切片',
      question: '怎样先获得失败证据，再只写足够通过的实现？',
      input: 'Spec/Ticket、已确认测试接缝、当前代码',
      output: '通过测试的最小行为切片',
      skills: ['implement', 'tdd', 'wizard'],
    },
    {
      id: 'verification',
      number: '06',
      short: '验证诊断',
      title: '分别证明代码正确和方向正确',
      question: 'Bug 根因是什么，变更是否同时符合工程规范和原始需求？',
      input: '失败反馈环、固定比较点、Spec 和 Diff',
      output: '根因、回归测试、Standards/Spec 双轴审查',
      skills: ['diagnosing-bugs', 'code-review', 'tdd'],
    },
    {
      id: 'maintenance',
      number: '07',
      short: '集成交接',
      title: '让成果安全进入下一阶段和下一会话',
      question: '怎样保留双方意图、进度和人工步骤，而不是依赖当前聊天记忆？',
      input: '分支变更、冲突、已有文档、下一目标',
      output: '已解决冲突、交接、问卷、教学状态或人工向导',
      skills: ['resolving-merge-conflicts', 'handoff', 'teach', 'to-questionnaire', 'wizard', 'wait-what'],
    },
  ];

  const skills = [
    {
      name: 'setup-matt-pocock-skills', zh: '项目初始化', invocation: 'user', stages: ['foundation'],
      capability: '配置 Issue Tracker、分诊标签和领域文档布局，让其他工程 Skill 使用同一项目约定。',
      principle: '先探索远端、Agent 文件、领域文档和仓库结构，再由用户确认；写的是可修改配置，不是把项目行为硬编码进 Skill。',
      output: 'docs/agents/*.md 与 AGENTS.md / CLAUDE.md 的 Agent skills 区块',
      url: `${upstream}/engineering/setup-matt-pocock-skills/SKILL.md`,
    },
    {
      name: 'writing-for-agents', zh: 'Agent 文档设计', invocation: 'model', stages: ['foundation', 'alignment', 'planning', 'maintenance'],
      capability: '编写更可靠的 Skill、AGENTS.md、CLAUDE.md 和由指针触发的 Agent 文档。',
      principle: '用 context pointer、信息层级、渐进披露、可检查完成条件、leading words 和持续 pruning 控制上下文负担与执行方差。',
      output: '可路由、可维护、完成条件清晰的 Agent 指令',
      url: `${upstream}/productivity/writing-for-agents/SKILL.md`,
    },
    {
      name: 'ask-matt', zh: '流程路由', invocation: 'user', stages: ['alignment'],
      capability: '根据当前工程处境推荐应该进入哪个用户调用型工作流。',
      principle: '作为薄路由器判断情境并交给专门 Skill，本身不复制目标 Skill 的流程。',
      output: '下一项建议调用的 Skill 与理由',
      url: `${upstream}/engineering/ask-matt/SKILL.md`,
    },
    {
      name: 'grill-me', zh: '通用深度访谈', invocation: 'user', stages: ['alignment'],
      capability: '对非代码计划、设计或决定进行彻底追问。',
      principle: '提供显式用户入口，内部复用 grilling 的设计树和 frontier 机制，直到没有未探索分支。',
      output: '已经澄清的计划、假设与决定',
      url: `${upstream}/productivity/grill-me/SKILL.md`,
    },
    {
      name: 'grilling', zh: '设计树访谈原语', invocation: 'model', stages: ['alignment'],
      capability: '系统遍历一个计划或设计的决策空间。',
      principle: '把决定画成依赖树；每轮只问 prerequisites 已满足的 frontier，并给推荐答案；frontier 为空才结束。',
      output: '完整设计树与共享理解',
      url: `${upstream}/productivity/grilling/SKILL.md`,
    },
    {
      name: 'grill-with-docs', zh: '带文档的需求澄清', invocation: 'user', stages: ['alignment'],
      capability: '深度澄清需求，同时建立领域语言并记录关键决定。',
      principle: '组合 grilling 与 domain-modeling；不是会后补文档，而是在术语和决定形成时立即写回。',
      output: '设计树、CONTEXT.md 与必要 ADR',
      url: `${upstream}/engineering/grill-with-docs/SKILL.md`,
    },
    {
      name: 'domain-modeling', zh: '领域建模', invocation: 'model', stages: ['alignment', 'architecture'],
      capability: '建立精确的统一语言，识别术语冲突并记录值得保留的架构决定。',
      principle: '用具体边界场景压力测试模糊词，并与代码交叉核对；CONTEXT.md 只做词汇表，ADR 只记录难逆转、反直觉且有真实取舍的决定。',
      output: '领域词汇表与少量高价值 ADR',
      url: `${upstream}/engineering/domain-modeling/SKILL.md`,
    },
    {
      name: 'wait-what', zh: '上下文化重述', invocation: 'user', stages: ['alignment', 'maintenance'],
      capability: '当解释没有传达清楚时，用读者缺失的上下文重新讲一遍。',
      principle: '读取项目 CONTEXT.md 的共同词汇，补齐隐含前提，用普通语言重新组织，而不是简单重复原句。',
      output: '面向当前读者的清晰重述',
      url: `${upstream}/productivity/wait-what/SKILL.md`,
    },
    {
      name: 'research', zh: '一手资料研究', invocation: 'model', stages: ['discovery'],
      capability: '调查外部技术事实并把可信结论留在仓库中。',
      principle: '优先高可信 primary sources，保留就近引用；通常在独立后台上下文工作，避免研究噪音污染实现会话。',
      output: '带引用的 Markdown 研究文档',
      url: `${upstream}/engineering/research/SKILL.md`,
    },
    {
      name: 'prototype', zh: '一次性原型', invocation: 'model', stages: ['discovery'],
      capability: '用便宜、可操作的产物回答逻辑/状态或 UI 方向问题。',
      principle: '先区分逻辑原型与 UI 原型；从第一天标记可丢弃，不追求测试和抽象，完整暴露状态；最终只把验证过的决定带回主线。',
      output: '单 HTML 逻辑实验或同一路由的多 UI 方案',
      url: `${upstream}/engineering/prototype/SKILL.md`,
    },
    {
      name: 'wayfinder', zh: '大型工作决策地图', invocation: 'user', stages: ['discovery', 'planning'],
      capability: '规划超过单次 Agent 会话容量的大型、模糊工作。',
      principle: '用 Map Issue、决策 Ticket、阻塞边、frontier 与 fog of war 表达逐步显现的路线；默认每次会话只解决一个决策，不提前把雾区伪装成计划。',
      output: '决策地图、子 Issue、已决结论与待显现区域',
      url: `${upstream}/engineering/wayfinder/SKILL.md`,
    },
    {
      name: 'to-questionnaire', zh: '异步决策问卷', invocation: 'user', stages: ['discovery', 'maintenance'],
      capability: '把只有特定人能回答的决定转换为可异步填写的问卷。',
      principle: '重点澄清发送对象、需要收回的决定和答案格式，不让 Agent 越权替利益相关者回答业务问题。',
      output: '可发送或会议中填写的 Markdown 问卷',
      url: `${upstream}/productivity/to-questionnaire/SKILL.md`,
    },
    {
      name: 'to-spec', zh: '对话转规格', invocation: 'user', stages: ['planning'],
      capability: '把已经讨论清楚的内容转换为可实现、可测试的规格并发布到 Issue Tracker。',
      principle: '不重新访谈；综合现有上下文，优先最高公共测试接缝，明确问题、方案、用户故事、范围、实现和测试决定。',
      output: '带 ready-for-agent 状态的 Spec Issue',
      url: `${upstream}/engineering/to-spec/SKILL.md`,
    },
    {
      name: 'to-tickets', zh: '纵向切片任务图', invocation: 'user', stages: ['planning'],
      capability: '把计划拆成可独立验证、可并行调度的 Ticket。',
      principle: '采用 tracer-bullet 纵向切片，每项显式声明 blocking edges；宽重构使用 expand–migrate–contract，保持迁移过程可集成。',
      output: '一组 Ticket、验收条件与依赖关系',
      url: `${upstream}/engineering/to-tickets/SKILL.md`,
    },
    {
      name: 'triage', zh: 'Issue / PR 分诊', invocation: 'user', stages: ['planning', 'maintenance'],
      capability: '核验、分类和派发 Issue 或外部 PR。',
      principle: '以 needs-triage、needs-info、ready-for-agent、ready-for-human、wontfix 的状态机管理队列；先检查代码、复现声明和既往拒绝，再推荐状态。',
      output: '标签、Agent brief、补充信息请求或关闭记录',
      url: `${upstream}/engineering/triage/SKILL.md`,
    },
    {
      name: 'codebase-design', zh: '深模块设计', invocation: 'model', stages: ['architecture'],
      capability: '为模块边界、接口、适配器和测试接缝提供共同设计语言。',
      principle: '追求用小而稳定的接口隐藏大量复杂行为，以 depth、leverage、locality 和 seam 判断设计是否让变化更局部。',
      output: '模块边界与公共接口设计判断',
      url: `${upstream}/engineering/codebase-design/SKILL.md`,
    },
    {
      name: 'improve-codebase-architecture', zh: '架构机会扫描', invocation: 'user', stages: ['architecture'],
      capability: '调查代码库中值得深化模块或收紧边界的候选区域。',
      principle: '先做全局 survey 并生成可视化报告，再对用户选择的候选进行 grilling；不承诺一次自动解开历史泥团。',
      output: 'HTML 架构调查报告与候选改进方向',
      url: `${upstream}/engineering/improve-codebase-architecture/SKILL.md`,
    },
    {
      name: 'implement', zh: '规格驱动实现', invocation: 'user', stages: ['implementation', 'verification'],
      capability: '根据 Spec 或 Ticket 编排完整实现和验收流程。',
      principle: '在预先同意的接缝上使用 tdd，持续运行类型检查和定向测试，结束时跑全量测试与 code-review；上游默认提交当前分支。',
      output: '实现、测试、审查结果与提交',
      url: `${upstream}/engineering/implement/SKILL.md`,
    },
    {
      name: 'tdd', zh: '测试驱动开发', invocation: 'model', stages: ['implementation', 'verification'],
      capability: '通过行为测试逐个实现功能切片或修复 Bug。',
      principle: '先确认公共测试接缝；严格 red → green；一次一个纵向切片；避免测试内部实现、同义反复断言和横向批量测试。',
      output: '先失败后通过、可跨重构保留的行为测试与最小实现',
      url: `${upstream}/engineering/tdd/SKILL.md`,
    },
    {
      name: 'wizard', zh: '人工步骤向导', invocation: 'model', stages: ['implementation', 'maintenance'],
      capability: '为凭据、第三方控制台、迁移或切换等只能由人完成的任务生成交互向导。',
      principle: '把人工操作编码成可暂停、可确认、可恢复的 Bash 流程，让 Agent 指导真实执行，而不是假装拥有外部权限。',
      output: '面向人的交互式 Bash wizard',
      url: `${upstream}/engineering/wizard/SKILL.md`,
    },
    {
      name: 'diagnosing-bugs', zh: '系统化 Bug 诊断', invocation: 'model', stages: ['verification'],
      capability: '定位困难 Bug 和性能回归的根因。',
      principle: '先建立能稳定在该 Bug 上变红的可信反馈环，再最小化、提出可证伪假设、插桩、修复并补回归测试；每阶段有门禁。',
      output: '根因说明、最小修复与回归测试',
      url: `${upstream}/engineering/diagnosing-bugs/SKILL.md`,
    },
    {
      name: 'code-review', zh: '规范 / 需求双轴审查', invocation: 'model', stages: ['verification'],
      capability: '检查固定比较点之后的变更是否既符合项目规范又实现了原始需求。',
      principle: '使用两个隔离上下文分别检查 Standards 和 Spec，保留两种发现的独立优先级，避免一个维度掩盖另一个。',
      output: 'Standards 与 Spec 两份独立审查及汇总',
      url: `${upstream}/engineering/code-review/SKILL.md`,
    },
    {
      name: 'resolving-merge-conflicts', zh: '按意图解决冲突', invocation: 'model', stages: ['maintenance'],
      capability: '完成进行中的 merge 或 rebase 冲突解决。',
      principle: '逐 hunk 追溯双方意图和一手来源，组合而不是机械择边，并验证解决后的行为；不使用 abort 逃避当前操作。',
      output: '保留双方有效意图的冲突解决与完成的集成操作',
      url: `${upstream}/engineering/resolving-merge-conflicts/SKILL.md`,
    },
    {
      name: 'handoff', zh: '跨会话交接', invocation: 'user', stages: ['maintenance'],
      capability: '把当前对话压缩成下一个 Agent 可以继续执行的交接。',
      principle: '不复制已有 Spec、ADR、Issue、提交或 Diff，而是留下路径指针；写入临时目录、脱敏，并建议下一会话使用的 Skill。',
      output: '脱敏交接文档与下一步 Skill 建议',
      url: `${upstream}/productivity/handoff/SKILL.md`,
    },
    {
      name: 'teach', zh: '有状态教学', invocation: 'user', stages: ['maintenance'],
      capability: '跨多个会话教授一项技能或概念。',
      principle: '把当前目录作为持续教学工作区，保存学习进展、练习和后续课程，使教学不依赖单次对话记忆。',
      output: '可跨会话继续的教学状态与练习',
      url: `${upstream}/productivity/teach/SKILL.md`,
    },
  ];

  const root = document.documentElement;
  const stageRail = document.querySelector('#stageRail');
  const stageDetail = document.querySelector('#stageDetail');
  const stageFilters = document.querySelector('#stageFilters');
  const invocationFilters = document.querySelector('#invocationFilters');
  const search = document.querySelector('#skillSearch');
  const skillList = document.querySelector('#skillList');
  const resultCount = document.querySelector('#resultCount');
  const emptyState = document.querySelector('#emptyState');
  const resetFilters = document.querySelector('#resetFilters');
  const emptyReset = document.querySelector('#emptyReset');
  const themeToggle = document.querySelector('#themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  let selectedStage = 'all';
  let selectedInvocation = 'all';
  let activeStageDetail = stages[0].id;

  const stageMap = Object.fromEntries(stages.map((stage) => [stage.id, stage]));
  const invocationLabels = { user: '用户调用', model: '模型调用' };

  const updateThemeControl = () => {
    const dark = root.dataset.theme === 'dark';
    themeToggle.setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeMeta?.setAttribute('content', dark ? '#0e171c' : '#eef2f4');
  };

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    try { localStorage.setItem('study-theme', theme); } catch (_) {}
    updateThemeControl();
  };

  const renderStageDetail = () => {
    const stage = stageMap[activeStageDetail];
    stageDetail.innerHTML = `
      <div class="stage-number"><strong>${stage.number}</strong><span>STAGE / ${stage.id.toUpperCase()}</span></div>
      <div class="stage-copy">
        <h3>${stage.title}</h3>
        <p>${stage.question}</p>
        <div class="stage-io">
          <div><span>输入</span><strong>${stage.input}</strong></div>
          <div><span>输出</span><strong>${stage.output}</strong></div>
        </div>
      </div>
      <div class="stage-skills">
        <span>RELATED SKILLS / ${stage.skills.length}</span>
        <ul>${stage.skills.map((skill) => `<li>${skill}</li>`).join('')}</ul>
        <button type="button" data-show-stage="${stage.id}">在目录查看本阶段 Skill ↓</button>
      </div>
    `;
  };

  const renderStageRail = () => {
    stageRail.replaceChildren(...stages.map((stage) => {
      const button = document.createElement('button');
      button.className = 'stage-button';
      button.type = 'button';
      button.role = 'tab';
      button.dataset.stageDetail = stage.id;
      button.setAttribute('aria-selected', String(stage.id === activeStageDetail));
      button.innerHTML = `<b>${stage.number}</b><span>${stage.short}</span>`;
      return button;
    }));
    renderStageDetail();
  };

  const countForStage = (id) => id === 'all' ? skills.length : skills.filter((skill) => skill.stages.includes(id)).length;
  const countForInvocation = (id) => id === 'all' ? skills.length : skills.filter((skill) => skill.invocation === id).length;

  const renderFilterControls = () => {
    const stageOptions = [{ id: 'all', short: '全部' }, ...stages];
    stageFilters.innerHTML = stageOptions.map((stage) => `
      <button type="button" data-stage-filter="${stage.id}" aria-pressed="${String(stage.id === selectedStage)}">
        <span>${stage.short}</span><b>${String(countForStage(stage.id)).padStart(2, '0')}</b>
      </button>
    `).join('');

    const invocationOptions = [
      { id: 'all', label: '全部调用方式' },
      { id: 'user', label: '用户调用' },
      { id: 'model', label: '模型调用' },
    ];
    invocationFilters.innerHTML = invocationOptions.map((option) => `
      <button type="button" data-invocation-filter="${option.id}" aria-pressed="${String(option.id === selectedInvocation)}">
        <span>${option.label}</span><b>${String(countForInvocation(option.id)).padStart(2, '0')}</b>
      </button>
    `).join('');
  };

  const skillCard = (skill, index) => {
    const article = document.createElement('article');
    article.className = 'skill-card';
    const stageBadges = skill.stages.map((stage) => `<span class="stage-badge">${stageMap[stage].short}</span>`).join('');
    article.innerHTML = `
      <div class="skill-main">
        <div class="skill-topline">
          <span class="skill-number">SKILL / ${String(index + 1).padStart(2, '0')}</span>
          <span class="invocation-badge invocation-${skill.invocation}">${invocationLabels[skill.invocation]}</span>
          ${stageBadges}
        </div>
        <h3><a href="${skill.url}" target="_blank" rel="noreferrer">${skill.name}</a> <span>· ${skill.zh}</span></h3>
        <p class="skill-capability">${skill.capability}</p>
        <div class="skill-principle"><span>实现原理</span><p>${skill.principle}</p></div>
      </div>
      <div class="skill-output">
        <span>主要产物</span>
        <strong>${skill.output}</strong>
        <small>${skill.invocation === 'user' ? '由用户显式启动，负责选择或编排流程。' : '可由任务匹配自动触发，负责执行可复用纪律。'}</small>
      </div>
    `;
    return article;
  };

  const renderSkills = () => {
    const query = search.value.trim().toLocaleLowerCase('zh-CN');
    const visible = skills.filter((skill) => {
      const stageMatch = selectedStage === 'all' || skill.stages.includes(selectedStage);
      const invocationMatch = selectedInvocation === 'all' || skill.invocation === selectedInvocation;
      const haystack = [
        skill.name, skill.zh, skill.capability, skill.principle, skill.output,
        invocationLabels[skill.invocation], ...skill.stages.map((stage) => stageMap[stage].short),
      ].join(' ').toLocaleLowerCase('zh-CN');
      return stageMatch && invocationMatch && (!query || haystack.includes(query));
    });

    skillList.replaceChildren(...visible.map(skillCard));
    skillList.hidden = visible.length === 0;
    emptyState.hidden = visible.length !== 0;
    resultCount.textContent = `显示 ${visible.length} 个 Skill`;
  };

  const resetAll = () => {
    selectedStage = 'all';
    selectedInvocation = 'all';
    search.value = '';
    renderFilterControls();
    renderSkills();
  };

  themeToggle.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  search.addEventListener('input', renderSkills);

  stageRail.addEventListener('click', (event) => {
    const button = event.target.closest('[data-stage-detail]');
    if (!button) return;
    activeStageDetail = button.dataset.stageDetail;
    renderStageRail();
  });

  stageDetail.addEventListener('click', (event) => {
    const button = event.target.closest('[data-show-stage]');
    if (!button) return;
    selectedStage = button.dataset.showStage;
    renderFilterControls();
    renderSkills();
    document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth' });
  });

  stageFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-stage-filter]');
    if (!button) return;
    selectedStage = button.dataset.stageFilter;
    renderFilterControls();
    renderSkills();
  });

  invocationFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-invocation-filter]');
    if (!button) return;
    selectedInvocation = button.dataset.invocationFilter;
    renderFilterControls();
    renderSkills();
  });

  resetFilters.addEventListener('click', resetAll);
  emptyReset.addEventListener('click', resetAll);

  renderStageRail();
  renderFilterControls();
  setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  renderSkills();
})();
