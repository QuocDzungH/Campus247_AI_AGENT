"""Local file storage for ticket attachments. Bytes stay on disk, metadata in SQL."""

from __future__ import annotations

from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from campus247.config import get_settings
from campus247.db.models import TicketAttachment, User
from campus247.models import contracts_v1 as c
from campus247.services.access import get_visible_ticket
from campus247.services.common import ensure_utc, new_id, utcnow
from campus247.services.errors import forbidden, not_found, validation

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
}
MAX_BYTES = 10 * 1024 * 1024
MAX_FILES_PER_TICKET = 20


def _root() -> Path:
    path = Path(get_settings().files_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def _safe_filename(name: str) -> str:
    cleaned = Path(name).name.strip() or "upload.bin"
    return cleaned[:200]


def attachment_to_contract(row: TicketAttachment) -> c.AttachmentView:
    field = None
    if row.object_key and "#" in row.object_key:
        field = row.object_key.split("#", 1)[1] or None
    return c.AttachmentView(
        id=row.id,
        filename=row.filename,
        mime_type=row.mime_type,
        size_bytes=row.size_bytes,
        field=field,
        created_at=ensure_utc(row.created_at),
    )


def disk_path(row: TicketAttachment) -> Path:
    key = (row.object_key or row.id).split("#", 1)[0]
    return _root() / row.ticket_id / key


def list_attachments(session: Session, actor: User, ticket_id: str) -> list[c.AttachmentView]:
    ticket = get_visible_ticket(session, actor, ticket_id)
    rows = session.execute(
        select(TicketAttachment).where(TicketAttachment.ticket_id == ticket.id).order_by(TicketAttachment.created_at)
    ).scalars()
    return [attachment_to_contract(row) for row in rows]


async def save_upload(session: Session, actor: User, ticket_id: str, upload: UploadFile, field: str | None) -> c.AttachmentView:
    ticket = get_visible_ticket(session, actor, ticket_id)
    if actor.role == "student" and ticket.student_id != actor.id:
        raise not_found()
    if actor.role == "admin":
        raise forbidden()
    count = len(
        list(session.execute(select(TicketAttachment.id).where(TicketAttachment.ticket_id == ticket.id)).scalars())
    )
    if count >= MAX_FILES_PER_TICKET:
        raise validation("Hồ sơ đã đủ số tệp cho phép.")
    mime = (upload.content_type or "").split(";")[0].strip().lower()
    if mime not in ALLOWED_TYPES:
        raise validation("Chỉ nhận PDF, PNG hoặc JPEG.")
    payload = await upload.read()
    if not payload or len(payload) > MAX_BYTES:
        raise validation("Tệp rỗng hoặc vượt 10MB.")
    now = utcnow()
    attachment_id = new_id("att")
    filename = _safe_filename(upload.filename or f"file{ALLOWED_TYPES[mime]}")
    object_key = f"{attachment_id}{ALLOWED_TYPES[mime]}"
    if field:
        object_key = f"{object_key}#{field[:64]}"
    row = TicketAttachment(
        id=attachment_id,
        ticket_id=ticket.id,
        filename=filename,
        mime_type=mime,
        size_bytes=len(payload),
        object_key=object_key,
        uploader_id=actor.id,
        created_at=now,
    )
    session.add(row)
    target = disk_path(row)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)
    if ticket.status != "resolved":
        from campus247.services.evidence import bump_evidence, mark_supplements_fulfilled
        from campus247.services.student import _audit

        bump_evidence(session, ticket)
        mark_supplements_fulfilled(ticket)
        _audit(session, ticket, actor.id, actor.role, "attachment", ticket.status, ticket.status, "attachment", now)
    session.commit()
    return attachment_to_contract(row)


def open_download(session: Session, actor: User, ticket_id: str, attachment_id: str) -> tuple[Path, TicketAttachment]:
    ticket = get_visible_ticket(session, actor, ticket_id)
    row = session.get(TicketAttachment, attachment_id)
    if row is None or row.ticket_id != ticket.id:
        raise not_found()
    path = disk_path(row)
    if not path.is_file():
        raise not_found()
    return path, row
