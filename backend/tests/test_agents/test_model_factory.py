from types import SimpleNamespace

import pytest

from campus247.agents.stubs import StubAgent, StubRag
from campus247.config import Settings, get_settings
from campus247.services.llm import LLMConfigurationError, create_chat_model, validate_llm_settings
from campus247.services.runtime import init_runtime, set_agent, set_rag


def _settings(**kwargs) -> Settings:
    data = {
        "llm_provider": "openai",
        "llm_model": "gpt-4o-mini",
        "openai_api_key": "sk-test",
        "google_api_key": "",
        "gemini_api_key": "",
        "groq_api_key": "",
        "openai_base_url": "",
        "agent_mode": "langgraph",
    }
    data.update(kwargs)
    return Settings(**data)


def test_openai_uses_chat_openai(monkeypatch):
    captured = {}

    def fake_openai(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(kind="openai", **kwargs)

    monkeypatch.setattr("langchain_openai.ChatOpenAI", fake_openai)
    model = create_chat_model(_settings())
    assert model.kind == "openai"
    assert captured["model"] == "gpt-4o-mini"
    assert captured["max_retries"] == 0
    assert "base_url" not in captured


def test_google_prefers_google_api_key(monkeypatch):
    captured = {}

    def fake_google(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(kind="google")

    monkeypatch.setattr("langchain_google_genai.ChatGoogleGenerativeAI", fake_google)
    create_chat_model(_settings(llm_provider="google", google_api_key="g-key", gemini_api_key="fallback"))
    assert captured["google_api_key"] == "g-key"
    assert captured["model"] == "gpt-4o-mini"
    assert captured["max_retries"] == 0


def test_google_falls_back_to_gemini_key(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        "langchain_google_genai.ChatGoogleGenerativeAI",
        lambda **kwargs: captured.update(kwargs) or SimpleNamespace(),
    )
    create_chat_model(_settings(llm_provider="google", google_api_key="", gemini_api_key="gem-key"))
    assert captured["google_api_key"] == "gem-key"


def test_groq_client(monkeypatch):
    captured = {}
    monkeypatch.setattr("langchain_groq.ChatGroq", lambda **kwargs: captured.update(kwargs) or SimpleNamespace(kind="groq"))
    model = create_chat_model(_settings(llm_provider="groq", groq_api_key="gsk-test"))
    assert model.kind == "groq"
    assert captured["max_retries"] == 0
    assert captured["groq_api_key"] == "gsk-test"
    assert captured["request_timeout"] == 10.0


def test_openai_compatible_requires_base_url():
    with pytest.raises(LLMConfigurationError, match="OPENAI_BASE_URL"):
        validate_llm_settings(_settings(llm_provider="openai_compatible", openai_base_url=""))


def test_openai_compatible_passes_base_url(monkeypatch):
    captured = {}
    monkeypatch.setattr("langchain_openai.ChatOpenAI", lambda **kwargs: captured.update(kwargs) or SimpleNamespace())
    create_chat_model(
        _settings(llm_provider="openai_compatible", openai_api_key="sk", openai_base_url="http://localhost:11434/v1")
    )
    assert captured["base_url"] == "http://localhost:11434/v1"


def test_unknown_provider_fails_fast():
    with pytest.raises(LLMConfigurationError, match="not supported"):
        validate_llm_settings(_settings(llm_provider="anthropic"))


def test_missing_openai_key_fails():
    with pytest.raises(LLMConfigurationError, match="OPENAI_API_KEY"):
        validate_llm_settings(_settings(openai_api_key=""))


def test_gemini_alias_normalizes(monkeypatch):
    monkeypatch.setattr("langchain_google_genai.ChatGoogleGenerativeAI", lambda **kwargs: SimpleNamespace(kind="google"))
    model = create_chat_model(_settings(llm_provider="gemini", google_api_key="g"))
    assert model.kind == "google"


def test_structured_output_method_exists_on_created_model(monkeypatch):
    class FakeModel:
        def with_structured_output(self, schema, **kwargs):
            return schema

    monkeypatch.setattr("langchain_openai.ChatOpenAI", lambda **kwargs: FakeModel())
    model = create_chat_model(_settings())
    assert hasattr(model, "with_structured_output")
    assert model.with_structured_output(dict) is dict


def test_model_name_alias_when_llm_model_unset(monkeypatch):
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.setenv("MODEL_NAME", "custom-model")
    settings = Settings(_env_file=None)
    assert settings.resolved_llm_model() == "custom-model"
    assert settings.llm_model == "custom-model"


def test_llm_model_wins_over_model_name_alias(monkeypatch):
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)
    settings = Settings(_env_file=None, llm_model="gpt-4o-mini", model_name="custom-model")
    assert settings.resolved_llm_model() == "gpt-4o-mini"


def test_stub_runtime_does_not_create_model(monkeypatch):
    called = {"n": 0}

    def boom(settings):
        called["n"] += 1
        raise AssertionError("should not build model in stub mode")

    monkeypatch.setattr("campus247.services.llm.create_chat_model", boom)
    set_agent(StubAgent())
    set_rag(StubRag())
    init_runtime(_settings(agent_mode="stub"))
    assert called["n"] == 0
    get_settings.cache_clear()
