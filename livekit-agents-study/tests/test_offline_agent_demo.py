import asyncio
import sys
from pathlib import Path


SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

from offline_agent_demo import run_demo  # noqa: E402


def test_offline_agent_session_tool_loop() -> None:
    result = asyncio.run(run_demo())

    assert result["livekit_agents_version"] == "1.6.8"
    assert result["external_credentials_used"] is False
    assert result["assertions"]["passed"] is True
    assert result["assertions"]["actual_core_event_order"] == [
        "function_call",
        "function_call_output",
        "message",
    ]
    tool_output = next(
        event for event in result["events"] if event["type"] == "function_call_output"
    )
    assert tool_output["output"]["agent_state"] == "listening"
