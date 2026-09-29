from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import get_settings
from src.db.models import SessionToken, User
from src.models.contracts_v1 import LoginResult
from src.services.common import hash_token, new_id, new_token, utcnow
from src.services.errors import ApiError, unauthenticated
from src.services.serializers import user_to_contract


def demo_login(session: Session, user_id: str) -> LoginResult:
    settings = get_settings()
    if settings.app_env == "production" or not settings.demo_auth_enabled:
        raise unauthenticated()
    user = session.get(User, user_id)
    if user is None or not user.is_demo:
        raise ApiError(401, "UNAUTHENTICATED", "Tài khoản demo không tồn tại.")
    now = utcnow()
    token = new_token()
    session.add(
        SessionToken(
            id=new_id("sess"),
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=now + timedelta(seconds=settings.session_ttl_seconds),
            created_at=now,
        )
    )
    session.commit()
    return LoginResult(
        access_token=token,
        token_type="Bearer",
        expires_at=now + timedelta(seconds=settings.session_ttl_seconds),
        user=user_to_contract(user),
    )


def logout(session: Session, user: User, token: str) -> None:
    now = utcnow()
    row = session.execute(select(SessionToken).where(SessionToken.token_hash == hash_token(token))).scalar_one_or_none()
    if row is not None and row.user_id == user.id and row.revoked_at is None:
        row.revoked_at = now
        session.commit()


def resolve_bearer(session: Session, authorization: str | None) -> tuple[User, str]:
    if not authorization or not authorization.startswith("Bearer "):
        raise unauthenticated()
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise unauthenticated()
    now = utcnow()
    row = session.execute(select(SessionToken).where(SessionToken.token_hash == hash_token(token))).scalar_one_or_none()
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        raise unauthenticated()
    user = session.get(User, row.user_id)
    if user is None:
        raise unauthenticated()
    return user, token
