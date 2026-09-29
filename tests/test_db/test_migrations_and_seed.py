from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import inspect, select, text

from src.db.engine import get_engine, session_scope
from src.db.models import Ticket, User
from src.db.seed import seed_from_document
from src.models.contracts_v1 import ClaimRequest
from src.services.staff import claim_ticket
from tests.db_support import ROOT, downgrade_base, upgrade_head


def test_initial_revision_records_explicit_table_ops():
    path = Path(ROOT / "alembic" / "versions" / "20260929_0001_initial_campus_schema.py")
    source = path.read_text(encoding="utf-8")
    assert "Base.metadata.create_all" not in source
    assert "Base.metadata.drop_all" not in source
    assert source.count("op.create_table") >= 24
    assert source.count("op.drop_table") >= 24
    assert "sa.JSON().with_variant" in source or "JSON_PAYLOAD" in source
    assert "JSONB" in source


def test_alembic_upgrade_from_empty_and_downgrade(tmp_path):
    url = f"sqlite:///{tmp_path}/empty.db"
    upgrade_head(url)
    tables = inspect(get_engine(url)).get_table_names()
    assert "tickets" in tables
    assert "jobs" in tables
    assert "idempotency_records" in tables
    assert "officer_team_memberships" in tables
    downgrade_base(url)
    assert inspect(get_engine(url)).get_table_names() == ["alembic_version"]
    upgrade_head(url)
    assert "tickets" in inspect(get_engine(url)).get_table_names()


def test_seed_is_idempotent_and_normalizes_plus07(db_session):
    first = {
        "users": db_session.execute(select(User)).scalars().all().__len__(),
        "tickets": db_session.execute(select(Ticket)).scalars().all().__len__(),
    }
    counts = seed_from_document(db_session)
    assert counts["users"] == first["users"] == 33
    assert counts["tickets"] == first["tickets"] == 30
    assert counts["assignments"] == 25
    ticket = db_session.get(Ticket, "TKT-DEMO-2026-0001")
    assert ticket is not None
    assert ticket.created_at.tzinfo is not None
    expected = datetime(2026, 8, 31, 9, 0, tzinfo=timezone(timedelta(hours=7))).astimezone(UTC)
    assert ticket.created_at == expected
    assert ticket.team_id == "academic"
    support = db_session.get(Ticket, "TKT-DEMO-2026-0027")
    assert support.team_id == "student_support"
    assert support.assigned_officer_id == "OF-DEMO-02"


def test_seed_insert_only_keeps_live_claim_until_reset(db_session):
    from src.db.models import User as UserRow

    open_ticket = (
        db_session.execute(select(Ticket).where(Ticket.status == "open", Ticket.team_id == "academic"))
        .scalars()
        .first()
    )
    officer = db_session.get(UserRow, "OF-DEMO-01")
    claim_ticket(
        db_session,
        officer,
        open_ticket.id,
        ClaimRequest(expected_revision=open_ticket.revision, confirmed=True),
        "seed-claim",
        "req-seed-claim",
    )
    db_session.expire_all()
    claimed = db_session.get(Ticket, open_ticket.id)
    assert claimed.assigned_officer_id == "OF-DEMO-01"
    live_revision = claimed.revision
    seed_from_document(db_session)
    db_session.expire_all()
    preserved = db_session.get(Ticket, open_ticket.id)
    assert preserved.assigned_officer_id == "OF-DEMO-01"
    assert preserved.revision == live_revision
    seed_from_document(db_session, reset=True)
    db_session.expire_all()
    restored = db_session.get(Ticket, open_ticket.id)
    assert restored.assigned_officer_id is None
    assert restored.revision == 1
    assert restored.status == "open"


def test_unique_and_check_constraints(db_url):
    with session_scope(db_url) as session:
        seed_from_document(session)
        with pytest.raises(Exception):
            session.execute(
                text(
                    "INSERT INTO users (id, role, name, is_demo, created_at, updated_at) VALUES ('SV-DEMO-001','student','dup',1,'2026-01-01 00:00:00+00','2026-01-01 00:00:00+00')"
                )
            )
            session.commit()
        session.rollback()
        with pytest.raises(Exception):
            session.execute(
                text(
                    "INSERT INTO tickets (id, code, conversation_id, student_id, team_id, category, service_type, status, priority, priority_reasons, summary, revision, created_at, updated_at) "
                    "VALUES ('tkt_dup','TKT-DEMO-2026-0001','CONV-DEMO-0002','SV-DEMO-002','academic','action','student_certificate','open','normal','[]','x',1,'2026-01-01 00:00:00+00','2026-01-01 00:00:00+00')"
                )
            )
            session.commit()
