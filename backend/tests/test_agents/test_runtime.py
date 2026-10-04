from types import SimpleNamespace

import pytest

from campus247.agents.adapter import CampusAgent
from campus247.agents.metadata import metadata_from_agent
from campus247.agents.stubs import StubAgent, StubRag
from campus247.config import Settings
from campus247.services.runtime import get_agent, get_rag, init_runtime, set_agent, set_rag
from campus247.workers.runner import run_forever


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
    return Settings(_env_file=None, **data)


def test_metadata_from_agent_defaults_to_stub():
    meta = metadata_from_agent(object())
    assert meta["model_name"] == "stub-agent"
    assert meta["prompt_version"] == "1"
    assert meta["template_version"] == "1"


def test_langgraph_init_runtime_uses_campus_agent(monkeypatch):
    original_agent = get_agent()
    original_rag = get_rag()
    monkeypatch.setattr("campus247.services.llm.create_chat_model", lambda settings: SimpleNamespace(name="fake"))
    try:
        set_agent(StubAgent())
        set_rag(StubRag())
        init_runtime(_settings(agent_mode="langgraph"))
        agent = get_agent()
        assert isinstance(agent, CampusAgent)
        meta = agent.brief_artifact_metadata()
        assert meta["model_name"] == "gpt-4o-mini"
        assert "officer-dossier-v2" in (meta["prompt_version"] or "")
        assert meta["template_version"] == "officer-safe-template-v1"
        assert meta["index_version"] == "stub-v0"
        assert isinstance(get_rag(), StubRag)
    finally:
        set_agent(original_agent)
        set_rag(original_rag)


def test_langgraph_init_runtime_wires_corpus_rag(monkeypatch):
    from campus247.rag.corpus import CorpusRag

    original_agent = get_agent()
    original_rag = get_rag()
    monkeypatch.setattr("campus247.services.llm.create_chat_model", lambda settings: SimpleNamespace(name="fake"))
    try:
        set_agent(StubAgent())
        set_rag(StubRag())
        init_runtime(_settings(agent_mode="langgraph", rag_mode="corpus"))
        rag = get_rag()
        assert isinstance(rag, CorpusRag)
        agent = get_agent()
        assert isinstance(agent, CampusAgent)
        assert agent.brief_artifact_metadata()["index_version"] == "edu14-demo-academic-v1"
    finally:
        set_agent(original_agent)
        set_rag(original_rag)


def test_langgraph_init_runtime_wires_pipeline_rag(monkeypatch, tmp_path):
    from campus247.rag.pipeline import PipelineRag

    original_agent = get_agent()
    original_rag = get_rag()
    monkeypatch.setattr("campus247.services.llm.create_chat_model", lambda settings: SimpleNamespace(name="fake"))
    try:
        set_agent(StubAgent())
        set_rag(StubRag())
        init_runtime(
            _settings(
                app_env="test",
                agent_mode="langgraph",
                rag_mode="pipeline",
                rag_pipeline_dir=str(tmp_path),
                rag_index_dir=str(tmp_path / "rag_index"),
            )
        )
        rag = get_rag()
        assert isinstance(rag, PipelineRag)
        assert isinstance(get_agent(), CampusAgent)
        assert (get_agent().brief_artifact_metadata()["index_version"] or "").startswith("vinuni-hybrid-")
    finally:
        set_agent(original_agent)
        set_rag(original_rag)


def test_pipeline_path_falls_back_to_repo_when_started_from_backend(monkeypatch, tmp_path):
    from campus247.rag.factory import _resolve_pipeline_dir

    monkeypatch.chdir(tmp_path)
    resolved = _resolve_pipeline_dir("RAG")
    assert resolved.name == "RAG"
    assert resolved.is_dir()


def test_run_forever_initializes_runtime_once(monkeypatch):
    called = {"init": 0}

    def fake_init(settings=None):
        called["init"] += 1

    def fake_once():
        raise KeyboardInterrupt()

    monkeypatch.setattr("campus247.workers.runner.init_runtime", fake_init)
    monkeypatch.setattr("campus247.workers.runner.run_once", fake_once)
    with pytest.raises(KeyboardInterrupt):
        run_forever(idle_sleep=0)
    assert called["init"] == 1
