import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from campus247.models.contracts_v1 import ErrorBody, ErrorDetails, ErrorEnvelope, MissingItem
from campus247.services.errors import ApiError

logger = logging.getLogger("campus247.api")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "req_unknown")
        payload = exc.envelope(request_id).model_dump(mode="json")
        headers = {"X-Request-Id": request_id}
        if exc.status_code == 202:
            headers["Retry-After"] = "2"
        return JSONResponse(status_code=exc.status_code, content=payload, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "req_unknown")
        field_errors = []
        for error in exc.errors():
            loc = ".".join(str(part) for part in error.get("loc", []) if part != "body")
            field_errors.append(MissingItem(field=loc or "body", reason=error.get("msg", "invalid")))
        payload = ErrorEnvelope(
            error=ErrorBody(
                code="VALIDATION_ERROR",
                message="Dữ liệu gửi lên không hợp lệ.",
                request_id=request_id,
                retryable=False,
                details=ErrorDetails(field_errors=field_errors),
            )
        ).model_dump(mode="json")
        return JSONResponse(status_code=422, content=payload, headers={"X-Request-Id": request_id})

    @app.exception_handler(SQLAlchemyError)
    async def db_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "req_unknown")
        logger.exception("persistence_unavailable request_id=%s", request_id)
        payload = ErrorEnvelope(
            error=ErrorBody(
                code="PERSISTENCE_UNAVAILABLE",
                message="Không xác nhận được trạng thái dữ liệu. Vui lòng kiểm tra lại trước khi thử.",
                request_id=request_id,
                retryable=True,
                details=ErrorDetails(handover_status="unknown"),
            )
        ).model_dump(mode="json")
        return JSONResponse(status_code=503, content=payload, headers={"X-Request-Id": request_id})
