from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response

from src.api.deps import Actor, Db, IdempotencyKey, RequestId
from src.models import contracts_v1 as c
from src.services import auth as auth_service
from src.services import staff as staff_service
from src.services import student as student_service
from src.services.runtime import get_agent

router = APIRouter()


def _json(status_code: int, body: dict, request_id: str) -> JSONResponse:
    headers = {"X-Request-Id": request_id}
    if status_code == 202:
        headers["Retry-After"] = "2"
    return JSONResponse(status_code=status_code, content=body, headers=headers)


@router.post("/auth/demo-login", status_code=200)
def demo_login(payload: c.DemoLogin, db: Db, request_id: RequestId) -> JSONResponse:
    result = auth_service.demo_login(db, payload.user_id)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/auth/logout", status_code=204)
def logout(payload: c.EmptyRequest, db: Db, actor: Actor, request: Request, request_id: RequestId) -> Response:
    auth_service.logout(db, actor, getattr(request.state, "access_token", ""))
    return Response(status_code=204, headers={"X-Request-Id": request_id})


@router.get("/me")
def me(actor: Actor, request_id: RequestId) -> JSONResponse:
    from src.services.serializers import user_to_contract

    return _json(200, user_to_contract(actor).model_dump(mode="json"), request_id)


@router.post("/conversations", status_code=201)
def create_conversation(payload: c.EmptyRequest, db: Db, actor: Actor, key: IdempotencyKey, request_id: RequestId) -> JSONResponse:
    status, body = student_service.create_conversation(db, actor, key, request_id)
    return _json(status, body, request_id)


@router.get("/conversations")
def list_conversations(
    db: Db,
    actor: Actor,
    request_id: RequestId,
    page: int | None = Query(default=None),
    page_size: int | None = Query(default=None),
) -> JSONResponse:
    result = student_service.list_conversations(db, actor, page, page_size)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.get("/conversations/{id}/messages")
def conversation_messages(
    id: str,
    db: Db,
    actor: Actor,
    request_id: RequestId,
    page: int | None = Query(default=None),
    page_size: int | None = Query(default=None),
) -> JSONResponse:
    result = student_service.list_messages(db, actor, id, page, page_size)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/conversations/{id}/messages")
async def send_conversation_message(
    id: str,
    payload: c.SendMessage,
    db: Db,
    actor: Actor,
    key: IdempotencyKey,
    request_id: RequestId,
) -> JSONResponse:
    status, body = await student_service.send_conversation_message(
        db, actor, id, payload.content, key, request_id, get_agent()
    )
    return _json(status, body, request_id)


@router.patch("/previews/{id}")
def patch_preview(
    id: str,
    payload: c.PreviewPatch,
    db: Db,
    actor: Actor,
    key: IdempotencyKey,
    request_id: RequestId,
) -> JSONResponse:
    status, body = student_service.patch_preview(db, actor, id, payload, key, request_id)
    return _json(status, body, request_id)


@router.post("/tickets", status_code=201)
def submit_ticket(
    payload: c.Submit1,
    db: Db,
    actor: Actor,
    key: IdempotencyKey,
    request_id: RequestId,
) -> JSONResponse:
    status, body = student_service.submit1(db, actor, payload, key, request_id)
    return _json(status, body, request_id)


@router.get("/tickets")
def list_tickets(
    db: Db,
    actor: Actor,
    request_id: RequestId,
    page: int | None = Query(default=None),
    page_size: int | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> JSONResponse:
    result = staff_service.list_student_tickets(db, actor, page, page_size, status, search)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.get("/tickets/{id}")
def get_ticket(
    id: str,
    db: Db,
    actor: Actor,
    request_id: RequestId,
    page: int | None = Query(default=None),
    page_size: int | None = Query(default=None),
) -> JSONResponse:
    result = staff_service.get_ticket_detail(db, actor, id, page, page_size)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.get("/tickets/{id}/messages")
def ticket_messages(
    id: str,
    db: Db,
    actor: Actor,
    request_id: RequestId,
    page: int | None = Query(default=None),
    page_size: int | None = Query(default=None),
) -> JSONResponse:
    result = staff_service.list_ticket_messages(db, actor, id, page, page_size)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/tickets/{id}/messages")
async def send_ticket_message(
    id: str,
    payload: c.SendMessage,
    db: Db,
    actor: Actor,
    key: IdempotencyKey,
    request_id: RequestId,
) -> JSONResponse:
    status, body = await student_service.send_ticket_message(
        db, actor, id, payload.content, key, request_id, get_agent()
    )
    return _json(status, body, request_id)


@router.get("/officer/tickets")
def officer_tickets(
    db: Db,
    actor: Actor,
    request_id: RequestId,
    page: int | None = Query(default=None),
    page_size: int | None = Query(default=None),
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> JSONResponse:
    result = staff_service.list_officer_tickets(db, actor, page, page_size, status, priority, category, search)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.get("/officer/tickets/{id}/brief")
def officer_brief(id: str, db: Db, actor: Actor, request_id: RequestId) -> JSONResponse:
    result = staff_service.get_brief(db, actor, id)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/officer/tickets/{id}/prepare", status_code=202)
def prepare_brief(
    id: str,
    payload: c.PrepareRequest,
    db: Db,
    actor: Actor,
    key: IdempotencyKey,
    request_id: RequestId,
) -> JSONResponse:
    status, body = staff_service.prepare_brief(db, actor, id, payload, key, request_id)
    return _json(status, body, request_id)


@router.post("/officer/tickets/{id}/actions")
def officer_action(
    id: str,
    payload: c.Submit2,
    db: Db,
    actor: Actor,
    key: IdempotencyKey,
    request_id: RequestId,
) -> JSONResponse:
    status, body = staff_service.submit2(db, actor, id, payload, key, request_id)
    return _json(status, body, request_id)


@router.post("/officer/tickets/{id}/claim")
def claim_ticket(
    id: str,
    payload: c.ClaimRequest,
    db: Db,
    actor: Actor,
    key: IdempotencyKey,
    request_id: RequestId,
) -> JSONResponse:
    status, body = staff_service.claim_ticket(db, actor, id, payload, key, request_id)
    return _json(status, body, request_id)


@router.get("/officer/tickets/{id}/audit")
def officer_audit(
    id: str,
    db: Db,
    actor: Actor,
    request_id: RequestId,
    page: int | None = Query(default=None),
    page_size: int | None = Query(default=None),
) -> JSONResponse:
    result = staff_service.list_audit(db, actor, id, page, page_size)
    return _json(200, result.model_dump(mode="json"), request_id)
