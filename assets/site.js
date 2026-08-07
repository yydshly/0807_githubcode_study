(() => {
  const repository = 'https://github.com/yydshly/0807_githubcode_study';
  const projects = [
    {
      number: '01',
      slug: 'shadowbroker-study',
      title: 'ShadowBroker',
      kicker: 'MULTI-SOURCE INTELLIGENCE STUDY',
      category: 'acquisition',
      categoryLabel: '信息获取',
      status: '阶段归档',
      summary:
        '多源公开信息获取与地图展示平台研究。重点不是追求“全球实时全量”，而是理解来源治理、多协议接入、时空模型和可靠性边界。',
      value: '来源注册、许可治理、适配器、缓存、健康度与地图聚合路线',
      deployment: '研究资料已公开；完整地图界面目前仅在本机运行',
      tags: ['REST', 'RSS', 'WebSocket', 'AIS / ADS-B', '时空模型'],
      primaryLabel: '进入研究档案',
      primaryUrl: `${repository}/tree/main/shadowbroker-study`,
      secondaryLabel: '阅读阶段总结',
      secondaryUrl: `${repository}/blob/main/shadowbroker-study/docs/stage-summary.md`,
      upstreamLabel: '原始仓库',
      upstreamUrl: 'https://github.com/BigBodyCobain/Shadowbroker',
    },
    {
      number: '02',
      slug: 'agentscope-study',
      title: 'AgentScope',
      kicker: 'AGENT FRAMEWORK VALIDATION',
      category: 'agent',
      categoryLabel: 'Agent 框架',
      status: '真实链路已通',
      summary:
        'Agent 开发框架验证。已用 MiniMax M3 跑通多轮工具调用、并行取证和结构化输出；框架有效，但业务质量仍需固定案例评测。',
      value: '模型接入、工具调度、记忆接口、工作流和结构化输出基础设施',
      deployment: '公开静态交互演示已接入；真实模型调用保留在本地，密钥不进入 Pages',
      tags: ['MiniMax M3', 'Tool Use', 'Memory', 'Structured Output'],
      primaryLabel: '查看 Web 演示',
      primaryUrl: './agentscope.html',
      secondaryLabel: '进入研究档案',
      secondaryUrl: `${repository}/tree/main/agentscope-study`,
      upstreamLabel: '原始仓库',
      upstreamUrl: 'https://github.com/agentscope-ai/agentscope',
    },
    {
      number: '03',
      slug: 'horizon-study',
      title: 'Horizon',
      kicker: 'AI NEWS EDITORIAL PIPELINE',
      category: 'editorial',
      categoryLabel: 'AI 编辑',
      status: '真实抓取验证',
      summary:
        'AI 新闻雷达与编辑流水线研究。已核对 10 类信息源和 11 条采集路径，并完成 61 条真实抓取、统一建模、URL 去重与浏览器验收。',
      value: '来源适配器、Profile 路由、评分去重、MCP 分阶段接口与静态日报发布',
      deployment: '本地抓取演示已验证；完整 AI 日报需要模型 Key，上游提供公开成品站',
      tags: ['RSS / API / HTML', 'AI Scoring', 'Dedup', 'MCP', 'GitHub Pages'],
      primaryLabel: '查看专题总结',
      primaryUrl: './horizon.html',
      secondaryLabel: '查看来源清单',
      secondaryUrl: `${repository}/blob/main/horizon-study/docs/source-matrix.md`,
      upstreamLabel: '原始仓库',
      upstreamUrl: 'https://github.com/Thysrael/Horizon',
    },
  ];

  const root = document.documentElement;
  const grid = document.querySelector('#projectGrid');
  const search = document.querySelector('#projectSearch');
  const filterGroup = document.querySelector('#projectFilters');
  const resultCount = document.querySelector('#resultCount');
  const emptyState = document.querySelector('#emptyState');
  const resetButton = document.querySelector('#resetFilters');
  const themeToggle = document.querySelector('#themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const projectCount = document.querySelector('#projectCount');
  let activeFilter = 'all';

  const updateThemeControl = () => {
    const dark = root.dataset.theme === 'dark';
    themeToggle.setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeMeta?.setAttribute('content', dark ? '#101311' : '#f4f1e8');
  };

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('study-theme', theme);
    } catch (_) {}
    updateThemeControl();
  };

  const projectCard = (project) => {
    const article = document.createElement('article');
    article.className = 'project-card';
    article.dataset.category = project.category;
    article.dataset.project = project.slug;

    article.innerHTML = `
      <div class="project-card-head">
        <span class="project-number">PROJECT / ${project.number}</span>
        <span class="status-pill">${project.status}</span>
      </div>
      <div class="project-card-body">
        <span class="project-kicker">${project.kicker}</span>
        <h3 class="project-title">${project.title}</h3>
        <p class="project-summary">${project.summary}</p>
        <dl class="project-facts">
          <div class="project-fact"><dt>核心价值</dt><dd>${project.value}</dd></div>
          <div class="project-fact"><dt>部署状态</dt><dd>${project.deployment}</dd></div>
        </dl>
        <div class="tag-list" aria-label="研究标签">
          ${project.tags.map((tag) => `<span>${tag}</span>`).join('')}
        </div>
      </div>
      <div class="project-links">
        <a href="${project.primaryUrl}" target="_blank" rel="noreferrer">${project.primaryLabel}<span aria-hidden="true">↗</span></a>
        <a href="${project.secondaryUrl}" target="_blank" rel="noreferrer">${project.secondaryLabel}<span aria-hidden="true">↗</span></a>
        <a href="${project.upstreamUrl}" target="_blank" rel="noreferrer">${project.upstreamLabel}<span aria-hidden="true">↗</span></a>
      </div>
    `;
    return article;
  };

  const renderProjects = () => {
    const query = search.value.trim().toLocaleLowerCase('zh-CN');
    const visible = projects.filter((project) => {
      const matchesFilter = activeFilter === 'all' || project.category === activeFilter;
      const haystack = [
        project.title,
        project.kicker,
        project.categoryLabel,
        project.summary,
        project.value,
        project.deployment,
        ...project.tags,
      ]
        .join(' ')
        .toLocaleLowerCase('zh-CN');
      return matchesFilter && (!query || haystack.includes(query));
    });

    grid.replaceChildren(...visible.map(projectCard));
    grid.hidden = visible.length === 0;
    emptyState.hidden = visible.length !== 0;
    resultCount.textContent = `显示 ${visible.length} 个项目`;
  };

  themeToggle?.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  search?.addEventListener('input', renderProjects);

  filterGroup?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    activeFilter = button.dataset.filter;
    filterGroup.querySelectorAll('button').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    renderProjects();
  });

  resetButton?.addEventListener('click', () => {
    activeFilter = 'all';
    search.value = '';
    filterGroup.querySelectorAll('button').forEach((item) => {
      item.setAttribute('aria-pressed', String(item.dataset.filter === 'all'));
    });
    renderProjects();
    search.focus();
  });

  projectCount.textContent = String(projects.length).padStart(2, '0');
  updateThemeControl();
  renderProjects();
})();
