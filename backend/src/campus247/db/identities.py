"""Seed synthetic operational identities with password login and full student profiles.

Demo rows in edu14_demo.json stay untouched. These accounts are is_demo=False so form
prefill and password login use the same source as /me/profile.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from campus247.db.models import OfficerTeamMembership, StudentProfile, Team, User
from campus247.services.common import new_id, utcnow
from campus247.services.identity import find_user_by_identifier
from campus247.services.passwords import hash_password, validate_new_password

DEFAULT_IDENTITIES = Path(__file__).resolve().parent / "seed_data" / "operational_identities.json"
DEFAULT_DEV_PASSWORD = "Campus247-An18"


def load_identities(path: Path | None = None) -> dict:
    target = path or DEFAULT_IDENTITIES
    return json.loads(target.read_text(encoding="utf-8"))


def resolve_seed_password() -> str:
    password = (os.environ.get("CAMPUS_SEED_PASSWORD") or "").strip()
    if password:
        validate_new_password(password)
        return password
    app_env = (os.environ.get("APP_ENV") or "development").strip().lower()
    if app_env == "production":
        raise SystemExit("APP_ENV=production requires CAMPUS_SEED_PASSWORD to seed operational identities.")
    validate_new_password(DEFAULT_DEV_PASSWORD)
    return DEFAULT_DEV_PASSWORD


def seed_operational_identities(
    session: Session,
    document: dict | None = None,
    *,
    password: str | None = None,
    reset_passwords: bool = False,
) -> dict[str, int]:
    document = document or load_identities()
    secret = password if password is not None else resolve_seed_password()
    validate_new_password(secret)
    now = utcnow()
    created_users = 0
    updated_users = 0
    created_profiles = 0
    updated_profiles = 0
    created_memberships = 0

    for item in document.get("students") or []:
        user, created = _upsert_user(session, item, role="student", now=now)
        if created:
            created_users += 1
        else:
            updated_users += 1
        _maybe_set_password(user, secret, now, reset_passwords=reset_passwords)
        profile, profile_created = _upsert_student_profile(session, user, item, now)
        if profile_created:
            created_profiles += 1
        else:
            updated_profiles += 1

    for item in document.get("officers") or []:
        user, created = _upsert_user(session, item, role="officer", now=now)
        if created:
            created_users += 1
        else:
            updated_users += 1
        _maybe_set_password(user, secret, now, reset_passwords=reset_passwords)
        team_id = item.get("team_id")
        if team_id:
            created_memberships += _ensure_membership(session, user.id, team_id, now)

    session.commit()
    return {
        "users_created": created_users,
        "users_updated": updated_users,
        "profiles_created": created_profiles,
        "profiles_updated": updated_profiles,
        "memberships_created": created_memberships,
    }


def _upsert_user(session: Session, item: dict, *, role: str, now) -> tuple[User, bool]:
    requested_id = str(item.get("id") or "").strip() or None
    username = str(item.get("username") or item.get("mssv") or "").strip() or None
    email = str(item.get("email") or "").strip() or None
    name = str(item.get("full_name") or item.get("name") or "").strip()
    if not name:
        raise ValueError("operational identity is missing a name")

    row = None
    if requested_id:
        row = session.get(User, requested_id)
    if row is None and username:
        row = find_user_by_identifier(session, username)
    if row is None and email:
        row = find_user_by_identifier(session, email)
    if row is not None and row.is_demo:
        raise ValueError(f"operational identity collides with demo user {row.id}")
    created = row is None
    if created:
        row = User(
            id=requested_id or new_id("usr"),
            role=role,
            name=name,
            account_status="active",
            is_demo=False,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()
    row.role = role
    row.name = name
    row.username = username
    row.email = email
    row.account_status = "active"
    row.is_demo = False
    row.updated_at = now
    return row, created


def _mssv_taken(session: Session, mssv: str, user_id: str) -> StudentProfile | None:
    row = session.execute(select(StudentProfile).where(StudentProfile.mssv == mssv)).scalar_one_or_none()
    if row is not None and row.user_id != user_id:
        return row
    return None


def _upsert_student_profile(session: Session, user: User, item: dict, now) -> tuple[StudentProfile, bool]:
    mssv = str(item.get("mssv") or "").strip() or None
    if mssv:
        taken = _mssv_taken(session, mssv, user.id)
        if taken is not None:
            raise ValueError(f"MSSV {mssv} already belongs to {taken.user_id}")
    row = session.get(StudentProfile, user.id)
    created = row is None
    if created:
        row = StudentProfile(
            user_id=user.id,
            verification_status="imported",
            is_demo=False,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
    row.full_name = str(item.get("full_name") or user.name)
    row.mssv = mssv
    row.email = str(item.get("email") or "").strip() or None
    row.faculty = str(item.get("faculty") or "").strip() or None
    row.major = str(item.get("major") or "").strip() or None
    row.cohort = str(item.get("cohort") or "").strip() or None
    row.class_year = str(item.get("class_year") or "").strip() or None
    row.student_status = str(item.get("student_status") or "").strip() or None
    row.verification_status = "imported"
    row.source = "operational_identities"
    row.source_imported_at = now
    row.is_demo = False
    row.updated_at = now
    return row, created


def _maybe_set_password(user: User, password: str, now, *, reset_passwords: bool) -> None:
    if user.password_hash and not reset_passwords:
        return
    validate_new_password(password, identifier=user.username or user.email)
    user.password_hash = hash_password(password)
    user.password_changed_at = now


def _ensure_membership(session: Session, user_id: str, team_id: str, now) -> int:
    team = session.get(Team, team_id)
    if team is None:
        team = Team(id=team_id, name=team_id, is_demo=False, created_at=now, updated_at=now)
        session.add(team)
        session.flush()
    membership_id = f"mem_{user_id}_{team_id}"
    row = session.get(OfficerTeamMembership, membership_id)
    if row is not None:
        return 0
    session.add(
        OfficerTeamMembership(
            id=membership_id,
            user_id=user_id,
            team_id=team_id,
            effective_from=now,
            created_at=now,
        )
    )
    return 1
