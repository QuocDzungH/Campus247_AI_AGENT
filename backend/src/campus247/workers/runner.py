import asyncio
import logging
import time

from campus247.db.engine import session_scope
from campus247.services.jobs import lease_next_job, process_job
from campus247.services.runtime import get_agent

log = logging.getLogger("campus.worker")


def run_once() -> bool:
    with session_scope() as session:
        job = lease_next_job(session)
        if job is None:
            session.commit()
            return False
        session.commit()
        job_id = job.id
    return asyncio.run(_process(job_id))


async def _process(job_id: str) -> bool:
    from campus247.db.models import Job

    with session_scope() as session:
        job = session.get(Job, job_id)
        if job is None:
            return False
        await process_job(session, job, get_agent())
        return True


def run_forever(idle_sleep: float = 1.0) -> None:
    logging.basicConfig(level=logging.INFO)
    log.info("worker started")
    while True:
        try:
            worked = run_once()
        except Exception:
            log.exception("worker loop failed")
            worked = False
        if not worked:
            time.sleep(idle_sleep)
