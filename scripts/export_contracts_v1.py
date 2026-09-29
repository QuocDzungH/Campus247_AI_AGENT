"""Generate contract-only OpenAPI and validated examples; no runtime routes are added.

Run: python -m scripts.export_contracts_v1 [--check]
"""

import argparse
import json
from copy import deepcopy
from pathlib import Path

from src.models import contracts_v1 as c

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "contracts"
NOW = "2026-09-29T03:00:00Z"

# method, path, request, success code, success response, idempotency
ENDPOINTS = [
    ("post", "/auth/demo-login", c.DemoLogin, 200, c.LoginResult, False),
    ("post", "/auth/logout", c.EmptyRequest, 204, None, False),
    ("get", "/me", None, 200, c.User, False),
    ("post", "/conversations", c.EmptyRequest, 201, c.Conversation, True),
    ("get", "/conversations", None, 200, c.Page[c.Conversation], False),
    ("get", "/conversations/{id}/messages", None, 200, c.Page[c.Message], False),
    ("post", "/conversations/{id}/messages", c.SendMessage, 200, c.ChatResult, True),
    ("patch", "/previews/{id}", c.PreviewPatch, 200, c.Preview, True),
    ("post", "/tickets", c.Submit1, 201, c.Submit1Result, True),
    ("get", "/tickets", None, 200, c.Page[c.Ticket], False),
    ("get", "/tickets/{id}", None, 200, c.TicketDetail, False),
    ("get", "/tickets/{id}/messages", None, 200, c.Page[c.Message], False),
    ("post", "/tickets/{id}/messages", c.SendMessage, 200, c.ChatResult, True),
    ("get", "/officer/tickets", None, 200, c.Page[c.Ticket], False),
    ("get", "/officer/tickets/{id}/brief", None, 200, c.BriefEnvelope, False),
    ("post", "/officer/tickets/{id}/prepare", c.PrepareRequest, 202, c.JobAccepted, True),
    ("post", "/officer/tickets/{id}/actions", c.Submit2, 200, c.Submit2Result, True),
    ("get", "/officer/tickets/{id}/audit", None, 200, c.Page[c.AuditEntry], False),
]


def example_cases() -> list[dict]:
    citation = dict(
        document_id="policy_001",
        document_title="Quy trình demo",
        document_version="1",
        chunk_id="chunk_012",
        locator="Mục 2",
        quote="Sinh viên kiểm tra thông tin trước khi gửi yêu cầu.",
        url=None,
    )
    fields = dict(
        purpose="Vay vốn ngân hàng", destination_org="Ngân hàng Chính sách Xã hội", receive_method="paper_stamped"
    )
    intake = dict(service_type="student_certificate", fields=fields, missing_fields=[], invalid_fields=[])
    preview = dict(**intake, id="preview_001", version=1, can_submit=True, expires_at="2026-09-29T03:30:00Z")
    message = dict(
        id="msg_001",
        conversation_id="conv_001",
        ticket_id=None,
        sender="student",
        content="Tôi muốn xin giấy xác nhận",
        created_at=NOW,
    )
    ticket = dict(
        id="tkt_001",
        code="TKT-0001",
        conversation_id="conv_001",
        student_id="SV001",
        category="action",
        service_type="student_certificate",
        status="open",
        priority="normal",
        priority_reasons=[],
        summary="Xin giấy để vay vốn",
        request_data=fields,
        handover_reason=None,
        assigned_officer_id=None,
        revision=1,
        created_at=NOW,
        updated_at=NOW,
    )
    profile = dict(
        student_id="SV001", full_name="Nguyễn Văn An", mssv="20210018", faculty="KTPM", cohort="K18", is_demo=True
    )
    passage = dict(citation=citation, text=citation["quote"], score=0.82)
    handover = dict(
        risk_type="academic_complaint",
        reason="Sinh viên gửi khiếu nại điểm",
        summary="Đề nghị cán bộ kiểm tra điểm học phần",
        source_message_ids=["msg_001"],
    )
    brief = dict(
        ticket_id="tkt_001",
        source_ticket_revision=1,
        summary="Sinh viên xin giấy để vay vốn",
        facts=[
            dict(
                key="purpose",
                value="Vay vốn ngân hàng",
                source_type="student_message",
                source_id="msg_001",
                verification_status="unverified",
            )
        ],
        missing_items=[],
        checklist=[dict(id="check_profile", label="Kiểm tra tình trạng học tập", checked=False)],
        suggested_priority="normal",
        priority_reasons=[],
        draft_reply="Phòng học vụ đã tiếp nhận yêu cầu.",
        citations=[citation],
        warnings=[],
        quality_status="pass",
    )
    chat = dict(
        conversation_id="conv_001",
        user_message_id="msg_001",
        route="L2",
        outcome="preview_ready",
        reply=dict(message, id="msg_002", sender="assistant", content="Bạn hãy kiểm tra thông tin trước khi gửi."),
        citations=[],
        preview=preview,
        ticket=None,
        conversation_state=dict(status="active", ai_response_locked=False, handover_status="none"),
    )
    cases = []

    def add(name, model, data):
        validated = model.model_validate(data)
        cases.append({"name": name, "model": model.__name__, "payload": validated.model_dump(mode="json")})

    add(
        "retrieval_request",
        c.RetrievalRequest,
        dict(query="Xin giấy cần gì?", policy_scope="demo_academic", top_k=5, effective_at=NOW),
    )
    add("retrieval_found", c.RetrievalResult, dict(status="found", passages=[passage], index_version="demo-v1"))
    add("retrieval_empty", c.RetrievalResult, dict(status="empty", passages=[], index_version="demo-v1"))
    add(
        "rag_request",
        c.RagRequest,
        dict(question="Xin giấy cần gì?", history=[message], policy_scope="demo_academic", effective_at=NOW),
    )
    for status in ("answered", "needs_clarification", "insufficient_evidence"):
        add(
            "rag_" + status,
            c.RagResult,
            dict(status=status, answer="Nội dung phản hồi mẫu", citations=[citation] if status == "answered" else []),
        )
    add(
        "intake_context",
        c.IntakeContext,
        dict(
            request_id="req_001",
            conversation_id="conv_001",
            conversation_revision=1,
            actor=dict(user_id="SV001", role="student"),
            student_profile=profile,
            message=message,
            history=[],
            preview=None,
            linked_ticket=None,
            policy_scope="demo_academic",
            effective_at=NOW,
        ),
    )
    add(
        "intake_preview",
        c.IntakeResult,
        dict(
            route="L2",
            outcome="preview_ready",
            reply="Hãy kiểm tra yêu cầu",
            citations=[],
            intake=intake,
            handover=None,
        ),
    )
    incomplete = deepcopy(intake)
    incomplete["fields"]["receive_method"] = None
    incomplete["missing_fields"] = ["receive_method"]
    add(
        "intake_collecting",
        c.IntakeResult,
        dict(
            route="L2",
            outcome="collecting",
            reply="Bạn muốn nhận bản giấy hay điện tử?",
            citations=[],
            intake=incomplete,
            handover=None,
        ),
    )
    add(
        "intake_handover",
        c.IntakeResult,
        dict(route="L4", outcome="handover_required", reply=None, citations=[], intake=None, handover=handover),
    )
    add(
        "ticket_snapshot",
        c.TicketSnapshot,
        dict(
            ticket=ticket,
            source_ticket_revision=1,
            student_profile=profile,
            messages=[message],
            intake_packet=intake,
            handover_packet=None,
            approved_sources=[passage],
            existing_officer_draft=None,
            request_id="req_001",
        ),
    )
    add("officer_brief", c.OfficerBrief, brief)
    add("chat_preview", c.ChatResult, chat)
    collecting = deepcopy(chat)
    collecting.update(
        outcome="collecting",
        preview=dict(**incomplete, id="preview_001", version=1, can_submit=False, expires_at=preview["expires_at"]),
    )
    add("chat_collecting", c.ChatResult, collecting)
    for status in ("answered", "needs_clarification", "insufficient_evidence"):
        result = deepcopy(chat)
        result.update(route="L1", outcome=status, preview=None, citations=[citation] if status == "answered" else [])
        add("chat_" + status, c.ChatResult, result)
    for outcome in ("handover_completed", "forwarded_to_officer", "supplement_received"):
        result = deepcopy(chat)
        locked = outcome != "supplement_received"
        result.update(
            route="L4" if locked else "L2",
            outcome=outcome,
            preview=None,
            ticket=dict(
                id="tkt_001", code="TKT-0001", status="pending_officer", priority="high" if locked else "normal"
            ),
            conversation_state=dict(
                status="handover" if locked else "active",
                ai_response_locked=locked,
                handover_status="completed" if locked else "none",
            ),
        )
        result["reply"].update(
            sender="system", ticket_id="tkt_001", content="Thông tin đã được lưu để cán bộ tiếp nhận."
        )
        add("chat_" + outcome, c.ChatResult, result)
    add("submit1", c.Submit1, dict(preview_id="preview_001", preview_version=1, confirmed=True))
    add("submit1_success", c.Submit1Result, dict(ticket=ticket, brief_status="pending"))
    add(
        "submit2",
        c.Submit2,
        dict(
            action="respond",
            content="Phòng học vụ đã tiếp nhận.",
            expected_revision=1,
            reviewed_brief_version=1,
            confirmed=True,
        ),
    )
    add("preview_patch", c.PreviewPatch, dict(expected_version=1, fields=fields))
    add("processing", c.Processing, dict(operation_id="op_001", status="processing", poll_after_ms=2000))
    module_error = dict(code="PROVIDER_TIMEOUT", retryable=True, stage="brief", request_id="req_001")
    artifact = dict(
        brief=brief,
        brief_version=1,
        source_ticket_revision=1,
        model_name="demo-model",
        prompt_version="1",
        template_version="1",
        index_version="demo-v1",
        created_at=NOW,
    )
    for status in ("pending", "processing", "ready", "failed", "stale"):
        has_artifact = status in {"ready", "stale"}
        add(
            "brief_" + status,
            c.BriefEnvelope,
            dict(
                status=status,
                current_ticket_revision=2 if status == "stale" else 1,
                brief_version=1 if has_artifact else None,
                source_ticket_revision=1 if has_artifact else None,
                artifact=artifact if has_artifact else None,
                error=module_error if status == "failed" else None,
            ),
        )
    for code, retryable, details in [
        (
            "HANDOVER_FAILED",
            True,
            dict(
                conversation_id="conv_001", user_message_id="msg_001", ai_response_locked=True, handover_status="failed"
            ),
        ),
        ("STALE_REVISION", False, dict(current_revision=2)),
        ("AI_UNAVAILABLE", True, dict(user_message_id="msg_001")),
        ("PERSISTENCE_UNAVAILABLE", True, dict(handover_status="unknown")),
    ]:
        add(
            "error_" + code.lower(),
            c.ErrorEnvelope,
            dict(
                error=dict(
                    code=code,
                    message="Chưa hoàn tất thao tác; kiểm tra trạng thái trước khi thử lại.",
                    request_id="req_001",
                    retryable=retryable,
                    details=details,
                )
            ),
        )
    return cases


def openapi_document() -> dict:
    schemas = {}

    def ref(model):
        schema = model.model_json_schema(ref_template="#/components/schemas/{model}")
        schemas.update(schema.pop("$defs", {}))
        name = model.__name__.replace("[", "_").replace("]", "_")
        schemas[name] = schema
        return {"$ref": f"#/components/schemas/{name}"}

    # Include internal module types for the same canonical handoff bundle.
    for name in dir(c):
        model = getattr(c, name)
        if isinstance(model, type) and issubclass(model, c.Contract):
            ref(model)
    error = ref(c.ErrorEnvelope)
    paths = {}
    for method, path, request, status, response, idempotency in ENDPOINTS:
        parameters = []
        if "{id}" in path:
            parameters.append(
                dict(name="id", **{"in": "path"}, required=True, schema=dict(type="string", minLength=1, maxLength=128))
            )
        if idempotency:
            parameters.append(
                dict(
                    name="Idempotency-Key",
                    **{"in": "header"},
                    required=True,
                    schema=dict(type="string", minLength=1, maxLength=128),
                )
            )
        if response is not None and response.__name__.startswith("Page["):
            parameters.extend(
                [
                    dict(name="page", **{"in": "query"}, schema=dict(type="integer", minimum=1, default=1)),
                    dict(
                        name="page_size",
                        **{"in": "query"},
                        schema=dict(type="integer", minimum=1, maximum=100, default=20),
                    ),
                ]
            )
        if method == "get" and path in {"/tickets", "/officer/tickets"}:
            filters = dict(status=["open", "pending_officer", "resolved"])
            if path == "/officer/tickets":
                filters.update(priority=["normal", "high"], category=["action", "complaint"])
            parameters.extend(
                dict(name=key, **{"in": "query"}, schema=dict(type="string", enum=values))
                for key, values in filters.items()
            )
            parameters.append(dict(name="search", **{"in": "query"}, schema=dict(type="string", maxLength=100)))
        success = {"description": "Contract target; runtime implementation is separate."}
        if response:
            success["content"] = {"application/json": {"schema": ref(response)}}
        responses = {str(status): success}
        if idempotency and status != 202:
            responses["202"] = {
                "description": "Operation already processing; repeat same request/key after Retry-After.",
                "content": {"application/json": {"schema": ref(c.Processing)}},
                "headers": {"Retry-After": {"schema": {"type": "integer", "example": 2}}},
            }
        for code in (401, 403, 404, 409, 422, 429, 502, 503):
            responses[str(code)] = {
                "description": "See error.code and retryable; not every error applies to every endpoint.",
                "content": {"application/json": {"schema": error}},
            }
        for payload in responses.values():
            payload.setdefault("headers", {})["X-Request-Id"] = {
                "schema": {"type": "string"},
                "description": "Server correlation ID; not an idempotency key.",
            }
        operation = dict(
            operationId=method + "_" + path.strip("/").replace("/", "_").replace("{id}", "by_id"),
            parameters=parameters,
            responses=responses,
            security=[] if path == "/auth/demo-login" else [{"BearerSession": []}],
        )
        if request:
            operation["requestBody"] = {"required": True, "content": {"application/json": {"schema": ref(request)}}}
        paths.setdefault("/api/v1" + path, {})[method] = operation
    return dict(
        openapi="3.1.0",
        info=dict(title="Campus 24/7 P0 contract (not deployed API)", version=c.CONTRACT_VERSION),
        paths=paths,
        components=dict(schemas=schemas, securitySchemes=dict(BearerSession=dict(type="http", scheme="bearer"))),
    )


def artifacts() -> dict[str, dict]:
    return {
        "p0-v1.openapi.json": openapi_document(),
        "p0-v1.examples.json": {"contract_version": c.CONTRACT_VERSION, "cases": example_cases()},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for name, document in artifacts().items():
        content = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
        target = OUT / name
        if args.check:
            if not target.exists() or target.read_text(encoding="utf-8") != content:
                raise SystemExit(f"Contract artifact stale: {target}")
        else:
            OUT.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        print(f"{'Checked' if args.check else 'Generated'} {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
