# docs(gate2): package MVP deliverables and verify integrated flows

Gate 2 còn thiếu tài liệu sản phẩm và evidence theo runtime tích hợp; các smoke
script còn dùng kỳ vọng khiếu nại tự chuyển L4 và chọn nhầm tài khoản operational.
Bổ sung bộ `docs/gate-2/` với setup/env/sample queries, components/data flow,
6 ca có actual output, ảnh browser, live LangGraph E2E và kịch bản video.

Khi reload deep link Hồ sơ của tôi, hydration danh sách có thể ghi đè detail đã
tải và làm mất phản hồi cán bộ trên UI. Tải detail sau khi hydration hoàn tất;
browser regression trì hoãn hydration rồi kiểm tra phản hồi còn thấy sau reload.

Smoke chọn đúng demo-login section; khiếu nại thường đi qua form/Submit 1,
L4 dùng yêu cầu vượt thẩm quyền. Giữ kiến trúc/audit cũ trong file archive;
README, architecture và eval entrypoint trỏ về gói hiện hành.

Validation: 361 backend tests, Ruff/OpenAPI, frontend 8 regression scripts/91
assertions, production build, HTTP E2E 6 cases, live LangGraph E2E và browser
flows. ESLint exit 0 với 2 warning có sẵn. Log/source hashes trong
`docs/gate-2/evidence/verification.json`.

Video do thành viên quay sau. GitHub hiện có 9 PR merged; PR này chỉ được tính
sau review/merge. Phiếu xác nhận manual của thành viên đội chưa được ký;
Codex/browser checks được ghi đúng hình thức, không thay người nghiệm thu.
