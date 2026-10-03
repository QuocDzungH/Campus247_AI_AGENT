#!/usr/bin/env python3
"""G3 SQLite smoke: CampusAgent + demo corpus, API and worker share one temp DB.

Mặc định tạo DB SQLite tạm, migrate + seed, rồi tự chạy API/worker trên cổng riêng.
Không ghi vào data/app.db. Kế thừa LLM_* / *API_KEY từ môi trường hoặc .env.

  python scripts/g3_langgraph_e2e.py
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

LLM_ENV_KEYS = (
    "LLM_PROVIDER",
    "LLM_MODEL",
    "LLM_TEMPERATURE",
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "OPENAI_BASE_URL",
    "MODEL_NAME",
)


class ApiError(RuntimeError):
    def __init__(self, status: int, body: object, request_id: str | None):
        self.status = status
        self.body = body
        self.request_id = request_id
        super().__init__(f"HTTP {status} request_id={request_id} body={body}")


class Client:
    def __init__(self, base_url: str, timeout: float = 60.0):
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None
        self.last_request_id: str | None = None
        self.timeout = timeout

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
            with urlopen(req, timeout=self.timeout) as response:
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


def wait_brief(client: Client, ticket_id: str, timeout_s: float = 180.0) -> dict:
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


def inherit_llm_env(root: Path, env: dict[str, str]) -> None:
    path = root / ".env"
    if not path.exists():
        return
    existing = {key for key in LLM_ENV_KEYS if env.get(key)}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key in LLM_ENV_KEYS and key not in existing and value:
            env[key] = value
            existing.add(key)


def _has_provider_credentials(env: dict[str, str]) -> bool:
    provider = (env.get("LLM_PROVIDER") or "openai").strip().lower()
    aliases = {"gemini": "google"}
    provider = aliases.get(provider, provider)
    if provider == "google":
        return bool(env.get("GOOGLE_API_KEY") or env.get("GEMINI_API_KEY"))
    if provider == "groq":
        return bool(env.get("GROQ_API_KEY"))
    if provider == "openai_compatible":
        return bool(env.get("OPENAI_API_KEY") and env.get("OPENAI_BASE_URL"))
    return bool(env.get("OPENAI_API_KEY"))


def wait_http(url: str, timeout_s: float = 30.0) -> None:
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


def load_corpus(root: Path) -> dict:
    path = root / "backend" / "src" / "campus247" / "rag" / "data" / "demo_academic_v1.json"
    return json.loads(path.read_text(encoding="utf-8"))


def citation_in_corpus(citation: dict, corpus: dict) -> bool:
    quote = citation.get("quote") or ""
    chunk_id = citation.get("chunk_id")
    for document in corpus.get("documents") or []:
        if document.get("document_id") != citation.get("document_id"):
            continue
        if document.get("document_version") != citation.get("document_version"):
            continue
        for chunk in document.get("chunks") or []:
            if chunk.get("chunk_id") != chunk_id:
                continue
            text = chunk.get("text") or ""
            return bool(quote) and quote in text
    return False


def start_temp_stack(
    port: int, *, llm_model: str = ""
) -> tuple[str, dict[str, object], list[subprocess.Popen[bytes]], Path, dict[str, str], str]:
    root = repo_root()
    workdir = Path(tempfile.mkdtemp(prefix="g3e2e_"))
    db_path = workdir / "g3e2e.db"
    database_url = f"sqlite:///{db_path}"
    env = os.environ.copy()
    inherit_llm_env(root, env)
    configured_model = (env.get("LLM_MODEL") or env.get("MODEL_NAME") or "").strip()
    if llm_model:
        env["LLM_MODEL"] = llm_model
    if not _has_provider_credentials(env):
        raise SystemExit(
            "G3_LANGGRAPH_E2E_SKIP: thiếu LLM credentials. "
            "Đặt LLM_PROVIDER cùng API key tương ứng trong môi trường hoặc .env."
        )
    env["DATABASE_URL"] = database_url
    env["AGENT_MODE"] = "langgraph"
    env["RAG_MODE"] = "corpus"
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
    api = subprocess.Popen(
        [python, "-m", "uvicorn", "campus247.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=root,
        env=env,
        stdout=api_log,
        stderr=subprocess.STDOUT,
    )
    meta = {
        "database_url": database_url,
        "workdir": str(workdir),
        "port": port,
        "api_pid": api.pid,
        "agent_mode": "langgraph",
        "rag_mode": "corpus",
        "llm_provider": env.get("LLM_PROVIDER"),
        "llm_model": env.get("LLM_MODEL") or env.get("MODEL_NAME"),
        "llm_model_configured": configured_model,
        "llm_model_override": llm_model or None,
        "corpus": "edu14-demo-academic-v1 (demo, not VinUni operational policy)",
    }
    try:
        wait_http(f"http://127.0.0.1:{port}/ready")
    except Exception:
        api.terminate()
        api_log.close()
        raise
    return f"http://127.0.0.1:{port}", meta, [api], workdir, env, python


def start_worker(env: dict[str, str], python: str, workdir: Path) -> subprocess.Popen[bytes]:
    worker_log = open(workdir / "worker.log", "w", encoding="utf-8")
    return subprocess.Popen(
        [python, "-m", "campus247.workers"],
        cwd=repo_root(),
        env=env,
        stdout=worker_log,
        stderr=subprocess.STDOUT,
    )


def main() -> int:
    global _LAST_REPORT
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="")
    parser.add_argument("--live", action="store_true", help="Dùng API đang chạy; có thể ghi vào DB của server đó.")
    parser.add_argument("--port", type=int, default=8011, help="Cổng API tạm khi không dùng --live.")
    parser.add_argument(
        "--llm-model",
        default="",
        help="Ghi đè LLM_MODEL cho stack tạm. Không tự đổi model cấu hình.",
    )
    args = parser.parse_args()
    procs: list[subprocess.Popen[bytes]] = []
    workdir: Path | None = None
    stack_meta: dict[str, object] = {}
    stack_env: dict[str, str] | None = None
    stack_python: str | None = None
    if args.live or args.base_url:
        base_url = args.base_url or "http://127.0.0.1:8000"
    else:
        base_url, stack_meta, procs, workdir, stack_env, stack_python = start_temp_stack(
            args.port, llm_model=args.llm_model.strip()
        )
        atexit.register(_stop_stack, procs, workdir)
    client = Client(base_url)
    marker = f"G3E2E-{uuid.uuid4().hex[:8]}"
    corpus = load_corpus(repo_root())
    report: dict[str, object] = {
        "marker": marker,
        "base_url": base_url,
        "agent_mode": "langgraph",
        "rag_mode": "corpus",
        "corpus_id": corpus.get("corpus_id"),
        "corpus_is_demo": corpus.get("is_demo"),
        "temp_stack": stack_meta,
    }
    _LAST_REPORT = report

    health = client.request("GET", "/health")
    ready = client.request("GET", "/ready")
    status = client.request("GET", "/api/v1/status")
    report["health"] = health
    report["ready"] = ready
    report["status"] = status
    if not isinstance(ready, dict) or ready.get("status") != "ready":
        raise SystemExit(f"API not ready: {ready}")
    if not isinstance(status, dict) or status.get("agent_mode") != "langgraph":
        raise SystemExit(f"expected AGENT_MODE=langgraph, got {status}")
    if status.get("rag_mode") != "corpus":
        raise SystemExit(f"expected RAG_MODE=corpus, got {status}")
    if status.get("agent") != "CampusAgent":
        raise SystemExit(f"expected CampusAgent runtime, got {status}")

    student = client.login("SV-DEMO-001")
    report["student_login_request_id"] = client.last_request_id
    report["student"] = student["user"]

    l1_conv = client.request("POST", "/api/v1/conversations", {}, idempotency_key=str(uuid.uuid4()))
    assert isinstance(l1_conv, dict)
    l1_chat = client.request(
        "POST",
        f"/api/v1/conversations/{l1_conv['id']}/messages",
        {"content": "Quy trình cấp giấy xác nhận sinh viên như thế nào?"},
        idempotency_key=str(uuid.uuid4()),
    )
    assert isinstance(l1_chat, dict)
    report["l1_conversation_id"] = l1_conv["id"]
    report["l1_request_id"] = client.last_request_id
    report["l1_route"] = l1_chat.get("route")
    report["l1_outcome"] = l1_chat.get("outcome")
    citations = l1_chat.get("citations") or []
    report["l1_citation_count"] = len(citations)
    report["l1_citations"] = [
        {
            "document_id": item.get("document_id"),
            "document_title": item.get("document_title"),
            "document_version": item.get("document_version"),
            "chunk_id": item.get("chunk_id"),
            "locator": item.get("locator"),
            "quote": item.get("quote"),
        }
        for item in citations
    ]
    if l1_chat.get("route") != "L1" or l1_chat.get("outcome") != "answered" or not citations:
        raise SystemExit(f"expected L1 answered with citations, got {l1_chat}")
    if not all(citation_in_corpus(item, corpus) for item in citations):
        raise SystemExit(f"L1 citations do not match packaged corpus: {citations}")

    l2_conv = client.request("POST", "/api/v1/conversations", {}, idempotency_key=str(uuid.uuid4()))
    assert isinstance(l2_conv, dict)
    l2_content = (
        "Tôi muốn xin giấy xác nhận sinh viên để nộp hồ sơ vay vốn ngân hàng, "
        "nơi nhận Ngân hàng Chính sách Xã hội, nhận bản điện tử PDF"
    )
    l2_chat = client.request(
        "POST",
        f"/api/v1/conversations/{l2_conv['id']}/messages",
        {"content": l2_content},
        idempotency_key=str(uuid.uuid4()),
    )
    assert isinstance(l2_chat, dict)
    report["l2_conversation_id"] = l2_conv["id"]
    report["l2_request_id"] = client.last_request_id
    report["l2_route"] = l2_chat.get("route")
    report["l2_outcome"] = l2_chat.get("outcome")
    preview = l2_chat.get("preview")
    report["l2_preview"] = preview
    if not isinstance(preview, dict):
        raise SystemExit(f"expected L2 preview, got {l2_chat}")
    fields = preview.get("fields") or {}
    report["l2_fields"] = fields
    if not fields.get("purpose") or not fields.get("destination_org") or fields.get("receive_method") != "digital_pdf":
        raise SystemExit(f"L2 did not extract 3 fields: {preview}")

    patch_key = str(uuid.uuid4())
    patched = client.request(
        "PATCH",
        f"/api/v1/previews/{preview['id']}",
        {
            "expected_version": preview["version"],
            "fields": {
                "purpose": f"{fields['purpose']} {marker}",
                "destination_org": fields["destination_org"],
                "receive_method": "digital_pdf",
            },
        },
        idempotency_key=patch_key,
    )
    assert isinstance(patched, dict)
    if not patched.get("can_submit"):
        raise SystemExit(f"preview cannot submit after patch: {patched}")

    submitted = client.request(
        "POST",
        "/api/v1/tickets",
        {"preview_id": patched["id"], "preview_version": patched["version"], "confirmed": True},
        idempotency_key=str(uuid.uuid4()),
    )
    assert isinstance(submitted, dict)
    ticket = submitted["ticket"]
    report["ticket_id"] = ticket["id"]
    report["ticket_code"] = ticket["code"]
    report["submit1_request_id"] = client.last_request_id
    report["submit1_revision"] = ticket["revision"]

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

    if stack_env is not None and stack_python is not None and workdir is not None:
        worker = start_worker(stack_env, stack_python, workdir)
        procs.append(worker)
        stack_meta["worker_pid"] = worker.pid
        time.sleep(1)

    def prepare_and_wait(expected_revision: int) -> dict:
        prepared_body = client.request(
            "POST",
            f"/api/v1/officer/tickets/{ticket_id}/prepare",
            {"expected_revision": expected_revision},
            idempotency_key=str(uuid.uuid4()),
        )
        assert isinstance(prepared_body, dict)
        report["prepare_request_id"] = client.last_request_id
        report["prepare_job_id"] = prepared_body.get("job_id")
        return wait_brief(client, ticket_id)

    brief = prepare_and_wait(claimed_ticket["revision"])
    if brief.get("status") == "failed" and (brief.get("error") or {}).get("retryable"):
        report["brief_first_failure"] = brief.get("error")
        time.sleep(3)
        brief = prepare_and_wait(claimed_ticket["revision"])
    report["brief_request_id"] = client.last_request_id
    report["brief_status"] = brief.get("status")
    report["brief_version"] = brief.get("brief_version")
    artifact = brief.get("artifact") or {}
    inner = artifact.get("brief") or {}
    facts = inner.get("facts") or []
    citations_brief = inner.get("citations") or []
    report["brief_quality_status"] = inner.get("quality_status")
    report["brief_fact_count"] = len(facts)
    report["brief_citation_count"] = len(citations_brief)
    report["brief_warnings"] = [item.get("code") for item in (inner.get("warnings") or [])]
    report["brief_metadata"] = {
        "model_name": artifact.get("model_name"),
        "prompt_version": artifact.get("prompt_version"),
        "template_version": artifact.get("template_version"),
        "index_version": artifact.get("index_version"),
    }
    if brief.get("status") != "ready":
        raise SystemExit(f"brief not ready: {brief}")
    if not facts:
        raise SystemExit(f"L3 Fact Sheet missing facts: {brief}")
    if report["brief_metadata"]["index_version"] != "edu14-demo-academic-v1":
        raise SystemExit(f"expected corpus index_version on brief, got {report['brief_metadata']}")
    unverified = [
        item.get("key")
        for item in facts
        if item.get("source_type") == "student_message" and item.get("verification_status") != "unverified"
    ]
    report["student_facts_not_unverified"] = unverified
    if unverified:
        raise SystemExit(f"student-declared facts must stay unverified: {unverified}")

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

    client.login("SV-DEMO-001")
    detail = client.request("GET", f"/api/v1/tickets/{ticket_id}?page=1&page_size=50")
    assert isinstance(detail, dict)
    officer_messages = [item for item in detail["messages"]["items"] if item.get("sender") == "officer"]
    report["student_seen_status"] = detail["ticket"]["status"]
    report["student_seen_officer_messages"] = len(officer_messages)
    if detail["ticket"]["status"] != "resolved" or not officer_messages:
        raise SystemExit(f"student did not see resolved officer reply: {detail}")

    client.login("SV-DEMO-001")
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
    if l4_chat.get("route") != "L4" or not report["l4_locked"] or not l4_chat.get("ticket"):
        raise SystemExit(f"expected L4 lock and committed ticket, got {l4_chat}")
    l4_follow = client.request(
        "POST",
        f"/api/v1/conversations/{l4_conv['id']}/messages",
        {"content": "Tôi bổ sung thêm: điểm giữa kỳ cũng bị trừ oan."},
        idempotency_key=str(uuid.uuid4()),
    )
    assert isinstance(l4_follow, dict)
    report["l4_followup_request_id"] = client.last_request_id
    report["l4_followup_outcome"] = l4_follow.get("outcome")
    if l4_follow.get("outcome") != "forwarded_to_officer":
        raise SystemExit(f"expected L4 follow-up forwarded_to_officer, got {l4_follow}")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print("G3_LANGGRAPH_E2E_OK")
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


_LAST_REPORT: dict[str, object] = {}


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ApiError, URLError, TimeoutError, SystemExit) as exc:
        if isinstance(exc, SystemExit) and exc.code in {0, None}:
            raise
        if _LAST_REPORT:
            print(json.dumps(_LAST_REPORT, ensure_ascii=False, indent=2), file=sys.stderr)
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) if not isinstance(exc, SystemExit) else exc
