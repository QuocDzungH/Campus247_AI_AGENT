"""Deterministic fact provenance from TicketSnapshot. Used by CampusAgent and StubAgent."""

from __future__ import annotations

from campus247.models.contracts_v1 import Fact, Message, TicketSnapshot

_METHOD_HINTS: dict[str, tuple[str, ...]] = {
    "digital_pdf": ("digital_pdf", "pdf", "điện tử", "ban dien tu", "bản điện tử"),
    "paper_stamped": ("paper_stamped", "giấy đóng dấu", "bản giấy", "dong dau", "đóng dấu"),
}


def student_messages(snapshot: TicketSnapshot) -> list[Message]:
    return [message for message in snapshot.messages if message.sender == "student"]


def source_id_for_field(snapshot: TicketSnapshot, key: str, value: str) -> str | None:
    students = student_messages(snapshot)
    if not students:
        return None
    needle = value.strip().lower()
    if needle:
        for message in students:
            if needle in message.content.lower():
                return message.id
    if key == "receive_method":
        hints = _METHOD_HINTS.get(value, ())
        for message in students:
            content = message.content.lower()
            if any(hint in content for hint in hints):
                return message.id
    return None


def _certificate_fields(snapshot: TicketSnapshot):
    if snapshot.intake_packet is not None:
        return snapshot.intake_packet.fields
    return snapshot.ticket.request_data


def deterministic_facts(snapshot: TicketSnapshot) -> list[Fact]:
    facts: list[Fact] = []
    profile = snapshot.student_profile
    if profile.full_name:
        facts.append(
            Fact(
                key="student_name",
                value=profile.full_name,
                source_type="profile",
                source_id=profile.student_id,
                verification_status="unverified",
            )
        )
    if profile.mssv:
        facts.append(
            Fact(
                key="mssv",
                value=profile.mssv,
                source_type="profile",
                source_id=profile.student_id,
                verification_status="unverified",
            )
        )
    fields = _certificate_fields(snapshot)
    if fields is not None:
        for key, value in fields.model_dump().items():
            if not value:
                continue
            source_id = source_id_for_field(snapshot, key, str(value))
            if source_id is None:
                continue
            facts.append(
                Fact(
                    key=key,
                    value=str(value),
                    source_type="student_message",
                    source_id=source_id,
                    verification_status="unverified",
                )
            )
    handover = snapshot.handover_packet
    if handover is not None:
        source_id = handover.source_message_ids[0] if handover.source_message_ids else None
        if source_id:
            facts.append(
                Fact(
                    key="handover_reason",
                    value=handover.reason,
                    source_type="student_message",
                    source_id=source_id,
                    verification_status="unverified",
                )
            )
    return facts
