from __future__ import annotations

import json
import logging
import asyncio
from pathlib import Path

from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RunContext,
    cli,
    function_tool,
    room_io,
)

from offline_agent_demo import ScriptedLLM


LOG_PATH = Path(__file__).resolve().parent.parent / ".local-state" / "text-agent.log"
logger = logging.getLogger("local_text_agent")


def configure_file_logging() -> None:
    logger.propagate = False
    sdk_logger = logging.getLogger("livekit.agents")
    sdk_logger.propagate = False
    if any(isinstance(handler, logging.FileHandler) for handler in logger.handlers):
        return
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    handler.setLevel(logging.DEBUG)
    logger.setLevel(logging.DEBUG)
    logger.addHandler(handler)
    if handler not in sdk_logger.handlers:
        sdk_logger.addHandler(handler)


async def handle_user_text(session: AgentSession, participant_identity: str, text: str) -> None:
    logger.info("text input from %s: %s", participant_identity, text)
    async with session._claim_user_turn():
        await session.interrupt()
        session.generate_reply(user_input=text)


class LocalRoomAssistant(Agent):
    """Credential-free text Agent that reads the real LiveKit room state."""

    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "你是本地 LiveKit 房间中的确定性演示 Agent。"
                "收到文字后调用工具读取真实参与者状态，再用中文简洁回答。"
            )
        )

    @function_tool
    async def get_room_status(self, context: RunContext, room_name: str) -> str:
        """读取当前连接的真实 LiveKit 房间状态。

        Args:
            room_name: 要检查的房间名称。
        """
        room = context.session.room_io.room
        participants = [room.local_participant.identity]
        participants.extend(participant.identity for participant in room.remote_participants.values())
        payload = {
            "room": room.name or room_name,
            "participants": sorted(participants),
            "participant_count": len(participants),
        }
        return json.dumps(payload, ensure_ascii=False, sort_keys=True)


server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    configure_file_logging()
    logger.info("entrypoint started for room %s", ctx.room.name)
    session = AgentSession(llm=ScriptedLLM())
    pending_tasks: set[asyncio.Task[None]] = set()

    @ctx.room.on("data_received")
    def on_data_received(packet) -> None:
        logger.info(
            "data packet topic=%s participant=%s bytes=%s",
            packet.topic,
            getattr(packet.participant, "identity", None),
            len(packet.data),
        )
        if packet.topic != "local-agent-chat" or not packet.participant:
            return
        try:
            text = packet.data.decode("utf-8").strip()
        except UnicodeDecodeError:
            logger.warning("ignored non-UTF-8 local-agent-chat packet")
            return
        if not text:
            return
        task = asyncio.create_task(handle_user_text(session, packet.participant.identity, text))
        pending_tasks.add(task)
        task.add_done_callback(pending_tasks.discard)

    @session.on("error")
    def on_error(event) -> None:
        logger.error("AgentSession error: %s", event)

    @session.on("conversation_item_added")
    def on_conversation_item(event) -> None:
        logger.info("conversation item: %s", event.item.type)

    await session.start(
        agent=LocalRoomAssistant(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=False,
            audio_output=False,
            text_input=False,
            text_output=room_io.TextOutputOptions(sync_transcription=False),
            close_on_disconnect=True,
            delete_room_on_close=True,
        ),
    )
    logger.info("AgentSession started")


if __name__ == "__main__":
    cli.run_app(server)
