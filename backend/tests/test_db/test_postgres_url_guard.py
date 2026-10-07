import pytest

from tests.db_support import assert_disposable_postgres_url, is_disposable_postgres_database


def test_rejects_compose_campus24_url():
    with pytest.raises(RuntimeError, match="disposable pytest database"):
        assert_disposable_postgres_url("postgresql+psycopg://campus:campus@localhost:5432/campus24")


def test_rejects_url_without_database_name():
    with pytest.raises(RuntimeError, match="disposable pytest database"):
        assert_disposable_postgres_url("postgresql+psycopg://campus:campus@localhost:5432")


def test_allows_named_pytest_database():
    url = "postgresql+psycopg://campus:campus@127.0.0.1:54329/campus24_pytest"
    assert assert_disposable_postgres_url(url) == url
    assert is_disposable_postgres_database("campus24_test")
    assert is_disposable_postgres_database("edu14_pytest")
    assert not is_disposable_postgres_database("campus24")
    assert not is_disposable_postgres_database("postgres")
