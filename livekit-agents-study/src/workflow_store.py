"""SQLite persistence and lifecycle guards for the local workflow research demo."""

from __future__ import annotations

import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path


RESUMABLE_STATUSES = ("collecting", "review", "paused", "pending_approval")
TERMINAL_STATUSES = ("confirmed", "rejected", "cancelled", "expired")
DEFAULT_TTL_SECONDS = 60 * 60


class WorkflowConflictError(RuntimeError):
    """A caller attempted to write using an outdated workflow version."""


class WorkflowOwnershipError(PermissionError):
    """A caller attempted to access another local participant's workflow."""


class WorkflowExpiredError(RuntimeError):
    """A workflow has crossed its local research TTL."""


@dataclass
class AppointmentDraft:
    workflow_id: str = ""
    owner_id: str = ""
    customer_name: str = ""
    appointment_time: str = ""
    request: str = ""
    status: str = "idle"
    version: int = 0
    updated_at: float = 0.0
    expires_at: float = 0.0

    def event_payload(self) -> dict[str, object]:
        return {
            "type": "workflow_state",
            "workflow": "appointment",
            "phase": self.status,
            "workflow_id": self.workflow_id,
            "owner_id": self.owner_id,
            "version": self.version,
            "expires_at": self.expires_at,
            "persistence": "local-sqlite",
            "isolation": "owner-scoped",
            "concurrency": "optimistic-version",
            "draft": {
                "customer_name": self.customer_name,
                "appointment_time": self.appointment_time,
                "request": self.request,
            },
        }


@dataclass(frozen=True)
class WorkflowAuditEvent:
    event_id: int
    workflow_id: str
    owner_id: str
    actor_id: str
    action: str
    from_status: str
    to_status: str
    version: int
    detail: str
    created_at: float

    def event_payload(self) -> dict[str, object]:
        return {
            "event_id": self.event_id,
            "workflow_id": self.workflow_id,
            "owner_id": self.owner_id,
            "actor_id": self.actor_id,
            "action": self.action,
            "from_status": self.from_status,
            "to_status": self.to_status,
            "version": self.version,
            "detail": self.detail,
            "created_at": self.created_at,
        }


class AppointmentStore:
    """Persist owner-scoped workflows with expiry and optimistic concurrency."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5.0)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS appointment_workflows (
                    workflow_id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL DEFAULT 'legacy',
                    customer_name TEXT NOT NULL,
                    appointment_time TEXT NOT NULL,
                    request TEXT NOT NULL,
                    status TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    updated_at REAL NOT NULL,
                    expires_at REAL NOT NULL DEFAULT 0
                )
                """
            )
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(appointment_workflows)")
            }
            if "owner_id" not in columns:
                connection.execute(
                    "ALTER TABLE appointment_workflows ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy'"
                )
            if "expires_at" not in columns:
                connection.execute(
                    "ALTER TABLE appointment_workflows ADD COLUMN expires_at REAL NOT NULL DEFAULT 0"
                )
            connection.execute(
                """
                UPDATE appointment_workflows
                SET expires_at = updated_at + ?
                WHERE expires_at <= 0
                """,
                (DEFAULT_TTL_SECONDS,),
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_workflow_owner_status_updated "
                "ON appointment_workflows(owner_id, status, updated_at DESC)"
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS appointment_workflow_audit (
                    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT NOT NULL,
                    owner_id TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    from_status TEXT NOT NULL,
                    to_status TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    detail TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_workflow_audit_sequence "
                "ON appointment_workflow_audit(workflow_id, event_id)"
            )

    @staticmethod
    def _from_row(row: sqlite3.Row | None) -> AppointmentDraft | None:
        if row is None:
            return None
        return AppointmentDraft(
            workflow_id=row["workflow_id"],
            owner_id=row["owner_id"],
            customer_name=row["customer_name"],
            appointment_time=row["appointment_time"],
            request=row["request"],
            status=row["status"],
            version=row["version"],
            updated_at=row["updated_at"],
            expires_at=row["expires_at"],
        )

    def _read(self, connection: sqlite3.Connection, workflow_id: str) -> AppointmentDraft | None:
        return self._from_row(
            connection.execute(
                "SELECT * FROM appointment_workflows WHERE workflow_id = ?",
                (workflow_id,),
            ).fetchone()
        )

    def _replace(
        self,
        connection: sqlite3.Connection,
        draft: AppointmentDraft,
        *,
        version: int,
    ) -> AppointmentDraft:
        updated_at = time.time()
        connection.execute(
            """
            INSERT INTO appointment_workflows (
                workflow_id, owner_id, customer_name, appointment_time, request,
                status, version, updated_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(workflow_id) DO UPDATE SET
                owner_id = excluded.owner_id,
                customer_name = excluded.customer_name,
                appointment_time = excluded.appointment_time,
                request = excluded.request,
                status = excluded.status,
                version = excluded.version,
                updated_at = excluded.updated_at,
                expires_at = excluded.expires_at
            """,
            (
                draft.workflow_id,
                draft.owner_id,
                draft.customer_name,
                draft.appointment_time,
                draft.request,
                draft.status,
                version,
                updated_at,
                draft.expires_at,
            ),
        )
        stored = self._read(connection, draft.workflow_id)
        if stored is None:  # pragma: no cover - guarded by the insert above
            raise RuntimeError("workflow write did not produce a record")
        return stored

    @staticmethod
    def _append_audit(
        connection: sqlite3.Connection,
        draft: AppointmentDraft,
        *,
        actor_id: str,
        action: str,
        from_status: str,
        detail: str = "",
    ) -> None:
        connection.execute(
            """
            INSERT INTO appointment_workflow_audit (
                workflow_id, owner_id, actor_id, action, from_status,
                to_status, version, detail, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                draft.workflow_id,
                draft.owner_id,
                actor_id.strip() or draft.owner_id,
                action,
                from_status,
                draft.status,
                draft.version,
                detail.strip(),
                time.time(),
            ),
        )

    def create(
        self,
        owner_id: str,
        *,
        ttl_seconds: float = DEFAULT_TTL_SECONDS,
    ) -> AppointmentDraft:
        normalized_owner = owner_id.strip()
        if not normalized_owner:
            raise ValueError("workflow owner is required")
        if ttl_seconds <= 0:
            raise ValueError("workflow TTL must be positive")
        now = time.time()
        draft = AppointmentDraft(
            workflow_id=f"apt-{uuid.uuid4().hex[:8]}",
            owner_id=normalized_owner,
            status="collecting",
            expires_at=now + ttl_seconds,
        )
        with self._connect() as connection:
            stored = self._replace(connection, draft, version=1)
            self._append_audit(
                connection,
                stored,
                actor_id=normalized_owner,
                action="workflow_created",
                from_status="idle",
            )
            return stored

    def get(self, workflow_id: str, *, owner_id: str | None = None) -> AppointmentDraft | None:
        with self._connect() as connection:
            current = self._read(connection, workflow_id)
            if current and owner_id is not None and current.owner_id != owner_id:
                raise WorkflowOwnershipError("workflow belongs to another participant")
            return current

    def submit(
        self,
        workflow_id: str,
        *,
        owner_id: str,
        expected_version: int,
        customer_name: str,
        appointment_time: str,
        request: str,
    ) -> AppointmentDraft:
        self.expire_stale(owner_id=owner_id)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            current = self._require(connection, workflow_id, owner_id)
            self._check_version(current, expected_version)
            if current.status not in {"collecting", "paused"}:
                raise ValueError(f"cannot submit workflow in {current.status} state")
            current.customer_name = customer_name.strip()
            current.appointment_time = appointment_time.strip()
            current.request = request.strip()
            if not all((current.customer_name, current.appointment_time, current.request)):
                raise ValueError("appointment name, time, and request are required")
            from_status = current.status
            current.status = "review"
            stored = self._replace(connection, current, version=current.version + 1)
            self._append_audit(
                connection,
                stored,
                actor_id=owner_id,
                action="draft_submitted",
                from_status=from_status,
                detail=f"{stored.customer_name} / {stored.appointment_time} / {stored.request}",
            )
            return stored

    def pause(
        self, workflow_id: str, *, owner_id: str, expected_version: int
    ) -> AppointmentDraft:
        return self._transition(
            workflow_id,
            "paused",
            owner_id=owner_id,
            expected_version=expected_version,
            allowed={"review"},
            action="workflow_paused",
        )

    def cancel(
        self, workflow_id: str, *, owner_id: str, expected_version: int
    ) -> AppointmentDraft:
        return self._transition(
            workflow_id,
            "cancelled",
            owner_id=owner_id,
            expected_version=expected_version,
            allowed={"collecting", "review", "paused", "pending_approval"},
            idempotent=True,
            action="workflow_cancelled",
        )

    def confirm(
        self, workflow_id: str, *, owner_id: str, expected_version: int
    ) -> AppointmentDraft:
        return self._transition(
            workflow_id,
            "confirmed",
            owner_id=owner_id,
            expected_version=expected_version,
            allowed={"review"},
            idempotent=True,
            action="workflow_confirmed_legacy",
        )

    def request_approval(
        self,
        workflow_id: str,
        *,
        owner_id: str,
        expected_version: int,
        actor_id: str,
    ) -> AppointmentDraft:
        return self._transition(
            workflow_id,
            "pending_approval",
            owner_id=owner_id,
            expected_version=expected_version,
            allowed={"review"},
            action="approval_requested",
            actor_id=actor_id,
        )

    def approve(
        self,
        workflow_id: str,
        *,
        owner_id: str,
        expected_version: int,
        actor_id: str,
    ) -> AppointmentDraft:
        return self._transition(
            workflow_id,
            "confirmed",
            owner_id=owner_id,
            expected_version=expected_version,
            allowed={"pending_approval"},
            idempotent=True,
            action="approval_approved",
            actor_id=actor_id,
        )

    def reject(
        self,
        workflow_id: str,
        *,
        owner_id: str,
        expected_version: int,
        actor_id: str,
        reason: str,
    ) -> AppointmentDraft:
        normalized_reason = reason.strip()
        if not normalized_reason:
            raise ValueError("approval rejection reason is required")
        return self._transition(
            workflow_id,
            "rejected",
            owner_id=owner_id,
            expected_version=expected_version,
            allowed={"pending_approval"},
            idempotent=True,
            action="approval_rejected",
            actor_id=actor_id,
            detail=normalized_reason,
        )

    def expire(
        self, workflow_id: str, *, owner_id: str, expected_version: int
    ) -> AppointmentDraft:
        return self._transition(
            workflow_id,
            "expired",
            owner_id=owner_id,
            expected_version=expected_version,
            allowed=set(RESUMABLE_STATUSES),
            idempotent=True,
            check_clock=False,
            action="workflow_expired",
        )

    def expire_stale(self, *, owner_id: str | None = None, now: float | None = None) -> int:
        cutoff = time.time() if now is None else now
        placeholders = ",".join("?" for _ in RESUMABLE_STATUSES)
        params: list[object] = ["expired", cutoff, *RESUMABLE_STATUSES, cutoff]
        owner_clause = ""
        if owner_id is not None:
            owner_clause = " AND owner_id = ?"
            params.append(owner_id)
        with self._connect() as connection:
            cursor = connection.execute(
                f"""
                UPDATE appointment_workflows
                SET status = ?, version = version + 1, updated_at = ?
                WHERE status IN ({placeholders}) AND expires_at <= ?{owner_clause}
                """,
                params,
            )
            return cursor.rowcount

    def latest_resumable(self, owner_id: str) -> AppointmentDraft | None:
        self.expire_stale(owner_id=owner_id)
        placeholders = ",".join("?" for _ in RESUMABLE_STATUSES)
        with self._connect() as connection:
            row = connection.execute(
                f"""
                SELECT * FROM appointment_workflows
                WHERE owner_id = ? AND status IN ({placeholders})
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (owner_id, *RESUMABLE_STATUSES),
            ).fetchone()
            return self._from_row(row)

    def resume_latest(self, owner_id: str) -> AppointmentDraft | None:
        self.expire_stale(owner_id=owner_id)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            placeholders = ",".join("?" for _ in RESUMABLE_STATUSES)
            current = self._from_row(
                connection.execute(
                    f"""
                    SELECT * FROM appointment_workflows
                    WHERE owner_id = ? AND status IN ({placeholders})
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    (owner_id, *RESUMABLE_STATUSES),
                ).fetchone()
            )
            if current is None:
                return None
            target = current.status if current.status == "pending_approval" else (
                "review" if all(
                    (current.customer_name, current.appointment_time, current.request)
                ) else "collecting"
            )
            if current.status == target:
                return current
            current.status = target
            stored = self._replace(connection, current, version=current.version + 1)
            self._append_audit(
                connection,
                stored,
                actor_id=owner_id,
                action="workflow_resumed",
                from_status="paused",
            )
            return stored

    def list_audit(
        self,
        workflow_id: str,
        *,
        owner_id: str,
    ) -> list[WorkflowAuditEvent]:
        with self._connect() as connection:
            self._require_owner(connection, workflow_id, owner_id)
            rows = connection.execute(
                """
                SELECT * FROM appointment_workflow_audit
                WHERE workflow_id = ?
                ORDER BY event_id
                """,
                (workflow_id,),
            ).fetchall()
            return [WorkflowAuditEvent(**dict(row)) for row in rows]

    def count(self, workflow_id: str) -> int:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM appointment_workflows WHERE workflow_id = ?",
                (workflow_id,),
            ).fetchone()
            return int(row["count"])

    def _require(
        self,
        connection: sqlite3.Connection,
        workflow_id: str,
        owner_id: str,
    ) -> AppointmentDraft:
        current = self._read(connection, workflow_id)
        if current is None:
            raise LookupError(f"unknown workflow: {workflow_id}")
        if current.owner_id != owner_id:
            raise WorkflowOwnershipError("workflow belongs to another participant")
        if current.status == "expired":
            raise WorkflowExpiredError("workflow has expired")
        return current

    def _require_owner(
        self,
        connection: sqlite3.Connection,
        workflow_id: str,
        owner_id: str,
    ) -> AppointmentDraft:
        current = self._read(connection, workflow_id)
        if current is None:
            raise LookupError(f"unknown workflow: {workflow_id}")
        if current.owner_id != owner_id:
            raise WorkflowOwnershipError("workflow belongs to another participant")
        return current

    @staticmethod
    def _check_version(current: AppointmentDraft, expected_version: int) -> None:
        if current.version != expected_version:
            raise WorkflowConflictError(
                f"stale workflow version {expected_version}; current version is {current.version}"
            )

    def _transition(
        self,
        workflow_id: str,
        target: str,
        *,
        owner_id: str,
        expected_version: int,
        allowed: set[str],
        idempotent: bool = False,
        check_clock: bool = True,
        action: str,
        actor_id: str | None = None,
        detail: str = "",
    ) -> AppointmentDraft:
        if check_clock:
            self.expire_stale(owner_id=owner_id)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            current = self._require(connection, workflow_id, owner_id)
            if idempotent and current.status == target:
                return current
            self._check_version(current, expected_version)
            if current.status not in allowed:
                raise ValueError(f"cannot change workflow from {current.status} to {target}")
            from_status = current.status
            current.status = target
            stored = self._replace(connection, current, version=current.version + 1)
            self._append_audit(
                connection,
                stored,
                actor_id=actor_id or owner_id,
                action=action,
                from_status=from_status,
                detail=detail,
            )
            return stored
