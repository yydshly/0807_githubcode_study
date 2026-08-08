const scenarios = {
  appointment: {
    tabId: "tabAppointment",
    label: "AI APPOINTMENT",
    maturity: "已验证组合",
    maturityState: "verified",
    title: "AI 预约与业务接待助手",
    summary: "用户通过语音或文字提出需求，Agent 收集信息、交给审核角色，并在人工批准后完成任务。",
    input: "“帮我预约明天下午三点的产品演示。”",
    labHref: "./#workflow-lab",
    steps: [
      ["接收需求", "语音或文字进入真实 LiveKit 房间。"],
      ["理解与路由", "Agent 识别预约意图并切换到 Intake 角色。"],
      ["调用业务工具", "结构化收集姓名、时间与预约事项。"],
      ["人工审批", "高风险写入停在 Approval Agent，等待人工决策。"],
      ["返回结果", "确认状态、任务卡和审计轨迹同步更新。"],
    ],
    result: {
      title: "预约任务卡",
      detail: "一个对话已转化为可恢复、可审批、可审计的业务任务；当前研究原型使用本地 SQLite 保存状态。",
      facts: [["客户", "张晓"], ["时间", "明天下午三点"], ["状态", "人工已批准"]],
    },
  },
  vision: {
    tabId: "tabVision",
    label: "REMOTE VISUAL ASSISTANCE",
    maturity: "已验证单帧",
    maturityState: "verified",
    title: "远程视觉协助",
    summary: "用户把摄像头或合成视频发布到房间，Agent 按需取得最新一帧，再交给视觉模型描述和校验。",
    input: "“请看看我镜头里的图形和数字是什么。”",
    labHref: "./#visual-lab",
    steps: [
      ["发布视频", "浏览器把摄像头或合成画面发布为真实 Video Track。"],
      ["接收媒体", "Agent 从房间订阅视频轨道并取得最新一帧。"],
      ["创建快照", "仅在用户明确请求时生成单帧证据。"],
      ["视觉理解", "MiniMax 视觉模型识别颜色、形状与数字。"],
      ["返回并停止", "文字与语音给出描述，物理摄像头按策略自动停止。"],
    ],
    result: {
      title: "视觉分析结果",
      detail: "传输层与语义层分别验证：Agent 确实收到视频帧，模型确实理解了这一帧；这不是连续视频推理。",
      facts: [["已验来源", "确定性合成画面"], ["样例帧", "640 × 360"], ["状态", "单帧已描述"]],
    },
  },
  service: {
    tabId: "tabService",
    label: "REALTIME SERVICE DESK",
    maturity: "可扩展方案",
    maturityState: "extendable",
    title: "实时业务客服与人工接管",
    summary: "AI 先在实时房间处理高频问题，调用查询工具；复杂或高风险问题携带上下文交给专家 Agent 或人工坐席。",
    input: "“我的订单为什么还没发货？如果异常请转人工。”",
    labHref: "./#capability-lab",
    steps: [
      ["接入会话", "用户通过网页、App 或未来的 SIP 电话进入房间。"],
      ["理解意图", "Agent 判断问题类型、风险和需要的处理角色。"],
      ["查询业务", "Function Tool 查询订单；真实 CRM / 订单系统尚待接入。"],
      ["角色交接", "复杂问题通过 handoff 保留上下文并转给专家。"],
      ["形成闭环", "回复、工单与服务记录在业务系统中统一沉淀。"],
    ],
    result: {
      title: "客服处理结果",
      detail: "房间、工具和 Agent handoff 已验证；要成为真实客服产品，仍需连接订单系统、人工坐席、身份权限与服务指标。",
      facts: [["实时通道", "LiveKit Room"], ["执行方式", "工具 + handoff"], ["状态", "等待业务系统"]],
    },
  },
};

const elements = {
  themeToggle: document.querySelector("#themeToggle"),
  serviceBadge: document.querySelector("#serviceBadge"),
  serviceDetail: document.querySelector("#serviceDetail"),
  workerProof: document.querySelector("#workerProof"),
  scenarioPanel: document.querySelector("#scenarioPanel"),
  scenarioMaturity: document.querySelector("#scenarioMaturity"),
  scenarioLabel: document.querySelector("#scenarioLabel"),
  scenarioTitle: document.querySelector("#scenarioTitle"),
  scenarioSummary: document.querySelector("#scenarioSummary"),
  scenarioInput: document.querySelector("#scenarioInput"),
  scenarioSteps: document.querySelector("#scenarioSteps"),
  scenarioLabLink: document.querySelector("#scenarioLabLink"),
  resultState: document.querySelector("#resultState"),
  resultTitle: document.querySelector("#resultTitle"),
  resultDetail: document.querySelector("#resultDetail"),
  resultFacts: document.querySelector("#resultFacts"),
  playDemo: document.querySelector("#playDemo"),
  nextDemoStep: document.querySelector("#nextDemoStep"),
  resetDemo: document.querySelector("#resetDemo"),
  tabs: [...document.querySelectorAll('[role="tab"][data-scenario]')],
};

const state = {
  scenario: "appointment",
  currentStep: 0,
  timer: null,
  playing: false,
};

function escapeMarkup(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSteps() {
  const scenario = scenarios[state.scenario];
  elements.scenarioSteps.innerHTML = scenario.steps.map(([title, detail], index) => `
    <li data-step="${index}"${index === 0 ? ' data-state="active"' : ""}>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div><strong>${escapeMarkup(title)}</strong><p>${escapeMarkup(detail)}</p></div>
    </li>
  `).join("");
}

function renderWaitingResult() {
  const scenario = scenarios[state.scenario];
  elements.resultState.textContent = "等待流程";
  elements.resultState.dataset.state = "idle";
  elements.resultTitle.textContent = scenario.result.title;
  elements.resultDetail.textContent = "播放流程后，这里会展示用户真正得到的业务结果，而不是底层模型或 Worker 参数。";
  elements.resultFacts.innerHTML = scenario.result.facts.map(([label], index) => `
    <div><dt>${escapeMarkup(label)}</dt><dd>${index === 2 ? "等待处理" : "—"}</dd></div>
  `).join("");
}

function renderCompletedResult() {
  const scenario = scenarios[state.scenario];
  elements.resultState.textContent = "流程完成";
  elements.resultState.dataset.state = "complete";
  elements.resultTitle.textContent = scenario.result.title;
  elements.resultDetail.textContent = scenario.result.detail;
  elements.resultFacts.innerHTML = scenario.result.facts.map(([label, value]) => `
    <div><dt>${escapeMarkup(label)}</dt><dd>${escapeMarkup(value)}</dd></div>
  `).join("");
}

function updateControls() {
  elements.playDemo.disabled = state.playing;
  elements.playDemo.textContent = state.playing ? "流程播放中…" : "播放完整流程";
  elements.nextDemoStep.disabled = state.playing || state.currentStep >= scenarios[state.scenario].steps.length;
}

function stopPlayback() {
  if (state.timer !== null) window.clearInterval(state.timer);
  state.timer = null;
  state.playing = false;
  updateControls();
}

function resetDemo() {
  stopPlayback();
  state.currentStep = 0;
  renderSteps();
  renderWaitingResult();
  updateControls();
}

function advanceDemo() {
  const items = [...elements.scenarioSteps.children];
  if (state.currentStep >= items.length) {
    stopPlayback();
    return;
  }

  items[state.currentStep].dataset.state = "complete";
  state.currentStep += 1;
  if (state.currentStep < items.length) {
    items[state.currentStep].dataset.state = "active";
    elements.resultState.textContent = `处理中 · ${state.currentStep + 1}/${items.length}`;
    elements.resultState.dataset.state = "running";
  } else {
    renderCompletedResult();
    stopPlayback();
  }
  updateControls();
}

function playDemo() {
  resetDemo();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const count = scenarios[state.scenario].steps.length;
    for (let index = 0; index < count; index += 1) advanceDemo();
    return;
  }

  state.playing = true;
  updateControls();
  advanceDemo();
  state.timer = window.setInterval(advanceDemo, 620);
}

function selectScenario(key, { focus = false } = {}) {
  if (!scenarios[key]) return;
  stopPlayback();
  state.scenario = key;
  const scenario = scenarios[key];

  for (const tab of elements.tabs) {
    const selected = tab.dataset.scenario === key;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }

  elements.scenarioPanel.setAttribute("aria-labelledby", scenario.tabId);
  elements.scenarioMaturity.textContent = scenario.maturity;
  elements.scenarioMaturity.dataset.state = scenario.maturityState;
  elements.scenarioLabel.textContent = scenario.label;
  elements.scenarioTitle.textContent = scenario.title;
  elements.scenarioSummary.textContent = scenario.summary;
  elements.scenarioInput.textContent = scenario.input;
  elements.scenarioLabLink.href = scenario.labHref;
  resetDemo();
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  elements.themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  elements.themeToggle.setAttribute("aria-label", `切换到${nextTheme === "dark" ? "浅色" : "深色"}主题`);
  try {
    localStorage.setItem("livekit-product-theme", nextTheme);
  } catch {
    // The page remains usable when storage is unavailable.
  }
}

function restoreTheme() {
  let stored = "";
  try {
    stored = localStorage.getItem("livekit-product-theme") || "";
  } catch {
    stored = "";
  }
  applyTheme(stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
}

async function checkLocalStack() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const status = await response.json();
    const capacity = status.worker_capacity || {};
    const online = Number(capacity.online_workers) || 0;
    const configured = Number(capacity.configured_workers) || online;
    const jobs = Number(capacity.active_jobs) || 0;

    if (!response.ok || !status.livekit_ready) {
      throw new Error(status.livekit_detail || "LiveKit Server 未就绪");
    }

    elements.serviceBadge.textContent = status.agent_worker_ready ? "本地研究栈在线" : "LiveKit 在线 · Agent 待机";
    elements.serviceBadge.dataset.state = status.agent_worker_ready ? "ready" : "waiting";
    elements.serviceDetail.textContent = `LiveKit Server 在本机运行；${status.agent_mode || "当前"} 模式的 MiMo / MiniMax 请求仍按配置访问云端。`;
    elements.workerProof.textContent = `${online} / ${configured} 在线 · ${jobs} Job`;
  } catch (error) {
    elements.serviceBadge.textContent = "本地研究栈未连接";
    elements.serviceBadge.dataset.state = "offline";
    elements.serviceDetail.textContent = `产品说明仍可浏览；启动本地栈后可核对真实服务状态。${error?.message ? `（${error.message}）` : ""}`;
    elements.workerProof.textContent = "离线预览";
  }
}

for (const tab of elements.tabs) {
  tab.addEventListener("click", () => selectScenario(tab.dataset.scenario));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = elements.tabs.indexOf(tab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? elements.tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + elements.tabs.length) % elements.tabs.length;
    selectScenario(elements.tabs[nextIndex].dataset.scenario, { focus: true });
  });
}

elements.playDemo.addEventListener("click", playDemo);
elements.nextDemoStep.addEventListener("click", advanceDemo);
elements.resetDemo.addEventListener("click", resetDemo);
elements.themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

restoreTheme();
selectScenario("appointment");
void checkLocalStack();
