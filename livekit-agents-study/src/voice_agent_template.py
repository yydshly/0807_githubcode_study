"""Real voice Agent for the self-hosted LiveKit room.

The media server stays local. Audio intelligence uses OpenAI Realtime and is
only started when OPENAI_API_KEY is provided by the user.
"""

import asyncio
import json
import logging
import os

from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RunContext,
    cli,
    function_tool,
)
from livekit.plugins import openai


logger = logging.getLogger("voice_agent_template")


async def handle_user_text(
    session: AgentSession,
    session_ready: asyncio.Event,
    participant_identity: str,
    text: str,
) -> None:
    """Route the demo page's LiveKit data message into the realtime session."""
    await session_ready.wait()
    logger.info("text input from %s: %s", participant_identity, text)
    async with session._claim_user_turn():
        await session.interrupt()
        session.generate_reply(user_input=text)


class ChineseRoomAgent(Agent):
    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        super().__init__(
            instructions=(
                "你是加入 LiveKit 房间的中文语音助手。"
                "回答简洁、自然；需要房间状态时必须调用工具。"
            )
        )

    async def on_enter(self) -> None:
        self.session.generate_reply(instructions="用中文简短问候用户。")

    @function_tool
    async def get_service_status(self, context: RunContext) -> str:
        """读取演示服务状态。"""
        room = context.session.room_io.room
        participants = [room.local_participant.identity]
        participants.extend(participant.identity for participant in room.remote_participants.values())
        return json.dumps(
            {
                "livekit_connected": room.isconnected(),
                "room": room.name,
                "participants": sorted(participants),
                "model_type": f"OpenAI Realtime / {self._model_name}",
            },
            ensure_ascii=False,
            sort_keys=True,
        )


server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    model_name = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime-2.1")
    voice_name = os.getenv("OPENAI_REALTIME_VOICE", "marin")
    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model=model_name,
            voice=voice_name,
        )
    )
    pending_tasks: set[asyncio.Task[None]] = set()
    session_ready = asyncio.Event()

    def on_text_task_done(task: asyncio.Task[None]) -> None:
        pending_tasks.discard(task)
        if not task.cancelled() and (error := task.exception()) is not None:
            logger.error("failed to handle local-agent-chat: %s", error)

    @ctx.room.on("data_received")
    def on_data_received(packet) -> None:
        if packet.topic != "local-agent-chat" or not packet.participant:
            return
        try:
            text = packet.data.decode("utf-8").strip()
        except UnicodeDecodeError:
            logger.warning("ignored non-UTF-8 local-agent-chat packet")
            return
        if not text:
            return
        task = asyncio.create_task(
            handle_user_text(session, session_ready, packet.participant.identity, text)
        )
        pending_tasks.add(task)
        task.add_done_callback(on_text_task_done)

    await session.start(agent=ChineseRoomAgent(model_name), room=ctx.room)
    session_ready.set()


if __name__ == "__main__":
    cli.run_app(server)
