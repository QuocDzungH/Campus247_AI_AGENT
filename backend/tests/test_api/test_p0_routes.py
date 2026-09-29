import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from campus247.agents.stubs import StubAgent
from campus247.db.engine import session_scope
from campus247.db.seed import seed_from_document
from campus247.main import app
from campus247.models.contracts_v1 import Fields, Intake, IntakeResult
from campus247.services.runtime import set_agent
from tests.db_support import upgrade_head

PREVIEW_INTAKE = IntakeResult(
    route="L2",
    outcome="preview_ready",
    reply="Bạn hãy kiểm tra thông tin trước khi gửi.",
    citations=[],
    intake=Intake(
        service_type="student_certificate",
        fields=Fields(purpose="Vay vốn ngân hàng", destination_org="Ngân hàng mẫu A", receive_method="paper_stamped"),
        missing_fields=[],
        invalid_fields=[],
    ),
    handover=None,
)


@pytest_asyncio.fixture
async def api_client(tmp_path, restore_agent):
    url = f"sqlite:///{tmp_path}/api.db"
    upgrade_head(url)
    with session_scope(url) as session:
        seed_from_document(session)
    set_agent(StubAgent(intake_result=PREVIEW_INTAKE))
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
    return {"Authorization": f"Bearer {token}", "Idempotency-Key": f"key-{user_id}"}


@pytest.mark.asyncio
async def test_demo_login_and_me(api_client):
    headers = await _login(api_client, "SV-DEMO-001")
    me = await api_client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["id"] == "SV-DEMO-001"
    assert me.json()["role"] == "student"


@pytest.mark.asyncio
async def test_student_isolation_via_http(api_client):
    headers = await _login(api_client, "SV-DEMO-024")
    response = await api_client.get("/api/v1/tickets/TKT-DEMO-2026-0001", headers=headers)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


@pytest.mark.asyncio
async def test_officer_queue_hides_wellbeing(api_client):
    headers = await _login(api_client, "OF-DEMO-01")
    headers["Idempotency-Key"] = "of-list"
    response = await api_client.get("/api/v1/officer/tickets", headers=headers, params={"page_size": 100})
    assert response.status_code == 200
    types = {item["service_type"] for item in response.json()["items"]}
    assert "student_support" not in types
    hidden = await api_client.get("/api/v1/officer/tickets/TKT-DEMO-2026-0027/brief", headers=headers)
    assert hidden.status_code == 404


@pytest.mark.asyncio
async def test_submit1_and_claim_http(api_client):
    student_headers = await _login(api_client, "SV-DEMO-010")
    created = await api_client.post("/api/v1/conversations", json={}, headers={**student_headers, "Idempotency-Key": "c10"})
    assert created.status_code == 201, created.text
    conversation_id = created.json()["id"]
    chat = await api_client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": "Em muốn xin giấy xác nhận"},
        headers={**student_headers, "Idempotency-Key": "m10"},
    )
    assert chat.status_code == 200, chat.text
    preview = chat.json()["preview"]
    submitted = await api_client.post(
        "/api/v1/tickets",
        json={"preview_id": preview["id"], "preview_version": preview["version"], "confirmed": True},
        headers={**student_headers, "Idempotency-Key": "s10"},
    )
    assert submitted.status_code == 201, submitted.text
    ticket = submitted.json()["ticket"]
    assert ticket["status"] == "open"
    officer_headers = await _login(api_client, "OF-DEMO-01")
    claimed = await api_client.post(
        f"/api/v1/officer/tickets/{ticket['id']}/claim",
        json={"expected_revision": ticket["revision"], "confirmed": True},
        headers={**officer_headers, "Idempotency-Key": "claim10"},
    )
    assert claimed.status_code == 200, claimed.text
    assert claimed.json()["ticket"]["assigned_officer_id"] == "OF-DEMO-01"


@pytest.mark.asyncio
async def test_student_forbidden_on_officer_endpoints(api_client):
    headers = await _login(api_client, "SV-DEMO-001")
    response = await api_client.get("/api/v1/officer/tickets", headers=headers)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
