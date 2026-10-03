"""Course-recognition review cases. AI does not invent SIS/OCR evidence."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from campus247.db.models import ReviewCase, ReviewCodeSequence, StudentProfile, User
from campus247.models import contracts_v1 as c
from campus247.services.access import require_officer, require_student
from campus247.services.common import lock_select, new_id, paginate, parse_page, stale_revision, utcnow
from campus247.services.errors import forbidden, not_found, validation
from campus247.services.serializers import ensure_utc

DEFAULT_CRITERIA = [
    {
        "id": "crit-1",
        "code": "C1_CREDITS",
        "category": "credit",
        "title": "Số tín chỉ và thời lượng học phần",
        "description": "Học phần tích lũy phải có số tín chỉ tối thiểu bằng học phần tại trường tiếp nhận.",
        "targetRequirement": "Đối chiếu số tín chỉ trên chứng từ do sinh viên nộp; chưa xác minh nếu thiếu bảng điểm chính thức.",
        "isMandatory": True,
    },
    {
        "id": "crit-2",
        "code": "C2_CODE_CONSISTENCY",
        "category": "prerequisite",
        "title": "Tính nhất quán mã và tên học phần",
        "description": "Mã và tên trên bảng điểm phải khớp đề cương đính kèm.",
        "targetRequirement": "Chứng từ bảng điểm và đề cương phải cùng một học phần hoặc có xác nhận tương đương.",
        "isMandatory": True,
    },
    {
        "id": "crit-3",
        "code": "C3_CORE_CONTENT",
        "category": "core_content",
        "title": "Nội dung cốt lõi",
        "description": "Đề cương phải phủ nội dung bắt buộc của học phần tiếp nhận.",
        "targetRequirement": "Cán bộ đối chiếu đề cương đã nộp với chuẩn học phần; AI không tự công nhận.",
        "isMandatory": True,
    },
    {
        "id": "crit-4",
        "code": "C4_LAB_PRACTICE",
        "category": "lab_practice",
        "title": "Thực hành",
        "description": "Có cấu phần thực hành nếu học phần tiếp nhận yêu cầu.",
        "targetRequirement": "Ghi nhận từ đề cương/bảng điểm đã nộp, chưa từ SIS.",
        "isMandatory": True,
    },
    {
        "id": "crit-5",
        "code": "C5_LEARNING_OUTCOMES",
        "category": "learning_outcomes",
        "title": "Chuẩn đầu ra",
        "description": "Chuẩn đầu ra môn học phải đủ căn cứ để đề xuất công nhận.",
        "targetRequirement": "Cán bộ ghi nhận sau khi đọc đề cương; chưa có connector chuẩn đầu ra.",
        "isMandatory": False,
    },
]


def next_review_code(session: Session, year: int) -> str:
    stmt = lock_select(session, select(ReviewCodeSequence).where(ReviewCodeSequence.year == year))
    seq = session.execute(stmt).scalar_one_or_none()
    if seq is None:
        seq = ReviewCodeSequence(year=year, last_value=0)
        session.add(seq)
        session.flush()
        seq = session.execute(
            lock_select(session, select(ReviewCodeSequence).where(ReviewCodeSequence.year == year))
        ).scalar_one()
    seq.last_value += 1
    return f"REV-{year}-{seq.last_value:04d}"


def _visible(session: Session, actor: User, case_id: str) -> ReviewCase:
    row = session.get(ReviewCase, case_id)
    if row is None:
        row = session.execute(select(ReviewCase).where(ReviewCase.code == case_id)).scalar_one_or_none()
    if row is None:
        raise not_found()
    if actor.role == "student" and row.student_id != actor.id:
        raise not_found()
    if actor.role == "officer":
        return row
    if actor.role == "student":
        return row
    raise forbidden()


def _view(row: ReviewCase) -> c.ReviewCaseView:
    return c.ReviewCaseView(
        id=row.id,
        code=row.code,
        status=row.status,  # type: ignore[arg-type]
        student_id=row.student_id,
        officer_id=row.officer_id,
        revision=row.revision,
        created_at=ensure_utc(row.created_at),
        updated_at=ensure_utc(row.updated_at),
        payload=dict(row.payload or {}),
    )


def _touch(row: ReviewCase) -> None:
    now = utcnow()
    row.updated_at = now
    row.revision += 1
    payload = dict(row.payload or {})
    payload["updatedAt"] = now.isoformat()
    payload["status"] = row.status
    payload["revision"] = row.revision
    row.payload = payload


def _audit(payload: dict, actor: User, action: str, details: str | None = None) -> None:
    logs = list(payload.get("auditLogs") or [])
    logs.append(
        {
            "id": new_id("rva"),
            "timestamp": utcnow().isoformat(),
            "actorName": actor.name,
            "actorRole": actor.role if actor.role in {"officer", "student"} else "system",
            "action": action,
            "details": details,
        }
    )
    payload["auditLogs"] = logs


def list_review_cases(session: Session, actor: User, page: int | None, page_size: int | None) -> c.Page[c.ReviewCaseView]:
    page, page_size = parse_page(page, page_size)
    query = select(ReviewCase)
    if actor.role == "student":
        query = query.where(ReviewCase.student_id == actor.id)
    elif actor.role == "officer":
        pass
    else:
        raise forbidden()
    total = session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = (
        session.execute(
            query.order_by(ReviewCase.updated_at.desc(), ReviewCase.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    return paginate([_view(row) for row in rows], total, page, page_size)


def get_review_case(session: Session, actor: User, case_id: str) -> c.ReviewCaseView:
    if actor.role not in {"student", "officer"}:
        raise forbidden()
    return _view(_visible(session, actor, case_id))


def create_review_case(session: Session, actor: User, body: c.ReviewCaseCreate) -> c.ReviewCaseView:
    require_officer(actor)
    student = session.get(User, body.student_id)
    if student is None or student.role != "student":
        raise validation("Không tìm thấy sinh viên với mã đã nhập.")
    profile = session.get(StudentProfile, student.id)
    now = utcnow()
    case_id = new_id("rev")
    code = next_review_code(session, now.year)
    criteria = [dict(item) for item in DEFAULT_CRITERIA]
    payload = {
        "id": case_id,
        "code": code,
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
        "status": "in_review",
        "revision": 1,
        "studentId": student.id,
        "studentName": student.name,
        "studentMssv": (profile.mssv if profile else None) or "",
        "studentMajor": (profile.major if profile else None) or "",
        "studentClassYear": (profile.class_year if profile else None) or "",
        "studentEmail": (profile.email if profile else None) or (student.email or ""),
        "targetCourseCode": body.target_course_code,
        "targetCourseName": body.target_course_name,
        "targetCourseCredits": body.target_course_credits,
        "targetDepartment": body.target_department or "",
        "priorCourseCode": body.prior_course_code,
        "priorCourseName": body.prior_course_name,
        "priorCourseCredits": body.prior_course_credits,
        "priorInstitution": body.prior_institution or "",
        "priorAcademicYear": body.prior_academic_year or "",
        "priorGrade": body.prior_grade or "",
        "criteriaSetId": body.criteria_set_id or "standard",
        "criteriaSetName": body.criteria_set_name or "Bộ tiêu chí công nhận học phần",
        "criteria": criteria,
        "documents": [],
        "aiStatus": "idle",
        "aiSummary": {
            "overallRecommendation": "Chưa đủ căn cứ từ nguồn chính thức.",
            "totalCriteria": len(criteria),
            "matchCount": 0,
            "differenceCount": 0,
            "insufficientCount": len(criteria),
            "contradictionCount": 0,
            "isStale": False,
        },
        "findings": [],
        "supplementRequests": [],
        "auditLogs": [],
    }
    _audit(payload, actor, "Tạo hồ sơ rà soát", "Hồ sơ lưu trên máy chủ; chưa công nhận học phần.")
    row = ReviewCase(
        id=case_id,
        code=code,
        student_id=student.id,
        officer_id=actor.id,
        status="in_review",
        revision=1,
        payload=payload,
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _view(row)


def run_ai_review(session: Session, actor: User, case_id: str) -> c.ReviewCaseView:
    require_officer(actor)
    row = _visible(session, actor, case_id)
    if row.status == "completed":
        raise validation("Hồ sơ đã hoàn tất phiếu đề xuất.")
    payload = dict(row.payload or {})
    criteria = list(payload.get("criteria") or DEFAULT_CRITERIA)
    existing = {item.get("criterionId"): item for item in payload.get("findings") or [] if isinstance(item, dict)}
    findings = []
    for crit in criteria:
        previous = existing.get(crit.get("id")) or {}
        findings.append(
            {
                "id": previous.get("id") or new_id("fnd"),
                "criterionId": crit.get("id"),
                "criterionTitle": crit.get("title"),
                "category": crit.get("category"),
                "targetRequirement": crit.get("targetRequirement"),
                "extractedEvidence": "Chưa có connector bảng điểm/đề cương chính thức. Không dùng dữ liệu mô phỏng làm bằng chứng.",
                "citations": [],
                "aiLabel": "insufficient_evidence",
                "aiExplanation": "Kho tài liệu vận hành chưa có đề cương/bảng điểm đã phê duyệt để đối chiếu tự động. Cán bộ đối chiếu thủ công các tệp sinh viên nộp.",
                "aiSuggestedAction": "Đối chiếu chứng từ đã nộp, ghi nhận từng tiêu chí, yêu cầu bổ sung nếu thiếu.",
                "officerStatus": previous.get("officerStatus") or "unverified",
                "officerAdjustedLabel": previous.get("officerAdjustedLabel"),
                "officerNote": previous.get("officerNote"),
            }
        )
    payload["findings"] = findings
    payload["aiStatus"] = "ready"
    payload["aiLastRunAt"] = utcnow().isoformat()
    payload["aiSummary"] = {
        "overallRecommendation": "Chưa đủ căn cứ từ nguồn chính thức; cần cán bộ đối chiếu.",
        "totalCriteria": len(findings),
        "matchCount": 0,
        "differenceCount": 0,
        "insufficientCount": len(findings),
        "contradictionCount": 0,
        "isStale": False,
    }
    _audit(payload, actor, "Chạy rà soát AI", "Kết quả insufficient_evidence vì chưa có SIS/OCR.")
    row.payload = payload
    _touch(row)
    session.commit()
    session.refresh(row)
    return _view(row)


def update_finding(
    session: Session, actor: User, case_id: str, finding_id: str, body: c.ReviewFindingPatch
) -> c.ReviewCaseView:
    require_officer(actor)
    row = _visible(session, actor, case_id)
    if body.expected_revision is not None and body.expected_revision != row.revision:
        raise stale_revision(row.revision)
    if row.status == "completed":
        raise validation("Hồ sơ đã hoàn tất phiếu đề xuất.")
    payload = dict(row.payload or {})
    findings = list(payload.get("findings") or [])
    found = False
    for item in findings:
        if item.get("id") != finding_id and item.get("criterionId") != finding_id:
            continue
        item["officerStatus"] = body.officer_status
        if body.officer_adjusted_label is not None:
            item["officerAdjustedLabel"] = body.officer_adjusted_label
        if body.officer_note is not None:
            item["officerNote"] = body.officer_note
        item["officerReviewedAt"] = utcnow().isoformat()
        item["officerReviewedBy"] = actor.id
        found = True
        break
    if not found:
        raise not_found()
    payload["findings"] = findings
    _audit(payload, actor, "Cập nhật tiêu chí", finding_id)
    row.payload = payload
    _touch(row)
    session.commit()
    session.refresh(row)
    return _view(row)


def send_supplement(
    session: Session, actor: User, case_id: str, body: c.ReviewSupplementRequest
) -> c.ReviewCaseView:
    require_officer(actor)
    row = _visible(session, actor, case_id)
    if body.expected_revision is not None and body.expected_revision != row.revision:
        raise stale_revision(row.revision)
    payload = dict(row.payload or {})
    request = {
        "id": new_id("sup"),
        "createdAt": utcnow().isoformat(),
        "sentAt": utcnow().isoformat(),
        "sentBy": actor.id,
        "targetStudentId": row.student_id,
        "status": "sent",
        "subject": body.subject,
        "messageBody": body.message_body,
        "requestedDocuments": list(body.requested_documents),
        "findingsInvolved": list(body.findings_involved),
    }
    payload["supplementRequests"] = list(payload.get("supplementRequests") or []) + [request]
    _audit(payload, actor, "Yêu cầu bổ sung")
    row.payload = payload
    row.status = "waiting_supplement"
    _touch(row)
    session.commit()
    session.refresh(row)
    return _view(row)


def submit_student_supplement(
    session: Session, actor: User, case_id: str, body: c.ReviewStudentSupplement
) -> c.ReviewCaseView:
    require_student(actor)
    row = _visible(session, actor, case_id)
    payload = dict(row.payload or {})
    requests = list(payload.get("supplementRequests") or [])
    target = None
    for item in reversed(requests):
        if item.get("status") == "sent":
            target = item
            break
    if target is None:
        raise validation("Không có yêu cầu bổ sung đang mở.")
    target["status"] = "responded"
    target["studentReply"] = {
        "submittedAt": utcnow().isoformat(),
        "note": body.note,
        "supplementedDocumentIds": [],
        "docTitle": body.doc_title,
        "fileName": body.file_name,
    }
    payload["supplementRequests"] = requests
    payload["aiStatus"] = "stale_needs_update"
    payload["aiSummary"] = {
        **dict(payload.get("aiSummary") or {}),
        "isStale": True,
        "staleReason": "Sinh viên đã nộp bổ sung; cần cán bộ xem lại tiêu chí.",
    }
    _audit(payload, actor, "Nộp bổ sung")
    row.payload = payload
    row.status = "in_review"
    _touch(row)
    session.commit()
    session.refresh(row)
    return _view(row)


def finalize_review(session: Session, actor: User, case_id: str, body: c.ReviewFinalize) -> c.ReviewCaseView:
    require_officer(actor)
    row = _visible(session, actor, case_id)
    if body.expected_revision != row.revision:
        raise stale_revision(row.revision)
    payload = dict(row.payload or {})
    payload["finalReport"] = {
        "completedAt": utcnow().isoformat(),
        "officerId": actor.id,
        "officerName": actor.name,
        "decisionRecommendation": body.decision_recommendation,
        "conclusionSummary": body.conclusion_summary,
        "disclaimer": "Phiếu đề xuất của cán bộ. Chưa phải quyết định công nhận học phần đã ký.",
    }
    _audit(payload, actor, "Hoàn tất phiếu đề xuất")
    row.payload = payload
    row.status = "completed"
    _touch(row)
    session.commit()
    session.refresh(row)
    return _view(row)
