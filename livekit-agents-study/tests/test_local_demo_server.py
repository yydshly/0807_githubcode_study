from __future__ import annotations

import base64
import asyncio
import json
import threading
import urllib.error
import urllib.request
from types import SimpleNamespace

import pytest
from livekit import api

from src import local_demo_server


pytestmark = pytest.mark.filterwarnings("ignore:The HMAC key is.*")


def decode_payload(token: str) -> dict[str, object]:
    encoded = token.split(".")[1]
    encoded += "=" * (-len(encoded) % 4)
    return json.loads(base64.urlsafe_b64decode(encoded))


def test_validate_name_accepts_local_identifiers() -> None:
    assert local_demo_server.validate_name("local-demo", "room") == "local-demo"
    assert local_demo_server.validate_name(" 本地访客_01 ", "identity") == "本地访客_01"
    assert local_demo_server.validate_display_name(" Local Visitor ") == "Local Visitor"


def test_token_contains_room_grants_without_secret() -> None:
    token = local_demo_server.build_participant_token(
        room_name="local-demo",
        identity="visitor-test",
        display_name="Local Visitor",
    )
    payload = decode_payload(token)
    assert payload["iss"] == "devkey"
    assert payload["sub"] == "visitor-test"
    assert payload["video"] == {
        "roomJoin": True,
        "room": "local-demo",
        "canPublish": True,
        "canSubscribe": True,
        "canPublishData": True,
    }
    assert "secret" not in json.dumps(payload)


def test_http_status_and_token_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(local_demo_server, "probe_livekit", lambda *_args, **_kwargs: (True, "OK"))
    server = local_demo_server.ThreadingHTTPServer(("127.0.0.1", 0), local_demo_server.LocalDemoHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        with urllib.request.urlopen(f"{origin}/api/status") as response:
            status = json.load(response)
        assert status["livekit_ready"] is True
        assert status["agent_mode"] == "local-text"
        assert status["agent_worker_ready"] is True
        assert status["conversation_mode"] == "stable-turn"
        assert status["min_silence_duration"] == 0.8
        assert status["voice_model_configured"] is False
        assert status["dispatch_mode"] == "automatic"
        assert status["agent_name"] == ""

        monkeypatch.setattr(local_demo_server.LocalDemoHandler, "agent_mode", "minimax-text-voice")
        monkeypatch.setattr(local_demo_server, "worker_capacity_status", lambda: {"ready": False})
        with urllib.request.urlopen(f"{origin}/api/status") as response:
            minimax_status = json.load(response)
        assert minimax_status["agent_mode"] == "minimax-text-voice"
        assert minimax_status["voice_model_configured"] is True
        assert minimax_status["agent_worker_ready"] is False

        monkeypatch.setattr(local_demo_server.LocalDemoHandler, "agent_mode", "minimax-voice")
        monkeypatch.setattr(local_demo_server, "worker_capacity_status", lambda: {"ready": True})
        with urllib.request.urlopen(f"{origin}/api/status") as response:
            minimax_voice_status = json.load(response)
        assert minimax_voice_status["agent_mode"] == "minimax-voice"
        assert minimax_voice_status["voice_model_configured"] is True
        assert minimax_voice_status["agent_worker_ready"] is True

        request = urllib.request.Request(
            f"{origin}/api/token",
            data=json.dumps(
                {
                    "room_name": "local-demo",
                    "participant_identity": "visitor-http",
                    "participant_name": "HTTP Visitor",
                }
            ).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request) as response:
            body = response.read().decode()
        payload = json.loads(body)
        assert payload["server_url"] == "ws://127.0.0.1:7880"
        assert decode_payload(payload["participant_token"])["sub"] == "visitor-http"
        assert "secret" not in body
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_dispatch_serialization_exposes_job_and_worker() -> None:
    dispatch = api.AgentDispatch(
        id="AD_test",
        agent_name="livekit-research-minimax",
        room="room-test",
        restart_policy=api.JobRestartPolicy.JRP_ON_FAILURE,
        state=api.AgentDispatchState(
            jobs=[
                api.Job(
                    id="J_test",
                    agent_name="livekit-research-minimax",
                    state=api.JobState(
                        status=api.JobStatus.JS_RUNNING,
                        worker_id="W_test",
                        participant_identity="agent-test",
                        started_at=100,
                        updated_at=101,
                    ),
                )
            ]
        ),
    )

    assert local_demo_server.serialize_dispatch(dispatch) == {
        "dispatch_id": "AD_test",
        "agent_name": "livekit-research-minimax",
        "room_name": "room-test",
        "metadata": "",
        "deleted_at": 0,
        "restart_policy": "on_failure",
        "jobs": [
            {
                "job_id": "J_test",
                "status": "running",
                "worker_id": "W_test",
                "participant_identity": "agent-test",
                "error": "",
                "started_at": 100,
                "ended_at": 0,
                "updated_at": 101,
            }
        ],
    }


def test_named_dispatch_is_idempotent_per_room(monkeypatch: pytest.MonkeyPatch) -> None:
    dispatches: list[api.AgentDispatch] = []
    requests: list[api.CreateAgentDispatchRequest] = []

    class FakeDispatchService:
        async def list_dispatch(self, room_name: str) -> list[api.AgentDispatch]:
            return [item for item in dispatches if item.room == room_name]

        async def create_dispatch(self, request: api.CreateAgentDispatchRequest) -> api.AgentDispatch:
            requests.append(request)
            dispatch = api.AgentDispatch(
                id="AD_once",
                agent_name=request.agent_name,
                room=request.room,
                metadata=request.metadata,
                state=api.AgentDispatchState(),
            )
            dispatches.append(dispatch)
            return dispatch

    class FakeLiveKitAPI:
        def __init__(self, **_kwargs: object) -> None:
            self.agent_dispatch = FakeDispatchService()

        async def __aenter__(self) -> "FakeLiveKitAPI":
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

    monkeypatch.setattr(local_demo_server.api, "LiveKitAPI", FakeLiveKitAPI)
    kwargs = {
        "livekit_url": "ws://127.0.0.1:7880",
        "api_key": "devkey",
        "api_secret": "secret",
        "agent_name": "livekit-research-minimax",
        "room_name": "room-test",
        "requester_identity": "visitor-test",
    }

    first, first_created = asyncio.run(local_demo_server.create_or_get_dispatch(**kwargs))
    second, second_created = asyncio.run(local_demo_server.create_or_get_dispatch(**kwargs))

    assert first.id == second.id == "AD_once"
    assert first_created is True
    assert second_created is False
    assert len(requests) == 1
    assert json.loads(requests[0].metadata)["requested_by"] == "visitor-test"
    assert requests[0].restart_policy == api.JobRestartPolicy.JRP_ON_FAILURE


def test_worker_capacity_status_normalizes_full_and_available(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResponse:
        def __init__(self, payload: dict[str, object]) -> None:
            self.payload = payload

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return json.dumps(self.payload).encode()

    monkeypatch.setenv("AGENT_MAX_CONCURRENT_JOBS", "2")
    monkeypatch.setattr(
        local_demo_server.urllib.request,
        "urlopen",
        lambda *_args, **_kwargs: FakeResponse(
            {
                "agent_name": "livekit-research-minimax",
                "active_jobs": 2,
                "worker_load": 1.0,
                "sdk_version": "1.6.8",
            }
        ),
    )
    full = local_demo_server.worker_capacity_status()
    assert full["active_jobs"] == 2
    assert full["max_concurrent_jobs"] == 2
    assert full["availability"] == "full"

    monkeypatch.setattr(
        local_demo_server.urllib.request,
        "urlopen",
        lambda *_args, **_kwargs: FakeResponse(
            {
                "agent_name": "livekit-research-minimax",
                "active_jobs": 1,
                "worker_load": 0.5,
                "sdk_version": "1.6.8",
            }
        ),
    )
    available = local_demo_server.worker_capacity_status()
    assert available["availability"] == "available"
    assert available["worker_load"] == 0.5


def test_worker_capacity_status_aggregates_two_distinct_workers(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    class FakeResponse:
        def __init__(self, payload: dict[str, object]) -> None:
            self.payload = payload

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return json.dumps(self.payload).encode()

    urls = ["http://127.0.0.1:8081/", "http://127.0.0.1:8082/"]
    ready_paths = [tmp_path / "worker-1.json", tmp_path / "worker-2.json"]
    for index, ready_path in enumerate(ready_paths, start=1):
        ready_path.write_text(
            json.dumps(
                {
                    "instance_id": f"worker-{index}",
                    "worker_id": f"W_{index}",
                    "pid": 1000 + index,
                    "status_url": urls[index - 1],
                    "max_concurrent_jobs": 2,
                    "job_executor": "process",
                    "failure_lab_enabled": True,
                }
            ),
            encoding="utf-8",
        )
    monkeypatch.setenv("AGENT_WORKER_STATUS_URLS", ",".join(urls))
    monkeypatch.setenv("AGENT_WORKER_READY_PATHS", ",".join(map(str, ready_paths)))
    payloads = {
        urls[0]: {"agent_name": "livekit-research-minimax", "active_jobs": 1, "worker_load": 0.5},
        urls[1]: {"agent_name": "livekit-research-minimax", "active_jobs": 0, "worker_load": 0.0},
    }
    monkeypatch.setattr(
        local_demo_server.urllib.request,
        "urlopen",
        lambda url, **_kwargs: FakeResponse(payloads[str(url)]),
    )

    capacity = local_demo_server.worker_capacity_status()

    assert capacity["configured_workers"] == 2
    assert capacity["online_workers"] == 2
    assert capacity["active_jobs"] == 1
    assert capacity["max_concurrent_jobs"] == 4
    assert capacity["worker_load"] == 0.25
    assert capacity["load_policy"] == "active-jobs-pool"
    assert [worker["worker_id"] for worker in capacity["workers"]] == ["W_1", "W_2"]


def test_worker_failure_lab_targets_only_single_job_worker(monkeypatch: pytest.MonkeyPatch) -> None:
    capacity = {
        "workers": [
            {"instance_id": "worker-1", "worker_id": "W_1", "pid": 1001, "ready": True, "active_jobs": 1},
            {"instance_id": "worker-2", "worker_id": "W_2", "pid": 1002, "ready": True, "active_jobs": 0},
        ]
    }
    calls: list[list[str]] = []
    monkeypatch.setattr(local_demo_server, "worker_capacity_status", lambda: capacity)
    monkeypatch.setattr(local_demo_server.sys, "platform", "win32")
    monkeypatch.setattr(
        local_demo_server.subprocess,
        "run",
        lambda command, **_kwargs: calls.append(command) or SimpleNamespace(returncode=0, stdout="", stderr=""),
    )

    target = local_demo_server.terminate_worker_for_lab("W_1")

    assert target["instance_id"] == "worker-1"
    assert calls == [["taskkill", "/PID", "1001", "/T", "/F"]]
    capacity["workers"][0]["active_jobs"] = 2
    with pytest.raises(ValueError, match="只承载当前一个"):
        local_demo_server.terminate_worker_for_lab("W_1")


def test_retry_waiting_dispatch_replaces_unassigned_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    waiting = api.AgentDispatch(
        id="AD_waiting",
        agent_name="livekit-research-minimax",
        room="room-waiting",
        state=api.AgentDispatchState(),
    )
    dispatches = [waiting]
    deleted: list[str] = []

    class FakeDispatchService:
        async def list_dispatch(self, _room_name: str) -> list[api.AgentDispatch]:
            return dispatches

        async def delete_dispatch(self, dispatch_id: str, _room_name: str) -> api.AgentDispatch:
            deleted.append(dispatch_id)
            dispatches.clear()
            return waiting

        async def create_dispatch(self, request: api.CreateAgentDispatchRequest) -> api.AgentDispatch:
            replacement = api.AgentDispatch(
                id="AD_requeued",
                agent_name=request.agent_name,
                room=request.room,
                metadata=request.metadata,
                restart_policy=request.restart_policy,
                state=api.AgentDispatchState(),
            )
            dispatches.append(replacement)
            return replacement

    class FakeLiveKitAPI:
        def __init__(self, **_kwargs: object) -> None:
            self.agent_dispatch = FakeDispatchService()

        async def __aenter__(self) -> "FakeLiveKitAPI":
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

    monkeypatch.setattr(local_demo_server.api, "LiveKitAPI", FakeLiveKitAPI)
    replacement, old_id = asyncio.run(
        local_demo_server.retry_waiting_dispatch(
            livekit_url="ws://127.0.0.1:7880",
            api_key="devkey",
            api_secret="secret",
            agent_name="livekit-research-minimax",
            room_name="room-waiting",
            requester_identity="visitor-retry",
        )
    )

    assert old_id == "AD_waiting"
    assert deleted == ["AD_waiting"]
    assert replacement.id == "AD_requeued"
    metadata = json.loads(replacement.metadata)
    assert metadata["retry_of"] == "AD_waiting"
    assert metadata["requested_by"] == "visitor-retry"
    assert replacement.restart_policy == api.JobRestartPolicy.JRP_ON_FAILURE


def test_http_token_endpoint_rejects_invalid_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(local_demo_server, "probe_livekit", lambda *_args, **_kwargs: (True, "OK"))
    server = local_demo_server.ThreadingHTTPServer(("127.0.0.1", 0), local_demo_server.LocalDemoHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        request = urllib.request.Request(
            f"http://127.0.0.1:{server.server_port}/api/token",
            data=json.dumps(
                {
                    "room_name": "local-demo",
                    "participant_identity": "invalid identity with spaces",
                }
            ).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with pytest.raises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(request)
        assert error.value.code == 400
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
