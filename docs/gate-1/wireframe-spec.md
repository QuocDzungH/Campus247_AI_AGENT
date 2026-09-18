# Đặc tả dựng wireframe Campus 24/7

Chủ trì: Dương Xuân Vinh · Gate 1 · Desktop 1440 × 1024.

Trạng thái: đã tạo file Figma, dựng đủ 5 frame chỉnh sửa được và xuất PNG 1× (1440 × 1024). Link: https://www.figma.com/design/kzopgoT710er8XiOfOYi8o

Tham chiếu: [PRD](02-prd.md), [UI Flow](03-ui-flow.md).

## 1. File, bố cục và thành phần dùng chung

- File mới: `Campus 24/7 — Gate 1`; page: `Gate 1 – Campus 24/7`.
- Năm frame chính kích thước 1440 × 1024, bố trí hai cột với khoảng cách 120 px; tên frame trùng tên ảnh export bên dưới.
- Sidebar rộng 248 px; header cao 80 px; vùng nội dung padding 40 px; lưới khoảng cách 8 px.
- Font Inter, hỗ trợ tiếng Việt; tiêu đề 28/36, tiêu đề vùng 20/28, nội dung 16/24, nhãn phụ 14/20.
- Màu: nền `#F5F7FB`, surface `#FFFFFF`, chữ `#172B4D`, chữ phụ `#52637A`, primary `#2457D6`, viền `#DCE3ED`.
- Handover/cảnh báo: nền `#FFF4E5`, chữ `#92400E`; hoàn tất: nền `#E8F5EF`, chữ `#166534`. Mỗi badge có nhãn chữ để không phụ thuộc màu.
- Button cao 44 px; card bo góc 12 px; component gồm navigation item, button, badge, chat message, citation card, ticket row, field và modal.
- Dùng text và shape có thể chỉnh sửa; ưu tiên Auto Layout, component dùng lại và tên layer có nghĩa. Không dùng ảnh phẳng thay cho cả màn hình.
- Header mỗi màn có nhãn `Bản mẫu · Dữ liệu giả lập`. Tài khoản mẫu `SV001`, tên `Nguyễn Văn An`; cán bộ `OF001 · Cán bộ hỗ trợ học vụ`. Email và MSSV đều là dữ liệu giả lập.

## 2. Năm màn hình

### 01 — student-chat-view

- Sidebar: logo Campus 24/7, `Cuộc trò chuyện mới`, `Trợ lý học vụ` đang chọn, `Yêu cầu của tôi`, lịch sử `Giấy xác nhận sinh viên`, tài khoản demo ở cuối.
- Header: `Trợ lý học vụ`, phụ đề `Tra cứu quy chế và gửi yêu cầu hỗ trợ`.
- Tin nhắn sinh viên: `Em cần làm gì để xin giấy xác nhận sinh viên?`.
- Trả lời minh họa: `Theo hướng dẫn mẫu, bạn kiểm tra thông tin sinh viên, chọn mục đích sử dụng và gửi yêu cầu để cán bộ tiếp nhận.`
- Citation card: `Hướng dẫn dịch vụ sinh viên — TÀI LIỆU MÔ PHỎNG`, `Mục 2 · Trang 3`, nút `Xem trích đoạn`. Popover chứa đoạn mẫu tương ứng; không gán quy định giả cho VinUni hoặc tạo URL nguồn giả.
- CTA `Tạo yêu cầu cấp giấy` mở màn 02. Composer ở cuối: `Nhập câu hỏi hoặc yêu cầu của bạn…` và nút `Gửi`.
- Ghi chú bản mẫu: nguồn thật sẽ thay thế citation mô phỏng sau khi nhóm xác minh KB.

### 02 — student-confirmation-modal

- Nền là màn chat, có overlay tối nhẹ; modal rộng 600 px ở giữa.
- Tiêu đề `Kiểm tra trước khi gửi`; phụ đề `Yêu cầu chỉ được tạo sau khi bạn xác nhận.`
- Trường: Nguyễn Văn An; `SV001`; dịch vụ `Đặt phòng học sau 18:00`; mục đích `Xác nhận quyền sử dụng ngoài giờ`; thời điểm `Sau khi xác nhận`.
- Có nút `Hủy`, `Xác nhận`; dữ liệu vẫn là bản mẫu, không gửi sang hệ thống thật.
- Hủy đóng modal, không tạo ticket. Khi gửi thành công: ticket `TKT-2026-0142` ở trạng thái `Chờ cán bộ`.

### 03 — student-handover-notice

- Giữ shell sinh viên với tài khoản giả lập `SV001`; hội thoại riêng về yêu cầu xác nhận đặt phòng học sau 18:00.
- Tin nhắn: `Em muốn được hướng dẫn gửi đề nghị kiểm tra lại kết quả học tập.`
- Banner cam: `Yêu cầu đã được chuyển tới cán bộ Phòng Đào tạo`.
- Card `TKT-2026-0142`, loại `Yêu cầu dịch vụ`, trạng thái `Chờ cán bộ`, mức độ `Cao`.
- Nội dung: `Cán bộ sẽ xem nội dung bạn đã gửi và phản hồi tại cuộc trò chuyện này.` Không hứa thời gian phản hồi chưa được xác nhận.
- Timeline: `Đã tiếp nhận` → `Đã chuyển cán bộ` → `Chờ phản hồi`.
- Composer đổi thành `Gửi thông tin bổ sung cho cán bộ…`; nhãn `AI đã tạm dừng trả lời trong cuộc trò chuyện này`.
- Handover trong frame là tình huống đã thành công. Nếu chuyển giao lỗi, trạng thái phải nói rõ chưa chuyển được, không hiển thị mã ticket thành công.

### 04 — staff-dashboard-tickets

- Sidebar: `Hàng chờ hỗ trợ`, `Đã hoàn tất`, tài khoản cán bộ. Header `Yêu cầu học vụ` và nhãn `Phòng Đào tạo`.
- Ba thẻ tổng quan trên cùng lấy từ bốn dòng mẫu: `Chờ tiếp nhận 2`, `Chờ cán bộ 1`, `Đã hoàn tất 1`.
- Bộ lọc: tìm theo mã yêu cầu; trạng thái; ưu tiên; phân loại. Bảng có cột mã, nội dung, sinh viên, phân loại, ưu tiên, trạng thái, thời gian.

| Mã | Nội dung | Sinh viên | Phân loại | Ưu tiên | Trạng thái |
|---|---|---|---|---|---|
| TKT-0142 | Đặt phòng học sau 18:00 | SV001 | Yêu cầu dịch vụ | Cao | Mới tiếp nhận |
| TKT-0139 | Hạn học bổng | SV024 | Tra cứu | Bình thường | Mới tiếp nhận |
| TKT-0138 | Điều chỉnh bảng điểm | SV014 | Khiếu nại | Cao | Chờ cán bộ |
| TKT-0136 | Quyền truy cập thư viện | SV019 | Tra cứu | Bình thường | Chờ cán bộ |

- Chọn TKT-0142 mở màn 05. Footer bảng `Hiển thị các yêu cầu mẫu`.
- Ca riêng tư chỉ xuất hiện với cán bộ có quyền xử lý; không đưa nội dung wellbeing vào danh sách dùng chung.

### 05 — staff-ticket-detail

- Breadcrumb `Danh sách yêu cầu / TKT-2026-0142`; tiêu đề `Đặt phòng học sau 18:00`; badge `Cao`, `Chờ cán bộ`.
- Hai cột: trái 60% cho ngữ cảnh, phải 40% cho xử lý.
- Trái: hiển thị tin nhắn gốc của SV001, câu trả lời AI có citation và ghi rõ nguồn đã kiểm chứng. Cán bộ có thể phản hồi hoặc đánh dấu hoàn tất.
- Audit trail: `21:10 Sinh viên gửi yêu cầu` → `21:12 Hệ thống chuyển Phòng Đào tạo` → `21:13 Cán bộ Demo mở yêu cầu`. Đây là dữ liệu minh họa.
- Phải: người phụ trách, dropdown trạng thái, textarea `Phản hồi sinh viên`, nút `Gửi phản hồi`, `Yêu cầu bổ sung`, `Hoàn tất xử lý`.
- Phản hồi mặc định trống, gợi ý `Nhập hướng dẫn đã được kiểm chứng…`; không giả lập phản hồi đã gửi trước khi người dùng thao tác.
- Hoàn tất hiển thị trạng thái `Đã hoàn tất`; lỗi lưu giữ nguyên nội dung và báo lỗi, không hiện thành công.

## 3. Trạng thái và liên kết prototype

- Trạng thái hiển thị bám PRD: `open` = Chờ tiếp nhận, `pending_officer` = Chờ cán bộ, `resolved` = Đã hoàn tất. Nhãn draft/đang gửi chỉ là trạng thái UI.
- Prototype: chat → mở nguồn hoặc mở modal; modal → hủy/quay lại hoặc success; dashboard → chi tiết → quay lại dashboard. Handover là điểm bắt đầu độc lập cho kịch bản nhạy cảm.
- Component variants bổ sung: không có nguồn (mời tạo ticket), đang gửi, gửi thất bại, phòng hết chỗ (chọn giờ khác và xác nhận lại), bảng không có kết quả.
- Tất cả tương tác là bản mẫu; chưa gọi API, chưa tạo ticket hoặc gửi thông báo thực tế.

## 4. Xuất và nghiệm thu

- Export PNG 1×, đúng 1440 × 1024: `student-chat-view.png`, `student-confirmation-modal.png`, `student-handover-notice.png`, `staff-dashboard-tickets.png`, `staff-ticket-detail.png` vào `docs/gate-1/assets/`.
- Kiểm tra trực quan từng màn: dấu tiếng Việt, độ tương phản, không tràn text, bố cục modal, nhãn trạng thái và citation dễ đọc.
- Kiểm tra layer text/shape và component vẫn chỉnh sửa được trong file Figma.
- Kiểm tra prototype có điểm bắt đầu, các nút chính và liên kết quay lại.
- Đặt quyền `Anyone with the link can view`, kiểm tra mở link không đăng nhập rồi mới cập nhật link thật trong UI Flow.
- Chỉ đánh dấu hoàn thành sau khi kiểm tra file Figma và năm PNG thực tế. Không dùng đặc tả này thay cho wireframe đã xuất.
