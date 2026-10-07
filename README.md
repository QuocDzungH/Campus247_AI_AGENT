# Campus 24/7 — EDU-14 / P-120

Trợ lý học vụ cho sinh viên và cán bộ: tra cứu có nguồn (L1), thu thập yêu cầu
cấp giấy/khiếu nại và xác nhận Submit 1 (L2), chuẩn bị hồ sơ cho cán bộ review
và Submit 2 (L3), bàn giao yêu cầu vượt thẩm quyền hoặc cần hỗ trợ (L4).
AI chuẩn bị hồ sơ; sinh viên xác nhận nộp và cán bộ quyết định xử lý.

**Bộ nộp Gate 2:** [docs/gate-2/README.md](docs/gate-2/README.md).
**Kiến trúc:** [components và data flow](docs/gate-2/architecture.md).
**Kiểm thử:** [output thực tế và hướng dẫn manual](docs/gate-2/evaluation.md).

## Yêu cầu môi trường

- Python 3.11+ (CI dùng 3.11), Node.js 20.9+ và npm, Git.
- Docker nếu chạy PostgreSQL qua Compose hoặc test PostgreSQL local.
- API key của provider chỉ cần khi `AGENT_MODE=langgraph`; chế độ stub không
  gọi model. Không commit `.env`, token hoặc dữ liệu cá nhân thật.

## Setup local (Bash, Linux/macOS)

```bash
git clone https://github.com/AI20K-Build-Phase-Cohort-4/P-120.git
cd P-120
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e './backend[dev]'
cp .env.example .env
cp frontend/.env.example frontend/.env.local
npm ci --prefix frontend
mkdir -p data
```

Quick start dùng `APP_ENV=development`, `DEMO_AUTH_ENABLED=true`,
`AGENT_MODE=stub`, `RAG_MODE=stub` trong `.env`. Đây là luồng API/DB thật với
agent deterministic; câu hỏi L1 sẽ báo chưa đủ căn cứ, không sinh citation giả.

SQLite cần **cùng đường dẫn tuyệt đối** cho migration/API/worker, vì đường dẫn
SQLite tương đối phụ thuộc thư mục chạy. Từ repo root:

```bash
export DATABASE_URL="sqlite:///$(pwd)/data/gate2.db"
(cd backend && ../.venv/bin/alembic upgrade head)
python -m campus247.db.seed --identities
```

Đặt giá trị `DATABASE_URL` tuyệt đối này vào `.env` để các terminal dùng cùng
DB; hoặc export lại trong từng terminal. Seed mặc định chỉ bổ sung dòng thiếu.
`--reset` ghi đè dữ liệu demo, không dùng để chuẩn bị một DB đang chứa kết quả.

Chạy ba terminal từ repo root, mỗi terminal activate `.venv` và dùng cùng DB:

```bash
# Terminal 1 — API
uvicorn campus247.main:app --host 127.0.0.1 --port 8000
# Terminal 2 — worker (cần để brief/job hoàn tất)
python -m campus247.workers
# Terminal 3 — UI
npm run dev --prefix frontend
```

Mở UI <http://localhost:3000>, Swagger <http://127.0.0.1:8000/docs>,
readiness <http://127.0.0.1:8000/ready>. `/health` kiểm tra process; `/ready`
kiểm tra DB và thông tin runtime, không chứng minh provider LLM đang trả lời.

Trong API mode có tài khoản demo `SV-DEMO-001` và `OF-DEMO-01`;
UI điền mật khẩu demo `demo1234`, API demo-login chỉ phục vụ development.
Seed `--identities` còn tạo tài khoản synthetic có xác thực mật khẩu: sinh viên
`20210018`, cán bộ `ha.tt`; mật khẩu development mặc định `Campus247-An18`
hoặc giá trị `CAMPUS_SEED_PASSWORD` khi seed. Nếu đổi mật khẩu seed, nhập giá trị
đã đặt; nút điền mẫu UI vẫn dùng giá trị development. Admin không có quyền
hàng chờ cán bộ.

## Biến môi trường

Backend đọc `.env` tại root. Frontend đọc `frontend/.env.local` hoặc biến của
process build/dev; file `.env` ở root không tự cấu hình Next.js.

| Biến | Mặc định / ví dụ | Mục đích |
| --- | --- | --- |
| `APP_ENV` | `development` | `development`, `test`, `production` |
| `DATABASE_URL` | `sqlite:////absolute/path/data/gate2.db` | Cùng DB cho migration, API và worker |
| `DEMO_AUTH_ENABLED` | `true` | Cho phép demo-login trong development |
| `AGENT_MODE` | `stub` | `langgraph` để dùng CampusAgent/model thật |
| `RAG_MODE` | `stub` | `corpus` demo đóng gói; `official` kho ingest; `pipeline` hybrid Markdown |
| `LLM_PROVIDER` | `openai` | `openai`, `google` (alias `gemini`), `groq`, `openai_compatible` |
| `LLM_MODEL` | `gpt-4o-mini` | Model phù hợp provider đã chọn |
| `OPENAI_API_KEY` / `GOOGLE_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` | Điền riêng trong `.env` | Credential provider; Google ưu tiên `GOOGLE_API_KEY` |
| `OPENAI_BASE_URL` | Trống | Bắt buộc với `openai_compatible` |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Các origin UI được gọi API; bổ sung nếu đổi port |
| `FILES_DIR` | `./data/files` | Attachment và PDF; dùng cùng thư mục khi chạy nhiều process |
| `OFFICIAL_CORPUS_DIR` | `./data/corpus_official` | Kho nguồn được ingest/phê duyệt |
| `RAG_PIPELINE_DIR` | `./RAG` | Markdown cho hybrid retrieval |
| `RAG_INDEX_DIR` | `./data/rag_index` | Cache embedding chia sẻ API/worker |
| `GEMINI_EMBEDDING_MODEL` | `models/gemini-embedding-001` | Embedding khi chọn pipeline; phải tương thích provider |
| `NEXT_PUBLIC_DATA_MODE` | `api` trong `frontend/.env.example` | Nếu bỏ cấu hình, code UI mặc định `mock` |
| `NEXT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:8000` | Địa chỉ FastAPI; bắt buộc trong API mode |
| `NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH` | `false` | Giữ mode demo theo cấu hình build |

TTL session/preview, lease/retry worker và top-k RAG: xem [.env.example](.env.example)
và [Settings](backend/src/campus247/config.py). Khi đổi `NEXT_PUBLIC_*` phải
restart dev hoặc rebuild bản production.

## Chạy AI thật

Đổi cùng cấu hình cho API và worker rồi restart cả hai:

```dotenv
AGENT_MODE=langgraph
RAG_MODE=corpus
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
# Điền OPENAI_API_KEY riêng trong .env
```

`corpus` có provenance nhưng là dữ liệu demo, không phải quy chế được nhà
trường phê duyệt. `pipeline` dùng Gemini embedding + BM25 + RRF; cần credential
Google cho embedding và model chat hợp lệ cho bước chuẩn hóa câu hỏi. Cache
API/worker phải cùng `RAG_INDEX_DIR`. Lỗi provider không chuyển sang stub để
báo thành công. `APP_ENV=production` yêu cầu `AGENT_MODE=langgraph` và
`DEMO_AUTH_ENABLED=false`; không dùng seed/password demo cho vận hành.

## Sample queries và user flow

| Đầu vào / thao tác | Hành vi mong đợi |
| --- | --- |
| “Quy trình xin giấy xác nhận sinh viên?” | L1: trả lời có nguồn khi đủ căn cứ; stub báo thiếu căn cứ, không tạo ticket |
| “Tôi muốn xin giấy xác nhận sinh viên để vay vốn ngân hàng, nơi nhận Ngân hàng A, nhận bản điện tử PDF” | L2: preview mục đích/nơi nhận/phương thức; sinh viên review và xác nhận Submit 1 |
| “Tôi muốn xin giấy xác nhận sinh viên.” | Hỏi các trường còn thiếu, chặn submit khi chưa đầy đủ |
| “Tôi muốn khiếu nại điểm môn Cơ sở dữ liệu vì điểm bài thi chưa đúng.” | Form khiếu nại L2; chưa tạo ticket/khóa AI trước xác nhận Submit 1 |
| “Hãy giúp tôi sửa điểm môn Cấu trúc Dữ liệu.” | L4: không sửa điểm; khóa phản hồi AI và bàn giao cán bộ |
| Cán bộ mở ticket → claim → chuẩn bị brief → review/checklist → phản hồi/hoàn tất | L3: ghi actor/audit, sinh viên xem kết quả cùng ticket từ API/DB |

Luồng quay demo gợi ý: [docs/gate-2/demo-script.md](docs/gate-2/demo-script.md).
Cấp giấy, đối soát và tạo PDF là chức năng riêng; hoàn tất ticket không tự
đồng nghĩa cấp giấy đã ký hoặc quyết định học vụ chính thức.

## Docker / PostgreSQL

```bash
cp .env.example .env  # chỉ khi chưa có file cấu hình riêng
docker compose up --build
```

Compose chạy PostgreSQL, API và worker; frontend chạy riêng với cấu hình API
ở trên. Container backend migrate + seed demo khi khởi động development;
seed không tự thêm operational identities. Có thể chạy
`docker compose exec backend python -m campus247.db.seed --identities`.
Overlay production: [hướng dẫn vận hành](docs/production/implementation-report.md).

## Kiểm thử

```bash
# Backend: chạy trong backend để Alembic tìm đúng script_location
(cd backend && APP_ENV=test AGENT_MODE=stub RAG_MODE=stub LANGCHAIN_TRACING_V2=false ../.venv/bin/python -m pytest tests -q)
.venv/bin/ruff check backend/src backend/tests scripts/g2_stub_e2e.py scripts/g3_langgraph_e2e.py
APP_ENV=test AGENT_MODE=stub RAG_MODE=stub LANGCHAIN_TRACING_V2=false PYTHONPATH=backend/src .venv/bin/python -m scripts.export_contracts_v1 --check
npm run lint --prefix frontend
npm run test:regression --prefix frontend
npm run build --prefix frontend
# E2E tự tạo SQLite tạm, API/worker riêng; không ghi DB demo dùng chung
.venv/bin/python scripts/g2_stub_e2e.py --port 18010 --output /tmp/gate2-api-cases.json
```

Test PostgreSQL yêu cầu Docker hoặc `EDU14_TEST_DATABASE_URL` trỏ DB test dùng
riêng (tên kết thúc `_test`/`_pytest` hoặc `campus24_pytest`).
Test browser: xem [evaluation Gate 2](docs/gate-2/evaluation.md).
Eval agent: [eval/agent/README.md](eval/agent/README.md); runner mặc định không gọi LLM.

## Cấu trúc và tài liệu

| Đường dẫn | Nội dung |
| --- | --- |
| `frontend/` | Next.js UI, typed gateway, API/mock mode |
| `backend/src/campus247/` | FastAPI, services, LangGraph, RAG, worker, storage |
| `backend/alembic/` | Schema migrations |
| `RAG/data/processed/` | Markdown retrieval corpus |
| `docs/gate-2/` | Bộ nộp MVP, kiến trúc, evidence, manual checklist, demo script |
| `docs/contracts/`, `docs/database/` | HTTP contract và DB |
| `docs/gate-1/` | BRD, PRD và thiết kế Gate 1 |
| `docs/guide/` | Technical Guidebook của template |
| `scripts/` | E2E và hook AI logging |

Cài hook AI logging theo [ai-logs/README.md](ai-logs/README.md) và
`scripts/setup_hooks.sh` (PowerShell: `scripts/setup_hooks.ps1`).
Đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md). License: [MIT](LICENSE).
