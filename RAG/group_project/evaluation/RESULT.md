# Báo cáo Đánh giá (Evaluation Report) - VinUni Student Services RAG

## Pipeline Configuration
- **Mô hình Embedding**: text-embedding-ada-002 / bge-m3
- **Mô hình Sinh văn bản (LLM)**: gpt-3.5-turbo / gpt-4o-mini
- **Chiến lược Retrieval**: Hybrid Search (Dense + BM25) với RRF (Reciprocal Rank Fusion)
- **Chunking**: RecursiveCharacterTextSplitter (chunk_size=500, chunk_overlap=50)

## Metrics
Kết quả đánh giá trên tập dữ liệu `golden_qa.json` (15 câu hỏi):

| Metric | Score | Mô tả |
|--------|-------|-------|
| **Faithfulness** | N/A | Khả năng câu trả lời trung thành với ngữ cảnh truy xuất |
| **Answer Relevance** | N/A | Mức độ liên quan của câu trả lời với câu hỏi gốc |
| **Context Recall** | N/A | Tỉ lệ thông tin cần thiết có trong ngữ cảnh được truy xuất |
| **Context Precision** | N/A | Khả năng xếp hạng ngữ cảnh hữu ích lên đầu |

*(Chờ kết quả chạy đánh giá tự động bằng Ragas/TruLens)*

## A/B Comparison: Dense-only vs Hybrid+RRF

| Phương pháp | Top-K | Context Recall | Faithfulness | Nhận xét |
|-------------|-------|----------------|--------------|---------|
| Dense-only  | 3     | N/A            | N/A          | Tốt cho truy vấn ngữ nghĩa, nhưng yếu với các từ khóa mã số cụ thể |
| Hybrid+RRF  | 3     | N/A            | N/A          | Cân bằng tốt giữa ngữ nghĩa và từ khóa chính xác |

## Sample Results

| Câu hỏi | Câu trả lời (Pipeline) | Đánh giá |
|---------|------------------------|----------|
| Làm thế nào để xin bảng điểm chính thức? | [Kết quả sinh ra] | [Tốt/Khá/Cần cải thiện] |
| Hạn chót để nộp đơn phúc khảo điểm là khi nào? | [Kết quả sinh ra] | [Tốt/Khá/Cần cải thiện] |

## Conclusion
[Placeholder: Nhận xét tổng quan về hiệu năng của hệ thống RAG, các điểm mạnh và các vấn đề cần khắc phục trong tương lai (ví dụ: cần cải thiện retrieval cho các câu hỏi phức tạp hơn, thêm bộ lọc metadata...)]
