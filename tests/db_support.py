from __future__ import annotations

import os
import shutil
import socket
import subprocess
import time
from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url

from alembic import command
from src.config import get_settings
from src.db.engine import reset_engine, session_scope
from src.db.seed import seed_from_document

ROOT = Path(__file__).resolve().parents[1]
PG_TEST_CONTAINER = "edu14-pytest-postgres"
PG_TEST_PORT = 54329
PG_TEST_DB = "campus24_pytest"
PG_TEST_URL = f"postgresql+psycopg://campus:campus@127.0.0.1:{PG_TEST_PORT}/{PG_TEST_DB}"
DISPOSABLE_DB_NAMES = frozenset({"campus24_pytest", "edu14_pytest"})


def configure_database(url: str) -> None:
    os.environ["DATABASE_URL"] = url
    os.environ.setdefault("APP_ENV", "test")
    get_settings.cache_clear()
    reset_engine()


def alembic_config(url: str) -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


def upgrade_head(url: str) -> None:
    configure_database(url)
    command.upgrade(alembic_config(url), "head")


def downgrade_base(url: str) -> None:
    configure_database(url)
    command.downgrade(alembic_config(url), "base")


def seeded_session(url: str):
    upgrade_head(url)
    with session_scope(url) as session:
        seed_from_document(session)
        yield session


def _port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except OSError:
        return False


def _postgres_accepts(url: str) -> bool:
    engine = create_engine(url, pool_pre_ping=True, future=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        return False
    finally:
        engine.dispose()


def _docker_container_running(name: str) -> bool:
    inspect = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", name],
        check=False,
        capture_output=True,
        text=True,
    )
    return inspect.returncode == 0 and inspect.stdout.strip() == "true"


def _ensure_pytest_postgres() -> bool:
    if shutil.which("docker") is None:
        return False
    if _docker_container_running(PG_TEST_CONTAINER):
        return True
    inspect = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Status}}", PG_TEST_CONTAINER],
        check=False,
        capture_output=True,
        text=True,
    )
    if inspect.returncode == 0:
        started = subprocess.run(["docker", "start", PG_TEST_CONTAINER], check=False, capture_output=True)
        return started.returncode == 0
    started = subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--name",
            PG_TEST_CONTAINER,
            "-e",
            "POSTGRES_USER=campus",
            "-e",
            "POSTGRES_PASSWORD=campus",
            "-e",
            "POSTGRES_DB=campus24",
            "-p",
            f"{PG_TEST_PORT}:5432",
            "postgres:16",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    return started.returncode == 0


def is_disposable_postgres_database(name: str | None) -> bool:
    if not name:
        return False
    if name in DISPOSABLE_DB_NAMES:
        return True
    return name.endswith("_pytest") or name.endswith("_test")


def assert_disposable_postgres_url(url: str) -> str:
    """Refuse DROP SCHEMA / destructive pytest setup unless the URL is a test database."""
    parsed = make_url(url)
    backend = parsed.get_backend_name()
    if backend not in {"postgresql", "postgres"}:
        raise RuntimeError(f"Expected a PostgreSQL URL, got {backend!r}.")
    name = parsed.database
    if not is_disposable_postgres_database(name):
        raise RuntimeError(
            f"Database {name!r} is not a disposable pytest database. "
            "Set EDU14_TEST_DATABASE_URL to a database named campus24_pytest "
            "or ending in _test/_pytest. Refusing DROP SCHEMA public CASCADE."
        )
    return url


def _ensure_database(url: str) -> None:
    parsed = make_url(url)
    db_name = parsed.database
    if not db_name or not is_disposable_postgres_database(db_name):
        raise RuntimeError(f"Refusing to CREATE DATABASE for {db_name!r}.")
    if not db_name.isidentifier() or not db_name.replace("_", "").isalnum():
        raise RuntimeError(f"Unsafe database name {db_name!r}.")
    last_error: Exception | None = None
    for admin_name in ("postgres", "campus24"):
        admin = parsed.set(database=admin_name)
        engine = create_engine(admin, isolation_level="AUTOCOMMIT", future=True)
        try:
            with engine.connect() as conn:
                exists = conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :name"),
                    {"name": db_name},
                ).scalar()
                if exists is None:
                    conn.execute(text(f'CREATE DATABASE "{db_name}"'))
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
        finally:
            engine.dispose()
    raise RuntimeError(f"Could not ensure database {db_name}: {last_error}")


def resolve_postgres_url() -> str | None:
    """Use EDU14_TEST_DATABASE_URL if it is a disposable test DB, else Docker pytest Postgres."""
    env_url = os.environ.get("EDU14_TEST_DATABASE_URL")
    if env_url:
        assert_disposable_postgres_url(env_url)
        return env_url if _postgres_accepts(env_url) else None
    if not _ensure_pytest_postgres():
        if _postgres_accepts(PG_TEST_URL):
            return PG_TEST_URL
        return None
    deadline = time.time() + 45
    while time.time() < deadline:
        if _port_open("127.0.0.1", PG_TEST_PORT):
            try:
                _ensure_database(PG_TEST_URL)
            except Exception:  # noqa: BLE001
                time.sleep(0.4)
                continue
            if _postgres_accepts(PG_TEST_URL):
                return PG_TEST_URL
        time.sleep(0.4)
    return None
