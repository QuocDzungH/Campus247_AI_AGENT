# Campus 24/7 — Comprehensive Benchmark Suite

Hệ thống đánh giá độc lập, có thể kiểm toán toàn diện cho AI Agent và RAG Pipeline của dự án Campus 24/7.

Bộ công cụ này được thiết kế để **đo đúng năng lực thực tế**, phát hiện hồi quy (regression) và ngăn chặn việc làm đẹp điểm số bằng cách nới lỏng tiêu chí chấm hay gán nhãn theo output sai của hệ thống.

---

## 1. Cấu trúc Thư mục

```
eval/
├── README.md                      # Tài liệu tổng quan (file này)
├── quality_gate.py                # Regression gate kiểm tra các ngưỡng chất lượng nghiêm ngặt
├── agent/
│   ├── README.md                  # Hướng dẫn chi tiết đánh giá Agent
│   ├── dataset.jsonl              # 180 kịch bản kiểm thử Agent (L1, L2, L3, L4)
│   └── run_eval.py                # Runner deterministic và live CampusAgent
├── rag/
│   ├── dataset.jsonl              # 60 kịch bản kiểm thử RAG (In-domain, OOD, Boundary)
│   └── run_rag_eval.py            # Runner đánh giá RAG (BM25 lexical, Hybrid, Citation, OOD)
├── tools/
│   └── build_datasets.py          # Script sinh và chuẩn hóa dataset có kiểm toán
└── results/
    ├── baseline_initial.json      # Kết quả chạy gốc trước khi chuẩn hóa nhãn
    ├── baseline_normalized.json   # Baseline sau khi chuẩn hóa nhãn nghiệp vụ
    ├── agent_eval_report.json     # Báo cáo chi tiết Agent (JSON)
    ├── agent_eval_report.md       # Báo cáo tóm tắt Agent (Markdown)
    ├── rag_eval_report.json       # Báo cáo chi tiết RAG (JSON)
    ├── rag_eval_report.md         # Báo cáo tóm tắt RAG (Markdown)
    └── SUMMARY.md                 # So sánh Before / After và phân tích kỹ thuật
```

---

## 2. Quy tắc Nghiệp vụ & Chuẩn hóa Nhãn

Trong quá trình xây dựng benchmark, các mâu thuẫn giữa dataset cũ và tài liệu Gate 2 / Code production đã được đối chiếu và xử lý:

1. **Phúc khảo điểm & Khiếu nại học tập cá nhân**:
   - *Nhãn cũ*: Gán nhãn sai thành L4 handover ngay lập tức.
   - *Quy chuẩn Gate 2 & Production*: Khiếu nại điểm thông thường đi qua **L2 `academic_complaint`** để sinh viên điền thông tin và xác nhận preview (chưa tạo ticket trước khi sinh viên bấm Submit 1).
   - *L4 Handover*: Dành riêng cho **khủng hoảng tâm lý / wellbeing** (trầm cảm, kiệt sức, tự hại) và **yêu cầu vi phạm quy chế / vượt thẩm quyền** (đòi sửa điểm trực tiếp, hack token, tra cứu điểm người khác).

2. **Dữ liệu RAG Golden**:
   - Tập `golden_qa.json` 15 câu cũ chứa thông tin giả định không có trong văn bản (phí thẻ SV 100k, giờ giới nghiêm 11:30 PM).
   - Đã được thay thế hoàn toàn bằng `eval/rag/dataset.jsonl` (60 câu) xây dựng trên 422 chunks văn bản quy chế sinh viên VinUni tại `RAG/data/processed/`.
   - Bổ sung 15 câu Out-of-Domain (OOD) bắt buộc hệ thống phải trả lời `insufficient_evidence`, không được bịa đặt quy chế.

---

## 3. Bộ Dữ liệu (Datasets)

### Agent Dataset (`eval/agent/dataset.jsonl`) — 180 Scenarios
- **L1 (40 câu)**: Thủ tục chung, câu hỏi thiếu thông tin, hỏi mơ hồ, câu phủ định.
- **L2 (60 câu)**: Đơn xin cấp giấy xác nhận (`student_status_cert`), khiếu nại điểm (`academic_complaint`), thiếu trường, sửa thông tin đa lượt, xóa/đổi loại đơn.
- **L4 (40 câu)**: Khủng hoảng tâm lý (Wellbeing: 20 câu) và yêu cầu vượt thẩm quyền / prompt injection (Unauthorized Action: 20 câu).
- **L3 (40 câu)**: Officer Brief provenance, xử lý mâu thuẫn, missing-field recall, lọc prompt injection trong nguồn, bảo toàn draft cán bộ.
- **Split**: 117 `tune` / 63 `holdout` (chia theo scenario family để tránh rò rỉ dữ liệu).

### RAG Dataset (`eval/rag/dataset.jsonl`) — 60 Scenarios
- **In-Domain (40 câu)**: Có trích dẫn cụ thể (locator/quote) từ 11 file quy chế VinUni.
- **Out-of-Domain (15 câu)**: Câu hỏi ngoài phạm vi để kiểm tra năng lực chống ảo giác (Anti-Hallucination).
- **Boundary (5 câu)**: Câu hỏi ranh giới, cần làm rõ thông tin.
- **Split**: 42 `tune` / 18 `holdout`.

---

## 4. Hướng dẫn Chạy Benchmark

### Chạy toàn bộ Benchmark Suite & Quality Gate (Khuyến nghị)
```bash
make benchmark
```
Lệnh này sẽ thực hiện lần lượt:
1. `make test-eval-agent`: Chạy runner Agent, lưu kết quả JSON & Markdown.
2. `make test-eval-rag`: Chạy runner RAG, lưu kết quả JSON & Markdown.
3. Chạy `eval/quality_gate.py`: Kiểm tra toàn bộ các ngưỡng hồi quy. Trả về exit code `0` nếu đạt, `1` nếu có lỗi.

### Chạy kiểm thử từng thành phần
```bash
# Chạy Agent eval trên tập Tune
.venv/bin/python eval/agent/run_eval.py --split tune

# Chạy Agent eval trên tập Holdout
.venv/bin/python eval/agent/run_eval.py --split holdout

# Chạy RAG eval
.venv/bin/python eval/rag/run_rag_eval.py

# Kiểm tra Quality Gate
.venv/bin/python eval/quality_gate.py
```

### Chế độ Live Evaluation
Khi cần đánh giá agent LLM thực tế qua API:
```bash
export AGENT_MODE=langgraph
export LLM_PROVIDER=google
export GEMINI_API_KEY="your-api-key"
.venv/bin/python eval/agent/run_eval.py --live --split holdout
```
Lệnh gọi `CampusAgent` end-to-end và từ chối với exit code `2` nếu thiếu cấu hình
LangGraph hoặc provider. L1 trong live agent runner dùng `StubRag`; chạy RAG
runner riêng để đo retrieval và grounding.

---

## 5. Tiêu chuẩn Quality Gate

| Tiêu chí | Ngưỡng bắt buộc | Kết quả hiện tại | Trạng thái |
|----------|-----------------|------------------|------------|
| **L4 Safety False Negatives** | `= 0` | holdout-only | xem report mới |
| **L2 Field Extraction Accuracy** | `>= 85.00%` | holdout-only | xem report mới |
| **RAG Citation Support** | `>= 80.00%` | holdout-only | xem report mới |
| **RAG OOD Abstention Accuracy** | `>= 85.00%` | holdout-only | xem report mới |
| **RAG False Abstention** | `<= 20.00%` | holdout-only | xem report mới |
