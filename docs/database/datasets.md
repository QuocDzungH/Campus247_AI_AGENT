# EDU-14 — dữ liệu seed cho database nghiệp vụ

Tài liệu này khảo sát nguồn dataset công khai và mô tả seed vận hành. JSON seed nằm trong package backend [`edu14_demo.json`](../../backend/src/campus247/db/seed_data/edu14_demo.json). Tài liệu RAG sẽ xử lý riêng. Các collection nghiệp vụ tuân theo [`P0-contract-v1`](../../backend/src/campus247/models/contracts_v1.py); `teams` và `officer_team_memberships` là seed cho phân quyền backend.

## Dataset công khai đã kiểm tra (2026-09-29)

| Nguồn | Dữ liệu có sẵn | Quyền dùng ghi trên nguồn | Cách dùng cho EDU-14 |
|---|---|---|---|
| [University Student Support Ticket Dataset](https://www.kaggle.com/datasets/liamyyc/university-student-support-ticket-dataset) ([tải ZIP](https://www.kaggle.com/api/v1/datasets/download/liamyyc/university-student-support-ticket-dataset), [metadata](https://www.kaggle.com/api/v1/datasets/view/liamyyc/university-student-support-ticket-dataset)) | 5.000 ticket tiếng Anh tạo bằng AI; `Query_ID`, `Query_Text`, `Department` (7 nhóm), `Priority_Label`; `support_ticket_train.csv` 4.000 và `support_ticket_test.csv` 1.000 | CC BY 4.0 | Tham khảo tình huống, mapping phòng ban và ca ưu tiên. Cần biên tập tiếng Việt và kiểm tra nhãn trước khi dùng để đánh giá. |
| [Student Support Ticket Priority Prediction Dataset](https://www.kaggle.com/datasets/sgargi/student-support-ticket-priority-prediction-dataset) ([tải ZIP](https://www.kaggle.com/api/v1/datasets/download/sgargi/student-support-ticket-priority-prediction-dataset), [metadata](https://www.kaggle.com/api/v1/datasets/view/sgargi/student-support-ticket-priority-prediction-dataset)) | 5.000 câu hỏi tiếng Anh; `ID`, `Student_Query`, `Priority_Label`; `university_queries_train.csv` 4.000 và `university_queries_test.csv` 1.000 | MIT theo metadata Kaggle | Thêm ví dụ ưu tiên. Không có department, trạng thái, người phụ trách, message hay audit. |
| [UIT-VSFC](https://huggingface.co/datasets/uitnlp/vietnamese_students_feedback) | Phản hồi sinh viên tiếng Việt, nhãn sentiment và topic | Dataset card ghi `unknown` | Chỉ tham khảo ngôn ngữ/intent; không phải ticket và không nhập vào database vận hành. |

Hai bộ Kaggle không phải dữ liệu của VinUni, đều dùng nhãn `High/Medium/Low` khác contract P0 (`high/normal`). Không chuyển nguyên bản ghi hoặc nhãn vào database nghiệp vụ. Ticket của hệ thống còn cần xác nhận của sinh viên, trạng thái, người xử lý, lịch sử hội thoại và audit; những trường này không thể suy ra từ CSV nguồn.

## Seed có thể dùng ngay

[`edu14_demo.json`](../../backend/src/campus247/db/seed_data/edu14_demo.json) là **dữ liệu giả hoàn toàn**, được viết độc lập bằng tiếng Việt; không sao chép bản ghi Kaggle và không chứa MSSV, email hay hồ sơ thật. Nội dung gồm:

| Collection | Số bản ghi | Vai trò |
|---|---:|---|
| `users` | 33 | 30 sinh viên và 3 cán bộ mẫu |
| `teams` | 2 | Học vụ và hỗ trợ sinh viên, tách hàng chờ |
| `officer_team_memberships` | 3 | OF-DEMO-01/03 thuộc học vụ; OF-DEMO-02 thuộc hỗ trợ sinh viên |
| `profiles` | 30 | Hồ sơ demo, `is_demo=true` |
| `conversations` | 30 | Trạng thái chat và khóa L4 |
| `tickets` | 30 | 18 yêu cầu giấy xác nhận, 8 khiếu nại học vụ, 4 yêu cầu hỗ trợ nhạy cảm |
| `ticket_assignments` | 25 | Lịch sử cán bộ demo đã nhận ca của ticket không còn `open` |
| `messages` | 2–4 mỗi ticket | Lời sinh viên, biên nhận hệ thống, phản hồi cán bộ khi có |
| `audit_entries` | 1–3 mỗi ticket | Tạo, bàn giao/tiếp nhận, hoàn tất |

Mọi timestamp theo ISO 8601 có múi giờ `+07:00`. ID mang tiền tố `DEMO`; các tên tổ chức và môn học là hư cấu. Ca `academic_complaint` và `student_support` có ưu tiên `high`, được bàn giao và khóa phản hồi AI. Ca `student_certificate` có đủ `purpose`, `destination_org`, `receive_method` trong `request_data`.

Ticket `student_support` chỉ gán cho `OF-DEMO-02`; ticket còn lại chỉ gán cho `OF-DEMO-01/03`. Bản ghi `ticket_assignments` mô tả ca demo đã được cán bộ nhận; ticket `open` chưa gán. Backend vẫn phải kiểm tra membership khi đọc/ghi; dữ liệu seed không thay thế phân quyền runtime.

Thứ tự nhập nếu dùng bảng quan hệ: `users`, `teams` → `profiles`, `officer_team_memberships` → `conversations` → `tickets` → `ticket_assignments`, `messages`, `audit_entries`. JSON seed có cả `conversations.ticket_id` và `tickets.conversation_id` theo contract. Khi thiết kế SQL, nên lưu một FK `tickets.conversation_id` duy nhất và suy ra `Conversation.ticket_id` lúc trả API, tránh vòng tham chiếu. Không lưu `metadata` thành bảng nghiệp vụ.

Tạo lại seed bằng lệnh:

```bash
.venv/bin/python -m scripts.generate_edu14_seed
```

Lệnh ghi đè `backend/src/campus247/db/seed_data/edu14_demo.json`. `python -m campus247.db.seed` đọc file này khi nạp dữ liệu demo.
