"""Document drafts, issuance, and unsigned signing provider."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from campus247.config import get_settings
from campus247.db.models import IssuedDocument, StudentProfile, Ticket, User
from campus247.models import contracts_v1 as c
from campus247.services.common import ensure_utc, new_id, utcnow
from campus247.services.errors import ApiError, not_found, validation
from campus247.services.pdf import build_document_pdf, safe_filename, sha256_hex
from campus247.services.process_catalog import get_process
from campus247.services.verification import criterion_resolved_for_issue


def _root() -> Path:
    path = Path(get_settings().files_dir).resolve() / "issued"
    path.mkdir(parents=True, exist_ok=True)
    return path


def signing_status() -> tuple[str, str]:
    provider = (get_settings().signing_provider or "none").strip() or "none"
    if provider == "none":
        return "unsigned", "none"
    return "pending_signature", provider


def current_draft(ticket: Ticket) -> dict | None:
    draft = ticket.document_draft
    return dict(draft) if isinstance(draft, dict) else None


def _optional_text(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def draft_view(ticket: Ticket) -> c.DocumentDraftView | None:
    draft = current_draft(ticket)
    if draft is None:
        spec = get_process(ticket.service_type)
        if spec.template_status == "unavailable":
            return c.DocumentDraftView(
                ticket_id=ticket.id,
                version=0,
                template_id=spec.template_id or "none",
                template_version=spec.template_version or "none",
                template_status="unavailable",
                status="unavailable",
                student_snapshot={},
                purpose=None,
                destination_org=None,
                notes=None,
                valid_until=None,
                authored_by=None,
                approved_by=None,
                content_hash=None,
                updated_at=ticket.updated_at.isoformat() if ticket.updated_at else None,
            )
        return None
    allowed = set(c.DocumentDraftView.model_fields)
    payload = {key: value for key, value in draft.items() if key in allowed}
    payload["ticket_id"] = ticket.id
    for key in ("purpose", "destination_org", "notes", "valid_until", "authored_by", "approved_by", "content_hash", "updated_at"):
        if key in payload:
            payload[key] = _optional_text(payload.get(key))
    snapshot = payload.get("student_snapshot")
    payload["student_snapshot"] = dict(snapshot) if isinstance(snapshot, dict) else {}
    return c.DocumentDraftView.model_validate(payload)


def issued_view(row: IssuedDocument | None) -> c.IssuedDocumentView | None:
    if row is None:
        return None
    return c.IssuedDocumentView(
        id=row.id,
        ticket_id=row.ticket_id,
        draft_version=row.draft_version,
        template_id=row.template_id,
        template_version=row.template_version,
        filename=row.filename,
        sha256=row.sha256,
        issued_by=row.issued_by,
        issued_at=ensure_utc(row.issued_at),
        signature_status=row.signature_status,  # type: ignore[arg-type]
        signing_provider=row.signing_provider,
        official=False,
    )


def ensure_draft(session: Session, ticket: Ticket, actor: User) -> dict:
    spec = get_process(ticket.service_type)
    existing = current_draft(ticket)
    if existing and existing.get("status") != "unavailable":
        return existing
    if spec.template_status != "approved" or not spec.template_id:
        draft = {
            "version": 1,
            "template_id": spec.template_id or "none",
            "template_version": spec.template_version or "none",
            "template_status": "unavailable",
            "status": "unavailable",
            "student_snapshot": {},
            "purpose": None,
            "destination_org": None,
            "notes": None,
            "valid_until": None,
            "authored_by": actor.id,
            "content_hash": None,
            "updated_at": utcnow().isoformat(),
        }
        ticket.document_draft = draft
        return draft
    profile = session.get(StudentProfile, ticket.student_id)
    student = session.get(User, ticket.student_id)
    data = ticket.request_data if isinstance(ticket.request_data, dict) else {}
    snapshot = {
        "full_name": (profile.full_name if profile else None) or (student.name if student else None),
        "mssv": (profile.mssv if profile else None),
        "class_year": (profile.class_year if profile else None),
        "major": (profile.major if profile else None),
        "faculty": (profile.faculty if profile else None),
        "student_status": (profile.student_status if profile else None),
        "verification_status": (profile.verification_status if profile else None),
        "source": (profile.source if profile else None),
    }
    now = utcnow()
    draft = {
        "version": 1,
        "template_id": spec.template_id,
        "template_version": spec.template_version,
        "template_status": "approved",
        "status": "draft",
        "student_snapshot": snapshot,
        "purpose": data.get("purpose"),
        "destination_org": data.get("destination_org"),
        "notes": None,
        "valid_until": None,
        "authored_by": actor.id,
        "content_hash": None,
        "updated_at": now.isoformat(),
    }
    ticket.document_draft = draft
    return draft


def patch_draft(ticket: Ticket, actor: User, body: c.DocumentDraftPatch) -> dict:
    draft = current_draft(ticket)
    if draft is None:
        raise not_found()
    if draft.get("template_status") != "approved":
        raise ApiError(409, "TEMPLATE_UNAVAILABLE", "Loại dịch vụ này chưa có mẫu được phê duyệt.")
    if draft.get("status") == "issued":
        raise ApiError(409, "INVALID_STATUS_TRANSITION", "Tài liệu đã phát hành không sửa nháp.")
    if body.expected_draft_version is not None and body.expected_draft_version != draft.get("version"):
        raise ApiError(409, "STALE_REVISION", "Bản thảo đã đổi. Tải lại trước khi lưu.")
    now = utcnow()
    next_draft = dict(draft)
    if body.purpose is not None:
        next_draft["purpose"] = body.purpose
    if body.destination_org is not None:
        next_draft["destination_org"] = body.destination_org
    if body.notes is not None:
        next_draft["notes"] = body.notes
    next_draft["version"] = int(draft.get("version") or 1) + 1
    next_draft["status"] = "draft"
    next_draft["authored_by"] = actor.id
    next_draft["updated_at"] = now.isoformat()
    ticket.document_draft = next_draft
    ticket.updated_at = now
    return next_draft


def _gate_failures(session: Session, ticket: Ticket, actor: User) -> list[str]:
    spec = get_process(ticket.service_type)
    reasons: list[str] = []
    if ticket.assigned_officer_id != actor.id:
        reasons.append("Cần đúng cán bộ được giao ca.")
    if spec.template_status != "approved":
        reasons.append("Chưa có mẫu được phê duyệt.")
    required_ids = {item["id"] for item in spec.required_checklist}
    checked = {
        item.get("id")
        for item in (ticket.officer_checklist or [])
        if isinstance(item, dict) and item.get("checked") and item.get("id") in required_ids
    }
    missing = required_ids - checked
    if missing:
        reasons.append("Chưa đánh dấu đủ tiêu chí bắt buộc trên checklist quy trình.")
    items = [dict(item) for item in (ticket.system_verifications or []) if isinstance(item, dict)]
    by_key = {item.get("criterion_key"): item for item in items}
    if not items:
        reasons.append("Chưa chạy đối soát.")
    for key in spec.issue_required_criteria:
        item = by_key.get(key)
        if item is None:
            reasons.append(f"Thiếu kết quả đối soát {key}.")
            continue
        if item.get("stale"):
            reasons.append(f"Kết quả {key} đã cũ, cần chạy lại.")
            continue
        if not criterion_resolved_for_issue(item, required=True):
            reasons.append(f"Tiêu chí {key} chưa đạt hoặc mới xem kết quả, chưa được giải quyết.")
    draft = current_draft(ticket)
    if draft is None or draft.get("status") == "unavailable":
        reasons.append("Chưa có bản thảo hợp lệ.")
    return reasons


def issue_document(session: Session, ticket: Ticket, actor: User, expected_draft_version: int) -> IssuedDocument:
    spec = get_process(ticket.service_type)
    existing = session.execute(select(IssuedDocument).where(IssuedDocument.ticket_id == ticket.id)).scalar_one_or_none()
    if existing is not None:
        raise ApiError(409, "INVALID_STATUS_TRANSITION", "Hồ sơ đã có tài liệu phát hành.")
    failures = _gate_failures(session, ticket, actor)
    if failures:
        raise ApiError(409, "GATE_FAILED", " ".join(failures))
    draft = current_draft(ticket)
    if draft is None:
        raise not_found()
    if expected_draft_version != draft.get("version"):
        raise ApiError(409, "STALE_REVISION", "Bản thảo đã đổi. Tải lại trước khi phát hành.")
    student = session.get(User, ticket.student_id)
    snapshot = draft.get("student_snapshot") if isinstance(draft.get("student_snapshot"), dict) else {}
    now = utcnow()
    sig_status, provider = signing_status()
    payload = {
        "ticket_id": ticket.id,
        "ticket_code": ticket.code,
        "template_id": draft.get("template_id"),
        "template_version": draft.get("template_version"),
        "student": snapshot,
        "purpose": draft.get("purpose"),
        "destination_org": draft.get("destination_org"),
        "notes": draft.get("notes"),
        "valid_until": draft.get("valid_until"),
        "issued_at": now.isoformat(),
        "issued_by": actor.id,
        "signature_status": sig_status,
        "signing_provider": provider,
        "official": False,
    }
    pdf = build_document_pdf(
        title=spec.label,
        fields=[
            ("Ma don", ticket.code),
            ("Ho ten", str(snapshot.get("full_name") or (student.name if student else ""))),
            ("MSSV", str(snapshot.get("mssv") or "")),
            ("Khoa", str(snapshot.get("class_year") or "")),
            ("Nganh", str(snapshot.get("major") or "")),
            ("Muc dich", str(draft.get("purpose") or "")),
            ("Noi nhan", str(draft.get("destination_org") or "")),
            ("Can bo", actor.name),
            ("Ky so", sig_status),
        ],
        notice="Ban he thong phat hanh. Chua ky so. Khong su dung nhu giay co gia tri chinh thuc.",
    )
    doc_id = new_id("doc")
    filename = safe_filename(ticket.code)
    object_key = f"{ticket.id}/{doc_id}.pdf"
    target = _root() / ticket.id
    target.mkdir(parents=True, exist_ok=True)
    path = target / f"{doc_id}.pdf"
    path.write_bytes(pdf)
    row = IssuedDocument(
        id=doc_id,
        ticket_id=ticket.id,
        draft_version=int(draft["version"]),
        template_id=str(draft.get("template_id") or spec.template_id),
        template_version=str(draft.get("template_version") or spec.template_version or "v1"),
        filename=filename,
        mime_type="application/pdf",
        size_bytes=len(pdf),
        object_key=object_key,
        sha256=sha256_hex(pdf),
        payload=payload,
        issued_by=actor.id,
        issued_at=now,
        signature_status=sig_status,
        signing_provider=provider,
        created_at=now,
    )
    session.add(row)
    next_draft = dict(draft)
    next_draft["status"] = "issued"
    next_draft["approved_by"] = actor.id
    next_draft["updated_at"] = now.isoformat()
    ticket.document_draft = next_draft
    ticket.updated_at = now
    ticket.revision += 1
    return row


def open_issued(session: Session, actor: User, ticket: Ticket, document_id: str) -> tuple[Path, IssuedDocument]:
    row = session.get(IssuedDocument, document_id)
    if row is None or row.ticket_id != ticket.id:
        raise not_found()
    if actor.role == "student" and ticket.student_id != actor.id:
        raise not_found()
    if actor.role == "admin":
        raise validation("Admin không tải hồ sơ học vụ.")
    path = _root() / ticket.id / f"{row.id}.pdf"
    if not path.is_file():
        raise not_found()
    return path, row
