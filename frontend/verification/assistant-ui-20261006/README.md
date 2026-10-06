# Kiểm chứng giao diện Trợ lý học vụ — 06/10/2026

Phạm vi: `/student/assistant`, hội thoại trợ lý dùng chung và chuyển tiếp từ khung trợ lý bên cạnh tác vụ. Giao diện giữ quy chuẩn ThoughtStream của `frontend/DESIGN.md`.

## Thay đổi

- Màn hình chat mới gom lời chào, ô nhập và gợi ý vào một vùng; hội thoại có tin nhắn giữ ô nhập ở đáy.
- Khung trợ lý nổi ở góc phải dưới thanh điều hướng, không đổi padding/chiều rộng trang khi bật/tắt. Gutter thanh cuộn ổn định để tránh lệch trang khi khóa cuộn trên mobile hoặc chuyển sang trang chat.
- Nút Trò chuyện mới và Lịch sử hiện ngay trên thanh đầu. Phản hồi có avatar và nút sao chép; ô nhập tự tăng chiều cao, có trạng thái chờ và nút về tin nhắn mới nhất.
- Vào trang từ điều hướng hoặc tải lại URL thông thường mở một chat trống. Chat trống chưa sử dụng được tái dùng để tránh tạo nhiều mục rỗng. Hội thoại, bản nháp và câu hỏi chưa gửi được giữ lại.
- Liên kết Tiếp tục trong trang chatbot giữ nguyên hội thoại đang trao đổi. Liên kết mở thủ tục vẫn mở biểu mẫu, kể cả khi truy cập lặp lại.
- Sửa bộ kiểm tra lịch sử từ chối URL mở biểu mẫu trong chat của chính ứng dụng, dẫn đến báo lỗi đọc dữ liệu sau khi tải lại.

## Kiểm tra

- Kiểm tra TypeScript, ESLint trên các file thay đổi và bộ `npm run test:regression`. Lint toàn frontend không có lỗi; còn một cảnh báo có sẵn về dependencies của effect trong `P0PreviewPanel.tsx:142`.
- Build production thành công bằng cấu hình thư mục build riêng `CAMPUS_UI_VERIFY=assistant-build`, với dữ liệu mock, để không ảnh hưởng dev server đang chạy.
- Playwright với Chrome, dữ liệu mock: desktop 1440×900, tablet 768×1024, mobile 390×844; light/dark, không tràn ngang, ô nhập trong viewport.
- So sánh chính xác bounding boxes của header, logo, điều hướng, tài khoản, vùng nội dung, tiêu đề, thẻ dịch vụ và danh sách hồ sơ trước/sau bật/tắt trợ lý: 1920, 1440, 1280, 1024, 768, 390px (light); 1920, 1280, 390px (dark). Vị trí và kích thước giữ nguyên, Escape đóng khung chat và trả focus về nút mở.
- Kiểm tra gửi bằng Enter, xuống dòng bằng Shift+Enter, sao chép, chọn lại lịch sử, tải lại trang, bảo toàn câu hỏi chưa gửi, tiếp tục chat từ drawer, mở lại biểu mẫu và đổi tab biểu mẫu bằng bàn phím. Không có lỗi JavaScript trình duyệt.
- Unit regression bổ sung cho tái dùng chat trống, bảo toàn dữ liệu cũ, phản hồi chậm về đúng hội thoại và tải lại câu trả lời chứa nút mở biểu mẫu.

Ảnh trong thư mục và `report.json` là kiểm chứng mock. Không chạy nộp hồ sơ qua backend thật trong lần rà giao diện này.

Chạy lại từ thư mục gốc (server dùng mock hoặc cho phép chuyển data mode):

```bash
node scripts/assistant_ui_browser.mjs --base-url http://127.0.0.1:3000
```
