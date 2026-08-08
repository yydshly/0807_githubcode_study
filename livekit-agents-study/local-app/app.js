import { ConnectionState, Room, RoomEvent, Track } from "/vendor/livekit-client.esm.mjs";

const elements = {
  themeToggle: document.querySelector("#themeToggle"),
  serverStatus: document.querySelector("#serverStatus"),
  agentStatus: document.querySelector("#agentStatus"),
  latencyStatus: document.querySelector("#latencyStatus"),
  joinForm: document.querySelector("#joinForm"),
  roomName: document.querySelector("#roomName"),
  displayName: document.querySelector("#displayName"),
  identityHint: document.querySelector("#identityHint"),
  connectButton: document.querySelector("#connectButton"),
  micButton: document.querySelector("#micButton"),
  leaveButton: document.querySelector("#leaveButton"),
  connectionBadge: document.querySelector("#connectionBadge"),
  notice: document.querySelector("#notice"),
  participants: document.querySelector("#participants"),
  participantCount: document.querySelector("#participantCount"),
  remoteAudio: document.querySelector("#remoteAudio"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  sendButton: document.querySelector("#sendButton"),
  chatLog: document.querySelector("#chatLog"),
  clearChatButton: document.querySelector("#clearChatButton"),
  eventLog: document.querySelector("#eventLog"),
  copyDiagnosticsButton: document.querySelector("#copyDiagnosticsButton"),
  activeAgentRole: document.querySelector("#activeAgentRole"),
  activeAgentId: document.querySelector("#activeAgentId"),
  capabilityEvidence: document.querySelector("#capabilityEvidence"),
  toolExperimentButton: document.querySelector("#toolExperimentButton"),
  handoffExperimentButton: document.querySelector("#handoffExperimentButton"),
  returnExperimentButton: document.querySelector("#returnExperimentButton"),
  visualLabBadge: document.querySelector("#visualLabBadge"),
  visualTestCanvas: document.querySelector("#visualTestCanvas"),
  visualCameraPreview: document.querySelector("#visualCameraPreview"),
  visualPreviewBadge: document.querySelector("#visualPreviewBadge"),
  visualPreviewHint: document.querySelector("#visualPreviewHint"),
  visualLocalTrack: document.querySelector("#visualLocalTrack"),
  visualAgentFrame: document.querySelector("#visualAgentFrame"),
  visualFrameEvidence: document.querySelector("#visualFrameEvidence"),
  visualModelResult: document.querySelector("#visualModelResult"),
  visualTransportLayer: document.querySelector("#visualTransportLayer"),
  visualSemanticLayer: document.querySelector("#visualSemanticLayer"),
  publishVisualButton: document.querySelector("#publishVisualButton"),
  openCameraButton: document.querySelector("#openCameraButton"),
  analyzeVisualButton: document.querySelector("#analyzeVisualButton"),
  stopVisualButton: document.querySelector("#stopVisualButton"),
  visualEvidence: document.querySelector("#visualEvidence"),
  dispatchModeBadge: document.querySelector("#dispatchModeBadge"),
  dispatchAgentName: document.querySelector("#dispatchAgentName"),
  dispatchRoomName: document.querySelector("#dispatchRoomName"),
  dispatchId: document.querySelector("#dispatchId"),
  dispatchJobId: document.querySelector("#dispatchJobId"),
  dispatchWorkerId: document.querySelector("#dispatchWorkerId"),
  dispatchButton: document.querySelector("#dispatchButton"),
  refreshDispatchButton: document.querySelector("#refreshDispatchButton"),
  retryDispatchButton: document.querySelector("#retryDispatchButton"),
  dispatchEvidence: document.querySelector("#dispatchEvidence"),
  workerAvailabilityBadge: document.querySelector("#workerAvailabilityBadge"),
  workerActiveJobs: document.querySelector("#workerActiveJobs"),
  workerMaxJobs: document.querySelector("#workerMaxJobs"),
  workerLoad: document.querySelector("#workerLoad"),
  workerLoadPolicy: document.querySelector("#workerLoadPolicy"),
  workerCapacityFill: document.querySelector("#workerCapacityFill"),
  capacityEvidence: document.querySelector("#capacityEvidence"),
  resilienceBadge: document.querySelector("#resilienceBadge"),
  restartPolicy: document.querySelector("#restartPolicy"),
  jobExecutor: document.querySelector("#jobExecutor"),
  jobAttemptCount: document.querySelector("#jobAttemptCount"),
  recoveryResult: document.querySelector("#recoveryResult"),
  jobAttemptList: document.querySelector("#jobAttemptList"),
  crashJobButton: document.querySelector("#crashJobButton"),
  recoverJobButton: document.querySelector("#recoverJobButton"),
  resilienceEvidence: document.querySelector("#resilienceEvidence"),
  workerPoolBadge: document.querySelector("#workerPoolBadge"),
  workerOnlineCount: document.querySelector("#workerOnlineCount"),
  workerPoolCapacity: document.querySelector("#workerPoolCapacity"),
  workerAssignment: document.querySelector("#workerAssignment"),
  workerFailoverResult: document.querySelector("#workerFailoverResult"),
  workerPoolList: document.querySelector("#workerPoolList"),
  failAssignedWorkerButton: document.querySelector("#failAssignedWorkerButton"),
  recoverAcrossWorkerButton: document.querySelector("#recoverAcrossWorkerButton"),
  workerPoolEvidence: document.querySelector("#workerPoolEvidence"),
  workflowPhaseBadge: document.querySelector("#workflowPhaseBadge"),
  workflowSteps: document.querySelector("#workflowSteps"),
  workflowDraftSummary: document.querySelector("#workflowDraftSummary"),
  startWorkflowButton: document.querySelector("#startWorkflowButton"),
  resumeWorkflowButton: document.querySelector("#resumeWorkflowButton"),
  submitDraftButton: document.querySelector("#submitDraftButton"),
  requestApprovalButton: document.querySelector("#requestApprovalButton"),
  approveWorkflowButton: document.querySelector("#approveWorkflowButton"),
  rejectWorkflowButton: document.querySelector("#rejectWorkflowButton"),
  pauseWorkflowButton: document.querySelector("#pauseWorkflowButton"),
  staleWriteButton: document.querySelector("#staleWriteButton"),
  expireWorkflowButton: document.querySelector("#expireWorkflowButton"),
  cancelWorkflowButton: document.querySelector("#cancelWorkflowButton"),
  workflowSafety: document.querySelector("#workflowSafety"),
  workflowAuditList: document.querySelector("#workflowAuditList"),
};

const storedOwnerId = sessionStorage.getItem("livekit-research-owner-id");
const ownerSessionId = storedOwnerId || crypto.randomUUID().slice(0, 8);
const roomSessionId = crypto.randomUUID().slice(0, 8);
sessionStorage.setItem("livekit-research-owner-id", ownerSessionId);

const state = {
  room: null,
  connecting: false,
  identity: `visitor-${ownerSessionId}`,
  defaultRoom: `local-demo-${roomSessionId}`,
  agentMode: "local-text",
  conversationMode: "stable-turn",
  minSilenceDuration: 0.8,
  asrOutputMode: "single-response",
  agentPhase: "idle",
  recordingTimeoutId: null,
  activeSpeakerSignature: "",
  activeSpeakerLoggedAt: 0,
  wasReconnecting: false,
  recoveringAgent: false,
  agentWorkerReady: false,
  activeAgentId: "research-guide",
  dispatch: {
    mode: "automatic",
    agentName: "",
    dispatching: false,
    dispatchId: "",
    jobId: "",
    jobStatus: "",
    workerId: "",
    participantIdentity: "",
    restartPolicy: "unknown",
    jobs: [],
    confirmedAgentName: "",
    confirmedJobId: "",
  },
  workerCapacity: {
    ready: false,
    activeJobs: 0,
    maxJobs: 0,
    load: 0,
    availability: "offline",
    policy: "unknown",
    workerId: "",
    jobExecutor: "unknown",
    failureLabEnabled: false,
    configuredWorkers: 0,
    onlineWorkers: 0,
    workers: [],
  },
  failureLab: {
    phase: "idle",
    requestedJobId: "",
    requestedWorkerId: "",
    sawAgentLeave: false,
    sawAgentRejoin: false,
  },
  poolFailure: {
    phase: "idle",
    targetWorkerId: "",
    targetInstanceId: "",
    oldJobId: "",
    replacementWorkerId: "",
    sawAgentLeave: false,
    sawAgentRejoin: false,
  },
  visual: {
    sourceMode: "none",
    starting: false,
    localPublication: null,
    mediaStream: null,
    drawIntervalId: null,
    drawCount: 0,
    transportPhase: "idle",
    transportVerified: false,
    semanticPhase: "idle",
    frameCount: 0,
    frameHash: "",
    width: 0,
    height: 0,
    source: "",
    receivedAt: 0,
    model: "MiniMax-M3",
    answerPreview: "",
  },
  workflow: {
    phase: "idle",
    workflowId: "",
    ownerId: "",
    version: 0,
    expiresAt: 0,
    guard: null,
    audit: [],
    draft: { customer_name: "", appointment_time: "", request: "" },
  },
  events: [],
  messages: new Map(),
  latency: { turnId: null, asr: null, llm: null, tts: null, e2e: null },
  turnObservation: { startedAt: null, elapsed: null, retries: 0, errorStage: null },
};

elements.roomName.value = state.defaultRoom;
elements.identityHint.textContent = `本次身份：${state.identity}`;

function timeLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function logEvent(message, tone = "info") {
  const entry = { time: timeLabel(), message, tone };
  state.events.unshift(entry);
  state.events = state.events.slice(0, 80);
  elements.eventLog.replaceChildren(
    ...state.events.map((item) => {
      const row = document.createElement("li");
      row.dataset.state = item.tone;
      const time = document.createElement("time");
      time.textContent = item.time;
      const text = document.createElement("span");
      text.textContent = item.message;
      row.append(time, text);
      return row;
    }),
  );
}

function setNotice(message, tone = "info") {
  elements.notice.textContent = message;
  elements.notice.dataset.state = tone;
}

function drawVisualTestFrame() {
  const canvas = elements.visualTestCanvas;
  const context = canvas.getContext("2d");
  if (!context) return;
  state.visual.drawCount += 1;
  context.fillStyle = "#111827";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,.08)";
  context.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 40) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 40) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }
  context.fillStyle = "#f97316";
  context.beginPath();
  context.moveTo(170, 64);
  context.lineTo(292, 274);
  context.lineTo(48, 274);
  context.closePath();
  context.fill();
  context.fillStyle = "#f8fafc";
  context.font = "700 34px ui-monospace, monospace";
  context.fillText("LIVEKIT", 342, 116);
  context.font = "800 92px ui-monospace, monospace";
  context.fillText("742", 340, 230);
  context.fillStyle = "#94a3b8";
  context.font = "500 16px ui-monospace, monospace";
  context.fillText("PHASE 11 · SYNTHETIC FRAME", 342, 274);
  context.fillText(`FRAME ${String(state.visual.drawCount).padStart(4, "0")}`, 342, 304);
}

function renderVisualLab() {
  const visual = state.visual;
  const connected = state.room?.state === ConnectionState.Connected;
  const agentConnected = Boolean(connected && roomHasAgent(state.room));
  const publishing = Boolean(visual.localPublication);
  const sourceBusy = publishing || visual.starting;
  const received = visual.transportVerified;
  const semanticBusy = visual.semanticPhase === "analyzing";

  elements.publishVisualButton.disabled = !connected || !agentConnected || sourceBusy;
  elements.openCameraButton.disabled = !connected || !agentConnected || sourceBusy;
  elements.stopVisualButton.disabled = !publishing;
  elements.analyzeVisualButton.disabled =
    !connected || !agentConnected || !received || semanticBusy || isTurnBusy();
  elements.visualLocalTrack.textContent = publishing
    ? visual.sourceMode === "camera" ? "camera · physical" : "camera · synthetic"
    : "未发布";
  const cameraMode = visual.sourceMode === "camera";
  elements.visualTestCanvas.hidden = cameraMode;
  elements.visualCameraPreview.hidden = !cameraMode;
  elements.visualPreviewBadge.dataset.state = cameraMode ? "camera" : "synthetic";
  elements.visualPreviewBadge.textContent = cameraMode ? "摄像头实时预览" : "合成测试画面";
  elements.visualPreviewHint.textContent = cameraMode
    ? "这是物理摄像头的本地实时预览；发布后 Agent 会收到同一视频轨道。"
    : "当前预览是浏览器合成画面，不是物理摄像头。";
  elements.analyzeVisualButton.textContent = cameraMode ? "让 MiniMax 描述这一帧" : "让 MiniMax 看这一帧";
  elements.visualAgentFrame.textContent = received
    ? `${visual.width}×${visual.height} · ${visual.frameCount} 帧${visual.transportPhase === "stopped" ? " · 已停止" : ""}`
    : visual.transportPhase === "stopped"
      ? "轨道已停止"
      : "尚未收到";
  elements.visualFrameEvidence.textContent = visual.frameHash
    ? `${visual.source || "video"} · ${visual.frameHash}`
    : "—";

  const semanticLabels = {
    idle: "尚未请求",
    analyzing: `${visual.model} 正在看`,
    verified: "三项均识别正确",
    described: "已返回画面描述（未自动校验）",
    partial: "有响应，但未通过三项校验",
    rejected: "当前模型接口拒绝图像",
    no_frame: "没有可分析的帧",
  };
  elements.visualModelResult.textContent = semanticLabels[visual.semanticPhase] || visual.semanticPhase;

  if (semanticBusy) {
    elements.visualLabBadge.textContent = "MODEL · 正在验证";
    elements.visualLabBadge.dataset.state = "connecting";
  } else if (visual.semanticPhase === "verified") {
    elements.visualLabBadge.textContent = "VISION · 已验证";
    elements.visualLabBadge.dataset.state = "connected";
  } else if (visual.semanticPhase === "described") {
    elements.visualLabBadge.textContent = "VISION · 已描述";
    elements.visualLabBadge.dataset.state = "connected";
  } else if (received) {
    elements.visualLabBadge.textContent = "VIDEO · 已收帧";
    elements.visualLabBadge.dataset.state = "connected";
  } else {
    elements.visualLabBadge.textContent = visual.starting ? "VIDEO · 正在打开" : publishing ? "VIDEO · 等待 Agent" : "等待视频轨道";
    elements.visualLabBadge.dataset.state = sourceBusy ? "connecting" : "idle";
  }

  elements.visualTransportLayer.dataset.state = received ? "verified" : publishing ? "running" : "idle";
  elements.visualTransportLayer.querySelector("strong").textContent = received
    ? "LiveKit 视频传输已验证"
    : publishing
      ? "视频已发布，等待 Agent 收帧"
      : "等待真实视频";
  elements.visualTransportLayer.querySelector("p").textContent = received
    ? `Agent 回报 ${visual.width}×${visual.height}，帧哈希 ${visual.frameHash}。`
    : "必须由 Agent 回报帧尺寸和哈希才算传输通过。";

  const semanticState = visual.semanticPhase === "verified"
    ? "verified"
    : ["rejected", "no_frame"].includes(visual.semanticPhase)
      ? "error"
      : semanticBusy || ["partial", "described"].includes(visual.semanticPhase)
        ? "running"
        : "idle";
  elements.visualSemanticLayer.dataset.state = semanticState;
  elements.visualSemanticLayer.querySelector("strong").textContent =
    visual.semanticPhase === "verified"
      ? "MiniMax 视觉理解已验证"
      : visual.semanticPhase === "described"
        ? "MiniMax 已返回摄像头画面描述"
      : visual.semanticPhase === "partial"
        ? "模型有响应，证据不足"
        : visual.semanticPhase === "rejected"
          ? "当前接口不接受图像"
          : semanticBusy
            ? "正在验证模型是否看懂"
            : "尚未验证模型";
  elements.visualSemanticLayer.querySelector("p").textContent = visual.answerPreview
    ? `回答：${visual.answerPreview}`
    : cameraMode
      ? "摄像头内容不固定；有回答只证明模型处理了这一帧，不代表描述客观正确。"
      : "模型必须识别橙色、三角形和 742，才标记为看懂。";

  if (received && visual.semanticPhase === "idle") {
    elements.visualEvidence.dataset.state = "verified";
    elements.visualEvidence.textContent = "第一层已通过：Agent 收到了真实视频帧。现在可以单独验证 MiniMax 是否理解内容。";
  } else if (semanticBusy) {
    elements.visualEvidence.dataset.state = "running";
    elements.visualEvidence.textContent = "同一帧已包装为 LiveKit ImageContent，正在等待当前 MiniMax 接口回答。";
  } else if (visual.semanticPhase === "verified") {
    elements.visualEvidence.dataset.state = "verified";
    elements.visualEvidence.textContent = "两层均通过：LiveKit 已传输视频，当前 MiniMax 接口也正确识别了确定性画面。";
  } else if (visual.semanticPhase === "described") {
    elements.visualEvidence.dataset.state = "verified";
    elements.visualEvidence.textContent = "MiniMax 已描述 Agent 收到的摄像头帧，摄像头已自动停止；内容未做客观自动校验。";
  } else if (["partial", "rejected", "no_frame"].includes(visual.semanticPhase)) {
    elements.visualEvidence.dataset.state = "error";
    elements.visualEvidence.textContent = visual.semanticPhase === "rejected"
      ? "视频传输不受影响，但当前 MiniMax 接口拒绝了 ImageContent；这属于模型端边界。"
      : "视频传输已独立验证，但本次模型回答没有满足确定性视觉校验。";
  } else {
    elements.visualEvidence.dataset.state = publishing ? "running" : "idle";
    elements.visualEvidence.textContent = publishing
      ? `${cameraMode ? "真实摄像头" : "合成视频"}已发布，等待 Agent 回传第一帧证据。`
      : "加入房间并调度 Agent 后，选择合成视频或真实摄像头。";
  }
}

function resetVisualResultForPublish(sourceMode) {
  state.visual.sourceMode = sourceMode;
  state.visual.transportPhase = "publishing";
  state.visual.transportVerified = false;
  state.visual.semanticPhase = "idle";
  state.visual.frameCount = 0;
  state.visual.frameHash = "";
  state.visual.width = 0;
  state.visual.height = 0;
  state.visual.answerPreview = "";
}

async function publishVisualTestTrack() {
  if (!state.room || state.room.state !== ConnectionState.Connected || state.visual.localPublication || state.visual.starting) return;
  if (typeof elements.visualTestCanvas.captureStream !== "function") {
    setNotice("当前浏览器不支持从 Canvas 生成视频轨道。", "error");
    return;
  }
  state.visual.starting = true;
  resetVisualResultForPublish("synthetic");
  renderVisualLab();
  try {
    drawVisualTestFrame();
    state.visual.drawIntervalId = window.setInterval(drawVisualTestFrame, 500);
    const mediaStream = elements.visualTestCanvas.captureStream(2);
    const [mediaTrack] = mediaStream.getVideoTracks();
    if (!mediaTrack) throw new Error("没有生成视频轨道");
    const publication = await state.room.localParticipant.publishTrack(mediaTrack, {
      source: Track.Source.Camera,
      name: "phase-11-synthetic-vision",
      simulcast: false,
    });
    state.visual.mediaStream = mediaStream;
    state.visual.localPublication = publication;
    setNotice("合成测试画面已作为真实视频轨道发布；正在等待 Agent 收帧。", "success");
    logEvent("Phase 11：合成视频轨道已发布");
  } catch (error) {
    if (state.visual.drawIntervalId !== null) window.clearInterval(state.visual.drawIntervalId);
    state.visual.drawIntervalId = null;
    state.visual.mediaStream?.getTracks().forEach((track) => track.stop());
    state.visual.mediaStream = null;
    state.visual.sourceMode = "none";
    state.visual.transportPhase = "idle";
    setNotice(`发布测试画面失败：${error.message}`, "error");
    logEvent(`发布测试画面失败：${error.message}`, "error");
  } finally {
    state.visual.starting = false;
    renderVisualLab();
    renderParticipants();
  }
}

async function publishCameraTrack() {
  if (!state.room || state.room.state !== ConnectionState.Connected || state.visual.localPublication || state.visual.starting) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    setNotice("当前浏览器不支持访问摄像头。", "error");
    return;
  }
  let mediaStream = null;
  state.visual.starting = true;
  renderVisualLab();
  try {
    setNotice("请在浏览器权限提示中允许摄像头。", "info");
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 10, max: 15 } },
      audio: false,
    });
    const [mediaTrack] = mediaStream.getVideoTracks();
    if (!mediaTrack) throw new Error("摄像头没有返回视频轨道");
    resetVisualResultForPublish("camera");
    elements.visualCameraPreview.srcObject = mediaStream;
    renderVisualLab();
    await elements.visualCameraPreview.play().catch(() => {});
    const publication = await state.room.localParticipant.publishTrack(mediaTrack, {
      source: Track.Source.Camera,
      name: "phase-11-physical-camera",
      simulcast: false,
    });
    state.visual.mediaStream = mediaStream;
    state.visual.localPublication = publication;
    setNotice("真实摄像头已打开并发布；正在等待 Agent 收帧。", "success");
    logEvent("Phase 11：物理摄像头视频轨道已发布", "success");
  } catch (error) {
    mediaStream?.getTracks().forEach((track) => track.stop());
    elements.visualCameraPreview.srcObject = null;
    state.visual.sourceMode = "none";
    state.visual.transportPhase = "idle";
    const permissionDenied = ["NotAllowedError", "PermissionDeniedError"].includes(error.name);
    setNotice(permissionDenied ? "摄像头权限未允许；你仍可使用合成测试视频。" : `打开摄像头失败：${error.message}`, "error");
    logEvent(`打开摄像头失败：${error.name || "Error"} / ${error.message}`, "error");
  } finally {
    state.visual.starting = false;
    renderVisualLab();
    renderParticipants();
  }
}

async function stopVisualTestTrack() {
  const publication = state.visual.localPublication;
  try {
    if (publication?.track && state.room?.state === ConnectionState.Connected) {
      await state.room.localParticipant.unpublishTrack(publication.track, true);
    }
  } catch (error) {
    logEvent(`停止测试视频失败：${error.message}`, "error");
  } finally {
    state.visual.mediaStream?.getTracks().forEach((track) => track.stop());
    if (state.visual.drawIntervalId !== null) window.clearInterval(state.visual.drawIntervalId);
    state.visual.localPublication = null;
    state.visual.mediaStream = null;
    state.visual.drawIntervalId = null;
    state.visual.sourceMode = "none";
    elements.visualCameraPreview.pause();
    elements.visualCameraPreview.srcObject = null;
    state.visual.transportPhase = "stopped";
    renderVisualLab();
    renderParticipants();
  }
}

async function requestVisualAnalysis() {
  if (
    !state.room ||
    state.room.state !== ConnectionState.Connected ||
    state.visual.transportPhase !== "received" ||
    isTurnBusy()
  ) return;
  state.visual.semanticPhase = "analyzing";
  state.visual.answerPreview = "";
  resetTurnLatency();
  setAgentPhase("thinking");
  renderVisualLab();
  try {
    const cameraMode = state.visual.sourceMode === "camera";
    await state.room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({
        action: "analyze-latest-frame",
        experiment: cameraMode ? "camera" : "deterministic",
      })),
      { reliable: true, topic: "local-agent-visual-lab" },
    );
    appendChat("user", cameraMode
      ? "请描述你当前收到的摄像头画面。"
      : "请观察当前测试画面，说出主要颜色、形状和三位数字。");
    logEvent("Phase 11：已请求分析 Agent 收到的最新视频帧");
  } catch (error) {
    state.visual.semanticPhase = "rejected";
    state.visual.answerPreview = error.message;
    setNotice(`视觉请求发送失败：${error.message}`, "error");
    renderVisualLab();
  }
}

function absorbWorkerCapacity(capacity) {
  if (!capacity) return;
  state.workerCapacity.ready = Boolean(capacity.ready);
  state.workerCapacity.activeJobs = Number(capacity.active_jobs) || 0;
  state.workerCapacity.maxJobs = Number(capacity.max_concurrent_jobs) || 0;
  state.workerCapacity.load = Number(capacity.worker_load) || 0;
  state.workerCapacity.availability = capacity.availability || "offline";
  state.workerCapacity.policy = capacity.load_policy || "unknown";
  state.workerCapacity.workerId = capacity.worker_id || "";
  state.workerCapacity.jobExecutor = capacity.job_executor || "unknown";
  state.workerCapacity.failureLabEnabled = Boolean(capacity.failure_lab_enabled);
  state.workerCapacity.configuredWorkers = Number(capacity.configured_workers) || 0;
  state.workerCapacity.onlineWorkers = Number(capacity.online_workers) || 0;
  state.workerCapacity.workers = Array.isArray(capacity.workers) ? capacity.workers : [];
  renderWorkerCapacity();
  renderResilience();
  renderWorkerPool();
}

function renderWorkerCapacity() {
  const capacity = state.workerCapacity;
  const full = capacity.availability === "full";
  const waiting = Boolean(
    state.dispatch.dispatchId && !state.dispatch.jobId && state.dispatch.mode === "explicit",
  );
  const ratio = capacity.maxJobs
    ? Math.min(capacity.activeJobs / capacity.maxJobs, 1)
    : Math.min(capacity.load, 1);
  elements.workerAvailabilityBadge.textContent = capacity.ready
    ? full
      ? "FULL · 暂停接单"
      : "AVAILABLE · 可接单"
    : "Worker 离线";
  elements.workerAvailabilityBadge.dataset.state = capacity.ready
    ? full
      ? "connecting"
      : "connected"
    : "error";
  elements.workerActiveJobs.textContent = capacity.ready ? String(capacity.activeJobs) : "—";
  elements.workerMaxJobs.textContent = capacity.maxJobs ? String(capacity.maxJobs) : "—";
  elements.workerLoad.textContent = capacity.ready ? `${Math.round(capacity.load * 100)}%` : "—";
  elements.workerLoadPolicy.textContent = capacity.policy === "active-jobs"
    ? "活动 Job 计数"
    : capacity.policy === "active-jobs-pool"
      ? "Worker 池活动 Job"
      : capacity.policy;
  elements.workerCapacityFill.style.width = `${Math.round(ratio * 100)}%`;
  elements.workerCapacityFill.dataset.state = full ? "full" : "available";

  if (!capacity.ready) {
    elements.capacityEvidence.dataset.state = "error";
    elements.capacityEvidence.textContent = "Worker 状态端点尚未就绪。";
  } else if (waiting && full) {
    elements.capacityEvidence.dataset.state = "waiting";
    elements.capacityEvidence.textContent = "当前房间已有 Dispatch，但 Worker 已满：正在等待其他房间释放空位。";
  } else if (waiting) {
    elements.capacityEvidence.dataset.state = "waiting";
    elements.capacityEvidence.textContent = "空位已经可用，但 LiveKit 没有自动重投这个无 Job 的 Dispatch；请重新提交等待任务。";
  } else if (full) {
    elements.capacityEvidence.dataset.state = "waiting";
    elements.capacityEvidence.textContent = `容量已满：${capacity.activeJobs}/${capacity.maxJobs} 个房间 Job 正在运行。`;
  } else {
    const remaining = Math.max(capacity.maxJobs - capacity.activeJobs, 0);
    elements.capacityEvidence.dataset.state = "verified";
    const subject = capacity.configuredWorkers > 1 ? "Worker 池" : "Worker";
    elements.capacityEvidence.textContent = `${subject}可接单：当前 ${capacity.activeJobs}/${capacity.maxJobs}，还可接 ${remaining} 个房间。`;
  }
}

function renderWorkerPool() {
  const capacity = state.workerCapacity;
  const lab = state.poolFailure;
  const agentConnected = Boolean(state.room && roomHasAgent(state.room));
  const currentWorker = capacity.workers.find((worker) => worker.worker_id === state.dispatch.workerId);
  const replacementReady = Boolean(
    lab.targetWorkerId &&
      state.dispatch.workerId &&
      state.dispatch.workerId !== lab.targetWorkerId &&
      state.dispatch.jobStatus === "running" &&
      agentConnected,
  );
  if (["terminating", "waiting", "manual-recovering"].includes(lab.phase) && replacementReady) {
    lab.phase = lab.phase === "manual-recovering" ? "manual-recovered" : "recovered";
    lab.replacementWorkerId = state.dispatch.workerId;
    lab.sawAgentRejoin = true;
  }

  elements.workerPoolBadge.textContent = capacity.configuredWorkers
    ? `POOL · ${capacity.onlineWorkers}/${capacity.configuredWorkers} 在线`
    : "Worker 池离线";
  elements.workerPoolBadge.dataset.state = capacity.onlineWorkers === capacity.configuredWorkers && capacity.onlineWorkers > 0
    ? "connected"
    : capacity.onlineWorkers > 0
      ? "connecting"
      : "error";
  elements.workerOnlineCount.textContent = capacity.configuredWorkers
    ? `${capacity.onlineWorkers} / ${capacity.configuredWorkers}`
    : "—";
  elements.workerPoolCapacity.textContent = capacity.maxJobs
    ? `${capacity.activeJobs} / ${capacity.maxJobs}`
    : "—";
  elements.workerAssignment.textContent = state.dispatch.workerId
    ? `${currentWorker?.instance_id || "实例未知"} · ${state.dispatch.workerId}`
    : "尚未调度";

  const phaseCopy = {
    idle: ["尚未实验", "两名 Worker 在线后，先调度当前房间；页面会标出接单实例。", "idle"],
    terminating: ["正在停止", `正在终止 ${lab.targetInstanceId || lab.targetWorkerId}，只影响它承载的当前 Job。`, "running"],
    waiting: ["等待跨 Worker 恢复", `目标 Worker 已离线${lab.sawAgentLeave ? "，Agent 已离房" : ""}；观察 LiveKit 是否自动改派。`, "running"],
    recovered: ["自动切换成功", `新 Job 已由 ${lab.replacementWorkerId} 接管，Agent 已重新入房。`, "verified"],
    timeout: ["未自动切换", "30 秒内未观察到跨 Worker 自动改派；可显式替换陈旧 Dispatch，让存活 Worker 接手。", "error"],
    "manual-recovering": ["显式恢复中", "正在删除陈旧 Dispatch，并向仍在线的 Worker 池提交新任务。", "running"],
    "manual-recovered": ["显式切换成功", `存活 Worker ${lab.replacementWorkerId} 已接管新 Job。`, "verified"],
    error: ["实验未执行", "Worker 故障请求失败，当前服务未被改变。", "error"],
  }[lab.phase] || ["尚未实验", "等待可观察状态。", "idle"];
  elements.workerFailoverResult.textContent = phaseCopy[0];
  elements.workerPoolEvidence.textContent = phaseCopy[1];
  elements.workerPoolEvidence.dataset.state = phaseCopy[2];

  const cards = capacity.workers.map((worker) => {
    const card = document.createElement("article");
    card.className = "worker-card";
    card.dataset.state = worker.ready ? "online" : "offline";
    card.dataset.assigned = String(Boolean(worker.worker_id && worker.worker_id === state.dispatch.workerId));
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = worker.instance_id || "worker";
    const status = document.createElement("span");
    status.className = "worker-state";
    status.textContent = worker.ready ? "online" : "offline";
    header.append(title, status);
    const identity = document.createElement("small");
    identity.textContent = `Worker ID · ${worker.worker_id || "尚未注册"}`;
    const load = document.createElement("small");
    load.textContent = worker.ready
      ? `Job ${worker.active_jobs || 0}/${worker.max_concurrent_jobs || 0} · Load ${Math.round((worker.worker_load || 0) * 100)}%`
      : `状态端点不可达 · ${worker.status_url || "无地址"}`;
    card.append(header, identity, load);
    return card;
  });
  elements.workerPoolList.replaceChildren(
    ...(cards.length
      ? cards
      : [Object.assign(document.createElement("article"), {
          className: "worker-card",
          textContent: "尚未发现 Worker 实例。",
        })]),
  );
}

function renderResilience() {
  const lab = state.failureLab;
  const jobs = state.dispatch.jobs;
  const agentConnected = Boolean(state.room && roomHasAgent(state.room));
  const oldJob = jobs.find((job) => job.job_id === lab.requestedJobId);
  const replacement = lab.requestedJobId
    ? jobs.find((job) => job.job_id !== lab.requestedJobId && job.status === "running")
    : null;

  if (["requesting", "armed", "recovering"].includes(lab.phase)) {
    if (oldJob?.status === "failed") lab.phase = "recovering";
    if (replacement && agentConnected) {
      lab.phase = "recovered";
      lab.sawAgentRejoin = true;
    }
  }

  elements.restartPolicy.textContent =
    state.dispatch.restartPolicy === "on_failure" ? "ON_FAILURE" : state.dispatch.restartPolicy || "—";
  elements.jobExecutor.textContent =
    state.workerCapacity.jobExecutor === "process" ? "独立进程" : state.workerCapacity.jobExecutor || "—";
  elements.jobAttemptCount.textContent = String(jobs.length);
  elements.jobAttemptList.replaceChildren(
    ...(jobs.length
      ? jobs.map((job, index) => {
          const item = document.createElement("li");
          item.dataset.state = job.status || "unknown";
          const attempt = document.createElement("span");
          attempt.textContent = `尝试 ${index + 1}`;
          const id = document.createElement("strong");
          id.textContent = job.job_id || "unknown";
          const status = document.createElement("span");
          status.textContent = job.status || "unknown";
          item.append(attempt, id, status);
          return item;
        })
      : [Object.assign(document.createElement("li"), { textContent: "调度 Agent 后显示 Job 尝试。" })]),
  );

  const copy = {
    idle: ["等待实验", "研究开关启用后，可验证 failed → replacement 的真实行为。", "idle"],
    requesting: ["请求已发送", `正在终止 Job ${lab.requestedJobId} 的独立子进程。`, "running"],
    armed: ["Job 即将退出", "Agent 已确认故障注入；正在等待 LiveKit 记录失败。", "running"],
    recovering: ["正在恢复", `旧 Job 已失败${lab.sawAgentLeave ? "，Agent 已离房" : ""}；等待替代 Job。`, "running"],
    recovered: ["自动恢复成功", `新 Job ${replacement?.job_id || state.dispatch.jobId} 已运行，Agent 已重新入房。`, "verified"],
    timeout: ["未自动恢复", "30 秒内没有观察到替代 Job 与 Agent 重新入房；Worker 与页面仍可继续诊断。", "error"],
    "manual-recovering": ["手动恢复中", "正在删除陈旧 Dispatch，并创建新的 ON_FAILURE Dispatch。", "running"],
    "manual-recovered": ["手动恢复成功", `新 Job ${state.dispatch.jobId} 已运行，Agent 已重新入房。`, "verified"],
    error: ["实验未执行", "故障请求发送失败，未改变当前 Job。", "error"],
  }[lab.phase] || ["等待实验", "等待可观察状态。", "idle"];
  elements.resilienceBadge.textContent = copy[0];
  elements.resilienceBadge.dataset.state = copy[2] === "verified" ? "connected" : copy[2];
  elements.recoveryResult.textContent = copy[0];
  elements.resilienceEvidence.textContent = copy[1];
  elements.resilienceEvidence.dataset.state = copy[2];
}

async function refreshWorkerCapacity({ quiet = false } = {}) {
  try {
    const response = await fetch("/api/worker", { cache: "no-store" });
    const capacity = await response.json();
    absorbWorkerCapacity(capacity);
    if (!quiet) logEvent(`Worker 容量：${capacity.active_jobs || 0}/${capacity.max_concurrent_jobs || 0} · ${capacity.availability}`);
  } catch (error) {
    state.workerCapacity.ready = false;
    renderWorkerCapacity();
    if (!quiet) logEvent(`Worker 容量读取失败：${error.message}`, "error");
  }
}

function renderDispatch() {
  const dispatch = state.dispatch;
  const connected = state.room?.state === ConnectionState.Connected;
  const explicit = dispatch.mode === "explicit";
  const agentConfirmed = Boolean(
    dispatch.confirmedJobId &&
      dispatch.confirmedJobId === dispatch.jobId &&
      dispatch.confirmedAgentName === dispatch.agentName,
  );
  elements.dispatchModeBadge.textContent = explicit ? "显式调度" : "自动调度";
  elements.dispatchModeBadge.dataset.state = explicit ? "connected" : "idle";
  elements.dispatchAgentName.textContent = dispatch.agentName || "匿名 Worker";
  elements.dispatchRoomName.textContent = connected ? state.room.name : "尚未加入";
  elements.dispatchId.textContent = dispatch.dispatchId || "—";
  elements.dispatchJobId.textContent = dispatch.jobId
    ? `${dispatch.jobId} / ${dispatch.jobStatus || "unknown"}`
    : "—";
  elements.dispatchWorkerId.textContent = dispatch.workerId || "—";

  if (dispatch.dispatching) {
    elements.dispatchEvidence.dataset.state = "running";
    elements.dispatchEvidence.textContent = "正在向 LiveKit 创建或查询 dispatch……";
  } else if (dispatch.jobStatus === "running" && dispatch.workerId && roomHasAgent(state.room)) {
    elements.dispatchEvidence.dataset.state = "verified";
    elements.dispatchEvidence.textContent = agentConfirmed
      ? `已验证：调度 API 与房间内 Agent 回报同一 Job，由 Worker ${dispatch.workerId} 接管。`
      : `已验证：命名 Agent 已由 Worker ${dispatch.workerId} 接管当前房间。`;
  } else if (dispatch.jobStatus === "running" && !roomHasAgent(state.room)) {
    elements.dispatchEvidence.dataset.state = "error";
    elements.dispatchEvidence.textContent = "Dispatch API 仍显示 running，但房间内已没有 Agent；这是一条陈旧状态，不能视为正在服务。";
  } else if (dispatch.dispatchId) {
    elements.dispatchEvidence.dataset.state = "running";
    elements.dispatchEvidence.textContent = `Dispatch 已创建，Job 当前为 ${dispatch.jobStatus || "等待分配"}。`;
  } else if (explicit && connected) {
    elements.dispatchEvidence.dataset.state = "idle";
    elements.dispatchEvidence.textContent = "房间已连接但尚未派 Agent；此时应只有你一名参与者。";
  } else if (explicit) {
    elements.dispatchEvidence.dataset.state = "idle";
    elements.dispatchEvidence.textContent = "先加入房间，再调度命名 Agent。";
  } else {
    elements.dispatchEvidence.dataset.state = "idle";
    elements.dispatchEvidence.textContent = "当前是匿名 Worker 自动调度模式，不需要手动派发。";
  }
  renderWorkerCapacity();
}

function absorbDispatch(dispatch) {
  if (!dispatch) return;
  const job = dispatch.jobs?.at(-1) || null;
  state.dispatch.dispatchId = dispatch.dispatch_id || "";
  state.dispatch.agentName = dispatch.agent_name || state.dispatch.agentName;
  state.dispatch.jobId = job?.job_id || "";
  state.dispatch.jobStatus = job?.status || "";
  state.dispatch.workerId = job?.worker_id || "";
  state.dispatch.participantIdentity = job?.participant_identity || "";
  state.dispatch.restartPolicy = dispatch.restart_policy || "unknown";
  state.dispatch.jobs = Array.isArray(dispatch.jobs) ? dispatch.jobs : [];
  renderDispatch();
  renderResilience();
}

async function observeFailureRecovery() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await refreshDispatchStatus({ quiet: true });
    if (state.failureLab.phase === "recovered") {
      logEvent(`Job 自动恢复：${state.failureLab.requestedJobId} → ${state.dispatch.jobId}`, "success");
      setNotice("Job 子进程失败后已由 restart policy 自动恢复，Worker 主进程保持在线。", "success");
      updateControls();
      return;
    }
  }
  state.failureLab.phase = "timeout";
  renderResilience();
  updateControls();
  logEvent("Job 故障后 30 秒内未观察到自动恢复", "error");
}

async function crashCurrentJob() {
  if (!state.room || state.room.state !== ConnectionState.Connected || !state.dispatch.jobId) return;
  state.failureLab = {
    phase: "requesting",
    requestedJobId: state.dispatch.jobId,
    requestedWorkerId: state.dispatch.workerId,
    sawAgentLeave: false,
    sawAgentRejoin: false,
  };
  renderResilience();
  updateControls();
  try {
    await state.room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ action: "crash-job", job_id: state.dispatch.jobId })),
      { reliable: true, topic: "local-agent-failure-lab" },
    );
    logEvent(`已请求终止 Job 子进程：${state.dispatch.jobId}`);
    void observeFailureRecovery();
  } catch (error) {
    state.failureLab.phase = "error";
    renderResilience();
    updateControls();
    logEvent(`Job 故障实验发送失败：${error.message}`, "error");
  }
}

async function recoverStalledJob() {
  if (!state.room || state.room.state !== ConnectionState.Connected) return;
  state.failureLab.phase = "manual-recovering";
  renderResilience();
  updateControls();
  try {
    const response = await fetch("/api/dispatch/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_name: state.room.name, participant_identity: state.identity }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "无法替换失联 Dispatch");
    absorbDispatch(result.dispatch);
    logEvent(`已替换失联 Dispatch：${result.replaced_dispatch_id} → ${result.dispatch.dispatch_id}`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await refreshDispatchStatus({ quiet: true });
      if (state.dispatch.jobStatus === "running" && roomHasAgent(state.room)) {
        state.failureLab.phase = "manual-recovered";
        renderResilience();
        updateControls();
        logEvent(`手动恢复成功：新 Job ${state.dispatch.jobId}`, "success");
        setNotice("陈旧 Dispatch 已替换，Agent 已重新入房。", "success");
        return;
      }
    }
    throw new Error("新 Dispatch 在 20 秒内未获得运行中 Job");
  } catch (error) {
    state.failureLab.phase = "error";
    renderResilience();
    updateControls();
    logEvent(`手动恢复失败：${error.message}`, "error");
    setNotice(`手动恢复失败：${error.message}`, "error");
  }
}

async function observeWorkerFailover() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await refreshWorkerCapacity({ quiet: true });
    await refreshDispatchStatus({ quiet: true });
    const target = state.workerCapacity.workers.find(
      (worker) => worker.worker_id === state.poolFailure.targetWorkerId,
    );
    if (!target?.ready && state.poolFailure.phase === "terminating") {
      state.poolFailure.phase = "waiting";
      renderWorkerPool();
    }
    if (state.poolFailure.phase === "recovered") {
      logEvent(
        `Worker 自动切换：${state.poolFailure.targetWorkerId} → ${state.poolFailure.replacementWorkerId}`,
        "success",
      );
      setNotice("当前 Worker 离线后，Agent 已由另一名同名 Worker 自动接管。", "success");
      updateControls();
      return;
    }
  }
  state.poolFailure.phase = "timeout";
  renderWorkerPool();
  updateControls();
  logEvent("Worker 离线后 30 秒内未观察到自动跨 Worker 改派", "error");
}

async function failAssignedWorker() {
  if (!state.room || state.room.state !== ConnectionState.Connected || !state.dispatch.workerId) return;
  const target = state.workerCapacity.workers.find(
    (worker) => worker.worker_id === state.dispatch.workerId,
  );
  state.poolFailure = {
    phase: "terminating",
    targetWorkerId: state.dispatch.workerId,
    targetInstanceId: target?.instance_id || "",
    oldJobId: state.dispatch.jobId,
    replacementWorkerId: "",
    sawAgentLeave: false,
    sawAgentRejoin: false,
  };
  renderWorkerPool();
  updateControls();
  try {
    const response = await fetch("/api/worker/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_name: state.room.name,
        worker_id: state.dispatch.workerId,
        job_id: state.dispatch.jobId,
        participant_identity: state.identity,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "无法停止目标 Worker");
    logEvent(`已停止 ${result.instance_id || result.worker_id}：PID ${result.pid}`);
    state.poolFailure.phase = "waiting";
    renderWorkerPool();
    void observeWorkerFailover();
  } catch (error) {
    state.poolFailure.phase = "error";
    renderWorkerPool();
    updateControls();
    logEvent(`Worker 故障实验失败：${error.message}`, "error");
    setNotice(`Worker 故障实验未执行：${error.message}`, "error");
  }
}

async function recoverAcrossWorker() {
  if (!state.room || state.room.state !== ConnectionState.Connected) return;
  state.poolFailure.phase = "manual-recovering";
  renderWorkerPool();
  updateControls();
  try {
    const response = await fetch("/api/dispatch/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_name: state.room.name, participant_identity: state.identity }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "无法创建跨 Worker 恢复任务");
    absorbDispatch(result.dispatch);
    logEvent(`已提交跨 Worker 恢复：${result.replaced_dispatch_id} → ${result.dispatch.dispatch_id}`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await refreshDispatchStatus({ quiet: true });
      await refreshWorkerCapacity({ quiet: true });
      if (state.poolFailure.phase === "manual-recovered") {
        logEvent(`跨 Worker 显式恢复成功：${state.poolFailure.replacementWorkerId}`, "success");
        setNotice("陈旧 Dispatch 已替换，存活 Worker 已接管当前房间。", "success");
        updateControls();
        return;
      }
    }
    throw new Error("新 Dispatch 在 20 秒内未由存活 Worker 接管");
  } catch (error) {
    state.poolFailure.phase = "error";
    renderWorkerPool();
    updateControls();
    logEvent(`跨 Worker 显式恢复失败：${error.message}`, "error");
    setNotice(`跨 Worker 显式恢复失败：${error.message}`, "error");
  }
}

async function refreshDispatchStatus({ quiet = false } = {}) {
  if (!state.room || state.room.state !== ConnectionState.Connected || state.dispatch.mode !== "explicit") return;
  try {
    const response = await fetch(`/api/dispatch?room_name=${encodeURIComponent(state.room.name)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "无法读取调度状态");
    const dispatch = result.dispatches
      ?.filter((item) => item.agent_name === state.dispatch.agentName && !item.deleted_at)
      .at(-1);
    if (dispatch) absorbDispatch(dispatch);
    await refreshWorkerCapacity({ quiet: true });
    if (!quiet) logEvent(dispatch ? `已刷新调度：${dispatch.dispatch_id}` : "当前房间尚无命名 Agent 调度");
  } catch (error) {
    elements.dispatchEvidence.dataset.state = "error";
    elements.dispatchEvidence.textContent = `调度状态读取失败：${error.message}`;
    if (!quiet) logEvent(`调度状态读取失败：${error.message}`, "error");
  } finally {
    updateControls();
  }
}

async function requestExplicitDispatch() {
  if (!state.room || state.room.state !== ConnectionState.Connected || state.dispatch.mode !== "explicit") return;
  state.dispatch.dispatching = true;
  renderDispatch();
  updateControls();
  try {
    const response = await fetch("/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_name: state.room.name, participant_identity: state.identity }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "无法创建 Agent 调度");
    absorbDispatch(result.dispatch);
    logEvent(`${result.created ? "已创建" : "已复用"} Dispatch：${result.dispatch.dispatch_id}`, "success");
    setNotice(result.created ? "命名 Agent 已派发，正在等待 Worker 接管。" : "已复用当前房间的命名 Agent 调度。", "success");
    for (let attempt = 0; attempt < 10 && state.dispatch.jobStatus !== "running"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await refreshDispatchStatus({ quiet: true });
    }
  } catch (error) {
    elements.dispatchEvidence.dataset.state = "error";
    elements.dispatchEvidence.textContent = `调度失败：${error.message}`;
    logEvent(`调度失败：${error.message}`, "error");
    setNotice(`调度失败：${error.message}`, "error");
  } finally {
    state.dispatch.dispatching = false;
    renderDispatch();
    updateControls();
  }
}

async function retryWaitingDispatch() {
  if (!state.room || state.room.state !== ConnectionState.Connected || !state.dispatch.dispatchId) return;
  state.dispatch.dispatching = true;
  renderDispatch();
  updateControls();
  try {
    const response = await fetch("/api/dispatch/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_name: state.room.name, participant_identity: state.identity }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "无法重新提交等待任务");
    absorbDispatch(result.dispatch);
    logEvent(`已重投 Dispatch：${result.replaced_dispatch_id} → ${result.dispatch.dispatch_id}`, "success");
    setNotice("旧等待 Dispatch 已删除，新 Dispatch 正在请求可用 Worker。", "success");
    for (let attempt = 0; attempt < 15 && state.dispatch.jobStatus !== "running"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await refreshDispatchStatus({ quiet: true });
    }
  } catch (error) {
    elements.dispatchEvidence.dataset.state = "error";
    elements.dispatchEvidence.textContent = `重投失败：${error.message}`;
    logEvent(`重投失败：${error.message}`, "error");
    setNotice(`重投失败：${error.message}`, "error");
  } finally {
    state.dispatch.dispatching = false;
    renderDispatch();
    updateControls();
  }
}

function agentRoleLabel(agentId) {
  const labels = {
    "workflow-specialist": "工作流专家",
    "appointment-intake": "预约信息收集",
    "appointment-review": "预约审核",
    "appointment-approval": "人工审批门",
    "research-guide": "研究向导",
  };
  return labels[agentId] || agentId;
}

function renderAgentRole() {
  elements.activeAgentRole.textContent = agentRoleLabel(state.activeAgentId);
  elements.activeAgentId.textContent = state.activeAgentId;
  elements.returnExperimentButton.hidden = state.activeAgentId !== "workflow-specialist";
  renderWorkflow();
}

function renderWorkflowAudit() {
  const actionLabels = {
    workflow_created: "创建任务",
    draft_submitted: "提交草稿",
    workflow_paused: "暂停任务",
    workflow_resumed: "恢复任务",
    approval_requested: "请求人工审批",
    approval_approved: "人工批准",
    approval_rejected: "人工拒绝",
    workflow_cancelled: "取消任务",
    workflow_expired: "任务过期",
    workflow_confirmed_legacy: "旧版直接确认",
  };
  if (!state.workflow.audit.length) {
    elements.workflowAuditList.innerHTML = '<li class="audit-empty">创建任务后显示审计事件。</li>';
    return;
  }
  elements.workflowAuditList.replaceChildren(
    ...state.workflow.audit.map((event) => {
      const item = document.createElement("li");
      const heading = document.createElement("div");
      const action = document.createElement("strong");
      action.textContent = actionLabels[event.action] || event.action;
      const version = document.createElement("span");
      version.textContent = `#${event.event_id} · v${event.version}`;
      heading.append(action, version);
      const detail = document.createElement("p");
      const at = Number.isFinite(event.created_at)
        ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(event.created_at * 1000))
        : "—";
      detail.textContent = `${event.actor_id} · ${event.from_status} → ${event.to_status} · ${at}${event.detail ? ` · ${event.detail}` : ""}`;
      item.append(heading, detail);
      return item;
    }),
  );
}

function renderWorkflow() {
  const phases = ["collecting", "review", "pending_approval", "confirmed", "completed"];
  const visiblePhase = state.workflow.phase === "paused"
    ? "review"
    : state.workflow.phase === "rejected"
      ? "confirmed"
      : state.workflow.phase;
  const currentIndex = phases.indexOf(visiblePhase);
  elements.workflowSteps.querySelectorAll("li").forEach((step, index) => {
    step.dataset.state = currentIndex < 0 ? "idle" : index < currentIndex ? "done" : index === currentIndex ? "active" : "idle";
  });
  if (state.workflow.phase === "confirmed" && state.activeAgentId === "research-guide") {
    elements.workflowSteps.querySelector('[data-step="confirmed"]').dataset.state = "done";
    elements.workflowSteps.querySelector('[data-step="completed"]').dataset.state = "done";
  }
  if (state.workflow.phase === "rejected" && state.activeAgentId === "research-guide") {
    elements.workflowSteps.querySelector('[data-step="completed"]').dataset.state = "done";
  }
  const phaseLabels = {
    idle: ["尚未开始", "idle"],
    collecting: ["正在收集", "connecting"],
    review: ["等待提交审批", "connecting"],
    pending_approval: ["等待人工决策", "connecting"],
    paused: ["已暂停，可恢复", "idle"],
    confirmed: ["SQLite 已确认", "connected"],
    cancelled: ["任务已取消", "error"],
    rejected: ["人工已拒绝", "error"],
    expired: ["任务已过期", "error"],
  };
  const [label, badgeState] = phaseLabels[state.workflow.phase] || phaseLabels.idle;
  elements.workflowPhaseBadge.textContent = label;
  elements.workflowPhaseBadge.dataset.state = badgeState;
  const draft = state.workflow.draft;
  const hasDraft = draft.customer_name || draft.appointment_time || draft.request;
  const workflowLabel = state.workflow.workflowId ? `${state.workflow.workflowId} · ` : "";
  elements.workflowDraftSummary.querySelector("strong").textContent = hasDraft
    ? `${workflowLabel}${draft.customer_name || "未填写姓名"} · ${draft.appointment_time || "未填写时间"}`
    : state.workflow.workflowId ? `${state.workflow.workflowId} · 等待填写` : "当前草稿为空";
  elements.workflowDraftSummary.querySelector("p").textContent = hasDraft
    ? `需求：${draft.request || "未填写"}。本机 SQLite 记录，不代表生产预约。`
    : "记录按本页参与者 identity 隔离；关闭标签页后需保留同一身份才能恢复。";
  const safetyStrong = elements.workflowSafety.querySelector("strong");
  const safetyDetail = elements.workflowSafety.querySelector("p");
  if (state.workflow.guard?.code === "stale_version") {
    elements.workflowSafety.dataset.state = "verified";
    safetyStrong.textContent = "陈旧版本写入已拒绝";
    safetyDetail.textContent = `提交版本 ${state.workflow.guard.expectedVersion}，当前版本 ${state.workflow.guard.currentVersion}；任务内容未被覆盖。`;
  } else if (state.workflow.ownerId) {
    elements.workflowSafety.dataset.state = ["expired", "cancelled", "rejected"].includes(state.workflow.phase) ? "error" : "verified";
    safetyStrong.textContent = `所有者：${state.workflow.ownerId}`;
    const expiresLabel = Number.isFinite(state.workflow.expiresAt) && state.workflow.expiresAt > 0
      ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(state.workflow.expiresAt * 1000))
      : "—";
    safetyDetail.textContent = `乐观版本 v${state.workflow.version || 0} · 有效至 ${expiresLabel} · 仅恢复该 identity 的任务。`;
  } else {
    elements.workflowSafety.dataset.state = "idle";
    safetyStrong.textContent = "等待安全实验";
    safetyDetail.textContent = "创建任务后会显示所有者、有效期与乐观并发版本。";
  }
  const inGuide = state.activeAgentId === "research-guide";
  const inIntake = state.activeAgentId === "appointment-intake";
  const inReview = state.activeAgentId === "appointment-review";
  const inApproval = state.activeAgentId === "appointment-approval";
  elements.startWorkflowButton.hidden = !inGuide;
  elements.resumeWorkflowButton.hidden = !inGuide;
  elements.submitDraftButton.hidden = !inIntake;
  elements.requestApprovalButton.hidden = !inReview;
  elements.approveWorkflowButton.hidden = !inApproval;
  elements.rejectWorkflowButton.hidden = !inApproval;
  elements.pauseWorkflowButton.hidden = !inReview;
  elements.staleWriteButton.hidden = !inReview;
  elements.expireWorkflowButton.hidden = !(inIntake || inReview);
  elements.cancelWorkflowButton.hidden = !(inIntake || inReview);
  renderWorkflowAudit();
}

function setCapabilityEvidence(title, detail, status = "idle") {
  elements.capabilityEvidence.dataset.state = status;
  elements.capabilityEvidence.querySelector("span").textContent = status === "verified" ? "●" : status === "running" ? "◐" : "○";
  elements.capabilityEvidence.querySelector("strong").textContent = title;
  elements.capabilityEvidence.querySelector("p").textContent = detail;
}

function setConnectionState(label, status) {
  elements.connectionBadge.textContent = label;
  elements.connectionBadge.dataset.state = status;
}

function secondsLabel(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}s` : "—";
}

function renderLatency() {
  const strong = elements.latencyStatus.querySelector("strong");
  const detail = elements.latencyStatus.querySelector("p");
  const hasMetrics = [state.latency.asr, state.latency.llm, state.latency.tts].some(Number.isFinite);
  const roundDuration = state.turnObservation.elapsed;
  const errorStageLabels = { asr: "ASR", llm: "M3", tts: "TTS", transport: "发送" };
  const resultLabel = state.turnObservation.retries
    ? `本轮完成 · 重试 ${state.turnObservation.retries} 次`
    : "本轮完成";
  const phaseLabels = {
    listening: "正在听你说话",
    transcribing: "小米正在识别",
    thinking: "MiniMax 正在思考",
    speaking: "正在合成并播放",
    retrying: "云服务波动，正在重试",
    ready:
      hasMetrics || Number.isFinite(roundDuration)
        ? `${resultLabel} · 回合 ${secondsLabel(roundDuration)}`
        : "可以开始说话",
    error: `本轮失败 · ${errorStageLabels[state.turnObservation.errorStage] || "未知阶段"}`,
    idle: "等待一轮语音",
  };
  const processing = ["listening", "transcribing", "thinking", "speaking", "retrying"].includes(
    state.agentPhase,
  );
  elements.latencyStatus.dataset.state =
    state.agentPhase === "error" ? "error" : processing || !hasMetrics ? "checking" : "ready";
  strong.textContent = phaseLabels[state.agentPhase] || phaseLabels.idle;
  detail.textContent = [
    `切句 ${state.minSilenceDuration.toFixed(1)}s`,
    `ASR${state.asrOutputMode === "sse" ? "流式" : ""} ${secondsLabel(state.latency.asr)}`,
    `M3首字 ${secondsLabel(state.latency.llm)}`,
    `TTS首帧 ${secondsLabel(state.latency.tts)}`,
    Number.isFinite(state.latency.e2e) ? `响应首声 ${secondsLabel(state.latency.e2e)}` : null,
    state.turnObservation.retries ? `重试 ${state.turnObservation.retries}` : null,
  ].filter(Boolean).join(" · ");
}

function resetTurnLatency(turnId = null) {
  state.latency = { turnId, asr: null, llm: null, tts: null, e2e: null };
  state.turnObservation = {
    startedAt: performance.now(),
    elapsed: null,
    retries: 0,
    errorStage: null,
  };
}

function isTurnBusy() {
  return ["listening", "transcribing", "thinking", "speaking", "retrying"].includes(state.agentPhase);
}

function clearRecordingTimeout() {
  if (state.recordingTimeoutId !== null) {
    window.clearTimeout(state.recordingTimeoutId);
    state.recordingTimeoutId = null;
  }
}

async function closeMicrophoneForTurn(reason = "processing") {
  if (
    state.agentMode !== "minimax-voice" ||
    !state.room ||
    state.room.state !== ConnectionState.Connected ||
    !state.room.localParticipant.isMicrophoneEnabled
  ) {
    clearRecordingTimeout();
    return;
  }
  clearRecordingTimeout();
  try {
    await state.room.localParticipant.setMicrophoneEnabled(false);
    logEvent(reason === "time-limit" ? "单句录音达到 20 秒，已自动提交" : "已结束本轮收音");
  } catch (error) {
    logEvent(`停止本轮收音失败：${error.message}`, "error");
  } finally {
    updateControls();
    renderParticipants();
  }
}

function startRecordingTimeout() {
  clearRecordingTimeout();
  state.recordingTimeoutId = window.setTimeout(() => {
    if (!state.room?.localParticipant.isMicrophoneEnabled) return;
    setAgentPhase("transcribing");
    setNotice("单句最多录制 20 秒，已自动提交给小米 MiMo 识别。", "info");
    void closeMicrophoneForTurn("time-limit");
  }, 20_000);
}

function setAgentPhase(phase) {
  if (!phase || state.agentPhase === phase) return;
  const previousPhase = state.agentPhase;
  state.agentPhase = phase;
  const phaseEventLabels = {
    transcribing: "阶段：小米 MiMo 识别",
    thinking: "阶段：MiniMax M3 思考",
    speaking: "阶段：MiniMax TTS 播放",
  };
  if (phaseEventLabels[phase]) logEvent(phaseEventLabels[phase]);
  if (
    phase === "ready" &&
    ["listening", "transcribing", "thinking", "retrying", "speaking"].includes(previousPhase) &&
    Number.isFinite(state.turnObservation.startedAt)
  ) {
    state.turnObservation.elapsed = (performance.now() - state.turnObservation.startedAt) / 1_000;
    logEvent(
      `本轮完成：回合 ${secondsLabel(state.turnObservation.elapsed)}` +
        (Number.isFinite(state.latency.e2e)
          ? `，响应首声 ${secondsLabel(state.latency.e2e)}`
          : "") +
        (state.turnObservation.retries ? `，重试 ${state.turnObservation.retries} 次` : ""),
      "success",
    );
  }
  const notices = {
    listening: ["正在录制这一句话；说完可点“说完，提交”，停顿后也会自动提交。", "info"],
    transcribing: ["已结束收音，小米 MiMo 正在识别这一句话；请等待本轮完成。", "info"],
    thinking: ["识别完成，MiniMax M3 正在组织回答……", "info"],
    speaking: ["回答已生成，MiniMax Speech 2.8 正在合成并播放语音。", "success"],
    retrying: ["云服务响应较慢，系统正在自动重试；请不要重复提交。", "info"],
    ready: ["本轮完成，可以开始下一句或发送文字。", "success"],
  };
  if (notices[phase]) setNotice(...notices[phase]);
  renderLatency();
  updateControls();
  if (phase === "transcribing") void closeMicrophoneForTurn();
}

function acceptAgentEvent(event) {
  if (!event || typeof event.type !== "string") return;
  if (event.type === "agent_config") {
    state.conversationMode = event.mode || "stable-turn";
    if (Number.isFinite(event.min_silence_duration)) {
      state.minSilenceDuration = event.min_silence_duration;
    }
    state.asrOutputMode = event.asr_output_mode || "single-response";
    if (event.dispatch_mode) state.dispatch.mode = event.dispatch_mode;
    if (event.dispatch_agent_name) {
      state.dispatch.agentName = event.dispatch_agent_name;
      state.dispatch.confirmedAgentName = event.dispatch_agent_name;
    }
    if (event.dispatch_job_id) {
      state.dispatch.jobId = event.dispatch_job_id;
      state.dispatch.confirmedJobId = event.dispatch_job_id;
    }
    if (event.dispatch_id) state.dispatch.dispatchId = event.dispatch_id;
    if (event.dispatch_worker_id) state.dispatch.workerId = event.dispatch_worker_id;
    if (Number.isFinite(event.max_concurrent_jobs)) {
      state.workerCapacity.maxJobs = event.max_concurrent_jobs;
    }
    if (event.workflow_owner_id) {
      state.workflow.ownerId = event.workflow_owner_id;
      renderWorkflow();
    }
    if (event.active_agent) {
      state.activeAgentId = event.active_agent;
      renderAgentRole();
    }
    renderLatency();
    renderDispatch();
    renderResilience();
    return;
  }
  if (event.type === "failure_lab") {
    if (event.job_id === state.failureLab.requestedJobId && event.phase === "armed") {
      state.failureLab.phase = "armed";
      renderResilience();
      updateControls();
      logEvent(`Agent 已确认 Job ${event.job_id} 将以退出码 ${event.exit_code} 结束`);
    }
    return;
  }
  if (event.type === "visual_frame") {
    if (event.phase === "received") {
      const firstFrame = state.visual.transportPhase !== "received";
      state.visual.transportPhase = "received";
      state.visual.transportVerified = true;
      state.visual.frameCount = Number(event.frame_count) || state.visual.frameCount;
      state.visual.frameHash = event.frame_hash || state.visual.frameHash;
      state.visual.width = Number(event.width) || 0;
      state.visual.height = Number(event.height) || 0;
      state.visual.source = event.source || "video";
      state.visual.receivedAt = Number(event.received_at) || 0;
      if (firstFrame) {
        logEvent(
          `Agent 已收到视频帧：${state.visual.width}×${state.visual.height} / ${state.visual.frameHash}`,
          "success",
        );
        setNotice("LiveKit 视频传输已验证：Agent 回传了真实帧证据。", "success");
      }
    } else if (event.phase === "stopped") {
      state.visual.transportPhase = "stopped";
      logEvent("Agent 已确认测试视频轨道停止");
    }
    renderVisualLab();
    updateControls();
    return;
  }
  if (event.type === "visual_semantics") {
    const autoStopCamera =
      state.visual.sourceMode === "camera" &&
      ["described", "partial", "rejected"].includes(event.phase);
    state.visual.semanticPhase = event.phase || "rejected";
    if (event.model) state.visual.model = event.model;
    if (event.answer_preview) state.visual.answerPreview = event.answer_preview;
    if (event.phase === "analyzing") {
      logEvent(`MiniMax 正在分析帧 ${event.frame_hash || state.visual.frameHash}`);
    } else if (event.phase === "verified") {
      logEvent("MiniMax 已正确识别橙色、三角形和 742", "success");
      setNotice("视觉理解已验证：当前 MiniMax 接口正确识别了测试画面。", "success");
    } else if (event.phase === "described") {
      logEvent("MiniMax 已返回摄像头画面描述（未自动校验）", "success");
      setNotice("模型已描述摄像头帧；请对照本地预览人工确认准确性。", "success");
    } else if (event.phase === "partial") {
      logEvent("MiniMax 已返回视觉回答，但没有通过三项确定性校验", "error");
      setNotice("模型有回答，但尚不能据此确认完整视觉理解。", "error");
    } else if (event.phase === "rejected") {
      state.visual.answerPreview = event.error ? `接口错误：${event.error}` : state.visual.answerPreview;
      logEvent("当前 MiniMax 接口拒绝了 ImageContent", "error");
      setNotice("视频传输已验证，但当前 MiniMax 接口没有接受图像输入。", "error");
    } else if (event.phase === "no_frame") {
      setNotice("Agent 还没有可分析的视频帧，请等待收帧后再试。", "error");
    }
    renderVisualLab();
    updateControls();
    if (autoStopCamera) void stopVisualTestTrack();
    return;
  }
  if (event.type === "capability_event") {
    if (event.capability === "agent_handoff" && event.phase === "completed") {
      state.activeAgentId = event.to_agent || state.activeAgentId;
      renderAgentRole();
      setCapabilityEvidence(
        "Agent 交接已验证",
        `${agentRoleLabel(event.from_agent)} → ${agentRoleLabel(state.activeAgentId)}；这是 SDK 的 Agent handoff 事件。`,
        "verified",
      );
      logEvent(`Agent handoff：${event.from_agent || "unknown"} → ${state.activeAgentId}`, "success");
    } else if (event.capability === "function_tool" && event.phase === "completed") {
      const tools = Array.isArray(event.tools) ? event.tools : [];
      const toolNames = tools.length ? tools.join("、") : "未命名工具";
      setCapabilityEvidence(
        event.has_agent_handoff ? "工具已执行，正在完成交接" : "工具调用已验证",
        `SDK 已报告执行：${toolNames}。`,
        event.has_agent_handoff ? "running" : "verified",
      );
      logEvent(`Function tool 已执行：${toolNames}`, "success");
    }
    updateControls();
    return;
  }
  if (event.type === "workflow_state" && event.workflow === "appointment") {
    state.workflow.phase = event.phase || "idle";
    state.workflow.workflowId = event.workflow_id || state.workflow.workflowId;
    state.workflow.ownerId = event.owner_id || state.workflow.ownerId;
    state.workflow.version = event.version || state.workflow.version;
    state.workflow.expiresAt = event.expires_at || state.workflow.expiresAt;
    state.workflow.guard = null;
    state.workflow.draft = { ...state.workflow.draft, ...(event.draft || {}) };
    renderWorkflow();
    const labels = {
      collecting: "预约工作流已启动，正在收集信息",
      review: "预约草稿已写入本机 SQLite，等待提交人工审批",
      pending_approval: "预约草稿已进入审批门，等待页面上的人工决策",
      paused: "预约任务已暂停，可在 Agent 重启后恢复",
      confirmed: "预约草稿已幂等确认，正在返回研究向导",
      rejected: "人工已拒绝预约草稿，任务进入终态",
      cancelled: "预约任务已取消，不会再被恢复",
      expired: "预约任务已过期，不会再被恢复",
    };
    if (labels[state.workflow.phase]) logEvent(labels[state.workflow.phase], "success");
    updateControls();
    return;
  }
  if (event.type === "workflow_audit" && event.workflow === "appointment") {
    state.workflow.audit = Array.isArray(event.events) ? event.events : [];
    renderWorkflowAudit();
    const latest = state.workflow.audit.at(-1);
    if (latest) logEvent(`审计 #${latest.event_id}：${latest.action} / ${latest.actor_id}`, "success");
    return;
  }
  if (event.type === "workflow_guard" && event.workflow === "appointment") {
    state.workflow.guard = {
      code: event.code,
      expectedVersion: event.expected_version,
      currentVersion: event.current_version,
    };
    state.workflow.version = event.current_version || state.workflow.version;
    renderWorkflow();
    setCapabilityEvidence(
      "乐观并发护栏已验证",
      `SQLite 拒绝 v${event.expected_version} 覆盖当前 v${event.current_version}。`,
      "verified",
    );
    logEvent(`陈旧写入已拒绝：v${event.expected_version} → 当前 v${event.current_version}`, "success");
    updateControls();
    return;
  }
  if (event.type === "agent_status") {
    setAgentPhase(event.phase);
    return;
  }
  if (event.type === "agent_retrying") {
    state.turnObservation.retries += 1;
    logEvent(`本轮 ${event.stage?.toUpperCase() || "云服务"} 正在重试`);
    if (state.agentPhase === "retrying") {
      renderLatency();
    } else {
      setAgentPhase("retrying");
    }
    return;
  }
  if (event.type === "agent_error") {
    const messages = {
      asr: "语音识别失败或没有识别到有效内容，请重说一次，也可以直接发送文字。",
      llm: "MiniMax 回答失败，请稍后重试。",
      tts: "文字回答已生成，但语音合成失败；你仍可查看 Room Text。",
    };
    state.agentPhase = "error";
    state.turnObservation.errorStage = event.stage || null;
    if (
      Number.isFinite(state.turnObservation.startedAt) &&
      !Number.isFinite(state.turnObservation.elapsed)
    ) {
      state.turnObservation.elapsed = (performance.now() - state.turnObservation.startedAt) / 1_000;
    }
    const message = messages[event.stage] || "本轮处理失败，请重试。";
    setNotice(message, "error");
    logEvent(message, "error");
    renderLatency();
    updateControls();
    return;
  }
  if (event.type !== "turn_metrics" || !event.turn_id || !event.metrics) return;
  if (event.role === "user" && state.latency.turnId !== event.turn_id) {
    state.latency.turnId = event.turn_id;
  }
  if (event.turn_id !== state.latency.turnId) return;
  if (event.role === "user") {
    state.latency.asr = event.metrics.transcription_delay ?? null;
  }
  if (event.role === "assistant") {
    state.latency.llm = event.metrics.llm_node_ttft ?? null;
    state.latency.tts = event.metrics.tts_node_ttfb ?? null;
    state.latency.e2e = event.metrics.e2e_latency ?? null;
  }
  renderLatency();
}

function connectedModeNotice() {
  if (state.dispatch.mode === "explicit") {
    return "已先加入真实房间。命名 Agent 不会自动入房；请点击“调度命名 Agent”完成显式派发。";
  }
  if (state.agentMode === "openai-realtime") {
    return "已经进入真实房间。可以直接说话，也可以向 Realtime Agent 发送文字。";
  }
  if (state.agentMode === "minimax-voice") {
    return "已经进入真实房间。点击“开始说一句”，说完提交；本轮完成前会暂时锁定新的输入。";
  }
  if (state.agentMode === "minimax-text-voice") {
    return "已经进入真实房间。请发送文字，MiniMax 会生成文字和语音回答；麦克风需等 STT 接入。";
  }
  if (state.agentMode === "none") {
    return "已经进入真实房间，但当前未启动 Agent；你仍可测试麦克风媒体轨道。";
  }
  return "已经进入真实房间。请向文字 Agent 发送消息；麦克风只用于验证媒体发布，Agent 不会识别人声。";
}

function roomHasAgent(room) {
  return [...room.remoteParticipants.values()].some((participant) => isAgent(participant));
}

async function recoverAgentAfterReconnect(reconnectedRoom) {
  if (state.recoveringAgent || state.agentMode === "none") return;
  state.recoveringAgent = true;
  try {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (state.room !== reconnectedRoom || reconnectedRoom.state !== ConnectionState.Connected) return;
      if (roomHasAgent(reconnectedRoom)) return;
      setNotice("LiveKit 已恢复，正在等待 Agent Worker 并重新加入房间……", "info");
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        const status = await response.json();
        if (response.ok && status.agent_worker_ready) {
          const restoreMicrophone = reconnectedRoom.localParticipant.isMicrophoneEnabled;
          logEvent("Agent Worker 已恢复，正在重新加入房间");
          await reconnectedRoom.disconnect();
          if (state.room === reconnectedRoom) state.room = null;
          await connectRoom();
          if (
            restoreMicrophone &&
            state.room?.state === ConnectionState.Connected &&
            !state.room.localParticipant.isMicrophoneEnabled
          ) {
            await toggleMicrophone();
          }
          return;
        }
      } catch {
        // The regular service check owns the offline message. Keep retrying here.
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    setNotice("LiveKit 已恢复，但 Agent 尚未重新加入；请点击“离开”后重新进入房间。", "error");
  } finally {
    state.recoveringAgent = false;
  }
}

function updateControls() {
  const connected = state.room?.state === ConnectionState.Connected;
  const microphoneSupported = state.agentMode !== "minimax-text-voice";
  const agentConnected = Boolean(
    connected && [...state.room.remoteParticipants.values()].some((participant) => isAgent(participant)),
  );
  const micEnabled = Boolean(connected && state.room.localParticipant.isMicrophoneEnabled);
  const stableVoice = state.agentMode === "minimax-voice";
  const turnBusy = isTurnBusy();
  const waitingForTurn = turnBusy && !micEnabled;
  const explicitDispatch = state.dispatch.mode === "explicit";
  elements.connectButton.disabled = state.connecting || connected;
  elements.roomName.disabled = state.connecting || connected;
  elements.displayName.disabled = state.connecting || connected;
  elements.micButton.disabled =
    !connected ||
    !microphoneSupported ||
    (stableVoice && (!agentConnected || waitingForTurn));
  elements.leaveButton.disabled = !connected && !state.connecting;
  elements.chatInput.disabled = !agentConnected || turnBusy || micEnabled;
  elements.sendButton.disabled = !agentConnected || turnBusy || micEnabled;
  const experimentDisabled = !agentConnected || turnBusy || micEnabled;
  elements.toolExperimentButton.disabled = experimentDisabled || state.activeAgentId !== "research-guide";
  elements.handoffExperimentButton.disabled = experimentDisabled || state.activeAgentId !== "research-guide";
  elements.returnExperimentButton.disabled = experimentDisabled || state.activeAgentId !== "workflow-specialist";
  elements.startWorkflowButton.disabled = experimentDisabled || state.activeAgentId !== "research-guide";
  elements.resumeWorkflowButton.disabled = experimentDisabled || state.activeAgentId !== "research-guide";
  elements.submitDraftButton.disabled = experimentDisabled || state.activeAgentId !== "appointment-intake";
  elements.requestApprovalButton.disabled = experimentDisabled || state.activeAgentId !== "appointment-review";
  elements.approveWorkflowButton.disabled = experimentDisabled || state.activeAgentId !== "appointment-approval";
  elements.rejectWorkflowButton.disabled = experimentDisabled || state.activeAgentId !== "appointment-approval";
  elements.pauseWorkflowButton.disabled = experimentDisabled || state.activeAgentId !== "appointment-review";
  elements.staleWriteButton.disabled = experimentDisabled || state.activeAgentId !== "appointment-review";
  elements.expireWorkflowButton.disabled =
    experimentDisabled || !["appointment-intake", "appointment-review"].includes(state.activeAgentId);
  elements.cancelWorkflowButton.disabled =
    experimentDisabled || !["appointment-intake", "appointment-review"].includes(state.activeAgentId);
  elements.dispatchButton.disabled =
    !connected || !explicitDispatch || !state.agentWorkerReady || agentConnected || state.dispatch.dispatching;
  elements.refreshDispatchButton.disabled = !connected || !explicitDispatch || state.dispatch.dispatching;
  const waitingDispatch = Boolean(state.dispatch.dispatchId && !state.dispatch.jobId);
  elements.retryDispatchButton.hidden = !waitingDispatch;
  elements.retryDispatchButton.disabled =
    !connected ||
    !explicitDispatch ||
    state.dispatch.dispatching ||
    state.workerCapacity.availability !== "available";
  elements.retryDispatchButton.textContent =
    state.workerCapacity.availability === "full" ? "等待 Worker 空位…" : "重新提交等待任务";
  const failureActive = ["requesting", "armed", "recovering"].includes(state.failureLab.phase);
  elements.crashJobButton.disabled =
    !connected ||
    !explicitDispatch ||
    !agentConnected ||
    state.dispatch.jobStatus !== "running" ||
    state.dispatch.restartPolicy !== "on_failure" ||
    state.workerCapacity.jobExecutor !== "process" ||
    !state.workerCapacity.failureLabEnabled ||
    failureActive;
  elements.recoverJobButton.hidden = state.failureLab.phase !== "timeout";
  elements.recoverJobButton.disabled =
    state.failureLab.phase !== "timeout" ||
    !connected ||
    agentConnected ||
    state.workerCapacity.availability !== "available";
  const assignedWorker = state.workerCapacity.workers.find(
    (worker) => worker.worker_id === state.dispatch.workerId,
  );
  const poolFailureActive = ["terminating", "waiting", "manual-recovering"].includes(
    state.poolFailure.phase,
  );
  elements.failAssignedWorkerButton.disabled =
    !connected ||
    !explicitDispatch ||
    !agentConnected ||
    state.dispatch.jobStatus !== "running" ||
    state.workerCapacity.onlineWorkers < 2 ||
    !assignedWorker?.ready ||
    Number(assignedWorker.active_jobs) !== 1 ||
    poolFailureActive;
  elements.recoverAcrossWorkerButton.hidden = state.poolFailure.phase !== "timeout";
  elements.recoverAcrossWorkerButton.disabled =
    state.poolFailure.phase !== "timeout" ||
    !connected ||
    agentConnected ||
    state.workerCapacity.onlineWorkers < 1 ||
    state.workerCapacity.availability !== "available";
  elements.micButton.textContent =
    state.agentMode === "minimax-text-voice"
      ? "麦克风待接 STT"
      : stableVoice
        ? micEnabled
          ? "说完，提交"
          : waitingForTurn
            ? "本轮处理中…"
            : "开始说一句"
        : micEnabled
          ? "关闭麦克风"
          : "开启麦克风";
  elements.micButton.setAttribute("aria-pressed", String(micEnabled));
  renderDispatch();
  renderResilience();
  renderWorkerPool();
  renderVisualLab();
}

function isAgent(participant) {
  return participant.identity.toLowerCase().includes("agent") || Boolean(participant.attributes?.["lk.agent.state"]);
}

function participantTrackLabel(participant) {
  const publications = [...participant.trackPublications.values()];
  const mic = publications.find((publication) => publication.source === Track.Source.Microphone);
  const video = publications.find((publication) =>
    [Track.Source.Camera, Track.Source.ScreenShare].includes(publication.source),
  );
  if (video && mic && !mic.isMuted) return { label: "麦克风 + 视频发布中", live: true };
  if (video) return { label: "视频发布中", live: true };
  if (!mic) return { label: "无媒体轨道", live: false };
  if (mic.isMuted) return { label: "麦克风已静音", live: false };
  return { label: "麦克风发布中", live: true };
}

function renderParticipants() {
  if (!state.room || state.room.state !== ConnectionState.Connected) {
    elements.participantCount.textContent = "0 人";
    elements.participants.innerHTML = '<div class="empty-state"><span aria-hidden="true">◎</span><strong>尚未加入房间</strong><p>连接后，这里会显示浏览器和 Agent。</p></div>';
    updateAgentStatus([]);
    return;
  }

  const participants = [state.room.localParticipant, ...state.room.remoteParticipants.values()];
  elements.participantCount.textContent = `${participants.length} 人`;
  elements.participants.replaceChildren(
    ...participants.map((participant) => {
      const agent = isAgent(participant);
      const track = participantTrackLabel(participant);
      const card = document.createElement("article");
      card.className = "participant";
      card.dataset.agent = String(agent);
      card.dataset.speaking = String(participant.isSpeaking);

      const avatar = document.createElement("span");
      avatar.className = "participant-avatar";
      avatar.textContent = agent ? "AI" : (participant.name || participant.identity).slice(0, 1).toUpperCase();

      const identity = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = participant.name || participant.identity;
      const role = document.createElement("small");
      role.textContent = agent ? "LiveKit Agent" : participant === state.room.localParticipant ? "你 · 浏览器参与者" : "远端参与者";
      identity.append(name, role);

      const trackState = document.createElement("span");
      trackState.className = "track-state";
      trackState.dataset.live = String(track.live);
      trackState.textContent = agent ? "已加入" : track.label;
      card.append(avatar, identity, trackState);
      return card;
    }),
  );
  updateAgentStatus(participants);
}

function updateAgentStatus(participants) {
  const agent = participants.find((participant) => isAgent(participant));
  const strong = elements.agentStatus.querySelector("strong");
  const detail = elements.agentStatus.querySelector("p");
  if (agent) {
    elements.agentStatus.dataset.state = "ready";
    strong.textContent = "Agent 已加入房间";
    detail.textContent = agent.identity;
  } else {
    elements.agentStatus.dataset.state = "waiting";
    strong.textContent = "等待 Agent 入房";
    detail.textContent =
      state.agentMode === "openai-realtime"
        ? "OpenAI Realtime 语音模式"
        : state.agentMode === "minimax-voice"
          ? "小米 MiMo ASR + MiniMax M3 + Speech 2.8"
        : state.agentMode === "minimax-text-voice"
          ? "MiniMax M3 + Speech 2.8（文字输入）"
        : state.agentMode === "none"
          ? "当前启动未包含 Agent"
          : "无 Key 文字工具模式";
  }
}

function appendChat(role, text, key = crypto.randomUUID()) {
  state.messages.set(key, { role, text });
  if (state.messages.size > 40) {
    state.messages.delete(state.messages.keys().next().value);
  }
  elements.chatLog.replaceChildren(
    ...[...state.messages.values()].map((message) => {
      const row = document.createElement("li");
      row.className = "chat-message";
      row.dataset.role = message.role;
      const label = document.createElement("strong");
      label.textContent = message.role === "agent" ? "LOCAL AGENT" : "YOU";
      const body = document.createElement("p");
      body.textContent = message.text;
      row.append(label, body);
      return row;
    }),
  );
}

function attachRoomEvents(room) {
  room.registerTextStreamHandler("lk.transcription", (reader, participantInfo) => {
    if (!participantInfo.identity.toLowerCase().includes("agent")) return;
    const messageKey = reader.info.attributes?.["lk.segment_id"] || reader.info.id;
    (async () => {
      let accumulated = "";
      try {
        for await (const chunk of reader) {
          accumulated += chunk;
          if (accumulated.trim()) appendChat("agent", accumulated.trim(), messageKey);
        }
      } catch (error) {
        logEvent(`读取 Agent 文字流失败：${error.message}`, "error");
      }
    })();
  });

  room
    .on(RoomEvent.ConnectionStateChanged, (connectionState) => {
      logEvent(`连接状态：${connectionState}`);
      if (connectionState === ConnectionState.Connected) {
        setConnectionState("已连接", "connected");
        if (state.wasReconnecting) {
          state.wasReconnecting = false;
          setNotice("与本地 LiveKit 的连接已恢复，可以继续对话。", "success");
          void recoverAgentAfterReconnect(room);
        }
      }
      if (
        connectionState === ConnectionState.Reconnecting ||
        connectionState === ConnectionState.SignalReconnecting
      ) {
        state.wasReconnecting = true;
        setConnectionState("正在重连", "connecting");
        setNotice("与本地 LiveKit 的连接已中断，正在自动重试……", "error");
      }
      updateControls();
      renderParticipants();
    })
    .on(RoomEvent.ParticipantConnected, (participant) => {
      logEvent(`参与者加入：${participant.identity}`);
      if (isAgent(participant) && state.dispatch.mode === "explicit") {
        if (["armed", "recovering"].includes(state.failureLab.phase)) {
          state.failureLab.sawAgentRejoin = true;
        }
        if (["waiting", "manual-recovering"].includes(state.poolFailure.phase)) {
          state.poolFailure.sawAgentRejoin = true;
        }
        void refreshDispatchStatus({ quiet: true });
      }
      void refreshWorkerCapacity({ quiet: true });
      updateControls();
      renderParticipants();
    })
    .on(RoomEvent.ParticipantDisconnected, (participant) => {
      logEvent(`参与者离开：${participant.identity}`);
      if (isAgent(participant) && ["requesting", "armed", "recovering"].includes(state.failureLab.phase)) {
        state.failureLab.sawAgentLeave = true;
        state.failureLab.phase = "recovering";
        void refreshDispatchStatus({ quiet: true });
      }
      if (isAgent(participant) && ["terminating", "waiting"].includes(state.poolFailure.phase)) {
        state.poolFailure.sawAgentLeave = true;
        state.poolFailure.phase = "waiting";
        renderWorkerPool();
        void refreshDispatchStatus({ quiet: true });
      }
      void refreshWorkerCapacity({ quiet: true });
      updateControls();
      renderParticipants();
    })
    .on(RoomEvent.LocalTrackPublished, (publication) => {
      logEvent(`本地轨道已发布：${publication.source}`);
      if (publication.source === Track.Source.Microphone) {
        setNotice("麦克风轨道已真实发布到本地 LiveKit 房间。", "success");
      }
      updateControls();
      renderParticipants();
    })
    .on(RoomEvent.LocalTrackUnpublished, (publication) => {
      logEvent(`本地轨道已停止：${publication.source}`);
      updateControls();
      renderParticipants();
    })
    .on(RoomEvent.TrackMuted, (_publication, participant) => {
      logEvent(`轨道静音：${participant.identity}`);
      updateControls();
      renderParticipants();
    })
    .on(RoomEvent.TrackUnmuted, (_publication, participant) => {
      logEvent(`轨道恢复：${participant.identity}`);
      updateControls();
      renderParticipants();
    })
    .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const signature = speakers.map((participant) => participant.identity).sort().join("|");
      const now = performance.now();
      const isNewSpeakerSet = signature && signature !== state.activeSpeakerSignature;
      const debounceElapsed = now - state.activeSpeakerLoggedAt > 5_000;
      if (signature && (isNewSpeakerSet || debounceElapsed)) {
        logEvent(`正在说话：${speakers.map((participant) => participant.identity).join("、")}`);
        state.activeSpeakerLoggedAt = now;
      }
      if (signature || debounceElapsed) state.activeSpeakerSignature = signature;
      renderParticipants();
    })
    .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      logEvent(`订阅远端轨道：${participant.identity} / ${track.kind}`);
      if (track.kind === Track.Kind.Audio) {
        const audio = track.attach();
        audio.autoplay = true;
        audio.dataset.participant = participant.identity;
        elements.remoteAudio.append(audio);
      }
      renderParticipants();
    })
    .on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((element) => element.remove());
      renderParticipants();
    })
    .on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      if (!participant) return;

      // Agent replies already arrive through the canonical lk.transcription
      // text stream above. Handling them again here would render duplicates.
      // This event remains useful for the local participant's ASR transcript.
      if (participant !== room.localParticipant) return;
      segments.forEach((segment) => {
        if (segment.text?.trim()) appendChat("user", segment.text.trim(), segment.id);
      });
    })
    .on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (topic !== "local-agent-status" || !participant || !isAgent(participant)) return;
      try {
        acceptAgentEvent(JSON.parse(new TextDecoder().decode(payload)));
      } catch (error) {
        logEvent(`读取 Agent 状态失败：${error.message}`, "error");
      }
    })
    .on(RoomEvent.LocalAudioSilenceDetected, () => {
      setNotice("LiveKit 检测到麦克风持续静音，请检查系统输入设备。", "error");
      logEvent("检测到本地音频静音", "error");
    })
    .on(RoomEvent.Disconnected, (reason) => {
      logEvent(`已离开房间：${String(reason)}`);
      setConnectionState("未连接", "idle");
      state.wasReconnecting = false;
      clearRecordingTimeout();
      state.activeSpeakerSignature = "";
      state.activeSpeakerLoggedAt = 0;
      setNotice("已离开房间，可以重新连接。", "info");
      state.agentPhase = "idle";
      state.dispatch.dispatchId = "";
      state.dispatch.jobId = "";
      state.dispatch.jobStatus = "";
      state.dispatch.workerId = "";
      state.dispatch.participantIdentity = "";
      state.dispatch.restartPolicy = "unknown";
      state.dispatch.jobs = [];
      state.dispatch.confirmedAgentName = "";
      state.dispatch.confirmedJobId = "";
      state.failureLab = {
        phase: "idle",
        requestedJobId: "",
        requestedWorkerId: "",
        sawAgentLeave: false,
        sawAgentRejoin: false,
      };
      state.poolFailure = {
        phase: "idle",
        targetWorkerId: "",
        targetInstanceId: "",
        oldJobId: "",
        replacementWorkerId: "",
        sawAgentLeave: false,
        sawAgentRejoin: false,
      };
      void stopVisualTestTrack();
      updateControls();
      renderParticipants();
      renderLatency();
    });
}

async function checkService() {
  const strong = elements.serverStatus.querySelector("strong");
  const detail = elements.serverStatus.querySelector("p");
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const status = await response.json();
    if (!status.livekit_ready) throw new Error(status.livekit_detail || "LiveKit 未运行");
    state.agentMode = status.agent_mode || "local-text";
    state.agentWorkerReady = Boolean(status.agent_worker_ready);
    state.dispatch.mode = status.dispatch_mode || "automatic";
    state.dispatch.agentName = status.agent_name || "";
    absorbWorkerCapacity(status.worker_capacity);
    state.conversationMode = status.conversation_mode || "stable-turn";
    if (Number.isFinite(status.min_silence_duration)) {
      state.minSilenceDuration = status.min_silence_duration;
    }
    elements.serverStatus.dataset.state = "ready";
    strong.textContent = "LiveKit Server 已就绪";
    detail.textContent = status.server_url;
    updateControls();
    renderDispatch();
    if (
      state.room?.state === ConnectionState.Connected &&
      state.dispatch.mode === "explicit" &&
      state.dispatch.dispatchId
    ) {
      void refreshDispatchStatus({ quiet: true });
    }
    renderLatency();
    if (!state.room || state.room.state !== ConnectionState.Connected) updateAgentStatus([]);
  } catch (error) {
    elements.serverStatus.dataset.state = "error";
    strong.textContent = "LiveKit Server 离线";
    detail.textContent = "请运行 start-local.cmd";
  }
}

async function connectRoom() {
  state.connecting = true;
  setConnectionState("正在连接", "connecting");
  setNotice("正在向本地令牌服务申请临时入房凭证……", "info");
  updateControls();

  try {
    const response = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_name: elements.roomName.value,
        participant_identity: state.identity,
        participant_name: elements.displayName.value,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "无法获取房间令牌");

    const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
    state.room = room;
    attachRoomEvents(room);
    await room.connect(result.server_url, result.participant_token, { autoSubscribe: true });
    state.dispatch.dispatchId = "";
    state.dispatch.jobId = "";
    state.dispatch.jobStatus = "";
    state.dispatch.restartPolicy = "unknown";
    state.dispatch.jobs = [];
    state.dispatch.workerId = "";
    renderDispatch();
    logEvent(`已加入房间：${result.room_name}`);
    setNotice(connectedModeNotice(), "success");
  } catch (error) {
    logEvent(`连接失败：${error.message}`, "error");
    setConnectionState("连接失败", "error");
    setNotice(`连接失败：${error.message}`, "error");
    if (state.room) await state.room.disconnect();
    state.room = null;
  } finally {
    state.connecting = false;
    updateControls();
    renderParticipants();
  }
}

async function toggleMicrophone() {
  if (!state.room || state.room.state !== ConnectionState.Connected) return;
  if (state.agentMode === "minimax-text-voice") {
    setNotice("MiniMax 模式的 LLM 和语音合成已接入；麦克风输入仍需要 STT。", "info");
    return;
  }
  if (state.agentMode === "minimax-voice" && isTurnBusy() && !state.room.localParticipant.isMicrophoneEnabled) {
    setNotice("当前回合仍在处理中，请等待页面显示“本轮完成”。", "info");
    return;
  }
  const enable = !state.room.localParticipant.isMicrophoneEnabled;
  elements.micButton.disabled = true;
  setNotice(enable ? "正在请求系统麦克风权限……" : "正在停止麦克风轨道……", "info");
  try {
    if (enable) {
      resetTurnLatency();
      setAgentPhase(state.agentMode === "minimax-voice" ? "listening" : "ready");
    }
    await state.room.localParticipant.setMicrophoneEnabled(enable, {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    const enabledMessage =
      state.agentMode === "openai-realtime"
        ? "麦克风已发布，Realtime Agent 可以接收语音。"
        : state.agentMode === "minimax-voice"
          ? "正在录制这一句话；说完请点“说完，提交”，停顿后也会自动提交。"
        : "麦克风已发布到房间；当前模式只验证媒体轨道，Agent 不会识别人声。";
    if (enable) {
      setNotice(enabledMessage, "success");
      if (state.agentMode === "minimax-voice") startRecordingTimeout();
    } else if (state.agentMode === "minimax-voice") {
      clearRecordingTimeout();
      setAgentPhase("transcribing");
    } else {
      setNotice("麦克风已关闭。", "success");
    }
  } catch (error) {
    const message = error.name === "NotAllowedError" ? "麦克风权限被拒绝，请在浏览器地址栏允许后重试。" : `麦克风失败：${error.message}`;
    logEvent(message, "error");
    setNotice(message, "error");
    state.agentPhase = "error";
    state.turnObservation.errorStage = "transport";
    state.turnObservation.elapsed = Number.isFinite(state.turnObservation.startedAt)
      ? (performance.now() - state.turnObservation.startedAt) / 1_000
      : null;
    clearRecordingTimeout();
    renderLatency();
  } finally {
    updateControls();
    renderParticipants();
  }
}

async function leaveRoom() {
  clearRecordingTimeout();
  await stopVisualTestTrack();
  if (state.room) await state.room.disconnect();
  state.room = null;
  setConnectionState("未连接", "idle");
  updateControls();
  renderParticipants();
}

async function submitTextTurn(text, source = "manual") {
  const normalized = text.trim();
  if (!normalized || !state.room || state.room.state !== ConnectionState.Connected || isTurnBusy()) return;
  resetTurnLatency();
  setAgentPhase("thinking");
  if (source !== "manual") {
    setCapabilityEvidence("实验进行中", "等待 SDK 返回工具执行或 Agent handoff 事件……", "running");
  }
  try {
    await state.room.localParticipant.publishData(new TextEncoder().encode(normalized), {
      reliable: true,
      topic: "local-agent-chat",
    });
    appendChat("user", normalized);
    elements.chatInput.value = "";
    logEvent(source === "manual" ? "已通过 LiveKit 数据通道向 Agent 发送文字" : `已启动${source}`);
  } catch (error) {
    state.agentPhase = "error";
    state.turnObservation.errorStage = "transport";
    state.turnObservation.elapsed = Number.isFinite(state.turnObservation.startedAt)
      ? (performance.now() - state.turnObservation.startedAt) / 1_000
      : null;
    setNotice(`文字发送失败：${error.message}`, "error");
    setCapabilityEvidence("实验未发送", error.message, "error");
    logEvent(`文字发送失败：${error.message}`, "error");
    renderLatency();
    updateControls();
  }
}

elements.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  connectRoom();
});

elements.micButton.addEventListener("click", toggleMicrophone);
elements.leaveButton.addEventListener("click", leaveRoom);

elements.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitTextTurn(elements.chatInput.value, "manual");
});

elements.toolExperimentButton.addEventListener("click", () => {
  void submitTextTurn(
    "请调用 get_room_status 工具读取真实房间，然后用一句话告诉我房间名和参与者数量。",
    "实验 01：真实工具调用",
  );
});

elements.handoffExperimentButton.addEventListener("click", () => {
  void submitTextTurn(
    "请调用 transfer_to_workflow_specialist，把会话交给工作流专家，并由专家用一句话说明 LiveKit Agent handoff 的意义。",
    "实验 02：Agent handoff",
  );
});

elements.returnExperimentButton.addEventListener("click", () => {
  void submitTextTurn(
    "请调用 return_to_research_guide，把会话交还给研究向导，并由研究向导确认已经返回。",
    "实验 03：返回 handoff",
  );
});

elements.publishVisualButton.addEventListener("click", () => {
  void publishVisualTestTrack();
});

elements.openCameraButton.addEventListener("click", () => {
  void publishCameraTrack();
});

elements.analyzeVisualButton.addEventListener("click", () => {
  void requestVisualAnalysis();
});

elements.stopVisualButton.addEventListener("click", () => {
  void stopVisualTestTrack();
});

elements.dispatchButton.addEventListener("click", () => {
  void requestExplicitDispatch();
});

elements.refreshDispatchButton.addEventListener("click", () => {
  void refreshDispatchStatus();
});

elements.retryDispatchButton.addEventListener("click", () => {
  void retryWaitingDispatch();
});

elements.crashJobButton.addEventListener("click", () => {
  void crashCurrentJob();
});

elements.recoverJobButton.addEventListener("click", () => {
  void recoverStalledJob();
});

elements.failAssignedWorkerButton.addEventListener("click", () => {
  void failAssignedWorker();
});

elements.recoverAcrossWorkerButton.addEventListener("click", () => {
  void recoverAcrossWorker();
});

elements.startWorkflowButton.addEventListener("click", () => {
  void submitTextTurn(
    "请调用 start_appointment_workflow，开始一个写入本地 SQLite 的预约工作流。",
    "实验 04：启动有状态工作流",
  );
});

elements.resumeWorkflowButton.addEventListener("click", () => {
  void submitTextTurn(
    "请调用 resume_latest_appointment，只从本地 SQLite 恢复当前参与者 identity 拥有的最近未完成任务。",
    "实验 07：恢复最近任务",
  );
});

elements.submitDraftButton.addEventListener("click", () => {
  void submitTextTurn(
    "请立即调用 submit_appointment_draft：customer_name=张晓，appointment_time=明天下午三点，request=产品演示；三个参数按字符串原样写入，不要换算时间或追问。",
    "实验 05：写入预约草稿",
  );
});

elements.requestApprovalButton.addEventListener("click", () => {
  void submitTextTurn(
    "草稿审核无误，请调用 request_appointment_approval，把任务提交到独立人工审批门，不要直接确认。",
    "实验 12：提交人工审批",
  );
});

elements.approveWorkflowButton.addEventListener("click", () => {
  void submitTextTurn(
    "这是页面参与者的明确人工决定：请调用 approve_appointment 批准当前任务。",
    "实验 13：人工批准",
  );
});

elements.rejectWorkflowButton.addEventListener("click", () => {
  void submitTextTurn(
    "这是页面参与者的明确人工决定：请调用 reject_appointment，拒绝原因为需要重新确认演示时间。",
    "实验 14：人工拒绝",
  );
});

elements.pauseWorkflowButton.addEventListener("click", () => {
  void submitTextTurn(
    "请调用 pause_appointment，暂停当前预约任务并返回研究向导。",
    "实验 08：暂停并持久化",
  );
});

elements.staleWriteButton.addEventListener("click", () => {
  void submitTextTurn(
    "请调用 test_stale_appointment_write，用旧版本测试并发写保护，不要改变当前任务内容。",
    "实验 10：拒绝陈旧版本写入",
  );
});

elements.expireWorkflowButton.addEventListener("click", () => {
  void submitTextTurn(
    "请调用 expire_appointment，把当前本地研究任务标记为过期并返回研究向导。",
    "实验 11：模拟任务过期",
  );
});

elements.cancelWorkflowButton.addEventListener("click", () => {
  void submitTextTurn(
    "请调用 cancel_appointment，取消当前预约任务并返回研究向导。",
    "实验 09：取消预约任务",
  );
});

elements.clearChatButton.addEventListener("click", () => {
  state.messages.clear();
  elements.chatLog.innerHTML = '<li class="chat-empty">对话已清空。</li>';
});

elements.copyDiagnosticsButton.addEventListener("click", async () => {
  const report = [
    `URL: ${location.href}`,
    `Room: ${elements.roomName.value}`,
    `Identity: ${state.identity}`,
    `Connection: ${state.room?.state || "disconnected"}`,
    `Microphone: ${state.room?.localParticipant.isMicrophoneEnabled ? "enabled" : "disabled"}`,
    `Turn round duration: ${secondsLabel(state.turnObservation.elapsed)}`,
    `Turn response first audio: ${secondsLabel(state.latency.e2e)}`,
    `Turn retries: ${state.turnObservation.retries}`,
    `Turn error stage: ${state.turnObservation.errorStage || "none"}`,
    `Active agent: ${state.activeAgentId}`,
    `Dispatch mode: ${state.dispatch.mode}`,
    `Dispatch agent: ${state.dispatch.agentName || "none"}`,
    `Dispatch ID: ${state.dispatch.dispatchId || "none"}`,
    `Dispatch job: ${state.dispatch.jobId || "none"} / ${state.dispatch.jobStatus || "none"}`,
    `Dispatch worker: ${state.dispatch.workerId || "none"}`,
    `Dispatch restart policy: ${state.dispatch.restartPolicy || "none"}`,
    `Dispatch job attempts: ${state.dispatch.jobs.length}`,
    `Agent confirmed job: ${state.dispatch.confirmedJobId || "none"}`,
    `Worker capacity: ${state.workerCapacity.activeJobs}/${state.workerCapacity.maxJobs}`,
    `Worker availability: ${state.workerCapacity.availability}`,
    `Worker load: ${state.workerCapacity.load}`,
    `Worker job executor: ${state.workerCapacity.jobExecutor}`,
    `Worker pool: ${state.workerCapacity.onlineWorkers}/${state.workerCapacity.configuredWorkers}`,
    ...state.workerCapacity.workers.map(
      (worker) => `Worker instance: ${worker.instance_id} / ${worker.worker_id || "unregistered"} / ${worker.ready ? "online" : "offline"} / ${worker.active_jobs || 0} jobs`,
    ),
    `Worker failover phase: ${state.poolFailure.phase}`,
    `Worker failover target: ${state.poolFailure.targetWorkerId || "none"}`,
    `Worker failover replacement: ${state.poolFailure.replacementWorkerId || "none"}`,
    `Visual transport: ${state.visual.transportPhase}`,
    `Visual frame: ${state.visual.width || 0}x${state.visual.height || 0} / ${state.visual.frameHash || "none"}`,
    `Visual semantics: ${state.visual.semanticPhase} / ${state.visual.model}`,
    `Failure lab phase: ${state.failureLab.phase}`,
    `Failure lab requested job: ${state.failureLab.requestedJobId || "none"}`,
    `Workflow phase: ${state.workflow.phase}`,
    `Workflow ID: ${state.workflow.workflowId || "none"}`,
    `Workflow owner: ${state.workflow.ownerId || "none"}`,
    `Workflow version: ${state.workflow.version || 0}`,
    `Workflow expires: ${state.workflow.expiresAt || 0}`,
    `Workflow audit events: ${state.workflow.audit.length}`,
    `Workflow latest audit: ${state.workflow.audit.at(-1)?.action || "none"}`,
    "Events:",
    ...state.events.map((entry) => `${entry.time} ${entry.message}`),
  ].join("\n");
  try {
    await navigator.clipboard.writeText(report);
    setNotice("诊断信息已复制。", "success");
  } catch {
    setNotice("浏览器不允许自动复制，请从事件列表手动选择。", "error");
  }
});

elements.themeToggle.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  elements.themeToggle.setAttribute("aria-pressed", String(dark));
  elements.themeToggle.setAttribute("aria-label", dark ? "切换到浅色主题" : "切换到深色主题");
});

window.addEventListener("beforeunload", () => {
  state.visual.mediaStream?.getTracks().forEach((track) => track.stop());
  state.room?.disconnect();
});

drawVisualTestFrame();
logEvent("控制台已加载");
checkService();
setInterval(checkService, 5000);
updateControls();
renderLatency();
renderAgentRole();
renderDispatch();
renderWorkerCapacity();
renderWorkerPool();
renderWorkflow();
