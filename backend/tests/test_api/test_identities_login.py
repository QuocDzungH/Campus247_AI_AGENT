import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from campus247.db.engine import session_scope
from campus247.db.identities import seed_operational_identities
from campus247.main import app
from tests.db_support import upgrade_head

PASSWORD = "Campus247-An18"


@pytest_asyncio.fixture
async def api_client(tmp_path):
    url = f"sqlite:///{tmp_path}/identities-api.db"
    upgrade_head(url)
    with session_scope(url) as session:
        seed_operational_identities(session, password=PASSWORD, reset_passwords=True)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _login(client, identifier="20210018", password=PASSWORD):
    return await client.post(
        "/api/v1/auth/login",
        json={"identifier": identifier, "password": password, "remember": False},
    )


@pytest.mark.asyncio
async def test_password_login_prefill_profile(api_client):
    response = await _login(api_client)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["id"] == "usr_sv_20210018"
    assert body["user"]["name"] == "Nguyễn Văn An"
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    profile = await api_client.get("/api/v1/me/profile", headers=headers)
    assert profile.status_code == 200, profile.text
    data = profile.json()
    assert data["mssv"] == "20210018"
    assert data["full_name"] == "Nguyễn Văn An"
    assert data["major"] == "Kỹ thuật Phần mềm"
    assert data["class_year"] == "Khóa 18 (2021 - 2025) · K18 KTPM"
    assert data["faculty"] == "Khoa Kỹ thuật Máy tính"
    assert data["is_demo"] is False

    by_email = await _login(api_client, identifier="an.nv@vinuni.edu.vn")
    assert by_email.status_code == 200
    officer = await _login(api_client, identifier="ha.tt")
    assert officer.status_code == 200
    assert officer.json()["user"]["role"] == "officer"
