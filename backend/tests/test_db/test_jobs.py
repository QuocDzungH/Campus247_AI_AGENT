import asyncio
from datetime import timedelta

import pytest
from sqlalchemy import select

from campus247.agents.stubs import StubAgent
from campus247.db.models import Job, OfficerBrief, Ticket
from campus247.models.contracts_v1 import Fields, Intake, IntakeResult, Submit1
from campus247.services.common import utcnow
from campus247.services.jobs import enqueue_prepare_brief, heartbeat, lease_next_job, process_job
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


@pytest.mark.asyncio
async def test_brief_artifact_uses_agent_runtime_metadata(db_session, restore_agent):
    student = _user(db_session, "SV-DEMO-006")
    _, conv = create_conversation(db_session, student, "meta-conv", "req-mc")
    _, chat = await send_conversation_message(
        db_session, student, conv["id"], "xin giấy", "meta-msg", "req-mm", StubAgent(intake_result=PREVIEW_INTAKE)
    )
    _, submitted = submit1(
        db_session,
        student,
        Submit1(preview_id=chat["preview"]["id"], preview_version=chat["preview"]["version"], confirmed=True),
        "meta-sub",
        "req-ms",
    )
    ticket = db_session.get(Ticket, submitted["ticket"]["id"])
    job = db_session.execute(
        select(Job).where(Job.ticket_id == ticket.id, Job.source_revision == ticket.revision)
    ).scalar_one()

    class NamedAgent(StubAgent):
        def brief_artifact_metadata(self):
            return {
                "model_name": "gpt-4o-mini",
                "prompt_version": "officer-brief-v1/officer-dossier-v2/officer-triage-v3/officer-drafter-v2",
                "template_version": "officer-drafter-v2",
                "index_version": None,
            }

    await process_job(db_session, job, NamedAgent())
    stored = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert stored.model_name == "gpt-4o-mini"
    assert stored.prompt_version == "officer-brief-v1/officer-dossier-v2/officer-triage-v3/officer-drafter-v2"
    assert stored.template_version == "officer-drafter-v2"


@pytest.mark.asyncio
async def test_prepare_brief_fills_approved_sources_from_rag(db_session, restore_agent, monkeypatch):
    from campus247.models.contracts_v1 import Citation, Passage, RetrievalResult

    student = _user(db_session, "SV-DEMO-006")
    _, conv = create_conversation(db_session, student, "src-conv", "req-sc")
    _, chat = await send_conversation_message(
        db_session, student, conv["id"], "xin giấy", "src-msg", "req-sm", StubAgent(intake_result=PREVIEW_INTAKE)
    )
    _, submitted = submit1(
        db_session,
        student,
        Submit1(preview_id=chat["preview"]["id"], preview_version=chat["preview"]["version"], confirmed=True),
        "src-sub",
        "req-ss",
    )
    ticket = db_session.get(Ticket, submitted["ticket"]["id"])
    job = db_session.execute(
        select(Job).where(Job.ticket_id == ticket.id, Job.source_revision == ticket.revision)
    ).scalar_one()
    passage = Passage(
        citation=Citation(
            document_id="demo-qc-giay-001",
            document_title="[Demo] Quy chế học vụ Campus 24/7 — cấp giấy xác nhận sinh viên",
            document_version="2026.09-demo",
            chunk_id="demo-qc-giay-001-c01",
            locator="Điều 5 khoản 1",
            quote="Quy trình cấp giấy xác nhận sinh viên trong tài liệu demo",
            url=None,
        ),
        text="Quy trình cấp giấy xác nhận sinh viên trong tài liệu demo: sinh viên đăng ký trên Campus 24/7.",
        score=2.1,
    )

    class FakeRag:
        index_version = "edu14-demo-academic-v1"

        async def retrieve_policy(self, request):
            return RetrievalResult(status="found", passages=[passage], index_version=self.index_version)

        async def answer_question(self, request):
            raise AssertionError("brief job must use retrieve_policy")

    captured: list = []

    class CaptureAgent(StubAgent):
        async def prepare_officer_brief(self, snapshot):
            captured.append(snapshot)
            return await super().prepare_officer_brief(snapshot)

    monkeypatch.setattr("campus247.services.runtime.get_rag", lambda: FakeRag())
    await process_job(db_session, job, CaptureAgent())
    assert captured
    assert captured[0].approved_sources
    assert captured[0].approved_sources[0].citation.chunk_id == "demo-qc-giay-001-c01"
    stored = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert stored.status == "ready"


@pytest.mark.asyncio
async def test_prepare_brief_index_error_fails_closed(db_session, restore_agent, monkeypatch):
    from campus247.agents.errors import module_error

    student = _user(db_session, "SV-DEMO-006")
    _, conv = create_conversation(db_session, student, "fail-conv", "req-fc")
    _, chat = await send_conversation_message(
        db_session, student, conv["id"], "xin giấy", "fail-msg", "req-fm", StubAgent(intake_result=PREVIEW_INTAKE)
    )
    _, submitted = submit1(
        db_session,
        student,
        Submit1(preview_id=chat["preview"]["id"], preview_version=chat["preview"]["version"], confirmed=True),
        "fail-sub",
        "req-fs",
    )
    ticket = db_session.get(Ticket, submitted["ticket"]["id"])
    job = db_session.execute(
        select(Job).where(Job.ticket_id == ticket.id, Job.source_revision == ticket.revision)
    ).scalar_one()
    job.attempts = 3
    db_session.commit()

    class BrokenRag:
        index_version = "unavailable"

        async def retrieve_policy(self, request):
            raise module_error("INDEX_UNAVAILABLE", stage="retrieval", request_id=job.id)

    class BoomAgent(StubAgent):
        async def prepare_officer_brief(self, snapshot):
            raise AssertionError("must not draft when index is unavailable")

    monkeypatch.setattr("campus247.services.runtime.get_rag", lambda: BrokenRag())
    await process_job(db_session, job, BoomAgent())
    job = db_session.get(Job, job.id)
    assert job.state == "failed"
    assert job.last_error == "INDEX_UNAVAILABLE"
    stored = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert stored.status == "failed"
    assert stored.error["code"] == "INDEX_UNAVAILABLE"
    assert stored.summary is None
    assert stored.draft_reply is None


@pytest.mark.asyncio
async def test_prepare_brief_campus_agent_fact_sheet_from_corpus(db_session, restore_agent, monkeypatch):
    from campus247.agents.factory import create_agent
    from campus247.agents.state import DraftOutput
    from campus247.rag.corpus import CorpusRag
    from tests.test_agents.fakes import ScriptedChatModel
    from tests.test_agents.helpers import officer_scripts

    student = _user(db_session, "SV-DEMO-006")
    _, conv = create_conversation(db_session, student, "l3-conv", "req-l3c")
    _, chat = await send_conversation_message(
        db_session, student, conv["id"], "xin giấy", "l3-msg", "req-l3m", StubAgent(intake_result=PREVIEW_INTAKE)
    )
    _, submitted = submit1(
        db_session,
        student,
        Submit1(preview_id=chat["preview"]["id"], preview_version=chat["preview"]["version"], confirmed=True),
        "l3-sub",
        "req-l3s",
    )
    ticket = db_session.get(Ticket, submitted["ticket"]["id"])
    job = db_session.execute(
        select(Job).where(Job.ticket_id == ticket.id, Job.source_revision == ticket.revision)
    ).scalar_one()

    rag = CorpusRag.from_packaged()
    scripts = officer_scripts()
    scripts["DraftOutput"] = DraftOutput(
        draft_reply="Bộ phận phụ trách sẽ kiểm tra yêu cầu cấp giấy xác nhận sinh viên sau khi rà soát hồ sơ.",
        used_chunk_ids=["demo-qc-giay-001-c01"],
        warnings=[],
    )
    agent = create_agent(
        ScriptedChatModel(scripts), rag, model_name="scripted-campus-agent", index_version=rag.index_version
    )
    monkeypatch.setattr("campus247.services.runtime.get_rag", lambda: rag)
    await process_job(db_session, job, agent)
    stored = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert stored.status == "ready"
    assert stored.facts
    assert stored.index_version == "edu14-demo-academic-v1"
    assert stored.model_name == "scripted-campus-agent"
    assert all(
        item.get("verification_status") != "verified" or item.get("source_type") != "student_message"
        for item in stored.facts
    )
    assert any(item.get("source_type") == "profile" for item in stored.facts)
    citations = stored.citations or []
    assert citations
    source = rag.chunk_text(citations[0]["chunk_id"])
    assert source is not None
    assert citations[0]["quote"] in source


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


async def _certificate_job(db_session, suffix: str):
    student = _user(db_session, "SV-DEMO-006")
    _, conv = create_conversation(db_session, student, f"{suffix}-conv", f"req-{suffix}-c")
    _, chat = await send_conversation_message(
        db_session,
        student,
        conv["id"],
        "xin giấy",
        f"{suffix}-msg",
        f"req-{suffix}-m",
        StubAgent(intake_result=PREVIEW_INTAKE),
    )
    _, submitted = submit1(
        db_session,
        student,
        Submit1(preview_id=chat["preview"]["id"], preview_version=chat["preview"]["version"], confirmed=True),
        f"{suffix}-sub",
        f"req-{suffix}-s",
    )
    ticket = db_session.get(Ticket, submitted["ticket"]["id"])
    job = db_session.execute(
        select(Job).where(Job.ticket_id == ticket.id, Job.source_revision == ticket.revision)
    ).scalar_one()
    return ticket, job


def _reclaim_job(session, job_id: str):
    row = session.get(Job, job_id)
    assert row is not None
    row.lease_until = utcnow() - timedelta(seconds=1)
    session.commit()
    stolen = lease_next_job(session)
    assert stolen is not None
    assert stolen.id == job_id
    return stolen


@pytest.mark.asyncio
async def test_stale_session_ready_brief_does_not_replace_newer(db_session, restore_agent):
    ticket, old_job = await _certificate_job(db_session, "cache")
    started = asyncio.Event()
    release = asyncio.Event()

    class SlowAgent(StubAgent):
        async def prepare_officer_brief(self, snapshot):
            started.set()
            await release.wait()
            return await super().prepare_officer_brief(snapshot)

    task = asyncio.create_task(process_job(db_session, old_job, SlowAgent()))
    await asyncio.wait_for(started.wait(), timeout=5)
    from campus247.db.engine import get_session_factory

    other = get_session_factory()()
    try:
        live = other.get(Ticket, ticket.id)
        live.revision += 1
        live.updated_at = utcnow()
        new_job = enqueue_prepare_brief(other, live)
        other.commit()
        await process_job(other, new_job, StubAgent())
        other.commit()
        current = other.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
        ).scalar_one()
        newer_id = current.id
        newer_revision = current.source_ticket_revision
        assert newer_revision == live.revision
    finally:
        other.close()
    release.set()
    await asyncio.wait_for(task, timeout=5)
    db_session.expire_all()
    current = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert current.id == newer_id
    assert current.source_ticket_revision == newer_revision
    assert current.status == "ready"


@pytest.mark.asyncio
async def test_stale_session_failed_brief_does_not_replace_newer(db_session, restore_agent):
    from campus247.agents.errors import module_error

    ticket, old_job = await _certificate_job(db_session, "cachefail")
    started = asyncio.Event()
    release = asyncio.Event()

    class SlowFail(StubAgent):
        async def prepare_officer_brief(self, snapshot):
            started.set()
            await release.wait()
            raise module_error("PROVIDER_TIMEOUT", stage="brief", request_id=snapshot.request_id)

    task = asyncio.create_task(process_job(db_session, old_job, SlowFail()))
    await asyncio.wait_for(started.wait(), timeout=5)
    from campus247.db.engine import get_session_factory

    other = get_session_factory()()
    try:
        live = other.get(Ticket, ticket.id)
        live.revision += 1
        live.updated_at = utcnow()
        new_job = enqueue_prepare_brief(other, live)
        other.commit()
        await process_job(other, new_job, StubAgent())
        other.commit()
        current = other.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
        ).scalar_one()
        newer_id = current.id
        assert current.status == "ready"
    finally:
        other.close()
    release.set()
    await asyncio.wait_for(task, timeout=5)
    db_session.expire_all()
    current = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert current.id == newer_id
    assert current.status == "ready"
    failed = (
        db_session.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.status == "failed")
        )
        .scalars()
        .all()
    )
    assert all(row.is_current is False for row in failed)


@pytest.mark.asyncio
async def test_retrieval_timeout_fails_closed(db_session, restore_agent, monkeypatch):
    ticket, job = await _certificate_job(db_session, "rto")
    job.attempts = 3
    db_session.commit()

    class Settings:
        worker_lease_seconds = 60
        worker_max_attempts = 3
        worker_retrieval_timeout_seconds = 1

    class SlowRag:
        async def retrieve_policy(self, request):
            await asyncio.sleep(3)
            raise AssertionError("retrieval must time out")

    monkeypatch.setattr("campus247.services.jobs.get_settings", lambda: Settings())
    monkeypatch.setattr("campus247.services.runtime.get_rag", lambda: SlowRag())
    await process_job(db_session, job, StubAgent())
    job = db_session.get(Job, job.id)
    assert job.state == "failed"
    assert job.last_error == "PROVIDER_TIMEOUT"
    stored = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert stored.status == "failed"
    assert stored.draft_reply is None


@pytest.mark.asyncio
async def test_stolen_lease_does_not_publish_over_new_owner(db_session, restore_agent, monkeypatch):
    from campus247.db.engine import get_session_factory
    from campus247.models.contracts_v1 import RetrievalResult

    ticket, job = await _certificate_job(db_session, "steal")
    hang = asyncio.Event()

    class HangRag:
        async def retrieve_policy(self, request):
            await hang.wait()
            return RetrievalResult(status="empty", passages=[], index_version="hang")

    monkeypatch.setattr("campus247.services.runtime.get_rag", lambda: HangRag())
    claimed = lease_next_job(db_session)
    assert claimed.id == job.id
    db_session.commit()
    task = asyncio.create_task(process_job(db_session, claimed, StubAgent()))
    await asyncio.sleep(0.3)
    other = get_session_factory()()
    try:
        stolen_row = other.get(Job, job.id)
        stolen_row.lease_until = utcnow() - timedelta(seconds=1)
        other.commit()
        stolen = lease_next_job(other)
        assert stolen is not None
        assert stolen.id == job.id
        assert stolen.attempts > claimed.attempts

        class FastRag:
            async def retrieve_policy(self, request):
                return RetrievalResult(status="empty", passages=[], index_version="fast")

        monkeypatch.setattr("campus247.services.runtime.get_rag", lambda: FastRag())
        await process_job(other, stolen, StubAgent())
        other.commit()
        current = other.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
        ).scalar_one()
        winner_id = current.id
        assert current.status == "ready"
    finally:
        other.close()
    hang.set()
    await asyncio.wait_for(task, timeout=5)
    db_session.expire_all()
    current = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert current.id == winner_id
    assert current.status == "ready"


@pytest.mark.asyncio
async def test_publish_after_ownership_check_does_not_overwrite_new_owner(db_session, restore_agent, monkeypatch):
    from campus247.db.engine import get_session_factory

    ticket, job = await _certificate_job(db_session, "tocpub")
    claimed = lease_next_job(db_session)
    assert claimed.id == job.id
    token = claimed.attempts
    db_session.commit()
    started = asyncio.Event()
    release = asyncio.Event()

    async def hook():
        started.set()
        await release.wait()

    monkeypatch.setattr("campus247.services.jobs._before_ownership_write", hook)
    task = asyncio.create_task(process_job(db_session, claimed, StubAgent(), owner_attempts=token))
    await asyncio.wait_for(started.wait(), timeout=5)
    other = get_session_factory()()
    try:
        stolen = _reclaim_job(other, job.id)
        assert stolen.attempts > token
        monkeypatch.setattr("campus247.services.jobs._before_ownership_write", lambda: None)
        await process_job(other, stolen, StubAgent(), owner_attempts=stolen.attempts)
        other.commit()
        current = other.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
        ).scalar_one()
        winner_id = current.id
        assert current.status == "ready"
        assert current.brief_version == 1
    finally:
        other.close()
    release.set()
    await asyncio.wait_for(task, timeout=5)
    db_session.expire_all()
    briefs = (
        db_session.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id).order_by(OfficerBrief.brief_version)
        )
        .scalars()
        .all()
    )
    current = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert len(briefs) == 1
    assert current.id == winner_id
    assert current.brief_version == 1
    assert current.status == "ready"
    job = db_session.get(Job, job.id)
    assert job.state == "succeeded"
    assert job.attempts > token


@pytest.mark.asyncio
async def test_fail_after_ownership_check_does_not_replace_new_owner_brief(db_session, restore_agent, monkeypatch):
    from campus247.agents.errors import module_error
    from campus247.db.engine import get_session_factory

    ticket, job = await _certificate_job(db_session, "tocfail")
    job.attempts = 2
    db_session.commit()
    claimed = lease_next_job(db_session)
    token = claimed.attempts
    assert token >= 3
    db_session.commit()
    started = asyncio.Event()
    release = asyncio.Event()

    async def hook():
        started.set()
        await release.wait()

    class FailAgent(StubAgent):
        async def prepare_officer_brief(self, snapshot):
            raise module_error("PROVIDER_TIMEOUT", stage="brief", request_id=snapshot.request_id)

    monkeypatch.setattr("campus247.services.jobs._before_ownership_write", hook)
    task = asyncio.create_task(process_job(db_session, claimed, FailAgent(), owner_attempts=token))
    await asyncio.wait_for(started.wait(), timeout=5)
    other = get_session_factory()()
    try:
        stolen = _reclaim_job(other, job.id)
        monkeypatch.setattr("campus247.services.jobs._before_ownership_write", lambda: None)
        await process_job(other, stolen, StubAgent(), owner_attempts=stolen.attempts)
        other.commit()
        current = other.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
        ).scalar_one()
        winner_id = current.id
        assert current.status == "ready"
    finally:
        other.close()
    release.set()
    await asyncio.wait_for(task, timeout=5)
    db_session.expire_all()
    current = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert current.id == winner_id
    assert current.status == "ready"
    failed = (
        db_session.execute(
            select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.status == "failed")
        )
        .scalars()
        .all()
    )
    assert failed == []
    job = db_session.get(Job, job.id)
    assert job.state == "succeeded"


@pytest.mark.asyncio
async def test_runner_does_not_adopt_stolen_attempt_before_process(db_session, restore_agent):
    from campus247.db.engine import get_session_factory
    from campus247.workers.runner import _process

    ticket, job = await _certificate_job(db_session, "runid")
    claimed = lease_next_job(db_session)
    assert claimed.id == job.id
    token = claimed.attempts
    job_id = job.id
    db_session.commit()
    started = asyncio.Event()
    release = asyncio.Event()

    class SlowAgent(StubAgent):
        async def prepare_officer_brief(self, snapshot):
            started.set()
            await release.wait()
            return await super().prepare_officer_brief(snapshot)

    other = get_session_factory()()
    try:
        stolen = _reclaim_job(other, job_id)
        assert stolen.attempts != token
        task = asyncio.create_task(process_job(other, stolen, SlowAgent(), owner_attempts=stolen.attempts))
        await asyncio.wait_for(started.wait(), timeout=5)
        await _process(job_id, token)
        other.expire_all()
        live = other.get(Job, job_id)
        assert live.state == "leased"
        assert live.attempts == stolen.attempts
        assert (
            other.execute(select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id)).scalars().first() is None
        )
    finally:
        release.set()
        await asyncio.wait_for(task, timeout=5)
        other.close()
    db_session.expire_all()
    current = db_session.execute(
        select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True))
    ).scalar_one()
    assert current.status == "ready"
    assert current.brief_version == 1
    briefs = db_session.execute(select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id)).scalars().all()
    assert len(briefs) == 1


@pytest.mark.asyncio
async def test_stale_token_does_not_reclaim_pending_retry(db_session, restore_agent):
    from campus247.agents.errors import module_error
    from campus247.db.engine import get_session_factory
    from campus247.workers.runner import _process

    ticket, job = await _certificate_job(db_session, "pendtok")
    claimed = lease_next_job(db_session)
    token = claimed.attempts
    job_id = claimed.id
    db_session.commit()
    assert token == 1

    class TimeoutAgent(StubAgent):
        async def prepare_officer_brief(self, snapshot):
            raise module_error("PROVIDER_TIMEOUT", stage="brief", request_id=snapshot.request_id)

    other = get_session_factory()()
    try:
        stolen = _reclaim_job(other, job_id)
        assert stolen.attempts == 2
        await process_job(other, stolen, TimeoutAgent(), owner_attempts=stolen.attempts)
        other.commit()
        live = other.get(Job, job_id)
        assert live.state == "pending"
        assert live.attempts == 2
        assert live.lease_until is None
        assert live.available_at > utcnow()
        pending_available = live.available_at
        pending_updated = live.updated_at
        pending_error = live.last_error
    finally:
        other.close()

    await process_job(db_session, claimed, StubAgent(), owner_attempts=token)
    db_session.commit()
    await _process(job_id, token)

    db_session.expire_all()
    live = db_session.get(Job, job_id)
    assert live.state == "pending"
    assert live.attempts == 2
    assert live.available_at == pending_available
    assert live.updated_at == pending_updated
    assert live.last_error == pending_error
    assert live.lease_until is None
    assert db_session.execute(select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id)).scalars().first() is None


def test_heartbeat_does_not_extend_stolen_lease(db_session):
    from campus247.db.engine import get_session_factory

    ticket = db_session.execute(select(Ticket).where(Ticket.status == "open")).scalars().first()
    enqueue_prepare_brief(db_session, ticket)
    claimed = lease_next_job(db_session)
    token = claimed.attempts
    db_session.commit()
    other = get_session_factory()()
    try:
        stolen = _reclaim_job(other, claimed.id)
        stolen_until = stolen.lease_until
        stolen_attempts = stolen.attempts
        other.commit()
        assert heartbeat(db_session, claimed, token) is False
        db_session.rollback()
        other.expire_all()
        live = other.get(Job, claimed.id)
        assert live.attempts == stolen_attempts
        assert live.lease_until == stolen_until
        assert live.state == "leased"
        assert heartbeat(other, live, stolen_attempts) is True
        other.commit()
        other.refresh(live)
        assert live.lease_until != stolen_until
    finally:
        other.close()


def test_prepare_brief_job_is_deduped(db_session):
    ticket = db_session.execute(select(Ticket).where(Ticket.status == "open")).scalars().first()
    first = enqueue_prepare_brief(db_session, ticket)
    second = enqueue_prepare_brief(db_session, ticket)
    assert first.id == second.id
    db_session.commit()
    count = len(
        db_session.execute(select(Job).where(Job.ticket_id == ticket.id, Job.kind == "prepare_brief")).scalars().all()
    )
    assert count == 1
