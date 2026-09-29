import pytest

from src.db.engine import session_scope
from src.db.seed import seed_from_document
from src.services.runtime import get_agent, set_agent
from tests.db_support import upgrade_head


@pytest.fixture
def db_url(tmp_path):
    url = f"sqlite:///{tmp_path}/campus.db"
    upgrade_head(url)
    return url


@pytest.fixture
def db_session(db_url):
    with session_scope(db_url) as session:
        seed_from_document(session)
        yield session


@pytest.fixture
def restore_agent():
    original = get_agent()
    yield
    set_agent(original)
