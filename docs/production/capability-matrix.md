# Ma trận chức năng Campus 24/7 (vận hành)

Nguồn sự thật: backend + DB. Mock chỉ dùng khi `NEXT_PUBLIC_DATA_MODE=mock` (kiểm thử độc lập).

| Chức năng | Endpoint / CLI | Bảng / storage | Quyền | Agent/worker | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| Đăng nhập mật khẩu | POST `/api/v1/auth/login` | `users`, `sessions`, `login_throttles`, `auth_events` | identifier + Argon2id | không | Đã triển khai |
| Demo-login | POST `/api/v1/auth/demo-login` | `sessions` | `is_demo`, tắt khi production / `DEMO_AUTH_ENABLED=false` | không | Chỉ dev |
| Đổi mật khẩu | POST `/api/v1/auth/change-password` | `users.password_hash`, thu hồi phiên khác | chính chủ | không | Đã triển khai |
| Reset do admin | CLI `issue-reset-token` + POST `/auth/reset-password` | `password_reset_tokens` | admin cấp token 30 phút | không | Chưa SMTP |
| Hồ sơ /me | GET `/api/v1/me`, `/me/profile` | `users`, `student_profiles` | sinh viên xem hồ sơ mình | không | Đã triển khai |
| Import sinh viên | `campus247-admin import-students` | `users`, `student_profiles` | CLI; `verification_status=imported` | không | Khung CSV; cần danh sách trường |
| Chat L1–L4 | POST `/conversations/{id}/messages` | `conversations`, `messages` | sinh viên chủ cuộc thoại | CampusAgent khi `AGENT_MODE=langgraph` | Đã nối API |
| Preview / Submit 1 | PATCH `/previews/{id}`, POST `/tickets` | `previews`, `tickets`, `intake_packets` | sinh viên | prepare_brief job | Đã nối API |
| Form VinUni (field phụ) | POST `/api/v1/forms` | `tickets.request_data.extras` | sinh viên | prepare_brief | Đã triển khai |
| Tệp đính kèm | POST/GET `/tickets/{id}/attachments` | `ticket_attachments` + `FILES_DIR` | chủ hồ sơ / cán bộ đúng team | không | Lưu đĩa local; chưa object storage |
| Hàng chờ / claim / Submit 2 | `/officer/tickets*` | `tickets`, `officer_actions` | cán bộ team; admin 403 | brief L3 | Đã nối API |
| Nháp / checklist cán bộ | PATCH `/officer/tickets/{id}/workspace` | `tickets.officer_draft`, `officer_checklist` | cán bộ | không ghi đè brief AI | Đã triển khai |
| Review học phần | `/api/v1/reviews*` | `review_cases` | cán bộ tạo/ghi nhận; sinh viên xem hồ sơ mình | AI chỉ insufficient_evidence khi chưa có SIS/OCR | Đã nối API; phiếu đề xuất chưa phải quyết định đã ký |
| RAG demo | `RAG_MODE=corpus` | packaged `demo_academic_v1.json` | retrieval | CampusAgent | Demo, không phải quy chế trường |
| RAG hybrid | `RAG_MODE=pipeline` | Markdown `RAG/data/processed` + cache `data/rag_index` | Gemini embedding + BM25 + RRF | CampusAgent L1/L3 | Không Chroma; fail-closed nếu Gemini embedding/normalize lỗi |
| RAG official | `RAG_MODE=official` + `ingest-document` | `data/corpus_official/index.json` | chỉ `approved` | CampusAgent | Khung ingest; chưa có tài liệu trường |
| Đối soát cấp giấy | POST `/tickets/{id}/verifications` | `tickets.system_verifications` | cán bộ team | không bịa SIS | insufficient cho tới khi có connector |
| Giấy đã ký / SMTP / SSO | — | — | — | — | Chưa hạ tầng |
