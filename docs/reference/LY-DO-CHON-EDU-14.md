# Vì sao EDU-14 là đề tốt nhất trong 5 đề đang cân

Năm đề: **EDU-14**, **ITOPS-01**, **BO-02**, **PTNT-02**, **VIN-01**.

Kết luận: **EDU-14 Campus 24/7** là lựa chọn cân nhất cho team khóa học — không được cấp data, phải lấy open source, cần RAG + agent + HITL + demo trong thời gian khóa, BTC ưu tiên giáo dục.

Chi tiết từng đề: [EDU-14](EDU-14-Campus-24-7.md) · [ITOPS-01](ITOPS-01-ITSM-Triage.md) · [BO-02](BO-02-HR-Helpdesk.md) · [PTNT-02](PTNT-02-Orchestrate-da-dich-vu.md) · [VIN-01](VIN-01-Da-tac-tu-CTDT.md).

---

## 1. Kết luận ngắn

EDU-14 thắng vì **cùng lúc** đủ sáu thứ các đề kia chỉ được một phần:

| Nhu cầu team / khóa | EDU-14 | ITOPS-01 | BO-02 | PTNT-02 | VIN-01 |
|---|:---:|:---:|:---:|:---:|:---:|
| Open source dùng **đúng đề**, ít viết tay | **Có** | Ticket Anh, SOP phải viết | Handbook phải viết | Tool-call nhiều, domain Vin = 0 | Không có bộ CTĐT vàng |
| RAG có nguồn (hướng team) | **Lõi** | Phụ (runbook) | Lõi | Mỏng | Rubric PDF |
| Agent có tool | Ticket + đặt phòng | **Mạnh** (đóng/route) | Yếu (chỉ escalate) | **Mạnh** (4 API) | Tool chấm AUN |
| HITL + eval + an toàn | Handover tâm lý/điểm | P1/VIP/prod | Lương/kỷ luật | Duyệt từng bước tiền | Ban hành CTĐT |
| Demo 8 phút chắc, tuần 3 đã show | **Có** | Có | Có | Dễ kẹt mock API | Dễ thành “AI viết giáo án” |
| Ưu tiên giáo dục (BTC) | **Đúng** | VSF IT | VSF HR | Siêu app VSF | VinUni nhưng đắt AUN-QA |
| Chia 4 người song song | **Đều** | Đều | Cần “chủ handbook” | Dễ 1 người ôm saga | Lệch prompt vs web |

ITOPS-01 và BO-02 **làm được**, gần điểm. PTNT-02 và VIN-01 **hay ý tưởng**, thua data + phạm vi khóa.

---

## 2. Năm tiêu chí đánh giá đề (team đã chốt)

Giả định: 4–5 người, Python/web, không hardware, ~7 tuần, **không được cấp data nội bộ**.

Thang 1–5. 5 = khớp đề + làm được trong khóa.

| Tiêu chí | EDU-14 | ITOPS-01 | BO-02 | PTNT-02 | VIN-01 |
|---|---:|---:|---:|---:|---:|
| 1. Năng lực & định hướng | 5 | 4 | 4 | 3 | 2 |
| 2. Deploy + demo trong khóa | 5 | 5 | 5 | 3 | 3 |
| 3. Data / tài liệu / tool / hạ tầng | 5 | 5 | 4 | 4 | 3 |
| 4. Agent + HITL + eval + an toàn | 5 | 5 | 5 | 5 | 4 |
| 5. Phạm vi & chia việc | 5 | 5 | 5 | 3 | 3 |
| **Tổng** | **25** | **24** | **23** | **18** | **15** |

Sau khi siết tiêu chí **open source khớp đề** (mục 3), khoảng cách EDU-14 vs ITOPS-01/BO-02 **nới ra**: ticket/runbook/handbook vẫn phải tự soạn nhiều; EDU-14 tải PDF VinUni + ViRHE4QA là chạy RAG được.

---

## 3. Data open source — lý do quyết định

Team không được cấp data. “Dễ kiếm” = tải về **dùng đúng đề**, không phải “Hugging Face nhiều file”.

| Hạng | Đề | Tải được ngay | Phải viết tay | Khớp đề |
|---:|---|---|---|---|
| 1 | **EDU-14** | [Policy VinUni public](https://policy.vinuni.edu.vn/student-affairs/) + [ViRHE4QA 9.758 Q–A quy chế ĐH tiếng Việt](https://github.com/DoPhamPhucTinh/R2GQA) | Vài chục ticket/phòng JSON | Cao nhất |
| 2 | ITOPS-01 | Ticket IT synthetic (HF/Kaggle, chủ yếu tiếng Anh) | Runbook SOP tiếng Việt + gán nhãn lại | Đúng ITSM, lệch ngôn ngữ/công ty |
| 3 | PTNT-02 | xLAM, Glaive, τ-bench (tool-call) | Cả 4 API + kịch bản chuyển nhà | Đúng kỹ năng, **sai domain** |
| 4 | BO-02 | Bộ luật Lao động (cổng pháp luật) | Cả handbook công ty 8–12 PDF | Không có “ViRHE4QA cho HR” |
| 5 | VIN-01 | AUN-QA PDF, UIT-VSFC, syllabus lẻ | Cả CTĐT vàng + ma trận CLO | Không có bộ mục tiêu → CTĐT đúng |

EDU-14 là đề duy nhất có **cả KB lẫn bộ eval RAG tiếng Việt đúng bài toán** đã nằm trên internet.

Kế hoạch data cuối tuần EDU-14: 8–12 PDF VinUni + `ViRHE4QA.zip` + 30 ticket JSON.

---

## 4. Khớp hướng kỹ thuật team (RAG + agent)

Team quan tâm RAG và agent có tool. EDU-14 **gộp cả hai trong một vòng user**, không phải chọn một:

```text
SV hỏi
  → tra cứu  → RAG + citation + từ chối nếu thiếu nguồn
  → hành động → tool tạo ticket / đặt phòng (có xác nhận)
  → nhạy cảm → handover cán bộ (HITL)
```

- **BO-02** = gần như chỉ nửa RAG (escalate, ít tool).
- **ITOPS-01** = nửa agent hành động (F1, đóng/route); RAG chỉ là runbook phụ.
- **PTNT-02** = agent orchestration mạnh, RAG gần như không.
- **VIN-01** = multi-agent LLM, RAG rubric; không phải trợ lý người dùng cuối hàng ngày.

Một đề, ba luồng đóng (hỏi / làm / chuyển người) = đủ PLO 1, 3, 6, 7 mà không overbuild.

---

## 5. Demo, chia việc, ưu tiên BTC

**Demo 8 phút EDU-14** không phụ thuộc AUN-QA hay saga:

1. 21h xin giấy xác nhận → trả lời + Điều 12.  
2. Tạo ticket, SV xác nhận, cán bộ duyệt.  
3. Đặt phòng hết slot → gợi ý giờ khác.  
4. Câu mệt/muốn nghỉ học → không tư vấn, handover.  
5. Bảng eval citation + ca cấm.

**Chia 4 người:** UI chat · RAG · ticket/HITL · eval+deploy — việc tuần 2 đã tách được. PTNT-02 dễ một người ôm state machine; VIN-01 dễ hai người prompt, hai người web ngồi chờ schema.

**BTC:** danh mục ghi giáo dục ưu tiên đầu. EDU-14 đúng khối vận hành trường, user là SV/cán bộ. ITOPS/BO/PTNT là VSF nội bộ — làm được nhưng cửa “đúng hướng khóa” kém hơn. VIN-01 đúng VinUni nhưng đắt năng lực nghiệp vụ.

---

## 6. Vì sao không chọn bốn đề kia làm đề chính

**ITOPS-01 (24 điểm)** — đề “về nhì” tốt nhất. Agent triage đẹp, F1 đo được. Trượt nhẹ: không ưu tiên giáo dục; SOP/ticket tiếng Việt **không có open**; team phải dịch/gán nhãn. Chọn nếu team tuyên bố không muốn làm sản phẩm trường.

**BO-02 (23)** — RAG chuẩn, cùng pattern EDU-14. Trượt: handbook HR tập đoàn không public; không có dataset Q–A HR tiếng Việt cỡ ViRHE4QA. Làm BO-02 là làm EDU-14 nhưng **tự viết hết KB**.

**PTNT-02 (18)** — demo rollback đẹp, public tool-call nhiều. Trượt tiêu chí 2, 3 (khớp đề), 5: mock 4 API, HITL từng bước tiền, saga. Open source không thay data “căn hộ + xe + khám + ví”.

**VIN-01 (15)** — PLO 2 rõ, đúng VinUni. Trượt: không dataset train/eval CTĐT; cần người hiểu AUN-QA; eval mềm; dễ bị chê chatbot giáo án. Open source chỉ là PDF rubric + feedback sentiment.

Không làm hai đề song song: 7 tuần chỉ đủ đóng **một** vòng user đến nơi.

---

## 7. EDU-14 vẫn đủ nghiệm thu khóa

Quy định chung: web deploy, ≥ 2 vai trò, workflow agentic + tool-use, HITL việc rủi ro, eval, data public/mô phỏng.

| Yêu cầu khóa | Chỗ có trong EDU-14 |
|---|---|
| 2 vai trò | SV / cán bộ hỗ trợ |
| RAG không naive | Retrieve, rerank, citation, refuse |
| Tool-use | `search_docs`, `create_ticket`, `book_room`, `get_schedule` |
| HITL | SV confirm hành động; cán bộ ca nhạy cảm / giấy tờ |
| An toàn | Cấm tự quyết điểm, lương học bổng, tư vấn tâm lý |
| Eval | 50 RAG + 20 tool + 15 an toàn (bám PDF thật) |
| Data hợp lệ | Public + mô phỏng; không hồ sơ SV thật |

PLO2 nhiều LLM **không bắt buộc** ở đề này. Một router + tool là phạm vi đúng, không phải thiếu.

---

## 8. Quyết định

Chốt **EDU-14**.

- Muốn lệch sang IT thuần → dự phòng **ITOPS-01** (chấp nhận tự viết SOP).  
- Không chuyển PTNT-02 / VIN-01 trừ khi đã có người backend saga hoặc người AUN-QA **và** chấp nhận tự tạo gần như toàn bộ data.

Tài liệu triển khai: [EDU-14-Campus-24-7.md](EDU-14-Campus-24-7.md) (PRD, quy trình, demo, dataset tuần 1).
