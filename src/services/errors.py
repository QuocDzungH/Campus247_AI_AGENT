from src.models.contracts_v1 import ErrorBody, ErrorDetails, ErrorEnvelope, MissingItem


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        details: ErrorDetails | None = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or ErrorDetails()
        super().__init__(code)

    def envelope(self, request_id: str) -> ErrorEnvelope:
        return ErrorEnvelope(
            error=ErrorBody(
                code=self.code,  # type: ignore[arg-type]
                message=self.message,
                request_id=request_id,
                retryable=self.retryable,
                details=self.details,
            )
        )


def unauthenticated() -> ApiError:
    return ApiError(401, "UNAUTHENTICATED", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.")


def forbidden() -> ApiError:
    return ApiError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.")


def not_found() -> ApiError:
    return ApiError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy tài nguyên.")


def validation(message: str, field_errors: list[MissingItem] | None = None) -> ApiError:
    return ApiError(
        422,
        "VALIDATION_ERROR",
        message,
        details=ErrorDetails(field_errors=field_errors or []),
    )


def persistence_unavailable(details: ErrorDetails | None = None) -> ApiError:
    return ApiError(
        503,
        "PERSISTENCE_UNAVAILABLE",
        "Không xác nhận được trạng thái dữ liệu. Vui lòng kiểm tra lại trước khi thử.",
        retryable=True,
        details=details or ErrorDetails(handover_status="unknown"),
    )
