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

[Bộ nộp Gate 2](../docs/gate-2/README.md) ·
[Architecture](../docs/gate-2/architecture.md) ·
[Manual/evidence](../docs/gate-2/evaluation.md).
