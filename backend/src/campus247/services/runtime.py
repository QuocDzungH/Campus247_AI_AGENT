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
    """Wire CampusAgent when AGENT_MODE=langgraph. Stub mode keeps StubAgent and does not build a model."""
    resolved = settings or get_settings()
    if resolved.agent_mode != "langgraph":
        return
    from campus247.agents.factory import create_agent
    from campus247.services.llm import create_chat_model

    model = create_chat_model(resolved)
    set_agent(create_agent(model, get_rag(), model_name=resolved.resolved_llm_model()))
