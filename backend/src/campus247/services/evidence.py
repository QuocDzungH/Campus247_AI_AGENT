"""Evidence fingerprint and stale marking when the student dossier changes."""

from __future__ import annotations

import hashlib
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from campus247.db.models import OfficerBrief, Ticket, TicketAttachment
from campus247.services.common import utcnow


def evidence_fingerprint(session: Session, ticket: Ticket) -> str:
    attachments = [
        {"id": row.id, "name": row.filename, "size": row.size_bytes, "key": row.object_key}
        for row in session.execute(
            select(TicketAttachment)
            .where(TicketAttachment.ticket_id == ticket.id)
            .order_by(TicketAttachment.created_at, TicketAttachment.id)
        ).scalars()
    ]
    payload = {
        "request_data": ticket.request_data,
        "attachments": attachments,
        "revision": ticket.revision,
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def mark_verifications_stale(ticket: Ticket, fingerprint: str) -> None:
    items = []
    for item in ticket.system_verifications or []:
        if not isinstance(item, dict):
            continue
        row = dict(item)
        prior = row.get("source_hash")
        if prior and prior != fingerprint:
            row["stale"] = True
            row["officer_review_status"] = "pending"
            row["officer_resolution"] = "none"
            row["officer_reviewed_by"] = None
            row["officer_reviewed_at"] = None
        items.append(row)
    ticket.system_verifications = items
    ticket.evidence_fingerprint = fingerprint


def mark_briefs_and_evidence_stale(session: Session, ticket: Ticket) -> str:
    from campus247.services.jobs import mark_briefs_stale

    fingerprint = evidence_fingerprint(session, ticket)
    mark_briefs_stale(session, ticket.id)
    mark_verifications_stale(ticket, fingerprint)
    current = (
        session.execute(select(OfficerBrief).where(OfficerBrief.ticket_id == ticket.id, OfficerBrief.is_current.is_(True)))
        .scalars()
        .first()
    )
    if current is not None and current.status == "ready":
        current.status = "stale"
        current.updated_at = utcnow()
    return fingerprint


def bump_evidence(session: Session, ticket: Ticket) -> str:
    now = utcnow()
    ticket.revision += 1
    ticket.updated_at = now
    return mark_briefs_and_evidence_stale(session, ticket)


def mark_supplements_fulfilled(ticket: Ticket) -> None:
    rows = []
    for item in ticket.supplement_requests or []:
        if not isinstance(item, dict):
            continue
        row = dict(item)
        if row.get("status") == "open":
            row["status"] = "fulfilled"
            items = []
            for entry in row.get("items") or []:
                if isinstance(entry, dict):
                    items.append({**entry, "status": "fulfilled"})
                else:
                    items.append(entry)
            row["items"] = items
        rows.append(row)
    ticket.supplement_requests = rows
