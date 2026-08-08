from __future__ import annotations

import asyncio
import json
import os
import time

from PIL import Image, ImageDraw, ImageFont
from livekit import rtc

from local_demo_server import build_participant_token, create_or_get_dispatch


WIDTH = 640
HEIGHT = 360


async def wait_for(event: asyncio.Event, timeout: float, label: str) -> None:
    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
    except asyncio.TimeoutError as exc:
        raise RuntimeError(f"等待{label}超时（{timeout:.0f} 秒）") from exc


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "DejaVuSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def build_test_frame() -> rtc.VideoFrame:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#111827")
    draw = ImageDraw.Draw(image)
    for x in range(0, WIDTH + 1, 40):
        draw.line((x, 0, x, HEIGHT), fill="#293244", width=1)
    for y in range(0, HEIGHT + 1, 40):
        draw.line((0, y, WIDTH, y), fill="#293244", width=1)
    draw.polygon(((170, 64), (292, 274), (48, 274)), fill="#f97316")
    draw.text((342, 74), "LIVEKIT", fill="#f8fafc", font=load_font(34))
    draw.text((338, 132), "742", fill="#f8fafc", font=load_font(92))
    draw.text((342, 278), "PHASE 11", fill="#94a3b8", font=load_font(18))
    return rtc.VideoFrame(
        width=WIDTH,
        height=HEIGHT,
        type=rtc.VideoBufferType.RGB24,
        data=image.tobytes(),
    )


async def run_smoke() -> dict[str, object]:
    timestamp = int(time.time())
    experiment = os.getenv("MINIMAX_VISUAL_EXPERIMENT", "deterministic").strip()
    if experiment not in {"deterministic", "camera"}:
        raise ValueError("MINIMAX_VISUAL_EXPERIMENT must be deterministic or camera")
    room_name = f"minimax-visual-smoke-{timestamp}"
    identity = f"minimax-visual-client-{timestamp}"
    room = rtc.Room()
    agent_ready = asyncio.Event()
    config_ready = asyncio.Event()
    frame_ready = asyncio.Event()
    semantics_ready = asyncio.Event()
    transcript_ready = asyncio.Event()
    agent_events: list[dict[str, object]] = []
    transcript_parts: dict[str, str] = {}
    reader_tasks: set[asyncio.Task[None]] = set()
    capture_task: asyncio.Task[None] | None = None
    video_publication: rtc.LocalTrackPublication | None = None

    def on_agent_text(reader: rtc.TextStreamReader, participant_identity: str) -> None:
        if "agent" not in participant_identity.lower():
            return

        async def read_stream() -> None:
            text = await reader.read_all()
            transcript_parts[reader.info.stream_id] = text
            if text.strip():
                transcript_ready.set()

        task = asyncio.create_task(read_stream())
        reader_tasks.add(task)
        task.add_done_callback(reader_tasks.discard)

    room.register_text_stream_handler("lk.transcription", on_agent_text)

    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        if "agent" in participant.identity.lower():
            agent_ready.set()

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
        if event.get("type") == "visual_frame" and event.get("phase") == "received":
            frame_ready.set()
        if event.get("type") == "visual_semantics" and event.get("phase") in {
            "verified",
            "described",
            "partial",
            "rejected",
            "no_frame",
        }:
            semantics_ready.set()
            if event.get("phase") in {"rejected", "no_frame"}:
                # Unblock the sequential transcript wait so provider failures
                # are reported immediately instead of looking like a timeout.
                transcript_ready.set()

    token = build_participant_token(
        room_name=room_name,
        identity=identity,
        display_name="MiniMax Visual Integration Smoke",
    )
    await room.connect("ws://127.0.0.1:7880", token)
    try:
        dispatch, dispatch_created = await create_or_get_dispatch(
            livekit_url="ws://127.0.0.1:7880",
            api_key="devkey",
            api_secret="secret",
            agent_name=os.getenv("LIVEKIT_AGENT_NAME", "livekit-research-minimax"),
            room_name=room_name,
            requester_identity=identity,
        )
        await wait_for(agent_ready, 20, "MiniMax Agent 入房")
        await wait_for(config_ready, 20, "Agent 配置")

        video_source = rtc.VideoSource(WIDTH, HEIGHT)
        video_track = rtc.LocalVideoTrack.create_video_track(
            "phase-11-synthetic-vision", video_source
        )
        publish_options = rtc.TrackPublishOptions()
        publish_options.source = rtc.TrackSource.SOURCE_CAMERA
        video_publication = await room.local_participant.publish_track(
            video_track, publish_options
        )
        frame = build_test_frame()

        async def publish_frames() -> None:
            while True:
                video_source.capture_frame(frame)
                await asyncio.sleep(0.25)

        capture_task = asyncio.create_task(publish_frames())
        await wait_for(frame_ready, 20, "Agent 视频帧证据")
        await room.local_participant.publish_data(
            json.dumps(
                {
                    "action": "analyze-latest-frame",
                    "experiment": experiment,
                }
            ),
            topic="local-agent-visual-lab",
        )
        await wait_for(transcript_ready, 90, "MiniMax 视觉文字回复")
        await wait_for(semantics_ready, 90, "MiniMax 视觉校验事件")

        semantic_event = next(
            event
            for event in reversed(agent_events)
            if event.get("type") == "visual_semantics"
            and event.get("phase")
            in {"verified", "described", "partial", "rejected", "no_frame"}
        )
        if semantic_event.get("phase") in {"rejected", "no_frame"}:
            raise RuntimeError(
                "MiniMax visual analysis failed: "
                f"{semantic_event.get('error') or semantic_event.get('phase')}"
            )
        analyzed_frame_hash = semantic_event.get("frame_hash")
        frame_event = next(
            event
            for event in reversed(agent_events)
            if event.get("type") == "visual_frame"
            and event.get("phase") == "received"
            and event.get("frame_hash") == analyzed_frame_hash
        )
        response = "".join(transcript_parts.values()).strip()
        return {
            "livekit_connected": True,
            "agent_present": True,
            "dispatch_created": dispatch_created,
            "dispatch_id": dispatch.id,
            "video_track_sid": video_publication.sid,
            "transport_verified": (
                frame_event.get("width") == WIDTH
                and frame_event.get("height") == HEIGHT
                and bool(frame_event.get("frame_hash"))
            ),
            "frame_evidence": {
                "source": frame_event.get("source"),
                "width": frame_event.get("width"),
                "height": frame_event.get("height"),
                "frame_count": frame_event.get("frame_count"),
                "frame_hash": frame_event.get("frame_hash"),
            },
            "semantic_phase": semantic_event.get("phase"),
            "experiment": experiment,
            "semantic_checks": semantic_event.get("checks", {}),
            "agent_response": response,
            "passed": semantic_event.get("phase")
            == ("described" if experiment == "camera" else "verified"),
        }
    finally:
        if capture_task:
            capture_task.cancel()
            await asyncio.gather(capture_task, return_exceptions=True)
        if video_publication:
            await room.local_participant.unpublish_track(video_publication.sid)
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
