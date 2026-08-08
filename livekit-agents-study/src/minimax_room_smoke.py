from __future__ import annotations

import asyncio
import json
import os
import time

from livekit import rtc

from local_demo_server import (
    build_participant_token,
    create_or_get_dispatch,
    list_room_dispatches,
    serialize_dispatch,
)


async def wait_for(event: asyncio.Event, timeout: float, label: str) -> None:
    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
    except asyncio.TimeoutError as exc:
        raise RuntimeError(f"等待{label}超时（{timeout:.0f} 秒）") from exc


async def run_smoke() -> dict[str, object]:
    room_name = f"minimax-smoke-{int(time.time())}"
    room = rtc.Room()
    agent_ready = asyncio.Event()
    response_ready = asyncio.Event()
    audio_ready = asyncio.Event()
    config_ready = asyncio.Event()
    assistant_metrics_ready = asyncio.Event()
    transcript_parts: dict[str, str] = {}
    agent_events: list[dict[str, object]] = []
    reader_tasks: set[asyncio.Task[None]] = set()
    audio_tasks: set[asyncio.Task[None]] = set()

    def on_agent_text(reader: rtc.TextStreamReader, participant_identity: str) -> None:
        if "agent" not in participant_identity.lower():
            return

        async def read_stream() -> None:
            text = await reader.read_all()
            transcript_parts[reader.info.stream_id] = text
            if text.strip():
                response_ready.set()

        task = asyncio.create_task(read_stream())
        reader_tasks.add(task)
        task.add_done_callback(reader_tasks.discard)

    async def read_audio(track: rtc.Track) -> None:
        stream = rtc.AudioStream(track)
        try:
            async for _event in stream:
                audio_ready.set()
                break
        finally:
            await stream.aclose()

    room.register_text_stream_handler("lk.transcription", on_agent_text)

    @room.on("data_received")
    def on_data_received(packet: rtc.DataPacket) -> None:
        if packet.topic != "local-agent-status" or packet.participant is None:
            return
        if "agent" not in packet.participant.identity.lower():
            return
        try:
            event = json.loads(packet.data)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return
        if not isinstance(event, dict):
            return
        agent_events.append(event)
        if event.get("type") == "agent_config":
            config_ready.set()
        if event.get("type") == "turn_metrics" and event.get("role") == "assistant":
            assistant_metrics_ready.set()

    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        if "agent" in participant.identity.lower():
            agent_ready.set()

    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        _publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        if "agent" not in participant.identity.lower() or track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        task = asyncio.create_task(read_audio(track))
        audio_tasks.add(task)
        task.add_done_callback(audio_tasks.discard)

    token = build_participant_token(
        room_name=room_name,
        identity=f"minimax-smoke-client-{int(time.time())}",
        display_name="MiniMax Integration Smoke",
    )
    await room.connect("ws://127.0.0.1:7880", token)
    try:
        dispatch, dispatch_created = await create_or_get_dispatch(
            livekit_url="ws://127.0.0.1:7880",
            api_key="devkey",
            api_secret="secret",
            agent_name=os.getenv("LIVEKIT_AGENT_NAME", "livekit-research-minimax"),
            room_name=room_name,
            requester_identity=room.local_participant.identity,
        )
        await wait_for(agent_ready, 20, "MiniMax Agent 入房")
        await wait_for(config_ready, 20, "Agent 稳定单轮配置")
        config_event = next(event for event in agent_events if event.get("type") == "agent_config")
        if config_event.get("dispatch_id") != dispatch.id:
            raise RuntimeError("Agent JobContext 回报的 dispatch ID 与创建结果不一致")
        current_dispatch = dispatch
        for _attempt in range(10):
            current_dispatches = await list_room_dispatches(
                livekit_url="ws://127.0.0.1:7880",
                api_key="devkey",
                api_secret="secret",
                room_name=room_name,
            )
            current_dispatch = next(item for item in current_dispatches if item.id == dispatch.id)
            if current_dispatch.state.jobs:
                break
            await asyncio.sleep(0.2)
        await asyncio.sleep(1.0)
        prompt = "请调用房间状态工具，然后只用一句中文回答当前房间名和参与者人数。"
        await room.local_participant.publish_data(prompt, topic="local-agent-chat")
        await wait_for(response_ready, 90, "MiniMax 文字回复")
        await wait_for(audio_ready, 90, "Speech 2.8 音频")
        await wait_for(assistant_metrics_ready, 20, "同轮耗时指标")
        response = "".join(transcript_parts.values()).strip()
        if room_name not in response:
            raise RuntimeError(f"MiniMax 回答未包含真实房间名：{response}")
        return {
            "livekit_connected": True,
            "agent_present": True,
            "explicit_dispatch": serialize_dispatch(current_dispatch),
            "dispatch_created": dispatch_created,
            "agent_job_context": {
                "dispatch_id": config_event.get("dispatch_id"),
                "agent_name": config_event.get("dispatch_agent_name"),
                "job_id": config_event.get("dispatch_job_id"),
                "worker_id": config_event.get("dispatch_worker_id"),
            },
            "minimax_text_received": True,
            "minimax_audio_received": True,
            "room_status_tool_verified": True,
            "stable_turn_mode_received": any(
                event.get("type") == "agent_config"
                and event.get("mode") == "stable-turn"
                and event.get("min_silence_duration") == 0.8
                for event in agent_events
            ),
            "processing_states_received": sorted(
                {
                    str(event.get("phase"))
                    for event in agent_events
                    if event.get("type") == "agent_status"
                }
            ),
            "turn_metrics_received": True,
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
