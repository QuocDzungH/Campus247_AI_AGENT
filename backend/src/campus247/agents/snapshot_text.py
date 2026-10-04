"""Format TicketSnapshot slices for officer-graph prompts. Truncated, not a source of IDs."""

from __future__ import annotations

from campus247.models.contracts_v1 import Passage, Profile, TicketSnapshot

_MESSAGE_LIMIT = 20
_MESSAGE_CHARS = 500
_QUOTE_CHARS = 400


def format_profile(profile: Profile) -> str:
    return (
        f"student_id={profile.student_id} full_name={profile.full_name} mssv={profile.mssv} "
        f"faculty={profile.faculty} cohort={profile.cohort} is_demo={profile.is_demo}"
    )


def format_messages(snapshot: TicketSnapshot) -> str:
    if not snapshot.messages:
        return "(không có)"
    lines = []
    for message in snapshot.messages[-_MESSAGE_LIMIT:]:
        lines.append(f"[{message.sender} id={message.id}] {message.content[:_MESSAGE_CHARS]}")
    return "\n".join(lines)


def format_passages(passages: list[Passage]) -> str:
    if not passages:
        return "(không có)"
    lines = []
    for item in passages:
        citation = item.citation
        quote = (item.text or citation.quote)[:_QUOTE_CHARS]
        lines.append(
            f"chunk_id={citation.chunk_id} document_id={citation.document_id} "
            f"title={citation.document_title} version={citation.document_version} "
            f"locator={citation.locator} quote={quote}"
        )
    return "\n".join(lines)


def format_officer_context(snapshot: TicketSnapshot, *, summary: str | None = None) -> str:
    intake = snapshot.intake_packet.model_dump_json() if snapshot.intake_packet else "null"
    handover = snapshot.handover_packet.model_dump_json() if snapshot.handover_packet else "null"
    return (
        f"ticket_id={snapshot.ticket.id} revision={snapshot.source_ticket_revision}\n"
        f"summary={summary or snapshot.ticket.summary}\n"
        f"service_type={snapshot.ticket.service_type} priority={snapshot.ticket.priority}\n"
        f"profile: {format_profile(snapshot.student_profile)}\n"
        f"intake={intake}\n"
        f"handover={handover}\n"
        f"messages:\n{format_messages(snapshot)}\n"
        f"approved_sources:\n{format_passages(snapshot.approved_sources)}"
    )
