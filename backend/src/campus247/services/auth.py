from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from campus247.config import get_settings
from campus247.db.models import AuthEvent, LoginThrottle, PasswordResetToken, SessionToken, User
from campus247.models.contracts_v1 import LoginResult
from campus247.services.common import hash_token, new_id, new_token, utcnow
from campus247.services.errors import ApiError, forbidden, unauthenticated, validation
from campus247.services.identity import find_user_by_identifier, identifier_fingerprint, normalize_identifier
from campus247.services.passwords import hash_password, validate_new_password, verify_password
from campus247.services.serializers import user_to_contract

LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_FAILURES = 8
LOGIN_LOCK_SECONDS = 15 * 60
RESET_TTL_SECONDS = 30 * 60
AUTH_FAIL_MESSAGE = "Tài khoản hoặc mật khẩu không chính xác."


def _remember_ttl(remember: bool) -> int:
    settings = get_settings()
    if remember:
        return max(settings.session_ttl_seconds, settings.remember_ttl_seconds)
    return settings.session_ttl_seconds


def _record_event(
    session: Session,
    event: str,
    *,
    actor_id: str | None = None,
    target_user_id: str | None = None,
    identifier: str | None = None,
) -> None:
    session.add(
        AuthEvent(
            id=new_id("aev"),
            event=event,
            actor_id=actor_id,
            target_user_id=target_user_id,
            identifier_fingerprint=identifier_fingerprint(identifier) if identifier else None,
            created_at=utcnow(),
        )
    )


def _issue_session(session: Session, user: User, *, remember: bool) -> LoginResult:
    now = utcnow()
    token = new_token()
    ttl = _remember_ttl(remember)
    session.add(
        SessionToken(
            id=new_id("sess"),
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=now + timedelta(seconds=ttl),
            remember=remember,
            created_at=now,
        )
    )
    return LoginResult(
        access_token=token,
        token_type="Bearer",
        expires_at=now + timedelta(seconds=ttl),
        user=user_to_contract(user),
    )


def revoke_user_sessions(session: Session, user_id: str, *, reason: str, except_token_hash: str | None = None) -> int:
    now = utcnow()
    query = select(SessionToken).where(SessionToken.user_id == user_id, SessionToken.revoked_at.is_(None))
    count = 0
    for row in session.execute(query).scalars():
        if except_token_hash and row.token_hash == except_token_hash:
            continue
        row.revoked_at = now
        row.revoked_reason = reason
        count += 1
    return count


def _throttle_locked(row: LoginThrottle | None, now) -> bool:
    return row is not None and row.locked_until is not None and row.locked_until > now


def _register_failure(session: Session, identifier: str) -> None:
    now = utcnow()
    fingerprint = identifier_fingerprint(identifier)
    row = session.get(LoginThrottle, fingerprint)
    if row is None:
        session.add(
            LoginThrottle(
                identifier_fingerprint=fingerprint,
                failed_count=1,
                window_started_at=now,
                locked_until=None,
            )
        )
        return
    if (now - row.window_started_at).total_seconds() > LOGIN_WINDOW_SECONDS:
        row.failed_count = 1
        row.window_started_at = now
        row.locked_until = None
        return
    row.failed_count += 1
    if row.failed_count >= LOGIN_MAX_FAILURES:
        row.locked_until = now + timedelta(seconds=LOGIN_LOCK_SECONDS)


def _clear_throttle(session: Session, identifier: str) -> None:
    row = session.get(LoginThrottle, identifier_fingerprint(identifier))
    if row is not None:
        session.delete(row)


def _fail_login(session: Session, identifier: str, user: User | None) -> None:
    _register_failure(session, identifier)
    if user is not None:
        user.failed_login_count += 1
        if user.failed_login_count >= LOGIN_MAX_FAILURES:
            user.locked_until = utcnow() + timedelta(seconds=LOGIN_LOCK_SECONDS)
    _record_event(session, "login_failure", target_user_id=user.id if user else None, identifier=identifier)
    session.commit()
    raise ApiError(401, "UNAUTHENTICATED", AUTH_FAIL_MESSAGE)


def password_login(session: Session, identifier: str, password: str, *, remember: bool = False) -> LoginResult:
    identifier = normalize_identifier(identifier)
    if not identifier or not password:
        raise ApiError(401, "UNAUTHENTICATED", AUTH_FAIL_MESSAGE)
    now = utcnow()
    throttle = session.get(LoginThrottle, identifier_fingerprint(identifier))
    if _throttle_locked(throttle, now):
        raise ApiError(429, "RATE_LIMITED", "Không thể đăng nhập. Thử lại sau.", retryable=True)
    user = find_user_by_identifier(session, identifier)
    if user is not None and user.locked_until is not None and user.locked_until > now:
        raise ApiError(429, "RATE_LIMITED", "Không thể đăng nhập. Thử lại sau.", retryable=True)
    if user is None or user.account_status != "active" or not verify_password(user.password_hash, password):
        _fail_login(session, identifier, user if user is not None and user.account_status == "active" else None)
    user.failed_login_count = 0
    user.locked_until = None
    _clear_throttle(session, identifier)
    result = _issue_session(session, user, remember=remember)
    _record_event(session, "login_success", actor_id=user.id, target_user_id=user.id, identifier=identifier)
    session.commit()
    return result


def demo_login(session: Session, user_id: str) -> LoginResult:
    settings = get_settings()
    if settings.app_env == "production" or not settings.demo_auth_enabled:
        raise unauthenticated()
    user = session.get(User, user_id)
    if user is None or not user.is_demo or user.account_status != "active":
        raise ApiError(401, "UNAUTHENTICATED", "Tài khoản demo không tồn tại.")
    result = _issue_session(session, user, remember=True)
    _record_event(session, "demo_login", actor_id=user.id, target_user_id=user.id, identifier=user_id)
    session.commit()
    return result


def logout(session: Session, user: User, token: str) -> None:
    now = utcnow()
    row = session.execute(select(SessionToken).where(SessionToken.token_hash == hash_token(token))).scalar_one_or_none()
    if row is not None and row.user_id == user.id and row.revoked_at is None:
        row.revoked_at = now
        row.revoked_reason = "logout"
        _record_event(session, "logout", actor_id=user.id, target_user_id=user.id)
        session.commit()


def change_password(session: Session, user: User, current_password: str, new_password: str, current_token: str) -> None:
    if user.role == "admin":
        pass
    if not verify_password(user.password_hash, current_password):
        raise ApiError(401, "UNAUTHENTICATED", AUTH_FAIL_MESSAGE)
    validate_new_password(new_password, identifier=user.username or user.email or user.id)
    now = utcnow()
    user.password_hash = hash_password(new_password)
    user.password_changed_at = now
    user.updated_at = now
    revoke_user_sessions(session, user.id, reason="password_change", except_token_hash=hash_token(current_token))
    _record_event(session, "password_change", actor_id=user.id, target_user_id=user.id)
    session.commit()


def set_password(session: Session, actor: User | None, target: User, new_password: str) -> None:
    if actor is not None and actor.role != "admin":
        raise forbidden()
    validate_new_password(new_password, identifier=target.username or target.email or target.id)
    now = utcnow()
    target.password_hash = hash_password(new_password)
    target.password_changed_at = now
    target.updated_at = now
    revoke_user_sessions(session, target.id, reason="password_reset")
    _record_event(
        session,
        "password_reset",
        actor_id=actor.id if actor else None,
        target_user_id=target.id,
    )
    session.commit()


def disable_user(session: Session, actor: User, target: User) -> None:
    if actor.role != "admin":
        raise forbidden()
    now = utcnow()
    target.account_status = "disabled"
    target.updated_at = now
    revoke_user_sessions(session, target.id, reason="account_disabled")
    _record_event(session, "account_disable", actor_id=actor.id, target_user_id=target.id)
    session.commit()


def issue_admin_reset_token(session: Session, actor: User, target: User) -> str:
    if actor.role != "admin":
        raise forbidden()
    now = utcnow()
    raw = new_token()
    session.add(
        PasswordResetToken(
            id=new_id("rst"),
            user_id=target.id,
            token_hash=hash_token(raw),
            expires_at=now + timedelta(seconds=RESET_TTL_SECONDS),
            created_by=actor.id,
            created_at=now,
        )
    )
    _record_event(session, "reset_token_issued", actor_id=actor.id, target_user_id=target.id)
    session.commit()
    return raw


def consume_reset_token(session: Session, raw_token: str, new_password: str) -> None:
    row = session.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(raw_token))
    ).scalar_one_or_none()
    now = utcnow()
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise validation("Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.")
    user = session.get(User, row.user_id)
    if user is None or user.account_status != "active":
        raise validation("Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.")
    validate_new_password(new_password, identifier=user.username or user.email or user.id)
    user.password_hash = hash_password(new_password)
    user.password_changed_at = now
    user.updated_at = now
    row.used_at = now
    revoke_user_sessions(session, user.id, reason="password_reset")
    _record_event(session, "password_reset", target_user_id=user.id)
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
    if user is None or user.account_status != "active":
        raise unauthenticated()
    return user, token
