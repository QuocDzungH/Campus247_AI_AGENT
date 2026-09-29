from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from campus247.config import get_settings

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def _sqlite_on_connect(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


def make_engine(url: str) -> Engine:
    kwargs: dict = {"pool_pre_ping": True, "future": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if ":memory:" not in url and "mode=memory" not in url:
            path = url.removeprefix("sqlite:///")
            if path.startswith("./"):
                Path(path).parent.mkdir(parents=True, exist_ok=True)
            elif path and not path.startswith(":"):
                Path(path).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        event.listen(engine, "connect", _sqlite_on_connect)
    return engine


def get_engine(url: str | None = None) -> Engine:
    global _engine, _session_factory
    if _engine is None:
        _engine = make_engine(url or get_settings().database_url)
        _session_factory = sessionmaker(bind=_engine, autoflush=True, expire_on_commit=False, class_=Session)
    return _engine


def get_session_factory(url: str | None = None) -> sessionmaker[Session]:
    get_engine(url)
    assert _session_factory is not None
    return _session_factory


def reset_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None


@contextmanager
def session_scope(url: str | None = None) -> Iterator[Session]:
    session = get_session_factory(url)()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def dialect_name(session: Session) -> str:
    return session.get_bind().dialect.name


def begin_immediate(session: Session) -> None:
    """Take a write lock on SQLite so local races fail closed instead of last-write-wins."""
    if dialect_name(session) == "sqlite":
        session.execute(text("BEGIN IMMEDIATE"))
