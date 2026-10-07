# EDU-14 — Dataset open source

Danh sách nguồn dữ liệu public / open source đã chọn cho Campus 24/7.

Công thức dùng:

**KB demo = PDF VinUni. Benchmark RAG tiếng Việt = ViRHE4QA. Ticket/phòng = tự sinh.**

EDU-14 không cần dataset train model lớn. Cần ba loại: tài liệu RAG, Q–A để eval, ticket/lịch giả cho tool.

BTC: chỉ công khai, mô phỏng, hoặc đã ẩn danh. Không dùng điểm / MSSV / hồ sơ thật.

Nguồn gom từ: [EDU-14-Campus-24-7.md](EDU-14-Campus-24-7.md) mục 10, [LY-DO-CHON-EDU-14.md](LY-DO-CHON-EDU-14.md) mục 3.

---

## 1. Tài liệu RAG (KB demo)

Index PDF vào vector DB — không fine-tune.

Nguồn VinUni public: [policy.vinuni.edu.vn/student-affairs](https://policy.vinuni.edu.vn/student-affairs/) (nhiều file ghi *Security Classification: Public*).

| Tài liệu | Link |
|---|---|
| Quy chế đào tạo ĐH tín chỉ | [Academic Regulations](https://policy.vinuni.edu.vn/all-policies/academic-regulations-for-full-time-undergraduate-programs/) |
| Quy chế công tác SV / Code of Conduct | [VU_CTSV02](https://policy.vinuni.edu.vn/all-policies/student-affairs-regulations-code-of-conduct/) |
| Academic Integrity | [VUNI.14](https://policy.vinuni.edu.vn/all-policies/student-academic-integrity/) |
| Tài chính / biểu phí SV | [VU_TS03](https://policy.vinuni.edu.vn/all-policies/financial-regulations-and-tariff-for-student-2/) |
| Student Handbook | [PDF 2020](https://vinuni.edu.vn/wp-content/uploads/2020/10/201001_VinUni_Undergraduate_Student_Handbook.pdf) |
| Student Guide 2024–2025 | [PDF](https://vinuni.edu.vn/wp-content/uploads/2020/07/STUDENT-GUIDE-2024-2025.pdf) |
| Ký túc xá, khiếu nại, học bổng, internship… | [Danh sách Student Affairs](https://policy.vinuni.edu.vn/student-affairs/) |

Kế hoạch: **8–12 PDF** đủ demo. Cắt theo điều/mục, gắn `doc_id` + `Điều X` để citation.

Có thể thêm quy chế public trường khác nếu muốn KB đa nguồn — ghi rõ nguồn, đừng trộn thành “quy chế VinUni”.

---

## 2. Dataset public để eval RAG

Dùng đo retrieval, không nhồi vào trọng số model.

| Dataset | Phù hợp EDU-14 | Lấy ở đâu |
|---|---|---|
| **ViRHE4QA** (ưu tiên số 1) | 9.758 Q–A tiếng Việt về quy chế đào tạo ĐH — cùng bài toán | [github.com/DoPhamPhucTinh/R2GQA](https://github.com/DoPhamPhucTinh/R2GQA) (`ViRHE4QA.zip`) · [arXiv:2409.02840](https://arxiv.org/abs/2409.02840) |
| **SyllabusQA** | 63 syllabus thật + 5.078 Q–A logistics môn | [github.com/umass-ml4ed/SyllabusQA](https://github.com/umass-ml4ed/SyllabusQA) · [ACL 2024](https://aclanthology.org/2024.acl-long.557/) |
| **UIT-CourseInfo** | ~4.230 mẫu tóm tắt môn / CTĐT UIT, tiếng Việt | [huggingface.co/datasets/PhucDanh/UIT-CourseInfo](https://huggingface.co/datasets/PhucDanh/UIT-CourseInfo) |
| **UIT-VSFC** | ~16k feedback SV tiếng Việt (giảng viên / CTĐT / CSV) | [huggingface.co/datasets/uitnlp/vietnamese_students_feedback](https://huggingface.co/datasets/uitnlp/vietnamese_students_feedback) |

Cách dùng:

- **ViRHE4QA:** 100–200 câu làm bộ vàng. Hỏi → retrieve → so đoạn/đáp (recall@5, faithfulness). License **research only**, ghi citation, không thương mại. Không trộn thành quy chế VinUni.
- **SyllabusQA:** luyện pipeline RAG + Fact-QA tiếng Anh; không trộn vào KB VinUni.
- **UIT-CourseInfo:** tham khảo tiếng Việt; không thay PDF VinUni.
- **UIT-VSFC:** không phải FAQ. Dùng phân loại intent (`facility` → ticket CSV, `training_program` → RAG quy chế).

---

## 3. Ticket / độ ưu tiên (tool + HITL)

Không có ticket VinUni public (PII). Dùng synthetic. **Không** index vào RAG.

| Dataset | Việc |
|---|---|
| [University Student Support Ticket](https://www.kaggle.com/datasets/liamyyc/university-student-support-ticket-dataset) | 5.000 query SV, priority, 7 phòng ban |
| [Student Support Ticket Priority](https://www.kaggle.com/datasets/sgargi/student-support-ticket-priority-prediction-dataset) | 5.000 query helpdesk trường |

Dùng ý tưởng câu hỏi và nhãn `lookup` / `ticket` / `urgent`. Viết lại tiếng Việt, map phòng VinUni (Registrar, Student Affairs, Residential, IT).

Cần khoảng **80–100 ticket giả**.

Mẫu ticket tự sinh:

```json
{
  "id": "T-041",
  "user": "sv001",
  "text": "Em cần giấy xác nhận SV nộp visa, hạn thứ Sáu",
  "intent": "create_ticket",
  "category": "registrar",
  "priority": "high",
  "hitl": true
}
```

---

## 4. Data tool (lịch, phòng) — tự giả lập

Không có public “phòng họp VinUni”. Một JSON là đủ:

- 20 phòng (tòa A/B, sức chứa, giờ mở)
- 30 SV ẩn danh `sv001…`
- 2 tuần lịch học giả
- 15 slot trống/bận

Đề cho phép mô phỏng. Mức cơ bản không đòi Canvas thật.

---

## 5. Bộ eval tự làm (bắt buộc)

Public không thay bộ test bám PDF VinUni của nhóm. Đây là dataset quyết định PLO 7.

| Nhóm | Số câu | Ví dụ |
|---|---|---|
| RAG có nguồn | 40 | “Xin giấy xác nhận SV cần gì?” → Điều X, file Y |
| Không có trong tài liệu | 10 | Chính sách không tồn tại → “chưa có nguồn” |
| Tool | 20 | Đặt phòng, tạo ticket, hết slot |
| An toàn / HITL | 15 | Sửa điểm, wellbeing, prompt injection |

---

## 6. Không lấy

- Điểm, MSSV, email, hồ sơ thật
- Log chatbot trường (nếu chưa ẩn danh + được phép)
- Fine-tune trên Wikipedia / tin tức
- Kaggle ticket nhét vào vector DB như thể quy chế

---

## 7. Việc data tuần 1

1. Tải 8–12 PDF từ `policy.vinuni.edu.vn` + handbook.
2. Tải [ViRHE4QA.zip](https://github.com/DoPhamPhucTinh/R2GQA).
3. Cắt PDF theo điều; viết 40 câu eval bám đúng điều đó.
4. 30 ticket JSON + 20 phòng.
5. (Tuỳ chọn) UIT-VSFC để thử phân loại chủ đề.

Kế hoạch data cuối tuần: 8–12 PDF VinUni + `ViRHE4QA.zip` + 30 ticket JSON.
