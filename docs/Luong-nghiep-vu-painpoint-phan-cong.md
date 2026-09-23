# Luồng nghiệp vụ × Painpoint × Phân công 4 luồng

**Dự án:** Campus 24/7 (EDU-14 / P-120)  
**Mục đích:** Mỗi **luồng L1–L4** là một nghiệp vụ end-to-end — painpoint nào, bước nào, khi nào bàn giao luồng khác.  
Chia theo **luồng**, không theo stack kỹ thuật (UI / RAG / deploy) và không gắn tên thành viên.

Tham chiếu: [BRD](gate-1/00-brd.md) · [Brief](gate-1/01-brief.md) · [PRD](gate-1/02-prd.md) · [Phân công Gate 1](Phan-cong-nhiem-vu.md)

---

## 1. Bản đồ nhanh

| Luồng | Nghiệp vụ | Painpoint chính được gỡ |
|---|---|---|
| **L1** | Tra cứu quy chế có nguồn | SV ngoài giờ không tìm được điều đúng; sợ thông tin sai/bịa |
| **L2** | Giấy xác nhận SV (SV + AI, Submit 1) | Ngoài giờ không gửi được; form thiếu; hỏi ≠ đã nộp |
| **L3** | Hàng chờ cán bộ (HITL) + theo dõi ticket | CB quá tải FAQ & thiếu ngữ cảnh; SV mất trạng thái yêu cầu |
| **L4** | Ca nhạy cảm / khẩn → handover người thật | Khiếu nại, mệt/muốn nghỉ học không có lối chuyển; AI dễ vượt thẩm quyền |

> **Ghi chú:** Pipeline (giấy E2E + L4, **bỏ đặt phòng**): [L2 · L3 · L4](Pipeline-L2-L3-L4.md). L2 giai đoạn 1: [giấy xác nhận SV](L2-Tiep-nhan-yeu-cau-dich-vu.md). L3 giai đoạn 2: [CB + AI](L3-Hang-cho-can-bo-theo-doi-ticket.md).

---

## 2. L1 — Tra cứu quy chế có nguồn

**Đang làm gì:** Luồng “SV hỏi → được hướng dẫn có căn cứ”.

### Painpoint → cách giải quyết

| Painpoint | Cách luồng giải quyết |
|---|---|
| Quy chế nằm rải rác PDF/web, SV không biết điều nào áp dụng | Hỏi bằng tiếng Việt, hệ thống tìm đúng đoạn quy chế |
| Chatbot hay bịa điều khoản | Chỉ trả lời khi có nguồn; thiếu nguồn thì nói rõ + mời hỗ trợ |
| Câu hỏi mơ hồ bị đoán sai | Hỏi lại trước khi khẳng định quy định |
| CB mất thời gian trả lời FAQ lặp | SV tự phục vụ được phần tra cứu phổ biến |

### Các bước nghiệp vụ cần nắm

1. SV đặt câu hỏi thủ tục/quy chế.
2. Làm rõ nếu thiếu ngữ cảnh.
3. Trả lời ngắn + trích nguồn (tài liệu / điều / trang).
4. Không đủ căn cứ → không bịa → gợi ý tạo yêu cầu hỗ trợ (sang L2 hoặc L4).

### Done của L1

- SV đối chiếu được nguồn.
- Không tạo ticket chỉ vì đang hỏi.

---

## 3. L2 — Giấy xác nhận sinh viên (SV + AI → Submit 1)

**Đang làm gì:** AI điền gần hết yêu cầu giấy; **SV review rồi nộp ticket** vào hệ thống trường.  
**Chi tiết:** [L2](L2-Tiep-nhan-yeu-cau-dich-vu.md) · [Pipeline](Pipeline-L2-L3-L4.md)

Đặt phòng **không** nằm demo. Khiếu nại thuộc L4.

### Painpoint → cách giải quyết

| Painpoint | Cách luồng giải quyết |
|---|---|
| Ngoài giờ không gửi được yêu cầu cấp giấy | Chat 24/7, AI dẫn điền |
| Form thiếu data | Prefill tài khoản + hỏi field thiếu |
| Sợ hệ thống tự gửi nhầm | SV review preview rồi Submit 1 |
| Không biết đã vào hệ thống chưa | Mã ticket + Mới tiếp nhận |

### Các bước

1. SV muốn xin **giấy xác nhận sinh viên**.
2. AI prefill + hỏi thiếu → preview.
3. SV review → Xác nhận = Submit 1 (ticket), Hủy = không nộp.
4. Mã + trạng thái; tóm tắt sang L3 (CB + AI giai đoạn 2).

### Done của L2

- Hủy = không ticket. Đổi nội dung = review lại.
- Hỏi ≠ đã nộp. Thành công = đã nộp yêu cầu, không cấp giấy.

---

## 4. L3 — Hàng chờ cán bộ + theo dõi yêu cầu (HITL vận hành)

**Đang làm gì:** Luồng “có ticket rồi → CB xử lý có ngữ cảnh → SV thấy cập nhật”.  
**Chi tiết:** [L3 — Hàng chờ cán bộ + theo dõi](L3-Hang-cho-can-bo-theo-doi-ticket.md)

Ticket = hồ sơ đã có (Submit 1 hoặc L4). L3 = **CB + AI**: AI chuẩn bị hồ sơ; CB review rồi Submit 2. Đặt phòng không vào hàng chờ.

### Painpoint → cách giải quyết

| Painpoint | Cách luồng giải quyết |
|---|---|
| CB bị dồn việc, khó ưu tiên | Dashboard lọc theo trạng thái / ưu tiên / loại |
| Tiếp nhận ca mà không biết SV đã hỏi gì | Xem tóm tắt + hội thoại bàn giao trên ticket |
| SV gửi xong “mất hút” | SV xem mã, trạng thái, phản hồi của đúng yêu cầu mình |
| Khó truy trách nhiệm | Có lịch sử: ai phản hồi, đổi trạng thái thế nào |
| Gửi một tin bị hiểu là đã xong | Phản hồi ≠ hoàn tất; phải bấm Hoàn tất |

### Các bước nghiệp vụ cần nắm

1. Ticket vào hàng chờ (từ L2 hoặc L4).
2. CB tìm/lọc, mở đúng hồ sơ được phân quyền.
3. Xem ngữ cảnh → phản hồi / yêu cầu bổ sung / hoàn tất.
4. Cập nhật trạng thái (`open` → `pending_officer` → `resolved`).
5. SV thấy cập nhật trên cổng của mình.

### Hai nhánh trong L3

- **Hàng chờ cán bộ:** `OF001` lọc → mở hồ sơ có ngữ cảnh → phản hồi / hỏi bổ sung / hoàn tất.
- **SV theo dõi:** `SV001` xem mã, trạng thái, phản hồi của đúng ticket mình.

### Done của L3

- Hai vai trò khép được một ticket từ đầu đến cuối.
- Phản hồi ≠ tự đóng ticket.
- Không lộ dữ liệu sang tài khoản khác.

---

## 5. L4 — Ca nhạy cảm / khẩn → handover

**Đang làm gì:** Luồng “phát hiện vượt thẩm quyền AI → dừng → chuyển người đúng chỗ”.

### Painpoint → cách giải quyết

| Painpoint | Cách luồng giải quyết |
|---|---|
| Khiếu nại điểm / bức xúc không có người nhận kịp | Tạo ticket chuyển cán bộ, có lý do + ưu tiên |
| Ca mệt / muốn nghỉ học nếu chatbot “cố lên” thì sai phạm | AI dừng tư vấn; chuyển hàng chờ phù hợp + thông báo cố định |
| Ca rủi ro lẫn trong FAQ thường | Tách khỏi luồng tra cứu; không để AI tự xử lý tiếp |
| Sợ báo “đã chuyển” khi thực tế thất bại | Chỉ báo thành công khi handover ghi nhận thật |

### Các bước nghiệp vụ cần nắm

1. Nhận diện tín hiệu nhạy cảm / khẩn / vượt quyền.
2. Dừng nhánh lookup/action trên nội dung đó.
3. Tạo bàn giao: lý do + tóm tắt + ngữ cảnh hội thoại.
4. Đưa vào hàng chờ L3; SV thấy mã + thông báo chờ cán bộ.
5. AI không tiếp tục “tư vấn” trên thread đã handover.

### Done của L4

- Ca bắt buộc trong bộ test đều vào đúng hàng chờ.
- SV/CB thấy trạng thái thật.

---

## 6. Phụ thuộc giữa các luồng

```text
L1 Tra cứu
        │ hết nguồn / cần người
        ▼
L2 Tiếp nhận giấy ──Submit 1──► L3 Hàng chờ & theo dõi
        │
        │ gặp tín hiệu nhạy cảm
        ▼
L4 Handover ca rủi ro ─────────► L3
```

| Tình huống | Luồng dẫn | Bàn giao |
|---|---|---|
| “Xin giấy cần gì, nộp đâu?” | **L1** | L2 nếu SV bấm tạo yêu cầu |
| “Tạo giúp em yêu cầu cấp giấy” | **L2** | L3 khi ticket vào dashboard |
| “CB duyệt / trả lời / đóng ticket” | **L3** | L2 chốt rule trạng thái Submit 1 |
| “Em mệt quá / khiếu nại điểm” | **L4** | L1 (nhận diện) + L3 (hàng chờ) |

---

## 7. Một câu mỗi luồng

| Luồng | Câu nhớ |
|---|---|
| **L1** | SV **hỏi đúng – có nguồn – không bịa**. |
| **L2** | SV **điền đúng – review – Submit 1 – có mã yêu cầu**. |
| **L3** | CB **thấy hàng chờ – hồ sơ AI – review rồi Submit 2**; SV **theo dõi được**. |
| **L4** | Ca **rủi ro được chuyển người – AI dừng đúng lúc**. |

---

## 8. Lịch sử tài liệu

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 0.1 | 2026-09-23 | Tạo file: chia 4 luồng nghiệp vụ × painpoint × owner |
| 0.2 | 2026-09-23 | L2 khóa giấy + đặt phòng; dẫn sang file tổng hợp L2 |
| 0.3 | 2026-09-23 | L3 dẫn sang file tổng hợp: hàng chờ + theo dõi |
| 0.4 | 2026-09-23 | Thêm pipeline L2·L3·L4 kiểu checklist |
| 0.5 | 2026-09-23 | Đặt phòng tự động khi còn chỗ; hàng chờ L3 chỉ giấy + L4 |
| 0.6 | 2026-09-23 | Mentor: giấy E2E 2 giai đoạn + L4; bỏ đặt phòng |
| 0.7 | 2026-09-23 | Chia việc theo L1–L4, bỏ tên thành viên |
