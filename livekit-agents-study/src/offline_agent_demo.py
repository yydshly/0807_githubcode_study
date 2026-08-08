from __future__ import annotations

import argparse
import asyncio
import json
import time
from pathlib import Path
from typing import Any

from livekit.agents import Agent, AgentSession, RunContext, function_tool
from livekit.agents.llm import (
    ChatChunk,
    ChatContext,
    ChoiceDelta,
    FunctionToolCall,
    LLM,
    LLMStream,
    Tool,
    ToolChoice,
)
from livekit.agents.types import (
    DEFAULT_API_CONNECT_OPTIONS,
    NOT_GIVEN,
    APIConnectOptions,
    NotGivenOr,
)


ROOM_STATUS = {
    "room": "demo-room",
    "participants": ["访客", "AI Agent"],
    "media": ["audio", "text"],
    "agent_state": "listening",
}


class ScriptedLLM(LLM):
    """A deterministic LLM substitute for demonstrating the real AgentSession loop."""

    def chat(
        self,
        *,
        chat_ctx: ChatContext,
        tools: list[Tool] | None = None,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
        parallel_tool_calls: NotGivenOr[bool] = NOT_GIVEN,
        tool_choice: NotGivenOr[ToolChoice] = NOT_GIVEN,
        extra_kwargs: NotGivenOr[dict[str, Any]] = NOT_GIVEN,
    ) -> LLMStream:
        return ScriptedLLMStream(
            self,
            chat_ctx=chat_ctx,
            tools=tools or [],
            conn_options=conn_options,
        )


class ScriptedLLMStream(LLMStream):
    def __init__(
        self,
        llm: ScriptedLLM,
        *,
        chat_ctx: ChatContext,
        tools: list[Tool],
        conn_options: APIConnectOptions,
    ) -> None:
        super().__init__(llm, chat_ctx=chat_ctx, tools=tools, conn_options=conn_options)

    async def _run(self) -> None:
        item = self.chat_ctx.items[-1]
        if item.type == "message" and item.role == "user":
            await self._emit(
                "我先调用房间状态工具，而不是猜测。",
                [
                    FunctionToolCall(
                        name="get_room_status",
                        arguments=json.dumps({"room_name": "demo-room"}),
                        call_id="demo-call-1",
                    )
                ],
            )
            return

        if item.type == "function_call_output":
            payload = json.loads(item.output)
            participants = "、".join(payload["participants"])
            response = f"房间 {payload['room']} 已连接；参与者为 {participants}。"
            if payload.get("agent_state"):
                response = response[:-1] + f"；AI 当前处于 {payload['agent_state']} 状态。"
            await self._emit(response)

    async def _emit(
        self,
        content: str,
        tool_calls: list[FunctionToolCall] | None = None,
    ) -> None:
        for offset in range(0, len(content), 8):
            await asyncio.sleep(0)
            self._event_ch.send_nowait(
                ChatChunk(
                    id="offline-demo",
                    delta=ChoiceDelta(
                        role="assistant",
                        content=content[offset : offset + 8],
                    ),
                )
            )

        if tool_calls:
            self._event_ch.send_nowait(
                ChatChunk(
                    id="offline-demo",
                    delta=ChoiceDelta(role="assistant", tool_calls=tool_calls),
                )
            )


class RoomAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "你是加入 LiveKit 房间的 AI 参与者。"
                "所有房间状态必须通过工具读取，不得猜测。"
            )
        )

    @function_tool
    async def get_room_status(self, context: RunContext, room_name: str) -> str:
        """读取实时房间状态。

        Args:
            room_name: 要检查的房间名称。
        """
        payload = {**ROOM_STATUS, "room": room_name}
        return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def serialize_event(event: Any) -> dict[str, Any]:
    item = event.item
    if event.type == "message":
        return {
            "type": event.type,
            "role": item.role,
            "content": item.text_content,
        }
    if event.type == "function_call":
        return {
            "type": event.type,
            "name": item.name,
            "arguments": json.loads(item.arguments),
        }
    if event.type == "function_call_output":
        return {
            "type": event.type,
            "name": item.name,
            "output": json.loads(item.output),
            "is_error": item.is_error,
        }
    if event.type == "agent_handoff":
        return {
            "type": event.type,
            "old_agent": type(event.old_agent).__name__ if event.old_agent else None,
            "new_agent": type(event.new_agent).__name__,
        }
    return {"type": event.type}


async def run_demo() -> dict[str, Any]:
    started = time.perf_counter()
    async with ScriptedLLM() as model, AgentSession(llm=model) as session:
        await session.start(RoomAssistant())
        result = await session.run(user_input="请检查这个房间当前是否正常。")

    events = [serialize_event(event) for event in result.events]
    event_types = [event["type"] for event in events]
    core_events = [
        event
        for event in events
        if not (
            event["type"] == "message"
            and str(event.get("content", "")).startswith("我先调用")
        )
    ]
    core_event_types = [event["type"] for event in core_events]
    expected = ["function_call", "function_call_output", "message"]
    return {
        "demo": "LiveKit Agents deterministic AgentSession tool loop",
        "livekit_agents_version": __import__("livekit.agents", fromlist=["__version__"]).__version__,
        "mode": "offline-text",
        "external_credentials_used": False,
        "input": "请检查这个房间当前是否正常。",
        "events": events,
        "assertions": {
            "expected_event_order": expected,
            "actual_event_order": event_types,
            "actual_core_event_order": core_event_types,
            "passed": core_event_types == expected,
        },
        "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the offline LiveKit Agents capability demo.")
    parser.add_argument("--output", type=Path, help="Optional JSON result path.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = asyncio.run(run_demo())
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    return 0 if result["assertions"]["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
