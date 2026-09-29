from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from src.db.engine import get_session_factory
from src.db.models import User
from src.services.auth import resolve_bearer
from src.services.runtime import get_agent


def get_db() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "req_unknown")


def get_actor(
    request: Request,
    db: Session = Depends(get_db),
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    user, token = resolve_bearer(db, authorization)
    request.state.access_token = token
    return user


Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(get_actor)]
RequestId = Annotated[str, Depends(get_request_id)]
IdempotencyKey = Annotated[str, Header(alias="Idempotency-Key")]
AgentDep = Annotated[object, Depends(get_agent)]
