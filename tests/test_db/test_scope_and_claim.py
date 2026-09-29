import pytest
from sqlalchemy import select

from src.db.models import Ticket, TicketAssignment
from src.models.contracts_v1 import ClaimRequest
from src.services.access import get_visible_ticket
from src.services.errors import ApiError
from src.services.staff import claim_ticket, list_officer_tickets


def _user(session, user_id):
    from src.db.models import User

    return session.get(User, user_id)


def test_student_cannot_read_another_students_ticket(db_session):
    sv024 = _user(db_session, "SV-DEMO-024")
    with pytest.raises(ApiError) as exc:
        get_visible_ticket(db_session, sv024, "TKT-DEMO-2026-0001")
    assert exc.value.status_code == 404
    assert exc.value.code == "RESOURCE_NOT_FOUND"


def test_academic_officer_does_not_see_wellbeing(db_session):
    academic = _user(db_session, "OF-DEMO-01")
    page = list_officer_tickets(db_session, academic, 1, 100, None, None, None, None)
    ids = {item.id for item in page.items}
    assert "TKT-DEMO-2026-0027" not in ids
    assert all(item.service_type != "student_support" for item in page.items)
    with pytest.raises(ApiError) as exc:
        get_visible_ticket(db_session, academic, "TKT-DEMO-2026-0027")
    assert exc.value.status_code == 404
    support = _user(db_session, "OF-DEMO-02")
    scoped = list_officer_tickets(db_session, support, 1, 100, None, None, None, None)
    assert {item.service_type for item in scoped.items} == {"student_support"}


def test_officer_outside_team_cannot_claim(db_session):
    academic = _user(db_session, "OF-DEMO-01")
    support_ticket = db_session.get(Ticket, "TKT-DEMO-2026-0027")
    with pytest.raises(ApiError) as exc:
        claim_ticket(
            db_session,
            academic,
            support_ticket.id,
            ClaimRequest(expected_revision=support_ticket.revision, confirmed=True),
            "claim-key-1",
            "req-claim-1",
        )
    assert exc.value.status_code == 404


def test_second_claim_loses_when_already_assigned(db_session):
    open_ticket = (
        db_session.execute(select(Ticket).where(Ticket.status == "open", Ticket.team_id == "academic"))
        .scalars()
        .first()
    )
    first = _user(db_session, "OF-DEMO-01")
    second = _user(db_session, "OF-DEMO-03")
    status, body = claim_ticket(
        db_session,
        first,
        open_ticket.id,
        ClaimRequest(expected_revision=open_ticket.revision, confirmed=True),
        "claim-a",
        "req-a",
    )
    assert status == 200
    assert body["ticket"]["assigned_officer_id"] == "OF-DEMO-01"
    db_session.expire_all()
    ticket = db_session.get(Ticket, open_ticket.id)
    with pytest.raises(ApiError) as exc:
        claim_ticket(
            db_session,
            second,
            ticket.id,
            ClaimRequest(expected_revision=ticket.revision, confirmed=True),
            "claim-b",
            "req-b",
        )
    assert exc.value.status_code == 409
    assignments = (
        db_session.execute(select(TicketAssignment).where(TicketAssignment.ticket_id == ticket.id)).scalars().all()
    )
    assert sum(1 for item in assignments if item.officer_id == "OF-DEMO-01") >= 1


def test_claim_replay_rechecks_current_team_membership(db_session):
    from src.db.models import OfficerTeamMembership
    from src.services.common import utcnow

    open_ticket = (
        db_session.execute(select(Ticket).where(Ticket.status == "open", Ticket.team_id == "academic"))
        .scalars()
        .first()
    )
    officer = _user(db_session, "OF-DEMO-01")
    ticket_id = open_ticket.id
    expected_revision = open_ticket.revision
    status, body = claim_ticket(
        db_session,
        officer,
        ticket_id,
        ClaimRequest(expected_revision=expected_revision, confirmed=True),
        "claim-replay-acl",
        "req-replay-acl",
    )
    assert status == 200
    assert body["ticket"]["assigned_officer_id"] == "OF-DEMO-01"
    membership = db_session.get(OfficerTeamMembership, "mem_OF-DEMO-01_academic")
    membership.effective_to = utcnow()
    db_session.commit()
    with pytest.raises(ApiError) as exc:
        claim_ticket(
            db_session,
            officer,
            ticket_id,
            ClaimRequest(expected_revision=expected_revision, confirmed=True),
            "claim-replay-acl",
            "req-replay-acl-2",
        )
    assert exc.value.status_code == 404
    assert exc.value.code == "RESOURCE_NOT_FOUND"


def test_already_assignee_claim_persists_audit_id(db_session):
    from src.db.models import AuditEntry

    ticket = (
        db_session.execute(
            select(Ticket).where(Ticket.assigned_officer_id == "OF-DEMO-03", Ticket.status == "pending_officer")
        )
        .scalars()
        .first()
    )
    officer = _user(db_session, "OF-DEMO-03")
    before = (
        db_session.execute(select(AuditEntry).where(AuditEntry.ticket_id == ticket.id, AuditEntry.action == "claim"))
        .scalars()
        .all()
    )
    assert before == []
    revision = ticket.revision
    status, body = claim_ticket(
        db_session,
        officer,
        ticket.id,
        ClaimRequest(expected_revision=revision, confirmed=True),
        "claim-existing-assignee",
        "req-existing-assignee",
    )
    assert status == 200
    audit_id = body["audit_id"]
    db_session.expire_all()
    audit = db_session.get(AuditEntry, audit_id)
    assert audit is not None
    assert audit.ticket_id == ticket.id
    assert audit.action == "claim"
    assert audit.actor_id == "OF-DEMO-03"
    ticket = db_session.get(Ticket, ticket.id)
    assert ticket.revision == revision
    assert ticket.assigned_officer_id == "OF-DEMO-03"
    status2, body2 = claim_ticket(
        db_session,
        officer,
        ticket.id,
        ClaimRequest(expected_revision=revision, confirmed=True),
        "claim-existing-assignee-2",
        "req-existing-assignee-2",
    )
    assert status2 == 200
    assert body2["audit_id"] == audit_id
    db_session.expire_all()
    claims = (
        db_session.execute(select(AuditEntry).where(AuditEntry.ticket_id == ticket.id, AuditEntry.action == "claim"))
        .scalars()
        .all()
    )
    assert len(claims) == 1
