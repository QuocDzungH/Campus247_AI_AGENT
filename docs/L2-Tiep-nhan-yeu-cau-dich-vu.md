# L2 — Giai đoạn 1: SV + AI xin giấy xác nhận sinh viên

**Dự án:** Campus 24/7 (EDU-14 / P-120)  
**Câu nhớ:** AI **điền gần hết** — SV **review rồi Submit 1** — có **mã yêu cầu**.

Pipeline chạy: [Pipeline L2 · L3 · L4](Pipeline-L2-L3-L4.md)

**Phạm vi:** **giấy xác nhận sinh viên**. L4 khiếu nại là luồng chính khác, không phải L2.

---

## 1. Vai trò L2 trong E2E giấy

| Giai đoạn | Ai | Việc | Submit |
|---|---|---|---|
| **1 — L2** | SV + AI | Điền sẵn thông tin yêu cầu | SV review → nộp **ticket** vào hệ thống trường |
| **2 — L3** | CB + AI | Chuẩn bị hồ sơ xử lý trên ticket | CB review → gửi phản hồi / hoàn tất |

Submit 1 **không** phát hành PDF giấy. AI **không** nộp khi SV chưa xác nhận.

---

## 2. Painpoint

| Painpoint | AI gỡ |
|---|---|
| Ngoài giờ không gửi được | Chat 24/7 |
| Form thiếu field | Prefill tài khoản + hỏi thiếu trên chat |
| Sợ gửi nhầm | Preview — chỉ Submit 1 sau review SV |
| Không biết đã vào hệ thống chưa | Mã ticket + **Mới tiếp nhận** |

---

## 3. AI làm / không làm

| AI làm | AI không làm |
|---|---|
| Phân loại: hỏi vs xin giấy vs L4 | Coi “hỏi thủ tục” = đã nộp |
| Prefill họ tên, MSSV | Bịa field còn thiếu |
| Hỏi loại giấy, mục đích | Nộp khi chưa SV review |
| Preview hồ sơ yêu cầu | Cấp / ký giấy PDF |
| Sau Submit 1: tóm tắt field sang L3 | Tự xử lý hộ cán bộ (đó là L3) |

---

## 4. Pipeline rút gọn

```text
Chỉ hỏi → L1
Khiếu nại / nhạy cảm → L4
Xin giấy xác nhận SV
  → (AI) prefill + hỏi thiếu
  → Preview
       ├─ Hủy / đổi → không nộp bản cũ
       └─ SV Xác nhận = Submit 1 → ticket action + mã open → L3
```

Field preview: họ tên, MSSV *(tài khoản)*; loại giấy, mục đích *(chat)*.

Done L2:

- [ ] Hủy = không ticket.
- [ ] Đổi nội dung = preview mới + review lại.
- [ ] Hỏi ≠ đã nộp.
- [ ] Submit 1 thành công = mã + `open` + câu “đã nộp yêu cầu”.
- [ ] Ticket sang L3 kèm field/tóm tắt AI đã điền.

Checklist chi tiết: mục L2 trong [Pipeline](Pipeline-L2-L3-L4.md).

---

## 5. Lịch sử

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 0.4 | 2026-09-23 | Giấy E2E giai đoạn 1; người review trước submit |
