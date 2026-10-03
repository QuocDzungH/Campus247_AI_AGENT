# Báo cáo triển khai vận hành Campus 24/7

Ngày: 2026-10-03. Không chứa secret.

## Thay đổi theo chức năng

- **Tài khoản:** identifier (id / username / email / MSSV chuỗi, giữ số 0 đầu) + mật khẩu Argon2id. Phiên Bearer (hash SHA-256, TTL, remember, revoke). Audit `auth_events` không lưu mật khẩu. Khóa sau 8 lần sai / 15 phút. Admin không có quyền hàng chờ học vụ.
- **CLI:** `campus247-admin bootstrap-admin`, `set-password`, `issue-reset-token`, `import-students`, `ingest-document`. Mật khẩu qua getpass hoặc `CAMPUS_ADMIN_PASSWORD`, không argv.
- **Hồ sơ:** `/me/profile`, import CSV `imported` (chưa `officer_verified`). Không bịa danh sách sinh viên.
- **Form / tệp / nháp:** POST `/forms` lưu field P0 + `extras`. Tệp PDF/PNG/JPEG ≤10MB trên `FILES_DIR`. PATCH workspace lưu nháp và checklist cán bộ.
- **Rà soát học phần:** `/api/v1/reviews` lưu hồ sơ trên DB. Chạy AI chỉ trả `insufficient_evidence` khi chưa có SIS/đề cương chính thức. Phiếu hoàn tất là đề xuất cán bộ, chưa phải quyết định đã ký.
- **Đối soát cấp giấy:** POST `/tickets/{id}/verifications` ghi `insufficient` (chưa connector SIS/KHTC), không dùng snippet SQL giả.
- **AI:** `APP_ENV=production` bắt buộc `AGENT_MODE=langgraph` và `DEMO_AUTH_ENABLED=false`. Không fallback Stub khi lỗi model.
- **RAG:** `corpus` = demo đóng gói. `official` = kho ingest riêng; trống thì insufficient_evidence, không gọi demo là quy chế trường.

## Vì sao vẫn Bearer

Frontend/API P0 đã dùng `Authorization: Bearer` + session store (memory / sessionStorage / localStorage theo remember). Cookie HttpOnly cần CSRF và đổi CORS credentials trên mọi client. Token chỉ lưu hash trên server; logout/đổi mật khẩu/khóa tài khoản thu hồi phiên.

## Lệnh đã dùng (môi trường local)

```bash
PYTHONPATH=backend/src
alembic -c backend/alembic.ini upgrade head
# DATABASE_URL tuyệt đối tới data/app.db; không --reset seed
```

Frontend chính thức: `NEXT_PUBLIC_DATA_MODE=api`, `NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH=false`, `NEXT_PUBLIC_API_BASE_URL` hợp lệ, rồi rebuild.

## Cấp tài khoản và import

1. `CAMPUS_ADMIN_PASSWORD=... campus247-admin bootstrap-admin --username ...`
2. `campus247-admin set-password --identifier SV-...` (mật khẩu ẩn)
3. `campus247-admin import-students --file students.csv --dry-run` rồi bỏ `--dry-run`
4. CSV bắt buộc `mssv,full_name`; không tự tạo mật khẩu

## Ingest tài liệu

`campus247-admin ingest-document --file quyche.txt --title "..." --source "Phòng ĐT" --version 2026.1`

Chạy API/worker với `RAG_MODE=official` sau khi có tài liệu `approved`.

## Rollback

`alembic -c backend/alembic.ini downgrade 20260929_0002` gỡ 0003–0005. Backup file SQLite/`pg_dump` trước khi nâng cấp production.

Compose vận hành (không seed demo): `docker compose -f docker-compose.yml -f docker-compose.production.yml up`. `/health` là process sống; `/ready` kiểm tra DB + cấu hình agent (503 nếu DB lỗi hoặc production không phải langgraph).

## Dependency còn thiếu (cần nhà trường)

- Danh sách sinh viên/tài khoản chính thức và người được phép cấp tài khoản
- Kho quy chế PDF/DOCX đã phê duyệt
- PostgreSQL vận hành, domain HTTPS, SMTP, object storage
- SSO/SIS nếu có; chữ ký số phát hành giấy
- Không gửi mật khẩu/API key trong chat; điền qua `.env` / secret
