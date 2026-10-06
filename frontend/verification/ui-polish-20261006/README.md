# UI Polish Verification (2026-10-06)

## Các thay đổi đã thực hiện:
1. **Gộp điều hướng:** Bỏ sidebar trùng lặp ở `StaffShell`, chuyển metadata xuống footer; bỏ tiêu đề thừa ở `AssistantWorkspace`, ẩn floating trigger `AssistantSurface` khi ở trang `/student/assistant`; tự động thu gọn khung chat khi viewport desktop < 1440px.
2. **Trạng thái hồ sơ đọc trong 1 giây:** Chuẩn hóa logic filter ticket ở `my-requests.ts` (1 ticket chỉ thuộc 1 trạng thái); thẻ thống kê hiển thị số lượng chính xác; làm nổi bật cảnh báo "Cần bổ sung"; badge trạng thái viết hoa kèm chấm màu nhận diện đồng nhất.
3. **Mobile chống tràn & đè nội dung:** Thu gọn nút FAB trợ lý trên mobile chỉ hiện icon; tab trạng thái cho phép scroll ngang `whitespace-nowrap`; header navbar chống tràn `shrink-0`; căn lề tin nhắn người dùng về bên phải.
4. **Lịch sử trò chuyện có tên:** Tự động đặt tiêu đề cuộc hội thoại từ câu hỏi đầu tiên của sinh viên; loại bỏ các luồng rỗng dư thừa.
5. **Chi tiết demo & micro-radius:** Nút tải file tùy biến chuẩn tiếng Việt ("Chọn tệp" + hiển thị tên tệp đã chọn); thay các liên kết "Giải thích" rải rác bằng icon tooltip gọn gàng; đồng bộ chiều cao card loại tài liệu `min-h-[76px]`; hỗ trợ `break-all` cho mã hồ sơ dài; áp dụng micro-radius `rounded-sm` (2-4px) đồng bộ toàn hệ thống.

## Cố ý chưa làm / Giữ nguyên:
- Không thay đổi backend, database models, API contract hay logic nghiệp vụ cốt lõi.
- Giữ nguyên các định danh selector phục vụ test (`id`, `aria-label`, data attributes).
- Giữ nguyên toàn bộ văn phong và thuật ngữ tiếng Việt đã chốt.
