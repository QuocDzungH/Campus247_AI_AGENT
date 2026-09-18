# Brief Dự án: Campus 24/7 – Trợ lý AI Vận hành Học vụ

> **Mã đề**: EDU-14 – AI Vận hành  
> **Nhóm thực hiện**: Team EDU-14 (Đặng Quang Huy, Hoàng Quốc Dũng, Dương Xuân Vinh, Lê Trung Kiên)  
> **Tài liệu chi tiết**: [PRD](02-prd.md) | [UI Flow](03-ui-flow.md)

---

## 1. Thông điệp Cốt lõi (One-Sentence Pitch)
> **Campus 24/7** là trợ lý AI vận hành học vụ dành cho sinh viên, có khả năng tra cứu quy chế kèm nguồn trích dẫn chính thức, tiếp nhận yêu cầu thủ tục có xác nhận của người dùng và chuyển giao cán bộ xử lý đối với các trường hợp nhạy cảm hoặc rủi ro.

---

## 2. Đối tượng Người dùng Mục tiêu
- **Sinh viên**: Cần tra cứu nhanh quy chế học vụ, lịch thi, thủ tục cấp bảng điểm, đặt phòng tự học ngoài giờ hành chính mà không phải chờ đợi cán bộ trực.
- **Cán bộ hỗ trợ học vụ (Một cửa)**: Cần giảm tải khối lượng câu hỏi lặp lại, chỉ tập trung xử lý các yêu cầu nghiệp vụ phức tạp, khiếu nại điểm hoặc các tình huống đặc biệt.

---

## 3. Bài toán Thực tế & Giải pháp

| Vấn đề Hiện tại | Giải pháp của Campus 24/7 |
|:---|:---|
| Sinh viên cần hỗ trợ ngoài giờ hành chính (buổi tối, cuối tuần). | Phục vụ 24/7 tức thì với độ chính xác cao. |
| Quy chế nằm rải rác trong nhiều file PDF, website, khó tìm kiếm. | RAG Engine lập chỉ mục quy chế chính thức, trích dẫn rõ tên văn bản, điều khoản. |
| Chatbot thông thường hay bịa đặt thông tin (hallucination). | Cơ chế Guardrail: Chỉ trả lời khi có căn cứ văn bản; thiếu dữ liệu sẽ từ chối an toàn hoặc chuyển người. |
| Các ca khiếu nại, bức xúc không có người tiếp nhận kịp thời. | Cơ chế Handover (HITL): Tự động tạo ticket khẩn và chuyển giao cán bộ kèm tóm tắt ngữ cảnh. |

---

## 4. Phạm vi Sản phẩm (Product Scope)

### Trong phạm vi MVP (Gate 1 - Gate 3):
- **Cổng Sinh viên (Student Portal)**:
  - Khung chat hỏi đáp quy chế học vụ kèm trích dẫn nguồn (PDF/Trang/Điều khoản).
  - Tiếp nhận yêu cầu: Đặt phòng tự học, xin giấy xác nhận sinh viên (bắt buộc có bước Xác nhận thông tin).
  - Tra cứu tiến độ xử lý ticket của sinh viên.
- **Cổng Cán bộ (Staff Dashboard)**:
  - Bảng danh sách ticket cần xử lý phân loại theo độ khẩn cấp.
  - Xem tóm tắt hội thoại do AI bàn giao (Handover Context).
  - Cập nhật trạng thái xử lý ticket và phản hồi sinh viên.

### Ngoài phạm vi MVP (Out-of-scope):
- Tự động can thiệp chỉnh sửa điểm số trong cơ sở dữ liệu học vụ.
- Tự động phê duyệt cấp học bổng hay kỷ luật sinh viên.
- Tích hợp trực tiếp hệ thống LMS Canvas / Portal đào tạo thật của nhà trường.
- Tư vấn tâm lý chuyên sâu (chỉ hỗ trợ chuyển tiếp số hotline hỗ trợ).

---

## 5. Chỉ số Đo lường Thành công (Target Metrics)
- **Tỷ lệ trích dẫn đúng nguồn (Citation Accuracy)**: $\ge 70\%$ câu hỏi được trả lời có trích dẫn điều khoản chính xác.
- **Độ chính xác gọi công cụ (Tool Call Precision)**: $\ge 90\%$ yêu cầu tạo ticket/đặt phòng tạo đúng dữ liệu sau xác nhận.
- **Độ nhạy phát hiện ca nhạy cảm (Handover Recall)**: $100\%$ các trường hợp khiếu nại điểm hoặc nội dung rủi ro trong bộ test được chuyển giao cho cán bộ.

