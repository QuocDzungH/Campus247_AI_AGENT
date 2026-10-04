import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from campus247.agents.stubs import StubAgent
from campus247.db.engine import session_scope
from campus247.db.seed import seed_from_document
from campus247.main import app
from campus247.services.runtime import set_agent
from tests.db_support import upgrade_head


@pytest_asyncio.fixture
async def stub_client(tmp_path, restore_agent):
    url = f"sqlite:///{tmp_path}/unified.db"
    upgrade_head(url)
    with session_scope(url) as session:
        seed_from_document(session)
    set_agent(StubAgent())
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def restore_agent():
    from campus247.services.runtime import get_agent

    original = get_agent()
    yield
    set_agent(original)


async def _login(client, user_id: str) -> dict:
    response = await client.post("/api/v1/auth/demo-login", json={"user_id": user_id})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _open_conversation(client, headers: dict, key: str) -> str:
    created = await client.post(
        "/api/v1/conversations",
        json={},
        headers={**headers, "Idempotency-Key": key},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


async def _chat(client, headers: dict, conversation_id: str, content: str, key: str) -> dict:
    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": content},
        headers={**headers, "Idempotency-Key": key},
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_vague_complaint_asks_topic_without_ticket(stub_client):
    headers = await _login(stub_client, "SV-DEMO-010")
    conversation_id = await _open_conversation(stub_client, headers, "u-c1")
    chat = await _chat(stub_client, headers, conversation_id, "Tôi muốn khiếu nại", "u-m1")
    assert chat["route"] == "L2"
    assert chat["outcome"] == "collecting"
    assert chat["preview"]["service_type"] == "academic_complaint"
    assert "complaint_subtype" in chat["preview"]["missing_fields"]
    assert chat["ticket"] is None
    assert chat["conversation_state"]["ai_response_locked"] is False
    assert "khiếu nại về vấn đề gì" in chat["reply"]["content"]


@pytest.mark.asyncio
async def test_grade_complaint_opens_form_fields(stub_client):
    headers = await _login(stub_client, "SV-DEMO-010")
    conversation_id = await _open_conversation(stub_client, headers, "u-c2")
    chat = await _chat(
        stub_client,
        headers,
        conversation_id,
        "Tôi muốn khiếu nại điểm môn Cơ sở dữ liệu vì điểm bài thi chưa đúng.",
        "u-m2",
    )
    assert chat["route"] == "L2"
    preview = chat["preview"]
    assert preview["service_type"] == "academic_complaint"
    assert preview["fields"]["complaint_subtype"] == "grade_appeal"
    assert preview["fields"]["course"] == "Cơ sở dữ liệu"
    assert preview["fields"]["description"]
    assert preview["fields"]["purpose"] is None
    assert chat["ticket"] is None
    assert chat["conversation_state"]["ai_response_locked"] is False


@pytest.mark.asyncio
async def test_procedure_question_does_not_open_form(stub_client):
    headers = await _login(stub_client, "SV-DEMO-010")
    conversation_id = await _open_conversation(stub_client, headers, "u-c3")
    chat = await _chat(stub_client, headers, conversation_id, "Quy trình khiếu nại điểm?", "u-m3")
    assert chat["route"] == "L1"
    assert chat["preview"] is None
    assert chat["ticket"] is None


@pytest.mark.asyncio
async def test_submit1_complaint_locks_and_is_idempotent(stub_client):
    headers = await _login(stub_client, "SV-DEMO-011")
    conversation_id = await _open_conversation(stub_client, headers, "u-c4")
    chat = await _chat(
        stub_client,
        headers,
        conversation_id,
        "Tôi muốn khiếu nại điểm môn Giải tích vì điểm bài thi chưa đúng.",
        "u-m4",
    )
    preview = chat["preview"]
    assert preview["can_submit"] is True
    body = {"preview_id": preview["id"], "preview_version": preview["version"], "confirmed": True}
    first = await stub_client.post(
        "/api/v1/tickets",
        json=body,
        headers={**headers, "Idempotency-Key": "u-s4"},
    )
    assert first.status_code == 201, first.text
    ticket = first.json()["ticket"]
    assert ticket["category"] == "complaint"
    assert ticket["service_type"] == "academic_complaint"
    assert ticket["status"] == "pending_officer"
    assert ticket["priority"] == "normal"
    assert ticket["conversation_id"] == conversation_id
    assert ticket["handover_reason"] is None
    assert "Giải tích" in ticket["summary"]

    replay = await stub_client.post(
        "/api/v1/tickets",
        json=body,
        headers={**headers, "Idempotency-Key": "u-s4"},
    )
    assert replay.status_code == 201, replay.text
    assert replay.json()["ticket"]["id"] == ticket["id"]
    assert replay.json()["ticket"]["code"] == ticket["code"]

    follow = await _chat(stub_client, headers, conversation_id, "Bổ sung thêm minh chứng bài thi", "u-m4b")
    assert follow["conversation_state"]["ai_response_locked"] is True
    assert follow["ticket"]["id"] == ticket["id"]
    assert follow["preview"] is None


@pytest.mark.asyncio
async def test_switch_keeps_separate_drafts(stub_client):
    headers = await _login(stub_client, "SV-DEMO-012")
    conversation_id = await _open_conversation(stub_client, headers, "u-c5")
    cert = await _chat(
        stub_client,
        headers,
        conversation_id,
        "Tôi muốn xin giấy xác nhận sinh viên để vay vốn ngân hàng, nơi nhận Ngân hàng A, nhận bản điện tử PDF",
        "u-m5a",
    )
    assert cert["preview"]["service_type"] == "student_certificate"
    assert cert["preview"]["fields"]["purpose"]
    cert_preview_id = cert["preview"]["id"]

    complaint = await _chat(
        stub_client,
        headers,
        conversation_id,
        "Tôi muốn đổi sang gửi khiếu nại điểm môn Toán của tôi",
        "u-m5b",
    )
    assert complaint["preview"]["service_type"] == "academic_complaint"
    assert complaint["preview"]["id"] != cert_preview_id
    assert complaint["preview"]["fields"]["course"] == "Toán"
    assert complaint["preview"]["fields"]["purpose"] is None
    assert complaint["ticket"] is None

    back = await _chat(
        stub_client,
        headers,
        conversation_id,
        "Tôi muốn đổi sang xin giấy xác nhận sinh viên.",
        "u-m5c",
    )
    assert back["preview"]["service_type"] == "student_certificate"
    assert back["preview"]["id"] == cert_preview_id
    assert back["preview"]["fields"]["purpose"]
    assert back["preview"]["fields"]["course"] is None
    assert back["ticket"] is None
