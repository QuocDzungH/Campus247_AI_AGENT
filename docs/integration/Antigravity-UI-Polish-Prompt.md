# Prompt cho Antigravity: cải thiện giao diện Campus 24/7

Dán toàn bộ mục **Prompt** dưới đây vào Antigravity. Working directory: repo P-120. Không commit/push trừ khi người dùng yêu cầu sau.

Nguồn nhận xét: review UI 2026-10-06 trên `frontend/` (ThoughtStream), ảnh `frontend/verification/*-20261006/`.

---

## Prompt

Bạn đang làm việc trong repo P-120, **chỉ sửa `frontend/`** (và test/verification đi kèm nếu cần). Đây là đợt polish UX, không viết lại sản phẩm, không đổi backend, không commit/push.

Đọc trước: `frontend/AGENTS.md`, `frontend/DESIGN.md` (mục Campus 24/7 integration được ưu tiên), rồi khảo sát code hiện tại. Không tin mô tả dưới đây nếu code đã khác — đối chiếu rồi mới sửa.

### Mục tiêu

Giao diện ThoughtStream hiện đã nhất quán nhưng còn: điều hướng chồng, trạng thái hồ sơ khó quét, mobile va chạm, lịch sử chat vô danh, và vài chi tiết demo lòi ra. Làm **5 nhóm theo thứ tự**. Mỗi nhóm xong thì kiểm tra light + dark, desktop (~1280/1920) và mobile (~390). Giữ tiếng Việt, luồng nộp hồ sơ, mock/api, a11y (focus, min-h-11, không chỉ dùng màu).

**Được phép nới DESIGN.md trong phạm vi này:**

- Bo góc nhỏ `rounded-sm` (2–4px) cho input, chip, card, nút. Không bo pill toàn bộ.
- Một accent vận hành: dùng token status hiện có (amber bổ sung, emerald hoàn tất) + làm `new`/`processing` khác nhau rõ. Không đưa lại palette xanh bo góc kiểu Gate 1 cũ.
- Không thêm shadow lớn, gradient, illustration.

**Cấm:**

- Rewrite toàn bộ layout/theme.
- Đổi copy nghiệp vụ đã chốt (nhãn trạng thái tiếng Việt, disclaimer trợ lý).
- `git commit` / `git push`.
- Sửa backend, contracts, mock data nghiệp vụ.
- Che lỗi bằng comment/`eslint-disable`.

---

### Nhóm 1 — Gộp điều hướng (ưu tiên cao)

Hiện có nhiều lớp chrome:

1. `frontend/components/Navbar.tsx` — Dịch vụ / Trợ lý / Hồ sơ (SV) hoặc Hàng chờ / Rà soát (cán bộ).
2. Sidebar trợ lý trong `frontend/components/student/AssistantWorkspace.tsx` (lặp tiêu đề “Trợ lý học vụ”).
3. Sidebar cán bộ trong `frontend/components/staff/StaffShell.tsx` lặp đúng 2 mục Navbar.
4. FAB “Hỏi trợ lý” `frontend/components/student/AssistantSurface.tsx` gắn qua `StudentRuntime.tsx` khi `!assistant.isChat`.

**Việc cần làm:**

- **Cán bộ:** bỏ sidebar trùng trong `StaffShell`. Giữ Navbar. Metadata “Dữ liệu mẫu · lưu trên thiết bị” chuyển xuống footer nội dung hoặc hàng phụ dưới tiêu đề trang, truncate/`break-words`, không tràn.
- **Sinh viên / Trợ lý:** Navbar vẫn là điều hướng toàn cục. Sidebar trái **chỉ** còn lịch sử hội thoại + “Trò chuyện mới” + ô tìm. Bỏ hàng tiêu đề “Trợ lý học vụ” trùng Navbar; nút thu gọn sidebar giữ lại.
- Khi đang ở `/student/assistant`, **không hiện FAB** “Hỏi trợ lý” (đã có composer). FAB chỉ hiện trên `/student`, `/my-requests`, form ngoài trang chatbot.
- Form + chat 3 cột (sidebar | form | chat) trên desktop: chat phải là panel có thể thu (`Thu gọn trợ lý` đã có). Mặc định: nếu viewport < 1440px thì thu chat, để form rộng; ≥1440px mới mở song song. Mobile giữ tab form/chat hiện tại.

Kiểm tra: đăng nhập SV001 và OF001, đi hết 3 mục nav, không còn hai thanh cùng chỉ một chỗ.

---

### Nhóm 2 — Trạng thái hồ sơ đọc được trong 1 giây

File chính:

- `frontend/lib/my-requests.ts` — `requestStates`, `filterRequests`, `collectRequests`
- `frontend/components/student/StudentRequestsPage.tsx` — tab, ô thống kê, `counts`
- `frontend/components/student/RequestDetail.tsx` — `RequestStatus`
- `frontend/app/student/page.tsx` — `StatusIndicator`

**Bug phải sửa:** `filterRequests` đang gộp `state === "new"` vào filter `"processing"`:

```ts
filter === "processing" && item.state === "new"
```

Hệ quả: tab “Đang xử lý 5” chồng “Đã lưu hồ sơ 3”, tổng các tab > “Tất cả”. Ô “Chờ & đang xử lý” cũng dùng cùng hàm nên phình số.

**Việc cần làm:**

- Mỗi hồ sơ thuộc **đúng một** tab: `all | new | processing | supplement | completed | draft`. Bỏ nhánh gộp `new` vào `processing`.
- `counts` = số item theo `item.state` trên list đã lọc category (không lẫn query), tổng các state = `all`.
- Ô thống kê:
  - “Tổng hồ sơ” = all
  - “Chờ & đang xử lý” = `new` + `processing` (nhãn giữ, **số được cộng tường minh**, không dùng filter chồng)
  - “Cần bổ sung” / “Hoàn tất” như cũ
  - Ô “Cần bổ sung” phải nặng hơn các ô khác khi count > 0 (viền/text amber). Ô “Hoàn tất 0” không cùng visual weight với việc cần làm.
- Chip `RequestStatus`:
  - `new` / “Đã lưu hồ sơ” / “Chờ cán bộ”: khác `processing`. Dùng token info/warning/success đã có trong `globals.css` (`--ts-status-*`). `processing` không cùng xám với `new`.
  - Giữ uppercase + chấm màu như `StatusIndicator` trang chủ cho đồng bộ.
- `StatusBadge` cán bộ (`frontend/components/shared/StatusBadge.tsx`) giữ mapping tiếng Việt; `open` vs `pending_officer` vs `in_review` phải phân biệt.

Kiểm tra trên `/my-requests` (mock SV001): cộng tab = Tất cả; click từng tab ra đúng tập; chip nhìn khác nhau khi squint test.

---

### Nhóm 3 — Mobile không đè nội dung

- FAB `AssistantSurface`: `fixed bottom-4 right-4 z-30` đang đè dòng hồ sơ đầu / composer. Thêm `padding-bottom` an toàn cho list/trang có FAB (ít nhất chiều cao nút + 16px). Trên mobile ưu tiên icon-only hoặc thu gọn để không che tab lọc.
- Tab lọc hồ sơ trên 390px bị cắt (“Cần bổ sung 1 Hoàn tất”). Đổi hàng tab thành `overflow-x-auto` + `nowrap`, không wrap giữa chữ.
- Footer sidebar trợ lý: `"Hội thoại và bản nháp lưu trên thiết bị."` đang tràn/đè. Dùng `break-words`, đủ padding, không absolute đè list.
- Chat mobile (`AssistantConversation`): bong bóng câu hỏi người dùng phải nằm trong cột hội thoại (căn phải trong thread), không trôi góc phải header. Giữ hint “Enter để gửi · Shift + Enter xuống dòng” hoặc rút gọn có chủ đích, không mất luôn.
- Navbar mobile: menu hamburger + account không chồng title.

Kiểm tra viewport 390×844 light và dark: `/student/assistant`, `/my-requests` list + detail, form bổ sung.

---

### Nhóm 4 — Lịch sử trò chuyện có tên

File: `frontend/lib/student-chat.ts`, `frontend/components/student/AssistantWorkspace.tsx` (`AssistantHistory`), `frontend/lib/assistant-context.tsx`.

Hiện `fresh()` luôn `title: "Cuộc trò chuyện mới"`. `start({ reuseEmpty })` đã có nhưng sidebar vẫn đầy bản nháp trùng tên.

**Việc cần làm:**

- Khi user gửi câu hỏi đầu, đặt title = 64 ký tự đầu câu (đã có nhánh ~line 321) — bảo đảm luôn chạy cho cả mock và api.
- Khi mở form: title theo intent, ví dụ “Xin giấy xác nhận” / “Khiếu nại điểm”, không để “Cuộc trò chuyện mới”.
- `start({ reuseEmpty: true })` khi vào empty state / bấm “Trò chuyện mới” nếu đã có thread trống (không input, không exchange, không form/ticket). Không nhân bản welcome.
- Sidebar: một thread trống tối đa; thread cũ trống có thể ẩn hoặc gộp. Subtitle “Có hồ sơ” / “Có câu hỏi chưa gửi” giữ.
- Ô “Tìm cuộc trò chuyện” đã là `<input type="search">` — giữ; đừng biến thành button. Kết quả rỗng giữ copy hiện tại.

---

### Nhóm 5 — Chi tiết demo lòi + nới visual vừa phải

Làm sau 1–4, gói gọn:

1. **Upload bổ sung** (`RequestDetail` và chỗ `input type="file"` khác): không để native “Choose File / No file chosen”. Nút tiếng Việt (“Chọn tệp”), hiện tên file đã chọn, helper “1 tệp PDF/PNG/JPG, tối đa 10MB”.
2. **Form VinUni** (`VinUniForm.tsx`): “Giải thích” / “Hỏi về mục này” chỉ hiện khi focus/hover hoặc một icon `?` có `aria-label`, không thành hàng link cạnh mọi nhãn.
3. **Grid loại tài liệu:** card cùng chiều cao (min-height), tên tiếng Việt nổi, English là caption nhỏ.
4. **Mã hồ sơ siêu dài:** `break-all` + `line-clamp` trên hàng chờ cán bộ (`StaffQueue.tsx`) và list SV.
5. **Disclaimer trợ lý:** một lần dưới composer, không lặp ở footer sidebar.
6. **Radius:** `rounded-sm` cho button/input/chip/card trong các file student/staff đã đụng. Logo mark 8×8 có thể `rounded-sm`. Không đổi sang fully rounded.

---

### Kiểm thử bắt buộc

- `frontend/test-student-release.mjs` và test staff/regression liên quan nếu đụng filter/nav.
- Browser (Playwright trong `scripts/` nếu có, hoặc tay): SV001 `/student`, `/student/assistant` empty + form + conversation, `/my-requests` list/detail/supplement; OF001 `/dashboard`. Light + dark, 1920 và 390.
- Lưu ảnh vào `frontend/verification/ui-polish-YYYYMMDD/` kèm README 5–10 dòng: đã sửa gì, còn gì cố ý chưa làm.
- Không phá: nộp form, citation, handover, claim ticket, bổ sung hồ sơ, keyboard focus, contrast ≥ 4.5:1 chữ thường.

### Cách làm

Khảo sát → sửa nhóm 1 → verify → nhóm 2 → … Không parallel rewrite. Nếu một file đang dirty không liên quan, không revert. Báo cáo cuối: file đổi, hành vi trước/sau, chỗ cố ý không làm.
