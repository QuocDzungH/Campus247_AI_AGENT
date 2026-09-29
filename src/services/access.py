from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.db.models import Conversation, OfficerTeamMembership, Ticket, User
from src.services.common import lock_select, utcnow
from src.services.errors import forbidden, not_found


def load_user(session: Session, user_id: str) -> User | None:
    return session.get(User, user_id)


def active_team_ids(session: Session, user: User, now: datetime | None = None) -> set[str]:
    if user.role != "officer":
        return set()
    now = now or utcnow()
    rows = session.execute(
        select(OfficerTeamMembership.team_id).where(
            OfficerTeamMembership.user_id == user.id,
            OfficerTeamMembership.effective_from <= now,
            or_(OfficerTeamMembership.effective_to.is_(None), OfficerTeamMembership.effective_to > now),
        )
    ).scalars()
    return set(rows)


def require_student(user: User) -> None:
    if user.role != "student":
        raise forbidden()


def require_officer(user: User) -> None:
    if user.role != "officer":
        raise forbidden()


def lock_conversation(session: Session, conversation_id: str) -> Conversation | None:
    stmt = lock_select(session, select(Conversation).where(Conversation.id == conversation_id))
    return session.execute(stmt).scalar_one_or_none()


def lock_ticket(session: Session, ticket_id: str) -> Ticket | None:
    stmt = lock_select(session, select(Ticket).where(Ticket.id == ticket_id))
    return session.execute(stmt).scalar_one_or_none()


def ticket_for_conversation(session: Session, conversation_id: str) -> Ticket | None:
    return session.execute(select(Ticket).where(Ticket.conversation_id == conversation_id)).scalar_one_or_none()


def can_officer_access_ticket(session: Session, user: User, ticket: Ticket, now: datetime | None = None) -> bool:
    return ticket.team_id in active_team_ids(session, user, now)


def get_visible_ticket(session: Session, user: User, ticket_id: str, *, for_update: bool = False) -> Ticket:
    ticket = lock_ticket(session, ticket_id) if for_update else session.get(Ticket, ticket_id)
    if ticket is None:
        raise not_found()
    if user.role == "student":
        if ticket.student_id != user.id:
            raise not_found()
        return ticket
    if user.role == "officer":
        if not can_officer_access_ticket(session, user, ticket):
            raise not_found()
        return ticket
    raise forbidden()


def get_visible_conversation(session: Session, user: User, conversation_id: str, *, for_update: bool = False) -> Conversation:
    conversation = lock_conversation(session, conversation_id) if for_update else session.get(Conversation, conversation_id)
    if conversation is None:
        raise not_found()
    if user.role == "student":
        if conversation.owner_id != user.id:
            raise not_found()
        return conversation
    ticket = ticket_for_conversation(session, conversation.id)
    if ticket is None or not can_officer_access_ticket(session, user, ticket):
        raise not_found()
    return conversation
