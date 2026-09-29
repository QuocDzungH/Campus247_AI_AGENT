"""Code-side output and provenance guards. Model text is never treated as validation."""

from __future__ import annotations

import re
from collections.abc import Iterable

from campus247.agents.errors import module_error
from campus247.agents.state import SourceKey, SourceType
from campus247.models.contracts_v1 import (
    ChecklistItem,
    Citation,
    Fact,
    OfficerBrief,
    Passage,
    TicketSnapshot,
    WarningItem,
)

_PLACEHOLDER = re.compile(r"(\[Tên sinh viên\]|\bTODO\b|<[^>\n]{1,40}>)", re.IGNORECASE)
_COMPLETED_CLAIM = re.compile(
    r"đã (cấp giấy|ký giấy|giải quyết|sửa điểm|bàn giao thành công|hoàn tất yêu cầu|resolved)",
    re.IGNORECASE,
)
_SLA_CLAIM = re.compile(r"(cam kết|SLA|trong vòng \d+\s*(giờ|ngày)|sẽ hoàn thành trước)", re.IGNORECASE)
_POLICY_CLAIM = re.compile(r"(theo quy chế|theo quyết định|theo điều)", re.IGNORECASE)


def source_registry_from_snapshot(snapshot: TicketSnapshot) -> set[SourceKey]:
    registry: set[SourceKey] = {("profile", snapshot.student_profile.student_id)}
    for message in snapshot.messages:
        if message.sender == "student":
            registry.add(("student_message", message.id))
    for passage in snapshot.approved_sources:
        registry.add(("policy", passage.citation.chunk_id))
        registry.add(("policy", passage.citation.document_id))
    return registry


def citation_allowed(citation: Citation, approved: Iterable[Passage]) -> bool:
    dump = citation.model_dump()
    return any(item.citation.model_dump() == dump for item in approved)


def sanitize_facts(
    facts: Iterable[Fact],
    registry: set[SourceKey],
    *,
    demo_profile: bool,
) -> tuple[list[Fact], list[WarningItem]]:
    warnings: list[WarningItem] = []
    clean: list[Fact] = []
    seen: set[tuple[str, str]] = set()
    for fact in facts:
        key = (fact.source_type, fact.source_id)
        if key not in registry:
            warnings.append(
                WarningItem(code="source_unknown", message=f"Bỏ fact {fact.key} vì source_id không có trong snapshot.")
            )
            continue
        status = fact.verification_status
        if fact.source_type == "student_message" and status == "verified":
            status = "unverified"
            warnings.append(WarningItem(code="student_verified", message="Không đánh verified cho lời khai sinh viên."))
        if demo_profile and fact.source_type == "profile" and status == "verified":
            status = "unverified"
            warnings.append(
                WarningItem(code="demo_profile_verified", message="Profile demo không được mô tả là đã đối soát trường.")
            )
        dedupe = (fact.key, fact.source_id)
        if dedupe in seen:
            continue
        seen.add(dedupe)
        if status != fact.verification_status:
            fact = fact.model_copy(update={"verification_status": status})
        clean.append(fact)
    return clean, warnings


def sanitize_checklist(items: Iterable[object]) -> tuple[list[ChecklistItem], list[WarningItem]]:
    warnings: list[WarningItem] = []
    clean: list[ChecklistItem] = []
    for item in items:
        data = item.model_dump() if hasattr(item, "model_dump") else dict(item)
        if data.get("checked") is True:
            warnings.append(WarningItem(code="checklist_autotick", message="Checklist không được tự đánh dấu hoàn thành."))
            data["checked"] = False
        clean.append(ChecklistItem.model_validate(data))
    return clean, warnings


def sanitize_citations(citations: Iterable[Citation], approved: list[Passage]) -> tuple[list[Citation], list[WarningItem]]:
    warnings: list[WarningItem] = []
    clean: list[Citation] = []
    for citation in citations:
        if not citation_allowed(citation, approved):
            warnings.append(
                WarningItem(code="citation_unapproved", message=f"Bỏ citation {citation.chunk_id} ngoài approved_sources.")
            )
            continue
        clean.append(citation)
    return clean, warnings


def draft_is_unsafe(draft: str | None, citations: list[Citation]) -> str | None:
    if not draft:
        return None
    if _PLACEHOLDER.search(draft):
        return "Draft chứa placeholder, TODO hoặc token kỹ thuật."
    if _COMPLETED_CLAIM.search(draft):
        return "Draft tuyên bố hành động đã hoàn tất."
    if _SLA_CLAIM.search(draft):
        return "Draft hứa SLA hoặc thời hạn xử lý."
    if _POLICY_CLAIM.search(draft) and not citations:
        return "Draft nêu căn cứ quy chế nhưng không có nguồn đã duyệt."
    return None


def guard_officer_brief(snapshot: TicketSnapshot, brief: OfficerBrief, registry: set[SourceKey]) -> OfficerBrief:
    if brief.ticket_id != snapshot.ticket.id or brief.source_ticket_revision != snapshot.source_ticket_revision:
        raise module_error("OUTPUT_SCHEMA_INVALID", stage="validation", request_id=snapshot.request_id)

    warnings = list(brief.warnings)
    facts, fact_warnings = sanitize_facts(brief.facts, registry, demo_profile=snapshot.student_profile.is_demo)
    warnings.extend(fact_warnings)
    checklist, check_warnings = sanitize_checklist(brief.checklist)
    warnings.extend(check_warnings)
    citations, cite_warnings = sanitize_citations(brief.citations, snapshot.approved_sources)
    warnings.extend(cite_warnings)

    draft = brief.draft_reply
    unsafe = draft_is_unsafe(draft, citations)
    quality: str = "pass"
    if fact_warnings or check_warnings or cite_warnings or unsafe:
        quality = "fail"
    if unsafe:
        warnings.append(WarningItem(code="unsafe_draft", message=unsafe))
        draft = None
    if brief.suggested_priority == "high" and not brief.priority_reasons:
        raise module_error("OUTPUT_SCHEMA_INVALID", stage="validation", request_id=snapshot.request_id)
    if snapshot.existing_officer_draft:
        warnings.append(
            WarningItem(
                code="existing_officer_draft",
                message="Đã có draft cán bộ trên ticket; brief này chỉ đề xuất, không ghi đè.",
            )
        )

    unique: list[WarningItem] = []
    seen_codes: set[tuple[str, str]] = set()
    for item in warnings:
        key = (item.code, item.message)
        if key in seen_codes:
            continue
        seen_codes.add(key)
        unique.append(item)

    return brief.model_copy(
        update={
            "facts": facts,
            "checklist": checklist,
            "citations": citations,
            "draft_reply": draft,
            "warnings": unique,
            "quality_status": quality,
        }
    )


def assert_known_source(source_type: SourceType, source_id: str, registry: set[SourceKey], request_id: str) -> None:
    if (source_type, source_id) not in registry:
        raise module_error("SOURCE_REFERENCE_INVALID", stage="brief", request_id=request_id)
