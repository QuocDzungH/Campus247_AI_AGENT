# Campus 24/7 — frontend

Next.js App Router cho cổng sinh viên và cán bộ. Hướng dẫn chạy đầy đủ backend,
worker, DB và tài khoản: [README gốc](../README.md).

```bash
# Từ frontend/
npm ci
cp .env.example .env.local
npm run dev
```

Mở <http://localhost:3000>. `.env.local` chọn `NEXT_PUBLIC_DATA_MODE=api`,
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` và tắt mode switch. API/worker
phải chạy và DB đã migrate/seed. Đổi public env cần restart/rebuild.
Nếu muốn review UI độc lập, chọn `NEXT_PUBLIC_DATA_MODE=mock` và ghi rõ phạm vi
mock trong evidence; code mặc định mock khi không cấu hình.

```bash
npm run lint
npm run test:regression
npm run build
npm run start
```

Routes chính: `/student`, `/student/assistant`, `/my-requests`, `/dashboard`,
`/tickets/[ticketId]`, `/reviews`. Chat khiếu nại và cấp giấy dùng chung
assistant, có preview và xác nhận Submit 1.

## Thiết kế giao diện với DESIGN.md

[DESIGN.md](./DESIGN.md) chứa mẫu ThoughtStream tải từ designmd.ai và phần điều
chỉnh cho Campus 24/7. [AGENTS.md](./AGENTS.md) yêu cầu AI đọc file này trước khi
sửa UI; `CLAUDE.md` hiện tham chiếu cùng hướng dẫn. Đây là tài liệu thiết kế,
không tự nạp CSS, font hoặc thay đổi giao diện đang chạy.

Mẫu gốc thiên về blog/newsletter. Phần **Campus 24/7 integration** điều chỉnh
mật độ dashboard, bảng, biểu mẫu, nội dung tiếng Việt, contrast và dark mode.
Giao diện hiện tại chưa được chuyển sang ThoughtStream.

Để bắt đầu áp dụng, chọn một màn hình và yêu cầu, ví dụ:

> Đọc frontend/DESIGN.md rồi áp dụng ThoughtStream cho trang /student.
> Giữ các luồng đang hoạt động và kiểm tra trên mobile, desktop, light/dark mode.

Sau khi xem kết quả trên màn hình đầu tiên, tiếp tục chuyển các component dùng
chung và các màn hình còn lại; cập nhật DESIGN.md nếu thay đổi quy tắc thiết kế.

Không cần cài CLI/MCP của designmd.ai để dùng file đã tải. Google Stitch cũng
không bắt buộc: dùng thêm nếu muốn tạo, so sánh hoặc chỉnh mockup trước khi code.
Stitch hỗ trợ nhập/xuất DESIGN.md để trao đổi quy tắc thiết kế giữa công cụ;
xem [giới thiệu DESIGN.md của Google](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/).

[Bộ nộp Gate 2](../docs/gate-2/README.md) ·
[Architecture](../docs/gate-2/architecture.md) ·
[Manual/evidence](../docs/gate-2/evaluation.md).
