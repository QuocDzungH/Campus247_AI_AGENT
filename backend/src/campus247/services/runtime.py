from campus247.agents.stubs import StubAgent, StubRag
from campus247.config import Settings, get_settings
from campus247.models.ports_v1 import AgentPort, RagPort

_agent: AgentPort = StubAgent()
_rag: RagPort = StubRag()


def get_agent() -> AgentPort:
    return _agent


def get_rag() -> RagPort:
    return _rag


def set_agent(agent: AgentPort) -> None:
    global _agent
    _agent = agent


def set_rag(rag: RagPort) -> None:
    global _rag
    _rag = rag


def init_runtime(settings: Settings | None = None) -> None:
    """Wire RagPort always; build CampusAgent when AGENT_MODE=langgraph. Stub mode does not open a model."""
    resolved = settings or get_settings()
    if resolved.app_env == "production" and resolved.agent_mode != "langgraph":
        raise RuntimeError("APP_ENV=production requires AGENT_MODE=langgraph; StubAgent is not a production fallback.")
    from campus247.rag.factory import create_rag

    set_rag(create_rag(resolved))
    if resolved.agent_mode != "langgraph":
        return
    from campus247.agents.factory import create_agent
    from campus247.services.llm import create_chat_model

    model = create_chat_model(resolved)
    rag = get_rag()
    index_version = getattr(rag, "index_version", None)
    set_agent(
        create_agent(
            model,
            rag,
            model_name=resolved.resolved_llm_model(),
            index_version=str(index_version) if index_version else None,
        )
    )
