# Quy ước Quản trị Nhật ký AI (AI Logs) – Campus 24/7

> **Chủ trì quy ước**: Hoàng Quốc Dũng
>
> **Phạm vi áp dụng**: Tất cả thành viên, từ Gate 1 đến Gate 3
>
> **Mục tiêu**: Minh bạch AI đã hỗ trợ phần nào và con người đã kiểm chứng, sửa đổi, chịu trách nhiệm ra sao.

---

## 1. Hai loại log trong repository

| Vị trí | Mục đích | Có commit không? |
|---|---|---|
| `ai-logs/*.md` | Nhật ký dễ đọc, gắn với một công việc/deliverable cụ thể | Có, sau khi đã loại secret và dữ liệu cá nhân |
| `.ai-log/session.jsonl` | Log kỹ thuật do hook của công cụ AI ghi và gửi tới hệ thống chấm | Không; file này đã được `.gitignore` |

Hai loại log bổ sung cho nhau. Log tự động không thay thế phần **Human Verification & Edits** trong nhật ký Markdown.

## 2. Khi nào phải tạo AI Log

Tạo một file log khi AI có ảnh hưởng đáng kể đến sản phẩm, ví dụ:

- phân tích yêu cầu, lựa chọn phạm vi hoặc đưa ra quyết định kiến trúc;
- soạn/chỉnh Brief, PRD, UI flow, schema, API contract hoặc tài liệu thuyết trình;
- sinh hoặc sửa mã nguồn, test, dữ liệu đánh giá và cấu hình triển khai;
- đề xuất router `lookup/action/sensitive`, RAG, guardrail hoặc tiêu chí đánh giá;
- kết quả AI bị bác bỏ vì sai, thiếu nguồn hoặc không an toàn nhưng phát hiện đó làm thay đổi hướng thực hiện.

Không cần tạo file riêng cho sửa chính tả nhỏ, định dạng đơn thuần hoặc câu hỏi không tạo ra thay đổi trong deliverable. Có thể gộp nhiều lượt hỏi liên tiếp phục vụ cùng một mục tiêu vào một log.

## 3. Nội dung bắt buộc

Mỗi log phải dùng [template.md](template.md) và trả lời được:

1. Ai dùng công cụ AI nào, vào ngày nào, cho deliverable nào?
2. Mục tiêu và tóm tắt prompt là gì?
3. AI đã đề xuất gì và phần nào thực sự được sử dụng?
4. Thành viên kiểm chứng bằng tài liệu, test hoặc review nào?
5. AI sai/thiếu ở đâu, con người đã sửa gì và ai chịu trách nhiệm quyết định cuối?
6. File, issue, pull request hoặc commit nào liên quan?

Tên công cụ/model ghi theo thông tin người dùng nhìn thấy tại thời điểm làm việc. Nếu không biết chính xác phiên bản model, ghi `Không xác định` thay vì đoán. Mỗi thành viên có thể dùng công cụ khác nhau; quy ước đánh giá dựa trên **mức độ kiểm chứng**, không dựa trên thương hiệu công cụ.

## 4. Bảo mật và quyền riêng tư

Tuyệt đối không đưa vào prompt hoặc log:

- API key, token, mật khẩu, nội dung `.env`, private key hoặc thông tin đăng nhập;
- MSSV, email, số điện thoại, hồ sơ học tập hay nội dung tư vấn thật của sinh viên;
- dữ liệu nội bộ không được phép công khai hoặc toàn bộ hội thoại nhạy cảm;
- chain-of-thought nội bộ của mô hình.

Dùng dữ liệu giả như `SV001`, che thông tin nhận dạng và chỉ lưu tóm tắt cần thiết. Nếu phát hiện secret hoặc dữ liệu cá nhân, dừng commit, xóa khỏi file và báo người phụ trách repo để xử lý lịch sử Git khi cần.

## 5. Quy trình thực hiện và review

1. Sao chép [template.md](template.md) thành `YYYY-MM-DD_<member>_<task-name>.md`.
2. Điền log ngay sau phiên làm việc, trước khi quên các bước kiểm chứng hoặc chỉnh sửa.
3. Rà secret/PII, link bằng chứng và trạng thái kiểm chứng.
4. Commit log cùng deliverable; nếu chưa có commit hash, điền branch/PR trước rồi cập nhật hash ở commit kế tiếp.
5. Người thực hiện chịu trách nhiệm nội dung cuối. Với quyết định ảnh hưởng phạm vi, an toàn hoặc dữ liệu, cần thêm một thành viên review và ghi tên trong log.

Ví dụ tên file:

```text
ai-logs/2026-09-20_dung-hq_rag-guardrails.md
ai-logs/2026-09-20_vinh-dx_ui-flow-review.md
```

## 6. Cách kiểm chứng theo loại công việc

| Loại đầu ra AI | Bằng chứng kiểm chứng tối thiểu |
|---|---|
| Yêu cầu sản phẩm/tài liệu | Đối chiếu brief, tài liệu tham chiếu và checklist Gate |
| RAG/citation | Đối chiếu chunk với nguồn gốc; chạy bộ câu hỏi vàng khi đã có pipeline |
| Tool/API | Review schema, quyền, bước confirmation; chạy test thành công và lỗi |
| Guardrail/HITL | Chạy case nhạy cảm, prompt injection và case vượt quyền |
| Mã nguồn | Review diff, lint/test và kiểm tra secret |
| UI/UX | Đối chiếu user flow, accessibility và review chéo với PRD |

Không ghi “đã kiểm chứng” nếu mới chỉ đọc lại đầu ra AI. Nếu chưa thể chạy test ở Gate 1, ghi rõ `Chưa kiểm chứng bằng triển khai` và nêu kế hoạch kiểm chứng ở Gate 2.

## 7. Checklist trước khi commit

- [ ] Tên file đúng quy ước và không trùng log khác.
- [ ] Không có secret, PII hoặc dữ liệu sinh viên thật.
- [ ] Prompt được tóm tắt đủ để hiểu mục tiêu, không chép hội thoại dài.
- [ ] Phân biệt rõ đề xuất của AI, phần được giữ và phần con người sửa/bác bỏ.
- [ ] Có bằng chứng kiểm chứng hoặc ghi rõ giới hạn chưa kiểm chứng.
- [ ] Có người chịu trách nhiệm quyết định cuối và liên kết deliverable.

