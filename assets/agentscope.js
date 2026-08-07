(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('#themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
  const traceSteps = Array.from(document.querySelectorAll('.trace-step'));
  const playButton = document.querySelector('#playTrace');
  const resetButton = document.querySelector('#resetTrace');
  const runner = document.querySelector('.runner');
  const runnerStatus = document.querySelector('#runnerStatus');
  const traceOwner = document.querySelector('#traceOwner');
  const traceTitle = document.querySelector('#traceTitle');
  const traceDescription = document.querySelector('#traceDescription');
  const traceCode = document.querySelector('#traceCode code');
  const copyButton = document.querySelector('#copyConfig');
  const configSnippet = document.querySelector('#configSnippet');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let traceTimer;

  const traceData = [
    {
      owner: 'USER / APPLICATION',
      title: '“分析东海近两小时事件是否相关”',
      description: '应用把目标和可用工具说明交给 Agent。此时还没有发生业务查询。',
      code: 'goal: analyze_events\nregion: East China Sea\nwindow: 2h',
    },
    {
      owner: 'MINIMAX M3 / MODEL',
      title: '先查询事件，再决定需要哪些证据',
      description: '模型理解目标并选择 query_events。它只做决策，不直接访问业务数据。',
      code: 'tool_use: query_events\narguments:\n  region: East China Sea\n  hours: 2',
    },
    {
      owner: 'AGENTSCOPE / FRAMEWORK',
      title: '校验参数，调度 Python 工具',
      description: 'Toolkit 把模型的工具请求映射到已注册函数，并保留调用顺序与参数。',
      code: 'toolkit.call(\n  name="query_events",\n  validated_args={...}\n)',
    },
    {
      owner: 'OUR CODE / BUSINESS TOOLS',
      title: '并行取证，并执行确定性时空计算',
      description: '查询和计算由我们编写的工具完成。这里才是 Agent 真正接触业务事实的地方。',
      code: 'get_source_evidence × 3\ncorrelate_events × 2\n→ 44.1 km / 11 min\n→ 149.6 km / 14 min',
    },
    {
      owner: 'AGENTSCOPE / MEMORY & LOOP',
      title: '工具结果回填，模型进入下一轮',
      description: '结果进入当前进程的消息记忆。M3 能看到真实工具返回值，再决定继续调查或结束。',
      code: 'memory: InMemoryMemory\ncontext += tool_results\nnext: MiniMax-M3',
    },
    {
      owner: 'PYDANTIC / STRUCTURED OUTPUT',
      title: '生成可被系统消费的 EventAssessment',
      description: 'AgentScope 临时注册 generate_response，最终对象通过字段和范围校验。',
      code: 'likely_related: true\nconfidence: 0.60\nevidence: 3 items\ncounter_evidence: 1 item\nvalidation: PASS',
    },
  ];

  const updateThemeControl = () => {
    const dark = root.dataset.theme === 'dark';
    themeToggle?.setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    themeToggle?.setAttribute('aria-pressed', String(dark));
    themeMeta?.setAttribute('content', dark ? '#101311' : '#f4f1e8');
  };

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('study-theme', theme);
    } catch (_) {}
    updateThemeControl();
  };

  const activateTab = (nextTab, moveFocus = false) => {
    tabs.forEach((tab) => {
      const selected = tab === nextTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.id !== nextTab.getAttribute('aria-controls');
    });
    if (moveFocus) nextTab.focus();
  };

  const selectTraceStep = (index, completed = false) => {
    const item = traceData[index];
    traceSteps.forEach((step, stepIndex) => {
      step.setAttribute('aria-current', stepIndex === index ? 'step' : 'false');
      step.closest('li').classList.toggle('is-complete', completed ? stepIndex <= index : stepIndex < index);
    });
    traceOwner.textContent = item.owner;
    traceTitle.textContent = item.title;
    traceDescription.textContent = item.description;
    traceCode.textContent = item.code;
    runnerStatus.textContent = index === traceData.length - 1 ? '运行完成 · 输出已校验' : `正在查看步骤 ${index + 1} / ${traceData.length}`;
    runner.dataset.runnerState = index === traceData.length - 1 ? 'complete' : 'running';
  };

  const stopTrace = () => {
    clearInterval(traceTimer);
    traceTimer = undefined;
    playButton.disabled = false;
  };

  const playTrace = () => {
    stopTrace();
    playButton.disabled = true;
    selectTraceStep(0);
    if (reducedMotion.matches) {
      selectTraceStep(traceData.length - 1, true);
      stopTrace();
      return;
    }
    let index = 0;
    traceTimer = setInterval(() => {
      index += 1;
      selectTraceStep(index, index === traceData.length - 1);
      if (index === traceData.length - 1) stopTrace();
    }, 900);
  };

  themeToggle?.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let targetIndex = index;
      if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length;
      if (event.key === 'Home') targetIndex = 0;
      if (event.key === 'End') targetIndex = tabs.length - 1;
      activateTab(tabs[targetIndex], true);
    });
  });

  traceSteps.forEach((step) => {
    step.addEventListener('click', () => {
      stopTrace();
      selectTraceStep(Number(step.dataset.step));
    });
  });

  playButton?.addEventListener('click', playTrace);
  resetButton?.addEventListener('click', () => {
    stopTrace();
    traceSteps.forEach((step) => step.closest('li').classList.remove('is-complete'));
    selectTraceStep(0);
    runner.dataset.runnerState = 'idle';
    runnerStatus.textContent = '等待开始';
  });

  copyButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(configSnippet.textContent.trim());
      copyButton.textContent = '已复制';
    } catch (_) {
      copyButton.textContent = '请手动复制';
    }
    setTimeout(() => {
      copyButton.textContent = '复制模板';
    }, 1600);
  });

  updateThemeControl();
  selectTraceStep(0);
  runner.dataset.runnerState = 'idle';
  runnerStatus.textContent = '等待开始';
})();
