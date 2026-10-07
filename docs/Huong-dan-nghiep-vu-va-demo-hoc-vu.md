# HƯỚNG DẪN NGHIỆP VỤ & KỊCH BẢN DEMO HỌC VỤ (CAMPUS 24/7)

**Nhánh Git**: `feat/prototype-ver2`  
**Dự án**: Campus 24/7 — Hệ thống Trợ lý Ảo & Xử lý Dịch vụ Học vụ (Cấp Giấy chứng nhận, Khiếu nại, Bàn làm việc Cán bộ)  
**Mục tiêu tài liệu**: Giúp tất cả thành viên trong nhóm hiểu rõ trọn vẹn luồng nghiệp vụ, nắm bắt cấu trúc giao diện và có thể trực tiếp tự tin trình diễn (demo) trước Mentor / Hội đồng.

---

## 1. Khởi chạy nhanh ứng dụng (Quick Start)

```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt các gói phụ thuộc (nếu chưa cài)
npm install

# 3. Khởi chạy máy chủ phát triển
npm run dev
```

Mở trình duyệt truy cập: **[http://localhost:3000](http://localhost:3000)**

---

## 2. Bản đồ Tài khoản Demo & Thẩm quyền (Role Matrix)

Hệ thống hỗ trợ 3 tài khoản mẫu được phân loại rõ ràng trong menu Avatar ở góc phải Navbar:

| Mã User | Họ và tên | Chức danh | Vai trò & Thẩm quyền trên hệ thống |
| :--- | :--- | :--- | :--- |
| **`SV001`** | Nguyễn Văn An | Sinh viên K18 KTPM | • Chat hỏi đáp quy chế đào tạo với Trợ lý AI 24/7.<br>• Nộp đơn xin cấp Giấy xác nhận sinh viên (BM-03).<br>• Gửi và **chỉnh sửa khiếu nại** điểm thi/học vụ.<br>• Quản lý lịch sử các phiên chat cá nhân. |
| **`SV024`** | Lê Bảo Trâm | Sinh viên K19 Ngân hàng | • Sinh viên năm 2 tra cứu thủ tục vay vốn sinh viên và theo dõi hồ sơ học vụ. |
| **`OF001`** | ThS. Trần Thu Hà | Cán bộ Học vụ (Phòng Đào tạo) | • Xem dashboard tổng hợp chỉ số tiếp nhận/xử lý hồ sơ.<br>• Thẩm định thông tin sinh viên, kiểm tra checklist tự động.<br>• Soạn phản hồi, gửi tin nhắn trao đổi với sinh viên.<br>• Phê duyệt hoàn tất hồ sơ (`resolved`). |

---

## 3. Quy chuẩn Thanh điều hướng Navbar (Role-Based Navigation)

Navbar được thiết kế thông minh, **tự động biến đổi theo vai trò đang đăng nhập** để không làm người dùng bị rối:

1. **Khi đăng nhập Sinh viên (`SV001`, `SV024`)**:
   - Hiển thị duy nhất cụm điều hướng sinh viên:
     ```
     [ 🎓 CỔNG SINH VIÊN | 💬 Trợ lý AI & Nộp đơn (/chat) | 📄 Hồ sơ & Khiếu nại của tôi (/my-requests) ]
     ```
   - Tuyệt đối không hiển thị các nút quản trị của Cán bộ.

2. **Khi đăng nhập Cán bộ Học vụ (`OF001`)**:
   - Hiển thị duy nhất cụm điều hướng quản trị:
     ```
     [ 🏛️ BÀN HỌC VỤ & ĐÀO TẠO | 📊 Hàng chờ Xử lý Hồ sơ (/dashboard) ]
     ```
   - Tinh gọn, đúng nghiệp vụ thẩm định hồ sơ.

3. **Nút chuyển chế độ xem**:
   - Người thuyết trình có thể bấm nút `[Theo vai trò / Mở tất cả]` trên Navbar để chuyển sang chế độ hiển thị toàn bộ nếu cần so sánh giao diện giữa hai bên.

---

## 4. Kịch bản Demo thực tế từng bước (Step-by-step Demo Playbook)

---

### 🟢 KỊCH BẢN 1: Sinh viên nộp đơn xin Cấp Giấy xác nhận sinh viên (BM-03)
- **Mục tiêu**: Phô diễn khả năng Trợ lý AI hỗ trợ điền đơn tự động (Co-pilot), xác thực thông tin và chuyển tiếp sang Cán bộ phê duyệt.
- **Các bước thực hiện**:
  1. **Đăng nhập vai trò `SV001` (Nguyễn Văn An)**:
     - Truy cập `/chat`.
     - Nhập vào ô chat: *"Tôi muốn xin giấy xác nhận sinh viên để vay vốn ngân hàng chính sách xã hội"*.
     - AI hiểu ý định, tự động mở cửa sổ nộp đơn **Submit 1 Modal** với thông tin của Nguyễn Văn An đã được điền sẵn:
       - MSSV: `20210018`, Lớp: `K18 KTPM`, Trạng thái: `Bình thường`.
       - Mục đích & Nơi nộp: `Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức`.
     - Sinh viên rà soát lại thông tin và bấm **"Gửi yêu cầu chính thức"**.
  2. **Theo dõi phía Sinh viên**:
     - Hệ thống sinh mã hồ sơ (ví dụ: `TKT-2026-0150`) ở trạng thái `pending_officer` (Chờ cán bộ xử lý).
     - Vào mục `/my-requests`: Sinh viên nhìn thấy hồ sơ vừa tạo nằm trong danh sách với thời gian nộp cụ thể.
  3. **Đổi vai trò sang `OF001` (Cán bộ - ThS. Trần Thu Hà)**:
     - Mở menu Avatar góc phải ➔ Chọn `ThS. Trần Thu Hà (OF001)`.
     - Vào trang `/dashboard`: Thấy hồ sơ `TKT-2026-0150` xuất hiện ngay đầu hàng chờ xử lý.
     - Click vào ticket để mở màn hình thẩm định chi tiết (`/tickets/[ticketId]`):
       - Xem **Fact Sheet** sinh viên đã được hệ thống xác thực.
       - Tích đủ các mục trong **Checklist thẩm định**.
       - Soạn tin nhắn phản hồi (có thể dùng gợi ý của AI Co-pilot).
       - Bấm **"Xác nhận Hoàn tất & Cấp giấy"** ➔ Ticket chuyển sang trạng thái `resolved` (Đã hoàn tất).

---

### 🔵 KỊCH BẢN 2: Sinh viên tra cứu và Chỉnh sửa Khiếu nại học vụ
- **Mục tiêu**: Chứng minh sinh viên không chỉ nộp đơn 1 chiều mà hoàn toàn có quyền xem chi tiết và **chỉnh sửa nội dung khiếu nại** khi cần bổ sung thông tin giải trình.
- **Mã hồ sơ mẫu**: `TKT-2026-0098` *(Khiếu nại điểm thi môn Cấu trúc Dữ liệu)*
- **Các bước thực hiện**:
  1. **Đăng nhập vai trò `SV001` (Nguyễn Văn An)**:
     - Vào trang `/my-requests` (Yêu cầu của tôi).
     - Tìm ticket `TKT-2026-0098` (loại `Khiếu nại - Complaint`, màu hổ phách/cam).
     - Bấm nút **"Xem & Chỉnh sửa khiếu nại"**.
  2. **Thao tác chỉnh sửa**:
     - Modal chỉnh sửa khiếu nại mở ra. Sinh viên có thể cập nhật:
       - Lý do khiếu nại chi tiết.
       - Bổ sung thông tin đối chiếu (điểm bài tập lớn, hình ảnh biên bản nộp bài).
     - Bấm **"Lưu cập nhật khiếu nại"**.
     - Dữ liệu lập tức được đồng bộ và ghi nhận lịch sử chỉnh sửa vào nhật ký Audit Trail.
  3. **Phía Cán bộ kiểm tra**:
     - Đổi vai trò sang `OF001` ➔ Mở ticket `TKT-2026-0098` trên Bàn học vụ.
     - Cán bộ thấy ngay nội dung cập nhật mới nhất kèm thông báo sinh viên đã bổ sung giải trình.

---

### 🟣 KỊCH BẢN 3: Quản lý Đa phiên Hội thoại (Chat Sessions Drawer)
- **Mục tiêu**: Minh họa trải nghiệm chat mượt mà, lưu lịch sử nhiều phiên trao đổi theo thời gian thực (giống ChatGPT / Claude).
- **Các bước thực hiện**:
  1. Tại trang `/chat`, bấm vào biểu tượng **Đồng hồ / Lịch sử (Chat History)** ở góc trên bên trái khung chat.
  2. Ngăn kéo (Drawer) mở ra hiển thị danh sách các phiên chat trước đó:
     - Phiên: *Tư vấn vay vốn ngân hàng chính sách*.
     - Phiên: *Hỏi quy chế đăng ký tín chỉ học phần*.
  3. Bấm **"+ Phiên mới"** để bắt đầu cuộc trò chuyện mới tinh.
  4. Bấm chuyển đổi giữa các phiên cũ: Toàn bộ nội dung trao đổi, tin nhắn cũ và trạng thái form được khôi phục chính xác.
  5. Có nút **Xóa phiên** nếu không muốn lưu trữ cuộc trò chuyện đó nữa.

---

## 5. Cơ chế Lưu trạng thái & Reset Demo

- Toàn bộ dữ liệu của prototype (ticket, phiên chat, tài khoản) được lưu tự động trong `localStorage` của trình duyệt:
  - `campus247_tickets_v2`: Danh sách hồ sơ học vụ.
  - `campus247_chat_sessions_v1`: Lịch sử các phiên chat.
  - `campus247_user_v2`: Người dùng đang đăng nhập.
- Khi cần đưa dữ liệu mẫu về trạng thái ban đầu sạch sẽ để diễn tập lại:
  - Bấm vào biểu tượng **`Mũi tên xoay tròn (Reset Demo)`** trên thanh Demo Badge ở góc phải màn hình.
  - Hệ thống sẽ khôi phục lại dữ liệu mẫu gốc ngay lập tức mà không cần xóa cache trình duyệt thủ công.

---

## 6. Mối quan hệ với các nhánh khác trong kho code

- **`feat/prototype-ver2`** *(Nhánh hiện tại)*: Tập trung 100% vào **Dịch vụ Học vụ & Khiếu nại của Sinh viên** (phù hợp tuyệt đối với bài toán trường đại học).
- **`feat/facility-materials`** *(Nhánh mở rộng)*: Chứa phân hệ mở rộng quản lý **Cơ sở vật chất, Vật tư kho & Hóa đơn thuê ngoài** (phù hợp khi muốn demo bài toán quản trị tài sản quy mô lớn).
