"""Lookup users by identifier without coercing MSSV to a number."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from campus247.db.models import StudentProfile, User
from campus247.services.common import hash_token

MAX_IDENTIFIER_LENGTH = 320


def normalize_identifier(raw: str) -> str:
    return raw.strip()


def identifier_fingerprint(identifier: str) -> str:
    return hash_token(normalize_identifier(identifier).casefold())


def find_user_by_identifier(session: Session, raw: str) -> User | None:
    identifier = normalize_identifier(raw)
    if not identifier or len(identifier) > MAX_IDENTIFIER_LENGTH:
        return None
    by_id = session.get(User, identifier)
    if by_id is not None:
        return by_id
    folded = identifier.casefold()
    by_username = session.execute(
        select(User).where(func.lower(User.username) == folded)
    ).scalar_one_or_none()
    if by_username is not None:
        return by_username
    by_email = session.execute(select(User).where(func.lower(User.email) == folded)).scalar_one_or_none()
    if by_email is not None:
        return by_email
    profile = session.execute(select(StudentProfile).where(StudentProfile.mssv == identifier)).scalar_one_or_none()
    if profile is None:
        return None
    return session.get(User, profile.user_id)
