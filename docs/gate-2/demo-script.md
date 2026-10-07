# MVP demo — kịch bản video 3 phút

Video do thành viên đội quay sau. Chưa có URL/video trong bộ tài liệu này.
Dùng [setup README](../../README.md), frontend API mode, API + worker cùng DB.
Chọn và công bố rõ stub hay model thật; nếu quay AI thật, chạy lại các ca manual
trên `AGENT_MODE=langgraph` và đúng RAG corpus sẽ trình diễn.

| Thời gian | Màn hình / thao tác | Điểm cần thấy |
| --- | --- | --- |
| 00:00–00:20 | Giới thiệu Campus 24/7, vai trò và mode | Bài toán học vụ, sinh viên/cán bộ |
| 00:20–01:10 | Sinh viên chat cấp giấy, review/sửa preview, xác nhận Submit 1 | Thông tin đầu vào, cổng xác nhận, mã ticket thật |
| 01:10–02:25 | Cán bộ mở đúng ticket, claim, chuẩn bị/review brief, phản hồi và Submit 2 | Facts/checklist/draft, người quyết định cuối, audit |
| 02:25–02:50 | Sinh viên login/reload và xem kết quả cùng mã ticket | Flow end-to-end, dữ liệu từ DB |
| 02:50–03:00 | Kiến trúc/evidence/giới hạn và link repo | Nguồn hồ sơ Gate 2 |

Chuẩn bị trước: kiểm `/ready`, tắt mode switch, có hai account đúng role và
trình duyệt không lưu phiên cũ. Không dùng `--reset` trên DB chứa evidence.
Có thể dùng hai profile/window riêng để chuyển vai trò nhanh.

Khi nộp: ghi URL video, ngày quay, commit, mode agent/RAG và người thực hiện
vào [README Gate 2](README.md). Video phải cho thấy kết quả sinh viên sau xử lý,
không kết thúc chỉ ở màn hình Submit 1.
