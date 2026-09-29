# Quy ước kỹ thuật P0 và phân công triển khai song song

**Dự án:** Campus 24/7 — EDU-14 / P-120

**Phạm vi:** Prototype-ver2: RAG tra cứu L1, yêu cầu giấy L2, cán bộ xử lý L3 và handover L4.

**Ngày soạn:** 29/09/2026

**Trạng thái:** Đã chốt contract giao tiếp v1 theo yêu cầu chủ dự án. Cả nhóm triển khai theo contract này. Contract đã có schema/fixture kiểm tra được; API nghiệp vụ, database, worker và AI vẫn cần được hiện thực hóa.

**Phiên bản:** `P0-contract-v1`. Mục 13–19 đặc tả chi tiết và làm rõ các ví dụ rút gọn ở phía trên. Các lựa chọn kỹ thuật P0 đã chốt ở mục 19; thay đổi sau đó phải qua PR cập nhật contract.

Tài liệu này là baseline triển khai P0; PRD Gate 1, tài liệu demo và sơ đồ template là tài liệu tham khảo lịch sử khi có khác biệt. Schema chuẩn nằm tại [contracts_v1.py](../src/models/contracts_v1.py), interface async tại [ports_v1.py](../src/models/ports_v1.py), HTTP contract tại [OpenAPI v1](contracts/p0-v1.openapi.json), fixture tại [examples v1](contracts/p0-v1.examples.json). Khi ví dụ rút gọn khác schema đầy đủ, dùng schema đầy đủ. Endpoint trong OpenAPI contract chưa được mount vào ứng dụng backend hiện tại.

## 1. Phạm vi và trách nhiệm

| Người | Sở hữu | Đầu ra bàn giao |
|---|---|---|
| **1 — RAG** | Kho tài liệu, ingestion, retrieval, trả lời có nguồn | Module RAG và bộ đánh giá |
| **2 — AI Agent** | Safety/intent routing, intake L2, chuẩn bị hồ sơ L3, nhận diện L4 | LangGraph và schema đầu ra AI |
| **3 — Backend** | Database, API, quyền, transaction, trạng thái, audit | API nghiệp vụ và adapter gọi RAG/agent |
| **4 — Frontend + DevOps** | Nối giao diện, kiểm thử E2E, CI/CD và môi trường demo | Luồng hai vai trò chạy xuyên suốt và quy trình deploy có thể lặp lại |

**Backend sở hữu dữ liệu nghiệp vụ.** RAG và agent trả kết quả có cấu trúc; backend kiểm tra và quyết định cách lưu, phát hành hoặc thực thi.

P0 chưa triển khai đặt phòng, ký số/phát hành giấy chính thức, tích hợp CSDL trường thật hoặc nhiều agent tự trao đổi tự do.

Mỗi người tự kiểm thử phần mình sở hữu. Người 4 phụ trách kiểm thử tích hợp; lỗi thuộc phần nào thì người sở hữu phần đó sửa.

## 2. Quy tắc nghiệp vụ bắt buộc

| Tình huống | Hành vi thống nhất |
|---|---|
| Sinh viên chỉ hỏi quy chế/thủ tục | L1, trả lời có nguồn; không tự tạo ticket |
| Sinh viên muốn nộp yêu cầu giấy | L2, thu thập thông tin → preview → chờ Submit 1 |
| Preview thay đổi | Xác nhận cũ hết hiệu lực; sinh viên phải review lại |
| Sinh viên xác nhận Submit 1 | Backend tạo ticket `open` |
| Cán bộ gửi phản hồi/yêu cầu bổ sung | Ticket chuyển hoặc giữ `pending_officer` |
| Cán bộ xác nhận hoàn tất | Ticket chuyển `resolved` |
| AI đề xuất hoàn tất | Chỉ là đề xuất; không tự đổi trạng thái |
| Phát hiện ca L4 bắt buộc bàn giao | Backend khóa AI trả lời, tạo/nâng ticket thành `pending_officer`, ưu tiên `high` |
| Ghi dữ liệu thất bại | Không hiển thị thành công hoặc mã ticket giả |
| Conversation đã handover | Tin mới chuyển cho cán bộ, không chạy lại trả lời L1/L2 |

L4 không đi qua form Submit 1 xin giấy. AI vẫn có thể chuẩn bị hồ sơ **nội bộ cho cán bộ**, nhưng không gửi draft đó cho sinh viên.

Nếu tin nhắn vừa xin giấy vừa chứa khiếu nại/ca nhạy cảm, **L4 được ưu tiên**. Câu “thủ tục khiếu nại ở đâu?” chỉ là tra cứu L1 nếu chưa có yêu cầu xử lý một ca cụ thể.

## 3. Quy ước dữ liệu dùng chung

- API và Python dùng `snake_case`.
- Frontend có thể dùng `camelCase` nội bộ, nhưng chuyển đổi tại API adapter.
- ID là chuỗi do backend sinh; frontend không tự sinh ID nghiệp vụ.
- Thời gian dùng ISO 8601, lưu UTC; frontend hiển thị giờ Việt Nam.
- Trường tùy chọn trả `null` khi không có giá trị.
- Danh sách trả mảng rỗng `[]` khi không có dữ liệu.
- Dữ liệu demo phải được nhận diện là giả lập.

### 3.1. Enum dùng chung

| Trường | Giá trị P0 |
|---|---|
| `role` | `student`, `officer` |
| `route` | `L1`, `L2`, `L4` |
| `ticket.status` | `open`, `pending_officer`, `resolved` |
| `ticket.category` | `action`, `complaint` |
| `ticket.service_type` | `student_certificate`, `academic_complaint`, `student_support` |
| `ticket.priority` | `normal`, `high` |
| `conversation.status` | `active`, `handover`, `closed` |
| `handover_status` | `none`, `pending`, `failed`, `completed` |
| `fact.verification_status` | `unverified`, `verified`, `disputed` |
| `brief.status` | `pending`, `processing`, `ready`, `failed`, `stale` |
| `receive_method` | `digital_pdf`, `paper_stamped` |

`route` mô tả cách xử lý tin nhắn; `category` mô tả ticket. L3 là luồng xử lý cán bộ, không phải một giá trị của `route`.

Frontend hiện có `certificate/transcript/complaint`; khi nối API cần ánh xạ sang schema chung. Bảng điểm chưa nằm trong luồng P0 cần nghiệm thu.

### 3.2. Ticket

Ví dụ dữ liệu ticket đã lưu:

```json
{
  "id": "tkt_001",
  "code": "TKT-0001",
  "conversation_id": "conv_001",
  "student_id": "SV001",
  "category": "action",
  "service_type": "student_certificate",
  "status": "open",
  "priority": "normal",
  "priority_reasons": [],
  "summary": "Xin giấy xác nhận sinh viên để vay vốn",
  "request_data": {
    "purpose": "Vay vốn ngân hàng",
    "destination_org": "Ngân hàng Chính sách Xã hội",
    "receive_method": "paper_stamped"
  },
  "handover_reason": null,
  "assigned_officer_id": null,
  "revision": 1,
  "created_at": "2026-09-29T03:00:00Z",
  "updated_at": "2026-09-29T03:00:00Z"
}
```

Danh tính sinh viên lấy từ session backend. Client không được gửi `student_id` để quyết định chủ sở hữu ticket.

## 4. Interface người 1 bàn giao cho người 2

Người làm RAG cung cấp hai năng lực:

```python
async def retrieve_policy(
    request: RetrievalRequest,
) -> RetrievalResult:
    ...


async def answer_question(
    request: RagRequest,
) -> RagResult:
    ...
```

- `retrieve_policy`: trả đoạn nguồn để agent sử dụng trong hồ sơ cán bộ.
- `answer_question`: trả câu trả lời L1 cùng citation.

Đầu vào `RagRequest`:

```json
{
  "question": "Xin giấy xác nhận sinh viên cần những gì?",
  "history": [],
  "policy_scope": "demo_academic"
}
```

`history` là ngữ cảnh hội thoại cần thiết đã được backend chọn lọc. `policy_scope` do hệ thống xác định, không lấy tùy ý từ model hoặc người dùng.

Đầu ra `RagResult`:

```json
{
  "status": "answered",
  "answer": "Bạn cần kiểm tra thông tin và xác nhận yêu cầu...",
  "citations": [
    {
      "document_id": "policy_001",
      "document_title": "Quy trình cấp giấy xác nhận — dữ liệu demo",
      "document_version": "1",
      "chunk_id": "chunk_012",
      "locator": "Mục 2",
      "quote": "Sinh viên kiểm tra thông tin trước khi gửi yêu cầu.",
      "url": null
    }
  ]
}
```

`status` gồm:

- `answered`: đủ nguồn để trả lời.
- `needs_clarification`: cần hỏi rõ thêm.
- `insufficient_evidence`: chưa đủ căn cứ.

Timeout/lỗi provider là **lỗi kỹ thuật**, không giả thành `insufficient_evidence`.

RAG không tạo ticket, không đổi trạng thái và không gửi thông báo handover. Câu trả lời về quy chế phải có citation hỗ trợ; điểm similarity không được hiển thị như “độ chính xác 98%”.

## 5. Interface người 2 bàn giao cho người 3

Người làm agent cung cấp hai entry point:

```python
async def run_intake(
    context: IntakeContext,
) -> IntakeResult:
    ...


async def prepare_officer_brief(
    snapshot: TicketSnapshot,
) -> OfficerBrief:
    ...
```

### 5.1. `run_intake`: xử lý tin nhắn sinh viên

Backend truyền:

- Conversation và lịch sử cần thiết.
- Hồ sơ sinh viên đã xác thực.
- Nội dung tin mới.
- Preview hiện tại nếu có.
- Các nguồn/tool được phép truy cập.

Backend kiểm tra quyền và trạng thái khóa **trước khi gọi agent**.

Agent trả kết quả theo một trong các nhánh:

| `route` | `outcome` | Dữ liệu |
|---|---|---|
| `L1` | `answered` | `reply`, `citations` |
| `L1` | `needs_clarification` | Câu hỏi làm rõ |
| `L1` | `insufficient_evidence` | Thông báo thiếu căn cứ |
| `L2` | `collecting` | Câu hỏi tiếp theo, field đã biết, field còn thiếu |
| `L2` | `preview_ready` | Dữ liệu đề xuất tạo preview |
| `L4` | `handover_required` | `risk_type`, lý do, summary và ngữ cảnh |

Với L2, backend validate và lưu preview rồi mới cấp `preview_id`/`version`.

Với L4, agent không được trả lời “đã bàn giao thành công”. Backend chỉ tạo thông báo này sau khi lưu thành công.

### 5.2. `prepare_officer_brief`: chuẩn bị hồ sơ cán bộ

Đầu vào là snapshot ticket có `revision`, message được phép xem, intake/handover context và profile liên quan.

Đầu ra:

```json
{
  "ticket_id": "tkt_001",
  "source_ticket_revision": 1,
  "summary": "Sinh viên cần giấy xác nhận để vay vốn.",
  "facts": [
    {
      "key": "purpose",
      "value": "Vay vốn ngân hàng",
      "source_type": "student_message",
      "source_id": "msg_001",
      "verification_status": "unverified"
    }
  ],
  "missing_items": [],
  "checklist": [
    {
      "id": "check_001",
      "label": "Kiểm tra tình trạng học tập",
      "checked": false
    }
  ],
  "suggested_priority": "normal",
  "priority_reasons": [],
  "draft_reply": "Phòng học vụ đã tiếp nhận yêu cầu của bạn...",
  "citations": [],
  "warnings": [],
  "quality_status": "pass"
}
```

Quy tắc:

- Agent không tự đánh dấu lời khai sinh viên thành `verified`.
- Không tự tick checklist thay cán bộ.
- Không tự gửi draft hoặc hoàn tất ticket.
- Backend cấp version, lưu metadata model/prompt/template và kiểm tra revision trước khi nhận kết quả.
- Brief cũ phải được đánh dấu `stale` khi dữ liệu nguồn thay đổi; không ghi đè draft cán bộ đang sửa.

## 6. API người 3 và người 4 thống nhất

Prefix chung: `/api/v1`.

| API | Mục đích |
|---|---|
| `POST /auth/demo-login` | Đăng nhập tài khoản demo, tạo session |
| `POST /auth/logout` | Kết thúc session |
| `GET /me` | Lấy người dùng và role hiện tại |
| `POST /conversations` | Tạo phiên chat |
| `GET /conversations` | Liệt kê phiên được phép xem |
| `GET /conversations/{id}/messages` | Đọc lịch sử |
| `POST /conversations/{id}/messages` | Gửi tin và chạy intake nếu chưa khóa |
| `PATCH /previews/{id}` | Sửa preview, tăng version |
| `POST /tickets` | Submit 1 từ preview đã xác nhận |
| `GET /tickets` | Sinh viên xem ticket của mình |
| `GET /tickets/{id}` | Xem ticket theo quyền |
| `POST /tickets/{id}/messages` | Gửi thông tin bổ sung |
| `GET /officer/tickets` | Hàng chờ theo phạm vi cán bộ |
| `GET /officer/tickets/{id}/brief` | Lấy trạng thái/kết quả hồ sơ AI |
| `POST /officer/tickets/{id}/prepare` | Yêu cầu chuẩn bị lại hồ sơ |
| `POST /officer/tickets/{id}/actions` | Submit 2 |
| `GET /officer/tickets/{id}/audit` | Xem nhật ký nghiệp vụ |

P0 không cần cho frontend tự gọi endpoint handover. Backend thực thi handover khi nhận kết quả L4 theo chính sách đã chốt.

### 6.1. Response chat

Response thành công có cùng cấu trúc ngoài cho mọi nhánh:

```json
{
  "conversation_id": "conv_001",
  "user_message_id": "msg_001",
  "route": "L2",
  "outcome": "preview_ready",
  "reply": {
    "id": "msg_002",
    "sender": "assistant",
    "content": "Bạn hãy kiểm tra thông tin trước khi gửi."
  },
  "citations": [],
  "preview": {
    "id": "preview_001",
    "version": 1,
    "service_type": "student_certificate",
    "fields": {
      "purpose": "Vay vốn ngân hàng",
      "destination_org": "Ngân hàng Chính sách Xã hội",
      "receive_method": "paper_stamped"
    },
    "missing_fields": [],
    "can_submit": true
  },
  "ticket": null,
  "conversation_state": {
    "status": "active",
    "ai_response_locked": false,
    "handover_status": "none"
  }
}
```

Frontend dựa vào `outcome`, `preview` và `conversation_state` để render. Không phân tích câu chữ của `reply` để quyết định mở form hoặc khóa chat.

Với conversation đã khóa, backend vẫn nhận thông tin bổ sung cho cán bộ và trả `outcome: "forwarded_to_officer"`; không gọi agent trả lời sinh viên. Chỉ trả outcome này sau khi lưu và liên kết tin nhắn với ticket thành công. Nếu handover đang lỗi/chưa có ticket, phải giữ trạng thái chờ hoặc trả lỗi trung thực.

### 6.2. Submit 1

```http
POST /api/v1/tickets
Idempotency-Key: <client-generated-key>
```

```json
{
  "preview_id": "preview_001",
  "preview_version": 1,
  "confirmed": true
}
```

Backend kiểm tra:

- Preview thuộc đúng người và conversation.
- Đủ field, đúng version, chưa hết hiệu lực.
- Conversation không bị khóa L4.
- Yêu cầu chưa được xử lý trùng.

Frontend chỉ hiển thị “đã nộp” sau khi nhận ticket đã lưu từ backend.

### 6.3. Submit 2

```http
POST /api/v1/officer/tickets/tkt_001/actions
Idempotency-Key: <client-generated-key>
```

```json
{
  "action": "respond",
  "content": "Phòng học vụ đã tiếp nhận hồ sơ...",
  "expected_revision": 1,
  "reviewed_brief_version": 1,
  "confirmed": true
}
```

`action` gồm `respond`, `request_info`, `resolve`.

Backend kiểm tra quyền, revision, chuyển trạng thái và nội dung cuối cùng cán bộ gửi. Nếu xử lý thủ công khi brief lỗi, `reviewed_brief_version` có thể là `null`; vẫn phải xác nhận đúng revision ticket.

## 7. Quyền và dữ liệu được hiển thị

| Dữ liệu/thao tác | Sinh viên | Cán bộ |
|---|---|---|
| Conversation | Của mình | Theo phạm vi được giao |
| Ticket | Của mình | Theo phạm vi được giao |
| Gửi thông tin bổ sung | Ticket của mình đang mở | Theo quyền |
| Officer Brief, draft nội bộ | Không | Có, theo quyền |
| Audit nội bộ | Không | Có, theo quyền |
| Gửi phản hồi nghiệp vụ | Không | Qua Submit 2 |
| Hoàn tất ticket | Không | Qua Submit 2 |

Backend phải dùng schema response riêng cho sinh viên/cán bộ. Không gửi toàn bộ object rồi chỉ ẩn phần nhạy cảm bằng CSS.

Demo dùng `SV001`, `SV024`, `OF001`, nhưng danh tính vẫn được backend quản lý qua session. Đăng nhập demo chỉ dùng với dữ liệu giả lập.

## 8. Lỗi, retry và xử lý AI

Format lỗi chung:

```json
{
  "error": {
    "code": "STALE_REVISION",
    "message": "Hồ sơ đã thay đổi. Vui lòng tải lại trước khi xác nhận.",
    "request_id": "req_001",
    "retryable": false,
    "details": {}
  }
}
```

| HTTP | Mã lỗi tiêu biểu |
|---|---|
| `401` | `UNAUTHENTICATED` |
| `403` | `FORBIDDEN` |
| `404` | `RESOURCE_NOT_FOUND` |
| `409` | `STALE_REVISION`, `PREVIEW_EXPIRED`, `CONVERSATION_LOCKED`, `IDEMPOTENCY_CONFLICT` |
| `422` | `VALIDATION_ERROR`, `CONFIRMATION_REQUIRED` |
| `503` | `AI_UNAVAILABLE`, `HANDOVER_FAILED` |

Quy tắc idempotency:

- Retry cùng thao tác phải dùng lại key cũ.
- Cùng key và cùng payload: trả lại kết quả đã lưu.
- Cùng key nhưng khác payload: trả `409`.
- Nhận diện L4 và retry bàn giao không được tạo nhiều ticket cho cùng một sự kiện.
- Key phải được giới hạn theo actor và thao tác; không dùng key đơn lẻ để trả dữ liệu giữa các tài khoản.

Về xử lý AI:

- Chat P0 dùng request/response JSON; chưa bắt buộc streaming.
- Tạo ticket không cần chờ Officer Brief hoàn thành.
- Backend lưu công việc chuẩn bị brief và trạng thái để worker xử lý/retry.
- Frontend poll endpoint brief trong lúc `pending/processing`.
- Lỗi tạo brief không được làm mất ticket hoặc chặn cán bộ xử lý thủ công.

Người 3 sở hữu cơ chế job/retry; người 2 sở hữu hàm chạy graph.

## 9. Cách làm song song và quản lý contract

**Nguồn chuẩn của contract:** Pydantic schema `src/models/contracts_v1.py` và OpenAPI contract được sinh từ `scripts/export_contracts_v1.py`. Kiểm tra đồng bộ bằng `.venv/bin/python -m scripts.export_contracts_v1 --check`.

Khi bắt đầu, người 3 dùng schema chung để hiện thực API; người 1–2 implement các Protocol; người 4 dùng OpenAPI/fixture để dựng adapter và mock. Không cần chờ người khác tạo lại schema.

Cả nhóm dùng chung fixture cho ít nhất các tình huống:

1. L1 trả lời có nguồn.
2. L1 thiếu nguồn.
3. L2 đang hỏi thiếu thông tin.
4. L2 preview đủ dữ liệu.
5. Submit 1 thành công.
6. L4 handover thành công/thất bại.
7. Officer Brief đang chạy/thành công/thất bại.
8. Submit 2 bị từ chối do revision cũ.

Các mock phải trả đúng fixture/schema này. Khi sửa contract, người sửa cập nhật schema, fixture và báo người phụ thuộc trong cùng PR; không tự đổi tên field riêng ở frontend hoặc agent.

| Người | Cách triển khai độc lập |
|---|---|
| 1 — RAG | Xây pipeline và test bằng bộ câu hỏi riêng, trả đúng schema |
| 2 — Agent | Dùng RAG giả lập và ticket mẫu để xây/test graph L2/L3/L4 |
| 3 — Backend | Dùng kết quả agent giả lập để xây API, database, quyền và workflow |
| 4 — Frontend + DevOps | Dùng mock API theo contract; dựng CI, môi trường demo và kiểm thử tích hợp |

Mỗi người dùng branch riêng, PR nhỏ vào `develop`. Tích hợp theo thứ tự:

1. L1: frontend → backend → RAG → câu trả lời có nguồn.
2. L2–L3: preview → Submit 1 → ticket → hồ sơ AI → Submit 2 → sinh viên thấy phản hồi.
3. L4: nhận diện → khóa AI → bàn giao → cán bộ xử lý → sinh viên bổ sung.

## 10. Điều kiện nghiệm thu chung

Một luồng chỉ được coi là hoàn thành khi chạy qua frontend, backend và module AI tương ứng:

| Luồng | Điều kiện pass |
|---|---|
| **L1** | Trả lời có nguồn hỗ trợ; thiếu nguồn nói rõ; không tự tạo ticket |
| **L2** | Prefill/hỏi thiếu → preview → Submit 1 → một ticket thật; hủy không tạo ticket |
| **L3** | Cán bộ thấy hồ sơ AI, sửa draft, gửi phản hồi; sinh viên thấy cập nhật; gửi phản hồi chưa tự `resolved` |
| **L4** | Nhận diện → khóa AI → lưu bàn giao → báo đúng kết quả; tin bổ sung tới cán bộ |
| **Phân quyền** | `SV024` không đọc được conversation/ticket của `SV001`, kể cả gọi API trực tiếp |
| **Retry** | Gửi lại không tạo trùng ticket, message hoặc action |
| **Lỗi AI** | Ticket vẫn tồn tại; trạng thái lỗi rõ ràng; cán bộ có thể xử lý thủ công |
| **Dữ liệu thay đổi** | Submit dùng revision cũ bị chặn và yêu cầu review lại |

Những phần như streaming, tìm kiếm nâng cao, dashboard SLA, tối ưu retrieval và mở rộng nhiều agent có thể bổ sung sau khi các luồng trên đã chạy xuyên suốt.

## 11. Checklist triển khai theo contract v1

- [x] Chốt enum, schema và ranh giới trách nhiệm.
- [x] Có schema RAG, Agent, API và fixture dùng chung.
- [x] Có OpenAPI contract, validation test và lệnh kiểm tra đồng bộ.
- [x] Chốt session, preview, revision, idempotency và trạng thái ticket.
- [x] Chốt transport module, durable job và scope cán bộ P0 ở mục 19.
- [ ] Người 1 nạp kho tài liệu/SOP demo có manifest theo schema citation.
- [ ] Người 2 implement agent/RAG adapter theo Protocol.
- [ ] Người 3 implement persistence, API, authorization và worker.
- [ ] Người 4 implement frontend adapter, mock và CI/DevOps.
- [ ] Chạy các scenario nghiệp vụ/E2E ở mục 17.

Checklist phân biệt phần contract đã có và chức năng runtime chưa triển khai. Schema validation không thay thế kiểm thử quyền, transaction, safety hoặc chất lượng AI.

## 12. Tài liệu liên quan

- [Kiến trúc và công nghệ](../ARCHITECTURE.md).
- [Quy trình Campus 24/7](Quy-trinh.md).
- [Pipeline L2–L3–L4](Pipeline-L2-L3-L4.md).
- [Kế hoạch AI Copilot L2–L3–L4](../plan2-3-4.md).

## 13. Ranh giới trách nhiệm và quyền ghi

### 13.1. Ai quyết định, ai thực thi?

| Năng lực | Người chịu trách nhiệm | Được làm | Không thuộc quyền của module |
|---|---|---|---|
| Retrieval và câu trả lời L1 | 1 — RAG | Truy nguồn trong phạm vi đã cấp, tổng hợp câu trả lời và citation | Quyết định danh tính, cấp quyền, tạo ticket, tự mở rộng phạm vi tài liệu |
| Routing/intake | 2 — Agent | Đề xuất route/risk, bóc tách field, hỏi thiếu, dựng preview candidate | Ghi DB nghiệp vụ, phát hành preview ID, xác nhận thay sinh viên |
| Chuẩn bị hồ sơ L3 | 2 — Agent | Tạo summary/facts/checklist/draft/priority suggestion | Tự gửi, tự `resolved`, tự xác minh lời khai, thay quyền truy cập |
| Workflow và dữ liệu | 3 — Backend | Kiểm tra quyền, validate, commit, khóa conversation, áp rule, audit | Tin trực tiếp ID/quyền/trạng thái do model hoặc client tự khai |
| Giao diện | 4 — Frontend | Render theo outcome, giữ draft người dùng, gửi thao tác xác nhận | Tự kết luận đã lưu, tự sinh mã ticket, tự cấp quyền |
| Môi trường chạy | 4 — DevOps | CI/CD, cấu hình secret, chạy API/worker, health check, rollback | Thay chính sách retry/status bên trong ứng dụng để chữa lỗi deploy |

Người 3 cung cấp migration, seed, entry point worker, health/readiness, log có `request_id` và danh mục biến môi trường. Người 4 cấu hình cách chạy/deploy các thành phần đó. Lỗi migration/worker do người 3 sửa; lỗi pipeline/cấu hình hạ tầng do người 4 sửa. Người 1–2 cung cấp thông tin model, timeout và biến môi trường cần thiết, không hardcode secret.

### 13.2. Phạm vi module và bàn giao

Đường dẫn sau là ranh giới module đã chốt; các thư mục runtime chưa có phải được người phụ trách tạo khi triển khai:

| Người | Phạm vi code chính | Bàn giao bắt buộc |
|---|---|---|
| 1 | `src/rag/`, `eval/rag/` | Hai interface RAG, dữ liệu nguồn có manifest, bộ câu hỏi/expected citations |
| 2 | `src/agents/`, `eval/agents/` | Hai interface agent, graph/prompt có version, test routing/structured output |
| 3 | `src/api/`, `src/models/`, `src/services/`, `src/db/`, `src/workers/` | Schema chung, API, migration/seed, quyền, job và transaction tests |
| 4 | `frontend/`, `.github/workflows/`, cấu hình deploy | API adapter, mock đúng contract, E2E, CI và runbook |

Backend chủ trì schema dùng chung; người sở hữu RAG/Agent review schema nội bộ tương ứng, frontend review schema public. Dockerfile/Compose do người 4 chủ trì, người 3 review lệnh chạy và migration. Không thay file chung âm thầm trong nhánh riêng.

## 14. Contract nội bộ RAG và Agent

### 14.1. Kiểu dùng chung và validation

- Mọi request/response nội bộ phải qua schema validation tại biên module; không truyền dictionary tùy ý xuyên suốt hệ thống.
- ID tham chiếu là string không rỗng, tối đa 128 ký tự. ID do model tạo không có thẩm quyền; backend chỉ chấp nhận tham chiếu nằm trong snapshot đã cấp.
- Tin nhắn: trim, từ 1 đến 5.000 ký tự. Nội dung phản hồi cán bộ: 1–10.000 ký tự.
- History item dùng `Message`: `{id, conversation_id, ticket_id, sender, content, created_at}`; `sender` là `student | officer | assistant | system`. Citation, policy và lịch sử là dữ liệu, không phải chỉ dẫn hệ thống.
- `Citation`: `{document_id, document_title, document_version, chunk_id, locator, quote, url}`; chỉ `url` được null. Backend kiểm tra nguồn thuộc phạm vi người nhận; `url` phải là URL nguồn đã duyệt, không lấy URL tùy ý từ model.
- Schema request API từ chối field lạ bằng lỗi `422`; schema output AI sai không được tự sửa bằng cách bỏ qua quyền hoặc field bắt buộc.

### 14.2. RetrievalRequest → RetrievalResult

| Đầu vào | Kiểu / ràng buộc | Bên cấp |
|---|---|---|
| `query` | String 1–5.000 ký tự | Agent hoặc RAG answer flow |
| `policy_scope` | String thuộc danh sách scope được phép | Backend; agent chỉ chuyển tiếp |
| `top_k` | Integer 1–10, mặc định 5 | Cấu hình ứng dụng |
| `effective_at` | ISO 8601 UTC | Backend |

Đầu ra:

```json
{
  "status": "found",
  "passages": [
    {
      "citation": {
        "document_id": "policy_001",
        "document_title": "Quy trình cấp giấy — dữ liệu demo",
        "document_version": "1",
        "chunk_id": "chunk_012",
        "locator": "Mục 2",
        "quote": "Sinh viên kiểm tra thông tin trước khi gửi yêu cầu.",
        "url": null
      },
      "text": "Sinh viên kiểm tra thông tin trước khi gửi yêu cầu.",
      "score": 0.82
    }
  ],
  "index_version": "demo-v1"
}
```

`status = found | empty`; `empty` bắt buộc `passages=[]`. `score` là số hoặc null, chỉ dùng nội bộ, không diễn giải thành xác suất đúng. Retrieval phải lọc scope, trạng thái phê duyệt và hiệu lực trước khi trả passage; index version phải truy được về manifest tài liệu. Không có kết quả phù hợp là `empty`; index không truy cập được là lỗi kỹ thuật.

### 14.3. RagRequest → RagResult

`RagRequest` gồm `question`, `history` (tối đa 20 item gần nhất, backend chọn lọc), `policy_scope`, `effective_at`. `effective_at` bổ sung cho ví dụ rút gọn ở mục 4. Người 1 xử lý ngân sách token, không cắt bỏ quy tắc hoặc mở rộng scope để lấy thêm dữ liệu.

| `status` | `answer` | `citations` | Hành vi |
|---|---|---|---|
| `answered` | Câu trả lời có căn cứ | Ít nhất 1 citation | Chỉ chứa claim được nguồn hỗ trợ |
| `needs_clarification` | Câu hỏi làm rõ | Có thể rỗng | Không tự suy đoán quy định |
| `insufficient_evidence` | Thông báo giới hạn | Rỗng hoặc nguồn chưa đủ, không giả nguồn hỗ trợ | Không tự tạo ticket |

Cả ba nhánh đều là kết quả nghiệp vụ thành công, không ném exception chỉ vì thiếu nguồn. Lỗi provider/index/validation đi qua `ModuleError` ở mục 14.6. Agent giữ route L1 cho kết quả thiếu nguồn; chỉ chuyển L4 khi có căn cứ routing độc lập.

### 14.4. IntakeContext → IntakeResult

`IntakeContext` chỉ do backend dựng:

| Field | Quy ước |
|---|---|
| `request_id` | ID truy vết, không dùng thay idempotency key |
| `conversation_id`, `conversation_revision` | Snapshot conversation hiện hành |
| `actor` | `{user_id, role}` từ session |
| `student_profile` | `{student_id, full_name, mssv, faculty, cohort, is_demo}`; field chưa có trả null, ID và `is_demo` bắt buộc |
| `message` | Tin nhắn đã lưu, do sinh viên gửi |
| `history` | Lịch sử đã lọc quyền; không bao gồm AI artifact nội bộ cán bộ |
| `preview` | Preview hiện tại hoặc null |
| `linked_ticket` | Ticket đầy đủ theo schema dùng chung hoặc null; chỉ dữ liệu đã lọc quyền |
| `policy_scope`, `effective_at` | Backend quyết định |

`IntakeResult` luôn có `{route, outcome, reply, citations, intake, handover}`. `reply` là string hoặc null ở biên nội bộ; backend mới lưu và cấp ID message để trả API.

| Nhánh | Field bắt buộc | Field phải null/rỗng |
|---|---|---|
| L1 | `reply`; citations theo RagResult | `intake=null`, `handover=null` |
| L2 collecting | `reply`, `intake` với danh sách thiếu/không hợp lệ | `handover=null`, `citations=[]` nếu chưa dùng nguồn |
| L2 preview_ready | `reply`, `intake` đủ dữ liệu | `handover=null` |
| L4 handover_required | `handover` | `reply=null`, `intake=null`, `citations=[]` |

`intake` có `{service_type, fields, missing_fields, invalid_fields}`:

- `service_type` P0 của L2 luôn là `student_certificate`.
- `fields`: `purpose` (5–1.000 ký tự), `destination_org` (1–300 ký tự), `receive_method` (`digital_pdf | paper_stamped`); chưa biết trả null.
- `missing_fields`: tên field còn thiếu; `invalid_fields`: mảng `{field, reason}`.
- Tên/MSSV lấy từ profile đã cấp, không lấy từ lời khai để thay danh tính. Profile bắt buộc thiếu thì backend chặn Submit 1 và thông báo cần sửa dữ liệu demo.
- `preview_ready` yêu cầu hai danh sách lỗi rỗng; backend vẫn tự validate lại trước khi cấp preview.
- Agent trả field và nội dung đề xuất, không trả `confirmed`, `preview_id`, trạng thái commit hoặc mã ticket tự tạo.

`handover` có `{risk_type, reason, summary, source_message_ids}`. `risk_type` P0: `academic_complaint | wellbeing | unauthorized_action`. Reason/summary phải dựa trên tin nhắn, không chẩn đoán hoặc kết luận tranh chấp. Message ID phải thuộc conversation hiện tại.

| Ví dụ | Kết quả dự kiến |
|---|---|
| “Thủ tục phúc khảo ở đâu?” | L1 |
| “Tôi muốn gửi khiếu nại điểm môn X” | L4 academic_complaint |
| “Sửa điểm trong hệ thống cho tôi” | Chặn hành động + L4 unauthorized_action |
| “Cho tôi xem hồ sơ của sinh viên khác” | Backend chặn truy cập; không mặc định tạo ticket L4 |
| “Tôi muốn xin giấy để vay vốn” | L2, hỏi nơi nhận/phương thức nếu thiếu |
| Xin giấy kèm tín hiệu wellbeing cần hỗ trợ | L4 ưu tiên, không mở Submit 1 |

Rubric wellbeing và thông báo cố định phải được nhóm duyệt trên bộ ví dụ trước khi nghiệm thu. Khi router lỗi/không ra kết quả hợp lệ, không tự fallback sang L1/L2.

### 14.5. TicketSnapshot → OfficerBrief

Snapshot bắt buộc gồm `ticket`, `source_ticket_revision`, `student_profile`, `messages`, `intake_packet` hoặc `handover_packet`, `approved_sources`, `existing_officer_draft`, `request_id`. Những trường không áp dụng trả null; messages/sources là mảng. Backend lọc quyền trước khi cấp snapshot.

Đầu ra OfficerBrief theo ví dụ mục 5.2, bổ sung quy ước:

| Field | Ràng buộc |
|---|---|
| `ticket_id`, `source_ticket_revision` | Phải khớp snapshot |
| `summary` | 1–2.000 ký tự, không thêm dữ kiện ngoài snapshot |
| `facts` | Mảng `{key,value,source_type,source_id,verification_status}`; source_type: `student_message | profile | policy | tool_result` |
| `missing_items` | Mảng `{field, reason}` |
| `checklist` | Mảng `{id,label,checked}`; ID là khóa bước SOP, không phải DB ID; AI luôn trả `checked=false` |
| `suggested_priority` | `normal | high`; không thay ưu tiên L4 đã được backend đặt |
| `priority_reasons` | Mảng string, bắt buộc có lý do nếu đề xuất high |
| `draft_reply` | String tối đa 10.000 ký tự hoặc null nếu chưa tạo được draft hợp lệ |
| `citations` | Citation từ approved sources |
| `warnings` | Mảng `{code,message}` |
| `quality_status` | `pass | fail`; khác với trạng thái job/brief |

Nguồn profile demo được xác nhận chỉ là nguồn demo, không được gắn nhãn đã đối soát trường thật. `quality_status=fail` không tự biến thành lỗi mất ticket: backend lưu artifact bị chặn và warnings; UI không cho gửi nguyên draft bị chặn. Nếu cán bộ soạn nội dung mới thủ công, API Submit 2 vẫn kiểm tra nội dung mới.

Metadata backend lưu cùng artifact: `brief_version`, `source_ticket_revision`, `model_name`, `prompt_version`, `template_version`, `index_version`, `created_at`. Model không quyết định version bản ghi. Artifact không ghi đè draft cán bộ đang sửa.

### 14.6. Lỗi module nội bộ

RAG/Agent ném exception `ModuleCallError` mang payload Pydantic `ModuleError`, không trả chuỗi lỗi giả làm câu trả lời. Payload nội bộ gồm `{code, retryable, stage, request_id}`; chi tiết provider chỉ vào log đã che secret/dữ liệu riêng tư. `stage` là `retrieval | generation | routing | intake | brief | validation`.

| Mã | Retry? | Backend xử lý |
|---|---|---|
| `PROVIDER_TIMEOUT`, `PROVIDER_UNAVAILABLE`, `PROVIDER_RATE_LIMITED` | Có giới hạn | Lỗi AI tạm thời hoặc retry job |
| `INDEX_UNAVAILABLE` | Có giới hạn | Không báo thiếu bằng chứng thay cho lỗi index |
| `OUTPUT_SCHEMA_INVALID`, `SOURCE_REFERENCE_INVALID` | Không tự retry vô hạn | Chặn phát hành output, ghi lỗi và cảnh báo |
| `POLICY_SCOPE_DENIED` | Không | Chặn request; không chạy truy vấn scope khác |

## 15. Contract API và phản hồi frontend

### 15.1. Quy ước response và session

Session demo đã chốt: bearer token opaque do backend sinh, có thời hạn 8 giờ, kiểm tra role/scope ở server mỗi request; frontend giữ token trong bộ nhớ và đăng nhập lại sau reload. Không đưa token vào URL hoặc log. Endpoint demo-login chỉ bật trong môi trường demo với dữ liệu giả lập, không dùng làm cơ chế đăng nhập production.

API nhận `Authorization: Bearer <token>`. `request_id` được backend cấp và trả qua header `X-Request-Id`; ID này dùng truy vết. `Idempotency-Key` dành riêng cho thao tác có thể retry. ID trace client gửi không được dùng làm danh tính hay quyền.

Các kiểu response chung:

- `Message`: `{id, conversation_id, ticket_id, sender, content, created_at}`; ticket_id nullable; message public không chứa internal draft.
- `Conversation`: `{id, status, revision, ai_response_locked, handover_status, ticket_id, created_at, updated_at}`; ticket_id nullable. Quan hệ P0: mỗi conversation tối đa một ticket; yêu cầu nghiệp vụ mới mở conversation mới.
- `Preview`: `{id, version, service_type, fields, missing_fields, invalid_fields, can_submit, expires_at}`. ID và expires_at do backend cấp. Backend vẫn kiểm tra profile/lock/version khi submit.
- `TicketPublic`: các field ticket mục 3.2; không có OfficerBrief, internal draft hoặc audit. Summary cho sinh viên phải là tóm tắt yêu cầu công khai, không dùng nguyên phân tích nội bộ.
- `Page<T>`: `{items, total, page, page_size}`; page bắt đầu 1; page_size mặc định 20, tối đa 100; vượt trang trả items rỗng.
- `BriefEnvelope`: `{status, current_ticket_revision, brief_version, source_ticket_revision, artifact, error}`; version/artifact/error nullable khi chưa có kết quả. Error chỉ gồm thông tin an toàn cho cán bộ.

### 15.2. Request/response từng endpoint

Tất cả path dưới đây có prefix `/api/v1`. Body rỗng ghi `{}`; không ngầm nhận thêm field.

| Endpoint | Đầu vào | Thành công | Quyền / điều kiện |
|---|---|---|---|
| `POST /auth/demo-login` | `{user_id}` trong seed demo | 200 `{access_token,token_type:"Bearer",expires_at,user:{id,role,name}}` | Chỉ môi trường demo; user lạ trả 401 |
| `POST /auth/logout` | `{}` | 204, không body | Thu hồi token hiện tại |
| `GET /me` | Không body | 200 `{id,role,name}` | Session hợp lệ |
| `POST /conversations` | `{}` + idempotency key | 201 Conversation | Sinh viên |
| `GET /conversations` | page, page_size | 200 Page<Conversation> | Chỉ của sinh viên hiện tại |
| `GET /conversations/{id}/messages` | page, page_size | 200 Page<Message> | Chủ sở hữu/cán bộ có scope; thời gian tăng dần, ID làm tie-break |
| `POST /conversations/{id}/messages` | `{content}` + idempotency key | 200 ChatResult; 202 nếu đang xử lý | Sinh viên sở hữu; conversation chưa closed |
| `PATCH /previews/{id}` | `{expected_version,fields}` + idempotency key | 200 Preview mới | Chủ sở hữu; fields phải chứa đủ 3 field có thể sửa; null nghĩa là xóa giá trị, không phải bỏ qua |
| `POST /tickets` | Body mục 6.2 + idempotency key | 201 `{ticket:TicketPublic,brief_status:"pending"}` | Submit 1; transaction bao gồm job chuẩn bị brief |
| `GET /tickets` | page, page_size, status, search | 200 Page<TicketPublic> | Chỉ ticket của sinh viên hiện tại |
| `GET /tickets/{id}` | Không body | 200 `{ticket:TicketPublic,messages:Page<Message>}` | Chủ sở hữu hoặc cán bộ có scope; page đầu 20 message mới nhất, items theo thời gian tăng dần |
| `GET /tickets/{id}/messages` | page, page_size | 200 Page<Message> | Bổ sung endpoint phân trang message; cùng quyền với ticket |
| `POST /tickets/{id}/messages` | `{content}` + idempotency key | 200 ChatResult hoặc 202 đang xử lý | Sinh viên sở hữu; cùng pipeline safety/lock với conversation message |
| `GET /officer/tickets` | page, page_size, status, priority, category, search | 200 Page<TicketPublic> | Cán bộ trong scope; high trước normal, created_at tăng dần, ID tie-break |
| `GET /officer/tickets/{id}/brief` | Không body | 200 BriefEnvelope | Cán bộ có scope |
| `POST /officer/tickets/{id}/prepare` | `{expected_revision}` + idempotency key | 202 `{job_id,ticket_id,source_ticket_revision,status}` | Ticket chưa resolved; job cùng revision đang chạy được tái sử dụng |
| `POST /officer/tickets/{id}/actions` | Body mục 6.3 + idempotency key | 200 `{ticket:TicketPublic,message:Message,audit_id}` | Cán bộ có scope, review hợp lệ |
| `GET /officer/tickets/{id}/audit` | page, page_size | 200 Page<AuditEntry> | Cán bộ có scope |

`AuditEntry` gồm `{id,ticket_id,actor_id,actor_type,action,from_status,to_status,request_id,created_at}`; actor_id và from/to status nullable cho sự kiện hệ thống không đổi trạng thái. Không đưa raw prompt hoặc provider credential vào audit.

Filter enum lạ trả 422, không lặng lẽ bỏ qua. Search tối đa 100 ký tự, tìm code hoặc summary trong phạm vi quyền. List sinh viên/conversation sắp updated_at giảm dần, ID tie-break. Mọi phân trang đều ở server, không tải toàn bộ ticket rồi lọc quyền trên frontend.

Sinh viên truy cập tài nguyên của người khác nhận 404 để tránh lộ sự tồn tại; gọi nhóm endpoint cán bộ bằng role sinh viên nhận 403.

### 15.3. ChatResult là union, không suy luận bằng câu chữ

ChatResult có `{conversation_id,user_message_id,route,outcome,reply,citations,preview,ticket,conversation_state}` như mục 6.1. Reply dùng Message đầy đủ; ví dụ trước đó chỉ thể hiện field cần render. `route` luôn là L1/L2/L4; lỗi trả ErrorEnvelope, pending trả Processing, không tạo ChatResult giả với route null. `supplement_received` dùng route L2; `handover_completed` và `forwarded_to_officer` dùng route L4.

| Outcome public | HTTP | Reply | Preview | Ticket | Lock |
|---|---|---|---|---|---|
| `answered` | 200 | assistant | null | null | false |
| `needs_clarification` | 200 | assistant | null | null | false |
| `insufficient_evidence` | 200 | assistant | null | null | false |
| `collecting` | 200 | assistant | Preview thiếu dữ liệu, can_submit=false | null | false |
| `preview_ready` | 200 | assistant | Preview hợp lệ | null | false |
| `handover_completed` | 200 | system, nội dung cố định đã duyệt | null | `{id,code,status,priority}` đã commit | true |
| `forwarded_to_officer` | 200 | system xác nhận lưu tin bổ sung | null | Ticket reference đã tồn tại | true |
| `supplement_received` | 200 | system xác nhận bổ sung | null | Ticket reference đã tồn tại | false |

`handover_required` là outcome **nội bộ**, không trả như thành công public. L4 lỗi dùng error envelope 503 với trạng thái trung thực. Conversation đã có ticket nhưng chưa khóa: bổ sung chạy safety; không có L4 thì `supplement_received`, không phát sinh Submit 1 thứ hai. Dù tin đến qua endpoint ticket hay conversation, chỉ lưu một Message và phát cùng sự kiện cập nhật ticket.

Nếu cùng key đang xử lý, trả 202 `{operation_id,status:"processing",poll_after_ms:2000}` và header `Retry-After: 2`. Frontend gửi lại đúng request/key sau khoảng chờ để lấy kết quả; không tạo key mới. UI hiển thị “Đang xử lý”, chưa báo thành công. Thời gian giữ màn chờ tự động tối đa 60 giây, sau đó cho người dùng kiểm tra/thử lại cùng key.

### 15.4. Bộ JSON minh họa lỗi và nhánh khác

L1 thiếu nguồn là thành công nghiệp vụ:

```json
{
  "conversation_id": "conv_001",
  "user_message_id": "msg_003",
  "route": "L1",
  "outcome": "insufficient_evidence",
  "reply": {
    "id": "msg_004",
    "conversation_id": "conv_001",
    "ticket_id": null,
    "sender": "assistant",
    "content": "Kho tài liệu hiện tại chưa đủ căn cứ để trả lời câu hỏi này.",
    "created_at": "2026-09-29T03:01:00Z"
  },
  "citations": [],
  "preview": null,
  "ticket": null,
  "conversation_state": {
    "status": "active",
    "ai_response_locked": false,
    "handover_status": "none"
  }
}
```

L4 lưu lock thành công nhưng chưa tạo được ticket — HTTP 503:

```json
{
  "error": {
    "code": "HANDOVER_FAILED",
    "message": "Chưa chuyển được yêu cầu tới cán bộ. Hệ thống đã dừng trả lời tự động; bạn có thể thử lại.",
    "request_id": "req_002",
    "retryable": true,
    "details": {
      "conversation_id": "conv_002",
      "user_message_id": "msg_005",
      "ticket_id": null,
      "ai_response_locked": true,
      "handover_status": "failed"
    }
  }
}
```

Ví dụ trên chỉ hợp lệ khi lock thực sự đã persist. Nếu DB không xác nhận được lock, trả `PERSISTENCE_UNAVAILABLE` và trạng thái `unknown`, không tuyên bố đã khóa hoặc đã chuyển. Chặn L1/L2/Submit 1 cho đến khi backend khôi phục và kiểm tra lại trạng thái safety.

## 16. Trạng thái, concurrency và hành vi khi lỗi

### 16.1. Các transaction nghiệp vụ

| Thao tác | Các bản ghi phải nhất quán |
|---|---|
| Submit 1 | Consume preview + tạo ticket + liên kết conversation + audit + durable job/event + kết quả idempotency |
| Submit 2 | Kiểm tra revision + lưu message + status/revision + audit + kết quả idempotency |
| Bổ sung | Message duy nhất + ticket revision + đánh dấu brief stale + job/event |
| Handover | Tạo/nâng ticket + priority high + routing scope + liên kết conversation + audit + job/event |

Không giữ DB transaction mở trong khi chờ LLM. Backend đọc snapshot, gọi module, rồi so sánh revision/lock khi commit kết quả. Cả PATCH preview và Submit 1 phải tuần tự hóa với cập nhật safety trên cùng conversation.

Một conversation chỉ chạy một lượt intake tại một thời điểm. Tin mới khác key khi lượt trước chưa xong nhận `409 CONVERSATION_BUSY` trước khi lưu; frontend giữ nội dung, đợi và gửi lại cùng key. Tin mới không được vượt qua một lượt đang kiểm tra L4 để tạo ticket L2.

### 16.2. Quy tắc preview và revision đã chốt

- Preview hết hạn sau 30 phút kể từ lần cập nhật hợp lệ gần nhất; server trả `expires_at`.
- Sửa preview tăng `version`; PATCH yêu cầu `expected_version`, lệch trả `STALE_PREVIEW`.
- Khi backend đang xử lý tin mới, Submit 1 bị chặn bằng `CONVERSATION_BUSY`; nếu tin làm đổi dữ liệu thì preview version tăng, nếu L4 thì preview bị vô hiệu hóa.
- Submit 1 consume preview một lần. Dùng key mới để submit lại preview đã consume trả `409 PREVIEW_ALREADY_SUBMITTED` kèm ticket reference thuộc đúng user.
- Ticket revision tăng khi thêm message nghiệp vụ, đổi request/status/priority/owner; chỉ lưu artifact AI không tăng ticket revision.
- Job dùng revision cũ không được ghi đè brief mới; lưu kết quả cũ dưới dạng stale hoặc bỏ khỏi bản hiện hành, rồi xử lý revision mới nhất.
- `reviewed_brief_version` khác version hiện hành hoặc source revision không khớp thì Submit 2 trả `409 STALE_BRIEF`. Chế độ xử lý thủ công phải được người dùng chọn rõ, không tự đổi thành null để bỏ qua kiểm tra.
- P0 không reopen ticket `resolved`. Không nhận thêm message/action/prepare; trả `409 TICKET_CLOSED`. Conversation liên quan chuyển `closed`; yêu cầu mới tạo conversation mới.

### 16.3. Bảng chuyển trạng thái

| Trước | Sự kiện | Sau | Chủ thể |
|---|---|---|---|
| Chưa có ticket | Submit 1 hợp lệ | open | Sinh viên xác nhận, backend ghi |
| Chưa có ticket | Handover hợp lệ | pending_officer + high | Backend theo policy |
| open | respond / request_info | pending_officer | Cán bộ Submit 2 |
| pending_officer | respond / request_info | pending_officer | Cán bộ Submit 2 |
| open / pending_officer | resolve | resolved | Cán bộ Submit 2 |
| open / pending_officer | Nâng L4 trên ticket hiện có | pending_officer + high | Backend theo policy, không tạo ticket thứ hai |
| open / pending_officer | Bổ sung thông thường | Giữ status | Sinh viên; revision tăng |
| Bất kỳ | AI refresh brief | Giữ status | Worker chỉ cập nhật artifact |
| resolved | Ghi mới ngoài replay thành công | Từ chối | Backend |

Idempotency replay của thao tác đã thành công được trả lại kết quả cũ sau khi kiểm tra quyền hiện tại, kể cả ticket sau đó đã resolved. Không thực thi thao tác lần nữa.

### 16.4. Handover và khóa AI

1. Lưu message và operation intake ở trạng thái đang xử lý; backend chặn Submit 1/lượt intake khác trong thời gian này.
2. Router trả L4 hợp lệ: persist safety decision, `ai_response_locked=true`, `handover_status=pending` và vô hiệu preview.
3. Transaction handover tạo/nâng ticket, ghi scope/priority/audit/event rồi chuyển `handover_status=completed`.
4. Chỉ sau commit mới phát message system “đã chuyển” và ticket reference. Response thất lạc được replay, không tạo lại ticket.
5. Bước 3 lỗi: giữ lock, ghi failed nếu DB hoạt động; retry từ quyết định safety đã lưu, không chạy lại L1/L2.
6. Chưa có ticket mà sinh viên gửi bổ sung: lưu vào conversation nếu DB cho phép, giữ pending/failed và báo chưa chuyển. Khi retry handover thành công, liên kết cả các tin bổ sung đã lưu với ticket.

Worker phục hồi operation bị gián đoạn phải kiểm tra durable safety decision/lock trước. Nếu safety decision chưa lưu được, chạy lại kiểm tra safety trên message đã lưu trước mọi phản hồi hoặc Submit 1. Không tự mở khóa do timeout. P0 không hỗ trợ mở khóa L4; kết thúc qua cán bộ resolve.

Với wellbeing, quyền phải dựa trên nhóm cán bộ hỗ trợ được seed rõ; không đưa ca này vào hàng chờ học vụ chung. Nếu chưa có cán bộ/scope phù hợp, handover không được báo thành công; bộ nghiệm thu cần có cả fixture người có quyền và người không có quyền. `OF001` không mặc nhiên có mọi quyền chỉ vì là officer.

### 16.5. Ma trận lỗi và phản ứng frontend

| Lỗi | Dữ liệu có thể đã lưu? | Backend | Frontend | Phụ trách sửa |
|---|---|---|---|---|
| 401 session hết hạn | Không ghi mới | Yêu cầu đăng nhập lại | Giữ draft; đăng nhập rồi thử lại cùng key bằng đúng tài khoản | 3; 4 xử lý UI |
| 403/404 quyền | Không ghi mới | Không lộ tài nguyên ngoài scope | Báo không có quyền/không tìm thấy; không retry tự động | 3 |
| 422 field thiếu/sai | Không ghi nghiệp vụ | Trả field_errors an toàn | Highlight field, sửa dữ liệu; thao tác mới dùng key mới | 3–4 |
| 409 revision/preview stale | Không ghi action | Trả current_revision/current_version | Tải lại, giữ draft riêng, review lại; không tự gửi lại | 3–4 |
| 409 conversation busy | Lượt trước có thể đang chạy | Không nhận lượt mới | Giữ input, đợi; không bypass bằng conversation ID khác | 3–4 |
| Provider/index lỗi | User message có thể đã lưu | 503 AI_UNAVAILABLE, trả user_message_id nếu biết | Hiển thị tin đã lưu nhưng AI lỗi; retry cùng key | 1/2; 3 điều phối |
| Output AI sai schema/nguồn | Message/job có thể đã lưu | 502 AI_OUTPUT_INVALID; không phát draft lỗi | Báo chưa có kết quả hợp lệ; giữ ticket cho cán bộ | 1–2 |
| Handover lỗi | Có thể đã lưu message/lock | 503 và trạng thái xác nhận được | Không hiện mã giả; không tiếp tục L1/L2 | 3 |
| DB không khả dụng | Không xác định | 503 PERSISTENCE_UNAVAILABLE; không khẳng định commit | Giữ input, kiểm tra/retry cùng key | 3–4 |
| Mạng mất sau Submit | Có thể đã commit | Replay kết quả đã lưu khi retry | Không tự tạo key mới; tải trạng thái sau replay | 3–4 |
| Brief job lỗi | Ticket vẫn tồn tại | brief.status=failed | Cho xem hồ sơ gốc, retry hoặc xử lý thủ công | 2–3 |
| HTTP 429 | Không ghi mới hoặc operation cũ đang tồn tại | Retry-After | Chờ theo header; giữ key | 3–4 |

HTTP 502/429 và các mã trong mục này bổ sung bảng lỗi rút gọn ở mục 8. Không trả stack trace, provider error body hoặc secret cho UI. Retryable=true chỉ cho phép thử lại có giới hạn, không có nghĩa backend sẽ tự lặp vô hạn.

### 16.6. Timeout, retry và idempotency đã chốt

- Tổng ngân sách một lượt intake: 25 giây; caller frontend timeout 35 giây. Timeout cho từng lần gọi provider tối đa 10 giây và không vượt ngân sách còn lại.
- Backend điều phối tối đa một lần retry tự động cho lỗi tạm thời trong lượt chat; SDK/provider adapter phải tắt retry ẩn hoặc tính chung vào ngân sách này.
- Officer Brief: worker timeout 60 giây/lần, tối đa 3 lần tổng cộng, backoff 2 rồi 8 giây; kiểm tra revision trước mỗi lần và trước khi lưu.
- Job phải lưu bền vững cùng event nghiệp vụ; không chỉ dùng task trong bộ nhớ FastAPI. P0 dùng bảng job PostgreSQL và worker riêng theo mục 19; worker phải hỗ trợ lease và nhận lại job sau khi process chết.
- Idempotency record giữ ít nhất 24 giờ; key gắn actor + thao tác + resource + hash payload. Gửi lại cùng key khác payload trả 409.
- Validation thất bại trước khi nhận thao tác không consume key. Sau khi message đã lưu, retry phải tiếp tục operation cũ; không insert lại message. Operation có state processing/completed/retryable_failed/terminal_failed.
- Ràng buộc unique preview/conversation và event dedup vẫn bảo vệ dữ liệu sau khi idempotency record hết hạn. Client quá 24 giờ phải đối chiếu lịch sử trước khi coi là yêu cầu mới.
- Brief UI poll mỗi 2 giây khi trang đang hiển thị, dừng sau 60 giây hoặc trạng thái kết thúc; có nút tải lại, không spam prepare.

## 17. Fixture và tiêu chí bàn giao contract

Fixture wire đã có tại `docs/contracts/p0-v1.examples.json`, mỗi case gồm `name`, `model`, `payload`; frontend/backend đọc chung file này. OpenAPI contract ở cùng thư mục. Bảng dưới gồm cả test runtime cần triển khai: fixture/schema test không chứng minh workflow/database đã hoạt động.

| Fixture/test | Input chính | Output/invariant phải kiểm tra | Chủ trì |
|---|---|---|---|
| rag_answered | Câu hỏi có nguồn | answered + citation hợp lệ | 1 |
| rag_empty | Câu hỏi không có nguồn | insufficient_evidence, không bịa citation | 1 |
| rag_index_error | Index không truy cập được | ModuleError, không giả empty | 1 |
| intake_collecting | Xin giấy thiếu nơi nhận | L2 collecting, thiếu đúng field | 2 |
| intake_preview | Đủ field và profile | L2 preview_ready; backend cấp ID/version | 2–3 |
| mixed_intent_l4 | Xin giấy + khiếu nại | L4, preview không được submit | 2–3 |
| submit_replay | Gửi cùng key/payload hai lần | Một ticket, một audit/action tương ứng | 3 |
| submit_two_keys | Cùng preview, hai key | Một ticket, lần sau 409 | 3 |
| stale_preview | Submit version cũ | 409; không tạo ticket | 3–4 |
| handover_partial_failure | Persist lock rồi lỗi tạo ticket | Lock giữ nguyên, không báo đã chuyển | 3 |
| handover_retry | Retry operation L4 cũ | Một ticket, nối đủ message đã lưu | 3 |
| locked_supplement | Tin mới sau handover | Tới cán bộ, không gọi L1/L2 | 2–3 |
| brief_stale | Job revision cũ về muộn | Không ghi đè brief mới | 3 |
| brief_quality_fail | Draft thiếu nguồn | Không phát hành draft lỗi, có cảnh báo | 2–4 |
| response_vs_resolve | Hai action khác nhau | pending_officer rồi resolved | 3–4 |
| unauthorized_access | SV024 đọc ticket SV001 | 404, không trả artifact | 3 |
| restricted_wellbeing | Officer thiếu scope | Không đọc được list/detail/message/brief/audit | 3 |
| post_resolve | Gửi bổ sung sau resolved | 409, không reopen ngầm | 3–4 |
| lost_response | Commit thành công rồi mất mạng | Replay đúng kết quả, không trùng | 3–4 |

Người 1–2 kiểm thử module bằng dependency giả lập để không cần API key trong test thường. Người 3 kiểm tra fixture bằng Pydantic và test transaction/quyền. Người 4 dùng cùng fixture cho mock UI và kiểm tra các nhánh loading/error. E2E có thể mock LLM để kiểm tra workflow, nhưng phải có lượt nghiệm thu riêng với RAG/agent thật để chứng minh chất lượng AI.

## 18. Bàn giao Frontend + DevOps và đóng băng bản P0

### 18.1. Hợp đồng vận hành giữa người 3 và người 4

| Người 3 cung cấp | Người 4 triển khai/kiểm chứng |
|---|---|
| Lệnh API, worker, migration, seed và dependency cần dùng | Quy trình local/demo chạy theo đúng thứ tự |
| Danh mục biến: kiểu, bắt buộc/tùy chọn, giá trị mặc định | Template môi trường và secret trên nền tảng deploy |
| Health liveness và readiness DB/job store | Health check, restart và smoke test |
| Migration có hướng dẫn tương thích phiên bản | Chạy migration một lần trước rollout; không tự seed/reset dữ liệu mỗi deploy |
| Log request/job ID, mã lỗi an toàn | Thu log và hướng dẫn tra lỗi từ request_id |
| Quy tắc retry/lease worker | Cấu hình process, timeout và graceful shutdown tương thích |

Người 1 cung cấp lệnh build/rebuild index và manifest phiên bản; người 4 bố trí storage bền vững và quy trình nạp index. API key LLM và database credential chỉ ở backend/worker; không đưa vào `NEXT_PUBLIC_*`.

CI mục tiêu P0: backend lint/test, frontend lint/build, contract fixture validation; chạy trên PR vào `develop` và `main`. Đây là yêu cầu cần triển khai, chưa phải mô tả CI hiện tại. Không bắt buộc Kubernetes hoặc microservices.

### 18.2. Quyết định giao tiếp đã chốt

- [x] Bearer session demo 8 giờ, token ở bộ nhớ frontend.
- [x] Một conversation tối đa một ticket; resolved không reopen.
- [x] Preview 30 phút, revision/lock và idempotency ở mục 16.
- [x] Timeout/retry có giới hạn, durable job PostgreSQL.
- [x] Interface policy_scope và scope riêng cho wellbeing ở mục 19.
- [x] Schema Pydantic, Protocol async, OpenAPI và fixture dùng chung đã tạo.
- [ ] Các thành viên implement runtime và kiểm thử module mình theo contract.

Contract giao tiếp v1 đã đóng băng làm baseline triển khai. Sửa đổi tương thích có thể bổ sung qua PR; đổi tên field, enum hoặc hành vi cần cập nhật version, fixture và cả bên gọi/bên nhận. Không coi checklist contract đã tick là bằng chứng hệ thống đã có chức năng runtime tương ứng.

## 19. Quyết định triển khai và hướng dẫn dùng contract v1

### 19.1. Transport và công nghệ nền đã chốt

| Giao tiếp | Quyết định v1 | Người thực hiện |
|---|---|---|
| Frontend → Backend | HTTP JSON theo OpenAPI, prefix `/api/v1`; bearer session; không streaming P0 | 3–4 |
| Backend → Agent | Gọi Python async qua `AgentPort` trong cùng codebase; không tách service | 2–3 |
| Agent → RAG | Gọi Python async qua `RagPort`, truyền policy_scope từ backend | 1–2 |
| API → AI worker | PostgreSQL jobs: durable event tạo cùng transaction ticket | 3 |
| Worker → Agent | `prepare_officer_brief(TicketSnapshot)` rồi compare revision trước commit | 2–3 |
| Frontend → trạng thái brief | GET polling 2 giây; không gọi prepare mỗi lần poll | 4 |
| Database | PostgreSQL cho môi trường tích hợp/local qua container; SQLAlchemy + Alembic | 3; 4 vận hành |
| RAG index | ChromaDB, do module RAG sở hữu; không để frontend truy cập trực tiếp | 1; 4 cấu hình storage |

Worker dùng job có `{id,kind,ticket_id,source_revision,state,attempts,available_at,lease_until,last_error}`; kind P0 là `prepare_brief` hoặc `retry_handover`. Backend áp dedup theo loại việc/resource/revision hoặc handover operation ID. Lease phải gia hạn khi còn chạy; worker chết được nhận lại sau lease. Không cần Redis/Celery cho P0; có thể đổi cơ chế queue sau mà không đổi API frontend.

Các lựa chọn trên chưa được cài dependency/runtime trong thay đổi contract này. Người phụ trách bổ sung trong PR triển khai của mình.

### 19.2. Scope và ánh xạ L4

| Risk | category / service_type | Team có quyền | policy_scope nội bộ |
|---|---|---|---|
| academic_complaint | complaint / academic_complaint | academic | demo_academic |
| unauthorized_action | complaint / academic_complaint | academic | demo_academic |
| wellbeing | complaint / student_support | student_support | demo_support |

Seed `OF001` thuộc academic; bổ sung `OF002` thuộc student_support để kiểm thử riêng tư. Hai tài khoản không tự kế thừa scope của nhau. Backend chọn team từ policy, không lấy tên team do model tự gợi ý. Student tra cứu L1 chỉ dùng `demo_academic`; SOP hỗ trợ nội bộ `demo_support` chỉ cấp cho worker/cán bộ tương ứng. Đầu ra route/risk không thay thế kiểm tra quyền.

L2 ticket dùng action/student_certificate, team academic. Với L4 nâng ticket có sẵn, chuyển category/service_type/team theo bảng, giữ cùng ID và history; thông tin request cũ giữ trong intake_packet nội bộ. Trường request_data của complaint có thể null. AI không tự quyết định mở lại ticket closed.

Người 1 bàn giao manifest nguồn có `document_id`, `document_version`, `policy_scope`, `title`, `effective_from`, `effective_to`, `approved`, `is_demo`, `source_url`; nguồn hết hiệu lực/chưa approved không được retrieval trả về. P0 dùng tài liệu mô phỏng có nhãn rõ; nội dung policy/SOP do người 1–2 xây và kiểm tra theo pipeline trước demo. Việc chưa nạp dữ liệu không cản trở làm việc với fixture.

### 19.3. Quy tắc wire bổ sung

- Input preview PATCH là snapshot đầy đủ 3 field; frontend không gửi chỉ một key. Backend tăng version một lần sau validate.
- Giá trị lời khai không hợp lệ được agent giữ trong câu hỏi/history; field chuẩn hóa đặt null, kèm missing_fields và invalid_fields tương ứng. Không nhét chuỗi sai enum vào fields.
- Nullable response luôn serialize có key với null. ErrorDetails được schema điền đủ field mặc định; người dùng chỉ thấy thông tin thuộc quyền mình.
- Datetime schema yêu cầu timezone; backend chuẩn hóa output UTC. Validation schema không kiểm tra URL có được duyệt hoặc resource thuộc quyền; backend/RAG phải kiểm tra bằng dữ liệu thật.
- Job chạy thành công nhưng quality_status=fail: BriefEnvelope có status ready vì job đã hoàn thành, artifact có quality_status fail và warnings; UI chặn dùng draft đó. `failed` dành cho lỗi chạy job, `stale` dành cho nguồn thay đổi.
- Nếu kết quả AI lỗi, không trả analysis nội bộ ra ChatResult. `analysis` của API chat mẫu cũ không thuộc contract v1.
- Receipt replay của `prepare` luôn là JobAccepted chứa cùng job_id; GET brief là nguồn trạng thái hiện tại. Các write endpoint còn lại đang có operation trùng chạy dở trả Processing 202 theo OpenAPI.
- Handover thành công trả ticket pending_officer/high; tin bổ sung sau đó không tự đổi priority/status.

### 19.4. Điểm bắt đầu cho mỗi người

1. Người 1 implement `RagPort`, trả `RetrievalResult` và `RagResult`; lỗi dùng `ModuleCallError`.
2. Người 2 implement `AgentPort`, inject RagPort giả lập hoặc thật; dùng `IntakeResult` để router có cùng cấu trúc cho mọi nhánh.
3. Người 3 import request/response từ contracts_v1; implement route/DB/worker. Mount route thật theo OpenAPI contract, không mount endpoint giả chỉ để trả thành công.
4. Người 4 đọc `docs/contracts/p0-v1.openapi.json` để tạo TypeScript API types/client hoặc adapter tương ứng; lấy payload từ examples.json làm mock. Không tự thêm field khác contract.

Lệnh kiểm tra từ thư mục gốc:

```bash
.venv/bin/python -m scripts.export_contracts_v1 --check
.venv/bin/pytest tests/test_contracts/ -q
```

Khi sửa schema hợp lệ trong một PR, sinh lại artifact:

```bash
.venv/bin/python -m scripts.export_contracts_v1
```

OpenAPI diễn tả kiểu/field/enum; các ràng buộc liên field trong Pydantic validator và quy tắc transaction/quyền vẫn phải áp dụng trên server. Contract tests kiểm tra cả nhánh hợp lệ và payload bị cấm; không thay cho test end-to-end.
