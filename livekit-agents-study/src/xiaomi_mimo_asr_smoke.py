"""Real Xiaomi MiMo ASR smoke test using a MiniMax-generated Chinese sample."""

from __future__ import annotations

import asyncio
import json
import os

from livekit.agents import APIConnectOptions, utils
from livekit.plugins import minimax

from xiaomi_mimo_stt import XiaomiMiMoSTT


SAMPLE_TEXT = "你好，这是小米语音识别接入 LiveKit 的测试。"


async def _run_smoke_in_http_context() -> dict[str, object]:
    minimax_key = os.environ["MINIMAX_API_KEY"]
    mimo_key = os.environ["MIMO_API_KEY"]

    tts = minimax.TTS(
        model=os.getenv("MINIMAX_TTS_MODEL", "speech-2.8-turbo"),
        voice=os.getenv("MINIMAX_TTS_VOICE", "male-qn-qingse"),
        language_boost="Chinese",
        api_key=minimax_key,
        base_url=os.getenv("MINIMAX_BASE_URL", "https://api.minimaxi.com"),
    )
    recognizer = XiaomiMiMoSTT(
        api_key=mimo_key,
        model=os.getenv("MIMO_ASR_MODEL", "mimo-v2.5-asr"),
        language=os.getenv("MIMO_ASR_LANGUAGE", "zh"),
        base_url=os.getenv("MIMO_ASR_BASE_URL", "https://api.xiaomimimo.com/v1"),
    )

    try:
        audio = await tts.synthesize(
            SAMPLE_TEXT,
            conn_options=APIConnectOptions(max_retry=1, timeout=15),
        ).collect()
        event = await recognizer.recognize(
            audio,
            conn_options=APIConnectOptions(max_retry=0, timeout=20),
        )
    finally:
        await recognizer.aclose()
        await tts.aclose()

    transcript = event.alternatives[0].text.strip() if event.alternatives else ""
    if not transcript:
        raise RuntimeError("小米 MiMo ASR 返回了空识别结果")

    return {
        "passed": True,
        "source_text": SAMPLE_TEXT,
        "transcript": transcript,
        "asr_model": recognizer.model,
        "asr_output_mode": "sse" if recognizer.stream_output else "single-response",
        "audio_duration_seconds": round(audio.duration, 3),
        "request_id": event.request_id,
    }


async def run_smoke() -> dict[str, object]:
    async with utils.http_context.open():
        return await _run_smoke_in_http_context()


if __name__ == "__main__":
    print(json.dumps(asyncio.run(run_smoke()), ensure_ascii=False, indent=2))
