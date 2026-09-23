# Pipeline L2 · L3 · L4 — giấy xác nhận SV + khiếu nại (checklist)

**Dự án:** Campus 24/7 (EDU-14 / P-120)  
**Phạm vi:** (1) **Giấy xác nhận sinh viên** end-to-end hai giai đoạn · (2) **L4 khiếu nại / handover**.

**Cách dùng:** mỗi bước là việc demo/test. Tick khi đúng **điều kiện pass**. Bước **(AI)** phải nhìn thấy agent đang làm việc.

Demo: `SV001` Nguyễn Văn An · `OF001` Cán bộ hỗ trợ học vụ.

Tham chiếu: [L2](L2-Tiep-nhan-yeu-cau-dich-vu.md) · [L3](L3-Hang-cho-can-bo-theo-doi-ticket.md) · [Phân công](Luong-nghiep-vu-painpoint-phan-cong.md)

---

## 0. Nguyên tắc mentor

AI chạy **gần hết quy trình**. **Người chỉ review bắt buộc trước mỗi lần submit.**

| Submit | Ai review | Nộp cái gì |
|---|---|---|
| **Submit 1** | **Sinh viên** | Yêu cầu (ticket/hồ sơ) vào hệ thống trường |
| **Submit 2** | **Cán bộ** | Xử lý trên ticket (phản hồi / chuyển trạng thái / hoàn tất) |

Submit **không** phải xuất PDF giấy đã ký. AI **không** tự nộp khi chưa có review của đúng người ở cổng đó.

```text
SV chat
        │
        ├── chỉ hỏi quy chế              → L1 (có nguồn, không ticket)
        ├── xin giấy xác nhận sinh viên  → L2 (SV+AI) → Submit 1 → L3 (CB+AI) → Submit 2
        └── khiếu nại / nhạy cảm         → L4 (AI dừng + bàn giao) → L3 (CB+AI) → Submit 2
```

Chuỗi giá trị AI: **điền sẵn & dẫn quy trình (L2) → chuẩn bị hồ sơ & ưu tiên cho CB (L3) → nhận diện & dừng đúng lúc (L4).**

| L | AI làm gần hết | Người review / submit | AI không làm |
|---|---|---|---|
| **L2** | Prefill, hỏi thiếu, gom hồ sơ giấy, hiện preview | SV review → **Submit 1** (tạo ticket) | Nộp khi SV chưa xác nhận; cấp giấy PDF |
| **L3** | Tóm tắt, checklist xử lý, draft phản hồi, gắn ưu tiên | CB review → **Submit 2** (gửi / hoàn tất) | Tự gửi hộ; tự `resolved` |
| **L4** | Nhận diện, dừng tư vấn, bàn giao + `high` + lý do | SV không “xác nhận cấp giấy”; CB review trên L3 | Tư vấn điểm/tâm lý; báo đã chuyển khi ghi fail |

---

## L2 — Giai đoạn 1: SV + AI

**Làm gì:** AI dẫn SV điền sẵn thông tin giấy xác nhận sinh viên đến sát nút nộp.  
**Làm như thế nào:** prefill tài khoản → hỏi field thiếu → preview → **SV review** → Submit 1 → ticket `action` `open`.

### L2-R. Router

- [ ] **R1.** Đăng nhập `SV001`.
- [ ] **R2. (AI)** Chỉ hỏi “cần gì / nộp đâu?” → L1, **không** ticket.
- [ ] **R3. (AI)** Khiếu nại / mệt / sửa điểm → **L4**, không chạy giấy trong lượt đó.
- [ ] **R4. (AI)** “Xin / tạo yêu cầu giấy xác nhận sinh viên” → **L2-A**.

### L2-A. Xin giấy xác nhận sinh viên → Submit 1

```text
(AI) Prefill họ tên + MSSV
  → (AI) Điền / hỏi: loại giấy, mục đích, field thiếu
  → Preview hồ sơ yêu cầu
       ├─ Hủy            → không ticket
       ├─ Đổi nội dung   → preview mới, SV review lại
       ├─ SV Xác nhận    → Submit 1 → ticket action + mã open → L3
       └─ API lỗi        → báo chưa nộp, không mã giả
```

- [ ] **A1.** SV muốn **tạo yêu cầu** (không chỉ hỏi thủ tục).
- [ ] **A2. (AI)** Prefill họ tên + MSSV từ session.
- [ ] **A3. (AI)** Loại giấy = **Giấy xác nhận sinh viên** (hỏi nếu chưa nói). Không bịa field.
- [ ] **A4. (AI)** Mục đích (ngân hàng / visa / thực tập…). Thiếu thì hỏi trên chat.
- [ ] **A5. (AI)** Preview đủ field sẽ nộp. Phụ đề: *Yêu cầu chỉ được nộp sau khi bạn review và xác nhận.*
- [ ] **A6.** Hủy → không ticket.
- [ ] **A7. (AI)** Đổi mục đích/loại trên chat → preview cũ hết → SV review lại.
- [ ] **A8. Submit 1.** SV bấm Xác nhận → nộp **yêu cầu vào hệ thống** (`category: action`, `confirmed: true`).
- [ ] **A9. (AI)** Thành công: mã thật + **Mới tiếp nhận**. Câu: **đã nộp yêu cầu**, không nói giấy đã cấp / đã ký.
- [ ] **A10.** Lỗi ghi → chưa nộp được, không mã giả.
- [ ] **A11.** Gửi lại không tạo ticket trùng.
- [ ] **A12. (AI → L3)** Ticket vào hàng chờ kèm tóm tắt + field đã điền sẵn cho CB.

Pass L2-A: AI điền gần hết · A5 SV review · A8 mới có ticket · A9 không cấp giấy.

---

## L3 — Giai đoạn 2: CB + AI

**Làm gì:** AI chuẩn bị hồ sơ xử lý trên ticket; CB review rồi mới submit xử lý. SV theo dõi cùng trạng thái.  
**Làm như thế nào:** AI gắn ưu tiên + checklist + draft → CB đọc/sửa → Submit 2 (phản hồi hoặc hoàn tất).

Hàng chờ nhận: ticket **giấy (L2-A)** và **L4**.

Trạng thái: `open` Mới tiếp nhận → `pending_officer` Chờ cán bộ → `resolved` Đã hoàn tất.

### L3-P. AI chuẩn bị hồ sơ (trước khi CB mở)

- [ ] **P1. (AI)** Ticket giấy thường: `priority: normal` + tóm tắt 1–2 câu từ field SV đã xác nhận.
- [ ] **P2. (AI)** Ticket gấp (deadline / “còn X giờ”): `high` + deadline trong tóm tắt.
- [ ] **P3. (AI)** Ticket L4: `high` + `handover_reason` + tóm tắt.
- [ ] **P4. (AI) Hồ sơ xử lý trên ticket** gồm:
  - ý chính
  - field SV đã nộp
  - checklist việc CB cần làm
  - draft phản hồi / hướng xử lý (chưa gửi)
  - deadline nếu có
- [ ] **P5.** Demo: ticket `high` nổi trước ticket giấy `normal`.

Pass L3-P: CB mở là thấy việc AI đã làm sẵn — không đọc chat từ đầu.

### L3-A. CB review → Submit 2

- [ ] **A1.** Đăng nhập `OF001`.
- [ ] **A2.** Thấy ticket giấy L2-A, đúng tóm tắt **(AI)**.
- [ ] **A3.** Ca L4: Khiếu nại / handover, **Cao (AI)**, có `handover_reason`.
- [ ] **A4.** Lọc trạng thái / ưu tiên / loại; tìm mã ra **đúng một dòng**.
- [ ] **A5. Review.** CB đọc hồ sơ AI (P4), sửa draft nếu cần. **Chưa gửi.**
- [ ] **A6. Submit 2 — phản hồi.** CB bấm gửi → tin đến `SV001`.
- [ ] **A7.** Sau A6 **chưa** `resolved`. AI không tự đóng.
- [ ] **A8.** Yêu cầu bổ sung → SV gửi trên cùng ticket → AI có thể cập nhật tóm tắt; CB vẫn review trước gửi.
- [ ] **A9.** `open` → `pending_officer`. Hai cổng cùng nhãn **Chờ cán bộ**.
- [ ] **A10. Submit 2 — hoàn tất.** CB bấm Hoàn tất → `resolved` + nhật ký.
- [ ] **A11.** Lỗi lưu: không hiện đã gửi / đã xong giả.
- [ ] **A12.** Ca riêng tư không lộ list chung nếu thiếu quyền.

Pass L3-A: A5 review trước gửi · A7/A10 người mới submit xử lý · AI không tự `resolved`.

### L3-B. SV theo dõi

- [ ] **B1.** Sau Submit 1: `SV001` thấy mã ticket trong “Yêu cầu của tôi”.
- [ ] **B2.** Nhãn trạng thái **trùng** dashboard CB.
- [ ] **B3.** Tóm tắt khớp giấy đã nộp hoặc lý do handover L4.
- [ ] **B4.** Sau A6: thấy tin cán bộ.
- [ ] **B5.** Sau A8: gửi bổ sung trên đúng ticket.
- [ ] **B6.** Sau A10: **Đã hoàn tất**.
- [ ] **B7.** `SV024` không thấy ticket của `SV001`.

Pass L3-B: B2 khớp · B7 không lộ hộ.

---

## L4 — Khiếu nại / nhạy cảm → handover

**Làm gì:** AI nhận diện ca không được tự xử, **dừng**, bàn giao người + hồ sơ ưu tiên cao. Phần xử lý tiếp theo = L3 (CB review → Submit 2).  
**Làm như thế nào:** cắt L1/L2 → tạo ticket `complaint` → AI câm → L3-P/A.

Khác L2-A: không có “xin giấy + SV xác nhận cấp giấy”. Giá trị AI = **phanh + bàn giao đủ**, không phải điền form giấy.

```text
(AI) Nhận diện
  → dừng tư vấn
  → bàn giao: lý do + tóm tắt + chat + high
       ├─ OK  → ticket complaint + mã Chờ cán bộ → L3
       └─ lỗi → chưa chuyển, không mã giả
```

### L4-R. Nhận diện

- [ ] **R1. (AI)** Khiếu nại điểm → L4.
- [ ] **R2. (AI)** Wellbeing → L4.
- [ ] **R3. (AI)** Vượt quyền (sửa điểm / xóa môn) → chặn + L4.
- [ ] **R4. (AI)** Lẫn FAQ + khiếu nại → L4, không trả lời rồi mới chuyển.
- [ ] **R5. (AI)** Lẫn xin giấy + tín hiệu nhạy cảm → **không** Submit 1 giấy trong lượt đó.
- [ ] **R6.** Chỉ hỏi “khiếu nại nộp ở đâu?” chưa gửi ca → L1; chưa ticket L4.

### L4-A. Handover thành công

- [ ] **A1. (AI)** Dừng tư vấn. Không hướng dẫn sửa điểm hộ.
- [ ] **A2. (AI)** Bàn giao: lý do + tóm tắt + hội thoại; `complaint`; **high**.
- [ ] **A3.** Mã thật + **Chờ cán bộ**.
- [ ] **A4.** Báo đã chuyển. Không hứa SLA.
- [ ] **A5. (AI)** AI câm. Composer = bổ sung cho cán bộ.
- [ ] **A6.** Nối L3: CB review hồ sơ AI rồi Submit 2.
- [ ] **A7.** SV001 thấy mã trên L3-B.

### L4-B. Wellbeing

- [ ] **B1. (AI)** Không “cố lên”, không chẩn đoán.
- [ ] **B2.** Message cố định + hàng chờ đúng quyền.
- [ ] **B3.** Handover OK → mã, AI dừng.
- [ ] **B4.** Không lộ list dùng chung.

### L4-C. Lỗi

- [ ] **C1.** Fail → **chưa chuyển được**, không mã giả.
- [ ] **C2.** SV bổ sung → tới CB; AI không trả lời hộ.
- [ ] **C3.** L4 không tự `resolved`. Chỉ CB Submit 2 ở L3-A10.

Pass L4: AI nhận diện & dừng · A2 `high` cho L3 · C1 không mã giả.

---

## Chuỗi demo khép

1. [ ] **(AI L2)** Giấy xác nhận SV: điền sẵn → SV review → Submit 1 → mã `open`.
2. [ ] **(AI L3-P)** CB thấy tóm tắt + checklist + draft; ticket gấp (`high`) trên giấy thường.
3. [ ] **(AI L3)** CB review → Submit 2 phản hồi (chưa đóng) → SV thấy → Hoàn tất.
4. [ ] **(AI L4)** Khiếu nại điểm → AI dừng → handover `high` → CB review → Submit 2.
5. [ ] **(AI L4)** (Tuỳ chọn) Handover lỗi → không mã giả.

---

## Lịch sử

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 0.4 | 2026-09-23 | Giấy E2E hai giai đoạn (SV / CB review trước submit) + L4 |
| 0.5 | 2026-09-23 | Nội dung đang chạy chỉ còn giấy + L4 |
