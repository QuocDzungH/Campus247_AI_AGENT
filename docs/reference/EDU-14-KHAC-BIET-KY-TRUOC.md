# EDU-14 — Khác biệt với chatbot quy chế kỳ trước

Nhóm **giữ EDU-14**, không đổi đề. Tài liệu này khóa ranh giới với dự án kỳ trước (chatbot tra cứu quy định học vụ + KB trên GitHub) để hội đồng không coi là làm lại.

Tham chiếu đề đầy đủ: [EDU-14-Campus-24-7.md](EDU-14-Campus-24-7.md).

---

## 1. Dự án kỳ trước đang là gì

Từ slide / demo đã xem:

| Khía cạnh | Kỳ trước |
|---|---|
| Tên / việc | Chatbot tra cứu quy định học vụ |
| Kiến trúc | **RAG thuần**: câu hỏi → retrieve → Gemini trả lời |
| KB | File `.md` trên **GitHub**, đọc qua Contents API |
| Index | sentence-transformers + FAISS (local) |
| UI | Streamlit |
| Hành vi phụ | Hỏi lại nếu mơ hồ; gợi ý tài liệu liên quan; báo khi độ tin cậy thấp |
| Eval | Faithfulness, Answer Relevancy, Context Precision/Recall (kiểu RAGAS) |
| Vai trò | Chủ yếu **một** người hỏi |
| Tool / ticket / HITL cán bộ | **Không** (hoặc không phải lõi sản phẩm) |

Đó là **nửa “hỏi có nguồn”** của EDU-14 — và làm khá đủ phần đó.

---

## 2. EDU-14 ngân hàng đề đòi thêm gì

Đề gốc bắt buộc (không optional):

- ≥ **2 vai trò**: SV **và** cán bộ hỗ trợ  
- Không chỉ trả lời: **tiếp nhận / xử lý yêu cầu** (tạo ticket, định tuyến)  
- **HITL**: handover ca nhạy cảm / khẩn cấp; cán bộ xử lý hàng chờ  
- Phân biệt **tra cứu** vs **hành động có xác nhận** (tool-use)  
- Web deploy (không dừng ở notebook/Streamlit demo nếu khóa yêu cầu app)

Nếu nhóm chỉ làm lại “chat + GitHub md + RAGAS” → **trùng kỳ trước**, dù mã đề là EDU-14.

---

## 3. Bảng khác biệt bắt buộc (checklist nghiệm thu nội bộ)

Mỗi dòng **Must** phải có trong demo 8 phút. Thiếu → chưa đủ khác.

| # | Hạng mục | Kỳ trước | EDU-14 nhóm mình (Must) | Có trong demo? |
|---|---|---|---|---|
| 1 | Kiến trúc | RAG pipeline | **Agent router**: `lookup` / `action` / `sensitive` | ☐ |
| 2 | Vai trò | 1 (người hỏi) | **2**: SV + cán bộ (đăng nhập riêng) | ☐ |
| 3 | Hành động | Không / ngoài lõi | Tool **tạo ticket** + SV **xác nhận** trước khi gửi | ☐ |
| 4 | Tool thứ 2 | Không | **Đặt phòng** (hoặc tương đương: giữ chỗ CSV) có conflict/hết slot | ☐ |
| 5 | HITL người thật | “độ tin cậy thấp” trong chat | **Hàng chờ cán bộ**; ca wellbeing/điểm → agent câm, người trả lời trong thread | ☐ |
| 6 | Trạng thái | Hội thoại | Ticket: `draft → chờ xác nhận → chờ cán bộ → xong/từ chối` | ☐ |
| 7 | Audit | Trace RAG | Log: retrieve ids + tool args + ai duyệt | ☐ |
| 8 | Eval | Chỉ RAGAS trên Q–A | **Ba bộ**: RAG vàng + tool/HITL + ca cấm an toàn | ☐ |
| 9 | UI | Streamlit chat | **Hai màn**: chat SV + dashboard cán bộ (không chỉ một khung chat) | ☐ |
| 10 | Pitch 30 giây | “Chatbot RAG GitHub” | “Trợ lý 24/7 **vận hành yêu cầu** học vụ, có người duyệt” | ☐ |

GitHub làm KB **được phép** (thậm chí hay) — nhưng GitHub **không được** là toàn bộ câu chuyện sản phẩm.

---

## 4. Câu pitch phân biệt (học thuộc)

> Kỳ trước: chatbot **tra cứu** quy chế trên kho tài liệu.  
> Nhóm em: agent **vận hành**: trả lời có nguồn **và** tạo/xử lý yêu cầu (giấy tờ, phòng), có **hai vai trò** và **HITL** cho ca rủi ro — không dừng ở hỏi–đáp.

Một câu kỹ thuật:

> Không phải RAGAS-only: có state ticket, tool-use có confirm, và policy cấm agent tự xử lý điểm/tâm lý.

---

## 5. Phạm vi cố ý **không** copy

Làm giống kỳ trước chỉ để có baseline RAG là được; **không** lấy làm demo chính:

- Chỉ Streamlit một trang chat  
- Chỉ metric Faithfulness / Context Recall  
- Chỉ “độ tin cậy thấp → xin hỏi lại” **mà không** có hàng chờ cán bộ  
- KB GitHub là điểm bán duy nhất trên slide  

Được tái sử dụng ý tưởng (không copy code nếu không được phép):

- Chunk quy chế theo điều  
- Citation  
- Hỏi lại khi câu mơ hồ  
- Eval RAGAS **như một phần** bộ eval (phần còn lại là tool + an toàn)

---

## 6. MVP 3 sprint (khác kỳ trước từ sprint 1)

| Sprint | Việc | Khác kỳ trước ngay |
|---|---|---|
| 1 | Router 3 intent + RAG citation + **màn cán bộ trống** (login 2 role) | Đã có 2 role trước khi polish RAG |
| 2 | `create_ticket` + confirm SV + hàng chờ duyệt | Có hành động + HITL |
| 3 | `book_room` + hết slot + ca wellbeing handover + eval 3 bộ + demo | Đủ checklist mục 3 |

**Không** dành cả sprint 1–2 chỉ để “RAG đẹp hơn kỳ trước”.

---

## 7. Slide so sánh (1 slide, nên có)

| | Kỳ trước | EDU-14 nhóm này |
|---|---|---|
| Việc | Tra cứu quy chế | Tra cứu **+** xử lý yêu cầu |
| Actor | Người hỏi | SV + cán bộ |
| Core | RAG + GitHub | Agent + tools + HITL |
| Khi rủi ro | Báo low confidence | **Chuyển người**, agent dừng |
| Thành công | Câu trả lời đúng nguồn | Ticket đóng / phòng giữ / ca escalate đúng |

---

## 8. Rủi ro còn lại và cách chặn

| Rủi ro | Chặn |
|---|---|
| Hội đồng: “Giống nhóm trước” | Slide mục 7 + demo ticket/HITL trước, RAG sau |
| Team lại chìm vào FAISS/GitHub | Giới hạn 2 ngày cho KB; ngày 3 phải có ticket schema |
| Làm 4 tool + Canvas | Cắt: chỉ ticket + phòng; không LMS |
| Eval chỉ RAGAS | Bắt buộc 15 case an toàn + 20 case tool trong báo cáo |

---

## 9. Chốt

- **Giữ EDU-14.**  
- Sản phẩm = **agent vận hành học vụ**, không = chatbot GitHub.  
- GitHub/md/RAGAS là **hạ tầng KB + một phần eval**, không phải định nghĩa đề.  
- Nghiệm thu nội bộ = checklist mục 3 đủ tick trước demo chính thức.
