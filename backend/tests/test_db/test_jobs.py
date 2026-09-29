from datetime import timedelta

import pytest
from sqlalchemy import select

from campus247.agents.stubs import StubAgent
from campus247.db.models import Job, OfficerBrief, Ticket
from campus247.models.contracts_v1 import Fields, Intake, IntakeResult, Submit1
from campus247.services.common import utcnow
from campus247.services.jobs import enqueue_prepare_brief, lease_next_job, process_job
from campus247.services.student import create_conversation, send_conversation_message, submit1

PREVIEW_INTAKE = IntakeResult(
    route="L2",
    outcome="preview_ready",
    reply="Hãy kiểm tra",
    citations=[],
    intake=Intake(
        service_type="student_certificate",
        fields=Fields(purpose="Vay vốn ngân hàng", destination_org="Ngân hàng mẫu", receive_method="digital_pdf"),
        missing_fields=[],
        invalid_fields=[],
    ),
    handover=None,
)


def _user(session, user_id):
    from campus247.db.models import User

    return session.get(User, user_id)


@pytest.mark.asyncio
async def test_old_revision_job_does_not_overwrite_new_brief(db_session, restore_agent):
    student = _user(db_session, "SV-DEMO-006")
    _, conv = create_conversation(db_session, student, "job-conv", "req-jc")
    _, chat = await send_conversation_message(
        db_session, student, conv["id"], "xin giấy", "job-msg", "req-jm", StubAgent(intake_result=PREVIEW_INTAKE)
    )
    _, submitted = submit1(
        db_session,
        student,
        Submit1(preview_id=chat["preview"]["id"], preview_version=chat["preview"]["version"], confirmed=True),
        "job-sub",
        "req-js",
    )
    ticket = db_session.get(Ticket, submitted["ticket"]["id"])
    old_job = db_session.execute(
        select(Job).where(Job.ticket_id == ticket.id, Job.source_revision == ticket.revision)
    ).scalar_one()
    ticket.revision += 1
    ticket.updated_at = utcnow()
    new_job = enqueue_prepare_brief(db_session, ticket)
    db_session.commit()
    await process_job(db_session, new_job, StubAgent())
    current = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert current.source_ticket_revision == ticket.revision
    old_job = db_session.get(Job, old_job.id)
    await process_job(db_session, old_job, StubAgent())
    db_session.expire_all()
    current = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert current.source_ticket_revision == ticket.revision
    old_job = db_session.get(Job, old_job.id)
    assert old_job.state in {"cancelled", "succeeded"}


def test_worker_reclaims_expired_lease(db_session):
    ticket = db_session.execute(select(Ticket).where(Ticket.status == "open")).scalars().first()
    job = enqueue_prepare_brief(db_session, ticket)
    now = utcnow()
    job.state = "leased"
    job.lease_until = now - timedelta(seconds=5)
    job.attempts = 1
    db_session.commit()
    claimed = lease_next_job(db_session)
    assert claimed is not None
    assert claimed.id == job.id
    assert claimed.state == "leased"
    assert claimed.attempts == 2


def test_prepare_brief_job_is_deduped(db_session):
    ticket = db_session.execute(select(Ticket).where(Ticket.status == "open")).scalars().first()
    first = enqueue_prepare_brief(db_session, ticket)
    second = enqueue_prepare_brief(db_session, ticket)
    assert first.id == second.id
    db_session.commit()
    count = len(db_session.execute(select(Job).where(Job.ticket_id == ticket.id, Job.kind == "prepare_brief")).scalars().all())
    assert count == 1
