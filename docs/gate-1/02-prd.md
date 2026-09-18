# Tài liệu Yêu cầu Sản phẩm (PRD) – Campus 24/7

> **Dự án**: Campus 24/7 – Trợ lý AI Vận hành Học vụ 24/7  
> **Chủ trì hoàn thiện**: Đặng Quang Huy  
> **Đóng góp kỹ thuật**: Dương Xuân Vinh (Data & API Specs), Hoàng Quốc Dũng (AI & RAG Architecture)

---

## 1. Tổng quan Sản phẩm & Mục tiêu
Campus 24/7 là hệ thống trợ lý học vụ AI đa tác tử tích hợp cơ chế Human-in-the-loop (HITL), hỗ trợ giải đáp quy chế đào tạo, tự động hóa quy trình tiếp nhận dịch vụ một cửa và chuyển giao cán bộ cho các tình huống nhạy cảm.

---

## 2. Đối tượng Người dùng & Chân dung (User Personas)
### 2.1. Sinh viên (Primary Persona)
- **Hành vi**: Cần tra cứu nhanh ngoài giờ hành chính, muốn nhận câu trả lời chắc chắn không bị phạt quy chế, muốn đặt lịch/phòng tiện lợi.
- **Nỗi đau (Pain Points)**: Tìm quy chế khó khăn, gọi hotline ngoài giờ không ai bắt máy, không biết thủ tục khiếu nại điểm đi về đâu.

### 2.2. Cán bộ Một cửa Học vụ (Secondary Persona)
- **Hành vi**: Tiếp nhận hàng trăm câu hỏi giống nhau mỗi kỳ tuyển sinh/thi cử, tốn thời gian xử lý thủ công.
- **Nỗi đau**: Bị quá tải bởi câu hỏi lặp lại, thiếu công cụ gom nhóm và phân loại ticket khẩn cấp.

---

## 3. Danh mục Tính năng & Tiêu chí Nghiệm thu (User Stories & Acceptance Criteria)

### US-01: Tra cứu quy chế có nguồn trích dẫn
- **Mô tả**: Là sinh viên, tôi muốn hỏi về quy định thôi học, học bổng, điểm rèn luyện và nhận được câu trả lời kèm tên văn bản, số điều.
- **Acceptance Criteria**:
  - [ ] Trả về nội dung giải đáp ngắn gọn, dễ hiểu.
  - [ ] Đi kèm thẻ Citation: Tên quy chế, số điều, link hoặc số trang PDF tham chiếu.
  - [ ] Nếu không tìm thấy thông tin trong tài liệu: Hệ thống thông báo rõ không có dữ liệu và đề xuất tạo ticket hỗ trợ.

### US-02: Thực hiện yêu cầu có xác nhận người dùng
- **Mô tả**: Là sinh viên, tôi muốn đặt phòng tự học hoặc xin cấp giấy xác nhận trực tiếp qua chat.
- **Acceptance Criteria**:
  - [ ] Agent trích xuất các thông tin cần thiết: Họ tên, MSSV, loại giấy tờ/thời gian đặt phòng.
  - [ ] Agent hiển thị hộp thoại Tóm tắt & Xác nhận (Confirmation Modal).
  - [ ] Chỉ khi sinh viên ấn nút "Xác nhận", hệ thống mới gọi API tạo ticket hoặc đặt chỗ.

### US-03: Chuyển giao cán bộ xử lý (Human-in-the-loop)
- **Mô tả**: Khi gặp tình huống nhạy cảm (khiếu nại điểm, stress thi cử, quy chế mập mờ), hệ thống tự động chuyển giao cán bộ.
- **Acceptance Criteria**:
  - [ ] Agent nhận diện tín hiệu cảm xúc/từ khóa nhạy cảm.
  - [ ] Hiển thị thông báo minh bạch: "Trường hợp này cần cán bộ chuyên trách hỗ trợ, tôi đã tạo ticket chuyển phòng Đào tạo".
  - [ ] Cán bộ nhìn thấy ticket kèm tóm tắt cuộc trò chuyện trên Dashboard.

---

## 4. Kiến trúc Dữ liệu & Hợp đồng API (Data & API Specs)
*(Được đóng góp bởi Dương Xuân Vinh)*

### 4.1. Quy ước chung
- Đây là **mock contract cho Gate 1**, chỉ dùng dữ liệu giả lập; chưa kết nối cơ sở dữ liệu hoặc hệ thống học vụ thật.
- Các trạng thái ticket chuẩn: `open` → `pending_officer` → `resolved`.
- `category`: `lookup` (tra cứu), `action` (yêu cầu dịch vụ), `complaint` (khiếu nại).
- `priority`: `low` | `normal` | `high`.
- Thời gian dùng ISO 8601; các mã `SV001`, `TKT-2026-0142` chỉ là mã minh họa.
- Các API ghi dữ liệu nhận `X-Request-Id` để tránh tạo ticket trùng khi client gửi lại request.

### 4.2. Entity Schema

#### `Ticket`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Mã ticket, ví dụ `TKT-2026-0142` |
| `student_id` | string | Mã sinh viên minh họa, ví dụ `SV001` |
| `session_id` | string | Phiên chat tạo ra ticket |
| `category` | enum | `lookup` \| `action` \| `complaint` |
| `status` | enum | `open` \| `pending_officer` \| `resolved` |
| `priority` | enum | `low` \| `normal` \| `high` |
| `summary` | string | Tóm tắt ngắn nội dung cần xử lý |
| `handover_reason` | string? | Lý do cần cán bộ tiếp nhận |
| `assigned_officer_id` | string? | Cán bộ được phân công |
| `created_at` / `updated_at` | datetime | Thời điểm tạo và cập nhật |

#### `StudentContext`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `student_id` | string | ID nội bộ minh họa |
| `mssv` | string | MSSV giả lập, không dùng MSSV thật |
| `full_name` | string | Tên hiển thị giả lập |
| `email` | string | Email giả lập |
| `cohort` | string | Khóa học |
| `faculty` | string | Khoa/chương trình |
| `is_demo` | boolean | Luôn `true` trong dữ liệu Gate 1 |

#### `Session`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | ID phiên chat |
| `student_id` | string | Sinh viên sở hữu phiên |
| `channel` | enum | `student_portal` |
| `status` | enum | `active` \| `handover` \| `closed` |
| `started_at` / `last_activity_at` | datetime | Thời điểm bắt đầu và hoạt động gần nhất |
| `handover_ticket_id` | string? | Ticket liên quan sau khi chuyển cán bộ |

#### `OfficerLog`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | ID bản ghi audit |
| `ticket_id` | string | Ticket được tác động |
| `officer_id` | string | Cán bộ giả lập thực hiện thao tác |
| `action` | enum | `assign` \| `reply` \| `status_change` \| `resolve` |
| `from_status` / `to_status` | enum? | Trạng thái trước/sau thao tác |
| `note` | string? | Ghi chú hoặc nội dung phản hồi |
| `created_at` | datetime | Thời điểm ghi audit |

### 4.3. API Mock Contracts

#### `POST /api/v1/chat`

Nhận câu hỏi của sinh viên và trả về câu trả lời dựa trên nguồn hoặc đề xuất bước tiếp theo.

```json
{
  "session_id": "SES-2026-0007",
  "student_id": "SV001",
  "message": "Em có thể đặt phòng học sau 18:00 không?"
}
```

```json
{
  "session_id": "SES-2026-0007",
  "answer": "Có thể đặt phòng học đến 22:00, tùy tình trạng chỗ trống.",
  "intent": "lookup",
  "citations": [{"title": "Sổ tay sinh viên 2026", "page": 12}],
  "suggested_action": "check_room_availability",
  "requires_confirmation": false,
  "requires_handover": false
}
```

#### `POST /api/v1/tickets`

Tạo ticket sau khi sinh viên đã xem và bấm xác nhận trong Confirmation Modal. Client không được gọi endpoint này nếu `confirmed` chưa là `true`.

```json
{
  "session_id": "SES-2026-0007",
  "student_id": "SV001",
  "category": "action",
  "summary": "Đặt phòng học sau 18:00",
  "priority": "high",
  "confirmed": true
}
```

```json
{
  "ticket": {
    "id": "TKT-2026-0142",
    "status": "open",
    "priority": "high",
    "created_at": "2026-09-18T10:43:00+07:00"
  }
}
```

#### `POST /api/v1/handover`

Chuyển một phiên chat sang hàng đợi cán bộ trong tình huống nhạy cảm hoặc khi AI không đủ cơ sở trả lời.

```json
{
  "session_id": "SES-2026-0007",
  "student_id": "SV001",
  "reason": "Cần cán bộ xác nhận quyền đặt phòng",
  "priority": "high",
  "confirmed": true
}
```

```json
{
  "ticket_id": "TKT-2026-0142",
  "status": "pending_officer",
  "message": "Yêu cầu đã được chuyển tới cán bộ hỗ trợ."
}
```

#### `GET /api/v1/officer/tickets`

Trả về danh sách ticket cho Staff Dashboard.

Query hỗ trợ: `status`, `priority`, `category`, `search`, `page`, `page_size`.

```json
{
  "items": [
    {
      "id": "TKT-2026-0142",
      "student_id": "SV001",
      "summary": "Đặt phòng học sau 18:00",
      "category": "action",
      "priority": "high",
      "status": "pending_officer"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

### 4.4. Lỗi và chuyển trạng thái

| HTTP | Mã lỗi | Khi nào xảy ra |
|---:|---|---|
| 400 | `INVALID_REQUEST` | Thiếu trường hoặc sai kiểu dữ liệu |
| 404 | `SESSION_NOT_FOUND` / `TICKET_NOT_FOUND` | Không tìm thấy phiên hoặc ticket |
| 409 | `DUPLICATE_REQUEST` | `X-Request-Id` đã được xử lý |
| 409 | `INVALID_STATUS_TRANSITION` | Chuyển trạng thái không hợp lệ |
| 422 | `CONFIRMATION_REQUIRED` | Gọi API ghi dữ liệu khi chưa xác nhận |

Luồng tối thiểu: tạo ticket ở `open`; gọi `/handover` chuyển sang `pending_officer`; cán bộ phản hồi hoặc hoàn tất xử lý thì chuyển sang `resolved`.

---

## 5. Kiến trúc AI, Luồng RAG & Guardrails
*(Được đóng góp bởi Hoàng Quốc Dũng)*

### 5.1. Luồng RAG & Chống ảo giác
- **Indexing**: Văn bản quy chế được chuẩn hóa định dạng Markdown/Text, phân đoạn (chunking 500 tokens, overlap 50 tokens), gán metadata văn bản.
- **Grounding Rule**: LLM chỉ được tổng hợp câu trả lời dựa trên context đã retrieve, cấm tự suy diễn quy chế không có trong dữ liệu.

### 5.2. Agent Decision & Safety Guardrails
- **Read vs Write Barrier**: Tra cứu quy chế là thao tác Read-only; tạo ticket/đặt phòng là Write operation bắt buộc qua cổng xác nhận người dùng.
- **Safety Gate**: Phát hiện các yêu cầu can thiệp trái phép (sửa điểm, xóa môn) $\rightarrow$ Từ chối và ghi log cảnh báo.

---

## 6. Tiêu chí Đánh giá & Chỉ số Thành công (Evaluation Metrics)
| Metric | Mục tiêu | Phương pháp đo lường |
|:---|:---:|:---|
| **Citation Precision** | $\ge 70\%$ | Kiểm thử trên bộ 50 câu hỏi quy chế chuẩn |
| **Tool Execution Precision** | $\ge 90\%$ | Đo lường tỷ lệ tạo đúng tham số qua API mock |
| **Sensitive Case Handover** | $100\%$ | Kiểm thử trên bộ 15 kịch bản nhạy cảm / khiếu nại |

