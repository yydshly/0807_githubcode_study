"""Offline AgentScope proof: model loop, parallel tools, and structured output."""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

from agentscope.agent import ReActAgent
from agentscope.formatter import OpenAIChatFormatter
from agentscope.memory import InMemoryMemory
from agentscope.message import Msg, TextBlock, ToolUseBlock
from agentscope.model import ChatModelBase, ChatResponse
from agentscope.tool import Toolkit

from scenario import EventAssessment, TOOL_AUDIT_LOG, register_scenario_tools


class ScriptedStudyModel(ChatModelBase):
    """A deterministic model double that exercises the real AgentScope loop."""

    def __init__(self) -> None:
        super().__init__(model_name="scripted-study-model", stream=False)
        self.calls: list[dict[str, object]] = []

    async def __call__(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | None = None,
        **_: Any,
    ) -> ChatResponse:
        available_tools = {
            item["function"]["name"] for item in (tools or [])
        }
        completed_tools = [
            str(message.get("name"))
            for message in messages
            if message.get("role") == "tool"
        ]
        self.calls.append(
            {
                "tool_choice": tool_choice,
                "available_tools": sorted(available_tools),
                "completed_tools": completed_tools,
            },
        )

        if "query_events" not in completed_tools:
            return self._tool_call(
                "call-query",
                "query_events",
                {"region": "东海", "hours": 2},
            )

        evidence_count = completed_tools.count("get_source_evidence")
        if evidence_count == 0:
            return ChatResponse(
                content=[
                    ToolUseBlock(
                        type="tool_use",
                        id="call-evidence-ais",
                        name="get_source_evidence",
                        input={"event_id": "evt-ais-001"},
                    ),
                    ToolUseBlock(
                        type="tool_use",
                        id="call-evidence-weather",
                        name="get_source_evidence",
                        input={"event_id": "evt-weather-002"},
                    ),
                ],
            )

        if "correlate_events" not in completed_tools:
            return self._tool_call(
                "call-correlation",
                "correlate_events",
                {
                    "first_event_id": "evt-ais-001",
                    "second_event_id": "evt-weather-002",
                },
            )

        if "generate_response" not in completed_tools:
            return self._tool_call(
                "call-finish",
                "generate_response",
                {
                    "summary": "AIS 信号中断与强对流在时间和空间上接近，天气是合理解释，但尚无独立遇险证据。",
                    "likely_related": True,
                    "confidence": 0.72,
                    "evidence": [
                        "两事件相距约 44 公里，时间差 11 分钟。",
                        "海上天气警报覆盖相关区域。",
                        "AIS 连续三个位置点缺失。",
                    ],
                    "contradictions": [
                        "没有独立遇险报告，AIS 中断也可能由设备或覆盖问题造成。",
                    ],
                    "recommended_actions": [
                        "检查后续 AIS 信号是否恢复。",
                        "核对附近船舶和海事通告。",
                    ],
                },
            )

        return ChatResponse(
            content=[
                TextBlock(
                    type="text",
                    text="研判完成：两事件较可能相关，但结论必须保留为中等置信度并等待后续 AIS 与海事通告验证。",
                ),
            ],
        )

    @staticmethod
    def _tool_call(call_id: str, name: str, arguments: dict[str, object]) -> ChatResponse:
        return ChatResponse(
            content=[
                ToolUseBlock(
                    type="tool_use",
                    id=call_id,
                    name=name,
                    input=arguments,
                ),
            ],
        )


async def main() -> None:
    model = ScriptedStudyModel()
    toolkit = Toolkit()
    register_scenario_tools(toolkit)

    agent = ReActAgent(
        name="ShadowBrokerAnalyst",
        sys_prompt=(
            "You are an evidence-first event analyst. Use tools before making claims. "
            "Keep provenance, contradictions, and uncertainty explicit."
        ),
        model=model,
        formatter=OpenAIChatFormatter(),
        toolkit=toolkit,
        memory=InMemoryMemory(),
        parallel_tool_calls=True,
        max_iters=8,
    )

    reply = await agent.reply(
        Msg(
            name="user",
            content="分析东海近两小时异常事件，判断 AIS 中断是否可能与天气相关。",
            role="user",
        ),
        structured_model=EventAssessment,
    )

    result = {
        "mode": "offline-scripted-model",
        "framework": "AgentScope",
        "final_text": reply.get_text_content(),
        "structured_assessment": reply.metadata,
        "tool_audit_log": TOOL_AUDIT_LOG,
        "model_turns": model.calls,
        "disclaimer": "This validates framework mechanics, not live-model intelligence.",
    }
    print("\n=== STUDY RESULT ===")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())
