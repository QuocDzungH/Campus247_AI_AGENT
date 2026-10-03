import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from sqlalchemy import select

from campus247.db.engine import session_scope
from campus247.db.models import AuthEvent, SessionToken, StudentProfile, User
from campus247.db.seed import seed_from_document
from campus247.main import app
from campus247.services.auth import set_password
from campus247.services.common import utcnow
from campus247.services.passwords import hash_password
from tests.db_support import upgrade_head

PASSWORD = "TestPassphrase-001"


@pytest_asyncio.fixture
async def api_client(tmp_path):
    url = f"sqlite:///{tmp_path}/auth.db"
    upgrade_head(url)
    with session_scope(url) as session:
        seed_from_document(session)
        user = session.get(User, "SV-DEMO-001")
        assert user is not None
        set_password(session, None, user, PASSWORD)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _login(client, identifier="SV-DEMO-001", password=PASSWORD):
    response = await client.post(
        "/api/v1/auth/login", json={"identifier": identifier, "password": password, "remember": False}
    )
    return response


@pytest.mark.asyncio
async def test_password_login_success_and_wrong_password(api_client):
    ok = await _login(api_client)
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["token_type"] == "Bearer"
    assert body["user"]["id"] == "SV-DEMO-001"
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    me = await api_client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["id"] == "SV-DEMO-001"
    profile = await api_client.get("/api/v1/me/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["mssv"] is not None

    bad = await _login(api_client, password="wrong-password-value")
    assert bad.status_code == 401
    assert bad.json()["error"]["message"] == "Tài khoản hoặc mật khẩu không chính xác."
    missing = await _login(api_client, identifier="nobody-here")
    assert missing.status_code == 401
    assert missing.json()["error"]["message"] == "Tài khoản hoặc mật khẩu không chính xác."


@pytest.mark.asyncio
async def test_mssv_keeps_leading_zero(tmp_path):
    url = f"sqlite:///{tmp_path}/mssv.db"
    upgrade_head(url)
    with session_scope(url) as session:
        now = utcnow()
        session.add(
            User(
                id="usr_zero",
                role="student",
                name="Zero",
                account_status="active",
                password_hash=hash_password(PASSWORD),
                is_demo=False,
                created_at=now,
                updated_at=now,
            )
        )
        session.add(
            StudentProfile(
                user_id="usr_zero",
                full_name="Zero",
                mssv="01234567",
                verification_status="imported",
                is_demo=False,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login", json={"identifier": "01234567", "password": PASSWORD, "remember": False}
        )
        assert response.status_code == 200, response.text
        assert response.json()["user"]["id"] == "usr_zero"


@pytest.mark.asyncio
async def test_disabled_account_and_password_change_revokes_sessions(api_client, tmp_path):
    first = await _login(api_client)
    other = await _login(api_client)
    token = first.json()["access_token"]
    other_token = other.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    change = await api_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "TestPassphrase-002"},
        headers=headers,
    )
    assert change.status_code == 204, change.text
    kept = await api_client.get("/api/v1/me", headers=headers)
    assert kept.status_code == 200
    stale = await api_client.get("/api/v1/me", headers={"Authorization": f"Bearer {other_token}"})
    assert stale.status_code == 401
    second = await _login(api_client, password="TestPassphrase-002")
    assert second.status_code == 200

    with session_scope() as session:
        user = session.get(User, "SV-DEMO-001")
        assert user is not None
        user.account_status = "disabled"
        session.commit()
    denied = await _login(api_client, password="TestPassphrase-002")
    assert denied.status_code == 401


@pytest.mark.asyncio
async def test_login_rate_limit(api_client):
    for _ in range(8):
        await _login(api_client, password="not-the-password")
    locked = await _login(api_client, password="not-the-password")
    assert locked.status_code == 429
    assert locked.json()["error"]["code"] == "RATE_LIMITED"


@pytest.mark.asyncio
async def test_production_rejects_demo_login(api_client, monkeypatch):
    from campus247.config import get_settings

    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    response = await api_client.post("/api/v1/auth/demo-login", json={"user_id": "SV-DEMO-001"})
    assert response.status_code == 200
    monkeypatch.setenv("DEMO_AUTH_ENABLED", "false")
    get_settings.cache_clear()
    blocked = await api_client.post("/api/v1/auth/demo-login", json={"user_id": "SV-DEMO-001"})
    assert blocked.status_code == 401
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_admin_cannot_read_student_ticket(tmp_path):
    url = f"sqlite:///{tmp_path}/admin.db"
    upgrade_head(url)
    with session_scope(url) as session:
        seed_from_document(session)
        now = utcnow()
        session.add(
            User(
                id="adm_test",
                role="admin",
                name="Admin",
                username="campus-admin",
                password_hash=hash_password(PASSWORD),
                account_status="active",
                is_demo=False,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login", json={"identifier": "campus-admin", "password": PASSWORD, "remember": False}
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        queue = await client.get("/api/v1/officer/tickets", headers=headers)
        assert queue.status_code == 403
        ticket = await client.get("/api/v1/tickets/TKT-DEMO-2026-0001", headers=headers)
        assert ticket.status_code in {403, 404}


@pytest.mark.asyncio
async def test_auth_events_do_not_store_password(api_client):
    await _login(api_client)
    with session_scope() as session:
        events = list(session.scalars(select(AuthEvent)))
        assert events
        dumped = " ".join(f"{event.event} {event.identifier_fingerprint}" for event in events)
        assert PASSWORD not in dumped
        assert "TestPassphrase" not in dumped
        tokens = list(session.scalars(select(SessionToken)))
        assert tokens
        assert all(len(row.token_hash) == 64 for row in tokens)
