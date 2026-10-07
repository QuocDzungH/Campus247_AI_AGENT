# Campus 24/7 — RAG Evaluation Report

- **Dataset Version**: `rag-eval-v1`
- **RAG Mode**: `offline-pipeline-fake-embedding+bm25`
- **Index Version**: `vinuni-hybrid-21a68b99259e`
- **Total Scenarios**: `18`
- **Timestamp**: `2026-10-07T08:33:27.423752+00:00`

## 1. Retrieval Performance (In-Domain, N = 12)
- **Recall@3**: `25.00%`
- **Recall@5**: `41.67%`
- **Precision@5**: `25.00%`
- **MRR (Mean Reciprocal Rank)**: `0.2917`

## 2. Citation Integrity
- **Total Citations Evaluated**: `15`
- **Citation Validity Rate**: `100.00%` (Trích dẫn tồn tại trong index)
- **Citation Support Rate**: `6.67%` (Trích dẫn đúng tài liệu liên quan)

## 3. Abstention & Anti-Hallucination (OOD Guard)
- **OOD Abstention Accuracy**: `50.00%` (N = 4)
  *(Khả năng nhận biết câu hỏi ngoài phạm vi và từ chối bịa đặt)*
- **False Abstention Rate**: `58.33%` (N = 12)
  *(Tỷ lệ từ chối nhầm các câu hỏi có trong tài liệu)*

## 4. Latency
- **p50 Latency**: `2.5 ms`
- **p95 Latency**: `4.8 ms`
- **Mean Latency**: `2.8 ms`
