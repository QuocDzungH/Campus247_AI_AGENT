from src.agents.stubs import StubAgent, StubRag
from src.models.ports_v1 import AgentPort, RagPort

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
