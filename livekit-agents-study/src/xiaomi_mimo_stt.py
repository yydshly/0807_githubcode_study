"""LiveKit batch-input STT adapter for Xiaomi MiMo-V2.5-ASR.

The public MiMo API accepts a complete WAV/MP3 sample rather than microphone
frames. LiveKit's StreamAdapter and a local VAD turn this batch recognizer into
an utterance-based voice input: buffer frames until the user pauses, then call
MiMo once for the completed utterance. MiMo can stream the resulting text over
SSE, which reduces time-to-first-text but does not make the audio input itself
real-time streaming.
"""

from __future__ import annotations

import base64
import os
from typing import Any

import httpx
import openai
from livekit import rtc
from livekit.agents import (
    APIConnectionError,
    APIConnectOptions,
    APIStatusError,
    APITimeoutError,
    LanguageCode,
    stt,
)
from livekit.agents.types import NOT_GIVEN, NotGivenOr
from livekit.agents.utils import AudioBuffer, is_given


MAX_BASE64_BYTES = 10 * 1024 * 1024
PAY_AS_YOU_GO_BASE_URL = "https://api.xiaomimimo.com/v1"


class XiaomiMiMoSTT(stt.STT):
    """Batch-audio Xiaomi MiMo ASR with optional SSE text output."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "mimo-v2.5-asr",
        language: str = "zh",
        base_url: str = PAY_AS_YOU_GO_BASE_URL,
        stream_output: bool = True,
        client: openai.AsyncOpenAI | None = None,
    ) -> None:
        super().__init__(
            capabilities=stt.STTCapabilities(
                streaming=False,
                interim_results=False,
                aligned_transcript=False,
            )
        )
        resolved_key = api_key or os.getenv("MIMO_API_KEY")
        if not resolved_key:
            raise ValueError("MIMO_API_KEY is required for Xiaomi MiMo ASR")
        if language not in {"auto", "zh", "en"}:
            raise ValueError("MiMo ASR language must be one of: auto, zh, en")
        if resolved_key.startswith("tp-") and base_url.rstrip("/") == PAY_AS_YOU_GO_BASE_URL:
            raise ValueError(
                "A tp- Token Plan key requires the dedicated Base URL shown on the "
                "Xiaomi MiMo Token Plan page; it cannot use the pay-as-you-go Base URL"
            )

        self._model = model
        self._language = language
        self._stream_output = stream_output
        self._owns_client = client is None
        self._client = client or openai.AsyncOpenAI(
            api_key=resolved_key,
            base_url=base_url.rstrip("/"),
            # Xiaomi's curl example requires this provider-specific header.
            # Keep api_key above as well to match its official OpenAI-SDK example.
            default_headers={"api-key": resolved_key},
        )

    @property
    def model(self) -> str:
        return self._model

    @property
    def provider(self) -> str:
        return "Xiaomi MiMo"

    @property
    def stream_output(self) -> bool:
        return self._stream_output

    async def _recognize_impl(
        self,
        buffer: AudioBuffer,
        *,
        language: NotGivenOr[str] = NOT_GIVEN,
        conn_options: APIConnectOptions,
    ) -> stt.SpeechEvent:
        selected_language = language if is_given(language) else self._language
        if selected_language not in {"auto", "zh", "en"}:
            raise ValueError("MiMo ASR language must be one of: auto, zh, en")

        wav_bytes = rtc.combine_audio_frames(buffer).to_wav_bytes()
        audio_base64 = base64.b64encode(wav_bytes).decode("ascii")
        if len(audio_base64) > MAX_BASE64_BYTES:
            raise ValueError("MiMo ASR audio exceeds the 10 MB Base64 input limit")

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_audio",
                                "input_audio": {
                                    "data": f"data:audio/wav;base64,{audio_base64}",
                                },
                            }
                        ],
                    }
                ],  # type: ignore[arg-type]
                extra_body={"asr_options": {"language": selected_language}},
                stream=self._stream_output,
                timeout=httpx.Timeout(60, connect=conn_options.timeout),
            )
            request_id = ""
            if self._stream_output:
                text_parts: list[str] = []
                async for chunk in response:  # type: ignore[union-attr]
                    request_id = request_id or chunk.id
                    content: Any = (
                        chunk.choices[0].delta.content if chunk.choices else ""
                    )
                    if isinstance(content, str) and content:
                        text_parts.append(content)
                        self.emit("partial_transcript", "".join(text_parts))
                text = "".join(text_parts).strip()
            else:
                request_id = response.id  # type: ignore[union-attr]
                content = (
                    response.choices[0].message.content  # type: ignore[union-attr]
                    if response.choices  # type: ignore[union-attr]
                    else ""
                )
                text = content.strip() if isinstance(content, str) else ""
            alternatives = []
            if text:
                transcript_language = "" if selected_language == "auto" else selected_language
                alternatives.append(
                    stt.SpeechData(text=text, language=LanguageCode(transcript_language))
                )
            return stt.SpeechEvent(
                type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                request_id=request_id,
                alternatives=alternatives,
            )
        except openai.APITimeoutError:
            raise APITimeoutError("Xiaomi MiMo ASR request timed out") from None
        except openai.APIStatusError as error:
            raise APIStatusError(
                error.message,
                status_code=error.status_code,
                request_id=error.request_id,
                body=error.body,
            ) from None
        except (ValueError, APIStatusError, APITimeoutError):
            raise
        except Exception as error:
            raise APIConnectionError("Xiaomi MiMo ASR connection failed") from error

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.close()
