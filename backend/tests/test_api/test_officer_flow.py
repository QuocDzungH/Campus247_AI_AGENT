"""Officer intake: verification, supplements, document draft/issue, gates, idempotency."""

from io import BytesIO

import pytest
from httpx import ASGITransport, AsyncClient

from campus247.db.engine import session_scope
from campus247.db.models import Message, StudentProfile, User
from campus247.db.seed import seed_from_document
from campus247.main import app
from campus247.services.auth import set_password
from campus247.services.common import utcnow
from tests.db_support import upgrade_head

PASSWORD = "TestPassphrase-001"


@pytest.fixture
async def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FILES_DIR", str(tmp_path / "files"))
    monkeypatch.setenv("SIS_CONNECTOR_URL", "")
    monkeypatch.setenv("FINANCE_CONNECTOR_URL", "")
    monkeypatch.setenv("SIGNING_PROVIDER", "none")
    from campus247.config import get_settings

    get_settings.cache_clear()
    url = f"sqlite:///{tmp_path}/officer.db"
    upgrade_head(url)
    with session_scope(url) as session:
        seed_from_document(session)
        for user_id in ("SV-DEMO-001", "SV-DEMO-024", "OF-DEMO-01", "OF-DEMO-03"):
            user = session.get(User, user_id)
            assert user is not None
            set_password(session, None, user, PASSWORD)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http, url


async def _auth(client, identifier, key="k"):
    response = await client.post(
        "/api/v1/auth/login", json={"identifier": identifier, "password": PASSWORD, "remember": False}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Idempotency-Key": f"{key}-{identifier}"}


async def _submit_certificate(client, student_headers, extras=None):
    response = await client.post(
        "/api/v1/forms",
        headers={**student_headers, "Idempotency-Key": student_headers["Idempotency-Key"] + "-form"},
        json={
            "service_type": "student_certificate",
            "summary": "Xin giấy xác nhận đang theo học",
            "fields": {
                "purpose": "Ho so thuc tap tai cong ty ABC",
                "destination_org": "Cong ty ABC",
                "receive_method": "digital_pdf",
            },
            "extras": extras or {"documentType": "ENR", "copies": "2", "language": "vi"},
            "confirmed": True,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["ticket"]


async def _claim(client, officer, ticket):
    claimed = await client.post(
        f"/api/v1/officer/tickets/{ticket['id']}/claim",
        headers={**officer, "Idempotency-Key": f"claim-{ticket['id']}"},
        json={"expected_revision": ticket["revision"], "confirmed": True},
    )
    assert claimed.status_code == 200, claimed.text
    return claimed.json()["ticket"]


@pytest.mark.asyncio
async def test_officer_reads_submitted_form_and_file(client):
    http, _url = client
    student = await _auth(http, "SV-DEMO-001", "s1")
    ticket = await _submit_certificate(http, student)
    upload = await http.post(
        f"/api/v1/tickets/{ticket['id']}/attachments",
        headers=student,
        files={"file": ("minh-chung.pdf", BytesIO(b"%PDF-1.4 demo"), "application/pdf")},
        data={"field": "evidence"},
    )
    assert upload.status_code == 201, upload.text
    officer = await _auth(http, "OF-DEMO-01", "o1")
    detail = await http.get(f"/api/v1/tickets/{ticket['id']}", headers=officer)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    data = body["ticket"]["request_data"]
    assert data["purpose"].startswith("Ho so thuc tap")
    assert data["extras"]["documentType"] == "ENR"
    assert data["extras"]["copies"] == "2"
    assert body["attachments"][0]["filename"] == "minh-chung.pdf"
    assert body["student_profile"]["mssv"]
    assert body["process"]["template_status"] == "approved"
    assert "financial_obligation" not in body["process"]["issue_required_criteria"]


@pytest.mark.asyncio
async def test_unassigned_officer_cannot_verify_or_issue(client):
    http, _url = client
    student = await _auth(http, "SV-DEMO-001", "s2")
    ticket = await _submit_certificate(http, student)
    officer = await _auth(http, "OF-DEMO-01", "o2")
    denied = await http.post(f"/api/v1/tickets/{ticket['id']}/verifications", headers=officer, json={})
    assert denied.status_code == 409
    issue = await http.post(
        f"/api/v1/officer/tickets/{ticket['id']}/document/issue",
        headers={**officer, "Idempotency-Key": "issue-denied"},
        json={"expected_revision": ticket["revision"], "expected_draft_version": 1, "confirmed": True},
    )
    assert issue.status_code == 409


@pytest.mark.asyncio
async def test_verification_pipeline_no_fake_pass_and_view_is_not_pass(client):
    http, _url = client
    student = await _auth(http, "SV-DEMO-001", "s3")
    ticket = await _submit_certificate(http, student)
    officer = await _auth(http, "OF-DEMO-01", "o3")
    ticket = await _claim(http, officer, ticket)
    result = await http.post(f"/api/v1/tickets/{ticket['id']}/verifications", headers=officer, json={})
    assert result.status_code == 200, result.text
    items = result.json()["items"]
    by_key = {item["criterion_key"]: item for item in items}
    assert "financial_obligation" not in by_key
    assert by_key["identity_match"]["status"] == "insufficient"
    assert by_key["academic_status"]["status"] == "insufficient"
    assert by_key["academic_status"]["connector_status"] == "not_configured"
    assert by_key["form_completeness"]["status"] == "passed"
    academic = by_key["academic_status"]
    viewed = await http.post(
        f"/api/v1/tickets/{ticket['id']}/verifications/{academic['id']}/confirm",
        headers=officer,
        json={"note": "Da xem", "outcome": "viewed"},
    )
    assert viewed.status_code == 200, viewed.text
    after = {item["criterion_key"]: item for item in viewed.json()["items"]}
    assert after["academic_status"]["status"] == "insufficient"
    assert after["academic_status"]["officer_review_status"] == "confirmed"
    assert after["academic_status"]["officer_resolution"] == "viewed"


@pytest.mark.asyncio
async def test_student_supplement_marks_verification_stale(client):
    http, _url = client
    student = await _auth(http, "SV-DEMO-001", "s4")
    ticket = await _submit_certificate(http, student)
    officer = await _auth(http, "OF-DEMO-01", "o4")
    ticket = await _claim(http, officer, ticket)
    await http.post(f"/api/v1/tickets/{ticket['id']}/verifications", headers=officer, json={})
    detail = await http.get(f"/api/v1/tickets/{ticket['id']}", headers=officer)
    revision = detail.json()["ticket"]["revision"]
    asked = await http.post(
        f"/api/v1/officer/tickets/{ticket['id']}/actions",
        headers={**officer, "Idempotency-Key": "reqinfo"},
        json={
            "action": "request_info",
            "content": "Can ban sao CCCD va xac nhan noi nhan.",
            "expected_revision": revision,
            "reviewed_brief_version": None,
            "confirmed": True,
            "supplement_items": [{"label": "CCCD", "reason": "Doi chieu danh tinh"}],
        },
    )
    assert asked.status_code == 200, asked.text
    follow = await http.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        headers={**student, "Idempotency-Key": "sup-1"},
        json={"content": "Em da nop them CCCD ban scan."},
    )
    assert follow.status_code == 200, follow.text
    refreshed = await http.get(f"/api/v1/tickets/{ticket['id']}", headers=officer)
    body = refreshed.json()
    assert body["verifications"]
    assert any(item.get("stale") for item in body["verifications"])
    assert body["supplements"]
    assert body["supplements"][-1]["status"] == "fulfilled"


@pytest.mark.asyncio
async def test_other_officer_and_missing_gates_block_issue(client):
    http, _url = client
    student = await _auth(http, "SV-DEMO-001", "s5")
    ticket = await _submit_certificate(http, student)
    owner = await _auth(http, "OF-DEMO-01", "o5")
    other = await _auth(http, "OF-DEMO-03", "o5b")
    ticket = await _claim(http, owner, ticket)
    blocked = await http.patch(
        f"/api/v1/officer/tickets/{ticket['id']}/document",
        headers=other,
        json={"expected_revision": ticket["revision"], "purpose": "Khong duoc sua"},
    )
    assert blocked.status_code == 409
    issue = await http.post(
        f"/api/v1/officer/tickets/{ticket['id']}/document/issue",
        headers={**owner, "Idempotency-Key": "issue-gate"},
        json={"expected_revision": ticket["revision"], "expected_draft_version": 1, "confirmed": True},
    )
    assert issue.status_code == 409
    assert issue.json()["error"]["code"] == "GATE_FAILED"


@pytest.mark.asyncio
async def test_stale_revision_keeps_draft_and_issue_is_idempotent(client):
    http, url = client
    student = await _auth(http, "SV-DEMO-001", "s6")
    with session_scope(url) as session:
        profile = session.get(StudentProfile, "SV-DEMO-001")
        assert profile is not None
        profile.verification_status = "imported"
        profile.source = "campus_profile_import"
        session.commit()
    ticket = await _submit_certificate(http, student)
    officer = await _auth(http, "OF-DEMO-01", "o6")
    ticket = await _claim(http, officer, ticket)
    await http.post(f"/api/v1/tickets/{ticket['id']}/verifications", headers=officer, json={})
    detail = await http.get(f"/api/v1/tickets/{ticket['id']}", headers=officer)
    body = detail.json()
    revision = body["ticket"]["revision"]
    draft = body["document_draft"]
    saved = await http.patch(
        f"/api/v1/officer/tickets/{ticket['id']}/document",
        headers=officer,
        json={
            "expected_revision": revision,
            "expected_draft_version": draft["version"],
            "purpose": "Nop ho so ngan hang chinh sach",
            "destination_org": "NHCSXH",
            "notes": "Ban thao noi bo",
        },
    )
    assert saved.status_code == 200, saved.text
    stale = await http.patch(
        f"/api/v1/officer/tickets/{ticket['id']}/document",
        headers=officer,
        json={"expected_revision": revision, "purpose": "Noi dung cu"},
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "STALE_REVISION"
    latest = await http.get(f"/api/v1/tickets/{ticket['id']}", headers=officer)
    assert latest.json()["document_draft"]["purpose"].startswith("Nop ho so ngan hang")
    workspace = await http.patch(
        f"/api/v1/officer/tickets/{ticket['id']}/workspace",
        headers=officer,
        json={"expected_revision": latest.json()["ticket"]["revision"], "toggle_checklist_id": "chk_identity"},
    )
    assert workspace.status_code == 200, workspace.text
    for item_id in ("chk_form", "chk_evidence"):
        current = await http.get(f"/api/v1/tickets/{ticket['id']}", headers=officer)
        await http.patch(
            f"/api/v1/officer/tickets/{ticket['id']}/workspace",
            headers=officer,
            json={"expected_revision": current.json()["ticket"]["revision"], "toggle_checklist_id": item_id},
        )
    current = await http.get(f"/api/v1/tickets/{ticket['id']}", headers=officer)
    academic = next(item for item in current.json()["verifications"] if item["criterion_key"] == "academic_status")
    manual = await http.post(
        f"/api/v1/tickets/{ticket['id']}/verifications/{academic['id']}/confirm",
        headers=officer,
        json={
            "note": "Doi chieu bang xac nhan dang hoc do sinh vien nop, can bo kiem tra ban goc.",
            "outcome": "manual_pass",
            "expected_revision": current.json()["ticket"]["revision"],
        },
    )
    assert manual.status_code == 200, manual.text
    current = await http.get(f"/api/v1/tickets/{ticket['id']}", headers=officer)
    draft = current.json()["document_draft"]
    first = await http.post(
        f"/api/v1/officer/tickets/{ticket['id']}/document/issue",
        headers={**officer, "Idempotency-Key": "issue-once"},
        json={
            "expected_revision": current.json()["ticket"]["revision"],
            "expected_draft_version": draft["version"],
            "confirmed": True,
        },
    )
    assert first.status_code == 200, first.text
    assert first.json()["document"]["signature_status"] == "unsigned"
    assert first.json()["document"]["official"] is False
    after_issue = await http.get(f"/api/v1/tickets/{ticket['id']}", headers=officer)
    assert after_issue.status_code == 200, after_issue.text
    issued_detail = after_issue.json()
    assert issued_detail["document_draft"]["status"] == "issued"
    assert issued_detail["document_draft"]["approved_by"] == "OF-DEMO-01"
    assert issued_detail["issued_document"]["id"] == first.json()["document"]["id"]
    replay = await http.post(
        f"/api/v1/officer/tickets/{ticket['id']}/document/issue",
        headers={**officer, "Idempotency-Key": "issue-once"},
        json={
            "expected_revision": current.json()["ticket"]["revision"],
            "expected_draft_version": draft["version"],
            "confirmed": True,
        },
    )
    assert replay.status_code == 200
    assert replay.json()["document"]["id"] == first.json()["document"]["id"]
    doc_id = first.json()["document"]["id"]
    download = await http.get(f"/api/v1/tickets/{ticket['id']}/documents/{doc_id}", headers=student)
    assert download.status_code == 200
    assert download.content[:5] == b"%PDF-"
    other = await _auth(http, "SV-DEMO-024", "other")
    hidden = await http.get(f"/api/v1/tickets/{ticket['id']}/documents/{doc_id}", headers=other)
    assert hidden.status_code == 404


@pytest.mark.asyncio
async def test_message_history_beyond_100(client):
    http, url = client
    student = await _auth(http, "SV-DEMO-001", "s7")
    ticket = await _submit_certificate(http, student)
    now = utcnow()
    with session_scope(url) as session:
        for index in range(110):
            session.add(
                Message(
                    id=f"msg_bulk_{index:03d}",
                    conversation_id=ticket["conversation_id"],
                    ticket_id=ticket["id"],
                    sender="student",
                    content=f"Tin bo sung so {index + 1} de kiem tra phan trang.",
                    seq=1000 + index,
                    created_at=now,
                )
            )
        session.commit()
    page1 = await http.get(f"/api/v1/tickets/{ticket['id']}/messages?page=1&page_size=100", headers=student)
    assert page1.status_code == 200
    assert page1.json()["total"] >= 110
    assert len(page1.json()["items"]) == 100
    page2 = await http.get(f"/api/v1/tickets/{ticket['id']}/messages?page=2&page_size=100", headers=student)
    assert page2.status_code == 200
    assert page2.json()["items"]
