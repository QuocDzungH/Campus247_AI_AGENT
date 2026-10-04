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
async def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FILES_DIR", str(tmp_path / "files"))
    from campus247.config import get_settings

    get_settings.cache_clear()
    url = f"sqlite:///{tmp_path}/forms.db"
    upgrade_head(url)
    with session_scope(url) as session:
        seed_from_document(session)
        user = session.get(User, "SV-DEMO-001")
        other = session.get(User, "SV-DEMO-024")
        assert user is not None and other is not None
        set_password(session, None, user, PASSWORD)
        set_password(session, None, other, PASSWORD)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


async def _auth(client, identifier="SV-DEMO-001"):
    response = await client.post(
        "/api/v1/auth/login", json={"identifier": identifier, "password": PASSWORD, "remember": False}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Idempotency-Key": f"form-{identifier}"}


@pytest.mark.asyncio
async def test_form_keeps_extra_fields(client):
    headers = await _auth(client)
    response = await client.post(
        "/api/v1/forms",
        headers=headers,
        json={
            "service_type": "student_certificate",
            "summary": "Xin giấy xác nhận đang theo học",
            "fields": {
                "purpose": "Hồ sơ thực tập",
                "destination_org": "Cong ty ABC",
                "receive_method": "digital_pdf",
            },
            "extras": {"documentType": "ENR", "copies": "2", "language": "bilingual"},
            "confirmed": True,
        },
    )
    assert response.status_code == 201, response.text
    ticket = response.json()["ticket"]
    extras = ticket["request_data"]["extras"]
    assert extras["documentType"] == "ENR"
    assert extras["copies"] == "2"
    detail = await client.get(f"/api/v1/tickets/{ticket['id']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["ticket"]["request_data"]["extras"]["language"] == "bilingual"


@pytest.mark.asyncio
async def test_attachment_idor(client, tmp_path):
    headers = await _auth(client)
    created = await client.post(
        "/api/v1/forms",
        headers=headers,
        json={
            "service_type": "student_certificate",
            "summary": "Xin giấy kèm tệp",
            "fields": {
                "purpose": "Nop ho so ngan hang",
                "destination_org": "Ngan hang A",
                "receive_method": "paper_stamped",
            },
            "extras": {},
            "confirmed": True,
        },
    )
    ticket_id = created.json()["ticket"]["id"]
    upload = await client.post(
        f"/api/v1/tickets/{ticket_id}/attachments",
        headers={"Authorization": headers["Authorization"]},
        files={"file": ("minhchung.pdf", b"%PDF-1.4 demo", "application/pdf")},
        data={"field": "evidenceFiles"},
    )
    assert upload.status_code == 201, upload.text
    attachment_id = upload.json()["id"]
    other = await _auth(client, "SV-DEMO-024")
    denied = await client.get(
        f"/api/v1/tickets/{ticket_id}/attachments/{attachment_id}",
        headers={"Authorization": other["Authorization"]},
    )
    assert denied.status_code in {403, 404}
    ok = await client.get(
        f"/api/v1/tickets/{ticket_id}/attachments/{attachment_id}",
        headers={"Authorization": headers["Authorization"]},
    )
    assert ok.status_code == 200
    assert ok.content.startswith(b"%PDF")
