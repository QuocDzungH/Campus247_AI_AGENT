from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import get_settings
from src.db.models import IdempotencyRecord, User
from src.services.common import hash_payload, new_id, utcnow
from src.services.errors import ApiError

Outcome = Literal["new", "replay", "processing"]


class IdempotencyHandle:
    def __init__(
        self,
        outcome: Outcome,
        record: IdempotencyRecord | None,
        http_status: int | None = None,
        body: dict | None = None,
    ):
        self.outcome = outcome
        self.record = record
        self.http_status = http_status
        self.body = body


def begin_idempotent(
    session: Session,
    *,
    actor: User,
    operation: str,
    resource_id: str,
    key: str,
    payload: Any,
) -> IdempotencyHandle:
    if not key or len(key) > 128:
        raise ApiError(422, "VALIDATION_ERROR", "Idempotency-Key không hợp lệ.")
    payload_hash = hash_payload(payload)
    now = utcnow()
    existing = session.execute(
        select(IdempotencyRecord).where(
            IdempotencyRecord.actor_id == actor.id,
            IdempotencyRecord.operation == operation,
            IdempotencyRecord.resource_id == resource_id,
            IdempotencyRecord.key == key,
        )
    ).scalar_one_or_none()
    if existing is not None:
        if existing.payload_hash != payload_hash:
            raise ApiError(409, "IDEMPOTENCY_CONFLICT", "Idempotency-Key đã dùng với nội dung khác.")
        if existing.expires_at <= now:
            existing.payload_hash = payload_hash
            existing.status = "processing"
            existing.http_status = None
            existing.response_json = None
            existing.expires_at = now.replace() + __ttl()
            existing.updated_at = now
            session.flush()
            return IdempotencyHandle("new", existing)
        if existing.status == "completed" and existing.response_json is not None:
            return IdempotencyHandle("replay", existing, existing.http_status, existing.response_json)
        return IdempotencyHandle("processing", existing)
    record = IdempotencyRecord(
        id=new_id("idp"),
        actor_id=actor.id,
        operation=operation,
        resource_id=resource_id,
        key=key,
        payload_hash=payload_hash,
        status="processing",
        expires_at=now + __ttl(),
        created_at=now,
        updated_at=now,
    )
    session.add(record)
    session.flush()
    return IdempotencyHandle("new", record)


def complete_idempotent(session: Session, record: IdempotencyRecord, http_status: int, body: dict) -> None:
    record.status = "completed"
    record.http_status = http_status
    record.response_json = body
    record.updated_at = utcnow()


def assert_replay_allowed(_actor: User, _operation: str, resource_owner_check) -> None:
    """Re-check current rights before returning a stored receipt."""
    resource_owner_check()


def processing_body(operation_id: str) -> dict:
    from src.models.contracts_v1 import Processing

    return Processing(operation_id=operation_id, status="processing", poll_after_ms=2000).model_dump(mode="json")


def __ttl():
    from datetime import timedelta

    return timedelta(seconds=get_settings().idempotency_ttl_seconds)
