from __future__ import annotations

import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from minimax_agent import (  # noqa: E402
    AppointmentDraft,
    AppointmentApprovalAgent,
    AppointmentIntakeAgent,
    AppointmentReviewAgent,
    MiniMaxRoomAgent,
)


def tool_names(agent) -> set[str]:
    return {tool.info.name for tool in agent.tools}


def test_appointment_agents_have_distinct_roles_and_tools() -> None:
    draft = AppointmentDraft()
    guide = MiniMaxRoomAgent("MiniMax-M3", "speech-2.8-turbo", "mimo-v2.5-asr", appointment_draft=draft)
    intake = AppointmentIntakeAgent("MiniMax-M3", "speech-2.8-turbo", "mimo-v2.5-asr", draft)
    review = AppointmentReviewAgent("MiniMax-M3", "speech-2.8-turbo", "mimo-v2.5-asr", draft)
    approval = AppointmentApprovalAgent("MiniMax-M3", "speech-2.8-turbo", "mimo-v2.5-asr", draft)

    assert guide.id == "research-guide"
    assert intake.id == "appointment-intake"
    assert review.id == "appointment-review"
    assert approval.id == "appointment-approval"
    assert "start_appointment_workflow" in tool_names(guide)
    assert "resume_latest_appointment" in tool_names(guide)
    assert tool_names(intake) == {
        "submit_appointment_draft",
        "cancel_appointment",
        "expire_appointment",
    }
    assert tool_names(review) == {
        "request_appointment_approval",
        "pause_appointment",
        "cancel_appointment",
        "expire_appointment",
        "test_stale_appointment_write",
    }
    assert tool_names(approval) == {"approve_appointment", "reject_appointment"}
    assert guide._appointment_draft is intake._appointment_draft is review._appointment_draft is approval._appointment_draft


def test_appointment_draft_event_is_truthful_about_local_persistence() -> None:
    draft = AppointmentDraft(
        workflow_id="apt-test1234",
        owner_id="visitor-test",
        customer_name="张晓",
        appointment_time="明天下午三点",
        request="产品演示",
        status="review",
        version=2,
        expires_at=2000.0,
    )

    payload = draft.event_payload()

    assert payload == {
        "type": "workflow_state",
        "workflow": "appointment",
        "phase": "review",
        "workflow_id": "apt-test1234",
        "owner_id": "visitor-test",
        "version": 2,
        "expires_at": 2000.0,
        "persistence": "local-sqlite",
        "isolation": "owner-scoped",
        "concurrency": "optimistic-version",
        "draft": {
            "customer_name": "张晓",
            "appointment_time": "明天下午三点",
            "request": "产品演示",
        },
    }
