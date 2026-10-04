# Gate 2 — MVP: bộ tài liệu nộp

Dự án **Campus 24/7 — EDU-14 / P-120**. Cập nhật **04/10/2026**,
Asia/Phnom_Penh. Nhánh **`feat/gate-2-mvp`**, đã đồng bộ với nhánh tích hợp
`feat/connect-frontend-backend`, gồm các sửa CI/schema/PDF mới nhất.

## Deliverables

| Yêu cầu | Hồ sơ / bằng chứng | Trạng thái |
| --- | --- | --- |
| Video MVP 3 phút, flow end-to-end | [Kịch bản 3 phút](demo-script.md) | Người phụ trách quay sau; chưa có video/URL |
| Architecture diagram: components, data flow | [Architecture + Mermaid](architecture.md) | Đã cập nhật theo code tích hợp |
| Repo có ≥10 PR merged | [Snapshot GitHub](merged-prs.json), [chi tiết PR](pull-requests.md) | **9/10**, còn cần 1 PR được merge |
| README: setup, env vars, sample queries | [README sản phẩm](../../README.md), [frontend config mẫu](../../frontend/.env.example) | Đã hoàn thiện |
| ≥5 ca manual có output thực tế | [Evaluation và 6 ca](evaluation.md), [lượt điều khiển từng bước](exploratory-review.md) | Có input/bước/expected/actual, HTTP outputs và ảnh UI; kiểm tra bởi Codex, thành viên đội chưa xác nhận manual |

Không tuyên bố Gate 2 đã pass khi còn thiếu video, PR thứ 10 và nghiệm thu
manual của thành viên đội. Các kiểm tra bằng tool được ghi rõ người thực hiện
và hình thức; không dùng kết quả tự động để thay tên người chạy manual.

## Chạy và review bộ nộp

1. Làm theo [setup tại repo root](../../README.md#setup-local-bash-linuxmacos)
   để migrate/seed cùng DB và khởi động API, worker, frontend API mode.
2. Chốt cấu hình demo: stub để kiểm tra luồng deterministic; LangGraph với
   provider thật nếu trình diễn AI. Ghi rõ RAG demo/official/pipeline.
3. Review [components và sequence data flow](architecture.md).
4. Chạy M01–M05 theo [evaluation](evaluation.md), điền người chạy, thời gian,
   commit/mode, actual và Pass/Fail; M06 là ca bổ sung. Đã có output tham chiếu
   thực tế và ảnh riêng cho từng đường đi.
5. Review/merge thêm một PR phù hợp, cập nhật snapshot GitHub; quay video
   theo [demo script](demo-script.md) trên cùng phiên bản và bổ sung URL.

## Kiểm chứng kỹ thuật

- Backend: **361 passed**, gồm PostgreSQL schema/JSONB và concurrent claim.
- Ruff và OpenAPI artifacts: **PASS**.
- Frontend regression: **8 script, 91 PASS assertions**.
- Frontend ESLint: **0 errors, 2 warnings** `react-hooks/exhaustive-deps`
  có sẵn; log nêu rõ vị trí.
- Production build: **PASS**, Next.js 16.3.6, webpack, API mode; build riêng
  tại checkout tạm để giữ môi trường frontend local của người dùng.
- HTTP E2E: **6 ca PASS**, agent/RAG stub, DB tạm; có output từng ca.
- Live LangGraph E2E: **PASS**, `gemini-3.5-flash-lite`, demo corpus;
  citation/provenance, brief, Submit 2, sinh viên nhận kết quả và L4 follow-up.
- Browser: API flow và unified complaint/certificate flow; [report/log](evidence/verification.json).
- Lượt exploratory phát hiện race khi reload deep link mất messages; bản
  sửa chờ hydration hoàn tất trước tải detail và có regression reload trì
  hoãn hydration. Bằng chứng trước/sau nằm trong [exploratory review](exploratory-review.md).

[Manifest checks và source hashes](evidence/verification.json) phân biệt source
commit/working tree với artifact build. Các DB tạm độc lập và chỉ có synthetic
accounts; không dùng bộ chứng cứ này để công bố độ chính xác AI tổng thể.

## Vị trí các phần đã gom

```text
docs/gate-2/
  README.md                 Index, checklist và trạng thái nộp
  architecture.md           Components, data flow, LangGraph, runtime modes
  evaluation.md             6 ca với bước/expected/actual và phiếu manual
  exploratory-review.md     Lượt browser điều khiển từng bước bởi Codex
  demo-script.md            Kịch bản video 3 phút
  pull-requests.md           9 PR merged, phần cần hoàn tất
  pr-description.md          Nội dung PR Gate 2 để review
  merged-prs.json            Snapshot GitHub hiện tại
  evidence/                 API JSON, live E2E, log, ảnh browser, source hashes
  audit-initial.md           Lượt audit cũ (lưu lịch sử, không dùng trạng thái cũ để nộp)
```

README/architecture/eval entrypoint cũ đã trỏ đến bộ Gate 2, tránh hai tài liệu
hiện hành mâu thuẫn. Bản kiến trúc lịch sử được giữ tại
[archive-20260926.md](../architecture/archive-20260926.md).

## Phần đội cần hoàn tất trước nộp

- [ ] Một PR nữa được **merge thật** để tổng số ≥10; PR mở chưa được tính.
- [ ] Thành viên chạy/xác nhận ít nhất M01–M05 trên runtime sẽ quay demo.
- [ ] Video 3 phút: bổ sung URL, ngày quay, commit và mode vào đây.

Người quay: chưa xác nhận. Video URL: chưa có. Commit/mode của video: điền
sau khi quay thực tế. Không điền thông tin chưa có bằng chứng.
