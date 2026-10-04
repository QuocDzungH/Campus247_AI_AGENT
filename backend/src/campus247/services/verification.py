"""Verification pipeline with per-source connectors. No fixture or AI-invented passes."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from campus247.config import get_settings
from campus247.db.models import StudentProfile, Ticket, TicketAttachment, User
from campus247.services.common import utcnow
from campus247.services.evidence import evidence_fingerprint
from campus247.services.process_catalog import ProcessSpec, get_process

_PROFILE_STATUS_LABEL = {
    "imported": "đã nhập vào hệ thống",
    "officer_verified": "đã được cán bộ xác minh",
    "unverified": "chưa xác minh",
}


@dataclass
class ConnectorResult:
    status: str
    reason: str
    data_checked: str
    source_system: str
    condition: str
    condition_source: str
    connector_status: str
    applies: bool = True
    evidence: dict[str, str] = field(default_factory=dict)
    source_version: str | None = None


class VerificationConnector(Protocol):
    key: str
    label: str

    def applies(self, spec: ProcessSpec) -> bool: ...

    def check(self, ctx: VerificationContext) -> ConnectorResult: ...


@dataclass
class VerificationContext:
    ticket: Ticket
    student: User
    profile: StudentProfile | None
    spec: ProcessSpec
    fingerprint: str
    attachments: list[TicketAttachment]


def _fields(ticket: Ticket) -> dict:
    data = ticket.request_data if isinstance(ticket.request_data, dict) else {}
    extras = data.get("extras") if isinstance(data.get("extras"), dict) else {}
    return {**data, "extras": extras}


class IdentityConnector:
    key = "identity_match"
    label = "Danh tính / hồ sơ sinh viên"

    def applies(self, spec: ProcessSpec) -> bool:
        return True

    def check(self, ctx: VerificationContext) -> ConnectorResult:
        profile = ctx.profile
        condition = "Họ tên và MSSV trên hồ sơ Campus khớp tài khoản sinh viên. Lời khai trên đơn không được coi là dữ liệu đã xác minh."
        source = "Hồ sơ sinh viên trên máy chủ"
        if profile is None:
            return ConnectorResult(
                status="insufficient",
                reason="Chưa có hồ sơ sinh viên trên máy chủ để đối chiếu.",
                data_checked=f"user.id={ctx.student.id}; profile=missing",
                source_system=source,
                condition=condition,
                condition_source=f"{ctx.spec.process_version} / identity_match",
                connector_status="connected",
                evidence={"user_name": ctx.student.name, "user_id": ctx.student.id},
                source_version=ctx.fingerprint,
            )
        evidence = {
            "profile_full_name": profile.full_name or "",
            "profile_mssv": profile.mssv or "",
            "account_name": ctx.student.name,
            "verification_status": profile.verification_status,
            "source": profile.source or "",
        }
        data_checked = (
            f"profile.full_name={profile.full_name!r}; profile.mssv={profile.mssv!r}; "
            f"user.name={ctx.student.name!r}; verification_status={profile.verification_status}"
        )
        if not profile.full_name or not profile.mssv:
            return ConnectorResult(
                status="insufficient",
                reason="Hồ sơ thiếu họ tên hoặc MSSV. Cán bộ đối chiếu thủ công và ghi chú.",
                data_checked=data_checked,
                source_system=source,
                condition=condition,
                condition_source=f"{ctx.spec.process_version} / identity_match",
                connector_status="connected",
                evidence=evidence,
                source_version=profile.verification_status,
            )
        name_mismatch = profile.full_name.strip().casefold() != (ctx.student.name or "").strip().casefold()
        if name_mismatch:
            return ConnectorResult(
                status="failed",
                reason="Họ tên tài khoản không khớp hồ sơ sinh viên.",
                data_checked=data_checked,
                source_system=source,
                condition=condition,
                condition_source=f"{ctx.spec.process_version} / identity_match",
                connector_status="connected",
                evidence=evidence,
                source_version=profile.verification_status,
            )
        if profile.verification_status == "unverified":
            return ConnectorResult(
                status="insufficient",
                reason="Hồ sơ chưa được nhập đủ hoặc chưa được cán bộ xác minh. Khớp tên chưa đủ để coi là dữ liệu trường đã xác minh.",
                data_checked=data_checked,
                source_system=source,
                condition=condition,
                condition_source=f"{ctx.spec.process_version} / identity_match",
                connector_status="connected",
                evidence=evidence,
                source_version=profile.verification_status,
            )
        status_label = _PROFILE_STATUS_LABEL.get(profile.verification_status, profile.verification_status)
        qualifier = (
            " Đây chưa phải xác minh của cán bộ."
            if profile.verification_status != "officer_verified"
            else ""
        )
        return ConnectorResult(
            status="passed",
            reason=f"Hồ sơ nguồn {status_label}: họ tên và MSSV có trên máy chủ và khớp tài khoản.{qualifier}",
            data_checked=data_checked,
            source_system=source,
            condition=condition,
            condition_source=f"{ctx.spec.process_version} / identity_match",
            connector_status="connected",
            evidence=evidence,
            source_version=profile.verification_status,
        )


class AcademicStatusConnector:
    key = "academic_status"
    label = "Tình trạng học tập"

    def applies(self, spec: ProcessSpec) -> bool:
        return spec.requires_academic_status

    def check(self, ctx: VerificationContext) -> ConnectorResult:
        settings = get_settings()
        condition = "Áp dụng khi quy trình cấp giấy yêu cầu xác nhận đang học. Không lấy lời khai sinh viên làm tình trạng đào tạo."
        source = "SIS / CSDL đào tạo"
        profile_status = ctx.profile.student_status if ctx.profile else None
        data_checked = f"profile.student_status={profile_status!r}; sis_connector_url_configured={bool(settings.sis_connector_url)}"
        if not settings.sis_connector_url:
            return ConnectorResult(
                status="insufficient",
                reason="Chưa kết nối SIS. Không đánh dấu đạt từ cache, fixture hoặc AI. Cán bộ đối chiếu bằng chứng thật và ghi nhận thủ công.",
                data_checked=data_checked,
                source_system="SIS (chưa kết nối)",
                condition=condition,
                condition_source=f"{ctx.spec.process_version} / academic_status",
                connector_status="not_configured",
                evidence={"student_status_on_profile": profile_status or "", "declared_only": "true"},
                source_version=None,
            )
        return ConnectorResult(
            status="error",
            reason="Đã có SIS_CONNECTOR_URL nhưng chưa có adapter giao thức được phê duyệt. Không gọi giả lập.",
            data_checked=data_checked,
            source_system=source,
            condition=condition,
            condition_source=f"{ctx.spec.process_version} / academic_status",
            connector_status="error",
            evidence={"connector_url_present": "true"},
        )


class FinancialConnector:
    key = "financial_obligation"
    label = "Nghĩa vụ tài chính"

    def applies(self, spec: ProcessSpec) -> bool:
        return spec.requires_financial_clearance

    def check(self, ctx: VerificationContext) -> ConnectorResult:
        settings = get_settings()
        condition = "Chỉ áp dụng khi quy trình đã phê duyệt yêu cầu đối soát tài chính. Không mặc định mọi giấy cần học phí = 0."
        data_checked = f"finance_connector_url_configured={bool(settings.finance_connector_url)}"
        if not settings.finance_connector_url:
            return ConnectorResult(
                status="insufficient",
                reason="Chưa kết nối KHTC. Không dùng số dư giả hoặc AI để đánh dấu đã hoàn thành nghĩa vụ tài chính.",
                data_checked=data_checked,
                source_system="KHTC (chưa kết nối)",
                condition=condition,
                condition_source=f"{ctx.spec.process_version} / financial_obligation",
                connector_status="not_configured",
            )
        return ConnectorResult(
            status="error",
            reason="Đã có FINANCE_CONNECTOR_URL nhưng chưa có adapter giao thức được phê duyệt.",
            data_checked=data_checked,
            source_system="KHTC",
            condition=condition,
            condition_source=f"{ctx.spec.process_version} / financial_obligation",
            connector_status="error",
        )


class CompletenessConnector:
    key = "form_completeness"
    label = "Tính đầy đủ của đơn và chứng từ"

    def applies(self, spec: ProcessSpec) -> bool:
        return True

    def check(self, ctx: VerificationContext) -> ConnectorResult:
        data = _fields(ctx.ticket)
        extras = data.get("extras") if isinstance(data.get("extras"), dict) else {}
        purpose = data.get("purpose")
        destination = data.get("destination_org")
        receive = data.get("receive_method")
        files = ", ".join(f"{row.filename} ({row.size_bytes}B)" for row in ctx.attachments) or "none"
        evidence = {
            "purpose": str(purpose or ""),
            "destination_org": str(destination or ""),
            "receive_method": str(receive or ""),
            "extras_keys": ",".join(sorted(str(key) for key in extras.keys())),
            "attachment_count": str(len(ctx.attachments)),
        }
        data_checked = (
            f"purpose={purpose!r}; destination_org={destination!r}; receive_method={receive!r}; "
            f"extras={list(extras.keys())}; attachments={files}"
        )
        condition = "Đơn có các trường bắt buộc theo loại dịch vụ; extras và tệp được lưu nguyên bản."
        if ctx.ticket.service_type == "student_certificate":
            missing = [name for name, value in (("purpose", purpose), ("destination_org", destination), ("receive_method", receive)) if not value]
            if missing:
                return ConnectorResult(
                    status="failed",
                    reason=f"Thiếu trường bắt buộc: {', '.join(missing)}.",
                    data_checked=data_checked,
                    source_system="Đơn đã nộp trên hệ thống",
                    condition=condition,
                    condition_source=f"{ctx.spec.process_version} / form_completeness",
                    connector_status="connected",
                    evidence=evidence,
                    source_version=ctx.fingerprint,
                )
        summary = (ctx.ticket.summary or "").strip()
        if ctx.ticket.service_type != "student_certificate" and not summary:
            return ConnectorResult(
                status="insufficient",
                reason="Loại hồ sơ này chưa có bộ trường bắt buộc ngoài tóm tắt. Cán bộ đối chiếu nội dung gốc.",
                data_checked=data_checked,
                source_system="Đơn đã nộp",
                condition=condition,
                condition_source=f"{ctx.spec.process_version} / form_completeness",
                connector_status="connected",
                evidence=evidence,
                source_version=ctx.fingerprint,
            )
        return ConnectorResult(
            status="passed",
            reason="Các trường đơn hiện có trên máy chủ đã được ghi nhận (kể cả extras và tệp).",
            data_checked=data_checked,
            source_system="Đơn đã nộp trên hệ thống",
            condition=condition,
            condition_source=f"{ctx.spec.process_version} / form_completeness",
            connector_status="connected",
            evidence=evidence,
            source_version=ctx.fingerprint,
        )


CONNECTORS: list[VerificationConnector] = [
    IdentityConnector(),
    CompletenessConnector(),
    AcademicStatusConnector(),
    FinancialConnector(),
]


def _item_from_result(ticket: Ticket, connector: VerificationConnector, result: ConnectorResult, fingerprint: str, prior: dict | None) -> dict:
    now = utcnow()
    item = {
        "id": f"verif-{ticket.id}-{connector.key}",
        "criterion_key": connector.key,
        "criterion_label": connector.label,
        "condition_applied": result.condition,
        "condition_source": result.condition_source,
        "data_checked": result.data_checked,
        "data_source": result.source_system,
        "source_system": result.source_system,
        "lookup_timestamp": now.isoformat(),
        "source_version": result.source_version,
        "source_hash": fingerprint,
        "status": result.status,
        "reason": result.reason,
        "evidence": result.evidence,
        "connector_status": result.connector_status,
        "applies": result.applies,
        "stale": False,
        "officer_review_status": "pending",
        "officer_resolution": "none",
        "officer_note": None,
        "officer_reviewed_by": None,
        "officer_reviewed_at": None,
    }
    if prior and prior.get("source_hash") == fingerprint and prior.get("status") == result.status:
        if prior.get("officer_review_status") in {"confirmed", "overridden"} and not prior.get("stale"):
            item["officer_review_status"] = prior["officer_review_status"]
            item["officer_resolution"] = prior.get("officer_resolution") or "viewed"
            item["officer_note"] = prior.get("officer_note")
            item["officer_reviewed_by"] = prior.get("officer_reviewed_by")
            item["officer_reviewed_at"] = prior.get("officer_reviewed_at")
    return item


def run_pipeline(session: Session, ticket: Ticket, *, only_key: str | None = None) -> list[dict]:
    spec = get_process(ticket.service_type)
    student = session.get(User, ticket.student_id)
    if student is None:
        raise RuntimeError(f"missing student {ticket.student_id}")
    profile = session.get(StudentProfile, ticket.student_id)
    attachments = list(
        session.execute(
            select(TicketAttachment).where(TicketAttachment.ticket_id == ticket.id).order_by(TicketAttachment.created_at)
        ).scalars()
    )
    fingerprint = evidence_fingerprint(session, ticket)
    ctx = VerificationContext(
        ticket=ticket,
        student=student,
        profile=profile,
        spec=spec,
        fingerprint=fingerprint,
        attachments=attachments,
    )
    previous = {item.get("criterion_key"): dict(item) for item in (ticket.system_verifications or []) if isinstance(item, dict)}
    items: list[dict] = []
    for connector in CONNECTORS:
        connector_id = f"verif-{ticket.id}-{connector.key}"
        if only_key and connector.key != only_key and connector_id != only_key:
            if connector.key in previous:
                items.append(previous[connector.key])
            continue
        if not connector.applies(spec):
            continue
        result = connector.check(ctx)
        items.append(_item_from_result(ticket, connector, result, fingerprint, previous.get(connector.key)))
    if only_key:
        seen = {item.get("criterion_key") for item in items}
        for key, prior in previous.items():
            if key not in seen:
                items.append(prior)
    ticket.system_verifications = items
    ticket.evidence_fingerprint = fingerprint
    ticket.updated_at = utcnow()
    return items


def record_officer_review(
    items: list[dict],
    criterion_id: str,
    *,
    actor_id: str,
    note: str | None,
    resolution: str,
) -> list[dict]:
    found = False
    now = utcnow().isoformat()
    next_items = []
    for item in items:
        row = dict(item)
        if row.get("id") == criterion_id or row.get("criterion_key") == criterion_id:
            found = True
            if row.get("stale"):
                raise ValueError("stale")
            if resolution == "viewed":
                row["officer_review_status"] = "confirmed"
                row["officer_resolution"] = "viewed"
            elif resolution == "manual_pass":
                row["officer_review_status"] = "overridden"
                row["officer_resolution"] = "manual_pass"
            elif resolution == "manual_fail":
                row["officer_review_status"] = "overridden"
                row["officer_resolution"] = "manual_fail"
            else:
                row["officer_review_status"] = "confirmed"
                row["officer_resolution"] = "viewed"
            row["officer_note"] = note
            row["officer_reviewed_by"] = actor_id
            row["officer_reviewed_at"] = now
            if resolution == "viewed":
                row["status"] = row.get("status") or "insufficient"
        next_items.append(row)
    if not found:
        raise KeyError(criterion_id)
    return next_items


def criterion_resolved_for_issue(item: dict, required: bool) -> bool:
    if item.get("stale"):
        return False
    if item.get("status") == "passed" and item.get("officer_resolution") in {None, "none", "viewed", "manual_pass"}:
        return True
    if item.get("officer_resolution") == "manual_pass" and (item.get("officer_note") or "").strip():
        return True
    if not required:
        return True
    return False
