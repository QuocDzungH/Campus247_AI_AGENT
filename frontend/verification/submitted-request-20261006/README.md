# Thẻ đơn đã gửi và popup — 06/10/2026

Phạm vi: hội thoại trợ lý và trạng thái sau khi gửi đơn trong `frontend/`.

## Thay đổi

- Khi đơn đã gửi, vùng biểu mẫu được thu lại và hội thoại dùng chiều rộng chính. Thẻ xác nhận được hiển thị trong hội thoại, gồm loại yêu cầu, mã hồ sơ, trạng thái, ngày ghi nhận và liên kết theo dõi.
- Bấm thẻ tài liệu / Xem đơn mở popup chỉ đọc với nội dung thực tế của hồ sơ: thông tin sinh viên, nội dung đã khai, cách nhận và trạng thái. Tải lại dữ liệu khi mở; giữ thông tin đã có nếu máy chủ chưa phản hồi.
- Đơn yêu cầu được phân biệt với giấy xác nhận đã phát hành. Không tự gán mã hồ sơ, thời hạn xử lý hay kết quả phê duyệt.
- Ghi vị trí của thẻ tại thời điểm gửi trong từng hội thoại. Các tin nhắn sau xuất hiện dưới thẻ; mở lại lịch sử hoặc tải lại vẫn giữ vị trí. Hội thoại cũ chưa có vị trí lưu sẵn hiển thị thẻ sau các trao đổi đã có.
- Khi chưa đồng bộ mã hồ sơ, vẫn có thẻ và popup cùng trạng thái tải/lỗi/thử lại. Không hiển thị ID nội bộ thay mã hồ sơ.
- Đóng bằng nút X, Escape hoặc nền popup; focus quay về thẻ. Giữ bước xác nhận gửi, bản nháp và biểu mẫu trước khi nộp.

## Kiểm chứng

- TypeScript và bộ `npm run test:regression` thành công. Lint không có lỗi; còn cảnh báo có sẵn tại `P0PreviewPanel.tsx:142`.
- Kiểm tra toàn bộ luồng chat/sidebar/biểu mẫu bằng `scripts/assistant_ui_browser.mjs` với dữ liệu mock.
- `scripts/submitted_request_browser.mjs` dùng Playwright/Chrome và chặn toàn bộ `/api/v1/**` bằng fixture: giấy xác nhận gửi qua hai bước, yêu cầu đã gửi nhưng chưa đồng bộ mã, và khiếu nại chuyển cán bộ. Không gọi hay ghi vào backend thật.
- Xem popup, tải lại, thử lại, chuyển lịch sử và nhắn tiếp không phát sinh gửi đơn bổ sung. Popup chỉ đọc, hiển thị tiếng Việt thay các mã cách nhận/loại khiếu nại.
- Kiểm tra desktop 1440×900, 1024px, tablet 768px, mobile 390×844, sáng/tối, không tràn ngang và không có lỗi JavaScript trình duyệt.
- Unit regression xác nhận vị trí thẻ tồn tại sau tin nhắn tiếp theo/tải lại và cập nhật chậm vẫn thuộc hội thoại gốc.

```bash
node scripts/submitted_request_browser.mjs --base-url http://127.0.0.1:3100 --output-dir /tmp/campus-submitted-request-final
```

Ảnh và `report.json` trong thư mục là dữ liệu API giả lập để kiểm chứng giao diện.
