from __future__ import annotations

import sys
import sqlite3
from pathlib import Path

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from workflow_store import (  # noqa: E402
    AppointmentStore,
    WorkflowConflictError,
    WorkflowOwnershipError,
)


def test_workflow_survives_store_recreation_and_resume(tmp_path: Path) -> None:
    database = tmp_path / "workflows.sqlite3"
    first_store = AppointmentStore(database)
    created = first_store.create("visitor-a")
    submitted = first_store.submit(
        created.workflow_id,
        owner_id="visitor-a",
        expected_version=created.version,
        customer_name="张晓",
        appointment_time="明天下午三点",
        request="产品演示",
    )
    paused = first_store.pause(
        submitted.workflow_id,
        owner_id="visitor-a",
        expected_version=submitted.version,
    )

    restarted_store = AppointmentStore(database)
    restored = restarted_store.resume_latest("visitor-a")

    assert restored is not None
    assert restored.workflow_id == paused.workflow_id
    assert restored.status == "review"
    assert (restored.customer_name, restored.appointment_time, restored.request) == (
        "张晓",
        "明天下午三点",
        "产品演示",
    )
    assert restored.version == paused.version + 1


def test_confirm_is_idempotent_and_keeps_one_record(tmp_path: Path) -> None:
    store = AppointmentStore(tmp_path / "workflows.sqlite3")
    created = store.create("visitor-a")
    review = store.submit(
        created.workflow_id,
        owner_id="visitor-a",
        expected_version=created.version,
        customer_name="李雷",
        appointment_time="周五上午十点",
        request="技术咨询",
    )

    first = store.confirm(
        review.workflow_id,
        owner_id="visitor-a",
        expected_version=review.version,
    )
    second = store.confirm(
        review.workflow_id,
        owner_id="visitor-a",
        expected_version=review.version,
    )

    assert first.status == second.status == "confirmed"
    assert first.version == second.version
    assert store.count(review.workflow_id) == 1
    assert store.latest_resumable("visitor-a") is None


def test_cancel_is_terminal_and_not_resumable(tmp_path: Path) -> None:
    store = AppointmentStore(tmp_path / "workflows.sqlite3")
    created = store.create("visitor-a")
    cancelled = store.cancel(
        created.workflow_id,
        owner_id="visitor-a",
        expected_version=created.version,
    )

    assert cancelled.status == "cancelled"
    assert store.cancel(
        created.workflow_id,
        owner_id="visitor-a",
        expected_version=created.version,
    ).version == cancelled.version
    assert store.latest_resumable("visitor-a") is None


def test_workflows_are_isolated_by_owner(tmp_path: Path) -> None:
    store = AppointmentStore(tmp_path / "workflows.sqlite3")
    owner_a = store.create("visitor-a")
    owner_b = store.create("visitor-b")

    assert store.latest_resumable("visitor-a").workflow_id == owner_a.workflow_id
    assert store.latest_resumable("visitor-b").workflow_id == owner_b.workflow_id
    with pytest.raises(WorkflowOwnershipError):
        store.get(owner_a.workflow_id, owner_id="visitor-b")


def test_stale_version_cannot_overwrite_current_record(tmp_path: Path) -> None:
    store = AppointmentStore(tmp_path / "workflows.sqlite3")
    created = store.create("visitor-a")
    review = store.submit(
        created.workflow_id,
        owner_id="visitor-a",
        expected_version=created.version,
        customer_name="王芳",
        appointment_time="下周一",
        request="方案评审",
    )

    with pytest.raises(WorkflowConflictError):
        store.pause(
            review.workflow_id,
            owner_id="visitor-a",
            expected_version=created.version,
        )

    unchanged = store.get(review.workflow_id, owner_id="visitor-a")
    assert unchanged is not None
    assert unchanged.status == "review"
    assert unchanged.version == review.version


def test_expired_workflow_is_terminal_and_not_resumable(tmp_path: Path) -> None:
    store = AppointmentStore(tmp_path / "workflows.sqlite3")
    created = store.create("visitor-a", ttl_seconds=0.1)

    assert store.expire_stale(owner_id="visitor-a", now=created.expires_at + 1) == 1
    expired = store.get(created.workflow_id, owner_id="visitor-a")
    assert expired is not None
    assert expired.status == "expired"
    assert expired.version == created.version + 1
    assert store.latest_resumable("visitor-a") is None


def test_existing_phase4_database_is_migrated(tmp_path: Path) -> None:
    database = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(database) as connection:
        connection.execute(
            """
            CREATE TABLE appointment_workflows (
                workflow_id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                appointment_time TEXT NOT NULL,
                request TEXT NOT NULL,
                status TEXT NOT NULL,
                version INTEGER NOT NULL,
                updated_at REAL NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT INTO appointment_workflows VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("apt-legacy", "旧用户", "明天", "回归", "confirmed", 5, 1000.0),
        )

    store = AppointmentStore(database)
    migrated = store.get("apt-legacy")

    assert migrated is not None
    assert migrated.owner_id == "legacy"
    assert migrated.expires_at > migrated.updated_at


def test_approval_gate_is_resumable_and_records_append_only_audit(tmp_path: Path) -> None:
    database = tmp_path / "workflows.sqlite3"
    store = AppointmentStore(database)
    created = store.create("visitor-a")
    review = store.submit(
        created.workflow_id,
        owner_id="visitor-a",
        expected_version=created.version,
        customer_name="张晓",
        appointment_time="明天下午三点",
        request="产品演示",
    )
    pending = store.request_approval(
        review.workflow_id,
        owner_id="visitor-a",
        expected_version=review.version,
        actor_id="agent:appointment-review",
    )

    assert pending.status == "pending_approval"
    assert AppointmentStore(database).resume_latest("visitor-a").status == "pending_approval"

    approved = store.approve(
        pending.workflow_id,
        owner_id="visitor-a",
        expected_version=pending.version,
        actor_id="human:visitor-a",
    )
    audit = store.list_audit(approved.workflow_id, owner_id="visitor-a")

    assert approved.status == "confirmed"
    assert store.latest_resumable("visitor-a") is None
    assert [event.action for event in audit] == [
        "workflow_created",
        "draft_submitted",
        "approval_requested",
        "approval_approved",
    ]
    assert [event.event_id for event in audit] == sorted(event.event_id for event in audit)
    assert audit[-2].actor_id == "agent:appointment-review"
    assert audit[-1].actor_id == "human:visitor-a"


def test_human_rejection_is_terminal_and_keeps_reason(tmp_path: Path) -> None:
    store = AppointmentStore(tmp_path / "workflows.sqlite3")
    created = store.create("visitor-a")
    review = store.submit(
        created.workflow_id,
        owner_id="visitor-a",
        expected_version=created.version,
        customer_name="李雷",
        appointment_time="周五上午十点",
        request="技术咨询",
    )
    pending = store.request_approval(
        review.workflow_id,
        owner_id="visitor-a",
        expected_version=review.version,
        actor_id="agent:appointment-review",
    )
    rejected = store.reject(
        pending.workflow_id,
        owner_id="visitor-a",
        expected_version=pending.version,
        actor_id="human:visitor-a",
        reason="时间需要重新确认",
    )

    assert rejected.status == "rejected"
    assert store.latest_resumable("visitor-a") is None
    assert store.list_audit(rejected.workflow_id, owner_id="visitor-a")[-1].detail == "时间需要重新确认"


def test_audit_log_is_owner_scoped(tmp_path: Path) -> None:
    store = AppointmentStore(tmp_path / "workflows.sqlite3")
    created = store.create("visitor-a")

    with pytest.raises(WorkflowOwnershipError):
        store.list_audit(created.workflow_id, owner_id="visitor-b")
