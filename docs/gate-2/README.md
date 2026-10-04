# Gate 2 — MVP: rà soát deliverables

Ngày rà soát: **04/10/2026**, múi giờ Asia/Phnom_Penh.
Nhánh làm việc: `feat/gate-2-mvp`, tạo từ `feat/connect-frontend-backend` tại commit
`dc4079d483152ea54e2498669b82bc184b4ccd78`.

Phạm vi: kiểm tra các yêu cầu Gate 2 do đội cung cấp. Video demo 3 phút do người
phụ trách thực hiện sau. Báo cáo này là rà soát nội bộ, không phải kết quả chấm
chính thức. Chỉ tạo nhánh local và tài liệu rà soát; chưa push, mở hay merge PR.

## Kết quả

| Deliverable | Đánh giá | Bằng chứng / phần thiếu |
| --- | --- | --- |
| Video MVP 3 phút, user flow end-to-end | Để làm sau | Người phụ trách sẽ quay; chưa đánh giá trong lượt này. |
| Architecture diagram: components và data flow | Có sơ đồ, cần cập nhật trước khi nộp | [diagram.md](../architecture/diagram.md) có Mermaid nhưng ghi frontend chưa nối REST và dùng ChromaDB; không khớp code tích hợp hiện tại. [Tài liệu kiến trúc](../architecture/README.md) vẫn mô tả hiện trạng 26/09. |
| Repo có ít nhất 10 PR merged | **Chưa đạt: 8/10** | GitHub trả về PR đã merge #1, #2, #4, #5, #6, #7, #8, #9. Thiếu **2 PR merged**; commit, merge nhánh bằng Git và PR đang mở không được tính thay PR merged. |
| README: setup, env vars, sample queries | Có một phần, cần hoàn thiện | [README gốc](../../README.md) còn tên/nội dung template AI20K; có cài backend và DB nhưng thiếu hướng dẫn frontend API mode, khởi chạy worker trong quick start và sample queries cho sản phẩm. |
| Eval evidence: ít nhất 5 ca manual, output thực tế | **Chưa đủ bằng chứng cho MVP tích hợp hiện tại** | [eval/results/report.md](../../eval/results/report.md) còn placeholder; [báo cáo RAG](../../RAG/group_project/evaluation/RESULT.md) có N/A và sample output placeholder. Gói browser 01/10 có kết quả/ảnh thực tế nhưng công bố phạm vi UI mock và không xác nhận backend/AI tích hợp. |

Kết luận: **chưa đủ cơ sở xác nhận pass Gate 2**, kể cả khi tạm bỏ video.

## Việc cần bổ sung

### 1. Đồng bộ tài liệu kiến trúc với code hiện tại

Cập nhật cả `docs/architecture/diagram.md` và `docs/architecture/README.md` để
không còn mâu thuẫn giữa sơ đồ và phần giải thích:

- Components: Next.js → typed API gateway → FastAPI `/api/v1` → services →
  SQLite/PostgreSQL; worker xử lý job từ DB; storage cho attachment/PDF.
- Agent: phân biệt `AGENT_MODE=stub` và `AGENT_MODE=langgraph`; CampusAgent có
  intake graph L1/L2/L4 và officer graph L3, không chỉ graph template hai node.
- RAG: phân biệt `stub`, `corpus`, `official`, `pipeline`. Hybrid pipeline dùng
  Gemini embedding + BM25 + RRF và cache tại `RAG_INDEX_DIR`; không dùng Chroma.
- Data flow: sinh viên chat → thu thập trường → preview → xác nhận Submit 1 →
  ticket/job → cán bộ claim → brief → review/xác nhận Submit 2 → sinh viên xem
  kết quả. Khiếu nại điểm thông thường đi qua form/Submit 1 theo luồng mới;
  không mô tả mọi khiếu nại là auto-handover L4.
- Luồng L4 riêng cho tín hiệu cần bàn giao và giới hạn của dữ liệu demo,
  đối soát SIS/KHTC, ký/phát hành giấy chính thức.

Nguồn đối chiếu: [config backend](../../backend/src/campus247/config.py),
[API](../../backend/src/campus247/api/v1.py),
[intake graph](../../backend/src/campus247/agents/intake_graph.py),
[officer graph](../../backend/src/campus247/agents/officer_graph.py),
[RAG factory](../../backend/src/campus247/rag/factory.py),
[Compose](../../docker-compose.yml).

### 2. Viết README riêng cho Campus 24/7

- Giới thiệu EDU-14/P-120, vai trò sinh viên/cán bộ và phạm vi MVP.
- Prerequisites Python, Node/npm; cài dependency theo lockfile frontend và
  `backend[dev]`.
- Setup từ clone đến migrate/seed, chạy API, worker và frontend trong các
  terminal riêng; mô tả lựa chọn Compose cho DB/API/worker.
- Bảng env tối thiểu: `DATABASE_URL`, `APP_ENV`, `DEMO_AUTH_ENABLED`,
  `AGENT_MODE`, `RAG_MODE`, `LLM_PROVIDER`, `LLM_MODEL`, credential provider,
  `FILES_DIR`, `RAG_INDEX_DIR`, `CORS_ORIGINS`.
- Frontend phải cấu hình `NEXT_PUBLIC_DATA_MODE=api`,
  `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`,
  `NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH=false` khi demo tích hợp. Next.js đọc
  cấu hình từ môi trường/frontend `.env.local`; `.env` ở root không thay thế
  việc cấu hình frontend. Nếu không chọn API mode, code mặc định dùng mock.
- Có sample queries và expected behavior cho L1, cấp giấy L2, khiếu nại qua
  Submit 1, cán bộ L3; nêu rõ chế độ stub không chứng minh chất lượng LLM thật.
- Liên kết sơ đồ, hướng dẫn nghiệp vụ, evidence và lệnh test chạy được.

Hiện `.env.example` vẫn ghi comment `NEXT_PUBLIC_API_URL`; tên được code sử
dụng là `NEXT_PUBLIC_API_BASE_URL`. Cần sửa hướng dẫn cho thống nhất.

### 3. Gói ít nhất 5 ca manual có output thực tế

Chọn cùng commit và runtime sẽ quay video. Tạo `eval/manual/` hoặc một báo cáo
riêng, liên kết từ README. Mỗi ca ghi: người chạy, thời gian, commit, mode
frontend/agent/RAG, dữ liệu đầu vào, các bước, expected, actual, Pass/Fail và
đường dẫn screenshot/response/log. Không điền output giả hoặc gọi test tự
động là manual.

Năm ca tối thiểu đề xuất:

| Ca | Thao tác | Kết quả cần ghi nhận thực tế |
| --- | --- | --- |
| M01 — L1 tra cứu | Hỏi quy trình xin giấy xác nhận | Nội dung trả lời và nguồn/citation, hoặc trạng thái thiếu căn cứ đúng với corpus đang dùng; không tự tạo ticket. |
| M02 — Cấp giấy đủ thông tin | Chat yêu cầu cấp giấy → review preview → Submit 1 | Field đã điền, xác nhận của sinh viên, mã ticket thật từ API, hồ sơ xuất hiện trong danh sách. |
| M03 — Thiếu dữ kiện | Xin giấy nhưng thiếu mục đích/nơi nhận/phương thức | Danh sách trường thiếu, trạng thái chặn submit; bổ sung rồi preview đủ điều kiện. |
| M04 — Khiếu nại điểm | Nêu môn/nội dung khiếu nại → review → Submit 1 | Form khiếu nại đúng loại; trước xác nhận chưa tạo ticket/khóa AI; sau xác nhận có ticket và trạng thái chờ cán bộ. |
| M05 — Cán bộ và kết quả sinh viên | Login cán bộ → claim ticket M02 → prepare brief → review/checklist → Submit 2 → login sinh viên/reload | Brief, phản hồi cán bộ, status cuối, audit actor và sinh viên thấy cùng kết quả từ DB. |

Gói [frontend 01/10](../../frontend/verification/frontend-rebuild-20261001/README.md)
có thể làm bằng chứng bổ trợ UI. Cần xác nhận lại trên MVP tích hợp hiện tại và
ghi rõ ca nào do người chạy manual; không suy ra chất lượng AI thật từ mock.

### 4. Đạt đủ 10 PR merged và đưa MVP vào nhánh nộp

- PR thứ nhất đề xuất: tích hợp tính năng từ `feat/connect-frontend-backend`
  vào nhánh đội sử dụng để nộp/review, sau khi đồng bộ CI và chạy checks.
- PR thứ hai đề xuất: hoàn thiện bộ tài liệu/evidence Gate 2 trên
  `feat/gate-2-mvp` sau khi cập nhật từ nhánh tích hợp đã merge.
- Hai PR phải được review và **merge thật**; mở PR hoặc push nhánh chưa làm
  số lượng tăng. Không chia PR rỗng chỉ để đủ số.
- Tại thời điểm rà soát, GitHub có một PR mở #3 (`feat/prototype` → `main`),
  chưa tính vào 8 PR merged. Nếu PR này vẫn phù hợp và được merge, nó có thể
  đóng góp một PR; cần kiểm tra nội dung trước khi quyết định.
- `origin/develop` đã có 6 commit chưa nằm trong nhánh mới, gồm ba PR CI #7–#9;
  nhánh mới có nhiều tính năng chưa nằm trong `develop`. Đồng bộ/review CI
  trước khi nộp, tránh chỉ nộp một nhánh không có bản MVP mới nhất.

Nguồn trực tiếp: [danh sách PR đã merge trên GitHub](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pulls?q=is%3Apr+is%3Amerged).
Snapshot từ GitHub API: [merged-prs.json](merged-prs.json).

## Kiểm tra kỹ thuật trong lượt rà soát

Các lệnh tự động bên dưới là kiểm tra bổ trợ; không thay thế 5 ca manual.

- Frontend: `cd frontend && npm run test:regression` — **PASS**, exit 0
  (8 script trong lệnh tổng hợp).
- OpenAPI: từ root, `APP_ENV=test AGENT_MODE=stub RAG_MODE=stub
  LANGCHAIN_TRACING_V2=false PYTHONPATH=backend/src .venv/bin/python -m
  scripts.export_contracts_v1 --check` — **PASS**, hai artifact đúng code.
- Backend: `cd backend && APP_ENV=test AGENT_MODE=stub RAG_MODE=stub
  LANGCHAIN_TRACING_V2=false ../.venv/bin/python -m pytest tests -q --tb=short`
  — **360 passed, 1 failed**. Ca
  `test_postgres_json_columns_are_jsonb_and_alembic_check_is_clean` vẫn kỳ vọng
  20 cột JSON, trong khi schema sau migration mới trả 26 cột JSONB. Cần cập
  nhật kiểm tra schema theo các migration hiện tại và chạy lại, giữ kiểm tra
  loại JSONB và Alembic schema drift. Không coi cả suite đã pass.
- E2E: `APP_ENV=development DEMO_AUTH_ENABLED=true RAG_MODE=stub
  LANGCHAIN_TRACING_V2=false .venv/bin/python scripts/g2_stub_e2e.py --port
  18010` — **FAIL**, exit 1 ở assertion khiếu nại điểm phải là L4. API thực tế
  trả `route=L2`, `outcome=collecting`, preview loại `academic_complaint`,
  `missing_fields=[course, description]`, `ticket=null`,
  `ai_response_locked=false`. Đây là kỳ vọng cũ của script so với intake mới;
  cần cập nhật script và chạy lại trước khi dùng làm evidence E2E.
- `scripts/g3_langgraph_e2e.py` và `scripts/g2_browser_smoke.mjs` cũng còn câu
  khiếu nại điểm gắn với kỳ vọng L4; cần rà soát cùng thay đổi nghiệp vụ.
  Hai script này chưa được chạy trong lượt audit.

Chưa chạy build/browser MVP, provider LLM thật hoặc đánh giá RAG live trong
lượt này. Không kết luận sản phẩm pass E2E hoặc chất lượng AI chỉ từ regression.

## Thứ tự hoàn tất

1. Đồng bộ nhánh/CI, cập nhật test schema PostgreSQL và kỳ vọng smoke test
   cho intake mới; chạy lại backend suite/E2E.
2. Cập nhật kiến trúc và README; chốt cấu hình demo.
3. Chạy 5 ca manual và lưu output/ảnh thực tế.
4. Hoàn tất review/merge tối thiểu 2 PR còn thiếu, kiểm lại số lượng GitHub.
5. Quay video 3 phút trên cùng phiên bản có evidence; bổ sung link nộp.
