#!/usr/bin/env python3
"""G2 SQLite smoke: student Submit 1 -> officer claim/prepare/Submit 2.

Mặc định tạo DB SQLite tạm, migrate + seed, rồi tự chạy API/worker trên cổng riêng.
Không ghi thêm vào data/app.db demo dùng chung.

  python scripts/g2_stub_e2e.py

Dùng server đang chạy (có thể là app.db) khi người điều hành chủ động chọn:

  python scripts/g2_stub_e2e.py --live --base-url http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import atexit
import json
import os
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class ApiError(RuntimeError):
    def __init__(self, status: int, body: object, request_id: str | None):
        self.status = status
        self.body = body
        self.request_id = request_id
        super().__init__(f"HTTP {status} request_id={request_id} body={body}")


class Client:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None
        self.last_request_id: str | None = None

    def request(self, method: str, path: str, body: object | None = None, idempotency_key: str | None = None) -> object:
        headers = {"Accept": "application/json"}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        req = Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            with urlopen(req, timeout=30) as response:
                raw = response.read()
                self.last_request_id = response.headers.get("X-Request-Id")
                if response.status == 204 or not raw:
                    return None
                return json.loads(raw.decode("utf-8"))
        except HTTPError as exc:
            raw = exc.read()
            parsed: object
            try:
                parsed = json.loads(raw.decode("utf-8")) if raw else None
            except json.JSONDecodeError:
                parsed = raw.decode("utf-8", errors="replace")
            request_id = exc.headers.get("X-Request-Id") if exc.headers else None
            self.last_request_id = request_id
            raise ApiError(exc.code, parsed, request_id) from exc

    def login(self, user_id: str) -> dict:
        self.token = None
        result = self.request("POST", "/api/v1/auth/demo-login", {"user_id": user_id})
        assert isinstance(result, dict)
        self.token = result["access_token"]
        return result


def wait_brief(client: Client, ticket_id: str, timeout_s: float = 40.0) -> dict:
    deadline = time.time() + timeout_s
    last: dict | None = None
    while time.time() < deadline:
        envelope = client.request("GET", f"/api/v1/officer/tickets/{ticket_id}/brief")
        assert isinstance(envelope, dict)
        last = envelope
        if envelope.get("status") in {"ready", "failed"}:
            return envelope
        time.sleep(1)
    raise TimeoutError(f"brief not ready: {last}")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def wait_http(url: str, timeout_s: float = 20.0) -> None:
    deadline = time.time() + timeout_s
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=2) as response:
                if response.status < 500:
                    return
        except (URLError, OSError) as exc:
            last_error = exc
        time.sleep(0.3)
    raise TimeoutError(f"server not ready at {url}: {last_error}")


def start_temp_stack(port: int) -> tuple[str, dict[str, object], list[subprocess.Popen[bytes]], Path]:
    root = repo_root()
    workdir = Path(tempfile.mkdtemp(prefix="g2e2e_"))
    db_path = workdir / "g2e2e.db"
    database_url = f"sqlite:///{db_path}"
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    env["AGENT_MODE"] = "stub"
    env["PYTHONPATH"] = str(root / "backend" / "src")
    env["PYTHONUNBUFFERED"] = "1"
    venv_python = root / ".venv" / "bin" / "python"
    python = str(venv_python if venv_python.exists() else sys.executable)
    subprocess.run(
        [python, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=root / "backend",
        env=env,
        check=True,
    )
    subprocess.run(
        [python, "-m", "campus247.db.seed"],
        cwd=root,
        env=env,
        check=True,
    )
    api_log = open(workdir / "api.log", "w", encoding="utf-8")
    worker_log = open(workdir / "worker.log", "w", encoding="utf-8")
    api = subprocess.Popen(
        [python, "-m", "uvicorn", "campus247.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=root,
        env=env,
        stdout=api_log,
        stderr=subprocess.STDOUT,
    )
    worker = subprocess.Popen(
        [python, "-m", "campus247.workers"],
        cwd=root,
        env=env,
        stdout=worker_log,
        stderr=subprocess.STDOUT,
    )
    meta = {
        "database_url": database_url,
        "workdir": str(workdir),
        "port": port,
        "api_pid": api.pid,
        "worker_pid": worker.pid,
    }
    try:
        wait_http(f"http://127.0.0.1:{port}/ready")
    except Exception:
        api.terminate()
        worker.terminate()
        api_log.close()
        worker_log.close()
        raise
    return f"http://127.0.0.1:{port}", meta, [api, worker], workdir


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="")
    parser.add_argument("--live", action="store_true", help="Dùng API đang chạy; có thể ghi vào DB của server đó.")
    parser.add_argument("--port", type=int, default=8010, help="Cổng API tạm khi không dùng --live.")
    args = parser.parse_args()
    procs: list[subprocess.Popen[bytes]] = []
    workdir: Path | None = None
    stack_meta: dict[str, object] = {}
    if args.live or args.base_url:
        base_url = args.base_url or "http://127.0.0.1:8000"
    else:
        base_url, stack_meta, procs, workdir = start_temp_stack(args.port)
        atexit.register(_stop_stack, procs, workdir)
    client = Client(base_url)
    marker = f"G2E2E-{uuid.uuid4().hex[:8]}"
    report: dict[str, object] = {
        "marker": marker,
        "base_url": base_url,
        "agent_mode": "stub",
        "temp_stack": stack_meta,
    }

    health = client.request("GET", "/health")
    ready = client.request("GET", "/ready")
    report["health"] = health
    report["ready"] = ready
    report["health_request_id"] = client.last_request_id
    if not isinstance(ready, dict) or ready.get("status") != "ready":
        raise SystemExit(f"API not ready: {ready}")

    student = client.login("SV-DEMO-001")
    report["student_login_request_id"] = client.last_request_id
    report["student"] = student["user"]

    create_key = str(uuid.uuid4())
    conversation = client.request("POST", "/api/v1/conversations", {}, idempotency_key=create_key)
    assert isinstance(conversation, dict)
    conversation_id = conversation["id"]
    report["conversation_id"] = conversation_id
    report["create_conversation_request_id"] = client.last_request_id

    replay = client.request("POST", "/api/v1/conversations", {}, idempotency_key=create_key)
    assert isinstance(replay, dict)
    if replay["id"] != conversation_id:
        raise SystemExit(f"idempotent create-conversation minted a new id: {replay['id']}")

    chat_key = str(uuid.uuid4())
    content = (
        "Tôi muốn xin giấy xác nhận sinh viên để nộp hồ sơ vay vốn ngân hàng, "
        "nơi nhận Ngân hàng Chính sách Xã hội, nhận bản điện tử PDF"
    )
    chat = client.request(
        "POST",
        f"/api/v1/conversations/{conversation_id}/messages",
        {"content": content},
        idempotency_key=chat_key,
    )
    assert isinstance(chat, dict)
    report["chat_request_id"] = client.last_request_id
    report["chat_route"] = chat.get("route")
    report["chat_outcome"] = chat.get("outcome")
    preview = chat.get("preview")
    if not isinstance(preview, dict):
        raise SystemExit(f"expected L2 preview, got {chat}")

    patch_key = str(uuid.uuid4())
    patched = client.request(
        "PATCH",
        f"/api/v1/previews/{preview['id']}",
        {
            "expected_version": preview["version"],
            "fields": {
                "purpose": f"nộp hồ sơ vay vốn ngân hàng {marker}",
                "destination_org": "Ngân hàng Chính sách Xã hội",
                "receive_method": "digital_pdf",
            },
        },
        idempotency_key=patch_key,
    )
    assert isinstance(patched, dict)
    report["preview_id"] = patched["id"]
    report["preview_version"] = patched["version"]
    report["patch_request_id"] = client.last_request_id
    if not patched.get("can_submit"):
        raise SystemExit(f"preview cannot submit after patch: {patched}")

    submit_key = str(uuid.uuid4())
    submitted = client.request(
        "POST",
        "/api/v1/tickets",
        {"preview_id": patched["id"], "preview_version": patched["version"], "confirmed": True},
        idempotency_key=submit_key,
    )
    assert isinstance(submitted, dict)
    ticket = submitted["ticket"]
    report["ticket_id"] = ticket["id"]
    report["ticket_code"] = ticket["code"]
    report["submit1_request_id"] = client.last_request_id
    report["submit1_revision"] = ticket["revision"]

    replay_submit = client.request(
        "POST",
        "/api/v1/tickets",
        {"preview_id": patched["id"], "preview_version": patched["version"], "confirmed": True},
        idempotency_key=submit_key,
    )
    assert isinstance(replay_submit, dict)
    if replay_submit["ticket"]["id"] != ticket["id"]:
        raise SystemExit("idempotent Submit1 created a second ticket")

    l4_conv = client.request("POST", "/api/v1/conversations", {}, idempotency_key=str(uuid.uuid4()))
    assert isinstance(l4_conv, dict)
    l4_chat = client.request(
        "POST",
        f"/api/v1/conversations/{l4_conv['id']}/messages",
        {"content": "Tôi muốn khiếu nại điểm thi học phần Cấu trúc Dữ liệu."},
        idempotency_key=str(uuid.uuid4()),
    )
    assert isinstance(l4_chat, dict)
    report["l4_conversation_id"] = l4_conv["id"]
    report["l4_request_id"] = client.last_request_id
    report["l4_route"] = l4_chat.get("route")
    report["l4_locked"] = (l4_chat.get("conversation_state") or {}).get("ai_response_locked")
    report["l4_ticket"] = (l4_chat.get("ticket") or {}).get("code")
    if l4_chat.get("route") != "L4" or not report["l4_locked"]:
        raise SystemExit(f"expected L4 lock, got {l4_chat}")

    officer = client.login("OF-DEMO-01")
    report["officer_login_request_id"] = client.last_request_id
    report["officer"] = officer["user"]

    ticket_id = ticket["id"]
    claimed = client.request(
        "POST",
        f"/api/v1/officer/tickets/{ticket_id}/claim",
        {"expected_revision": ticket["revision"], "confirmed": True},
        idempotency_key=str(uuid.uuid4()),
    )
    assert isinstance(claimed, dict)
    claimed_ticket = claimed["ticket"]
    report["claim_request_id"] = client.last_request_id
    report["claim_revision"] = claimed_ticket["revision"]
    report["claim_assignee"] = claimed_ticket["assigned_officer_id"]

    prepared = client.request(
        "POST",
        f"/api/v1/officer/tickets/{ticket_id}/prepare",
        {"expected_revision": claimed_ticket["revision"]},
        idempotency_key=str(uuid.uuid4()),
    )
    assert isinstance(prepared, dict)
    report["prepare_request_id"] = client.last_request_id
    report["prepare_job_id"] = prepared.get("job_id")

    brief = wait_brief(client, ticket_id)
    report["brief_request_id"] = client.last_request_id
    report["brief_status"] = brief.get("status")
    report["brief_version"] = brief.get("brief_version")
    if brief.get("status") != "ready":
        raise SystemExit(f"brief not ready: {brief}")

    resolved = client.request(
        "POST",
        f"/api/v1/officer/tickets/{ticket_id}/actions",
        {
            "action": "resolve",
            "content": f"Đã hoàn tất xử lý yêu cầu giấy xác nhận ({marker}). Không phát hành giấy.",
            "expected_revision": claimed_ticket["revision"],
            "reviewed_brief_version": brief["brief_version"],
            "confirmed": True,
        },
        idempotency_key=str(uuid.uuid4()),
    )
    assert isinstance(resolved, dict)
    report["submit2_request_id"] = client.last_request_id
    report["submit2_status"] = resolved["ticket"]["status"]
    report["submit2_revision"] = resolved["ticket"]["revision"]

    client.login("SV-DEMO-001")
    detail = client.request("GET", f"/api/v1/tickets/{ticket_id}?page=1&page_size=50")
    assert isinstance(detail, dict)
    report["student_detail_request_id"] = client.last_request_id
    report["student_seen_status"] = detail["ticket"]["status"]
    messages = detail["messages"]["items"]
    officer_messages = [item for item in messages if item.get("sender") == "officer"]
    report["student_seen_officer_messages"] = len(officer_messages)
    if detail["ticket"]["status"] != "resolved" or not officer_messages:
        raise SystemExit(f"student did not see resolved officer reply: {detail}")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print("G2_STUB_E2E_OK")
    return 0


def _stop_stack(procs: list[subprocess.Popen[bytes]], workdir: Path | None) -> None:
    for proc in procs:
        proc.terminate()
    for proc in procs:
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    if workdir:
        print(f"temp stack logs: {workdir}", file=sys.stderr)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ApiError, URLError, TimeoutError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
