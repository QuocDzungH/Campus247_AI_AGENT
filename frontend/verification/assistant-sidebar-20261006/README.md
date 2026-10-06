# Thanh bên hội thoại — 06/10/2026

Phạm vi: `/student/assistant` trong `frontend/`, theo quy chuẩn ThoughtStream của `frontend/DESIGN.md`.

- Desktop hiển thị thanh bên trái gồm Trò chuyện mới, tìm kiếm và danh sách hội thoại. Hội thoại được chọn có dấu nhận biết và `aria-current`; câu hỏi chưa gửi và hồ sơ kèm theo có nhãn riêng.
- Tìm kiếm hỗ trợ tiếng Việt không dấu. Không gán ngày giả cho hội thoại vì dữ liệu hiện tại chưa có thời gian tạo/cập nhật.
- Có thể thu gọn thanh bên; vùng chat mở rộng, câu hỏi và hội thoại đang chọn được giữ nguyên. Khi thu gọn, nút mở lại nhận focus.
- Mobile/tablet dưới 1024px mở lịch sử bằng nút ở bên trái thanh đầu. Ngăn bên rộng tối đa 300px, giữ phần nền để có thể bấm đóng; hỗ trợ Escape, giữ Tab trong ngăn bên và trả focus về nút mở. Tạo chat mới đóng ngăn bên và đưa focus về ô nhập.
- Giữ hành vi vào chat trống, chuyển tiếp hội thoại, bản nháp biểu mẫu, ô nhập ở đáy khi có tin nhắn, sao chép và thao tác biểu mẫu.

## Kiểm chứng

- TypeScript, ESLint trên file thay đổi và toàn bộ `npm run test:regression` thành công.
- Chrome/Playwright với dữ liệu mock: desktop 1440×900, tablet 768×1024, mobile 390×844, sáng/tối; không tràn ngang, ô nhập nằm trong viewport, không có lỗi JavaScript.
- Kiểm tra tìm lịch sử, chọn hội thoại, thu gọn/mở lại, bảo toàn câu hỏi chưa gửi, tải lại, gửi Enter/Shift+Enter, sao chép, tiếp tục từ trợ lý nổi, mở lại biểu mẫu và tab biểu mẫu bằng bàn phím.
- Biểu mẫu và chat cùng thanh bên vừa chiều rộng ở 1280px và 1024px. Ngăn lịch sử mobile giữ đúng chiều rộng, đóng bằng Escape trả focus về nút mở.
- Kiểm tra vị trí trang trước/sau mở trợ lý nổi tại 1920, 1440, 1280, 1024, 768, 390px vẫn giữ nguyên.

Không gửi tin nhắn hay nộp hồ sơ qua backend thật trong lần kiểm chứng này. Các ảnh là dữ liệu mock. Dev server frontend ở cổng 3100; cổng 3000 tại thời điểm kiểm tra chạy ứng dụng `prototype-ver2` khác.

```bash
node scripts/assistant_ui_browser.mjs --base-url http://127.0.0.1:3100 --output-dir /tmp/campus-assistant-sidebar-proof
```
