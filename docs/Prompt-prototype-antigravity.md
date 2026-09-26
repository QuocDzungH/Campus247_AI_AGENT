# Prompt Antigravity — tạo prototype mới từ ảnh Stitch

Dán khối dưới đây vào Antigravity và gửi kèm bộ ảnh Stitch mới cùng ảnh mẫu welcome/đăng nhập. Mã prototype cũ đã được xóa; `frontend/public/assets/` giữ lại asset ảnh để sử dụng cho bản mới.

```text
Hãy xây dựng MỚI HOÀN TOÀN prototype tương tác Campus 24/7 từ bộ ảnh màn hình Stitch và ảnh welcome/đăng nhập tôi cung cấp.

1. PHẠM VI TẠO MỚI
- Khởi tạo project Next.js App Router + TypeScript + Tailwind + Lucide mới trong frontend/.
- frontend/ hiện chỉ giữ asset ảnh. Tạo mới package.json, cấu hình, app, component, CSS/theme và mock service/store.
- Không khôi phục hoặc sao chép code prototype cũ từ Git history, cache, bản backup hay các câu trả lời trước.
- Không lấy layout/component/CSS cũ làm nền rồi đổi màu. Bộ ảnh Stitch mới là nguồn thiết kế chính.
- Giữ nguyên frontend/public/assets/ và các ảnh tham chiếu khi scaffold; không chạy lệnh khởi tạo ghi đè/xóa chúng.
- Nếu scaffolder yêu cầu thư mục trống, khởi tạo trong thư mục tạm rồi chuyển các file mới vào frontend/ mà không đụng asset đã có.
- Chỉ làm frontend prototype với dữ liệu giả lập. Không triển khai backend, database, LLM thật hoặc auth provider.

2. ĐỌC ẢNH VÀ TÀI LIỆU
- Xem trực tiếp từng ảnh mới tôi cung cấp trong hội thoại hoặc docs/design-references/.
- Lập bảng ngắn: ảnh tham chiếu → route → component → các trạng thái cần dựng.
- Tôn trọng bố cục, tỉ lệ, khoảng cách, typography và phân cấp thị giác trong ảnh.
- Nếu thiếu ảnh cho một màn, nói rõ và yêu cầu đúng ảnh còn thiếu; tiếp tục phần đã có đủ dữ liệu. Không tuyên bố đã đối chiếu ảnh chưa xem.
- Không tự dùng ảnh thiết kế cũ trong repository thay cho bộ ảnh mới nếu tôi chưa chỉ định.
- Đọc docs/Pipeline-L2-L3-L4.md, plan2-3-4.md và docs/Quy-trinh.md để hiểu nghiệp vụ. Chỉ mô phỏng hành vi bằng mock trong đợt này; chưa coi là triển khai backend P0.
- Ảnh quyết định cách trình bày; pipeline/plan quyết định nghiệp vụ. Nếu ảnh có dữ kiện hoặc thao tác sai nghiệp vụ, sửa phần đó và ghi rõ khác biệt.
- Yêu cầu tạo mới trong prompt này thay thế mọi hướng dẫn cũ về tái sử dụng frontend.
- Dựng bằng component tương tác; không dùng screenshot nguyên màn làm UI hoặc wallpaper chứa sẵn chữ/form.
- Áp dụng ui-ux-pro-max và taste-skill nếu có sẵn; không để phong cách mặc định của skill lấn át ảnh tham chiếu.

3. HAI CHẾ ĐỘ SÁNG VÀ TỐI
- Toàn bộ route, modal, dropdown, toast, form và bảng hỗ trợ cả Sáng/Tối.
- Có ThemeToggle dễ thấy trên welcome, login và header các màn nghiệp vụ.
- Mặc định Sáng lần đầu; lưu lựa chọn để giữ khi chuyển trang và reload.
- Chuyển theme không làm mất ticket, conversation, form hoặc draft đang sửa.
- Dùng chung component với semantic tokens: background, surface, elevated-surface, text, muted-text, border, primary, success, warning, danger, focus-ring và glass.
- Light gợi ý: nền #F5F7FB, surface #FFFFFF, chữ #172033, chữ phụ #526079, primary #2457D6.
- Dark gợi ý: nền #0B0F17, surface #111827, surface nổi #1E293B, chữ #F1F5F9, chữ phụ #A8B4C7, accent #60A5FA.
- Điều chỉnh token theo ảnh, giữ khả năng đọc. Không dùng filter invert để tạo theme còn lại.
- Nếu ảnh chỉ có một theme, giữ nguyên cấu trúc và thiết kế theme còn lại tương ứng.
- Tránh nháy sai theme khi tải trang. Chữ, icon, placeholder, focus và disabled đều phải rõ ở cả hai chế độ.

4. WELCOME VÀ ĐĂNG NHẬP BÁN TRONG SUỐT
- Tạo / cho Welcome và /login cho Đăng nhập, dùng chung AuthLayout mới.
- Bám ảnh mẫu: ảnh campus toàn viewport, logo góc trên trái, nút đổi theme góc trên phải, vùng giới thiệu bên trái và card chức năng bên phải.
- Desktop: vùng trái khoảng 55–60%; card phải rộng khoảng 380–440px, căn giữa theo chiều dọc. Điều chỉnh theo ảnh thực tế.
- Vùng trái có lớp kính bán trong suốt và cạnh chéo như ảnh; cảnh phía dưới kính mờ nhẹ, cảnh ngoài kính vẫn rõ.
- Card bên phải cũng bán trong suốt nhưng độ phủ cao hơn để dễ đọc form.
- Dùng nền RGBA + backdrop-filter blur khoảng 16–24px, viền mảnh và shadow tiết chế. Không giảm opacity toàn container làm mờ cả chữ.
- Light: card gợi ý rgba(255,255,255,0.84), chữ tối. Dark: card gợi ý rgba(17,24,39,0.84), chữ sáng và overlay tối vừa đủ trên ảnh nền.
- Giữ thương hiệu Campus 24/7; ảnh VLearn chỉ tham chiếu bố cục/kính. Không sao chép logo, email hoặc thông tin cá nhân trong ảnh.
- Dùng ảnh gốc trong frontend/public/assets/images/ nếu phù hợp; URL bắt đầu bằng /assets/images/. Nếu thiếu ảnh gốc, ghi rõ asset cần bổ sung, không dùng screenshot có form làm ảnh nền.
- Welcome giới thiệu ngắn lợi ích học vụ và hai cổng Sinh viên/Cán bộ; chọn cổng dẫn tới login với vai trò được chọn sẵn, không tự đăng nhập.
- Login có tài khoản/email, mật khẩu, hiện/ẩn mật khẩu, ghi nhớ email, nút đăng nhập, trạng thái loading và lỗi nhập liệu.
- Có nút điền tài khoản demo; vẫn phải bấm Đăng nhập. SV001 → /chat, OF001 → /dashboard.
- Không lưu mật khẩu vào localStorage. Quên mật khẩu/Hỗ trợ mở dialog hướng dẫn demo, không giả vờ gửi email thật.

5. CÁC MÀN NGHIỆP VỤ THEO ẢNH STITCH
- /chat: hội thoại, gợi ý câu hỏi, citation, composer; phân biệt hỏi thủ tục với muốn gửi yêu cầu giấy.
- Submit 1 là modal/trạng thái trong chat: prefill họ tên/MSSV, hỏi mục đích thiếu, preview, hủy, chỉnh sửa và xác nhận gửi.
- Sau khi lưu mock thành công: success card có mã ticket và Mới tiếp nhận; dẫn tới Yêu cầu của tôi.
- L4 là trạng thái trong chat: lý do bàn giao, mã ticket đã lưu, ưu tiên Cao, Chờ cán bộ; composer chuyển sang bổ sung cho cán bộ. Có biến thể đang chuyển/chuyển lỗi/thử lại.
- /my-requests: danh sách và chi tiết ticket của đúng sinh viên, trạng thái, tin cán bộ và gửi bổ sung trên cùng ticket.
- /dashboard: hàng chờ cán bộ, lọc trạng thái/ưu tiên/loại, tìm mã; high trước normal, có lý do ưu tiên. High có thể là L4 hoặc ca giấy có deadline.
- /tickets/[ticketId]: OfficerBrief gồm mục tiêu, summary, facts có nguồn, dữ kiện chưa xác minh, mục còn thiếu, checklist, SOP/template mẫu, next action, draft và audit.
- Có biến thể chi tiết ticket giấy và L4. Summary/checklist/draft L4 vẫn phục vụ nội bộ cho cán bộ.
- Cán bộ có Nhận việc, Gửi phản hồi, Yêu cầu bổ sung và Hoàn tất. Review dialog hiển thị nội dung cuối, người nhận và trạng thái sau thao tác trước gửi/hoàn tất.
- Checklist mặc định chưa hoàn thành; chỉ tick sau xác nhận của cán bộ hoặc kết quả mock có bằng chứng rõ ràng.
- Khi có dữ kiện mới, báo brief cần cập nhật, giữ draft cán bộ đang sửa và yêu cầu review lại trước gửi.
- Dùng tiếng Việt dễ hiểu trên UI. Các nhãn L1/L2/L3/L4, Submit 1/2 chỉ dùng trong chú thích demo khi cần.

6. QUY TẮC KHÔNG ĐƯỢC LÀM SAI
- open = Mới tiếp nhận; pending_officer = Chờ cán bộ; resolved = Đã hoàn tất.
- Submit 1 tạo yêu cầu, không cấp/ký PDF. Hủy không tạo ticket; thay đổi nội dung phải review lại preview mới.
- Gửi phản hồi không tự resolved. Chỉ cán bộ xác nhận Hoàn tất theo transition hợp lệ mới đóng ticket.
- AI không tự gửi draft, không quyết định nghiệp vụ.
- Hỏi “khiếu nại nộp ở đâu?” vẫn là L1; ca khiếu nại cụ thể, wellbeing hoặc yêu cầu sửa điểm/xóa môn đi L4.
- Khi trộn xin giấy với ca nhạy cảm, L4 thắng và preview giấy cũ bị vô hiệu hóa.
- L4 tạo/nâng ticket complaint/pending_officer/high theo routing đã định; AI dừng trả lời trên conversation đó, không khóa mọi conversation khác.
- Lỗi handover không báo đã chuyển; giữ khóa AI, cho retry. Retry cùng thao tác không tạo trùng ticket/message.
- Không bịa SLA, số quy chế, biểu mẫu hoặc trạng thái đã xác minh. Nguồn demo ghi rõ Tài liệu minh họa.
- Ticket pending_officer không tự chứng minh cán bộ đã bắt đầu rà soát; resolved không tự chứng minh giấy đã cấp.
- Phân biệt dữ liệu SV cung cấp và dữ liệu đã kiểm chứng. Cổng SV không thấy artifact/ghi chú nội bộ của CB.
- Không thêm đặt phòng, thanh toán, đăng ký tài khoản, ký số hay phát hành PDF.

7. MOCK STATE VÀ TƯƠNG TÁC
- Viết mới schema, mock service và store; một nguồn state chung cho hai cổng, không dùng từng bộ dữ liệu rời cho mỗi màn.
- Demo: SV001 Nguyễn Văn An, OF001 cán bộ; thêm SV024 để kiểm tra không xem nhầm ticket.
- Mã ticket, message, trạng thái và audit phải khớp xuyên suốt các màn.
- Có thể lưu dữ liệu demo vào localStorage. Đổi tài khoản/đăng xuất không xóa ticket; Reset demo là thao tác riêng.
- Client guard và selector mô phỏng quyền theo vai trò; không trình bày chúng như bảo mật backend thật.
- Có loading, empty, validation error, save error, retry và AI preparation error.
- Lỗi gửi giữ nguyên nội dung nhập; theme switch/AI refresh không mất draft.
- Có bộ điều khiển demo gọn để mô phỏng lỗi nộp, handover và gửi phản hồi.
- Nhãn Bản mẫu · Dữ liệu giả lập hiển thị gọn, không lấn át nội dung chính.

8. RESPONSIVE VÀ KHẢ NĂNG SỬ DỤNG
- Desktop 1440px, tablet 768px, mobile 375px.
- Welcome/login mobile chuyển một cột, rút gọn giới thiệu, giảm cạnh chéo nếu làm khó đọc; giữ cảm giác kính và ảnh nền.
- Sidebar thành drawer; danh sách/chi tiết trên mobile có đường quay lại rõ ràng.
- Modal cuộn được, nút gửi không bị bàn phím che; không cuộn ngang toàn trang.
- Đầy đủ hover, pressed, focus-visible, disabled/loading; label input, keyboard navigation và quản lý focus trong dialog.
- Tôn trọng reduced motion; badge có chữ/icon kèm màu, không nhấp nháy liên tục cho một trạng thái ưu tiên cố định.
- Nội dung khoảng 14–16px, metadata khoảng 12–13px; mã và số liệu dùng tabular numerals.
- Glass nổi bật ở welcome/login; bảng, editor và facts dùng nền ổn định, dễ đọc.

9. THỰC HIỆN VÀ NGHIỆM THU
- Sau khi xem đủ ảnh và trình bày mapping ngắn, tiếp tục scaffold mới và code; không dừng ở việc mô tả kế hoạch.
- Chỉ sửa phạm vi frontend/ cho prototype; giữ backend, tài liệu nghiệp vụ và asset tham chiếu. Không commit, push hoặc deploy.
- Kiểm tra luồng: Welcome → Login SV → hỏi thủ tục không ticket → xin giấy → preview/review → nộp → theo dõi.
- Kiểm tra đổi sang CB → thấy cùng ticket → nhận việc → reply chưa đóng → yêu cầu bổ sung → SV trả lời → CB hoàn tất → hai cổng đồng bộ.
- Kiểm tra L4: nhận diện đúng, bàn giao, khóa conversation, CB tiếp tục xử lý; câu hỏi thủ tục không bị chuyển nhầm.
- Kiểm tra lỗi/retry không thành công giả hoặc tạo trùng; đổi theme/reload không mất trạng thái; SV024 không thấy ticket SV001 qua UI mock.
- Chạy build/type/lint phù hợp. Nếu có browser tool, kiểm tra các route và trạng thái chính ở cả hai theme và ba kích thước.
- Chụp kết quả đối chiếu bộ ảnh Stitch về bố cục, typography, khoảng cách và kính; chỉnh các khác biệt không chủ ý trước khi kết thúc.
- Báo cách chạy, file đã tạo, kết quả kiểm tra và phần thiếu ảnh/asset. Chỉ xác nhận những gì thực sự kiểm tra được.
```
