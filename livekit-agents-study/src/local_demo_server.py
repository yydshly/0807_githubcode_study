from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import mimetypes
import os
import re
import signal
import subprocess
import sys
import urllib.error
import urllib.request
import warnings
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from livekit import api


PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_ROOT = PROJECT_ROOT / "local-app"
MINIMAX_READY_PATH = PROJECT_ROOT / ".local-state" / "minimax-agent.ready.json"
VENDOR_FILE = PROJECT_ROOT / "node_modules" / "livekit-client" / "dist" / "livekit-client.esm.mjs"
DEFAULT_LIVEKIT_URL = "ws://127.0.0.1:7880"
DEFAULT_WORKER_STATUS_URL = "http://127.0.0.1:8081/worker"
DEFAULT_ROOM = "local-demo"
DEV_API_KEY = "devkey"
DEV_API_SECRET = "secret"
NAME_PATTERN = re.compile(r"^[\w\-.\u4e00-\u9fff]{1,64}$", re.UNICODE)

# LiveKit's official --dev secret is intentionally short and triggers PyJWT's
# production-key warning. This process only signs localhost development tokens.
warnings.filterwarnings("ignore", message="The HMAC key is.*")


def validate_name(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} 必须是字符串")
    normalized = value.strip()
    if not NAME_PATTERN.fullmatch(normalized):
        raise ValueError(f"{field} 只能包含中英文、数字、下划线、短横线或点，长度 1–64")
    return normalized


def validate_display_name(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("participant_name 必须是字符串")
    normalized = value.strip()
    if not 1 <= len(normalized) <= 64 or any(ord(character) < 32 for character in normalized):
        raise ValueError("participant_name 长度必须为 1–64，且不能包含控制字符")
    return normalized


def build_participant_token(
    *,
    room_name: str,
    identity: str,
    display_name: str,
    api_key: str = DEV_API_KEY,
    api_secret: str = DEV_API_SECRET,
) -> str:
    return (
        api.AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_name(display_name)
        .with_ttl(dt.timedelta(hours=2))
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .to_jwt()
    )


def livekit_http_url(livekit_url: str) -> str:
    if livekit_url.startswith("wss://"):
        return "https://" + livekit_url[6:]
    if livekit_url.startswith("ws://"):
        return "http://" + livekit_url[5:]
    return livekit_url


def probe_livekit(livekit_url: str, timeout: float = 0.8) -> tuple[bool, str]:
    try:
        with urllib.request.urlopen(livekit_http_url(livekit_url), timeout=timeout) as response:
            body = response.read(64).decode("utf-8", errors="replace").strip()
            return response.status == HTTPStatus.OK, body or f"HTTP {response.status}"
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return False, str(exc.reason if isinstance(exc, urllib.error.URLError) else exc)


def worker_capacity_status(
    worker_status_url: str | None = None,
    *,
    timeout: float = 0.8,
) -> dict[str, Any]:
    try:
        configured_max = int(os.getenv("AGENT_MAX_CONCURRENT_JOBS", "2"))
    except ValueError:
        configured_max = 2
    configured_max = min(max(configured_max, 1), 8)
    raw_urls = os.getenv("AGENT_WORKER_STATUS_URLS", "").strip()
    status_urls = (
        [worker_status_url]
        if worker_status_url
        else [item.strip() for item in raw_urls.split(",") if item.strip()]
        or [DEFAULT_WORKER_STATUS_URL]
    )
    raw_ready_paths = os.getenv("AGENT_WORKER_READY_PATHS", "").strip()
    ready_paths = (
        [Path(item.strip()) for item in raw_ready_paths.split(",") if item.strip()]
        or [MINIMAX_READY_PATH]
    )
    registrations: list[dict[str, Any]] = []
    for ready_path in ready_paths:
        try:
            registrations.append(json.loads(ready_path.read_text(encoding="utf-8")))
        except (OSError, ValueError, json.JSONDecodeError):
            registrations.append({"ready_path": str(ready_path)})

    workers: list[dict[str, Any]] = []
    for index, status_url in enumerate(status_urls):
        registration = next(
            (item for item in registrations if item.get("status_url") == status_url),
            registrations[index] if index < len(registrations) else {},
        )
        base = {
            "instance_id": registration.get("instance_id", f"worker-{index + 1}"),
            "worker_id": registration.get("worker_id", ""),
            "pid": int(registration.get("pid", 0) or 0),
            "status_url": status_url,
            "max_concurrent_jobs": int(
                registration.get("max_concurrent_jobs", configured_max)
            ),
            "load_policy": registration.get("load_policy", "active-jobs"),
            "job_executor": registration.get("job_executor", "unknown"),
            "failure_lab_enabled": bool(
                registration.get("failure_lab_enabled", False)
            ),
        }
        try:
            with urllib.request.urlopen(status_url, timeout=timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            active_jobs = int(payload.get("active_jobs", 0))
            worker_load = float(payload.get("worker_load", 0.0))
            max_jobs = base["max_concurrent_jobs"]
            workers.append(
                {
                    **base,
                    "ready": True,
                    "agent_name": payload.get("agent_name", ""),
                    "active_jobs": active_jobs,
                    "worker_load": worker_load,
                    "availability": "full"
                    if active_jobs >= max_jobs or worker_load >= 1.0
                    else "available",
                    "sdk_version": payload.get("sdk_version", ""),
                }
            )
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as exc:
            workers.append(
                {
                    **base,
                    "ready": False,
                    "active_jobs": 0,
                    "worker_load": 0.0,
                    "availability": "offline",
                    "message": str(
                        exc.reason if isinstance(exc, urllib.error.URLError) else exc
                    ),
                }
            )

    online = [worker for worker in workers if worker["ready"]]
    active_jobs = sum(worker["active_jobs"] for worker in online)
    max_jobs = sum(worker["max_concurrent_jobs"] for worker in online)
    availability = (
        "offline"
        if not online
        else "available"
        if any(worker["availability"] == "available" for worker in online)
        else "full"
    )
    return {
        "ready": bool(online),
        "agent_name": online[0].get("agent_name", "") if online else "",
        "worker_id": online[0].get("worker_id", "") if len(online) == 1 else "",
        "configured_workers": len(workers),
        "online_workers": len(online),
        "active_jobs": active_jobs,
        "max_concurrent_jobs": max_jobs or configured_max * len(workers),
        "worker_load": active_jobs / max_jobs if max_jobs else 0.0,
        "availability": availability,
        "load_policy": "active-jobs-pool" if len(workers) > 1 else "active-jobs",
        "load_threshold": 1.0,
        "job_executor": "process" if online and all(worker["job_executor"] == "process" for worker in online) else "unknown",
        "failure_lab_enabled": bool(online) and all(worker["failure_lab_enabled"] for worker in online),
        "sdk_version": online[0].get("sdk_version", "") if online else "",
        "workers": workers,
    }


def agent_worker_ready(agent_mode: str) -> bool:
    if agent_mode in {"minimax-text-voice", "minimax-voice"}:
        return bool(worker_capacity_status().get("ready"))
    return agent_mode != "none"


def terminate_worker_for_lab(worker_id: str) -> dict[str, Any]:
    capacity = worker_capacity_status()
    online = [worker for worker in capacity.get("workers", []) if worker.get("ready")]
    if len(online) < 2:
        raise ValueError("至少需要两名在线 Worker 才能进行跨 Worker 故障实验")
    target = next((worker for worker in online if worker.get("worker_id") == worker_id), None)
    if target is None:
        raise ValueError("目标 Worker 不在线或不属于当前本地池")
    if int(target.get("active_jobs", 0)) != 1:
        raise ValueError("目标 Worker 必须只承载当前一个实验 Job，避免影响其他房间")
    pid = int(target.get("pid", 0))
    if pid <= 0:
        raise ValueError("目标 Worker 缺少可验证的本地 PID")
    if sys.platform.startswith("win"):
        result = subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            text=True,
            timeout=8,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "taskkill failed")
    else:
        os.kill(pid, signal.SIGTERM)
    return target


def serialize_dispatch(dispatch: Any) -> dict[str, Any]:
    restart_field = dispatch.DESCRIPTOR.fields_by_name["restart_policy"]
    restart_value = restart_field.enum_type.values_by_number.get(dispatch.restart_policy)
    jobs = []
    for job in dispatch.state.jobs:
        status_field = job.state.DESCRIPTOR.fields_by_name["status"]
        status_value = status_field.enum_type.values_by_number.get(job.state.status)
        jobs.append(
            {
                "job_id": job.id,
                "status": status_value.name.removeprefix("JS_").lower() if status_value else "unknown",
                "worker_id": job.state.worker_id,
                "participant_identity": job.state.participant_identity,
                "error": job.state.error,
                "started_at": job.state.started_at,
                "ended_at": job.state.ended_at,
                "updated_at": job.state.updated_at,
            }
        )
    return {
        "dispatch_id": dispatch.id,
        "agent_name": dispatch.agent_name,
        "room_name": dispatch.room,
        "metadata": dispatch.metadata,
        "deleted_at": dispatch.state.deleted_at,
        "restart_policy": (
            restart_value.name.removeprefix("JRP_").lower()
            if restart_value
            else "unknown"
        ),
        "jobs": jobs,
    }


async def create_or_get_dispatch(
    *,
    livekit_url: str,
    api_key: str,
    api_secret: str,
    agent_name: str,
    room_name: str,
    requester_identity: str,
) -> tuple[Any, bool]:
    async with api.LiveKitAPI(
        url=livekit_http_url(livekit_url),
        api_key=api_key,
        api_secret=api_secret,
    ) as client:
        dispatches = await client.agent_dispatch.list_dispatch(room_name)
        for dispatch in dispatches:
            if dispatch.agent_name == agent_name and not dispatch.state.deleted_at:
                return dispatch, False
        dispatch = await client.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name=agent_name,
                room=room_name,
                restart_policy=api.JobRestartPolicy.JRP_ON_FAILURE,
                metadata=json.dumps(
                    {
                        "source": "local-capability-lab",
                        "requested_by": requester_identity,
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                ),
            )
        )
        return dispatch, True


async def list_room_dispatches(
    *,
    livekit_url: str,
    api_key: str,
    api_secret: str,
    room_name: str,
) -> list[Any]:
    async with api.LiveKitAPI(
        url=livekit_http_url(livekit_url),
        api_key=api_key,
        api_secret=api_secret,
    ) as client:
        return await client.agent_dispatch.list_dispatch(room_name)


async def retry_waiting_dispatch(
    *,
    livekit_url: str,
    api_key: str,
    api_secret: str,
    agent_name: str,
    room_name: str,
    requester_identity: str,
) -> tuple[Any, str]:
    async with api.LiveKitAPI(
        url=livekit_http_url(livekit_url),
        api_key=api_key,
        api_secret=api_secret,
    ) as client:
        dispatches = await client.agent_dispatch.list_dispatch(room_name)
        waiting = next(
            (
                dispatch
                for dispatch in reversed(dispatches)
                if dispatch.agent_name == agent_name
                and not dispatch.state.deleted_at
                and not dispatch.state.jobs
            ),
            None,
        )
        if waiting is None:
            raise ValueError("当前房间没有可重新提交的等待 Dispatch")
        old_dispatch_id = waiting.id
        await client.agent_dispatch.delete_dispatch(old_dispatch_id, room_name)
        replacement = await client.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name=agent_name,
                room=room_name,
                restart_policy=api.JobRestartPolicy.JRP_ON_FAILURE,
                metadata=json.dumps(
                    {
                        "source": "local-capability-lab-requeue",
                        "requested_by": requester_identity,
                        "retry_of": old_dispatch_id,
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                ),
            )
        )
        return replacement, old_dispatch_id


async def recover_stalled_dispatch(
    *,
    livekit_url: str,
    api_key: str,
    api_secret: str,
    agent_name: str,
    room_name: str,
    requester_identity: str,
) -> tuple[Any, str]:
    """Replace a stale running Dispatch after its Agent participant disappeared."""
    async with api.LiveKitAPI(
        url=livekit_http_url(livekit_url),
        api_key=api_key,
        api_secret=api_secret,
    ) as client:
        participants = await client.room.list_participants(
            api.ListParticipantsRequest(room=room_name)
        )
        if any(participant.identity.lower().startswith("agent-") for participant in participants.participants):
            raise ValueError("当前房间仍有 Agent 参与者，不能替换运行中的 Dispatch")
        dispatches = await client.agent_dispatch.list_dispatch(room_name)
        stalled = next(
            (
                dispatch
                for dispatch in reversed(dispatches)
                if dispatch.agent_name == agent_name
                and not dispatch.state.deleted_at
                and dispatch.state.jobs
            ),
            None,
        )
        if stalled is None:
            raise ValueError("当前房间没有可恢复的失联 Dispatch")
        old_dispatch_id = stalled.id
        await client.agent_dispatch.delete_dispatch(old_dispatch_id, room_name)
        replacement = await client.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name=agent_name,
                room=room_name,
                restart_policy=api.JobRestartPolicy.JRP_ON_FAILURE,
                metadata=json.dumps(
                    {
                        "source": "local-capability-lab-recovery",
                        "requested_by": requester_identity,
                        "recovery_of": old_dispatch_id,
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                ),
            )
        )
        return replacement, old_dispatch_id


class LocalDemoHandler(BaseHTTPRequestHandler):
    livekit_url = DEFAULT_LIVEKIT_URL
    api_key = DEV_API_KEY
    api_secret = DEV_API_SECRET
    agent_mode = "local-text"
    agent_dispatch_name = ""
    server_version = "LiveKitLocalDemo/1.0"

    def do_GET(self) -> None:  # noqa: N802
        url_parts = urlsplit(self.path)
        path = unquote(url_parts.path)
        if path == "/api/status":
            ready, detail = probe_livekit(self.livekit_url)
            capacity = worker_capacity_status()
            self._send_json(
                {
                    "app_ready": True,
                    "livekit_ready": ready,
                    "livekit_detail": detail,
                    "server_url": self.livekit_url,
                    "default_room": DEFAULT_ROOM,
                    "token_service": "local-only",
                    "agent_mode": self.agent_mode,
                    "agent_worker_ready": (
                        bool(capacity.get("ready"))
                        if self.agent_mode in {"minimax-text-voice", "minimax-voice"}
                        else agent_worker_ready(self.agent_mode)
                    ),
                    "dispatch_mode": "explicit" if self.agent_dispatch_name else "automatic",
                    "agent_name": self.agent_dispatch_name,
                    "worker_capacity": capacity,
                    "conversation_mode": "stable-turn",
                    "min_silence_duration": float(
                        os.getenv("AGENT_MIN_SILENCE_SECONDS", "0.8")
                    ),
                    "voice_model_configured": self.agent_mode
                    in {"openai-realtime", "minimax-text-voice", "minimax-voice"},
                },
                status=HTTPStatus.OK if ready else HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        if path == "/api/worker":
            self._send_json(worker_capacity_status())
            return
        if path == "/api/dispatch":
            try:
                room_values = parse_qs(url_parts.query).get("room_name", [])
                room_name = validate_name(room_values[0] if room_values else None, "room_name")
                dispatches = asyncio.run(
                    list_room_dispatches(
                        livekit_url=self.livekit_url,
                        api_key=self.api_key,
                        api_secret=self.api_secret,
                        room_name=room_name,
                    )
                )
            except (ValueError, api.TwirpError) as exc:
                self._send_json(
                    {"error": "dispatch_query_failed", "message": str(exc)},
                    status=HTTPStatus.BAD_REQUEST,
                )
                return
            self._send_json(
                {
                    "dispatch_mode": "explicit" if self.agent_dispatch_name else "automatic",
                    "agent_name": self.agent_dispatch_name,
                    "room_name": room_name,
                    "dispatches": [serialize_dispatch(dispatch) for dispatch in dispatches],
                }
            )
            return
        if path == "/vendor/livekit-client.esm.mjs":
            self._send_file(VENDOR_FILE, "text/javascript; charset=utf-8")
            return
        if path in {"", "/"}:
            path = "/index.html"
        self._send_static(path)

    def do_HEAD(self) -> None:  # noqa: N802
        path = unquote(urlsplit(self.path).path)
        if path in {"", "/"}:
            path = "/index.html"
        if path == "/vendor/livekit-client.esm.mjs":
            self._send_file(VENDOR_FILE, "text/javascript; charset=utf-8", head_only=True)
            return
        self._send_static(path, head_only=True)

    def do_POST(self) -> None:  # noqa: N802
        path = unquote(urlsplit(self.path).path)
        if path == "/api/worker/fail":
            self._handle_worker_failure()
            return
        if path == "/api/dispatch/recover":
            self._handle_dispatch_recovery()
            return
        if path == "/api/dispatch/retry":
            self._handle_dispatch_retry()
            return
        if path == "/api/dispatch":
            self._handle_dispatch_create()
            return
        if path != "/api/token":
            self._send_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)
            return

        ready, detail = probe_livekit(self.livekit_url)
        if not ready:
            self._send_json(
                {"error": "livekit_offline", "message": f"LiveKit 尚未就绪：{detail}"},
                status=HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return

        try:
            payload = self._read_json()
            room_name = validate_name(payload.get("room_name", DEFAULT_ROOM), "room_name")
            identity = validate_name(payload.get("participant_identity"), "participant_identity")
            display_name = validate_display_name(payload.get("participant_name", identity))
            token = build_participant_token(
                room_name=room_name,
                identity=identity,
                display_name=display_name,
                api_key=self.api_key,
                api_secret=self.api_secret,
            )
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json(
                {"error": "invalid_request", "message": str(exc)},
                status=HTTPStatus.BAD_REQUEST,
            )
            return

        self._send_json(
            {
                "server_url": self.livekit_url,
                "participant_token": token,
                "room_name": room_name,
                "participant_identity": identity,
            }
        )

    def _handle_dispatch_create(self) -> None:
        if not self.agent_dispatch_name:
            self._send_json(
                {
                    "error": "automatic_dispatch_mode",
                    "message": "当前 Worker 是匿名自动调度模式，不需要显式 dispatch。",
                },
                status=HTTPStatus.CONFLICT,
            )
            return
        ready, detail = probe_livekit(self.livekit_url)
        if not ready:
            self._send_json(
                {"error": "livekit_offline", "message": f"LiveKit 尚未就绪：{detail}"},
                status=HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        try:
            payload = self._read_json()
            room_name = validate_name(payload.get("room_name"), "room_name")
            requester_identity = validate_name(
                payload.get("participant_identity"), "participant_identity"
            )
            dispatch, created = asyncio.run(
                create_or_get_dispatch(
                    livekit_url=self.livekit_url,
                    api_key=self.api_key,
                    api_secret=self.api_secret,
                    agent_name=self.agent_dispatch_name,
                    room_name=room_name,
                    requester_identity=requester_identity,
                )
            )
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json(
                {"error": "invalid_request", "message": str(exc)},
                status=HTTPStatus.BAD_REQUEST,
            )
            return
        except api.TwirpError as exc:
            self._send_json(
                {"error": "dispatch_failed", "message": str(exc)},
                status=HTTPStatus.BAD_GATEWAY,
            )
            return
        self._send_json(
            {
                "created": created,
                "dispatch_mode": "explicit",
                "dispatch": serialize_dispatch(dispatch),
            },
            status=HTTPStatus.CREATED if created else HTTPStatus.OK,
        )

    def _handle_worker_failure(self) -> None:
        if not self.agent_dispatch_name:
            self._send_json(
                {"error": "automatic_dispatch_mode", "message": "当前模式没有命名 Worker 池。"},
                status=HTTPStatus.CONFLICT,
            )
            return
        try:
            payload = self._read_json()
            room_name = validate_name(payload.get("room_name"), "room_name")
            worker_id = validate_name(payload.get("worker_id"), "worker_id")
            job_id = validate_name(payload.get("job_id"), "job_id")
            validate_name(payload.get("participant_identity"), "participant_identity")
            dispatches = asyncio.run(
                list_room_dispatches(
                    livekit_url=self.livekit_url,
                    api_key=self.api_key,
                    api_secret=self.api_secret,
                    room_name=room_name,
                )
            )
            matches_job = any(
                job.id == job_id and job.state.worker_id == worker_id
                for dispatch in dispatches
                if dispatch.agent_name == self.agent_dispatch_name
                and not dispatch.state.deleted_at
                for job in dispatch.state.jobs
            )
            if not matches_job:
                raise ValueError("当前房间的活动 Dispatch 与目标 Worker/Job 不一致")
            terminated = terminate_worker_for_lab(worker_id)
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json(
                {"error": "invalid_worker_failure", "message": str(exc)},
                status=HTTPStatus.CONFLICT,
            )
            return
        except (api.TwirpError, RuntimeError, OSError, subprocess.SubprocessError) as exc:
            self._send_json(
                {"error": "worker_failure_failed", "message": str(exc)},
                status=HTTPStatus.BAD_GATEWAY,
            )
            return
        self._send_json(
            {
                "terminated": True,
                "worker_id": worker_id,
                "instance_id": terminated.get("instance_id", ""),
                "pid": terminated.get("pid", 0),
                "job_id": job_id,
            },
            status=HTTPStatus.ACCEPTED,
        )

    def _handle_dispatch_retry(self) -> None:
        if not self.agent_dispatch_name:
            self._send_json(
                {"error": "automatic_dispatch_mode", "message": "当前模式不需要显式重投。"},
                status=HTTPStatus.CONFLICT,
            )
            return
        capacity = worker_capacity_status()
        if not capacity.get("ready"):
            self._send_json(
                {"error": "worker_offline", "message": "Worker 尚未就绪。"},
                status=HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        if capacity.get("availability") != "available":
            self._send_json(
                {"error": "worker_full", "message": "Worker 仍处于满载，请先释放一个房间。"},
                status=HTTPStatus.CONFLICT,
            )
            return
        try:
            payload = self._read_json()
            room_name = validate_name(payload.get("room_name"), "room_name")
            requester_identity = validate_name(
                payload.get("participant_identity"), "participant_identity"
            )
            dispatch, replaced_dispatch_id = asyncio.run(
                retry_waiting_dispatch(
                    livekit_url=self.livekit_url,
                    api_key=self.api_key,
                    api_secret=self.api_secret,
                    agent_name=self.agent_dispatch_name,
                    room_name=room_name,
                    requester_identity=requester_identity,
                )
            )
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json(
                {"error": "invalid_retry", "message": str(exc)},
                status=HTTPStatus.BAD_REQUEST,
            )
            return
        except api.TwirpError as exc:
            self._send_json(
                {"error": "dispatch_retry_failed", "message": str(exc)},
                status=HTTPStatus.BAD_GATEWAY,
            )
            return
        self._send_json(
            {
                "created": True,
                "requeued": True,
                "replaced_dispatch_id": replaced_dispatch_id,
                "dispatch": serialize_dispatch(dispatch),
            },
            status=HTTPStatus.CREATED,
        )

    def _handle_dispatch_recovery(self) -> None:
        if not self.agent_dispatch_name:
            self._send_json(
                {"error": "automatic_dispatch_mode", "message": "当前模式不需要手动恢复。"},
                status=HTTPStatus.CONFLICT,
            )
            return
        capacity = worker_capacity_status()
        if not capacity.get("ready"):
            self._send_json(
                {"error": "worker_offline", "message": "Worker 尚未就绪。"},
                status=HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        if capacity.get("availability") != "available":
            self._send_json(
                {"error": "worker_full", "message": "Worker 当前没有恢复空位。"},
                status=HTTPStatus.CONFLICT,
            )
            return
        try:
            payload = self._read_json()
            room_name = validate_name(payload.get("room_name"), "room_name")
            requester_identity = validate_name(
                payload.get("participant_identity"), "participant_identity"
            )
            dispatch, replaced_dispatch_id = asyncio.run(
                recover_stalled_dispatch(
                    livekit_url=self.livekit_url,
                    api_key=self.api_key,
                    api_secret=self.api_secret,
                    agent_name=self.agent_dispatch_name,
                    room_name=room_name,
                    requester_identity=requester_identity,
                )
            )
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json(
                {"error": "invalid_recovery", "message": str(exc)},
                status=HTTPStatus.CONFLICT,
            )
            return
        except api.TwirpError as exc:
            self._send_json(
                {"error": "dispatch_recovery_failed", "message": str(exc)},
                status=HTTPStatus.BAD_GATEWAY,
            )
            return
        self._send_json(
            {
                "created": True,
                "recovered": True,
                "replaced_dispatch_id": replaced_dispatch_id,
                "dispatch": serialize_dispatch(dispatch),
            },
            status=HTTPStatus.CREATED,
        )

    def _read_json(self) -> dict[str, Any]:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise ValueError("无效的 Content-Length") from exc
        if length <= 0 or length > 8192:
            raise ValueError("请求体大小必须在 1–8192 字节之间")
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("请求体必须是 JSON 对象")
        return payload

    def _send_static(self, request_path: str, *, head_only: bool = False) -> None:
        relative = request_path.lstrip("/")
        candidate = (STATIC_ROOT / relative).resolve()
        try:
            candidate.relative_to(STATIC_ROOT.resolve())
        except ValueError:
            self._send_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)
            return
        if not candidate.is_file():
            self._send_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)
            return
        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or candidate.suffix in {".js", ".mjs", ".css"}:
            content_type += "; charset=utf-8"
        self._send_file(candidate, content_type, head_only=head_only)

    def _send_file(self, path: Path, content_type: str, *, head_only: bool = False) -> None:
        if not path.is_file():
            self._send_json(
                {"error": "missing_dependency", "message": f"缺少本地文件：{path.name}"},
                status=HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self._send_common_headers(content_type, len(data))
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_common_headers("application/json; charset=utf-8", len(data), no_store=True)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _send_common_headers(
        self,
        content_type: str,
        length: int,
        *,
        no_store: bool = False,
    ) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store" if no_store else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "connect-src 'self' ws://127.0.0.1:7880 ws://localhost:7880; "
            "media-src 'self' blob:; img-src 'self' data:; worker-src 'self' blob:",
        )

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[local-demo] {self.address_string()} {fmt % args}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the local LiveKit room demo and token API.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=17828)
    parser.add_argument("--livekit-url", default=DEFAULT_LIVEKIT_URL)
    parser.add_argument("--api-key", default=DEV_API_KEY)
    parser.add_argument("--api-secret", default=DEV_API_SECRET)
    parser.add_argument(
        "--agent-mode",
        choices=("local-text", "openai-realtime", "minimax-text-voice", "minimax-voice", "none"),
        default="local-text",
    )
    parser.add_argument("--agent-name", default=os.getenv("LIVEKIT_AGENT_NAME", ""))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    LocalDemoHandler.livekit_url = args.livekit_url
    LocalDemoHandler.api_key = args.api_key
    LocalDemoHandler.api_secret = args.api_secret
    LocalDemoHandler.agent_mode = args.agent_mode
    LocalDemoHandler.agent_dispatch_name = args.agent_name.strip()
    server = ThreadingHTTPServer((args.host, args.port), LocalDemoHandler)
    print(f"Local LiveKit console: http://{args.host}:{args.port}")
    print(f"LiveKit signal URL: {args.livekit_url}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
