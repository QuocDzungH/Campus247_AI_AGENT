# Quy trình Campus 24/7 (chốt)

**Dự án:** EDU-14 / P-120  
**Phạm vi demo:** giấy xác nhận sinh viên (E2E hai giai đoạn) + L4 khiếu nại/handover.  
**Prototype UI:** React (không dùng Stitch).  
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

Prototype React **chính là nền frontend**. Sau schema + API thì nối, không dựng UI lần hai.

```text
1. Prototype React (màn + data giả)
        ↓
2. Database (schema ticket / user / message / log)
        ↓
3. API contract (Pydantic / OpenAPI)
        ↓
4. Cùng app React: thay mock bằng gọi API
        ↓
5. Backend FastAPI + LangGraph (+ Chroma L1)
        ↓
6. Nối E2E giấy + L4 → deploy
```

Frontend và agent có thể song song **sau khi** đã có schema + contract.

### Màn React tối thiểu

1. Login 2 vai  
2. Chat SV (hỏi ≠ nộp + CTA xin giấy)  
3. Modal Submit 1 (preview giấy)  
4. Chat có mã ticket  
5. Handover L4 (AI câm)  
6. Yêu cầu của tôi  
7. Dashboard CB (ưu tiên AI)  
8. Chi tiết ticket (hồ sơ AI + Submit 2)

---

## 3. Công nghệ

| Lớp | Công nghệ |
|---|---|
| Prototype / frontend | **Next.js** (App Router) + TypeScript, hoặc Vite + React |
| Backend API | **FastAPI** + Uvicorn + Pydantic |
| Agent | **LangGraph** + LangChain + LLM (OpenAI hoặc Groq) |
| RAG (L1) | **ChromaDB** + embedding |
| Database | **Postgres** (Supabase) hoặc SQLite lúc dev + SQLAlchemy |
| Deploy | Docker + Render (API) + Vercel (Next) |

Design: Inter, nền `#F5F7FB`, primary `#2457D6`, sidebar 248px, badge có chữ.

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
