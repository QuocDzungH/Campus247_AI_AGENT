"""Idempotent seed from packaged edu14_demo.json. Demo data only."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from campus247.db.engine import session_scope
from campus247.db.models import (
    AuditEntry,
    Conversation,
    Message,
    OfficerTeamMembership,
    StudentProfile,
    Team,
    Ticket,
    TicketAssignment,
    User,
)
from campus247.models.contracts_v1 import AuditEntry as AuditContract
from campus247.models.contracts_v1 import Conversation as ConversationContract
from campus247.models.contracts_v1 import Message as MessageContract
from campus247.models.contracts_v1 import Profile
from campus247.models.contracts_v1 import Ticket as TicketContract
from campus247.models.contracts_v1 import User as UserContract
from campus247.services.common import SERVICE_TEAM, ensure_utc

DEFAULT_SEED = Path(__file__).resolve().parent / "seed_data" / "edu14_demo.json"


class SeedModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TeamSeed(SeedModel):
    id: str
    name: str
    is_demo: bool = True


class MembershipSeed(SeedModel):
    user_id: str
    team_id: str


class AssignmentSeed(SeedModel):
    ticket_id: str
    team_id: str
    officer_id: str
    assigned_by: str
    assigned_at: datetime
    is_demo: bool = True


def load_document(path: Path | None = None) -> dict:
    target = path or DEFAULT_SEED
    return json.loads(target.read_text(encoding="utf-8"))


def seed_from_document(session: Session, document: dict | None = None, *, reset: bool = False) -> dict[str, int]:
    document = document or load_document()
    metadata = document.get("metadata") or {}
    users = [UserContract.model_validate(item) for item in document["users"]]
    profiles = [Profile.model_validate(item) for item in document["profiles"]]
    teams = [TeamSeed.model_validate(item) for item in document["teams"]]
    memberships = [MembershipSeed.model_validate(item) for item in document["officer_team_memberships"]]
    conversations = [ConversationContract.model_validate(item) for item in document["conversations"]]
    tickets = [TicketContract.model_validate(item) for item in document["tickets"]]
    assignments = [AssignmentSeed.model_validate(item) for item in document["ticket_assignments"]]
    messages = [MessageContract.model_validate(item) for item in document["messages"]]
    audits = [AuditContract.model_validate(item) for item in document["audit_entries"]]
    _validate_graph(users, profiles, teams, memberships, conversations, tickets, assignments, messages, audits)

    now_fallback = datetime(2026, 8, 31, 2, 0, tzinfo=UTC)
    for item in users:
        row = session.get(User, item.id)
        if row is None:
            row = User(id=item.id, created_at=now_fallback, updated_at=now_fallback)
            session.add(row)
        elif not reset:
            continue
        row.role = item.role
        row.name = item.name
        row.is_demo = True
        row.updated_at = now_fallback
    for item in teams:
        row = session.get(Team, item.id)
        if row is None:
            row = Team(id=item.id, created_at=now_fallback, updated_at=now_fallback)
            session.add(row)
        elif not reset:
            continue
        row.name = item.name
        row.is_demo = item.is_demo
        row.updated_at = now_fallback
    session.flush()
    for item in profiles:
        ts = now_fallback
        row = session.get(StudentProfile, item.student_id)
        if row is None:
            row = StudentProfile(user_id=item.student_id, created_at=ts, updated_at=ts)
            session.add(row)
        elif not reset:
            continue
        row.full_name = item.full_name
        row.mssv = item.mssv
        row.faculty = item.faculty
        row.cohort = item.cohort
        row.is_demo = True
        row.updated_at = ts
    for item in memberships:
        membership_id = f"mem_{item.user_id}_{item.team_id}"
        row = session.get(OfficerTeamMembership, membership_id)
        if row is None:
            row = OfficerTeamMembership(
                id=membership_id,
                user_id=item.user_id,
                team_id=item.team_id,
                effective_from=now_fallback,
                created_at=now_fallback,
            )
            session.add(row)
        elif not reset:
            continue
        row.user_id = item.user_id
        row.team_id = item.team_id
        row.effective_from = now_fallback
        row.effective_to = None
    session.flush()

    ticket_by_conversation = {item.conversation_id: item for item in tickets}
    for item in conversations:
        created = ensure_utc(item.created_at)
        updated = ensure_utc(item.updated_at)
        owner = _owner_for(item, ticket_by_conversation)
        row = session.get(Conversation, item.id)
        if row is None:
            row = Conversation(id=item.id, owner_id=owner, created_at=created, updated_at=updated)
            session.add(row)
        elif not reset:
            continue
        row.owner_id = owner
        row.status = item.status
        row.ai_response_locked = item.ai_response_locked
        row.handover_status = item.handover_status
        row.revision = item.revision
        row.created_at = created
        row.updated_at = updated
    session.flush()

    for item in tickets:
        row = session.get(Ticket, item.id)
        if row is None:
            row = Ticket(
                id=item.id,
                code=item.code,
                conversation_id=item.conversation_id,
                student_id=item.student_id,
                team_id=SERVICE_TEAM[item.service_type],
                created_at=ensure_utc(item.created_at),
                updated_at=ensure_utc(item.updated_at),
            )
            session.add(row)
        elif not reset:
            continue
        row.code = item.code
        row.conversation_id = item.conversation_id
        row.student_id = item.student_id
        row.team_id = SERVICE_TEAM[item.service_type]
        row.assigned_officer_id = item.assigned_officer_id
        row.category = item.category
        row.service_type = item.service_type
        row.status = item.status
        row.priority = item.priority
        row.priority_reasons = list(item.priority_reasons)
        row.summary = item.summary
        row.request_data = item.request_data.model_dump(mode="json") if item.request_data else None
        row.handover_reason = item.handover_reason
        row.revision = item.revision
        row.created_at = ensure_utc(item.created_at)
        row.updated_at = ensure_utc(item.updated_at)
    session.flush()

    for item in assignments:
        assignment_id = f"asg_{item.ticket_id}"
        row = session.get(TicketAssignment, assignment_id)
        if row is None:
            row = TicketAssignment(
                id=assignment_id,
                ticket_id=item.ticket_id,
                team_id=item.team_id,
                officer_id=item.officer_id,
                assigned_by=item.assigned_by,
                action="claim",
                assigned_at=ensure_utc(item.assigned_at),
                is_demo=item.is_demo,
            )
            session.add(row)
        elif not reset:
            continue
        row.team_id = item.team_id
        row.officer_id = item.officer_id
        row.assigned_by = item.assigned_by
        row.assigned_at = ensure_utc(item.assigned_at)
        row.action = "claim"
        row.is_demo = item.is_demo

    seq_by_conversation: dict[str, int] = {}
    for item in sorted(messages, key=lambda message: (message.conversation_id, message.created_at, message.id)):
        seq_by_conversation[item.conversation_id] = seq_by_conversation.get(item.conversation_id, 0) + 1
        sender_user_id = None
        if item.sender == "student":
            sender_user_id = ticket_by_conversation[item.conversation_id].student_id
        elif item.sender == "officer":
            sender_user_id = ticket_by_conversation[item.conversation_id].assigned_officer_id
        row = session.get(Message, item.id)
        if row is None:
            row = Message(
                id=item.id,
                conversation_id=item.conversation_id,
                seq=seq_by_conversation[item.conversation_id],
                created_at=ensure_utc(item.created_at),
                sender=item.sender,
                content=item.content,
            )
            session.add(row)
        elif not reset:
            continue
        row.conversation_id = item.conversation_id
        row.ticket_id = item.ticket_id
        row.sender = item.sender
        row.sender_user_id = sender_user_id
        row.content = item.content
        row.seq = seq_by_conversation[item.conversation_id]
        row.created_at = ensure_utc(item.created_at)

    for item in audits:
        row = session.get(AuditEntry, item.id)
        if row is None:
            row = AuditEntry(
                id=item.id,
                ticket_id=item.ticket_id,
                actor_type=item.actor_type,
                action=item.action,
                request_id=item.request_id,
                created_at=ensure_utc(item.created_at),
            )
            session.add(row)
        elif not reset:
            continue
        row.ticket_id = item.ticket_id
        row.actor_id = item.actor_id
        row.actor_type = item.actor_type
        row.action = item.action
        row.from_status = item.from_status
        row.to_status = item.to_status
        row.request_id = item.request_id
        row.created_at = ensure_utc(item.created_at)

    session.commit()
    return {
        "users": session.execute(select(func.count()).select_from(User)).scalar_one(),
        "teams": session.execute(select(func.count()).select_from(Team)).scalar_one(),
        "profiles": session.execute(select(func.count()).select_from(StudentProfile)).scalar_one(),
        "memberships": session.execute(select(func.count()).select_from(OfficerTeamMembership)).scalar_one(),
        "conversations": session.execute(select(func.count()).select_from(Conversation)).scalar_one(),
        "tickets": session.execute(select(func.count()).select_from(Ticket)).scalar_one(),
        "assignments": session.execute(select(func.count()).select_from(TicketAssignment)).scalar_one(),
        "messages": session.execute(select(func.count()).select_from(Message)).scalar_one(),
        "audits": session.execute(select(func.count()).select_from(AuditEntry)).scalar_one(),
        "provenance": 1 if metadata.get("provenance") else 0,
    }


def _owner_for(conversation: ConversationContract, tickets: dict[str, TicketContract]) -> str:
    ticket = tickets.get(conversation.id)
    if ticket is None:
        raise ValueError(f"conversation {conversation.id} has no ticket in seed")
    return ticket.student_id


def _validate_graph(users, profiles, teams, memberships, conversations, tickets, assignments, messages, audits) -> None:
    user_ids = {item.id for item in users}
    officer_ids = {item.id for item in users if item.role == "officer"}
    team_ids = {item.id for item in teams}
    allowed_officer_team = {
        "OF-DEMO-01": "academic",
        "OF-DEMO-02": "student_support",
        "OF-DEMO-03": "academic",
    }
    for membership in memberships:
        if membership.user_id not in officer_ids:
            raise ValueError(f"membership user {membership.user_id} is not an officer")
        if membership.team_id not in team_ids:
            raise ValueError(f"unknown team {membership.team_id}")
        expected = allowed_officer_team.get(membership.user_id)
        if expected and membership.team_id != expected:
            raise ValueError(f"{membership.user_id} must belong only to {expected}")
    membership_pairs = {(item.user_id, item.team_id) for item in memberships}
    tickets_by_id = {item.id for item in tickets}
    for ticket in tickets:
        if ticket.student_id not in user_ids:
            raise ValueError(f"ticket student missing: {ticket.student_id}")
        expected_team = SERVICE_TEAM[ticket.service_type]
        if ticket.assigned_officer_id:
            if (ticket.assigned_officer_id, expected_team) not in membership_pairs:
                raise ValueError(f"assignee {ticket.assigned_officer_id} not in team {expected_team}")
    assignment_by_ticket = {}
    for assignment in assignments:
        if assignment.ticket_id not in tickets_by_id:
            raise ValueError(f"assignment for unknown ticket {assignment.ticket_id}")
        if (assignment.officer_id, assignment.team_id) not in membership_pairs:
            raise ValueError(f"assignment officer {assignment.officer_id} not in {assignment.team_id}")
        assignment_by_ticket[assignment.ticket_id] = assignment
    for ticket in tickets:
        if ticket.status == "open" and ticket.assigned_officer_id:
            raise ValueError(f"open ticket {ticket.id} must not have assignee")
        if ticket.status != "open":
            assignment = assignment_by_ticket.get(ticket.id)
            if assignment is None or assignment.officer_id != ticket.assigned_officer_id:
                raise ValueError(f"ticket {ticket.id} assignee does not match assignment history")
    conv_ids = {item.id for item in conversations}
    for ticket in tickets:
        if ticket.conversation_id not in conv_ids:
            raise ValueError(f"ticket conversation missing {ticket.conversation_id}")
    for conversation in conversations:
        if conversation.ticket_id not in tickets_by_id:
            raise ValueError(f"conversation ticket missing {conversation.ticket_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Campus 24/7 demo operational data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Overwrite existing demo rows from packaged edu14_demo.json.",
    )
    args = parser.parse_args()
    with session_scope() as session:
        counts = seed_from_document(session, reset=args.reset)
    print("Seeded", counts, "reset=" + str(args.reset))


if __name__ == "__main__":
    main()
