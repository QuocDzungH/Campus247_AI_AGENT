# Quy trình Campus 24/7 (chốt)

**Dự án:** EDU-14 / P-120
**Phạm vi demo:** giấy xác nhận sinh viên (E2E hai giai đoạn) + L4 khiếu nại/handover.
**Prototype UI:** dựng mới React/Next.js bằng Antigravity từ bộ ảnh Stitch do người dùng cung cấp; có chế độ sáng/tối.
Chi tiết checklist: [Pipeline L2 · L3 · L4](Pipeline-L2-L3-L4.md)

Demo: `SV001` Nguyễn Văn An · `OF001` Cán bộ hỗ trợ học vụ.

---

## 1. Luồng sản phẩm (AI làm gần hết, người review trước submit)

```text
SV chat
        ├── chỉ hỏi quy chế              → L1 (có nguồn, không ticket)
        ├── xin giấy xác nhận sinh viên  → L2 Submit 1 → L3 Submit 2
        └── khiếu nại / nhạy cảm         → L4 (AI dừng) → L3 Submit 2
```

| Submit | Ai review | Nộp gì |
|---|---|---|
| **Submit 1** | Sinh viên | Ticket/hồ sơ vào hệ thống trường |
| **Submit 2** | Cán bộ | Phản hồi / hoàn tất trên ticket |

Submit **không** xuất PDF giấy đã ký. AI không tự nộp, không tự `resolved`.

| Giai đoạn | Làm gì | Làm như thế nào |
|---|---|---|
| **L2 — SV + AI** | Điền sẵn yêu cầu giấy | Prefill tên/MSSV → hỏi thiếu → preview → SV review → Submit 1 → mã `open` |
| **L3-P — AI** | Chuẩn bị hồ sơ cho CB | `priority` + tóm tắt + checklist + draft (chưa gửi) |
| **L3-A — CB + AI** | Xử lý ticket | CB review → Submit 2 gửi tin hoặc Hoàn tất |
| **L3-B — SV** | Theo dõi | Cùng mã, cùng nhãn trạng thái với CB |
| **L4** | Phanh + bàn giao | Nhận diện → dừng AI → ticket `complaint` `high` + lý do → L3 |

Trạng thái ticket: `open` Mới tiếp nhận → `pending_officer` Chờ cán bộ → `resolved` Đã hoàn tất.

---

## 2. Thứ tự làm kỹ thuật

Prototype cũ đã được xóa. Dựng mới project trong `frontend/` từ bộ ảnh Stitch được người dùng chọn. Giữ asset tại `frontend/public/assets/`; không khôi phục component, CSS hoặc mock store cũ từ Git history.

Prototype React **mới** sẽ trở thành nền frontend cho giai đoạn nối API. Đợt dựng giao diện dùng mock để kiểm chứng thiết kế và tương tác; việc nghiệm thu backend thật vẫn theo pipeline/plan.

```text
1. Ảnh Stitch được cung cấp → prototype React mới (sáng/tối + data giả)
        ↓
2. Database (schema ticket / user / message / log)
        ↓
3. API contract (Pydantic / OpenAPI)
        ↓
4. App React mới: thay mock bằng gọi API
        ↓
5. Backend FastAPI + LangGraph (+ Chroma L1)
        ↓
6. Nối E2E giấy + L4 → deploy
```

Frontend và agent có thể song song **sau khi** đã có schema + contract.

### Màn React tối thiểu

1. Welcome (`/`) — giới thiệu/chọn cổng, ảnh nền và lớp kính bán trong suốt
2. Login (`/login`) — đăng nhập demo theo vai trò, cùng phong cách kính
3. Chat SV (hỏi ≠ nộp + CTA xin giấy)
4. Modal Submit 1 (preview giấy)
5. Chat có mã ticket
6. Handover L4 (AI dừng trả lời conversation đã bàn giao)
7. Yêu cầu của tôi
8. Dashboard CB (ưu tiên có lý do)
9. Chi tiết ticket (OfficerBrief + Submit 2)

---

## 3. Công nghệ

| Lớp | Công nghệ |
|---|---|
| Prototype / frontend | **Next.js** (App Router) + TypeScript + Tailwind |
| Backend API | **FastAPI** + Uvicorn + Pydantic |
| Agent | **LangGraph** + LangChain + LLM (OpenAI hoặc Groq) |
| RAG (L1) | **ChromaDB** + embedding |
| Database | **Postgres** (Supabase) hoặc SQLite lúc dev + SQLAlchemy |
| Deploy | Docker + Render (API) + Vercel (Next) |

Design: bám bộ ảnh Stitch mới, hỗ trợ cả sáng/tối qua semantic tokens; welcome/login dùng ảnh nền campus và kính bán trong suốt. Các màn nghiệp vụ ưu tiên đọc dữ liệu, badge có chữ; bố cục/typography theo ảnh tham chiếu và prompt hiện hành.

---

## 4. Bốn luồng

| Luồng | Việc |
|---|---|
| **L1** | Tra cứu quy chế có nguồn |
| **L2** | Giấy xác nhận SV — Submit 1 |
| **L3** | Hồ sơ cán bộ + SV theo dõi — Submit 2 |
| **L4** | Khiếu nại / handover |

---

## Lịch sử

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 0.1 | 2026-09-23 | Gom luồng mentor + thứ tự React → DB → API → backend |
