# Báo cáo Đánh giá (Evaluation Report) - VinUni Student Services RAG

## 1. Pipeline Configuration
- **Corpus**: 11 tài liệu quy chế/hướng dẫn sinh viên VinUni đã tiền xử lý tại `RAG/data/processed/` (422 chunks).
- **Index Version**: `vinuni-hybrid-21a68b99259e` (422 chunks metadata-indexed).
- **Mô hình Embedding**:
  - Offline mode: deterministic hashed embedding + BM25 + RRF; đây chỉ là plumbing baseline.
  - Live mode: Gemini embedding theo cấu hình runtime (yêu cầu API key).
- **Mô hình Sinh văn bản (LLM)**: chưa được đo trong report offline này.
- **Chiến lược Retrieval**: Hybrid Search (Dense Vector + BM25) với Reciprocal Rank Fusion (RRF).
- **Chunking**: Markdown-aware Header Splitter + TextChunker (chunk_size=500, chunk_overlap=50).

## 2. Benchmark Dataset (`eval/rag/dataset.jsonl`)
Thay thế tập `golden_qa.json` 15 câu cũ (chứa dữ liệu giả không có căn cứ như mức phí 100k, giờ giới nghiêm 11:30 PM) bằng tập benchmark kiểm chứng được gồm **60 kịch bản**:
- **40 In-Domain Scenarios**: Dựa trên bằng chứng văn bản cụ thể từ 11 file quy chế VinUni (học phí, học bổng, ký túc xá, phúc khảo điểm, thư viện, bảo hiểm, kỷ luật...).
- **15 Out-of-Domain Scenarios**: Các câu hỏi không thuộc phạm vi quy chế (vé máy bay, ẩm thực, thi chứng chỉ lái xe, chính sách trường khác...) để kiểm tra năng lực chống ảo giác (Anti-Hallucination & Abstention).
- **5 Boundary / Ambiguous Scenarios**: Các câu hỏi thiếu ngữ cảnh hoặc mâu thuẫn để đo lường khả năng yêu cầu làm rõ (Clarification).
- **Phân chia split**: 42 tune / 18 holdout (chống rò rỉ dữ liệu cùng family).

## 3. Kết quả và giới hạn hiện tại

Các số liệu cũ đã bị rút lại: runner cũ coi mọi RRF score thấp hơn `0.25` là
abstention, dù `answer_question()` vẫn có thể trả `answered`. Runner hiện tại
đo status thực tế của `RagPort.answer_question()`, citation theo `chunk_id` và
chỉ báo Recall@3/Recall@5 vì production trả tối đa 5 passages.

Chạy `make test-eval-rag` để tạo [report JSON](../../../eval/results/rag_eval_report.json)
và Markdown hiện tại trên tập holdout. Gate sẽ fail khi metric không đạt; kết quả
fail là tín hiệu cần sửa retrieval/grounding, không phải lý do để nới ngưỡng.

## 4. Live Evaluation & RAG Triad (chưa chạy)

Khi có API key Gemini, pipeline có thể chạy retrieval hybrid:
1. Dense Retrieval (Embeddings): Nâng cao Recall@5 cho các câu hỏi paraphrase/tiếng lóng/không dấu.
2. LLM Reranking & Synthesis: Sinh câu trả lời kèm citation span.
3. LLM Judge Triad (Faithfulness, Answer Relevance, Context Precision) đo lường bằng Ragas hoặc evaluator độc lập.

## 5. Khuyến nghị
1. Cải thiện retrieval dựa trên các ca holdout fail, rồi chạy lại cùng dataset/scorer.
2. Chạy live hybrid và một evaluator grounding riêng trước khi công bố faithfulness.
