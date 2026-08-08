from __future__ import annotations

import asyncio
import json
import time

from livekit import rtc

from local_demo_server import build_participant_token


async def run_smoke() -> dict[str, object]:
    room = rtc.Room()
    response_ready = asyncio.Event()
    agent_ready = asyncio.Event()
    transcript_parts: dict[str, str] = {}
    reader_tasks: set[asyncio.Task[None]] = set()

    def on_agent_text(reader: rtc.TextStreamReader, participant_identity: str) -> None:
        if "agent" not in participant_identity.lower():
            return

        async def read_stream() -> None:
            text = await reader.read_all()
            transcript_parts[reader.info.stream_id] = text
            if "已连接" in "".join(transcript_parts.values()):
                response_ready.set()

        task = asyncio.create_task(read_stream())
        reader_tasks.add(task)
        task.add_done_callback(reader_tasks.discard)

    room.register_text_stream_handler("lk.transcription", on_agent_text)

    @room.on("transcription_received")
    def on_transcription(segments, participant, _publication) -> None:
        if not participant or "agent" not in participant.identity.lower():
            return
        for segment in segments:
            transcript_parts[segment.id] = segment.text
            if segment.final:
                response_ready.set()

    @room.on("participant_connected")
    def on_participant_connected(participant) -> None:
        if "agent" in participant.identity.lower():
            agent_ready.set()

    token = build_participant_token(
        room_name="local-demo",
        identity=f"smoke-{int(time.time())}",
        display_name="Integration Smoke Test",
    )
    await room.connect("ws://127.0.0.1:7880", token)
    try:
        if any("agent" in identity.lower() for identity in room.remote_participants):
            agent_ready.set()
        try:
            await asyncio.wait_for(agent_ready.wait(), timeout=12)
        except asyncio.TimeoutError as exc:
            raise RuntimeError("本地 Agent 没有在 12 秒内加入 local-demo 房间") from exc

        # Let the Agent-side participant event settle before opening a text stream.
        await asyncio.sleep(2.0)
        await room.local_participant.publish_data("请检查房间状态", topic="local-agent-chat")
        await asyncio.wait_for(response_ready.wait(), timeout=12)
        response = "".join(transcript_parts.values()).strip()
        if "房间" not in response or "已连接" not in response:
            raise RuntimeError(f"Agent 返回内容不符合预期：{response}")
        return {
            "livekit_connected": True,
            "agent_present": True,
            "text_stream_sent": True,
            "agent_response": response,
            "passed": True,
        }
    finally:
        await room.disconnect()


def main() -> int:
    try:
        result = asyncio.run(run_smoke())
    except Exception as exc:
        result = {"passed": False, "error": str(exc)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
