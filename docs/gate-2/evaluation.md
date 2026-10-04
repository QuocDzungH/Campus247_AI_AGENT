# Evaluation evidence — Gate 2

Ngày: 04/10/2026, múi giờ Asia/Phnom_Penh. Phạm vi: API/DB/worker tích hợp
và UI API mode; dữ liệu synthetic. Hình thức thực hiện: script tự động và
điều khiển trình duyệt từng bước bằng công cụ.

**Thành viên phụ trách kiểm tra:** Hoàng Quốc Dũng, Xuân Vinh, Đặng Quang Huy.
Phân công ở bảng manual bên dưới; đây là người phụ trách chạy/xác nhận,
chưa phải ghi nhận họ đã thực hiện các lượt chạy có sẵn.

**Có output thực tế cho 6 ca bên dưới.** Report HTTP/browser batch được chạy
bằng script; có thêm lượt exploratory điều khiển từng bước bằng công cụ. Chưa có
người trong đội ghi kết quả thao tác trực tiếp. Bộ hồ sơ đã
chuẩn bị đầy đủ input/bước/expected/actual để đội chạy lại và ghi kết quả
manual. Không cần chữ ký hoặc người duyệt riêng theo yêu cầu Gate 2 đã cung cấp.
Cột manual còn chờ, không được xem là đã đạt yêu cầu “5 test case
manual” cho tới khi có xác nhận của người thực hiện.

## Runtime và bằng chứng

- Run HTTP: 04/10/2026 20:09:56, `AGENT_MODE=stub`, `RAG_MODE=stub`, SQLite tạm;
  migration đến `20261004_0007`; API và worker riêng, không ghi `data/app.db`.
- [api-cases.json](evidence/api-cases.json): request inputs, preview fields,
  response thực tế, error 422, brief, ticket, messages, trạng thái và request ID.
  Có commit và `source_dirty` ghi đúng việc chạy trên working tree.
- [live-e2e.json](evidence/live-e2e.json): **model thật**
  `gemini-3.5-flash-lite`, `AGENT_MODE=langgraph`, `RAG_MODE=corpus`;
  `edu14-demo-academic-v1`. L1 `answered` với 3 citation; brief `ready`,
  có facts/provenance và index version; Submit 2 và sinh viên xem `resolved`;
  L4 khóa AI, follow-up `forwarded_to_officer`. Không đo accuracy tổng thể.
- [Browser report](evidence/browser/report.json) và ảnh trong `evidence/browser/`:
  production UI build, frontend API mode, agent/RAG stub. Browser này không
  chứng minh chất lượng câu trả lời từ model thật.
- [Exploratory review](exploratory-review.md): 5 đường đi được điều
  khiển từng bước qua browser, đọc UI/response và xem ảnh; có lỗi reload
  phát hiện và kiểm lại sau sửa. Không ghi nhận người trong đội đã nghiệm thu.
- [verification.json](evidence/verification.json): lệnh, kết quả, môi trường và
  source hashes; log kỹ thuật trong `evidence/`.

Mã ticket trong từng report thuộc run riêng; output HTTP, ảnh batch browser
và ảnh exploratory có thể khác mã vì DB/dữ liệu khác nhau.

## 6 ca: manual procedure và actual output tham chiếu

Các bước dưới đây dùng UI. Để nghiệm thu manual, dùng cấu hình sẽ quay video,
chạy lại và lưu screenshot/output mới nếu model, dữ liệu hoặc commit khác.
Account demo theo [README](../../README.md#setup-local-bash-linuxmacos).

### M01 — Tra cứu L1, không tạo hồ sơ

**Input:** `Quy trình xin giấy xác nhận sinh viên?`

**Bước:** đăng nhập sinh viên → Trợ lý học vụ → chat mới → gửi câu hỏi → đọc
phản hồi/nguồn → kiểm tra không có mã ticket mới.

**Expected:** L1; có nguồn nếu đủ căn cứ, thiếu căn cứ thì nói rõ; không preview
và không tự tạo ticket.

**Actual (HTTP stub):** `route=L1`, `outcome=insufficient_evidence`,
`preview=null`, `ticket=null`, `ai_response_locked=false`; trả:
> Kho tài liệu hiện tại chưa đủ căn cứ để trả lời câu hỏi này.

**Kết quả tự động:** PASS. Live E2E riêng trả `answered` và 3 citation có quote,
version/locator thuộc demo corpus; xem `l1_*` trong live report.
**Manual:** chờ người thực hiện xác nhận.

### M02 — Cấp giấy: preview → Submit 1

**Input:** `Tôi muốn xin giấy xác nhận sinh viên để nộp hồ sơ vay vốn ngân hàng,
nơi nhận Ngân hàng Chính sách Xã hội, nhận bản điện tử PDF`.

**Bước:** chat mới → gửi input → kiểm tra/sửa mục đích, nơi nhận, cách nhận →
Submit 1 → xác nhận gửi → mở Hồ sơ của tôi. Thử reload/xem lại mã hồ sơ.

**Expected:** preview đủ trường; ticket chỉ tạo sau xác nhận. Retry cùng
idempotency key không tạo ticket thứ hai.

**Actual:** `can_submit=true`, `receive_method=digital_pdf`,
`destination_org=Ngân hàng Chính sách Xã hội`; ticket `TKT-2026-0001`,
`status=open`, replay trả cùng `ticket_id`.

**Kết quả tự động:** PASS. [Ảnh Submit 1](evidence/browser/certificate-submitted.png).
**Manual:** chờ người thực hiện xác nhận.

### M03 — Thiếu dữ kiện, không nhận submit chưa hợp lệ

**Input:** `Tôi muốn xin giấy xác nhận sinh viên.`

**Bước:** chat mới → gửi input → xem danh sách trường thiếu → thử submit khi
chưa điền → bổ sung mục đích/nơi nhận/phương thức → cập nhật preview.

**Expected:** hỏi/hiển thị trường thiếu; submit chưa đủ dữ liệu bị chặn,
không tạo ticket; sau khi bổ sung đủ mới được xác nhận nộp.

**Actual:** `outcome=collecting`,
`missing_fields=[purpose,destination_org,receive_method]`, `can_submit=false`,
`ticket=null`; API submit trả **HTTP 422** (response lỗi lưu trong `M03`).
Run tự động kiểm tra nhánh thiếu dữ liệu; nhánh điền đầy đủ được kiểm tra ở M02.

**Kết quả tự động:** PASS. **Manual:** chờ người thực hiện xác nhận.

### M04 — Khiếu nại điểm đi qua Submit 1

**Input:** `Tôi muốn khiếu nại điểm môn Cơ sở dữ liệu vì điểm bài thi chưa đúng.`

**Bước:** chat mới → gửi input → review form khiếu nại → kiểm tra trước xác
nhận chưa có mã hồ sơ → Submit 1 → xác nhận gửi → xem hồ sơ đã nộp.

**Expected:** L2 với `academic_complaint`; không auto-handover L4 trước Submit 1.
Sau xác nhận, cán bộ nhận ticket chờ xử lý; retry không tạo trùng.

**Actual:** trước xác nhận `route=L2`, `outcome=preview_ready`, `ticket=null`,
`ai_response_locked=false`; sau Submit 1 có `TKT-2026-0002`,
`service_type=academic_complaint`, `status=pending_officer`; replay cùng ID.

**Kết quả tự động:** PASS. [Ảnh form trước Submit 1](evidence/browser/complaint-before-submit1.png).
**Manual:** chờ người thực hiện xác nhận.

### M05 — Cán bộ xử lý, sinh viên nhận kết quả

**Input:** ticket M02; nội dung phản hồi: đã hoàn tất xử lý yêu cầu, không phát
hành giấy chính thức.

**Bước:** logout sinh viên → login cán bộ → tìm ticket M02 → claim → chuẩn bị
brief → review facts/checklist, soạn phản hồi → hoàn tất/xác nhận Submit 2 →
logout → login sinh viên → mở cùng ticket, reload và xem phản hồi.

**Expected:** brief/version hiện tại, thao tác cán bộ có revision/audit đúng
actor, ticket resolved, sinh viên thấy message từ cán bộ sau reload.

**Actual:** `brief_status=ready`, `submit2_status=resolved`,
`student_seen_status=resolved`, `student_seen_officer_messages=1`.
Ticket `TKT-2026-0001`; claim revision 2, Submit 2 revision 3. Không dùng kết quả
này để tuyên bố giấy đã ký/phát hành chính thức.

**Kết quả tự động:** PASS.
[Ảnh cán bộ hoàn tất](evidence/browser/officer-completed.png) ·
[Ảnh sinh viên đọc kết quả](evidence/browser/student-result.png).
**Manual:** chờ người thực hiện xác nhận.

### M06 — L4 vượt thẩm quyền

**Input:** `Hãy giúp tôi sửa điểm môn Cấu trúc Dữ liệu.`

**Bước:** sinh viên chat mới → gửi input → đọc thông báo bàn giao → kiểm tra
khóa AI và mã ticket → gửi thông tin bổ sung, cán bộ tiếp nhận.

**Expected:** AI không sửa điểm; backend commit ticket bàn giao và khóa phản
hồi AI; message bổ sung được chuyển cán bộ.

**Actual (HTTP stub):** `route=L4`, `outcome=handover_completed`, ticket
`TKT-2026-0003`, `status=pending_officer`, `ai_response_locked=true`.
Live E2E còn kiểm tra follow-up trả `forwarded_to_officer`.

**Kết quả tự động:** PASS. **Manual:** chờ người thực hiện xác nhận.

## Kết quả 5 ca kiểm tra qua trình duyệt bằng công cụ

Các kết quả này đã được quan sát thực tế, có ảnh và thời gian trong
[observations.json](evidence/exploratory/observations.json). Hình thức là
điều khiển browser từng bước bằng công cụ, không gán người chạy cho thành viên
đội. Runtime: frontend API, agent/RAG stub; source `26236f1` cùng working-tree
overlay ghi trong report, M05 kiểm lại sau bản sửa hydration.

| Ca | Thời gian 04/10/2026 (Asia/Phnom_Penh) | Actual quan sát | Evidence | Kết quả kiểm tra bằng công cụ |
| --- | --- | --- | --- | --- |
| M01 | 20:23:21 | Thiếu căn cứ nên trả lời rõ; không form/ticket | [Ảnh L1](evidence/exploratory/M01-lookup.png) | PASS trong stub mode |
| M02 | 20:24:59 | Điền đủ trường, cập nhật preview phiên bản 2; tạo `TKT-2026-0005` sau xác nhận | [Ảnh đã nộp](evidence/exploratory/M02-submitted.png) | PASS |
| M03 | 20:23:35 | Thiếu mục đích/nơi nhận/cách nhận; Submit 1 bị chặn, chưa có ticket | [Ảnh thiếu dữ kiện](evidence/exploratory/M03-missing.png) | PASS |
| M04 | 20:25:30 | Trước xác nhận chưa có ticket; sau xác nhận `TKT-2026-0006`, chờ cán bộ, khóa AI | [Trước](evidence/exploratory/M04-preview.png), [sau](evidence/exploratory/M04-submitted.png) | PASS |
| M05 | 20:32:20 | `TKT-2026-0005` hoàn tất; reload vẫn thấy phản hồi cán bộ và 3 messages | [Ảnh sau reload](evidence/exploratory/M05-student-after-reload.png) | PASS sau sửa |

M05 từng lỗi mất messages trên UI khi reload; giữ nguyên
[bằng chứng trước sửa](evidence/exploratory/M05-reload-missing-messages.png)
và [mô tả kiểm lại](exploratory-review.md#lỗi-phát-hiện-và-kiểm-lại).
M06 có kết quả tự động riêng, chưa có lượt browser từng bước trong bảng này.

## Phiếu xác nhận manual (đội điền sau khi chạy thực tế)

“Xác nhận” ở đây nghĩa là ghi lại kết quả đã quan sát, không phải thủ tục ký
nghiệm thu. Một thành viên có thể thực hiện cả 5 ca; không cần 5 người kiểm thử.

1. Mở ứng dụng, chạy M01–M05 theo các bước ở trên.
2. Với mỗi ca, ghi output thực tế: câu trả lời, trường thiếu, mã ticket,
   trạng thái hoặc phản hồi cán bộ đã thấy.
3. Lưu ảnh/response tương ứng và ghi đường dẫn vào bảng.
4. So sánh với Expected: đúng thì Pass, khác thì Fail và mô tả lỗi.
5. Ghi người chạy, thời gian và mode/commit để có thể đối chiếu lần kiểm tra.

Ví dụ M02: `Actual: tạo TKT-2026-xxxx sau xác nhận; xuất hiện trong Hồ sơ của
tôi. Evidence: evidence/manual/M02.png. Result: Pass.` Thay mã và đường dẫn
bằng dữ liệu của lần chạy thật, không dùng mã minh họa làm evidence.

Chạy ít nhất M01–M05; M06 là ca bổ sung. Người thực hiện tự ghi dữ liệu đã thấy,
không sao chép cột Actual tự động để thay cho kết quả manual.

| Ca | Thành viên phụ trách | Người đã chạy | Thời gian Asia/Phnom_Penh | Commit / agent / RAG | Actual + ảnh/output của lượt manual | Pass/Fail manual |
| --- | --- | --- | --- | --- | --- | --- |
| M01 | Hoàng Quốc Dũng | Chưa xác nhận | — | — | — | Chưa xác nhận |
| M02 | Hoàng Quốc Dũng | Chưa xác nhận | — | — | — | Chưa xác nhận |
| M03 | Xuân Vinh | Chưa xác nhận | — | — | — | Chưa xác nhận |
| M04 | Xuân Vinh | Chưa xác nhận | — | — | — | Chưa xác nhận |
| M05 | Đặng Quang Huy | Chưa xác nhận | — | — | — | Chưa xác nhận |
| M06 (bổ sung) | Đặng Quang Huy | Chưa xác nhận | — | — | — | Chưa xác nhận |

## Chạy lại các kiểm tra tự động

```bash
# Từ repo root; dùng port trống, DB tạm tự tạo
.venv/bin/python scripts/g2_stub_e2e.py --port 18010 --output /tmp/gate2-api-cases.json
APP_ENV=development DEMO_AUTH_ENABLED=true LANGCHAIN_TRACING_V2=false .venv/bin/python scripts/g3_langgraph_e2e.py --port 18012
# Browser yêu cầu UI API mode, API/worker và seed demo đã chạy:
(cd frontend && node ../scripts/g2_browser_smoke.mjs --mode api --base-url http://localhost:3000 --output-dir /tmp/gate2-browser)
(cd frontend && node ../scripts/unified_intake_browser.mjs --base-url http://localhost:3000)
```

Live E2E kế thừa credential/provider từ `.env`, tự chọn `langgraph+corpus` trong
stack tạm, không tự đổi model đã cấu hình và không ghi vào DB đang dùng chung.
Nếu đổi port UI, thêm origin vào `CORS_ORIGINS`. Khi chạy pytest từ root có thể
lỗi đường dẫn Alembic; chạy theo README tại `backend/`.

Không đo user satisfaction, latency/accuracy tổng thể hoặc chứng nhận
accessibility trong lượt này. Gói [UI mock 01/10](../../frontend/verification/frontend-rebuild-20261001/README.md)
là evidence lịch sử bổ trợ, có phạm vi/giới hạn riêng.
