from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

import httpx
import openai
import pytest
from livekit import rtc
from livekit.agents import stt


SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

from xiaomi_mimo_stt import XiaomiMiMoSTT  # noqa: E402


@pytest.mark.asyncio
async def test_recognize_sends_wav_to_mimo_chat_completions() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            request=request,
            headers={"content-type": "text/event-stream"},
            content=(
                'data: {"id":"mimo-asr-test","object":"chat.completion.chunk",'
                '"created":1,"model":"mimo-v2.5-asr","choices":[{"index":0,'
                '"delta":{"content":"你好，"},"finish_reason":null}]}\n\n'
                'data: {"id":"mimo-asr-test","object":"chat.completion.chunk",'
                '"created":1,"model":"mimo-v2.5-asr","choices":[{"index":0,'
                '"delta":{"content":"LiveKit。"},"finish_reason":"stop"}]}\n\n'
                "data: [DONE]\n\n"
            ).encode(),
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = openai.AsyncOpenAI(
        api_key="test-key",
        base_url="https://api.xiaomimimo.com/v1",
        http_client=http_client,
    )
    recognizer = XiaomiMiMoSTT(api_key="test-key", client=client, language="zh")
    partials: list[str] = []
    recognizer.on("partial_transcript", partials.append)
    frame = rtc.AudioFrame.create(sample_rate=16000, num_channels=1, samples_per_channel=1600)

    try:
        event = await recognizer.recognize(frame)
    finally:
        await client.close()

    assert captured["url"] == "https://api.xiaomimimo.com/v1/chat/completions"
    body = captured["body"]
    assert isinstance(body, dict)
    assert body["model"] == "mimo-v2.5-asr"
    assert body["stream"] is True
    assert body["asr_options"] == {"language": "zh"}
    data_uri = body["messages"][0]["content"][0]["input_audio"]["data"]
    assert data_uri.startswith("data:audio/wav;base64,")
    assert base64.b64decode(data_uri.split(",", 1)[1]).startswith(b"RIFF")
    assert event.type == stt.SpeechEventType.FINAL_TRANSCRIPT
    assert event.request_id == "mimo-asr-test"
    assert event.alternatives[0].text == "你好，LiveKit。"
    assert str(event.alternatives[0].language) == "zh"
    assert partials == ["你好，", "你好，LiveKit。"]


@pytest.mark.asyncio
async def test_can_disable_sse_output_for_compatibility() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            request=request,
            json={
                "id": "mimo-asr-normal",
                "object": "chat.completion",
                "created": 1,
                "model": "mimo-v2.5-asr",
                "choices": [{"index": 0, "finish_reason": "stop", "message": {
                    "role": "assistant", "content": "兼容模式。"
                }}],
            },
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = openai.AsyncOpenAI(
        api_key="test-key",
        base_url="https://api.xiaomimimo.com/v1",
        http_client=http_client,
    )
    recognizer = XiaomiMiMoSTT(
        api_key="test-key", client=client, stream_output=False
    )
    frame = rtc.AudioFrame.create(sample_rate=16000, num_channels=1, samples_per_channel=1600)

    try:
        event = await recognizer.recognize(frame)
    finally:
        await client.close()

    assert captured["body"]["stream"] is False
    assert event.request_id == "mimo-asr-normal"
    assert event.alternatives[0].text == "兼容模式。"


def test_rejects_unsupported_language() -> None:
    with pytest.raises(ValueError, match="auto, zh, en"):
        XiaomiMiMoSTT(api_key="test-key", language="fr")


def test_token_plan_key_requires_its_dedicated_base_url() -> None:
    with pytest.raises(ValueError, match="dedicated Base URL"):
        XiaomiMiMoSTT(api_key="tp-test-key")


@pytest.mark.asyncio
async def test_default_client_includes_xiaomi_api_key_header() -> None:
    recognizer = XiaomiMiMoSTT(api_key="xiaomi-test-key")
    try:
        assert recognizer._client.default_headers["api-key"] == "xiaomi-test-key"
    finally:
        await recognizer.aclose()
