from fastapi import APIRouter

from campus247.config import get_settings
from campus247.models.schemas import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Demo leftover from the sample graph. Production intake is POST /conversations/{id}/messages."""
    return ChatResponse(
        response="Endpoint demo. Hãy dùng /api/v1/conversations/{id}/messages cho intake P0.",
        analysis="isolated-demo",
    )


@router.get("/status")
async def agent_status():
    from campus247.services.runtime import get_agent, get_rag

    settings = get_settings()
    rag = get_rag()
    demo_auth = settings.demo_auth_enabled and settings.app_env != "production"
    return {
        "status": "ready",
        "agent": type(get_agent()).__name__,
        "agent_mode": settings.agent_mode,
        "rag_mode": settings.rag_mode,
        "index_version": getattr(rag, "index_version", None),
        "app_env": settings.app_env,
        "demo_auth_enabled": demo_auth,
        "auth": "demo+password" if demo_auth else "password",
    }
