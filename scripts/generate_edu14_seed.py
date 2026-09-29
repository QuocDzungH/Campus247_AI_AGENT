"""Generate deterministic, entirely fictional operational data for EDU-14."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from campus247.models.contracts_v1 import AuditEntry, Conversation, Message, Profile, Ticket, User

OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "backend"
    / "src"
    / "campus247"
    / "db"
    / "seed_data"
    / "edu14_demo.json"
)
TZ = timezone(timedelta(hours=7))
START = datetime(2026, 8, 31, 9, 0, tzinfo=TZ)

# Original Vietnamese demo requests. These do not represent real students or VinUni cases.
CERTIFICATES = [
    ("vay vốn học tập", "Ngân hàng mẫu A"),
    ("gia hạn giấy tạm trú", "Cơ quan hành chính mẫu B"),
    ("đăng ký thực tập", "Doanh nghiệp mẫu C"),
    ("làm hồ sơ học bổng ngoài trường", "Quỹ học bổng mẫu D"),
    ("bổ sung hồ sơ bảo hiểm", "Đơn vị bảo hiểm mẫu E"),
    ("xin visa du học trao đổi", "Cơ quan lãnh sự mẫu F"),
    ("đăng ký khóa học ngắn hạn", "Trung tâm đào tạo mẫu G"),
    ("hoàn thiện hồ sơ thuê nhà", "Đơn vị cho thuê mẫu H"),
    ("tham gia chương trình tình nguyện", "Tổ chức mẫu I"),
    ("nhận hỗ trợ chi phí đi lại", "Quỹ hỗ trợ mẫu J"),
    ("làm hồ sơ thực tập hè", "Doanh nghiệp mẫu K"),
    ("đăng ký cuộc thi học thuật", "Ban tổ chức mẫu L"),
    ("xác minh tình trạng đang học", "Đơn vị xác minh mẫu M"),
    ("hoàn thiện hồ sơ nhận tài trợ nghiên cứu", "Quỹ nghiên cứu mẫu N"),
    ("đăng ký chương trình trao đổi", "Trường đối tác mẫu O"),
    ("làm thủ tục miễn giảm phí", "Cơ quan hỗ trợ mẫu P"),
    ("bổ sung hồ sơ tuyển dụng bán thời gian", "Doanh nghiệp mẫu Q"),
    ("xác nhận để tham gia hội thảo", "Ban tổ chức mẫu R"),
]

COMPLAINTS = [
    "Em thấy điểm tổng kết môn học mẫu A trên cổng khác với phiếu đã được trả; nhờ cán bộ kiểm tra.",
    "Em muốn đề nghị xem lại kết quả bài thi môn học mẫu B vì có thể thiếu một trang bài làm.",
    "Kết quả phúc tra môn học mẫu C chưa được cập nhật như thông báo em đã nhận.",
    "Em thấy một học phần bị ghi thiếu tín chỉ sau khi kết quả được công bố.",
    "Em cần cán bộ xem lại quyết định học vụ vì dữ liệu học phần mẫu D có thể bị nhầm.",
    "Điểm chuyên cần môn học mẫu E hiển thị khác với bản ghi em được xem tại lớp.",
    "Em phản ánh kết quả học phần mẫu F bị gắn nhầm vào kỳ học khác.",
    "Em muốn được hướng dẫn nộp khiếu nại về kết quả thi môn học mẫu G.",
]

SUPPORT = [
    "Em đang rất căng thẳng vì chuyện học và muốn được cán bộ hỗ trợ liên hệ người phù hợp.",
    "Em cần nói chuyện riêng với người phụ trách hỗ trợ sinh viên về tình trạng hiện nay.",
    "Em gặp khó khăn tinh thần kéo dài và muốn được hướng dẫn tìm hỗ trợ trong trường.",
    "Em muốn được cán bộ liên hệ lại về một vấn đề sức khỏe tinh thần nhạy cảm.",
]


def iso(moment: datetime) -> str:
    return moment.isoformat(timespec="seconds")


def build() -> dict:
    users = []
    teams = [
        {"id": "academic", "name": "Học vụ demo", "is_demo": True},
        {"id": "student_support", "name": "Hỗ trợ sinh viên demo", "is_demo": True},
    ]
    officer_team_memberships = [
        {"user_id": "OF-DEMO-01", "team_id": "academic"},
        {"user_id": "OF-DEMO-02", "team_id": "student_support"},
        {"user_id": "OF-DEMO-03", "team_id": "academic"},
    ]
    profiles = []
    tickets = []
    conversations = []
    messages = []
    audits = []
    ticket_assignments = []

    for number in range(1, 31):
        student_id = f"SV-DEMO-{number:03d}"
        users.append(User(id=student_id, role="student", name=f"Sinh viên mẫu {number:03d}").model_dump(mode="json"))
        profiles.append(
            Profile(
                student_id=student_id,
                full_name=f"Sinh viên mẫu {number:03d}",
                mssv=f"DEMO-{number:03d}",
                faculty="Khoa mô phỏng",
                cohort="DEMO-2026",
                is_demo=True,
            ).model_dump(mode="json")
        )
    for number in range(1, 4):
        users.append(User(id=f"OF-DEMO-{number:02d}", role="officer", name=f"Cán bộ mẫu {number:02d}").model_dump(mode="json"))

    for number in range(1, 31):
        ticket_id = f"TKT-DEMO-2026-{number:04d}"
        conversation_id = f"CONV-DEMO-{number:04d}"
        student_id = f"SV-DEMO-{number:03d}"
        officer_id = "OF-DEMO-02" if number > len(CERTIFICATES) + len(COMPLAINTS) else (
            "OF-DEMO-01" if number % 2 else "OF-DEMO-03"
        )
        created = START + timedelta(days=number - 1, hours=(number - 1) % 5)
        updated = created + timedelta(hours=2)
        is_certificate = number <= len(CERTIFICATES)
        is_complaint = len(CERTIFICATES) < number <= len(CERTIFICATES) + len(COMPLAINTS)
        is_high = not is_certificate
        is_resolved = number % 5 == 0
        status = "resolved" if is_resolved else ("open" if is_certificate and number % 3 == 1 else "pending_officer")

        if is_certificate:
            purpose, destination = CERTIFICATES[number - 1]
            content = f"Em muốn xin giấy xác nhận đang học để {purpose}; nơi nhận là {destination}."
            service_type = "student_certificate"
            category = "action"
            request_data = {
                "purpose": purpose,
                "destination_org": destination,
                "receive_method": "digital_pdf" if number % 2 else "paper_stamped",
            }
            handover_reason = None
            priority_reasons = []
        elif is_complaint:
            content = COMPLAINTS[number - len(CERTIFICATES) - 1]
            service_type = "academic_complaint"
            category = "complaint"
            request_data = None
            handover_reason = "Có phản ánh về kết quả học vụ; cần cán bộ xem xét."
            priority_reasons = ["Khiếu nại học vụ cần chuyển cán bộ."]
        else:
            content = SUPPORT[number - len(CERTIFICATES) - len(COMPLAINTS) - 1]
            service_type = "student_support"
            category = "complaint"
            request_data = None
            handover_reason = "Yêu cầu hỗ trợ nhạy cảm; chuyển cán bộ phụ trách."
            priority_reasons = ["Tình huống hỗ trợ sinh viên cần người phụ trách xem xét."]

        tickets.append(
            Ticket(
                id=ticket_id,
                code=ticket_id,
                conversation_id=conversation_id,
                student_id=student_id,
                category=category,
                service_type=service_type,
                status=status,
                priority="high" if is_high else "normal",
                priority_reasons=priority_reasons,
                summary=content,
                request_data=request_data,
                handover_reason=handover_reason,
                assigned_officer_id=officer_id if status != "open" else None,
                revision=(4 if is_certificate else 3) if is_resolved else (
                    (3 if is_certificate else 2) if status == "pending_officer" else 1
                ),
                created_at=iso(created),
                updated_at=iso(created if status == "open" else updated if is_resolved else created + timedelta(minutes=2)),
            ).model_dump(mode="json")
        )
        conversations.append(
            Conversation(
                id=conversation_id,
                revision=2 if is_high else 1,
                ticket_id=ticket_id,
                status="closed" if is_resolved else ("handover" if is_high else "active"),
                ai_response_locked=is_high,
                handover_status="completed" if is_high else "none",
                created_at=iso(created),
                updated_at=iso(created if status == "open" else updated if is_resolved else created + timedelta(minutes=2)),
            ).model_dump(mode="json")
        )

        messages.append(
            Message(
                id=f"MSG-DEMO-{number:04d}-01", conversation_id=conversation_id,
                ticket_id=ticket_id, sender="student", content=content, created_at=iso(created),
            ).model_dump(mode="json")
        )
        messages.append(
            Message(
                id=f"MSG-DEMO-{number:04d}-02", conversation_id=conversation_id,
                ticket_id=ticket_id, sender="system",
                content="Đã ghi nhận yêu cầu và chuyển đến cán bộ phụ trách." if is_high else "Đã ghi nhận yêu cầu cấp giấy xác nhận.",
                created_at=iso(created + timedelta(seconds=5)),
            ).model_dump(mode="json")
        )
        audits.append(
            AuditEntry(
                id=f"AUD-DEMO-{number:04d}-01", ticket_id=ticket_id,
                actor_id=None if is_high else student_id,
                actor_type="system" if is_high else "student",
                action="handover" if is_high else "create",
                from_status=None, to_status="pending_officer" if is_high else "open",
                request_id=f"REQ-DEMO-{number:04d}", created_at=iso(created),
            ).model_dump(mode="json")
        )

        if status != "open":
            ticket_assignments.append(
                {
                    "ticket_id": ticket_id,
                    "team_id": "student_support" if service_type == "student_support" else "academic",
                    "officer_id": officer_id,
                    "assigned_by": officer_id,
                    "assigned_at": iso(created + timedelta(minutes=1)),
                    "is_demo": True,
                }
            )
            if is_certificate:
                audits.append(
                    AuditEntry(
                        id=f"AUD-DEMO-{number:04d}-02", ticket_id=ticket_id,
                        actor_id=officer_id, actor_type="officer", action="respond",
                        from_status="open", to_status="pending_officer", request_id=f"REQ-DEMO-{number:04d}-H",
                        created_at=iso(created + timedelta(minutes=2)),
                    ).model_dump(mode="json")
                )
                messages.append(
                    Message(
                        id=f"MSG-DEMO-{number:04d}-04", conversation_id=conversation_id,
                        ticket_id=ticket_id, sender="officer",
                        content="Cán bộ đã tiếp nhận và đang kiểm tra yêu cầu cấp giấy xác nhận.",
                        created_at=iso(created + timedelta(minutes=2)),
                    ).model_dump(mode="json")
                )
        if is_resolved:
            messages.append(
                Message(
                    id=f"MSG-DEMO-{number:04d}-03", conversation_id=conversation_id,
                    ticket_id=ticket_id, sender="officer",
                    content="Cán bộ đã tiếp nhận, xem xét và hoàn tất yêu cầu mô phỏng này.",
                    created_at=iso(updated),
                ).model_dump(mode="json")
            )
            audits.append(
                AuditEntry(
                    id=f"AUD-DEMO-{number:04d}-03", ticket_id=ticket_id,
                    actor_id=officer_id, actor_type="officer", action="resolve",
                    from_status="pending_officer", to_status="resolved", request_id=f"REQ-DEMO-{number:04d}-R",
                    created_at=iso(updated),
                ).model_dump(mode="json")
            )

    return {
        "metadata": {
            "dataset_id": "edu14-operational-demo-v1",
            "contract_version": "P0-contract-v1",
            "generated_at": "2026-09-29",
            "provenance": "Original, deterministic synthetic Vietnamese demo data; no imported records or real student identifiers.",
        },
        "users": users,
        "teams": teams,
        "officer_team_memberships": officer_team_memberships,
        "profiles": profiles,
        "conversations": conversations,
        "tickets": tickets,
        "ticket_assignments": ticket_assignments,
        "messages": messages,
        "audit_entries": audits,
    }


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
