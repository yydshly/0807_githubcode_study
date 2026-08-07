(() => {
  const repository = 'https://github.com/davidondrej/skills/tree/main/skills';
  const categories = {
    orchestration: {
      label: 'Agent 编排',
      path: 'agent-orchestration',
      code: 'ORCHESTRATION',
      summary: '调度、子代理、并行工作树、评审、长期目标与会话交接',
    },
    ops: {
      label: '运维与设置',
      path: 'ops-and-setup',
      code: 'OPS & SETUP',
      summary: '环境、安全、数据库、发布、系统指标与操作引导',
    },
    research: {
      label: '研究与网络',
      path: 'research-and-web',
      code: 'RESEARCH & WEB',
      summary: '浏览器、深度研究、搜索、会议与视频转录、购物研究',
    },
    authoring: {
      label: 'Skill 创作',
      path: 'skill-authoring',
      code: 'SKILL AUTHORING',
      summary: '技能设计、目录上下文、分发与版本保存',
    },
    thinking: {
      label: '思考与文档',
      path: 'thinking-and-docs',
      code: 'THINKING & DOCS',
      summary: '构建前决策、访谈、复盘、教学、知识与想法沉淀',
    },
  };

  const tiers = {
    absorb: { label: '优先吸收', hint: '通用方法，依赖较少' },
    adapt: { label: '改造后用', hint: '需要替换环境或流程假设' },
    conditional: { label: '条件储备', hint: '只在特定服务或平台出现时' },
    avoid: { label: '不原样用', hint: '强耦合、高风险或环境不符' },
  };

  const skills = [
    { name: 'agent-self-scheduling', category: 'orchestration', tier: 'adapt', summary: '用 cron、心跳或代理内置调度器重复运行任务。', deps: ['调度器', '长期运行', '通知'] },
    { name: 'cmux', category: 'orchestration', tier: 'conditional', summary: '控制 cmux 工作区、面板、浏览器和通知。', deps: ['cmux', 'macOS 14+'] },
    { name: 'codex-subagent', category: 'orchestration', tier: 'adapt', summary: '从其他代理启动 Codex CLI 执行独立子任务。', deps: ['Codex CLI', '订阅登录', '进程管理'] },
    { name: 'corral-launch-agents', category: 'orchestration', tier: 'conditional', summary: '在 Corral/Herdr 仓库创建或恢复代理任务。', deps: ['Corral', 'Herdr', 'Python'] },
    { name: 'fable-review', category: 'orchestration', tier: 'conditional', summary: '启动指定 Fable 模型做独立代码评审。', deps: ['特定模型', '子代理'] },
    { name: 'fable-safe-prompt', category: 'orchestration', tier: 'avoid', summary: '为特定 Fable 安全分类器重写双用途提示。', deps: ['特定安全路由', '双用途风险'] },
    { name: 'git-worktree', category: 'orchestration', tier: 'absorb', summary: '用 worktree 隔离多个代理的代码、依赖、数据库和端口。', deps: ['Git', '环境复制', '合并清理'] },
    { name: 'goal-loop', category: 'orchestration', tier: 'absorb', summary: '为长任务定义目标、约束、验证与可检验停止条件。', deps: ['Goal 支持', '可靠测试'] },
    { name: 'gpt-review', category: 'orchestration', tier: 'conditional', summary: '启动指定 GPT 模型做独立高级代码评审。', deps: ['模型别名', '子代理'] },
    { name: 'handoff', category: 'orchestration', tier: 'absorb', summary: '把背景、原因、进度、验证和剩余工作压缩成会话交接。', deps: ['跨会话', '持久记录'] },
    { name: 'herdr', category: 'orchestration', tier: 'conditional', summary: '在 Ghostty 的 Herdr 环境中检查、通信和协调代理。', deps: ['Herdr', 'Ghostty'] },
    { name: 'launch-subagent', category: 'orchestration', tier: 'adapt', summary: '规定子代理启动条件、模型选择与共识原则。', deps: ['代理产品', '模型政策'] },
    { name: 'run-deep-swe', category: 'orchestration', tier: 'conditional', summary: '通过 OpenRouter 运行 DeepSWE 编码代理基准。', deps: ['OpenRouter', '费用', 'mini-swe-agent'] },

    { name: 'anti-sleep', category: 'ops', tier: 'avoid', summary: '用 caffeinate 保持 Mac 在长任务期间唤醒。', deps: ['macOS', '后台进程'] },
    { name: 'create-readonly-db-role', category: 'ops', tier: 'adapt', summary: '创建强化的 Postgres 只读代理角色。', deps: ['Postgres', '管理员权限', '密钥治理'] },
    { name: 'cyber-audit', category: 'ops', tier: 'conditional', summary: '针对 CVE、恶意包或泄露做只读暴露面审计并出报告。', deps: ['Mac 路径', '安全时效', '项目扫描'] },
    { name: 'global-agent-guardrails', category: 'ops', tier: 'adapt', summary: '用共享命令黑名单 Hook 阻止灾难性 Shell 操作。', deps: ['Bash', 'jq', '正则黑名单'] },
    { name: 'google-safe-browsing', category: 'ops', tier: 'adapt', summary: '预防和处理网站被标记为危险或欺骗性页面。', deps: ['域名', '上线流程', '实时政策'] },
    { name: 'macbook-metrics-setup', category: 'ops', tier: 'avoid', summary: '搭建 Swift、launchd 与 SQLite 的长期 Mac 指标采集。', deps: ['macOS', 'Swift', 'launchd'] },
    { name: 'nuke-cursor-app', category: 'ops', tier: 'avoid', summary: '强制退出全部 Cursor 桌面进程以恢复内存泄漏。', deps: ['macOS', '杀进程', '未保存状态'] },
    { name: 'pi-custom-model', category: 'ops', tier: 'conditional', summary: '给 Pi Agent 注册自定义或 OpenRouter 模型变体。', deps: ['Pi Agent', '模型配置'] },
    { name: 'prod-push', category: 'ops', tier: 'avoid', summary: '推送 main 并守护 CI/Vercel 直到生产可验证。', deps: ['作者仓库', 'CI', 'Vercel', '生产权限'] },
    { name: 'read-prod-database', category: 'ops', tier: 'avoid', summary: '用作者的只读角色和统计口径查询生产 Supabase。', deps: ['生产库', 'psql', '作者 ADR'] },
    { name: 'setup-help', category: 'ops', tier: 'absorb', summary: '每次只推进一个设置步骤，同时展示全部剩余步骤。', deps: ['持续反馈', '状态记录'] },

    { name: 'browser-harness', category: 'research', tier: 'adapt', summary: '通过 CDP 连接已运行 Chrome，执行自动化、抓取和测试。', deps: ['Chrome', 'CDP', '浏览器会话'] },
    { name: 'deep-research', category: 'research', tier: 'adapt', summary: '构造研究任务、调用 DeepAPI 并保存带来源报告。', deps: ['DeepAPI Key', '费用', '网络'] },
    { name: 'deepapi', category: 'research', tier: 'conditional', summary: '把搜索、抓取、研究、邮件和图像统一路由到 DeepAPI。', deps: ['DeepAPI Key', '外部数据', '费用'] },
    { name: 'fireflies-transcript', category: 'research', tier: 'conditional', summary: '从 Fireflies GraphQL API 读取会议原始转录。', deps: ['Fireflies', '账号密钥', '会议隐私'] },
    { name: 'online-shopping', category: 'research', tier: 'adapt', summary: '研究价格、商店可信度和购买渠道，但不下单。', deps: ['DeepAPI', '实时价格', '地区差异'] },
    { name: 'pi-web-search', category: 'research', tier: 'conditional', summary: '教 Pi Agent 搜索和读取网页、PDF、视频与 GitHub。', deps: ['Pi Agent', 'pi-web-access'] },
    { name: 'research-prompt', category: 'research', tier: 'absorb', summary: '把问题写成自包含研究任务，包含子问题、来源与输出。', deps: ['无强制服务依赖'] },
    { name: 'youtube-transcript', category: 'research', tier: 'adapt', summary: '获取 YouTube 字幕或转录，DeepAPI 主路径、yt-dlp 回退。', deps: ['DeepAPI 或 yt-dlp', '版权边界'] },

    { name: 'distribute-skill-to-all-agents', category: 'authoring', tier: 'avoid', summary: '把技能同步到 Codex、Claude Code、Pi 和 Hermes 目录。', deps: ['作者目录布局', '符号链接'] },
    { name: 'effective-agent-skills', category: 'authoring', tier: 'absorb', summary: '系统说明技能结构、路由、渐进加载、测试、反模式与安全。', deps: ['客户端差异', '文档时效'] },
    { name: 'folder-specific-claude-and-agents-md', category: 'authoring', tier: 'adapt', summary: '为特定目录创建局部代理上下文文件。', deps: ['CLAUDE.md', 'AGENTS.md', '符号链接'] },
    { name: 'push-skill-to-github', category: 'authoring', tier: 'avoid', summary: '提交并推送作者的私有技能仓库。', deps: ['作者仓库', 'Git 凭据', '全局目录'] },

    { name: 'before-building', category: 'thinking', tier: 'absorb', summary: '构建前立即暴露一到三个会改变结果的重要选择。', deps: ['高影响任务', '问询边界'] },
    { name: 'brain-to-docs', category: 'thinking', tier: 'adapt', summary: '通过问答把愿景、决策和偏好写入 README 与 ADR。', deps: ['多轮访谈', '文档写入', 'ADR 授权'] },
    { name: 'decisions', category: 'thinking', tier: 'absorb', summary: '回顾当前工作中代理不确定的自主选择。', deps: ['手动触发', '置信度复盘'] },
    { name: 'level-up', category: 'thinking', tier: 'adapt', summary: '用自适应问题评估知识并形成学习计划。', deps: ['学习记录', '评分标准'] },
    { name: 'next-decision', category: 'thinking', tier: 'absorb', summary: '每次提出一个最重要未决问题、选项与偏好。', deps: ['开放决策', '用户参与'] },
    { name: 'prompt-me', category: 'thinking', tier: 'absorb', summary: '用针对性问题提取剩余工作、回避项和真实优先级。', deps: ['访谈意愿'] },
    { name: 'read-all-adrs', category: 'thinking', tier: 'conditional', summary: '显式调用时读取项目 docs/adr 中的全部决策记录。', deps: ['ADR 项目', '上下文成本'] },
    { name: 'remind', category: 'thinking', tier: 'conditional', summary: '先给会话 TLDR，再把上一回复改成更短的英语。', deps: ['手动调用', '英语输出'] },
    { name: 'save-idea', category: 'thinking', tier: 'adapt', summary: '把视频、播客或 AI 观察写入作者的内容积压文件。', deps: ['个人目录', '固定栏目'] },
    { name: 'short', category: 'thinking', tier: 'conditional', summary: '压缩当前答案，去掉填充但保留实质。', deps: ['手动调用'] },
    { name: 'teach', category: 'thinking', tier: 'adapt', summary: '在工作区教学，并维护任务、资源、术语和学习记录。', deps: ['固定模板', '工作区写入'] },
  ];

  const root = document.documentElement;
  const themeToggle = document.querySelector('#themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const searchInput = document.querySelector('#skillSearch');
  const categoryFilters = document.querySelector('#categoryFilters');
  const tierFilters = document.querySelector('#tierFilters');
  const skillList = document.querySelector('#skillList');
  const resultCount = document.querySelector('#resultCount');
  const emptyState = document.querySelector('#emptyState');
  const resetFilters = document.querySelector('#resetFilters');
  const emptyReset = document.querySelector('#emptyReset');
  const categorySummary = document.querySelector('#categorySummary');
  let activeCategory = 'all';
  let activeTier = 'all';

  const escapeHtml = (value) =>
    String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    })[character]);

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('study-theme', theme);
    } catch (_) {}
    const dark = theme === 'dark';
    themeToggle?.setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    themeToggle?.setAttribute('aria-pressed', String(dark));
    themeMeta?.setAttribute('content', dark ? '#111714' : '#f2efe7');
  };

  const makeFilterButton = (value, label, count, type) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.value = value;
    button.dataset.filterType = type;
    button.setAttribute('aria-pressed', String(value === 'all'));
    button.innerHTML = `<span>${escapeHtml(label)}</span><b>${count}</b>`;
    return button;
  };

  const renderFilterControls = () => {
    const categoryButtons = [makeFilterButton('all', '全部类型', skills.length, 'category')];
    Object.entries(categories).forEach(([key, category]) => {
      const count = skills.filter((skill) => skill.category === key).length;
      categoryButtons.push(makeFilterButton(key, category.label, count, 'category'));
    });
    categoryFilters.replaceChildren(...categoryButtons);

    const tierButtons = [makeFilterButton('all', '全部建议', skills.length, 'tier')];
    Object.entries(tiers).forEach(([key, tier]) => {
      const count = skills.filter((skill) => skill.tier === key).length;
      tierButtons.push(makeFilterButton(key, tier.label, count, 'tier'));
      const counter = document.querySelector(`#${key}Count`);
      if (counter) counter.textContent = `${count} 项`;
    });
    tierFilters.replaceChildren(...tierButtons);
  };

  const renderCategorySummary = () => {
    const nodes = Object.entries(categories).map(([key, category], index) => {
      const count = skills.filter((skill) => skill.category === key).length;
      const article = document.createElement('article');
      article.dataset.category = key;
      article.innerHTML = `
        <span>${String(index + 1).padStart(2, '0')} / ${escapeHtml(category.code)}</span>
        <div><strong>${escapeHtml(category.label)}</strong><b>${count}</b></div>
        <p>${escapeHtml(category.summary)}</p>
        <button type="button" data-jump-category="${key}">查看 ${count} 项能力 →</button>
      `;
      return article;
    });
    categorySummary.replaceChildren(...nodes);
  };

  const skillRow = (skill) => {
    const article = document.createElement('article');
    article.className = 'skill-row';
    article.dataset.category = skill.category;
    article.dataset.tier = skill.tier;
    const category = categories[skill.category];
    const tier = tiers[skill.tier];
    const href = `${repository}/${category.path}/${skill.name}`;
    article.innerHTML = `
      <div class="skill-main">
        <div class="skill-meta">
          <span>${escapeHtml(category.code)}</span>
          <span class="tier tier-${skill.tier}">${escapeHtml(tier.label)}</span>
        </div>
        <h3><a href="${href}" target="_blank" rel="noreferrer">${escapeHtml(skill.name)} <span aria-hidden="true">↗</span></a></h3>
        <p>${escapeHtml(skill.summary)}</p>
      </div>
      <div class="skill-deps">
        <span>依赖与边界</span>
        <ul>${skill.deps.map((dep) => `<li>${escapeHtml(dep)}</li>`).join('')}</ul>
      </div>
    `;
    return article;
  };

  const syncPressed = (container, activeValue) => {
    container.querySelectorAll('button[data-value]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.value === activeValue));
    });
  };

  const renderSkills = () => {
    const query = searchInput.value.trim().toLocaleLowerCase('zh-CN');
    const visible = skills.filter((skill) => {
      const category = categories[skill.category];
      const tier = tiers[skill.tier];
      const haystack = [skill.name, skill.summary, category.label, category.code, tier.label, tier.hint, ...skill.deps]
        .join(' ')
        .toLocaleLowerCase('zh-CN');
      return (
        (activeCategory === 'all' || skill.category === activeCategory) &&
        (activeTier === 'all' || skill.tier === activeTier) &&
        (!query || haystack.includes(query))
      );
    });

    skillList.replaceChildren(...visible.map(skillRow));
    skillList.hidden = visible.length === 0;
    emptyState.hidden = visible.length !== 0;
    resultCount.textContent = `显示 ${visible.length} 个技能`;
  };

  const clearFilters = ({ focus = true } = {}) => {
    activeCategory = 'all';
    activeTier = 'all';
    searchInput.value = '';
    syncPressed(categoryFilters, activeCategory);
    syncPressed(tierFilters, activeTier);
    renderSkills();
    if (focus) searchInput.focus();
  };

  categoryFilters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    activeCategory = button.dataset.value;
    syncPressed(categoryFilters, activeCategory);
    renderSkills();
  });

  tierFilters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    activeTier = button.dataset.value;
    syncPressed(tierFilters, activeTier);
    renderSkills();
  });

  categorySummary.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-jump-category]');
    if (!button) return;
    activeCategory = button.dataset.jumpCategory;
    syncPressed(categoryFilters, activeCategory);
    renderSkills();
    document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  searchInput.addEventListener('input', renderSkills);
  resetFilters.addEventListener('click', () => clearFilters());
  emptyReset.addEventListener('click', () => clearFilters());
  themeToggle?.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

  document.querySelector('#skillTotal').textContent = String(skills.length);
  renderFilterControls();
  renderCategorySummary();
  setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  renderSkills();
})();
