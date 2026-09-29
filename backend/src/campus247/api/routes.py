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
    settings = get_settings()
    return {"status": "ready", "agent": "CampusAgent", "agent_mode": settings.agent_mode}
