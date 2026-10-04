# Browser exploratory review — Gate 2

Ngày 04/10/2026, Asia/Phnom_Penh. **Người điều khiển và đọc kết quả: Codex**,
qua browser Chrome headless/Playwright REPL. Các thao tác được chọn và gửi từng
bước theo UI đang thấy, đọc lại nội dung/response và xem screenshot; không chạy
một suite batch cho lượt này. Đây là kiểm tra có hỗ trợ agent, **không phải
người kiểm thử của đội đã ký nghiệm thu manual**.

Frontend API mode, agent/RAG stub, SQLite tạm, API/worker riêng. UI là production
build từ code tích hợp, sau đó áp dụng bản sửa hydration cho lượt kiểm lại M05.
Các bước trước và sau sửa được giữ nguyên trong
[observations.json](evidence/exploratory/observations.json), cùng UI text, thời
gian, URL và response API không gồm auth/token.

## Kết quả 5 ca theo bước

| Ca | Thao tác đã thực hiện | Actual quan sát | Kết quả sau sửa | Ảnh |
| --- | --- | --- | --- | --- |
| M01 | Login sinh viên → chat quy trình cấp giấy → đọc câu trả lời | “Kho tài liệu hiện tại chưa đủ căn cứ để trả lời câu hỏi này.”; không form/ticket | PASS trong stub mode | [L1](evidence/exploratory/M01-lookup.png) |
| M03 | Chat xin giấy chưa có dữ kiện → bấm Submit 1 | Báo thiếu mục đích/nơi nhận/cách nhận và “Preview chưa đủ…”; chưa tạo ticket | PASS | [Thiếu trường](evidence/exploratory/M03-missing.png) |
| M02 | Điền mục đích “Nộp hồ sơ vay vốn ngân hàng — kiểm tra Gate 2 từng bước”, nơi nhận NHCSXH, chọn PDF → cập nhật preview → đọc xác nhận → xác nhận gửi | Preview phiên bản 2 đủ dữ liệu; tạo `TKT-2026-0005` chỉ sau xác nhận | PASS | [Đã nộp](evidence/exploratory/M02-submitted.png) |
| M04 | Chat khiếu nại môn Cơ sở dữ liệu vì điểm bài thi chưa đúng → review → Submit 1/xác nhận | Course/description đúng input; trước xác nhận chưa ticket/khóa AI; sau xác nhận `TKT-2026-0006`, chờ cán bộ, AI khóa | PASS | [Preview](evidence/exploratory/M04-preview.png), [đã gửi](evidence/exploratory/M04-submitted.png) |
| M05 | Login cán bộ → tìm `TKT-2026-0005` → claim → chuẩn bị/đọc brief → soạn và xác nhận hoàn tất → login sinh viên → xem ticket → reload deep link | Brief đúng hồ sơ, phản hồi thử nghiệm không phát hành giấy; sau sửa reload còn trạng thái hoàn tất, phản hồi và 3 messages | PASS sau sửa race hydration | [Brief](evidence/exploratory/M05-officer-brief.png), [cán bộ hoàn tất](evidence/exploratory/M05-officer-completed.png), [sinh viên sau reload](evidence/exploratory/M05-student-after-reload.png) |

## Lỗi phát hiện và kiểm lại

Lần đầu M05 reload giữ `resolved` nhưng UI báo chưa có phản hồi/hội thoại.
[Ảnh trước sửa](evidence/exploratory/M05-reload-missing-messages.png).
Response API vẫn có **3 messages** gồm phản hồi cán bộ. Account hydration lấy
danh sách (không có messages) sau khi detail được tải và ghi đè detail trên
store. Vì vậy trạng thái ticket đúng nhưng thread biến mất.

Sửa [StudentRequestsPage](../../frontend/components/student/StudentRequestsPage.tsx):
chờ khôi phục account/list hoàn tất trước refresh selected detail; effect theo
loading và identity/role để chạy lại đúng thời điểm. Lượt kiểm lại cùng deep
link/ticket đã thấy message cán bộ sau reload; ảnh và UI text ở mục M05.

[Browser regression](evidence/browser/report.json) cũng kiểm lại deep link,
trì hoãn account hydration 750ms và xác nhận phản hồi cán bộ vẫn hiện.
Production build, lint và regression frontend được chạy lại sau sửa.

## Đối chiếu và nghiệm thu

Mã ticket khác report HTTP/batch browser vì từng run dùng seed/DB hoặc dữ liệu
mới. Không lấy mã của run này để diễn giải response của run khác. L1 trong
stub mode kiểm tra thiếu căn cứ; [live report](evidence/live-e2e.json) riêng
kiểm tra model thật/citation trên demo corpus.

Đội dùng [phiếu manual](evaluation.md#phiếu-xác-nhận-manual-đội-điền-sau-khi-chạy-thực-tế)
để chạy/xác nhận theo tiêu chí nộp với đúng commit/mode sẽ quay video. Các ảnh
và kết quả của Codex là bằng chứng tham chiếu, không thay tên người nghiệm thu.
