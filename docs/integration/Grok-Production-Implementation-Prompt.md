# Prompt cho Grok: chuyển Campus 24/7 sang hệ thống vận hành thật

Bạn đang làm việc trong repository P-120 (Campus 24/7). Hãy trực tiếp khảo sát, triển khai, kiểm thử và bàn giao hệ thống chạy bằng backend, dữ liệu lưu bền, tài khoản xác thực và AI model thật. Tôi yêu cầu thực hiện trong code, không chỉ viết kế hoạch hoặc đổi nhãn giao diện.

## 1. Phạm vi và ưu tiên mới

- Đọc AGENTS.md áp dụng cho từng thư mục, README, contracts, migrations và docs/integration/Grok-Frontend-Backend-Agent-Plan.md. Đối chiếu mã nguồn hiện tại; không mặc định thông tin trong kế hoạch cũ còn đúng.
- Yêu cầu này thay thế giới hạn của kế hoạch cũ về dừng ở G3, chỉ phục vụ demo, và bắt buộc giữ nguyên mọi file mock. Form, tệp, nháp, checklist và workspace review cũng thuộc phạm vi triển khai lần này.
- Bản vận hành chính thức phải dùng API. Mock/Stub/fixtures được giữ cho kiểm thử độc lập nếu cần, nhưng không được tham gia luồng người dùng chính thức hoặc tự fallback khi lỗi.
- Giữ thiết kế và nghiệp vụ hiện có khi phù hợp. Không viết lại toàn bộ dự án nếu có thể mở rộng kiến trúc hiện tại.
- Kiểm tra git status trước khi sửa. Bảo toàn thay đổi chưa commit của người dùng, không reset --hard, không xóa dữ liệu hiện có, không tự merge/push/deploy công khai.
- Triển khai tuần tự các phần phụ thuộc, tiếp tục tới khi mọi chức năng có thể thực hiện trong repo đã hoàn thành. Nếu một phần cần thông tin bên ngoài, hỏi rõ và tiếp tục các phần độc lập.

## 2. Hiện trạng cần xác minh lại

Ở thời điểm tạo prompt:

- .env đã đặt AGENT_MODE=langgraph, RAG_MODE=corpus; Gemini đã trả lời thành công trong một lời gọi trực tiếp; API /api/v1/status báo CampusAgent. Không suy ra toàn bộ chatbot và các graph đã được kiểm thử từ lời gọi này.
- Corpus hiện dùng index edu14-demo-academic-v1, chưa phải kho quy chế chính thức của nhà trường.
- backend/src/campus247/services/auth.py chỉ có demo_login; chưa có xác thực mật khẩu thật.
- frontend/app/login/page.tsx kiểm tra mật khẩu demo1234 ở client rồi gọi login bằng user ID demo.
- frontend/lib/data/api/api-gateway.ts gọi /api/v1/auth/demo-login. Có ánh xạ tài khoản demo trong frontend/lib/data/api/demo-accounts.ts.
- User và StudentProfile trong backend/src/campus247/db/models.py có is_demo; schema hiện chưa thể hiện đầy đủ credential và vòng đời tài khoản thật.
- frontend/lib/data/config.ts mặc định mock khi thiếu cấu hình.
- frontend/lib/certificate-service.ts và fixtures có dữ liệu đối chiếu học vụ/tài chính mô phỏng. Không được dùng các kết quả này làm bằng chứng xác minh thật.

Hãy khảo sát lại toàn bộ các luồng, bao gồm luồng ít được dùng, trước khi quyết định sửa.

## 3. Tài khoản, mật khẩu, phiên và quyền

- Triển khai đăng nhập thật ở backend bằng identifier + password. Identifier hỗ trợ tên đăng nhập/email/MSSV theo dữ liệu được cấp; quy tắc chuẩn hóa phải rõ ràng, không làm mất số 0 đầu của MSSV.
- Lưu password hash bằng thuật toán chuyên dụng hiện được duy trì, như Argon2id. Xác minh tại backend; không lưu mật khẩu dạng rõ, không so sánh demo1234 ở frontend, không dùng SHA-256 đơn thuần cho mật khẩu.
- Cập nhật schema, Alembic migrations, contracts, OpenAPI, API gateway, store và UI cùng nhau. Không tin role hoặc user ID do client gửi để cấp quyền.
- Có trạng thái active/disabled, cấp tài khoản, đổi mật khẩu, thu hồi phiên và xử lý hết hạn. Sau đổi mật khẩu hoặc khóa tài khoản, phiên cũ phải bị vô hiệu theo policy được triển khai và kiểm thử.
- Tạo tài khoản qua CLI quản trị hoặc màn hình quản trị có kiểm soát quyền. Dùng tài khoản quản trị ứng dụng để cấp tài khoản; quản trị ứng dụng không mặc nhiên có quyền xử lý hồ sơ học vụ. Nếu mở tự đăng ký, tài khoản chưa được xác minh không được tự nhận MSSV hoặc quyền cán bộ.
- Không có tài khoản/mật khẩu chung mặc định. Bootstrap quản trị nhận mật khẩu qua nhập ẩn hoặc cơ chế cấp bí mật; không đặt mật khẩu trong source, argv, log hay file báo cáo.
- Có giới hạn thử đăng nhập, lỗi đăng nhập không tiết lộ tài khoản tồn tại, và audit sự kiện xác thực không chứa secret.
- Dùng cơ chế phiên phù hợp cho web production, ưu tiên cookie HttpOnly, Secure trên HTTPS, SameSite phù hợp; triển khai bảo vệ CSRF cho mutation nếu dùng cookie, CORS theo origin thật, remember-me và logout server. Nếu giữ Bearer vì kiến trúc hiện tại, nêu lý do và xử lý lưu token/expiry/revocation an toàn; không chỉ đổi chỗ lưu token.
- Khôi phục mật khẩu chỉ báo thành công khi kênh thật hoạt động. Nếu chưa có SMTP/SSO, triển khai reset do quản trị cấp token một lần, có expiry và audit; không giả gửi email.
- Production phải tắt demo-login và UI tài khoản mẫu; bỏ ánh xạ email/MSSV sang SV-DEMO hoặc OF-DEMO. Không chuyển is_demo=false cho seed rồi gọi đó là tài khoản sinh viên thật.

## 4. Hồ sơ sinh viên và MSSV thật

- Tách internal user ID khỏi MSSV. MSSV lưu dạng chuỗi với uniqueness phù hợp phạm vi trường/cơ sở; liên kết chính xác tới tài khoản và hồ sơ.
- Hồ sơ chứa dữ liệu có nguồn: họ tên, MSSV, email, khoa/ngành, khóa/lớp và trạng thái sinh viên theo dữ liệu được cung cấp. Chỉ lấy field đã có nguồn, không suy ra từ mã tài khoản hoặc fixtures.
- Triển khai import CSV/XLSX hoặc connector hệ thống nhà trường. Import có schema, validation, dry-run, báo lỗi theo dòng, kiểm tra trùng và transaction; việc cập nhật bản ghi phải có policy rõ ràng.
- Ghi source/provenance, thời điểm import hoặc sync và trạng thái xác minh. Thông tin sinh viên tự khai phải được phân biệt với thông tin đã đối chiếu.
- Chỉ xác nhận sinh viên thật khi dữ liệu đến từ nguồn được nhà trường cho phép, hoặc cán bộ có quyền đã đối chiếu và ghi nhận. Tài khoản tự tạo với MSSV tự nhập chưa đủ điều kiện này.
- Không bịa danh sách sinh viên, tên, MSSV, điểm, học phí hoặc kết quả tra cứu. Chưa có nguồn thì hiển thị chưa có dữ liệu/chưa xác minh.
- Thêm API /me và profile trả đủ field được phép; kiểm soát quyền sửa dữ liệu định danh. Người dùng không được đổi MSSV để lấy hồ sơ người khác.

## 5. AI-agent và chatbot thật

- API và worker cùng cấu hình provider/model/RAG/DB. Bản chính thức yêu cầu AGENT_MODE=langgraph; thiếu cấu hình thì startup báo lỗi rõ ràng, không chạy StubAgent.
- Toàn bộ chat chính thức đi qua conversation/message API và CampusAgent; không dùng regex, câu trả lời cục bộ hoặc delay giả thay cho model.
- Giữ các graph intake L1/L2/L4 và officer brief L3; khảo sát và triển khai graph/port riêng cho review học phần khi cần. Không cast officer brief thành review findings.
- Key chỉ nằm ở backend/worker. Không đưa vào NEXT_PUBLIC_*, browser bundle, response, log hoặc artifact.
- Thực hiện lời gọi provider thật cho chat và brief; ghi model, prompt version, request ID, thời gian, trạng thái và usage khi provider cung cấp. Không ghi secret hoặc nội dung cá nhân không cần thiết.
- Timeout/rate limit/auth lỗi phải hiện đúng trạng thái. Không fallback sang Stub, không bịa câu trả lời/citation hoặc báo success. Tin người dùng đã lưu phải giữ nguyên; retry không tạo tin/ticket/job trùng.
- Retry hữu hạn với backoff cho lỗi tạm thời trong ngân sách thời gian; không retry vô hạn khi key sai hoặc quota không thể phục hồi. UI hiển thị lỗi dễ hiểu và có thể chuyển sang gửi yêu cầu cán bộ qua luồng thật.
- Tạo prompt có version, structured output validation, kiểm soát tool và quyền truy cập. Dữ liệu người dùng/tài liệu truy xuất không được ghi đè system instructions; agent không có quyền tùy ý truy cập hồ sơ khác hoặc ra quyết định hành chính.

## 6. RAG và nguồn quy chế chính thức

- Xây luồng ingest tài liệu PDF/DOCX/HTML hoặc định dạng thực tế được cung cấp; lưu document ID, version, nguồn, trang/mục, ngày hiệu lực, trạng thái phê duyệt và index version.
- Chỉ dùng tài liệu chính thức đã được cung cấp/phê duyệt cho runtime chính thức. Không mặc định tài liệu public bất kỳ hoặc edu14 demo là quy chế trường đang áp dụng.
- Citation truy được về đoạn/trang và phiên bản gốc; kiểm tra quyền xem tài liệu, hiệu lực và sự khớp giữa quote với nguồn.
- Nối retrieval vào chat và approved_sources cho worker/brief/review. Nếu không có nguồn phù hợp, agent phải nói chưa đủ căn cứ và hướng dẫn bước tiếp theo.
- Cập nhật tài liệu phải tạo version mới và xử lý artifact/index cũ theo policy. Không sửa âm thầm nguồn mà brief đang trích dẫn.
- Tách kho demo khỏi kho thật. Khi chưa có tài liệu chính thức, luồng chat tổng quát có thể gọi model nhưng không được trả lời khẳng định về quy chế trường như đã được xác minh.

## 7. Mọi chức năng sản phẩm phải nối thật

- Lập ma trận tất cả route, màn hình, nút và capability: chức năng, endpoint, bảng/storage, quyền, worker/agent, trạng thái triển khai và bằng chứng kiểm thử. Tìm mock, stub, demo, fixture, TODO, UnsupportedOperationError, delay/setTimeout giả và success cục bộ; rà soát ngữ cảnh thay vì xóa theo từ khóa.
- Triển khai xuyên hệ thống: chat/lịch sử, preview, form xin giấy, khiếu nại, submit, danh sách/detail, hàng chờ cán bộ, claim, AI brief, bổ sung hồ sơ, phản hồi, hoàn tất, checklist, nháp, audit, review học phần và report.
- Mở rộng contract cho đầy đủ field VinUniForm đang sử dụng. Hồ sơ phải lưu và tải lại đủ dữ liệu đã gửi, không cắt bỏ field vì P0 chỉ hỗ trợ ba trường.
- Tệp upload phải lưu server/object storage và download có quyền, owner, metadata, giới hạn dung lượng/loại tệp; dữ liệu đúng bytes sau reload hoặc đổi thiết bị. Không gửi blob URL làm file backend.
- Nháp/checklist/các trạng thái nghiệp vụ cần đồng bộ phải lưu backend với revision phù hợp; không dùng localStorage làm nguồn duy nhất. Local cache chỉ hỗ trợ trải nghiệm và không được bịa trạng thái server.
- Backend sở hữu workflow, quyền, confirmation, revision, idempotency và audit. UI chỉ báo thành công sau commit hoặc trạng thái job thật; 202 chưa phải hoàn tất.
- AI đề xuất, cán bộ có quyền phê duyệt. Claim/brief stale/multiple tabs và hai cán bộ thao tác đồng thời phải được xử lý đúng.
- Kết quả tra cứu học vụ/tài chính/OCR phải đến từ connector/công cụ thật; thiếu connector thì ghi chưa xác minh và cho cán bộ đối chiếu thủ công có audit. Không dùng snippet SQL/API trong fixtures làm bằng chứng.
- Phân biệt ticket hoàn tất, bản nháp giấy tờ, giấy được cấp và văn bản đã ký. Chỉ gọi giấy tờ là chính thức khi luồng phát hành/phê duyệt và quyền của đơn vị đã được thiết lập. Nếu chưa có chữ ký số/SSO/SIS/email, triển khai phần có thể chạy và ghi chính xác dependency còn thiếu.

## 8. Cấu hình, dữ liệu và vận hành

- Cấu hình frontend chính thức: NEXT_PUBLIC_DATA_MODE=api, NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH=false và API URL hợp lệ. Production không được bị localStorage hoặc thiếu config kéo về mock. NEXT_PUBLIC_* là cấu hình build: rebuild frontend khi cần, không chỉ restart rồi tuyên bố đã áp dụng.
- Backend production: APP_ENV=production, DEMO_AUTH_ENABLED=false, AGENT_MODE=langgraph, cấu hình RAG nguồn thật; nếu cần thêm rag_mode thì triển khai rõ ràng. Không đổi tên corpus demo để gọi là thật.
- Dùng PostgreSQL cho môi trường vận hành; migrations có quy trình backup/rollback. Không xóa DB hiện tại hoặc tự chuyển dữ liệu demo thành dữ liệu thật. Chuẩn bị dry-run và mapping trước khi chuyển dữ liệu.
- Sửa startup/compose để production không tự seed tài khoản hoặc hồ sơ demo. Seed fixture chỉ dùng ở test/dev có lựa chọn rõ ràng.
- API/worker chia sẻ cấu hình đúng, worker chỉ start sau migrations; job có lease, bounded retry, recovery và trạng thái thất bại thật.
- Health/readiness phân biệt process sống, DB sẵn sàng và cấu hình agent/RAG; không báo model khỏe chỉ vì DB khỏe. Smoke provider phải có chủ đích, không gọi model tốn quota mỗi healthcheck.
- Cung cấp .env.example, compose/run scripts, backup/restore hướng dẫn, logging có request ID và audit. Không commit key hoặc mật khẩu; không thay key hiện có nếu chưa cần.

## 9. Kiểm thử và bằng chứng hoàn thành

- Chạy baseline và các check phù hợp sau thay đổi: backend tests, Ruff, migration/contracts/OpenAPI check; frontend TypeScript, lint, production build và E2E. Đọc tài liệu Next.js cục bộ theo frontend/AGENTS.md trước khi sửa API framework.
- Có test xác thực: đúng/sai mật khẩu, account disabled, role enforcement, hết hạn/thu hồi phiên, reset/đổi mật khẩu, production từ chối demo-login, vượt giới hạn thử đăng nhập.
- Có test IDOR: sinh viên A không đọc/sửa chat, profile, ticket hoặc tệp của B; cán bộ không vượt phạm vi phân công; không tự nâng quyền qua client payload.
- Kiểm thử import trùng/sai MSSV và dữ liệu định danh; E2E dùng account kiểm thử được cấp qua luồng tài khoản thật, không hard-code SV-DEMO hoặc bỏ qua auth. Báo rõ đây là account kiểm thử, không phải sinh viên thật đã được xác minh.
- Chạy E2E: đăng nhập → profile → chat model thật → nguồn đúng khi có tài liệu → preview/form → submit → queue/claim → worker tạo brief → cán bộ phản hồi → sinh viên đọc; upload/download và review/supplement/finalize theo phạm vi sản phẩm.
- Kiểm thử provider timeout/429/key lỗi bằng fault injection; schema/citation lỗi; retry cùng idempotency key; job recovery; revision stale; race trên PostgreSQL. Không dùng mock provider rồi gọi đó là bằng chứng live.
- Reload/đổi trình duyệt/restart API-worker phải giữ dữ liệu backend. Sai mật khẩu tuyệt đối không được vào; mất backend không được trả success từ local mock.
- Regression tests có ý nghĩa; cập nhật assertions theo kiến trúc thật, không xóa test hoặc làm lỏng checks chỉ để pass.

## 10. Cách xử lý dependency bên ngoài và bàn giao

- Hỏi gộp những thông tin thực sự thiếu: nguồn danh sách sinh viên/tài khoản, tài liệu quy chế, SSO/SIS nếu có, người có quyền cấp tài khoản/phê duyệt, SMTP/storage, hạ tầng/domain. Không yêu cầu gửi mật khẩu/API key trong chat; hướng dẫn nhập qua secret/config.
- Khi chưa được cung cấp dữ liệu/quyền, hoàn thành schema, import/connector, UI/API, kiểm thử và tài liệu cho phần đó; nêu chính xác input còn thiếu. Không bịa dữ liệu hoặc tuyên bố đã xác minh, đã gửi email, đã tích hợp nhà trường khi chưa thực hiện.
- Tạo docs/production/implementation-report.md ghi: thay đổi theo chức năng, lệnh chạy thực tế, cấu hình đã xác minh không chứa secret, test và kết quả, live smoke, migrations, rollback và dependency còn thiếu.
- Bàn giao hướng dẫn cấp account, import sinh viên, ingest tài liệu, chạy API/worker/frontend và kiểm tra trạng thái; dùng command đúng của repo và môi trường đã kiểm chứng.
- Chỉ kết luận chức năng nào hoàn thành khi có bằng chứng tương ứng. Nếu còn dependency ngoài repo, phân biệt rõ phần code đã hoàn thành và phần chưa thể vận hành chính thức. Đừng gọi toàn bộ hệ thống là production-ready chỉ vì UI đẹp hoặc Gemini trả lời được.

Bắt đầu bằng khảo sát nhanh và ma trận hiện trạng, sau đó thực hiện ngay. Mục tiêu là hệ thống dùng thật từ tài khoản, hồ sơ, chatbot, AI-agent đến các workflow; mọi trạng thái trên UI phải phản ánh kết quả thật từ backend và nguồn dữ liệu có thể đối chiếu.
