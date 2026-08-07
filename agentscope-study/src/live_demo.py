"""Run the same scenario with a real MiniMax, OpenAI, or DashScope model."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Literal

from agentscope.agent import ReActAgent
from agentscope.formatter import (
    AnthropicChatFormatter,
    DashScopeChatFormatter,
    OpenAIChatFormatter,
)
from agentscope.memory import InMemoryMemory
from agentscope.message import Msg
from agentscope.model import (
    AnthropicChatModel,
    DashScopeChatModel,
    OpenAIChatModel,
)
from agentscope.tool import Toolkit
from pydantic import BaseModel, Field, ValidationError

from scenario import EventAssessment, TOOL_AUDIT_LOG, register_scenario_tools


MINIMAX_ANTHROPIC_BASE_URL = "https://api.minimaxi.com/anthropic"
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config.local.json"


class RuntimeConfig(BaseModel):
    """Validated local configuration. The API key is never printed."""

    provider: Literal["minimax", "openai", "dashscope"] = "minimax"
    model: str = "MiniMax-M3"
    api_key: str = Field(min_length=1)
    base_url: str | None = None
    max_tokens: int = Field(default=4096, ge=1)
    temperature: float = Field(default=1.0, ge=0.0, le=2.0)
    thinking: dict[str, object] | None = Field(
        default_factory=lambda: {"type": "adaptive"},
    )
    stream: bool = False


def load_config(config_path: Path) -> RuntimeConfig:
    if not config_path.is_file():
        raise RuntimeError(
            f"Configuration file not found: {config_path}. "
            "Copy config.example.json to config.local.json first.",
        )
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict) or not payload.get("api_key"):
            raise RuntimeError(
                f"api_key is empty in {config_path}. Open the file and "
                "enter the MiniMax API key before running the demo.",
            )
        return RuntimeConfig.model_validate(payload)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"Invalid JSON in configuration file {config_path}: {error}",
        ) from error
    except ValidationError as error:
        raise RuntimeError(
            f"Invalid configuration in {config_path}:\n{error}",
        ) from error


def build_model(config: RuntimeConfig):
    if config.provider == "minimax":
        minimax_base_url = config.base_url or MINIMAX_ANTHROPIC_BASE_URL
        return (
            AnthropicChatModel(
                model_name=config.model,
                api_key=config.api_key,
                max_tokens=config.max_tokens,
                # Start non-streaming so the first test isolates the
                # multi-round tool-call protocol from stream parsing.
                stream=config.stream,
                client_kwargs={"base_url": minimax_base_url},
                # MiniMax M3 defaults thinking to off. Adaptive thinking is
                # enabled explicitly; AgentScope preserves thinking blocks
                # in subsequent tool-call rounds as required by MiniMax.
                thinking=config.thinking,
                generate_kwargs={"temperature": config.temperature},
            ),
            AnthropicChatFormatter(),
            minimax_base_url,
        )

    if config.provider == "openai":
        client_kwargs = (
            {"base_url": config.base_url} if config.base_url else None
        )
        return (
            OpenAIChatModel(
                model_name=config.model,
                api_key=config.api_key,
                stream=config.stream,
                client_kwargs=client_kwargs,
                generate_kwargs={"temperature": config.temperature},
            ),
            OpenAIChatFormatter(),
            config.base_url,
        )

    return (
        DashScopeChatModel(
            model_name=config.model,
            api_key=config.api_key,
            stream=config.stream,
            generate_kwargs={"temperature": config.temperature},
        ),
        DashScopeChatFormatter(),
        None,
    )


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help=f"Local JSON configuration path (default: {DEFAULT_CONFIG_PATH})",
    )
    args = parser.parse_args()
    config = load_config(args.config.resolve())
    model, formatter, resolved_base_url = build_model(config)

    toolkit = Toolkit()
    register_scenario_tools(toolkit)
    agent = ReActAgent(
        name="ShadowBrokerAnalyst",
        sys_prompt=(
            "你是证据优先的事件分析员。先调用工具查询事件和原始证据，再计算时间空间关联。"
            "不得把相关性说成因果关系；最终给出证据、反证、置信度和下一步建议。"
        ),
        model=model,
        formatter=formatter,
        toolkit=toolkit,
        memory=InMemoryMemory(),
        parallel_tool_calls=True,
        max_iters=10,
    )
    started_at = time.perf_counter()
    reply = await agent.reply(
        Msg(
            name="user",
            content="分析东海近两小时异常事件，判断 AIS 中断是否可能与天气相关。",
            role="user",
        ),
        structured_model=EventAssessment,
    )
    elapsed_seconds = time.perf_counter() - started_at
    print(
        json.dumps(
            {
                "provider": config.provider,
                "model": config.model,
                "base_url": resolved_base_url,
                "stream": config.stream,
                "thinking": config.thinking,
                "elapsed_seconds": round(elapsed_seconds, 2),
                "final_text": reply.get_text_content(),
                "structured_assessment": reply.metadata,
                "tool_audit_log": TOOL_AUDIT_LOG,
            },
            ensure_ascii=False,
            indent=2,
        ),
    )


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        asyncio.run(main())
    except RuntimeError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        raise SystemExit(2) from None
