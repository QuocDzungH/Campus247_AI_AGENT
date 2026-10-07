from sqlalchemy import func, select

from campus247.db.engine import session_scope
from campus247.db.identities import DEFAULT_DEV_PASSWORD, seed_operational_identities
from campus247.db.models import OfficerTeamMembership, StudentProfile, User
from campus247.db.seed import seed_from_document
from campus247.services.identity import find_user_by_identifier
from campus247.services.passwords import verify_password
from tests.db_support import upgrade_head

PASSWORD = "Campus247-An18"


def test_operational_identities_seed_profile_and_password(tmp_path):
    url = f"sqlite:///{tmp_path}/identities.db"
    upgrade_head(url)
    with session_scope(url) as session:
        counts = seed_operational_identities(session, password=PASSWORD, reset_passwords=True)
    assert counts["users_created"] == 9
    assert counts["profiles_created"] == 6
    assert counts["memberships_created"] == 3

    with session_scope(url) as session:
        user = find_user_by_identifier(session, "20210018")
        assert user is not None
        assert user.id == "usr_sv_20210018"
        assert user.is_demo is False
        assert user.username == "20210018"
        assert user.email == "an.nv@vinuni.edu.vn"
        assert verify_password(user.password_hash, PASSWORD)
        profile = session.get(StudentProfile, user.id)
        assert profile is not None
        assert profile.full_name == "Nguyễn Văn An"
        assert profile.mssv == "20210018"
        assert profile.major == "Kỹ thuật Phần mềm"
        assert profile.class_year == "Khóa 18 (2021 - 2025) · K18 KTPM"
        assert profile.faculty == "Khoa Kỹ thuật Máy tính"
        assert profile.student_status == "Đang học bình thường"
        assert profile.is_demo is False
        assert find_user_by_identifier(session, "an.nv@vinuni.edu.vn").id == user.id

        officer = find_user_by_identifier(session, "ha.tt")
        assert officer is not None
        assert officer.role == "officer"
        assert officer.is_demo is False
        assert verify_password(officer.password_hash, PASSWORD)
        membership = session.get(OfficerTeamMembership, "mem_usr_of_ha_tt_academic")
        assert membership is not None


def test_operational_identities_idempotent_keeps_password(tmp_path):
    url = f"sqlite:///{tmp_path}/identities.db"
    upgrade_head(url)
    with session_scope(url) as session:
        seed_operational_identities(session, password=PASSWORD, reset_passwords=True)
    with session_scope(url) as session:
        original = find_user_by_identifier(session, "20210018").password_hash
        second = seed_operational_identities(session, password="OtherPass-999", reset_passwords=False)
    assert second["users_created"] == 0
    assert second["users_updated"] == 9
    with session_scope(url) as session:
        user = find_user_by_identifier(session, "20210018")
        assert user.password_hash == original
        assert verify_password(user.password_hash, PASSWORD)
        assert user.name == "Nguyễn Văn An"


def test_operational_identities_do_not_change_demo_seed_counts(tmp_path):
    url = f"sqlite:///{tmp_path}/both.db"
    upgrade_head(url)
    with session_scope(url) as session:
        demo = seed_from_document(session)
        assert demo["users"] == 33
        seed_operational_identities(session, password=PASSWORD, reset_passwords=True)
        total_users = session.execute(select(func.count()).select_from(User)).scalar_one()
        demo_users = session.execute(select(func.count()).select_from(User).where(User.is_demo.is_(True))).scalar_one()
        operational = session.execute(select(func.count()).select_from(User).where(User.is_demo.is_(False))).scalar_one()
    assert total_users == 42
    assert demo_users == 33
    assert operational == 9


def test_resolve_seed_password_requires_env_in_production(monkeypatch, tmp_path):
    url = f"sqlite:///{tmp_path}/prod.db"
    upgrade_head(url)
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("CAMPUS_SEED_PASSWORD", raising=False)
    with session_scope(url) as session:
        try:
            seed_operational_identities(session)
        except SystemExit as exc:
            assert "CAMPUS_SEED_PASSWORD" in str(exc)
        else:
            raise AssertionError("expected SystemExit in production without CAMPUS_SEED_PASSWORD")
    monkeypatch.setenv("CAMPUS_SEED_PASSWORD", PASSWORD)
    with session_scope(url) as session:
        counts = seed_operational_identities(session, reset_passwords=True)
    assert counts["users_created"] == 9
    assert DEFAULT_DEV_PASSWORD == PASSWORD
