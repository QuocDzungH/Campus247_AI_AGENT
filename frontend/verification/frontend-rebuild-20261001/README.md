# Frontend Campus 24/7 — gói review 01/10/2026

Đủ điều kiện mở PR review giao diện và luồng mock cho sinh viên/cán bộ. Đây là bản frontend trên nhánh `feat/frontend-ai-rebuild`, gồm nền tảng auth/data/draft dùng chung, cổng sinh viên, hàng chờ cán bộ, ticket và review. Không xác nhận sẵn sàng vận hành thật.

## Kiểm chứng

- Production build snapshot riêng: Next.js 16.3.6, 16 route, exit 0; 26 JS/CSS asset của năm route khớp byte với build. Build ID `KOrHeUFUlH6_-OkDc22F7`; preview QA `http://127.0.0.1:3136` chỉ dùng tại máy kiểm định.
- TypeScript không emit/incremental và ESLint phạm vi sản phẩm: exit 0.
- Bốn bộ test: store config 13 nhóm, student release 8 nhóm, staff workspace 5 nhóm, staff audit regression 5 nhóm — Pass.
- Edge 154.0.4258.37, Chrome 154.0.8037.59 trên Windows. 1366×768, 1920×1080, 390×844; sáng/tối; Page zoom thật Chrome 125/150/200%.
- 129 ca hồi quy + 19 ca bổ sung + 9 đo màu/geometry = 157 Pass, 0 Fail. Có các tổ hợp viewport/theme của cùng hành vi, không phải 157 nghiệp vụ độc lập.
- 28 scan axe: 0 violations; vẫn có các mục `incomplete` về gradient/che khuất. Metadata từng bị lỗi có ratio tối thiểu 5.7569:1 trên các nền đã đo.
- Không ghi nhận pageerror, console error/warning hoặc HTTP ≥400 từ ứng dụng trong các run cuối. Tám warning preload thuộc trang `edge://downloads-hub/`; ERR_ABORTED do điều hướng được lọc có chủ ý.

[Ca kiểm thử](cases.json), [log kỹ thuật](technical-checks.json), [source/runtime proof](final-source-proof-build03.json), [tóm tắt axe](accessibility-summary.json). Đây là gói bằng chứng chọn lọc; profiles, tải xuống, snapshot build và toàn bộ lịch sử attempt được giữ cục bộ, không đưa vào Git.

Khi stage các tệp mới để tạo PR, `git diff --cached --check` phát hiện whitespace có sẵn trong sáu tệp. Đã sửa định dạng bằng patch hẹp; [JavaScript phát ra trước/sau](whitespace-proof.json) giống hệt. [Kiểm chứng publish](publication-checks.json) ghi production build mới, TypeScript, ESLint và bốn bộ test sau sửa đều exit 0. Bộ 157 ca browser ở trên được chạy trước thay đổi whitespace; không ghi rằng đã chạy lại toàn bộ browser sau định dạng.

## Đóng 11 lỗi audit

| Lỗi | Hành vi sau sửa | Bằng chứng |
|---|---|---|
| QA-01 P1: tab cũ ghi đè phản hồi mới | Web Lock + đọc persisted snapshot mới nhất; conflict giữ nháp và phản hồi tab khác | [Conflict phản hồi](evidence/stale-response.png) |
| QA-02 P1: dialog mất nút ở zoom | Panel theo viewport, overflow cuộn; focus tới nút cuối đưa nút vào viewport | Geometry/scroll/action trong [cases](cases.json); tại 200%, nút finalize review y299–343 trong viewport cao384 |
| QA-03 P1: dialog trong suốt | Surface và foreground sáng/tối riêng | [Dialog sáng](evidence/response-dialog-light.png), [mobile](evidence/mobile-completion.png) |
| QA-04 P1: login nhanh bỏ ghi nhớ mất phiên | Generation guard ngăn bootstrap ghi đè phiên vừa login | Năm lượt nhanh Pass; reload không ghi nhớ mất phiên đúng thiết kế |
| QA-05 P2: metadata thiếu tương phản | Màu semantic theo theme | Tám phép đo, 216 node, min5.7569:1 |
| QA-06 P2: chuỗi dài tràn toàn trang | Cho phép ngắt chuỗi dài trong staff workspace/dialog | [Chuỗi dài](evidence/long-content.png); scrollWidth1366 trên viewport1366 |
| QA-07 P2: quay lại mất hàng chờ | Phục hồi URL, scroll và focus theo tài khoản | [Quay lại](evidence/queue-return.png) |
| QA-08 P2: bổ sung review thiếu audit | Audit cùng transaction, đúng actor/ISO/source; chặn snapshot cũ | [Audit](evidence/supplement-audit.png), [conflict review](evidence/stale-review.png) |
| QA-09 P2: retry storage không phục hồi | Retry tái tạo gateway, bảo toàn byte đã lưu | [Phục hồi](evidence/storage-retry.png) |
| QA-10 P3: bộ lọc không có Back/Forward | Filter/trang tạo history entry, tìm kiếm dùng replace | Ca Back/Forward và đổi lọc ở trang cuối Pass |
| QA-11 P3: audit thiếu năm | Ghi full ISO, UI định dạng Asia/Bangkok, fallback dữ liệu cũ | Audit/ticket/review reload Pass |

Nháp lưu theo tài khoản/ticket, giữ tương thích nháp legacy và chặn stale save: [conflict nháp](evidence/stale-draft.png). Vùng chứng cứ có focus/role để cuộn bằng bàn phím: [ảnh nguồn](evidence/source-keyboard.png). Hai nhóm nút được gắn role ARIA phù hợp.

Ticket thực hiện phản hồi → bổ sung → hoàn tất → reload, đúng actor và không phát hành tài liệu: [kết quả](evidence/ticket-completed.png). Review kiểm tra citation/document/version/page, validation, nguồn cũ/thiếu và kết luận; phiếu hoàn tất là đề xuất: [kết quả](evidence/review-completed.png). Smoke sinh viên tạo yêu cầu, danh sách/chi tiết, upload bổ sung và tải sau reload khớp từng byte: [ảnh](evidence/student-supplement.png).

## Chạy lại kiểm chứng kỹ thuật

Tại `frontend/`, sau khi cài dependencies theo lockfile và build:

```text
npm run build
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js app components lib next.config.ts test-staff-audit-regression.mjs
node test-store-config.mjs
node test-student-release.mjs
node test-staff-workspace.mjs
node test-staff-audit-regression.mjs
```

`next-env.d.ts` là file Next sinh tự động. Bản dev có sẵn trong working tree được giữ tại máy, không commit thay đổi đường dẫn `.next/dev/types`; build mới sinh file thích hợp. Manifest QA ghi bản working tree lúc build, không đại diện mọi tệp của Git commit.

## Giới hạn và việc người review cần kiểm tra

- Backend staff API/auth/revision/idempotency, AI thật, SLA, đồng bộ đa thiết bị và ký/phát hành tài liệu: chưa tích hợp/kiểm chứng. Web Lock chỉ bảo vệ cùng origin/trình duyệt trên thiết bị; trình duyệt thiếu Web Locks từ chối ghi an toàn.
- UI chỉ có OF001 mẫu. Hai actor được kiểm tra bằng regression in-memory; chưa kiểm tra hai cán bộ login riêng qua UI.
- Chưa chạy NVDA/JAWS, mobile/IME thật hoặc zoom thật Edge. Keyboard và mobile viewport đã chạy.
- Ảnh Chrome automation ở zoom cao bị trắng/clipping; không dùng ảnh đó chứng minh khả năng đọc chữ. Geometry, cuộn, focus/action đã kiểm tra trong browser; review trực quan trên Chrome có cửa sổ trước nghiệm thu accessibility cuối.
- Axe `incomplete` và các trạng thái hover/selected/disabled còn cần đánh giá thủ công rộng hơn. Không tuyên bố chứng nhận WCAG đầy đủ.
- Không chạy lại toàn bộ 197 ca audit cũ; chỉ ghi Pass cho 157 ca mới được liệt kê. Không chạy backend Ruff/Pytest trong lượt frontend.
