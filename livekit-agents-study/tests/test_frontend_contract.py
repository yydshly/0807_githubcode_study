from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_room_text_has_one_agent_source_and_keeps_local_transcript() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")

    assert 'registerTextStreamHandler("lk.transcription"' in source
    assert 'if (participant !== room.localParticipant) return;' in source
    assert 'appendChat("user", segment.text.trim(), segment.id);' in source
    assert 'appendChat("agent", segment.text.trim(), segment.id);' not in source


def test_frontend_exposes_agent_processing_and_error_states() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")

    assert 'topic !== "local-agent-status"' in source
    for phase in ("listening", "transcribing", "thinking", "speaking", "retrying", "ready", "error"):
        assert phase in source
    assert "04 · STABLE TURN" in html
    assert 'aria-live="polite"' in html


def test_stable_turn_locks_reentrant_input_and_closes_voice_capture() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")

    assert "function isTurnBusy()" in source
    assert "state.room.state !== ConnectionState.Connected || isTurnBusy()" in source
    assert source.index('setAgentPhase("thinking");') < source.index("publishData(new TextEncoder().encode(normalized)")
    assert 'void closeMicrophoneForTurn();' in source
    assert '"开始说一句"' in source
    assert '"说完，提交"' in source
    assert "一次只处理一句" in html
    assert '"interruption": {' in agent
    assert '"enabled": False' in agent
    assert '"preemptive_generation": {"enabled": False}' in agent
    assert "if text_turn_active.is_set():" in agent


def test_recoverable_provider_errors_are_retrying_not_terminal() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")

    assert 'event.type === "agent_retrying"' in source
    assert 'getattr(event.error, "recoverable", False)' in agent
    assert '"type": "agent_retrying"' in agent


def test_turn_metrics_use_conversation_item_report() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")

    assert 'event.type !== "turn_metrics"' in source
    assert "event.metrics.transcription_delay" in source
    assert "event.metrics.llm_node_ttft" in source
    assert "event.metrics.tts_node_ttfb" in source
    assert "event.metrics.e2e_latency" in source
    assert "响应首声 ${secondsLabel(state.latency.e2e)}" in source
    assert "回合 ${secondsLabel(roundDuration)}" in source
    assert "state.latency.turnId = event.turn_id" in source
    assert "local-agent-metrics" not in source


def test_turn_observation_exposes_phase_retry_and_error_summary() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")

    assert "turnObservation" in source
    assert "阶段：小米 MiMo 识别" in source
    assert "阶段：MiniMax M3 思考" in source
    assert "阶段：MiniMax TTS 播放" in source
    assert "state.turnObservation.retries += 1" in source
    assert "state.turnObservation.errorStage = event.stage || null" in source
    assert "Turn round duration:" in source
    assert "Turn response first audio:" in source


def test_asr_sse_mode_and_speaker_events_are_visible_without_log_spam() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")

    assert 'event.asr_output_mode || "single-response"' in source
    assert 'state.asrOutputMode === "sse"' in source
    assert "activeSpeakerLoggedAt" in source
    assert "now - state.activeSpeakerLoggedAt > 5_000" in source
    assert '"asr_output_mode": "sse" if asr_stream_output' in agent


def test_capability_link_does_not_use_retired_local_port() -> None:
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")

    assert "49327" not in html
    assert "livekit-agents.html#demo" in html


def test_reconnect_notice_recovers_with_connection_state() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")

    assert "state.wasReconnecting = true;" in source
    assert "与本地 LiveKit 的连接已恢复，可以继续对话。" in source
    assert "recoverAgentAfterReconnect(room)" in source
    assert "Agent Worker 已恢复，正在重新加入房间" in source


def test_capability_lab_exposes_real_tool_and_handoff_evidence() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")

    assert "PHASE 2 · CAPABILITY LAB" in html
    assert 'id="toolExperimentButton"' in html
    assert 'id="handoffExperimentButton"' in html
    assert 'id="returnExperimentButton"' in html
    assert 'event.type === "capability_event"' in source
    assert 'event.capability === "function_tool"' in source
    assert 'event.capability === "agent_handoff"' in source
    assert "get_room_status 工具读取真实房间" in source
    assert "transfer_to_workflow_specialist" in source
    assert "return_to_research_guide" in source
    assert '@session.on("function_tools_executed")' in agent
    assert 'getattr(item, "type", None) == "agent_handoff"' in agent


def test_agent_handoff_uses_distinct_livekit_agent_roles() -> None:
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")

    assert 'id="research-guide"' in agent
    assert 'id="workflow-specialist"' in agent
    assert "return WorkflowResearchAgent(" in agent
    assert "return MiniMaxRoomAgent(" in agent
    assert '"has_agent_handoff": event.has_agent_handoff' in agent
    assert "async def on_enter(self) -> None:" in agent
    assert "confirm_return=True" in agent
    assert agent.count("tools=[]") == 5
    assert agent.count("chat_ctx=llm.ChatContext.empty()") == 3


def test_stateful_workflow_is_visible_and_driven_by_agent_events() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")
    store = (PROJECT_ROOT / "src" / "workflow_store.py").read_text(encoding="utf-8")

    assert "PHASE 6 · HUMAN APPROVAL" in html
    for control_id in (
        "startWorkflowButton",
        "resumeWorkflowButton",
        "submitDraftButton",
        "requestApprovalButton",
        "approveWorkflowButton",
        "rejectWorkflowButton",
        "pauseWorkflowButton",
        "staleWriteButton",
        "expireWorkflowButton",
        "cancelWorkflowButton",
    ):
        assert f'id="{control_id}"' in html
    assert 'event.type === "workflow_state"' in source
    assert 'state.activeAgentId !== "appointment-intake"' in source
    assert 'state.activeAgentId !== "appointment-review"' in source
    assert "start_appointment_workflow" in source
    assert "submit_appointment_draft" in source
    assert "request_appointment_approval" in source
    assert "approve_appointment" in source
    assert "reject_appointment" in source
    assert "resume_latest_appointment" in source
    assert "pause_appointment" in source
    assert "cancel_appointment" in source
    assert "expire_appointment" in source
    assert "test_stale_appointment_write" in source
    assert 'event.type === "workflow_guard"' in source
    assert 'event.type === "workflow_audit"' in source
    assert "livekit-research-owner-id" in source
    assert "const roomSessionId = crypto.randomUUID()" in source
    assert "identity: `visitor-${ownerSessionId}`" in source
    assert "defaultRoom: `local-demo-${roomSessionId}`" in source
    assert "workflow_id" in agent
    assert "local-sqlite" in store
    assert "owner-scoped" in store
    assert "optimistic-version" in store
    assert "appointment_workflow_audit" in store
    assert "workflow_participant = await ctx.wait_for_participant()" in agent
    assert '"type": "workflow_state"' in store
    assert 'id="appointment-intake"' in agent
    assert 'id="appointment-review"' in agent
    assert 'id="appointment-approval"' in agent
    assert "confirm_appointment" not in agent
    assert 'logger.info("forcing function tool for lab turn: %s", forced_tool)' in agent
    assert '"function": {"name": forced_tool}' in agent
    assert 'audio_format="pcm"' in agent
    assert "if item.old_agent_id is None:" in agent


def test_explicit_dispatch_lab_exposes_real_dispatch_job_and_worker() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")
    server = (PROJECT_ROOT / "src" / "local_demo_server.py").read_text(encoding="utf-8")

    assert "PHASE 7 · EXPLICIT DISPATCH" in html
    for control_id in (
        "dispatchModeBadge",
        "dispatchAgentName",
        "dispatchRoomName",
        "dispatchId",
        "dispatchJobId",
        "dispatchWorkerId",
        "dispatchButton",
        "refreshDispatchButton",
        "dispatchEvidence",
    ):
        assert f'id="{control_id}"' in html
    assert 'fetch("/api/dispatch"' in source
    assert "refreshDispatchStatus" in source
    assert 'result.created ? "已创建" : "已复用"' in source
    assert 'state.dispatch.mode === "explicit"' in source
    assert '@server.rtc_session(agent_name=DISPATCH_AGENT_NAME)' in agent
    assert '"dispatch_agent_name": ctx.job.agent_name' in agent
    assert '"dispatch_job_id": ctx.job.id' in agent
    assert '"dispatch_worker_id": ctx.worker_id' in agent
    assert 'path == "/api/dispatch"' in server
    assert "create_or_get_dispatch" in server


def test_worker_capacity_guard_is_visible_and_uses_real_worker_status() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")
    server = (PROJECT_ROOT / "src" / "local_demo_server.py").read_text(encoding="utf-8")
    start_script = (PROJECT_ROOT / "scripts" / "start-local.ps1").read_text(encoding="utf-8")

    assert "PHASE 8 · CAPACITY GUARD" in html
    for control_id in (
        "workerAvailabilityBadge",
        "workerActiveJobs",
        "workerMaxJobs",
        "workerLoad",
        "workerLoadPolicy",
        "workerCapacityFill",
        "capacityEvidence",
        "retryDispatchButton",
    ):
        assert f'id="{control_id}"' in html
    assert 'fetch("/api/worker"' in source
    assert 'capacity.availability === "full"' in source
    assert "当前房间已有 Dispatch，但 Worker 已满" in source
    assert "LiveKit 没有自动重投这个无 Job 的 Dispatch" in source
    assert 'fetch("/api/dispatch/retry"' in source
    assert 'state.dispatch.dispatchId && !state.dispatch.jobId' in source
    assert '"worker_capacity": capacity' in server
    assert 'path == "/api/worker"' in server
    assert 'path == "/api/dispatch/retry"' in server
    assert "retry_waiting_dispatch" in server
    assert "def worker_capacity_load" in agent
    assert "len(agent_server.active_jobs) / MAX_CONCURRENT_JOBS" in agent
    assert "load_threshold=1.0" in agent
    assert '"max_concurrent_jobs": MAX_CONCURRENT_JOBS' in agent
    assert 'AGENT_MAX_CONCURRENT_JOBS = "2"' in start_script


def test_job_resilience_lab_is_process_isolated_and_observable() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")
    server = (PROJECT_ROOT / "src" / "local_demo_server.py").read_text(encoding="utf-8")
    start_script = (PROJECT_ROOT / "scripts" / "start-local.ps1").read_text(encoding="utf-8")

    assert "PHASE 9 · JOB RESILIENCE" in html
    for control_id in (
        "resilienceBadge",
        "restartPolicy",
        "jobExecutor",
        "jobAttemptCount",
        "recoveryResult",
        "jobAttemptList",
        "crashJobButton",
        "recoverJobButton",
        "resilienceEvidence",
    ):
        assert f'id="{control_id}"' in html
    assert 'topic: "local-agent-failure-lab"' in source
    assert "observeFailureRecovery" in source
    assert 'fetch("/api/dispatch/recover"' in source
    assert 'state.dispatch.restartPolicy !== "on_failure"' in source
    assert "job_executor_type=JobExecutorType.PROCESS" in agent
    assert 'packet.topic == "local-agent-failure-lab"' in agent
    assert "os._exit(70)" in agent
    assert 'restart_policy=api.JobRestartPolicy.JRP_ON_FAILURE' in server
    assert '"restart_policy"' in server
    assert "recover_stalled_dispatch" in server
    assert 'path == "/api/dispatch/recover"' in server
    assert 'AGENT_FAILURE_LAB_ENABLED = "true"' in start_script


def test_worker_pool_lab_exposes_assignment_and_cross_worker_recovery() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")
    server = (PROJECT_ROOT / "src" / "local_demo_server.py").read_text(encoding="utf-8")
    start_script = (PROJECT_ROOT / "scripts" / "start-local.ps1").read_text(encoding="utf-8")

    assert "PHASE 10 · WORKER POOL" in html
    for control_id in (
        "workerPoolBadge",
        "workerOnlineCount",
        "workerPoolCapacity",
        "workerAssignment",
        "workerFailoverResult",
        "workerPoolList",
        "failAssignedWorkerButton",
        "recoverAcrossWorkerButton",
        "workerPoolEvidence",
    ):
        assert f'id="{control_id}"' in html
    assert 'fetch("/api/worker/fail"' in source
    assert "observeWorkerFailover" in source
    assert "state.workerCapacity.onlineWorkers < 2" in source
    assert "Number(assignedWorker.active_jobs) !== 1" in source
    assert 'path == "/api/worker/fail"' in server
    assert "terminate_worker_for_lab" in server
    assert 'os.getenv("AGENT_INSTANCE_ID", "worker-1")' in agent
    assert "port=WORKER_HTTP_PORT" in agent
    assert '[ValidateRange(1, 4)][int]$MiniMaxWorkers = 2' in start_script
    assert 'AGENT_WORKER_STATUS_URLS' in start_script
    assert 'AGENT_WORKER_READY_PATHS' in start_script


def test_visual_lab_separates_video_transport_from_model_understanding() -> None:
    source = (PROJECT_ROOT / "local-app" / "app.js").read_text(encoding="utf-8")
    html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")
    agent = (PROJECT_ROOT / "src" / "minimax_agent.py").read_text(encoding="utf-8")

    assert "PHASE 11 · VISUAL INPUT" in html
    for control_id in (
        "visualLabBadge",
        "visualTestCanvas",
        "visualCameraPreview",
        "visualPreviewBadge",
        "visualPreviewHint",
        "visualLocalTrack",
        "visualAgentFrame",
        "visualFrameEvidence",
        "visualModelResult",
        "visualTransportLayer",
        "visualSemanticLayer",
        "publishVisualButton",
        "openCameraButton",
        "analyzeVisualButton",
        "stopVisualButton",
        "visualEvidence",
    ):
        assert f'id="{control_id}"' in html
    assert 'captureStream(2)' in source
    assert 'navigator.mediaDevices.getUserMedia' in source
    assert 'name: "phase-11-physical-camera"' in source
    assert 'sourceMode: "none"' in source
    assert 'experiment: cameraMode ? "camera" : "deterministic"' in source
    assert 'transportVerified: false' in source
    assert 'if (autoStopCamera) void stopVisualTestTrack();' in source
    assert "当前一帧发送到 MiniMax 云端" in html
    assert 'source: Track.Source.Camera' in source
    assert 'name: "phase-11-synthetic-vision"' in source
    assert 'topic: "local-agent-visual-lab"' in source
    assert 'event.type === "visual_frame"' in source
    assert 'event.type === "visual_semantics"' in source
    assert 'packet.topic == "local-agent-visual-lab"' in agent
    assert 'rtc.VideoStream.from_track(track=track)' in agent
    assert '"type": "visual_frame"' in agent
    assert 'llm.ImageContent(' in agent
    assert 'semantic_phase = "described" if answer else "partial"' in agent
    assert '[redacted camera description]' in agent
    assert 'stream = vision_llm.chat(' in agent
    assert "content = chunk.delta.content if chunk.delta else None" in agent
    assert "chunk.choices" not in agent
    assert 'speech = session.say(' in agent
    assert '"[redacted camera description]"' in agent
    assert "logger.propagate = False" in agent
    assert '"orange": "橙" in answer' in agent
    assert '"triangle": "三角" in answer' in agent
    assert '"code_742": "742" in answer' in agent


def test_product_capability_demo_is_truthful_safe_and_links_to_real_labs() -> None:
    product_html = (PROJECT_ROOT / "local-app" / "product.html").read_text(encoding="utf-8")
    product_source = (PROJECT_ROOT / "local-app" / "product.js").read_text(encoding="utf-8")
    product_css = (PROJECT_ROOT / "local-app" / "product.css").read_text(encoding="utf-8")
    lab_html = (PROJECT_ROOT / "local-app" / "index.html").read_text(encoding="utf-8")
    summary = (PROJECT_ROOT / "TECHNICAL_SUMMARY.md").read_text(encoding="utf-8")
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

    for layer in ("LiveKit Server", "LiveKit Agents", "模型服务", "业务系统"):
        assert layer in product_html
    for status in ("本项目已验证", "框架可扩展", "当前未完成"):
        assert status in product_html
    for scenario in ("appointment", "vision", "service"):
        assert f"{scenario}:" in product_source
    for anchor in ("capability-lab", "visual-lab", "workflow-lab"):
        assert f'id="{anchor}"' in lab_html
        assert f"./#{anchor}" in product_source

    assert 'class="product-link" href="./product.html"' in lab_html
    assert 'fetch("/api/status"' in product_source
    assert "navigator.mediaDevices" not in product_source
    assert "getUserMedia" not in product_source
    assert "/api/token" not in product_source
    assert "local-agent-chat" not in product_source
    assert "prefers-reduced-motion: reduce" in product_css
    assert "ArrowRight" in product_source
    assert "LiveKit Agents 是 LiveKit 实时应用中 AI Agent 的运行与编排核心" in summary
    assert "审批门、SQLite 持久化、RBAC 和业务审计也不是 SDK 开箱即用功能" in summary
    assert "自动总结整个群聊或视频会议”不是当前原型已验证的开箱能力" in summary
    assert "Agents 在中心连接房间，并分别调用模型和业务工具" in product_html
    assert '[["已验来源", "确定性合成画面"], ["样例帧", "640 × 360"]' in product_source
    assert "摄像头 / 合成画面" not in product_source
    assert "cd E:\\0807_codex_project" not in readme
