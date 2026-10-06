# Kiểm chứng giao diện Hồ sơ của tôi — 06/10/2026

Phạm vi: `/my-requests`, danh sách và chi tiết hồ sơ sinh viên. Giao diện theo `frontend/DESIGN.md`.

## Thay đổi

- Khi chưa chọn hồ sơ, danh sách dùng toàn bộ chiều rộng với các cột yêu cầu, mã/ngày ghi nhận và trạng thái. Không còn khung chi tiết trống chiếm phần lớn màn hình.
- Tổng quan hiển thị số lượng thật từ hồ sơ của tài khoản hiện tại, có thể bấm để lọc. Mục chờ/đang xử lý bao gồm hồ sơ mới ghi nhận và hồ sơ chờ cán bộ.
- Tìm kiếm, loại hồ sơ và các tab trạng thái được gom thành một thanh công cụ. Giữ từ khóa, bộ lọc và lựa chọn hồ sơ trong URL.
- Khi chọn hồ sơ, desktop hiển thị danh sách gọn bên trái và chi tiết bên phải. Mobile tập trung vào chi tiết; quay lại trả focus về hồ sơ vừa chọn.
- Chi tiết dùng một khung liền mạch, ưu tiên trạng thái, thông tin chính, việc cần làm và tiến trình. Giữ các luồng phản hồi, bổ sung, tài liệu và tải thông tin.

## Kiểm tra

- TypeScript và `npm run test:regression` thành công. Lint toàn frontend không có lỗi; còn một cảnh báo có sẵn tại `P0PreviewPanel.tsx:142`.
- Playwright/Chrome ở desktop 1440×1000, tablet 768×1024 và mobile 390×844, cả sáng/tối; không tràn ngang và không có lỗi JavaScript trình duyệt.
- Kiểm tra tìm kiếm theo mã, lọc trạng thái và loại hồ sơ, kết quả rỗng, liên kết không hợp lệ, tải lại vẫn giữ hồ sơ được chọn, mở hồ sơ bằng Enter và trả focus khi quay lại.
- Kiểm tra lưu tin nhắn, tải thông tin hồ sơ và từ chối tệp bổ sung sai định dạng. Đây là dữ liệu mock trong browser context riêng; không gửi hồ sơ hay tin nhắn lên backend thật.

Ảnh và kết quả trong `report.json` được tạo bằng:

```bash
node scripts/requests_ui_browser.mjs --base-url http://127.0.0.1:3000 --output-dir frontend/verification/requests-ui-20261006
```

Server cần cho phép chuyển sang dữ liệu mock. Các ngày, mã và nội dung yêu cầu trong ảnh là dữ liệu mẫu có sẵn.
