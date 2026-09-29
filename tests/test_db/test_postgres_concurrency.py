"""Row-lock / concurrent claim tests. Require PostgreSQL.

Uses EDU14_TEST_DATABASE_URL only when it names a disposable test database
(*_test / *_pytest / campus24_pytest). Otherwise starts Docker postgres:16
on 127.0.0.1:54329 and uses database campus24_pytest (container edu14-pytest-postgres).
Never DROP SCHEMA on campus24 or other non-test databases.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import select, text

from alembic import command
from src.db.engine import reset_engine, session_scope
from src.db.models import Ticket
from src.db.seed import seed_from_document
from src.models.contracts_v1 import ClaimRequest
from src.services.errors import ApiError
from src.services.staff import claim_ticket
from tests.db_support import alembic_config, assert_disposable_postgres_url, resolve_postgres_url, upgrade_head


@pytest.fixture
def pg_url():
    try:
        url = resolve_postgres_url()
    except RuntimeError as exc:
        pytest.fail(str(exc))
    if not url:
        pytest.fail(
            "PostgreSQL for concurrent claim was not available. "
            "Set EDU14_TEST_DATABASE_URL to a disposable database (name campus24_pytest "
            "or ending in _test/_pytest) or install Docker so tests can start edu14-pytest-postgres."
        )
    assert_disposable_postgres_url(url)
    upgrade_head(url)
    with session_scope(url) as session:
        session.execute(text("DROP SCHEMA public CASCADE"))
        session.execute(text("CREATE SCHEMA public"))
        session.commit()
    reset_engine()
    upgrade_head(url)
    with session_scope(url) as session:
        seed_from_document(session)
    return url


def test_concurrent_claim_has_single_winner(pg_url):
    with session_scope(pg_url) as session:
        ticket = (
            session.execute(select(Ticket).where(Ticket.status == "open", Ticket.team_id == "academic"))
            .scalars()
            .first()
        )
        ticket_id = ticket.id
        revision = ticket.revision

    def attempt(officer_id: str, key: str):
        from src.db.models import User

        with session_scope(pg_url) as session:
            officer = session.get(User, officer_id)
            try:
                status, body = claim_ticket(
                    session,
                    officer,
                    ticket_id,
                    ClaimRequest(expected_revision=revision, confirmed=True),
                    key,
                    f"req-{key}",
                )
                return status, body["ticket"]["assigned_officer_id"], None
            except ApiError as exc:
                return exc.status_code, None, exc.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(attempt, "OF-DEMO-01", "claim-1")
        second = pool.submit(attempt, "OF-DEMO-03", "claim-2")
        results = [first.result(), second.result()]
    winners = [item for item in results if item[0] == 200]
    losers = [item for item in results if item[0] == 409]
    assert len(winners) == 1
    assert len(losers) == 1
    with session_scope(pg_url) as session:
        ticket = session.get(Ticket, ticket_id)
        assert ticket.assigned_officer_id in {"OF-DEMO-01", "OF-DEMO-03"}


def test_postgres_json_columns_are_jsonb_and_alembic_check_is_clean(pg_url):
    with session_scope(pg_url) as session:
        rows = session.execute(
            text(
                "SELECT table_name, column_name, udt_name "
                "FROM information_schema.columns "
                "WHERE table_schema = 'public' AND udt_name IN ('json', 'jsonb') "
                "ORDER BY table_name, column_name"
            )
        ).all()
    assert rows
    mismatched = [f"{row.table_name}.{row.column_name}={row.udt_name}" for row in rows if row.udt_name != "jsonb"]
    assert mismatched == []
    assert len(rows) == 17
    command.check(alembic_config(pg_url))
