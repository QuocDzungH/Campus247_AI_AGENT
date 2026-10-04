import pytest
from httpx import ASGITransport, AsyncClient

from campus247.db.engine import session_scope
from campus247.db.models import User
from campus247.db.seed import seed_from_document
from campus247.main import app
from campus247.services.auth import set_password
from tests.db_support import upgrade_head

PASSWORD = "TestPassphrase-001"


@pytest.fixture
async def client(tmp_path):
    url = f"sqlite:///{tmp_path}/reviews.db"
    upgrade_head(url)
    with session_scope(url) as session:
        seed_from_document(session)
        for user_id in ("SV-DEMO-001", "SV-DEMO-024", "OF-DEMO-01"):
            user = session.get(User, user_id)
            assert user is not None
            set_password(session, None, user, PASSWORD)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


async def _auth(client, identifier: str):
    response = await client.post(
        "/api/v1/auth/login", json={"identifier": identifier, "password": PASSWORD, "remember": False}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.asyncio
async def test_review_case_idor_and_insufficient_ai(client):
    officer = await _auth(client, "OF-DEMO-01")
    created = await client.post(
        "/api/v1/reviews",
        headers=officer,
        json={
            "student_id": "SV-DEMO-001",
            "target_course_code": "IT3011",
            "target_course_name": "Cau truc du lieu",
            "prior_course_code": "IT2020",
            "prior_course_name": "Data structures",
        },
    )
    assert created.status_code == 201, created.text
    case_id = created.json()["id"]
    assert created.json()["payload"]["studentMssv"]

    ai = await client.post(f"/api/v1/reviews/{case_id}/ai", headers=officer)
    assert ai.status_code == 200, ai.text
    findings = ai.json()["payload"]["findings"]
    assert findings
    assert all(item["aiLabel"] == "insufficient_evidence" for item in findings)

    other = await _auth(client, "SV-DEMO-024")
    hidden = await client.get(f"/api/v1/reviews/{case_id}", headers=other)
    assert hidden.status_code == 404

    owner = await _auth(client, "SV-DEMO-001")
    visible = await client.get(f"/api/v1/reviews/{case_id}", headers=owner)
    assert visible.status_code == 200


@pytest.mark.asyncio
async def test_ticket_verification_is_insufficient(client):
    student = await _auth(client, "SV-DEMO-001")
    student = {**student, "Idempotency-Key": "form-1"}
    form = await client.post(
        "/api/v1/forms",
        headers=student,
        json={
            "service_type": "student_certificate",
            "summary": "Xin giay xac nhan",
            "fields": {
                "purpose": "Thuc tap",
                "destination_org": "Cong ty ABC",
                "receive_method": "paper_stamped",
            },
            "extras": {},
            "confirmed": True,
        },
    )
    assert form.status_code == 201, form.text
    ticket_id = form.json()["ticket"]["id"]

    officer = await _auth(client, "OF-DEMO-01")
    detail = await client.get(f"/api/v1/tickets/{ticket_id}", headers=officer)
    assert detail.status_code == 200, detail.text
    revision = detail.json()["ticket"]["revision"]
    claimed = await client.post(
        f"/api/v1/officer/tickets/{ticket_id}/claim",
        headers={**officer, "Idempotency-Key": "claim-verif"},
        json={"expected_revision": revision, "confirmed": True},
    )
    assert claimed.status_code == 200, claimed.text
    result = await client.post(f"/api/v1/tickets/{ticket_id}/verifications", headers=officer, json={})
    assert result.status_code == 200, result.text
    items = result.json()["items"]
    assert items
    by_key = {item["criterion_key"]: item for item in items}
    assert "financial_obligation" not in by_key
    assert by_key["academic_status"]["status"] == "insufficient"
    assert by_key["academic_status"]["connector_status"] == "not_configured"
    assert all("SELECT" not in item["reason"] for item in items)
