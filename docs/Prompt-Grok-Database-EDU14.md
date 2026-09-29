# Prompt cho Grok — triển khai database Campus 24/7 (EDU-14)

Sao chép toàn bộ nội dung từ **BẮT ĐẦU PROMPT** đến **KẾT THÚC PROMPT** và đưa cho Grok cùng quyền truy cập repository này.

## BẮT ĐẦU PROMPT

Bạn là kỹ sư backend phụ trách xây lớp database vận hành hoàn chỉnh cho Campus 24/7 (EDU-14 / P-120) trong repository hiện tại. Hãy **triển khai code, migration, seed, kiểm thử và hướng dẫn chạy**; không chỉ trả sơ đồ SQL hoặc kế hoạch. Làm việc trên các file hiện có, giữ contract API/Pydantic P0. Trước khi sửa, kiểm tra `git status` và không ghi đè thay đổi của người khác.

### 1. Đọc nguồn chuẩn theo thứ tự

1. `docs/Quy-uoc-ky-thuat-P0-va-phan-cong.md`, đặc biệt mục 3, 6–8, 13–19. Đây là quyết định nghiệp vụ và transaction P0 có hiệu lực.
2. `src/models/contracts_v1.py`, `src/models/ports_v1.py`, `docs/contracts/p0-v1.openapi.json`, `docs/contracts/p0-v1.examples.json`. Đây là wire contract; OpenAPI/examples được sinh từ schema, không sửa tay.
3. `ARCHITECTURE.md`, nhất là phần hiện trạng, kiến trúc đích và mô hình dữ liệu; `docs/Pipeline-L2-L3-L4.md`.
4. `datasets/README.md`, `datasets/edu14_demo.json`, `scripts/generate_edu14_seed.py`. Đây là seed giả lập do dự án sở hữu, không phải CSDL trường thật.
5. `src/config.py`, `src/main.py`, `src/api/routes.py`, `requirements.txt`, `docker-compose.yml`, `.env.example`, tests hiện có.

Nếu tài liệu cũ hoặc mock frontend khác contract P0, dùng contract P0. Riêng các quyết định mới của chủ dự án bên dưới được ưu tiên so với lựa chọn hạ tầng P0 cũ.

### 2. Quyết định đã chốt và ranh giới

- **PostgreSQL là database chính** cho môi trường tích hợp/deploy và kiểm thử transaction/concurrency. **SQLite là lựa chọn chạy local** bằng cấu hình, dùng cùng ORM/migration nếu khả thi. Các bảo đảm về row lock/worker lease phải được kiểm thử trên PostgreSQL; giải thích rõ giới hạn SQLite.
- Đợt này triển khai dữ liệu phục vụ **L1–L4 hiện tại**: chat/tra cứu, preview xin giấy, Submit 1, hàng chờ/hồ sơ cán bộ, Submit 2, L4 handover. Schema được mở rộng hợp lý cho tăng trưởng nhưng **chưa triển khai đặt phòng/lịch, bảng điểm, thanh toán, cấp/ký PDF chính thức hoặc RAG ingestion/vector DB**.
- Chỉ dùng **tài khoản demo**, có trường nullable để sau này liên kết SSO. Không tạo mật khẩu thật hoặc nhập dữ liệu cá nhân thật.
- Tệp đính kèm: **chỉ metadata và quan hệ**, chưa làm endpoint upload hoặc lưu blob trong DB.
- Ticket vào hàng chờ theo **team**; cán bộ có quyền trong team mới được nhận ca. `academic` và `student_support` phải tách phạm vi; ca wellbeing không hiện trong hàng chờ học vụ. Cán bộ nhận ca bằng thao tác rõ ràng, không tự gán ngẫu nhiên lúc tạo ticket. Bổ sung endpoint nhận ca theo cách cộng thêm vào contract P0, không đổi ngữ nghĩa endpoint cũ.
- Dữ liệu từ hai Kaggle trong `datasets/README.md` chỉ là nguồn tham khảo/benchmark. Không đổ 10.000 dòng tiếng Anh vào bảng ticket vận hành, không đổi nhãn `High/Medium/Low` trực tiếp thành `high/normal` khi chưa đánh giá. Dùng `datasets/edu14_demo.json` làm seed chính, bảo toàn dấu `is_demo` và provenance.
- Backend là nguồn sự thật. Frontend mock/localStorage không phải chứng cứ đã commit. AI chỉ đề xuất; các thao tác Submit 1/Submit 2 và chuyển trạng thái phải do backend kiểm soát.

### 3. Thiết kế database ở mức đủ dùng cho dự án

Trước khi viết migration, tạo `docs/database/README.md` gồm ERD Mermaid, bảng/khóa/quan hệ, chỉ mục, quy tắc giữ dữ liệu và bảng ánh xạ từ Pydantic/OpenAPI sang SQL. Sau đó triển khai các nhóm bảng sau (được phép gộp hợp lý nếu giải thích rõ, nhưng không bỏ mất khả năng nghiệp vụ):

**Identity và phạm vi:**

- `users`: id chuỗi ổn định, role `student|officer`, tên demo, `is_demo`, `external_subject` nullable/unique để gắn SSO sau này, created/updated; không lưu mật khẩu.
- `student_profiles`: 1–1 user, MSSV demo, khoa, khóa, dữ liệu hồ sơ cần cho prefill. Seed là dữ liệu giả, không đưa điểm/hồ sơ thật.
- `teams`, `officer_team_memberships`: scope `academic` và `student_support`; membership có thời điểm hiệu lực nếu hữu ích. `tickets.team_id` là routing đã được backend kiểm tra từ service/risk, không lấy thẳng từ model/client.
- Session demo/token server-side nếu cần để hiện thực bearer session trong P0; lưu hash token và thời hạn, không lưu plaintext token. Nếu phần auth chưa được giao triển khai, tạo interface rõ và ít nhất kiểm thử ownership/scope bằng actor giả lập ở service.

**Hội thoại và yêu cầu:**

- `conversations`: chủ sở hữu, status, `ai_response_locked`, `handover_status`, revision, created/updated. Một conversation chỉ có tối đa một ticket đang liên kết theo P0.
- `messages`: conversation FK, ticket FK nullable trước Submit 1/L4, sender, sender user FK nullable, nội dung, thời gian, thứ tự ổn định. Có thể thêm `message_citations` chỉ để lưu metadata nguồn của câu trả lời L1; không xây RAG corpus.
- `previews`: owner/conversation, loại dịch vụ, 3 field `purpose`, `destination_org`, `receive_method`, version, expires_at, trạng thái active/consumed/invalidated, consumed ticket FK nullable. Quy tắc hết hạn 30 phút và consume một lần. Lưu lịch sử version/snapshot nếu cần audit và giải thích cách replay.
- `intake_operations`/`safety_decisions` hoặc cấu trúc tương đương: theo dõi một lượt intake duy nhất mỗi conversation, request/key, trạng thái, message đã lưu, kết quả route/risk, lock và khả năng phục hồi sau crash. Phải ngăn Submit 1 vượt qua lượt đang kiểm tra L4.
- `tickets`: code unique, conversation unique FK, student FK, team FK, optional assignee FK, category, service_type, status, priority, reasons, summary, request data, handover reason, revision, created/updated. Ưu tiên thiết kế không tạo vòng FK với `conversations.ticket_id`: lưu `tickets.conversation_id`, suy ra `Conversation.ticket_id` khi serialize API. Dữ liệu có cấu trúc phải query được; JSON/JSONB chỉ dành cho payload linh hoạt đã version hóa, không thay thế cột dùng để lọc/quyền.
- `intake_packets` và `handover_packets`: snapshot đã xác nhận hoặc quyết định safety, nguồn message, version, risk type, lý do, thời gian. Giữ intake cũ khi L4 nâng ticket có sẵn.
- `ticket_assignments` hoặc event tương đương: ai nhận/chuyển/trả ca, từ team/assignee nào sang đâu, thời gian. Trường assignee hiện tại trên ticket phải nhất quán với lịch sử. Việc nhận ca phải atomic: chỉ một cán bộ hợp lệ nhận thành công từ hàng chờ chưa có assignee; người đến sau thấy trạng thái đã đổi.
- `ticket_attachments`: metadata như ticket/message liên quan, tên file, MIME, size, object key nullable, uploader và thời gian; chưa chứa byte file và chưa có upload API. Nếu không có storage key thì record chỉ là placeholder metadata demo, không trả URL giả.

**Cán bộ, AI và độ tin cậy:**

- `officer_actions`/`officer_decisions`: nội dung Submit 2 sau review, action `respond|request_info|resolve`, expected revision, reviewed brief version, actor, timestamp; không coi AI draft là phản hồi đã gửi.
- `ai_artifacts`/`officer_briefs`: dữ liệu brief có version, `source_ticket_revision`, status/quality, summary/facts/checklist/draft/warnings/citations, model/prompt/template/index version, timestamps. Brief cũ phải giữ lịch sử và đánh dấu stale khi ticket revision đổi; không ghi đè draft cán bộ.
- `fact_provenance`: fact gắn source type/id và verification status. Lời khai sinh viên không được AI tự đánh dấu `verified`; checklist khởi tạo unchecked.
- `audit_entries` bất biến ở tầng ứng dụng: actor, action, status trước/sau, ticket, request id và UTC timestamp. Không cascade delete lịch sử nghiệp vụ.
- `idempotency_records`: key theo actor + operation + resource, payload hash, trạng thái, response tham chiếu/kết quả đã commit, expires_at tối thiểu 24 giờ. Replay cùng key/payload không ghi thêm; khác payload trả conflict; kiểm tra quyền hiện tại trước khi trả replay.
- `jobs` (và outbox chỉ nếu thực sự cần): durable `prepare_brief`/`retry_handover`, source revision/operation id, state, attempts, available_at, lease_until, lỗi an toàn, created/updated. Unique dedup theo kind/resource/revision hoặc operation. Worker riêng lấy lease, gia hạn, phục hồi job kẹt và kiểm tra revision trước commit; không dùng FastAPI BackgroundTasks trong bộ nhớ làm cơ chế bền vững.

Chừa khả năng bổ sung `review_feedback`, `sla_events`, notification hoặc service catalog trong tài liệu ERD; chỉ tạo bảng ngay nếu có luồng đọc/ghi hoặc ràng buộc rõ ràng ở P0. Ưu tiên schema vừa đủ, không tạo bảng trống chỉ để đủ số lượng.

### 4. Ràng buộc và giao dịch bắt buộc

- Sử dụng SQLAlchemy 2 và Alembic. Tất cả PK/FK/unique/not-null/check/index phải có lý do; index tối thiểu cho ticket theo owner/team/status/priority/created_at, message theo conversation + thời gian, job theo state/available_at/lease_until, audit theo ticket + thời gian. Pagination ổn định, high trước normal cho hàng chờ.
- Lưu UTC trong DB, trả ISO 8601 có timezone theo contract; seed `+07:00` phải được chuẩn hóa. Dùng transaction/session per request, không giữ transaction mở trong lúc chờ LLM.
- Thực hiện đúng bảng chuyển trạng thái mục 16.3: Submit 1 tạo `open`; L4 tạo/nâng thành `pending_officer/high`; chỉ cán bộ xác nhận mới `resolved`; `resolved` không reopen hoặc nhận ghi mới ngoài replay đã commit. Ticket revision tăng khi message nghiệp vụ, status, priority, owner/request đổi; chỉ lưu brief không tăng revision.
- Submit 1 commit nguyên tử: consume preview + ticket + link conversation + audit + durable job/event + idempotency. Submit 2 commit nguyên tử: revision guard + officer action/message + ticket status/revision + audit + idempotency. Bổ sung commit message + revision + brief stale + job/event. L4 lock/decision/preview invalidation và handover phải có chiến lược crash/retry ở mục 16.4; không báo thành công hay cấp ticket code trước khi commit.
- PostgreSQL dùng khóa/constraint hoặc optimistic concurrency bảo vệ request đồng thời. SQLite local phải có hành vi an toàn/giới hạn rõ; không hứa mức isolation giống PostgreSQL. Lỗi DB trả tình trạng chưa xác nhận, không tạo biên nhận giả.
- Dữ liệu student_support chỉ cán bộ thuộc team đó đọc/nhận/xử lý. `OF001` hoặc role officer chung không tự có quyền xem mọi ticket. Kiểm tra quyền tại query/service/API, không dựa vào filter UI.
- Các field contract trả nullable có `null`; không để JSON DB rò rỉ draft, fact nội bộ, audit hoặc packet nhạy cảm trong response sinh viên. Dùng serializer/DTO theo role.
- Không sửa `src/models/contracts_v1.py` hoặc OpenAPI để né validation. Ngoại lệ đã được chủ dự án chốt: thêm thao tác cán bộ **nhận ca** với request/response và audit hợp lệ theo kiểu mở rộng tương thích ngược; cập nhật schema, generator OpenAPI, fixture và tests cùng lúc. Nếu phát hiện lỗi contract khác, ghi rõ diff tối thiểu và giải thích lý do.

### 5. Code cần bàn giao

1. SQLAlchemy models, session/unit of work, repositories và service nghiệp vụ đặt trong `src/` theo cấu trúc dễ đọc; không để toàn bộ logic trong route.
2. Alembic `upgrade`/`downgrade` từ DB rỗng; PostgreSQL là chuẩn kiểm thử. Cấu hình SQLite local qua `DATABASE_URL`; dùng kiểu dữ liệu/constraint tương thích hoặc abstraction có kiểm thử.
3. Seeder idempotent đọc `datasets/edu14_demo.json`, validate các collection có contract bằng Pydantic và kiểm tra FK/scope cho `teams`, `officer_team_memberships`, `ticket_assignments`; nhập theo FK và không nhân đôi khi chạy hai lần. Với yêu cầu “cán bộ nhận ca”, seed assignee phải khớp assignment history đã ghi. `OF-DEMO-02` chỉ thuộc team student_support; `OF-DEMO-01/03` chỉ thuộc academic. Không phát sinh hồ sơ thật, không tải Kaggle vào bảng nghiệp vụ.
4. Nối các endpoint nghiệp vụ P0 trong OpenAPI với repository/service DB thật, bao gồm auth demo, conversation/message, preview, ticket, officer queue/brief/action và audit. Thêm `POST /api/v1/officer/tickets/{id}/claim` cho thao tác nhận ca, có expected revision/idempotency và kiểm tra team. Không trả thành công giả từ mock. Agent/RAG chưa sẵn có thì inject stub có contract, để thao tác DB vẫn kiểm thử được; không giả vờ L1 trả câu có nguồn nếu chưa có nguồn.
5. Worker jobs chạy được riêng, có lệnh khởi động và xử lý/lease/retry; nếu Agent chưa có thật, dùng stub test và giữ lỗi trung thực ngoài test.
6. Cập nhật `requirements.txt`, `.env.example`, `docker-compose.yml` (PostgreSQL + backend + worker), README chạy migration/seed/rollback/test. Không đưa secret thật vào repo. SQLite local dùng path trong `data/` đang được `.gitignore` loại trừ.
7. Báo cáo ngắn cuối việc: ERD/tables thực tế, file đã sửa, lệnh đã chạy và kết quả, phần nào chưa tích hợp vì phụ thuộc agent/RAG/frontend; không nói “hoàn tất” nếu đường ghi API/DB chưa chạy thật.

### 6. Kiểm thử nghiệm thu

Viết test có ý nghĩa trên DB tạm, tối thiểu gồm:

- Alembic upgrade từ rỗng, seed chạy hai lần giữ nguyên số lượng, các FK/unique/check hoạt động, dữ liệu +07 chuyển UTC.
- Sinh viên A không đọc ticket/message của B; officer academic không thấy wellbeing, officer student_support chỉ thấy đúng scope; cán bộ ngoài team không nhận ca; hai cán bộ cùng nhận một ticket thì chỉ một người thắng.
- Submit 1 thiếu confirm/stale/expired/consumed preview không tạo ticket; retry cùng key không nhân đôi; key trùng payload khác nhận conflict.
- L4 gặp lỗi commit không trả mã ticket, vẫn khóa AI và retry không tạo trùng; không cho L2 vượt qua lượt kiểm tra L4.
- Submit 2 revision cũ/stale brief bị từ chối; chỉ officer xác nhận mới resolve; `resolved` từ chối write mới.
- Bổ sung message làm brief stale, job revision cũ không ghi đè brief mới; worker lấy lại lease sau crash, job dedup đúng.
- Rollback giao dịch không để ticket/audit/job dang dở; concurrent requests trên PostgreSQL không tạo hai ticket cùng preview/conversation.

Chạy `.venv/bin/python -m scripts.export_contracts_v1 --check`, test contract sẵn có, test database mới, Ruff; chạy kiểm thử PostgreSQL trong container cho concurrency/worker. Chỉ dừng khi triển khai đã hoạt động và đã ghi rõ giới hạn phụ thuộc còn lại. Nếu thiếu quyền hoặc thông tin thật sự chặn tiến độ, hỏi đúng điểm chặn sau khi đã làm xong các phần độc lập.

## KẾT THÚC PROMPT
