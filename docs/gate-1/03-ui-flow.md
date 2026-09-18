# Tài liệu Luồng Giao diện & Wireframe (UI Flow)

> **Dự án**: Campus 24/7 – Trợ lý AI Vận hành Học vụ 24/7  
> **Chủ trì**: Dương Xuân Vinh  
> **Figma Link**: [Campus 24/7 — Gate 1](https://www.figma.com/design/kzopgoT710er8XiOfOYi8o)
>
> **Quyền chia sẻ**: Đặt `Anyone with the link can view` trong Figma trước khi nộp.

---

## 1. Sơ đồ Luồng Người dùng Tổng quát (User Journey)

```text
               ┌───────────────────────┐
               │    Sinh viên đăng nhập │
               └───────────┬───────────┘
                           │
                 [Nhập yêu cầu chat]
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
 [Hỏi quy chế]      [Yêu cầu dịch vụ]     [Khiếu nại/Nhạy cảm]
       │                   │                   │
  RAG Tra cứu       Agent trích xuất      Agent kích hoạt
  + Trích dẫn       + Hiện Xác nhận       Handover cán bộ
       │                   │                   │
[Xem câu trả lời]    [Bấm Confirm]        [Tạo ticket khẩn]
                           │                   │
                   [Tạo ticket/đặt chỗ]        │
                           └─────────┬─────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ Dashboard Cán bộ    │
                          │ - Xem context       │
                          │ - Xử lý / Phản hồi  │
                          └─────────────────────┘
```

---

## 2. Chi tiết Các Màn hình Cần Vẽ trên Wireframe/Figma

### 2.1. Cổng Sinh viên (Student Portal)
1. **Màn hình Chat chính**:
   - Sidebar: Lịch sử trò chuyện, danh sách ticket của tôi, nút tạo phiên chat mới.
   - Main Chat Area: Khung hiển thị tin nhắn, hộp nhập câu hỏi.
   - Thẻ Citation Component: Nằm dưới câu trả lời của Bot, hiển thị thẻ trích dẫn (Tên văn bản, Điều khoản) có thể click để mở popover xem trích đoạn gốc.
2. **Hộp thoại Xác nhận (Confirmation Modal)**:
   - Xuất hiện khi Sinh viên yêu cầu đặt phòng tự học hoặc làm thủ tục hành chính.
   - Hiển thị tóm tắt thông tin: Họ tên, Mã sinh viên, Dịch vụ yêu cầu, Thời gian thực hiện.
   - 2 nút bấm rõ ràng: "Hủy bỏ" và "Xác nhận & Gửi yêu cầu".
3. **Màn hình Thông báo Chuyển giao Cán bộ (Handover Banner)**:
   - Hiển thị badge trạng thái màu vàng/cam thông báo: "Yêu cầu đã được chuyển tới Cán bộ Phòng Đào tạo (Mã Ticket: TKT-2026-0142)".

### 2.2. Cổng Cán bộ Hỗ trợ (Staff Dashboard)
1. **Màn hình Danh sách Ticket (Kanban / Table)**:
   - Bộ lọc: Trạng thái (Chờ xử lý, Đang xử lý, Đã hoàn thành), Mức độ ưu tiên (Khẩn cấp, Bình thường), Phân loại (Hỏi đáp, Thủ tục, Khiếu nại).
2. **Màn hình Chi tiết Ticket & Ngữ cảnh**:
   - Bên trái: Lịch sử tóm tắt cuộc trò chuyện giữa Sinh viên và AI trước khi chuyển giao.
   - Bên phải: Khung phản hồi của Cán bộ, nút cập nhật trạng thái và nút "Hoàn tất xử lý".

### 2.3. Bộ dữ liệu minh họa thống nhất
- Sinh viên minh họa: `SV001` · Nguyễn Văn An; không dùng MSSV, email hoặc thông tin cá nhân thật.
- Cán bộ minh họa: `OF001` · Cán bộ hỗ trợ học vụ.
- Ticket chính trong luồng handover: `TKT-2026-0142`; danh sách Staff Dashboard có thể hiển thị dạng rút gọn `TKT-0142`.
- Ticket chính có `category = action`, `priority = high`, `status = pending_officer`; sau khi cán bộ hoàn tất, trạng thái chuyển thành `resolved`.
- Các nhãn trạng thái kỹ thuật (`open`, `pending_officer`, `resolved`) được thể hiện trên UI bằng tiếng Việt: `Mới tiếp nhận`, `Chờ cán bộ`, `Đã hoàn tất`.

---

## 3. Danh mục Hình ảnh Wireframe Export
Các hình ảnh bản vẽ wireframe đã được xuất từ Figma và lưu tại thư mục:
`docs/gate-1/assets/`
- [01 • Student Chat View.png](<assets/01 • Student Chat View.png>)
- [02 • Student Confirmation Modal.png](<assets/02 • Student Confirmation Modal.png>)
- [03 • Student Handover Notice.png](<assets/03 • Student Handover Notice.png>)
- [04 • Staff Dashboard Tickets.png](<assets/04 • Staff Dashboard Tickets.png>)
- [05 • Staff Ticket Detail.png](<assets/05 • Staff Ticket Detail.png>)
