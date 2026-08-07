"""Deterministic ShadowBroker-like tools used by both demos."""

from __future__ import annotations

import asyncio
import json
import math
from datetime import datetime

from agentscope.message import TextBlock
from agentscope.tool import ToolResponse
from pydantic import BaseModel, Field


EVENTS = {
    "evt-ais-001": {
        "id": "evt-ais-001",
        "kind": "ais_gap",
        "title": "Cargo vessel AIS signal gap",
        "occurred_at": "2026-08-07T11:42:00+08:00",
        "latitude": 30.10,
        "longitude": 124.80,
        "source": "AISStream sample feed",
        "raw_confidence": 0.82,
    },
    "evt-weather-002": {
        "id": "evt-weather-002",
        "kind": "severe_weather",
        "title": "Strong convective cell",
        "occurred_at": "2026-08-07T11:31:00+08:00",
        "latitude": 30.40,
        "longitude": 124.50,
        "source": "Weather warning sample feed",
        "raw_confidence": 0.94,
    },
    "evt-flight-003": {
        "id": "evt-flight-003",
        "kind": "flight_diversion",
        "title": "Commercial flight route deviation",
        "occurred_at": "2026-08-07T11:28:00+08:00",
        "latitude": 31.20,
        "longitude": 123.90,
        "source": "OpenSky sample feed",
        "raw_confidence": 0.76,
    },
}

TOOL_AUDIT_LOG: list[dict[str, object]] = []


class EventAssessment(BaseModel):
    """Structured output required from the analyst agent."""

    summary: str = Field(description="Concise assessment grounded in tool evidence")
    likely_related: bool = Field(description="Whether the events are likely related")
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str]
    contradictions: list[str]
    recommended_actions: list[str]


def _response(payload: object) -> ToolResponse:
    return ToolResponse(
        content=[
            TextBlock(
                type="text",
                text=json.dumps(payload, ensure_ascii=False, indent=2),
            ),
        ],
    )


async def query_events(region: str, hours: int) -> ToolResponse:
    """Query normalized events in a region and time window.

    Args:
        region: Human-readable region name.
        hours: Lookback time window in hours.
    """
    await asyncio.sleep(0.05)
    TOOL_AUDIT_LOG.append({"tool": "query_events", "region": region, "hours": hours})
    return _response(
        {
            "region": region,
            "hours": hours,
            "events": list(EVENTS.values()),
            "notice": "Synthetic study data; not a live-world claim.",
        },
    )


async def get_source_evidence(event_id: str) -> ToolResponse:
    """Retrieve provenance and corroboration for one event.

    Args:
        event_id: Event identifier returned by query_events.
    """
    await asyncio.sleep(0.10)
    TOOL_AUDIT_LOG.append({"tool": "get_source_evidence", "event_id": event_id})
    event = EVENTS[event_id]
    corroboration = {
        "evt-ais-001": [
            "Three consecutive AIS positions are absent.",
            "No independent distress report is present.",
        ],
        "evt-weather-002": [
            "Weather radar indicates a strong convective cell.",
            "A maritime weather warning overlaps the area.",
        ],
        "evt-flight-003": [
            "The route deviation begins near the warning boundary.",
            "No emergency transponder code is present.",
        ],
    }[event_id]
    return _response(
        {
            "event_id": event_id,
            "source": event["source"],
            "source_timestamp": event["occurred_at"],
            "corroboration": corroboration,
            "provenance_complete": True,
        },
    )


def _haversine_km(first: dict[str, object], second: dict[str, object]) -> float:
    lat1 = math.radians(float(first["latitude"]))
    lon1 = math.radians(float(first["longitude"]))
    lat2 = math.radians(float(second["latitude"]))
    lon2 = math.radians(float(second["longitude"]))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


async def correlate_events(first_event_id: str, second_event_id: str) -> ToolResponse:
    """Calculate deterministic time and geographic separation.

    Args:
        first_event_id: First event identifier.
        second_event_id: Second event identifier.
    """
    await asyncio.sleep(0.05)
    TOOL_AUDIT_LOG.append(
        {
            "tool": "correlate_events",
            "first_event_id": first_event_id,
            "second_event_id": second_event_id,
        },
    )
    first = EVENTS[first_event_id]
    second = EVENTS[second_event_id]
    first_time = datetime.fromisoformat(str(first["occurred_at"]))
    second_time = datetime.fromisoformat(str(second["occurred_at"]))
    time_gap_minutes = abs((first_time - second_time).total_seconds()) / 60
    distance_km = _haversine_km(first, second)
    return _response(
        {
            "first_event_id": first_event_id,
            "second_event_id": second_event_id,
            "distance_km": round(distance_km, 1),
            "time_gap_minutes": round(time_gap_minutes, 1),
            "rule_based_signal": distance_km < 60 and time_gap_minutes < 30,
        },
    )


def register_scenario_tools(toolkit: object) -> None:
    """Register the study tools on an AgentScope Toolkit."""
    toolkit.register_tool_function(query_events)
    toolkit.register_tool_function(get_source_evidence)
    toolkit.register_tool_function(correlate_events)
