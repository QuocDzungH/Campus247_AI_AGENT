from fastapi import APIRouter, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response

from campus247.api.deps import Actor, Db, IdempotencyKey, RequestId
from campus247.models import contracts_v1 as c
from campus247.services import auth as auth_service
from campus247.services import staff as staff_service
from campus247.services import student as student_service
from campus247.services.runtime import get_agent

router = APIRouter()


def _json(status_code: int, body: dict, request_id: str) -> JSONResponse:
    headers = {"X-Request-Id": request_id}
    if status_code == 202:
        headers["Retry-After"] = "2"
    return JSONResponse(status_code=status_code, content=body, headers=headers)


@router.post("/auth/login", status_code=200)
def password_login(payload: c.PasswordLogin, db: Db, request_id: RequestId) -> JSONResponse:
    result = auth_service.password_login(db, payload.identifier, payload.password, remember=payload.remember)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/auth/demo-login", status_code=200)
def demo_login(payload: c.DemoLogin, db: Db, request_id: RequestId) -> JSONResponse:
    result = auth_service.demo_login(db, payload.user_id)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/auth/logout", status_code=204)
def logout(payload: c.EmptyRequest, db: Db, actor: Actor, request: Request, request_id: RequestId) -> Response:
    auth_service.logout(db, actor, getattr(request.state, "access_token", ""))
    return Response(status_code=204, headers={"X-Request-Id": request_id})


@router.post("/auth/change-password", status_code=204)
def change_password(payload: c.ChangePassword, db: Db, actor: Actor, request: Request, request_id: RequestId) -> Response:
    auth_service.change_password(
        db,
        actor,
        payload.current_password,
        payload.new_password,
        getattr(request.state, "access_token", ""),
    )
    return Response(status_code=204, headers={"X-Request-Id": request_id})


@router.post("/auth/reset-password", status_code=204)
def reset_password(payload: c.ConsumeResetToken, db: Db, request_id: RequestId) -> Response:
    auth_service.consume_reset_token(db, payload.token, payload.new_password)
    return Response(status_code=204, headers={"X-Request-Id": request_id})


@router.get("/me")
def me(actor: Actor, request_id: RequestId) -> JSONResponse:
    from campus247.services.serializers import user_to_contract

    return _json(200, user_to_contract(actor).model_dump(mode="json"), request_id)


@router.get("/me/profile")
def me_profile(db: Db, actor: Actor, request_id: RequestId) -> JSONResponse:
    from campus247.services.access import require_student
    from campus247.services.serializers import profile_view

    require_student(actor)
    if actor.profile is None:
        from campus247.services.errors import not_found

        raise not_found()
    return _json(200, profile_view(actor.profile).model_dump(mode="json"), request_id)


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


@router.post("/forms", status_code=201)
def submit_form(
    payload: c.FormSubmit,
    db: Db,
    actor: Actor,
    key: IdempotencyKey,
    request_id: RequestId,
) -> JSONResponse:
    status, body = student_service.submit_form(db, actor, payload, key, request_id)
    return _json(status, body, request_id)


@router.post("/tickets/{id}/attachments", status_code=201)
async def upload_attachment(
    id: str,
    db: Db,
    actor: Actor,
    request_id: RequestId,
    file: UploadFile = File(...),
    field: str | None = Form(default=None),
) -> JSONResponse:
    from campus247.services.files import save_upload

    result = await save_upload(db, actor, id, file, field)
    return _json(201, result.model_dump(mode="json"), request_id)


@router.get("/tickets/{id}/attachments/{attachment_id}")
def download_attachment(
    id: str,
    attachment_id: str,
    db: Db,
    actor: Actor,
) -> FileResponse:
    from campus247.services.files import open_download

    path, row = open_download(db, actor, id, attachment_id)
    return FileResponse(path, filename=row.filename, media_type=row.mime_type)


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


@router.patch("/officer/tickets/{id}/workspace")
def officer_workspace(
    id: str,
    payload: c.TicketWorkspacePatch,
    db: Db,
    actor: Actor,
    request_id: RequestId,
) -> JSONResponse:
    result = staff_service.update_workspace(db, actor, id, payload)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/tickets/{id}/verifications", status_code=200)
def run_ticket_verification(id: str, db: Db, actor: Actor, request_id: RequestId) -> JSONResponse:
    from campus247.services import staff as staff_service

    items = staff_service.run_ticket_verification(db, actor, id)
    return _json(200, {"items": [item.model_dump(mode="json") for item in items]}, request_id)


@router.post("/tickets/{id}/verifications/{criterion_id}/confirm", status_code=200)
def confirm_ticket_verification(
    id: str,
    criterion_id: str,
    payload: c.VerificationConfirm,
    db: Db,
    actor: Actor,
    request_id: RequestId,
) -> JSONResponse:
    from campus247.services import staff as staff_service

    items = staff_service.confirm_ticket_verification(db, actor, id, criterion_id, payload.note)
    return _json(200, {"items": [item.model_dump(mode="json") for item in items]}, request_id)


@router.get("/reviews")
def list_reviews(
    db: Db,
    actor: Actor,
    request_id: RequestId,
    page: int | None = Query(default=None),
    page_size: int | None = Query(default=None),
) -> JSONResponse:
    from campus247.services import reviews as review_service

    result = review_service.list_review_cases(db, actor, page, page_size)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/reviews", status_code=201)
def create_review(payload: c.ReviewCaseCreate, db: Db, actor: Actor, request_id: RequestId) -> JSONResponse:
    from campus247.services import reviews as review_service

    result = review_service.create_review_case(db, actor, payload)
    return _json(201, result.model_dump(mode="json"), request_id)


@router.get("/reviews/{id}")
def get_review(id: str, db: Db, actor: Actor, request_id: RequestId) -> JSONResponse:
    from campus247.services import reviews as review_service

    result = review_service.get_review_case(db, actor, id)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/reviews/{id}/ai")
def run_review_ai(id: str, db: Db, actor: Actor, request_id: RequestId) -> JSONResponse:
    from campus247.services import reviews as review_service

    result = review_service.run_ai_review(db, actor, id)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.patch("/reviews/{id}/findings/{finding_id}")
def patch_review_finding(
    id: str,
    finding_id: str,
    payload: c.ReviewFindingPatch,
    db: Db,
    actor: Actor,
    request_id: RequestId,
) -> JSONResponse:
    from campus247.services import reviews as review_service

    result = review_service.update_finding(db, actor, id, finding_id, payload)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/reviews/{id}/supplements")
def send_review_supplement(
    id: str, payload: c.ReviewSupplementRequest, db: Db, actor: Actor, request_id: RequestId
) -> JSONResponse:
    from campus247.services import reviews as review_service

    result = review_service.send_supplement(db, actor, id, payload)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/reviews/{id}/student-supplement")
def student_review_supplement(
    id: str, payload: c.ReviewStudentSupplement, db: Db, actor: Actor, request_id: RequestId
) -> JSONResponse:
    from campus247.services import reviews as review_service

    result = review_service.submit_student_supplement(db, actor, id, payload)
    return _json(200, result.model_dump(mode="json"), request_id)


@router.post("/reviews/{id}/finalize")
def finalize_review(id: str, payload: c.ReviewFinalize, db: Db, actor: Actor, request_id: RequestId) -> JSONResponse:
    from campus247.services import reviews as review_service

    result = review_service.finalize_review(db, actor, id, payload)
    return _json(200, result.model_dump(mode="json"), request_id)


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
