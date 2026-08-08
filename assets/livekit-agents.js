(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('#themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const tabs = [...document.querySelectorAll('[data-scenario]')];
  const runButton = document.querySelector('#runDemo');
  const resetButton = document.querySelector('#resetDemo');
  const log = document.querySelector('#eventLog');
  const count = document.querySelector('#eventCount');
  const transcript = document.querySelector('#transcript');
  const sessionState = document.querySelector('#sessionState');
  const userState = document.querySelector('#userState');
  const agentState = document.querySelector('#agentState');
  const agentName = document.querySelector('#agentName');
  const userParticipant = document.querySelector('#userParticipant');
  const agentParticipant = document.querySelector('#agentParticipant');
  const heroState = document.querySelector('#heroRoomState');
  const heroAgentState = document.querySelector('#heroAgentState');

  let scenario = 'tool';
  let running = false;
  let runToken = 0;

  const scenarios = {
    tool: {
      title: '工具调用',
      steps: [
        { kind: 'media', label: 'ROOM_CONNECTED', text: '访客与 AI Agent 加入 demo-room', session: '已连接', user: '在线', agent: '监听中' },
        { kind: 'media', label: 'USER_INPUT', text: '“请检查这个房间当前是否正常。”', session: '监听', user: '说话中', agent: '监听中', active: 'user' },
        { kind: 'agent', label: 'AGENT_THINKING', text: '模型选择 get_room_status 工具', session: '思考', user: '等待回答', agent: '思考中', active: 'agent' },
        { kind: 'tool', label: 'FUNCTION_CALL', text: 'get_room_status({ room_name: “demo-room” })', session: '工具调用', user: '等待回答', agent: '执行工具', active: 'agent' },
        { kind: 'tool', label: 'TOOL_OUTPUT', text: '返回参与者、媒体轨道与 Agent 状态', session: '结果回填', user: '等待回答', agent: '组织回答' },
        { kind: 'agent', label: 'AGENT_SPEAKING', text: '“房间已连接，AI 当前处于 listening 状态。”', session: '完成', user: '监听中', agent: '说话中', active: 'agent' },
      ],
    },
    interrupt: {
      title: 'SDK 打断机制（离线回放）',
      steps: [
        { kind: 'media', label: 'OFFLINE_FIXTURE', text: '离线测试夹具模拟实时音频轨道；不是当前 MiMo 真实模式', session: '已连接', user: '在线', agent: '监听中' },
        { kind: 'agent', label: 'AGENT_SPEAKING', text: 'Agent 正在流式播放一段较长回答', session: '说话', user: '监听中', agent: '说话中', active: 'agent' },
        { kind: 'media', label: 'USER_SPEECH_STARTED', text: 'VAD 检测到用户在 Agent 讲话时开始说话', session: '检测打断', user: '插话中', agent: '判断中', active: 'user' },
        { kind: 'agent', label: 'INTERRUPTION', text: 'Agent 立即暂停未播放完的语音', session: '已打断', user: '说话中', agent: '停止输出', active: 'user' },
        { kind: 'agent', label: 'HISTORY_TRUNCATED', text: '对话历史只保留用户实际听到的部分', session: '修正上下文', user: '说话中', agent: '等待轮次' },
        { kind: 'media', label: 'LISTENING', text: '会话重新进入用户轮次', session: '监听', user: '继续说话', agent: '监听中' },
      ],
    },
    handoff: {
      title: 'Agent 交接',
      steps: [
        { kind: 'media', label: 'ROOM_CONNECTED', text: 'Frontdesk Agent 在房间中服务', session: '已连接', user: '在线', agent: '前台模式' },
        { kind: 'media', label: 'USER_INPUT', text: '“我要处理需要专门权限的付款问题。”', session: '监听', user: '说话中', agent: '监听中', active: 'user' },
        { kind: 'agent', label: 'ROUTE_DECISION', text: '当前 Agent 判断需要专门角色与工具权限', session: '路由', user: '等待回答', agent: '选择交接', active: 'agent' },
        { kind: 'tool', label: 'HANDOFF_TOOL', text: '调用 transfer_to_billing()', session: '交接中', user: '等待回答', agent: '移交控制' },
        { kind: 'agent', label: 'AGENT_HANDOFF', text: '活动 Agent 从 Frontdesk 切换为 Billing', session: '已交接', user: '在线', agent: '进入会话', name: 'Billing Agent' },
        { kind: 'agent', label: 'ON_ENTER', text: 'Billing Agent 使用新指令和工具继续对话', session: '完成', user: '监听中', agent: '说话中', active: 'agent', name: 'Billing Agent' },
      ],
    },
  };

  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  const updateTheme = () => {
    const dark = root.dataset.theme === 'dark';
    themeToggle?.setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    themeToggle?.setAttribute('aria-pressed', String(dark));
    themeMeta?.setAttribute('content', dark ? '#0d1210' : '#f1eee5');
  };

  const reset = () => {
    runToken += 1;
    running = false;
    runButton.disabled = false;
    runButton.textContent = '开始回放';
    log.innerHTML = '<li class="placeholder">尚未产生事件</li>';
    count.textContent = `0 / ${scenarios[scenario].steps.length}`;
    transcript.textContent = `${scenarios[scenario].title}场景已就绪，点击“开始回放”。`;
    sessionState.textContent = '待机';
    userState.textContent = '等待连接';
    agentState.textContent = '等待连接';
    agentName.textContent = 'Room Agent';
    userParticipant.classList.remove('active');
    agentParticipant.classList.remove('active');
    heroState.textContent = 'READY';
    heroAgentState.textContent = '等待会话';
  };

  const applyStep = (step, index) => {
    if (index === 0) log.innerHTML = '';
    const item = document.createElement('li');
    item.dataset.kind = step.kind;
    item.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><div><b>${step.label}</b><p>${step.text}</p></div>`;
    log.append(item);
    item.scrollIntoView({ block: 'nearest' });
    count.textContent = `${index + 1} / ${scenarios[scenario].steps.length}`;
    transcript.textContent = step.text;
    sessionState.textContent = step.session;
    userState.textContent = step.user;
    agentState.textContent = step.agent;
    if (step.name) agentName.textContent = step.name;
    userParticipant.classList.toggle('active', step.active === 'user');
    agentParticipant.classList.toggle('active', step.active === 'agent');
    heroState.textContent = index + 1 === scenarios[scenario].steps.length ? 'COMPLETE' : 'LIVE';
    heroAgentState.textContent = step.agent;
  };

  const run = async () => {
    if (running) return;
    running = true;
    runButton.disabled = true;
    runButton.textContent = '回放中…';
    const token = ++runToken;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduceMotion ? 50 : 620;
    log.innerHTML = '';

    for (const [index, step] of scenarios[scenario].steps.entries()) {
      if (token !== runToken) return;
      applyStep(step, index);
      await wait(delay);
    }

    if (token !== runToken) return;
    running = false;
    runButton.disabled = false;
    runButton.textContent = '再次回放';
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      scenario = tab.dataset.scenario;
      tabs.forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
      reset();
    });
  });

  themeToggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('study-theme', next); } catch (_) {}
    updateTheme();
  });

  runButton?.addEventListener('click', run);
  resetButton?.addEventListener('click', reset);
  updateTheme();
  reset();
})();
