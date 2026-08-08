"""MiniMax-backed LiveKit Agent with optional Xiaomi MiMo speech input."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from pathlib import Path

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobExecutorType,
    RunContext,
    cli,
    function_tool,
    llm,
    room_io,
    stt,
    tts,
)
from livekit.plugins import anthropic, minimax, silero

from xiaomi_mimo_stt import XiaomiMiMoSTT
from workflow_store import (
    AppointmentDraft,
    AppointmentStore,
    WorkflowConflictError,
    WorkflowExpiredError,
)


logger = logging.getLogger("minimax_agent")
LOG_PATH = Path(__file__).resolve().parent.parent / ".local-state" / "minimax-agent.log"
INSTANCE_ID = os.getenv("AGENT_INSTANCE_ID", "worker-1").strip() or "worker-1"
READY_PATH = Path(
    os.getenv(
        "AGENT_READY_PATH",
        str(Path(__file__).resolve().parent.parent / ".local-state" / "minimax-agent.ready.json"),
    )
)
WORKFLOW_DB_PATH = Path(
    os.getenv(
        "WORKFLOW_DB_PATH",
        str(Path(__file__).resolve().parent.parent / ".local-state" / "workflows.sqlite3"),
    )
)
appointment_store = AppointmentStore(WORKFLOW_DB_PATH)
DISPATCH_AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "").strip()


async def publish_workflow_state(context: RunContext, draft: AppointmentDraft) -> None:
    room = context.session.room_io.room
    await room.local_participant.publish_data(
        json.dumps(draft.event_payload(), ensure_ascii=False),
        topic="local-agent-status",
    )
    audit_events = await asyncio.to_thread(
        appointment_store.list_audit,
        draft.workflow_id,
        owner_id=draft.owner_id,
    )
    await room.local_participant.publish_data(
        json.dumps(
            {
                "type": "workflow_audit",
                "workflow": "appointment",
                "workflow_id": draft.workflow_id,
                "events": [event.event_payload() for event in audit_events],
            },
            ensure_ascii=False,
        ),
        topic="local-agent-status",
    )


async def publish_workflow_guard(
    context: RunContext,
    draft: AppointmentDraft,
    *,
    code: str,
    expected_version: int,
) -> None:
    room = context.session.room_io.room
    await room.local_participant.publish_data(
        json.dumps(
            {
                "type": "workflow_guard",
                "workflow": "appointment",
                "code": code,
                "workflow_id": draft.workflow_id,
                "owner_id": draft.owner_id,
                "phase": draft.status,
                "expected_version": expected_version,
                "current_version": draft.version,
            },
            ensure_ascii=False,
        ),
        topic="local-agent-status",
    )


def float_setting(name: str, default: float, *, minimum: float, maximum: float) -> float:
    raw_value = os.getenv(name)
    if not raw_value:
        return default
    try:
        value = float(raw_value)
    except ValueError as error:
        raise ValueError(f"{name} must be a number") from error
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def int_setting(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw_value = os.getenv(name)
    if not raw_value:
        return default
    try:
        value = int(raw_value)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer") from error
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def bool_setting(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None or not raw_value.strip():
        return default
    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be true or false")


def configure_file_logging() -> None:
    # The LiveKit CLI installs a root handler after importing this module.
    # Keep our dedicated file handler from propagating to that root handler,
    # otherwise every job-process record is written twice.
    logger.propagate = False
    sdk_logger = logging.getLogger("livekit.agents")
    sdk_logger.propagate = False
    if any(isinstance(handler, logging.FileHandler) for handler in logger.handlers):
        return
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    handler.setLevel(logging.INFO)
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    if handler not in sdk_logger.handlers:
        sdk_logger.addHandler(handler)


async def handle_user_text(
    session: AgentSession,
    session_ready: asyncio.Event,
    text_turn_lock: asyncio.Lock,
    text_turn_active: asyncio.Event,
    participant_identity: str,
    text: str,
) -> None:
    await session_ready.wait()
    logger.info("text input from %s: %s", participant_identity, text)
    async with text_turn_lock:
        text_turn_active.set()
        try:
            async with session._claim_user_turn():
                forced_tool = next(
                    (
                        tool_name
                        for tool_name in (
                            "get_room_status",
                            "transfer_to_workflow_specialist",
                            "return_to_research_guide",
                            "start_appointment_workflow",
                            "resume_latest_appointment",
                            "submit_appointment_draft",
                            "pause_appointment",
                            "cancel_appointment",
                            "request_appointment_approval",
                            "approve_appointment",
                            "reject_appointment",
                            "expire_appointment",
                            "test_stale_appointment_write",
                        )
                        if tool_name in text
                    ),
                    None,
                )
                reply_options: dict[str, object] = {"user_input": text}
                if forced_tool:
                    reply_options["tool_choice"] = {
                        "type": "function",
                        "function": {"name": forced_tool},
                    }
                    logger.info("forcing function tool for lab turn: %s", forced_tool)
                reply = session.generate_reply(**reply_options)
                await reply
        finally:
            text_turn_active.clear()


class MiniMaxRoomAgent(Agent):
    def __init__(
        self,
        llm_model: str,
        tts_model: str,
        asr_model: str | None,
        *,
        confirm_return: bool = False,
        appointment_draft: AppointmentDraft | None = None,
        entry_message: str | None = None,
        owner_id: str = "local-research-user",
    ) -> None:
        self._llm_model = llm_model
        self._tts_model = tts_model
        self._asr_model = asr_model
        self._confirm_return = confirm_return
        self._appointment_draft = appointment_draft or AppointmentDraft()
        self._entry_message = entry_message
        self._owner_id = owner_id
        super().__init__(
            id="research-guide",
            instructions=(
                "你是加入本地 LiveKit 房间的中文 LiveKit Agents 研究向导。"
                "回答自然、简洁；可以使用工具时不要猜测。"
                "用户要求读取房间状态时，必须调用 get_room_status。"
                "用户要求交给工作流专家、研究 handoff 或多 Agent 分工时，"
                "必须调用 transfer_to_workflow_specialist，不要只口头描述交接。"
                "用户要求开始预约流程时，必须调用 start_appointment_workflow。"
                "用户要求恢复上次预约流程时，必须调用 resume_latest_appointment。"
                "恢复任务只能查询当前本地参与者 identity 拥有的记录。"
                "默认只回答一到两句短句；除非用户明确要求，不要展开长篇解释。"
                "用户可以通过页面文字输入，也可以直接说话；你的回答会由 MiniMax 语音合成播放。"
            )
        )

    async def on_enter(self) -> None:
        if self._entry_message:
            self.session.generate_reply(
                instructions=f"只回复下面这段中文事实，不添加内容：{self._entry_message}",
                tools=[],
                chat_ctx=llm.ChatContext.empty(),
            )
            return
        if self._confirm_return:
            self.session.generate_reply(
                instructions="用一句简短中文确认已经通过 handoff 返回 LiveKit Agents 研究向导。",
                tools=[],
            )

    @function_tool
    async def get_room_status(self, context: RunContext) -> str:
        """读取当前真实 LiveKit 房间及参与者。"""
        room = context.session.room_io.room
        participants = [room.local_participant.identity]
        participants.extend(participant.identity for participant in room.remote_participants.values())
        return json.dumps(
            {
                "livekit_connected": room.isconnected(),
                "room": room.name,
                "participants": sorted(participants),
                "llm": self._llm_model,
                "tts": self._tts_model,
                "asr": self._asr_model,
                "input_mode": "livekit-audio-and-data-text" if self._asr_model else "livekit-data-text",
            },
            ensure_ascii=False,
            sort_keys=True,
        )

    @function_tool
    async def transfer_to_workflow_specialist(self) -> Agent:
        """把会话交给专门研究 LiveKit 工作流、handoff 与多 Agent 分工的专家。"""
        logger.info("handoff requested: research-guide -> workflow-specialist")
        return WorkflowResearchAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            self._appointment_draft,
            self._owner_id,
        )

    @function_tool
    async def start_appointment_workflow(self, context: RunContext) -> Agent:
        """创建一个写入本地 SQLite 的研究用预约流程，并交给信息收集 Agent。"""
        workflow_ttl = float_setting(
            "WORKFLOW_TTL_SECONDS", 3600.0, minimum=60.0, maximum=604800.0
        )
        self._appointment_draft = await asyncio.to_thread(
            appointment_store.create,
            self._owner_id,
            ttl_seconds=workflow_ttl,
        )
        await publish_workflow_state(context, self._appointment_draft)
        logger.info("appointment workflow started: %s", self._appointment_draft.workflow_id)
        return AppointmentIntakeAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            self._appointment_draft,
        )

    @function_tool
    async def resume_latest_appointment(self, context: RunContext) -> Agent | str:
        """从本地 SQLite 恢复最近一个未完成的预约流程。"""
        restored = await asyncio.to_thread(
            appointment_store.resume_latest, self._owner_id
        )
        if restored is None:
            return "当前参与者在本地 SQLite 中没有可恢复的预约任务。"
        self._appointment_draft = restored
        await publish_workflow_state(context, restored)
        logger.info("appointment workflow resumed: %s", restored.workflow_id)
        if restored.status == "review":
            return AppointmentReviewAgent(
                self._llm_model,
                self._tts_model,
                self._asr_model,
                restored,
                resumed=True,
            )
        if restored.status == "pending_approval":
            return AppointmentApprovalAgent(
                self._llm_model,
                self._tts_model,
                self._asr_model,
                restored,
                resumed=True,
            )
        return AppointmentIntakeAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            restored,
            resumed=True,
        )


class WorkflowResearchAgent(Agent):
    def __init__(
        self,
        llm_model: str,
        tts_model: str,
        asr_model: str | None,
        appointment_draft: AppointmentDraft | None = None,
        owner_id: str = "local-research-user",
    ) -> None:
        self._llm_model = llm_model
        self._tts_model = tts_model
        self._asr_model = asr_model
        self._appointment_draft = appointment_draft or AppointmentDraft()
        self._owner_id = owner_id
        super().__init__(
            id="workflow-specialist",
            instructions=(
                "你是 LiveKit Agents 工作流专家，刚由研究向导通过框架 handoff 接管同一会话。"
                "请聚焦 Agent 角色交接、任务拆分、多 Agent 协作和工作流编排。"
                "明确告诉用户本次角色变化是真实 Agent handoff，不是更换提示词的页面模拟。"
                "如果用户要求返回研究向导，必须调用 return_to_research_guide。"
                "默认只回答一到两句简洁中文。"
            ),
        )

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions=(
                "你刚通过真实 Agent handoff 接管会话。"
                "请用一句简短中文说明：handoff 让同一会话切换到拥有不同指令和工具的专家角色。"
            ),
            tools=[],
        )

    @function_tool
    async def return_to_research_guide(self) -> Agent:
        """结束工作流专题，把会话交还给 LiveKit Agents 研究向导。"""
        logger.info("handoff requested: workflow-specialist -> research-guide")
        return MiniMaxRoomAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            confirm_return=True,
            appointment_draft=self._appointment_draft,
            owner_id=self._owner_id,
        )


class AppointmentIntakeAgent(Agent):
    def __init__(
        self,
        llm_model: str,
        tts_model: str,
        asr_model: str | None,
        appointment_draft: AppointmentDraft,
        *,
        resumed: bool = False,
    ) -> None:
        self._llm_model = llm_model
        self._tts_model = tts_model
        self._asr_model = asr_model
        self._appointment_draft = appointment_draft
        self._resumed = resumed
        super().__init__(
            id="appointment-intake",
            instructions=(
                "你是本地研究用预约信息收集 Agent。"
                "用户提供姓名、预约时间和需求后，必须调用 submit_appointment_draft，"
                "不要只复述信息。预约时间是研究字段，必须按用户原文写入，不要换算日期或追问格式。"
                "缺少任一项时只询问缺失项。"
                "用户要求取消时必须调用 cancel_appointment。"
                "用户要求模拟过期时必须调用 expire_appointment。"
                "数据写入本机 SQLite 研究库，不要声称已经写入生产预约系统。"
            ),
        )

    async def on_enter(self) -> None:
        prefix = "已从本地 SQLite 恢复任务，" if self._resumed else ""
        self.session.generate_reply(
            instructions=f"只用一句中文说明：{prefix}已进入预约信息收集，请用户提供姓名、预约时间和需求。",
            tools=[],
            chat_ctx=llm.ChatContext.empty(),
        )

    @function_tool
    async def submit_appointment_draft(
        self,
        context: RunContext,
        customer_name: str,
        appointment_time: str,
        request: str,
    ) -> Agent | str:
        """保存姓名、预约时间和需求到本地 SQLite，并交给预约审核 Agent。"""
        expected_version = self._appointment_draft.version
        try:
            self._appointment_draft = await asyncio.to_thread(
                appointment_store.submit,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
                expected_version=expected_version,
                customer_name=customer_name,
                appointment_time=appointment_time,
                request=request,
            )
        except WorkflowConflictError:
            current = await asyncio.to_thread(
                appointment_store.get,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
            )
            if current is not None:
                self._appointment_draft = current
                await publish_workflow_guard(
                    context,
                    current,
                    code="stale_version",
                    expected_version=expected_version,
                )
            return "提交被拒绝：任务版本已经变化，请按页面最新状态重试。"
        await publish_workflow_state(context, self._appointment_draft)
        logger.info("appointment draft submitted: %s", self._appointment_draft)
        return AppointmentReviewAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            self._appointment_draft,
        )

    @function_tool
    async def cancel_appointment(self, context: RunContext) -> Agent | str:
        """取消当前预约任务，并返回研究向导。"""
        expected_version = self._appointment_draft.version
        try:
            self._appointment_draft = await asyncio.to_thread(
                appointment_store.cancel,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
                expected_version=expected_version,
            )
        except WorkflowConflictError:
            await self._publish_conflict(context, expected_version)
            return "取消被拒绝：任务版本已经变化，请按页面最新状态重试。"
        await publish_workflow_state(context, self._appointment_draft)
        logger.info("appointment workflow cancelled: %s", self._appointment_draft.workflow_id)
        return MiniMaxRoomAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            appointment_draft=self._appointment_draft,
            entry_message=f"本地预约任务 {self._appointment_draft.workflow_id} 已取消。",
            owner_id=self._appointment_draft.owner_id,
        )

    @function_tool
    async def expire_appointment(self, context: RunContext) -> Agent:
        """把当前研究任务显式标记为过期，并返回研究向导。"""
        self._appointment_draft = await asyncio.to_thread(
            appointment_store.expire,
            self._appointment_draft.workflow_id,
            owner_id=self._appointment_draft.owner_id,
            expected_version=self._appointment_draft.version,
        )
        await publish_workflow_state(context, self._appointment_draft)
        return MiniMaxRoomAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            appointment_draft=self._appointment_draft,
            entry_message=f"本地预约任务 {self._appointment_draft.workflow_id} 已过期，不能再恢复。",
            owner_id=self._appointment_draft.owner_id,
        )

    async def _publish_conflict(self, context: RunContext, expected_version: int) -> None:
        current = await asyncio.to_thread(
            appointment_store.get,
            self._appointment_draft.workflow_id,
            owner_id=self._appointment_draft.owner_id,
        )
        if current is not None:
            self._appointment_draft = current
            await publish_workflow_guard(
                context,
                current,
                code="stale_version",
                expected_version=expected_version,
            )


class AppointmentReviewAgent(Agent):
    def __init__(
        self,
        llm_model: str,
        tts_model: str,
        asr_model: str | None,
        appointment_draft: AppointmentDraft,
        *,
        resumed: bool = False,
    ) -> None:
        self._llm_model = llm_model
        self._tts_model = tts_model
        self._asr_model = asr_model
        self._appointment_draft = appointment_draft
        self._resumed = resumed
        super().__init__(
            id="appointment-review",
            instructions=(
                "你是本地研究用预约审核 Agent。"
                "你不能直接确认预约。用户审核草稿后，必须调用 request_appointment_approval，"
                "把任务交给独立审批 Agent 等待页面上的人工批准或拒绝。"
                "用户要求暂停时必须调用 pause_appointment；要求取消时必须调用 cancel_appointment。"
                "用户要求测试陈旧版本写入时必须调用 test_stale_appointment_write。"
                "用户要求模拟过期时必须调用 expire_appointment。"
                "这是本地 SQLite 实验，不要声称预约已经进入真实生产系统。"
            ),
        )

    async def on_enter(self) -> None:
        draft = self._appointment_draft
        prefix = "已从本地 SQLite 恢复，" if self._resumed else ""
        self.session.generate_reply(
            instructions=(
                f"只用一句中文说明{prefix}请用户审核以下本地草稿并确认："
                f"{draft.customer_name}，{draft.appointment_time}，需求是{draft.request}。"
                "明确说明下一步只会发起人工审批，不会直接完成。"
            ),
            tools=[],
            chat_ctx=llm.ChatContext.empty(),
        )

    @function_tool
    async def request_appointment_approval(self, context: RunContext) -> Agent | str:
        """请求人工审批当前预约草稿，并交给只允许批准或拒绝的审批 Agent。"""
        previous_version = self._appointment_draft.version
        try:
            self._appointment_draft = await asyncio.to_thread(
                appointment_store.request_approval,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
                expected_version=previous_version,
                actor_id="agent:appointment-review",
            )
        except WorkflowConflictError:
            await self._publish_conflict(context, previous_version)
            return "审批请求被拒绝：任务版本已经变化，请审核页面最新状态。"
        except WorkflowExpiredError:
            current = await asyncio.to_thread(
                appointment_store.get,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
            )
            if current is not None:
                self._appointment_draft = current
                await publish_workflow_state(context, current)
            return "任务已经过期，不能请求审批。"
        await publish_workflow_state(context, self._appointment_draft)
        draft = self._appointment_draft
        logger.info("appointment approval requested: %s", draft)
        return AppointmentApprovalAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            draft,
        )

    @function_tool
    async def pause_appointment(self, context: RunContext) -> Agent | str:
        """暂停当前预约任务，保存到本地 SQLite 并返回研究向导。"""
        expected_version = self._appointment_draft.version
        try:
            self._appointment_draft = await asyncio.to_thread(
                appointment_store.pause,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
                expected_version=expected_version,
            )
        except WorkflowConflictError:
            await self._publish_conflict(context, expected_version)
            return "暂停被拒绝：任务版本已经变化，请按页面最新状态重试。"
        await publish_workflow_state(context, self._appointment_draft)
        logger.info("appointment workflow paused: %s", self._appointment_draft.workflow_id)
        return MiniMaxRoomAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            appointment_draft=self._appointment_draft,
            entry_message=(
                f"本地预约任务 {self._appointment_draft.workflow_id} 已暂停并写入 SQLite，"
                "之后可以恢复继续审核。"
            ),
            owner_id=self._appointment_draft.owner_id,
        )

    @function_tool
    async def cancel_appointment(self, context: RunContext) -> Agent | str:
        """取消当前预约任务，并返回研究向导。"""
        expected_version = self._appointment_draft.version
        try:
            self._appointment_draft = await asyncio.to_thread(
                appointment_store.cancel,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
                expected_version=expected_version,
            )
        except WorkflowConflictError:
            await self._publish_conflict(context, expected_version)
            return "取消被拒绝：任务版本已经变化，请按页面最新状态重试。"
        await publish_workflow_state(context, self._appointment_draft)
        logger.info("appointment workflow cancelled: %s", self._appointment_draft.workflow_id)
        return MiniMaxRoomAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            appointment_draft=self._appointment_draft,
            entry_message=f"本地预约任务 {self._appointment_draft.workflow_id} 已取消。",
            owner_id=self._appointment_draft.owner_id,
        )

    @function_tool
    async def expire_appointment(self, context: RunContext) -> Agent:
        """把当前研究任务显式标记为过期，并返回研究向导。"""
        self._appointment_draft = await asyncio.to_thread(
            appointment_store.expire,
            self._appointment_draft.workflow_id,
            owner_id=self._appointment_draft.owner_id,
            expected_version=self._appointment_draft.version,
        )
        await publish_workflow_state(context, self._appointment_draft)
        logger.info("appointment workflow expired: %s", self._appointment_draft.workflow_id)
        return MiniMaxRoomAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            appointment_draft=self._appointment_draft,
            entry_message=f"本地预约任务 {self._appointment_draft.workflow_id} 已过期，不能再恢复。",
            owner_id=self._appointment_draft.owner_id,
        )

    @function_tool
    async def test_stale_appointment_write(self, context: RunContext) -> str:
        """用旧版本模拟一次并发写入，并验证 SQLite 拒绝覆盖最新状态。"""
        stale_version = max(0, self._appointment_draft.version - 1)
        try:
            await asyncio.to_thread(
                appointment_store.pause,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
                expected_version=stale_version,
            )
        except WorkflowConflictError:
            await publish_workflow_guard(
                context,
                self._appointment_draft,
                code="stale_version",
                expected_version=stale_version,
            )
            logger.info(
                "stale workflow write rejected: %s expected=%s current=%s",
                self._appointment_draft.workflow_id,
                stale_version,
                self._appointment_draft.version,
            )
            return "陈旧版本写入已被拒绝；任务仍保持当前审核状态。"
        raise RuntimeError("stale workflow write unexpectedly succeeded")

    async def _publish_conflict(self, context: RunContext, expected_version: int) -> None:
        current = await asyncio.to_thread(
            appointment_store.get,
            self._appointment_draft.workflow_id,
            owner_id=self._appointment_draft.owner_id,
        )
        if current is not None:
            self._appointment_draft = current
            await publish_workflow_guard(
                context,
                current,
                code="stale_version",
                expected_version=expected_version,
            )


class AppointmentApprovalAgent(Agent):
    def __init__(
        self,
        llm_model: str,
        tts_model: str,
        asr_model: str | None,
        appointment_draft: AppointmentDraft,
        *,
        resumed: bool = False,
    ) -> None:
        self._llm_model = llm_model
        self._tts_model = tts_model
        self._asr_model = asr_model
        self._appointment_draft = appointment_draft
        self._resumed = resumed
        super().__init__(
            id="appointment-approval",
            instructions=(
                "你是本地研究用人工审批门 Agent。"
                "你不能修改草稿，也不能自行决定。"
                "只有用户明确点击或表达人工批准时才调用 approve_appointment；"
                "明确拒绝时必须调用 reject_appointment 并保留拒绝原因。"
                "这是本地 identity 的审批研究，不要声称具备生产权限或正式身份认证。"
            ),
        )

    async def on_enter(self) -> None:
        prefix = "已恢复待审批任务，" if self._resumed else ""
        draft = self._appointment_draft
        await self.session.say(
            f"{prefix}任务 {draft.workflow_id} 已进入人工审批门，"
            "必须由页面上的人工批准或拒绝后才能继续。",
            allow_interruptions=False,
        )

    @function_tool
    async def approve_appointment(self, context: RunContext) -> Agent | str:
        """记录当前页面参与者的人工批准，并完成本地预约工作流。"""
        previous_version = self._appointment_draft.version
        try:
            self._appointment_draft = await asyncio.to_thread(
                appointment_store.approve,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
                expected_version=previous_version,
                actor_id=f"human:{self._appointment_draft.owner_id}",
            )
        except WorkflowConflictError:
            return "人工批准被拒绝：任务版本已经变化，请恢复最新状态。"
        await publish_workflow_state(context, self._appointment_draft)
        draft = self._appointment_draft
        logger.info("appointment approval approved: %s", draft.workflow_id)
        return MiniMaxRoomAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            appointment_draft=draft,
            entry_message=(
                f"人工已批准本地预约任务 {draft.workflow_id}。"
                "审计记录保存在本机 SQLite，不代表生产预约。"
            ),
            owner_id=draft.owner_id,
        )

    @function_tool
    async def reject_appointment(self, context: RunContext, reason: str) -> Agent | str:
        """记录当前页面参与者的人工拒绝原因，并终止本地预约工作流。"""
        previous_version = self._appointment_draft.version
        try:
            self._appointment_draft = await asyncio.to_thread(
                appointment_store.reject,
                self._appointment_draft.workflow_id,
                owner_id=self._appointment_draft.owner_id,
                expected_version=previous_version,
                actor_id=f"human:{self._appointment_draft.owner_id}",
                reason=reason,
            )
        except WorkflowConflictError:
            return "人工拒绝被拒绝：任务版本已经变化，请恢复最新状态。"
        await publish_workflow_state(context, self._appointment_draft)
        draft = self._appointment_draft
        logger.info("appointment approval rejected: %s", draft.workflow_id)
        return MiniMaxRoomAgent(
            self._llm_model,
            self._tts_model,
            self._asr_model,
            appointment_draft=draft,
            entry_message=f"人工已拒绝本地预约任务 {draft.workflow_id}：{reason}。",
            owner_id=draft.owner_id,
        )


# Capture worker registration/startup logs before the first room job arrives.
configure_file_logging()

# A single warm process is enough for this local demo and avoids spawning one
# model-importing process per CPU core before the worker can register.
MAX_CONCURRENT_JOBS = int_setting(
    "AGENT_MAX_CONCURRENT_JOBS", 2, minimum=1, maximum=8
)
FAILURE_LAB_ENABLED = bool_setting("AGENT_FAILURE_LAB_ENABLED", False)
WORKER_HTTP_PORT = int_setting("AGENT_HTTP_PORT", 8081, minimum=1024, maximum=65535)


def worker_capacity_load(agent_server: AgentServer) -> float:
    """Return deterministic local-lab load based on active room jobs."""
    return min(len(agent_server.active_jobs) / MAX_CONCURRENT_JOBS, 1.0)


server = AgentServer(
    # Windows defaults to THREAD in LiveKit Agents 1.6.8. This research worker
    # opts into PROCESS so a room Job can fail without terminating the Worker.
    job_executor_type=JobExecutorType.PROCESS,
    num_idle_processes=1,
    load_threshold=1.0,
    load_fnc=worker_capacity_load,
    port=WORKER_HTTP_PORT,
)


@server.on("worker_registered")
def on_worker_registered(worker_id, _server_info) -> None:
    READY_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = READY_PATH.with_suffix(".tmp")
    temporary_path.write_text(
        json.dumps(
            {
                "pid": os.getpid(),
                "instance_id": INSTANCE_ID,
                "worker_id": worker_id,
                "mode": "minimax-voice" if os.getenv("MIMO_API_KEY") else "minimax-text-voice",
                "agent_name": DISPATCH_AGENT_NAME,
                "max_concurrent_jobs": MAX_CONCURRENT_JOBS,
                "load_threshold": 1.0,
                "load_policy": "active-jobs",
                "job_executor": "process",
                "failure_lab_enabled": FAILURE_LAB_ENABLED,
                "http_port": WORKER_HTTP_PORT,
                "status_url": f"http://127.0.0.1:{WORKER_HTTP_PORT}/worker",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    temporary_path.replace(READY_PATH)
    logger.info("worker registered: %s / %s", INSTANCE_ID, worker_id)


@server.rtc_session(agent_name=DISPATCH_AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    configure_file_logging()
    logger.info("entrypoint started for room %s", ctx.room.name)
    workflow_participant = await ctx.wait_for_participant()
    workflow_owner_id = workflow_participant.identity
    logger.info("workflow owner scope: %s", workflow_owner_id)
    api_key = os.environ["MINIMAX_API_KEY"]
    llm_model = os.getenv("MINIMAX_LLM_MODEL", "MiniMax-M3")
    llm_base_url = os.getenv(
        "MINIMAX_LLM_BASE_URL", "https://api.minimaxi.com/anthropic"
    )
    tts_base_url = os.getenv("MINIMAX_BASE_URL", "https://api.minimaxi.com")
    tts_model = os.getenv("MINIMAX_TTS_MODEL", "speech-2.8-turbo")
    tts_voice = os.getenv("MINIMAX_TTS_VOICE", "male-qn-qingse")
    mimo_api_key = os.getenv("MIMO_API_KEY")
    asr_model = os.getenv("MIMO_ASR_MODEL", "mimo-v2.5-asr") if mimo_api_key else None
    asr_base_url = os.getenv("MIMO_ASR_BASE_URL", "https://api.xiaomimimo.com/v1")
    asr_language = os.getenv("MIMO_ASR_LANGUAGE", "zh")
    asr_stream_output = bool_setting("MIMO_ASR_STREAM_OUTPUT", True)
    min_silence_duration = float_setting(
        "AGENT_MIN_SILENCE_SECONDS", 0.8, minimum=0.4, maximum=2.0
    )

    speech_to_text = None
    voice_activity_detector = None
    if mimo_api_key:
        speech_to_text = XiaomiMiMoSTT(
            api_key=mimo_api_key,
            model=asr_model or "mimo-v2.5-asr",
            language=asr_language,
            base_url=asr_base_url,
            stream_output=asr_stream_output,
        )
        voice_activity_detector = silero.VAD.load(
            min_speech_duration=0.1,
            min_silence_duration=min_silence_duration,
            prefix_padding_duration=0.3,
        )
        logger.info(
            "Xiaomi MiMo ASR enabled: model=%s language=%s min_silence=%.1fs output=%s",
            asr_model,
            asr_language,
            min_silence_duration,
            "sse" if asr_stream_output else "single-response",
        )
    else:
        logger.info("MIMO_API_KEY not set; microphone recognition remains disabled")

    vision_llm = anthropic.LLM(
        model=llm_model,
        api_key=api_key,
        base_url=llm_base_url,
        _strict_tool_schema=False,
    )
    session_options = {
        "llm": vision_llm,
        "tts": minimax.TTS(
            model=tts_model,
            voice=tts_voice,
            language_boost="Chinese",
            audio_format="pcm",
            api_key=api_key,
            base_url=tts_base_url,
        ),
    }
    if speech_to_text and voice_activity_detector:
        session_options["stt"] = speech_to_text
        session_options["vad"] = voice_activity_detector
    session = AgentSession(
        transcription_timeout=15.0,
        turn_handling={
            "interruption": {
                "enabled": False,
                "discard_audio_if_uninterruptible": True,
            },
            "preemptive_generation": {"enabled": False},
        },
        **session_options,
    )
    pending_tasks: set[asyncio.Task[None]] = set()
    session_ready = asyncio.Event()
    text_turn_lock = asyncio.Lock()
    text_turn_active = asyncio.Event()
    video_tasks: dict[str, asyncio.Task[None]] = {}
    latest_video_frame: rtc.VideoFrame | None = None
    latest_video_metadata: dict[str, object] = {}
    turn_counter = 0
    current_turn_id: str | None = None
    turn_has_terminal_error = False

    def on_background_task_done(task: asyncio.Task[None]) -> None:
        pending_tasks.discard(task)
        if not task.cancelled() and (error := task.exception()) is not None:
            logger.error("background room task failed: %s", error)

    async def publish_room_event(payload: dict[str, object]) -> None:
        payload.setdefault("timestamp", time.time())
        logged_payload = dict(payload)
        if (
            logged_payload.get("type") == "visual_semantics"
            and logged_payload.get("experiment") == "camera"
            and logged_payload.get("answer_preview")
        ):
            logged_payload["answer_preview"] = "[redacted camera description]"
        logger.info(
            "room event: %s",
            json.dumps(logged_payload, ensure_ascii=False, sort_keys=True),
        )
        await ctx.room.local_participant.publish_data(
            json.dumps(payload, ensure_ascii=False),
            topic="local-agent-status",
        )

    def schedule_room_event(payload: dict[str, object]) -> None:
        task = asyncio.create_task(publish_room_event(payload))
        pending_tasks.add(task)
        task.add_done_callback(on_background_task_done)

    async def observe_video_track(
        track: rtc.RemoteTrack,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        nonlocal latest_video_frame, latest_video_metadata
        stream = rtc.VideoStream.from_track(track=track)
        frame_count = 0
        last_reported_at = 0.0
        source = rtc.TrackSource.Name(publication.source).removeprefix("SOURCE_").lower()
        try:
            async for event in stream:
                frame = event.frame
                # LiveKit/WebRTC may emit a tiny teardown sentinel while a
                # video publication is closing. It is not a user video frame.
                if frame.width < 16 or frame.height < 16:
                    continue
                frame_count += 1
                # Keep an owned copy: the native stream may recycle its receive buffer.
                latest_video_frame = rtc.VideoFrame(
                    width=frame.width,
                    height=frame.height,
                    type=frame.type,
                    data=bytes(frame.data),
                )
                received_at = time.time()
                frame_hash = hashlib.sha256(bytes(frame.data)).hexdigest()[:12]
                latest_video_metadata = {
                    "participant_identity": participant.identity,
                    "track_sid": publication.sid,
                    "source": source,
                    "width": frame.width,
                    "height": frame.height,
                    "frame_count": frame_count,
                    "frame_hash": frame_hash,
                    "received_at": received_at,
                }
                if frame_count == 1 or received_at - last_reported_at >= 1.0:
                    last_reported_at = received_at
                    await publish_room_event(
                        {
                            "type": "visual_frame",
                            "phase": "received",
                            **latest_video_metadata,
                        }
                    )
        except asyncio.CancelledError:
            raise
        finally:
            await stream.aclose()

    async def analyze_latest_video_frame(
        participant_identity: str,
        experiment: str = "deterministic",
    ) -> None:
        nonlocal turn_has_terminal_error
        await session_ready.wait()
        async with text_turn_lock:
            if latest_video_frame is None:
                await publish_room_event(
                    {
                        "type": "visual_semantics",
                        "phase": "no_frame",
                        "model": llm_model,
                    }
                )
                return
            text_turn_active.set()
            turn_has_terminal_error = False
            metadata = dict(latest_video_metadata)
            # Snapshot both the bytes and metadata so a newer video frame cannot
            # change this deterministic visual turn while it is in flight.
            frame = rtc.VideoFrame(
                width=latest_video_frame.width,
                height=latest_video_frame.height,
                type=latest_video_frame.type,
                data=bytes(latest_video_frame.data),
            )
            await publish_room_event(
                {
                    "type": "visual_semantics",
                    "phase": "analyzing",
                    "model": llm_model,
                    "frame_hash": metadata.get("frame_hash"),
                    "experiment": experiment,
                }
            )
            try:
                async with session._claim_user_turn():
                    visual_prompt = (
                        "请直接观察这张摄像头图片，用一句中文客观描述当前可见的主要人物或物体、场景和动作。"
                        "不要根据上下文猜测；看不清的内容请明确说看不清。"
                        if experiment == "camera"
                        else "这是一个确定性的视觉能力实验。请直接观察图片，只用一句中文依次说出："
                        "主要图形的颜色、图形形状、画面中的三位数字。不要根据上下文猜测。"
                    )
                    visual_message = llm.ChatMessage(
                        role="user",
                        content=[
                            visual_prompt,
                            llm.ImageContent(
                                image=frame,
                                inference_width=640,
                                inference_height=360,
                            ),
                        ],
                    )
                    llm_started_at = time.perf_counter()
                    stream = vision_llm.chat(
                        chat_ctx=llm.ChatContext(items=[visual_message]),
                        tools=list(),
                        tool_choice="none",
                    )
                    answer_parts: list[str] = []
                    async with stream:
                        async for chunk in stream:
                            content = chunk.delta.content if chunk.delta else None
                            if content:
                                answer_parts.append(content)
                    answer = "".join(answer_parts).strip()
                    if experiment == "camera":
                        checks: dict[str, bool] = {}
                        semantic_phase = "described" if answer else "partial"
                    else:
                        normalized = answer.lower()
                        checks = {
                            "orange": "橙" in answer or "orange" in normalized,
                            "triangle": "三角" in answer or "triangle" in normalized,
                            "code_742": "742" in answer,
                        }
                        semantic_phase = "verified" if all(checks.values()) else "partial"
                    await publish_room_event(
                        {
                            "type": "visual_semantics",
                            "phase": semantic_phase,
                            "model": llm_model,
                            "frame_hash": metadata.get("frame_hash"),
                            "checks": checks,
                            "experiment": experiment,
                            "answer_preview": answer[:240],
                            "requested_by": participant_identity,
                            "llm_latency_ms": round(
                                (time.perf_counter() - llm_started_at) * 1000
                            ),
                        }
                    )
                    if answer:
                        speech = session.say(
                            answer,
                            allow_interruptions=False,
                            add_to_chat_ctx=True,
                        )
                        await speech
            except Exception as error:
                logger.error(
                    "visual analysis failed: %s: %s",
                    type(error).__name__,
                    error,
                )
                await publish_room_event(
                    {
                        "type": "visual_semantics",
                        "phase": "rejected",
                        "model": llm_model,
                        "frame_hash": metadata.get("frame_hash"),
                        "experiment": experiment,
                        "error": type(error).__name__,
                    }
                )
            finally:
                text_turn_active.clear()

    @ctx.room.on("track_subscribed")
    def on_visual_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        if (
            participant.identity != workflow_owner_id
            or track.kind != rtc.TrackKind.KIND_VIDEO
            or publication.source
            not in {
                rtc.TrackSource.SOURCE_CAMERA,
                rtc.TrackSource.SOURCE_SCREENSHARE,
            }
        ):
            return
        if previous := video_tasks.pop(publication.sid, None):
            previous.cancel()
        task = asyncio.create_task(observe_video_track(track, publication, participant))
        video_tasks[publication.sid] = task
        pending_tasks.add(task)
        task.add_done_callback(on_background_task_done)
        logger.info(
            "visual track subscribed: participant=%s sid=%s source=%s",
            participant.identity,
            publication.sid,
            rtc.TrackSource.Name(publication.source),
        )

    @ctx.room.on("track_unpublished")
    def on_visual_track_unpublished(
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        nonlocal latest_video_frame, latest_video_metadata
        if participant.identity != workflow_owner_id or publication.sid not in video_tasks:
            return
        if task := video_tasks.pop(publication.sid, None):
            task.cancel()
        latest_video_frame = None
        latest_video_metadata = {}
        schedule_room_event(
            {
                "type": "visual_frame",
                "phase": "stopped",
                "track_sid": publication.sid,
            }
        )

    async def publish_initial_state() -> None:
        # A participant-connected notification can arrive a few milliseconds
        # before its data channel is ready. Repeat this small idempotent state
        # packet once so newly joined clients do not miss the interaction mode.
        for delay in (0.0, 0.75):
            if delay:
                await asyncio.sleep(delay)
            await publish_room_event(
                {
                    "type": "agent_config",
                    "mode": "stable-turn",
                    "min_silence_duration": min_silence_duration,
                    "asr_input_mode": "complete-utterance",
                    "asr_output_mode": "sse" if asr_stream_output else "single-response",
                    "active_agent": session.current_agent.id,
                    "workflow_owner_id": workflow_owner_id,
                    "dispatch_mode": "explicit" if DISPATCH_AGENT_NAME else "automatic",
                    "dispatch_agent_name": ctx.job.agent_name,
                    "dispatch_id": ctx.job.dispatch_id,
                    "dispatch_job_id": ctx.job.id,
                    "dispatch_worker_id": ctx.worker_id,
                    "max_concurrent_jobs": MAX_CONCURRENT_JOBS,
                    "job_executor": "process",
                    "failure_lab_enabled": FAILURE_LAB_ENABLED,
                    "worker_instance_id": INSTANCE_ID,
                }
            )
            await publish_room_event({"type": "agent_status", "phase": "ready"})

    @session.on("user_state_changed")
    def on_user_state_changed(event) -> None:
        nonlocal turn_has_terminal_error
        # _claim_user_turn() also toggles the SDK user state for data-text
        # messages. The browser already owns that turn's "thinking" state;
        # exposing those synthetic transitions as microphone states would
        # produce a late "transcribing" lock after the text reply completed.
        if text_turn_active.is_set():
            return
        if event.new_state == "speaking":
            turn_has_terminal_error = False
            schedule_room_event({"type": "agent_status", "phase": "listening"})
        elif event.old_state == "speaking" and event.new_state == "listening":
            schedule_room_event({"type": "agent_status", "phase": "transcribing"})

    @session.on("user_input_transcribed")
    def on_user_input_transcribed(event) -> None:
        nonlocal turn_has_terminal_error
        if event.is_final and event.transcript.strip():
            turn_has_terminal_error = False
            schedule_room_event({"type": "agent_status", "phase": "thinking"})

    @session.on("agent_state_changed")
    def on_agent_state_changed(event) -> None:
        if event.new_state in {"thinking", "speaking"}:
            schedule_room_event({"type": "agent_status", "phase": event.new_state})
        elif event.new_state in {"idle", "listening"} and event.old_state in {
            "initializing",
            "thinking",
            "speaking",
        } and not turn_has_terminal_error:
            schedule_room_event({"type": "agent_status", "phase": "ready"})

    @session.on("conversation_item_added")
    def on_conversation_item_added(event) -> None:
        nonlocal current_turn_id, turn_counter
        item = event.item
        if getattr(item, "type", None) == "agent_handoff":
            if item.old_agent_id is None:
                return
            schedule_room_event(
                {
                    "type": "capability_event",
                    "capability": "agent_handoff",
                    "phase": "completed",
                    "from_agent": item.old_agent_id,
                    "to_agent": item.new_agent_id,
                }
            )
            return
        role = getattr(item, "role", None)
        if role == "user":
            turn_counter += 1
            current_turn_id = f"turn-{turn_counter}"
        if role not in {"user", "assistant"} or current_turn_id is None:
            return
        metrics = dict(getattr(item, "metrics", {}) or {})
        schedule_room_event(
            {
                "type": "turn_metrics",
                "turn_id": current_turn_id,
                "role": role,
                "metrics": metrics,
            }
        )

    @session.on("function_tools_executed")
    def on_function_tools_executed(event) -> None:
        schedule_room_event(
            {
                "type": "capability_event",
                "capability": "function_tool",
                "phase": "completed",
                "tools": [call.name for call in event.function_calls],
                "has_agent_handoff": event.has_agent_handoff,
            }
        )

    @session.on("user_transcription_timeout")
    def on_user_transcription_timeout(_event) -> None:
        schedule_room_event(
            {"type": "agent_error", "stage": "asr", "code": "no_transcript"}
        )

    @ctx.room.on("data_received")
    def on_data_received(packet) -> None:
        nonlocal turn_has_terminal_error
        if not packet.participant:
            return
        if packet.topic == "local-agent-failure-lab":
            if not FAILURE_LAB_ENABLED or packet.participant.identity != workflow_owner_id:
                logger.warning(
                    "ignored failure-lab request from %s (enabled=%s)",
                    packet.participant.identity,
                    FAILURE_LAB_ENABLED,
                )
                return
            try:
                request = json.loads(packet.data.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                logger.warning("ignored invalid failure-lab packet")
                return
            if request.get("action") != "crash-job":
                return

            async def crash_current_job() -> None:
                await publish_room_event(
                    {
                        "type": "failure_lab",
                        "phase": "armed",
                        "job_id": ctx.job.id,
                        "worker_id": ctx.worker_id,
                        "executor": "process",
                        "exit_code": 70,
                    }
                )
                # Give LiveKit's reliable data packet time to leave this child.
                await asyncio.sleep(0.5)
                logger.critical("failure lab terminating job process: %s", ctx.job.id)
                os._exit(70)

            task = asyncio.create_task(crash_current_job())
            pending_tasks.add(task)
            task.add_done_callback(on_background_task_done)
            return
        if packet.topic == "local-agent-visual-lab":
            if packet.participant.identity != workflow_owner_id:
                logger.warning(
                    "ignored visual-lab request from non-owner %s",
                    packet.participant.identity,
                )
                return
            try:
                request = json.loads(packet.data.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                logger.warning("ignored invalid visual-lab packet")
                return
            if request.get("action") != "analyze-latest-frame":
                return
            experiment = (
                "camera" if request.get("experiment") == "camera" else "deterministic"
            )
            task = asyncio.create_task(
                analyze_latest_video_frame(packet.participant.identity, experiment)
            )
            pending_tasks.add(task)
            task.add_done_callback(on_background_task_done)
            return
        if packet.topic != "local-agent-chat":
            return
        try:
            text = packet.data.decode("utf-8").strip()
        except UnicodeDecodeError:
            logger.warning("ignored non-UTF-8 local-agent-chat packet")
            return
        if not text:
            return
        turn_has_terminal_error = False
        task = asyncio.create_task(
            handle_user_text(
                session,
                session_ready,
                text_turn_lock,
                text_turn_active,
                packet.participant.identity,
                text,
            )
        )
        pending_tasks.add(task)
        task.add_done_callback(on_background_task_done)

    @session.on("error")
    def on_error(event) -> None:
        nonlocal turn_has_terminal_error
        logger.error("AgentSession error: %s", event)
        if isinstance(event.source, stt.STT):
            stage = "asr"
        elif isinstance(event.source, tts.TTS):
            stage = "tts"
        elif isinstance(event.source, llm.LLM):
            stage = "llm"
        else:
            stage = "llm"
        if bool(getattr(event.error, "recoverable", False)):
            schedule_room_event(
                {"type": "agent_retrying", "stage": stage, "code": "provider_retry"}
            )
            return
        turn_has_terminal_error = True
        schedule_room_event({"type": "agent_error", "stage": stage, "code": "provider_error"})

    await session.start(
        agent=MiniMaxRoomAgent(
            llm_model,
            tts_model,
            asr_model,
            owner_id=workflow_owner_id,
        ),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=bool(speech_to_text),
            audio_output=True,
            text_input=False,
            text_output=room_io.TextOutputOptions(sync_transcription=True),
            close_on_disconnect=True,
            delete_room_on_close=True,
        ),
    )
    session_ready.set()
    initial_state_task = asyncio.create_task(publish_initial_state())
    pending_tasks.add(initial_state_task)
    initial_state_task.add_done_callback(on_background_task_done)
    logger.info("AgentSession started")


if __name__ == "__main__":
    cli.run_app(server)
