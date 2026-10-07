# Kế hoạch Phân công Nhiệm vụ Chuẩn bị Gate 1
**Dự án**: Campus 24/7 – Trợ lý AI Vận hành Học vụ 24/7 (Đề tài EDU-14)  
**Mục tiêu**: Chuẩn bị đầy đủ hồ sơ nộp Gate 1 theo đúng quy chuẩn chất lượng, minh bạch và chuyên nghiệp.

---

## 1. Cơ cấu Phân chia Trách nhiệm Nhóm

Để chuẩn bị tốt nhất cho dự án, các thành viên đảm nhận các mảng công việc chuyên trách độc lập nhưng phối hợp chặt chẽ:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      CAMPUS 24/7 - TEAM EDU-14                         │
├───────────────────┬────────────────────┬───────────────────────────────┤
│ Dương Xuân Vinh   │ Hoàng Quốc Dũng    │ Đặng Quang Huy                │
│ (02622)           │ (02523)            │ (02962)                       │
│ UI/UX & Specs     │ AI & RAG Logic     │ PRD & Quản lý Sản phẩm        │
├───────────────────┴────────────────────┴───────────────────────────────┤
│ Lê Trung Kiên (02748)                                                  │
│ Quản trị Repo, Brief 1 trang & Hồ sơ Nộp Gate 1                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi tiết Nhiệm vụ & Deliverables Từng Thành viên

### 👤 Dương Xuân Vinh (02622 | Discord: `dv1600`)
* **Lĩnh vực phụ trách**: Thiết kế Trải nghiệm Người dùng (UI/UX) và Đặc tả Kỹ thuật Hệ thống/Dữ liệu.
* **Nhiệm vụ cụ thể**:
  1. **Thiết kế Wireframe & UI Flow**:
     - Xây dựng bản vẽ giao diện trực quan trên Figma cho 2 vai trò:
       - **Sinh viên**: Khung chat hỏi đáp quy chế, trích dẫn nguồn (citation), hộp thoại xác nhận (confirmation modal) khi tạo ticket/đặt phòng, thông báo chuyển cán bộ.
       - **Cán bộ hỗ trợ**: Bảng điều khiển (dashboard) tiếp nhận ticket, xem ngữ cảnh hội thoại, nút xử lý và phản hồi sinh viên.
     - Xuất các hình ảnh giao diện (`.png`) đưa vào thư mục `docs/gate-1/assets/`.
  2. **Biên soạn tài liệu UI Flow**:
     - Viết file `docs/gate-1/03-ui-flow.md` giải thích chi tiết các bước tương tác, hành vi giao diện khi gọi tool và luồng chuyển giao (handover).
  3. **Đặc tả Kỹ thuật Dữ liệu & API Contracts**:
     - Thiết kế Schema thực thể: Bảng `Ticket`, `StudentContext`, `Session`, `OfficerLog`.
     - Phác thảo API Mock Contracts (RESTful endpoints: `/api/v1/chat`, `/api/v1/tickets`, `/api/v1/handover`) để đóng góp vào PRD.
* **Tài liệu tham khảo chính**:
  - `docs/reference/EDU-14-Gate-1-Plan.md` (Mục 3: Wireframe và UI flow)
  - `docs/reference/EDU-14-Campus-24-7.md` (Chi tiết các màn hình, trạng thái ticket & mockup API)
* **Kết quả bàn giao (Deliverables)**:
  - File `docs/gate-1/03-ui-flow.md`
  - Link Figma (chế độ Public view) + Thư mục ảnh `docs/gate-1/assets/`
  - Phần Data Schema & API Contracts đóng góp vào PRD.

---

### 👤 Hoàng Quốc Dũng (02523 | Discord: `adventurous_flamingo_43907`)
* **Lĩnh vực phụ trách**: Kiến trúc Mô hình, Luồng Xử lý Dữ liệu Tri thức (RAG), Cơ chế Ra quyết định (Agentic Decision) và Quản trị AI Log.
* **Nhiệm vụ cụ thể**:
  1. **Thiết kế Kiến trúc RAG (Retrieval-Augmented Generation)**:
     - Định nghĩa quy trình xử lý văn bản quy chế: Tiêu chuẩn chunking văn bản, embedding, metadata indexing.
     - Quy tắc trích dẫn nguồn bắt buộc (Citation Schema) nhằm loại bỏ triệt để ảo giác (Anti-hallucination).
  2. **Thiết kế Logic Agentic & Cơ chế Bảo vệ (Safety Guardrails)**:
     - Quy định điều kiện kích hoạt các tool: Khi nào chỉ tra cứu thông tin (Read-only), khi nào cần xác nhận để thực hiện tác vụ (Mutation), khi nào bắt buộc kích hoạt Handover (chuyển người).
     - Thiết lập ma trận rủi ro và bộ lọc câu hỏi nhạy cảm (điểm số, khiếu nại, khủng hoảng tâm lý).
  3. **Xây dựng Tiêu chí Đánh giá AI (AI Evaluation Metrics)**:
     - Định lượng các chỉ số: Tỷ lệ trích dẫn đúng nguồn ($\ge 70\%$), độ chính xác gọi tool ($\ge 90\%$), độ nhạy phát hiện ca rủi ro ($100\%$).
  4. **Thiết lập và Quản trị Hệ thống AI Log**:
     - Hoàn thiện tài liệu `ai-logs/README.md` và `ai-logs/template.md`.
     - Thực hiện 1–2 bản ghi nhật ký sử dụng AI thực tế trong quá trình chuẩn bị hồ sơ Gate 1.
* **Tài liệu tham khảo chính**:
  - `docs/reference/EDU-14-Gate-1-Plan.md` (Mục 2 phần AI logic & Mục 5 AI Log setup)
  - `docs/reference/EDU-14-Campus-24-7.md` (Luồng RAG và Handover)
  - `docs/reference/EDU-14-KHAC-BIET-KY-TRUOC.md` (Nguyên lý Agentic vs Chatbot)
* **Kết quả bàn giao (Deliverables)**:
  - Chương Kiến trúc AI, Guardrails và AI Metrics đóng góp vào PRD.
  - Thư mục `ai-logs/` hoàn chỉnh với template và mẫu nhật ký thực tế.

---

### 👤 Đặng Quang Huy (02962 | Discord: `danghuy1910`)
* **Lĩnh vực phụ trách**: Định hướng Sản phẩm, Đặc tả Yêu cầu Nghiệp vụ (PRD), Luồng phối hợp Người - Máy (Human-in-the-loop) và Hợp nhất Tài liệu.
* **Nhiệm vụ cụ thể**:
  1. **Xây dựng Yêu cầu Sản phẩm Cốt lõi**:
     - Định hình chân dung người dùng (User Personas: Sinh viên chính quy, Cán bộ phụ trách một cửa).
     - Soạn thảo danh mục User Stories chi tiết kèm Tiêu chí Nghiệm thu (Acceptance Criteria) cho từng luồng.
  2. **Thiết kế Luồng Tương tác Hợp nhất (State Flow)**:
     - Làm rõ luồng trạng thái từ lúc Sinh viên chat $\rightarrow$ Agent nhận diện intent $\rightarrow$ Yêu cầu Sinh viên bấm Xác nhận $\rightarrow$ Gọi API lưu cơ sở dữ liệu $\rightarrow$ Báo Cán bộ tiếp nhận.
  3. **Tổng hợp & Hoàn thiện PRD (`02-prd.md`)**:
     - Tiếp nhận đóng góp về AI Logic từ Hoàng Quốc Dũng và Data/API Specs từ Dương Xuân Vinh.
     - Hợp nhất, chuẩn hóa thuật ngữ, rà soát tính logic và hoàn thiện văn bản `docs/gate-1/02-prd.md`.
* **Tài liệu tham khảo chính**:
  - `docs/reference/EDU-14-Gate-1-Plan.md` (Mục 2: Cấu trúc PRD chuẩn)
  - `docs/reference/EDU-14-Campus-24-7.md` (Đặc tả nghiệp vụ tổng quát)
  - `docs/reference/MO-TA-SAN-PHAM-EDU-14.md` (Mô tả bài toán và giải pháp)
* **Kết quả bàn giao (Deliverables)**:
  - Tài liệu `docs/gate-1/02-prd.md` hoàn chỉnh, mạch lạc và sẵn sàng nghiệm thu.

---

### 👤 Lê Trung Kiên (02748 | Discord: `kien5258`)
* **Lĩnh vực phụ trách**: Quản trị Cấu trúc Kho lưu trữ (Repository Architecture), Bản tóm tắt Dự án (Brief 1 trang), Tổng hợp Hồ sơ và Điều phối Nộp Gate 1.
* **Nhiệm vụ cụ thể**:
  1. **Quản trị Repository & Hệ sinh thái Kỹ thuật**:
     - Thiết lập cấu trúc repo nhóm chuẩn mực, cấu hình `.gitignore`, kiểm soát bảo mật tuyệt đối (không lộ `.env`, bí mật API).
     - Khởi tạo bảng công việc (GitHub Projects / Issues) để phân công và theo dõi tiến độ các thành viên.
  2. **Biên soạn Bản tóm tắt Dự án (Brief 1 trang)**:
     - Soạn thảo `docs/gate-1/01-brief.md` súc tích trong đúng một trang A4: Định vị tên đề tài, thông điệp cốt lõi (pitch), bài toán, giải pháp, phạm vi MVP/Non-MVP và chỉ số mục tiêu.
  3. **Tổng hợp Hồ sơ & Điều phối Nghiệm thu Gate 1**:
     - Xây dựng bảng điều hướng danh mục hồ sơ tại `docs/gate-1/README.md`.
     - Chủ trì việc kiểm tra checklist trước khi nộp (kiểm tra quyền truy cập link ẩn danh của Figma/Repo, định dạng tài liệu, tính sẵn sàng).
     - Đại diện nhóm thực hiện thao tác nộp bài `/gate submit` đúng thời hạn.
* **Tài liệu tham khảo chính**:
  - `docs/reference/EDU-14-Gate-1-Plan.md` (Mục 1 Brief, Mục 4 Repo setup, Mục 6 Folder nộp, Mục 8 Checklist)
  - `docs/reference/MO-TA-SAN-PHAM-EDU-14.md` (Các luận điểm cốt lõi để đưa vào Brief)
* **Kết quả bàn giao (Deliverables)**:
  - Cấu trúc Repository chuẩn mực kèm Issues/Board quản lý công việc.
  - File `docs/gate-1/01-brief.md`.
  - File `docs/gate-1/README.md` (Bảng điều hướng tổng hợp).
  - Biên bản kiểm tra checklist Gate 1 trước giờ nộp.

---

## 3. Bảng Theo dõi Tiến độ & Bàn giao Sản phẩm

| Hạng mục | Tài liệu đầu ra | Người phụ trách chính | Trạng thái |
| :--- | :--- | :--- | :---: |
| **01. Brief Đề tài** | `docs/gate-1/01-brief.md` | Lê Trung Kiên | Đang soạn thảo |
| **02. Đặc tả Sản phẩm (PRD)** | `docs/gate-1/02-prd.md` | Đặng Quang Huy *(phối hợp Vinh & Dũng)* | Chờ chủ trì rà soát |
| **03. Wireframe & UI Flow** | `docs/gate-1/03-ui-flow.md` + Figma | Dương Xuân Vinh | Sẵn sàng bàn giao |
| **04. Kiến trúc AI & RAG** | Đóng góp vào `02-prd.md` | Hoàng Quốc Dũng | Đang thực hiện |
| **05. Hệ thống AI Log** | `ai-logs/README.md` & `template.md` | Hoàng Quốc Dũng *(hỗ trợ bởi Kiên)* | Đã dựng khung |
| **06. Quản trị Kho lưu trữ** | Git Repo, `.gitignore`, Issues | Lê Trung Kiên | Hoàn thành |
| **07. Điều phối & Nộp bài** | `docs/gate-1/README.md` & Checklist | Lê Trung Kiên | Sẵn sàng |

---

## 4. Nguyên tắc Làm việc & Phối hợp Nhóm

1. **Minh bạch mã nguồn & tài liệu**: Mọi thay đổi tài liệu đều thực hiện qua commit rõ ràng trên branch riêng trước khi merge vào `main`.
2. **Bảo mật thông tin**: Tuyệt đối không commit file cấu hình chứa khóa bí mật (`.env`, private keys).
3. **Tính nhất quán**: Thuật ngữ trong Brief, PRD, Wireframe và UI Flow phải đồng nhất (Campus 24/7, Student Portal, Staff Dashboard, Ticket, Handover/HITL).
4. **Kiểm thử liên kết**: Trước khi nộp, mọi link Figma, link ảnh hay link thư mục phải được mở kiểm tra thử bằng trình duyệt ở chế độ ẩn danh (Incognito).

