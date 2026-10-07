# Contract P0 v1 — điểm bắt đầu cho cả nhóm

Contract giao tiếp đã chốt. Các endpoint ở đây là mục tiêu triển khai, không phải danh sách API đã hoạt động.

| Thành phần | File chuẩn | Cách dùng |
|---|---|---|
| Quyết định nghiệp vụ, lỗi và quyền ghi | [Quy ước P0](../Quy-uoc-ky-thuat-P0-va-phan-cong.md) | Đọc mục 13–19 khi triển khai tích hợp |
| Kiểu dữ liệu và cross-field validation | [contracts_v1.py](../../backend/src/campus247/models/contracts_v1.py) | Import trực tiếp vào RAG/Agent/Backend |
| Interface async | [ports_v1.py](../../backend/src/campus247/models/ports_v1.py) | Người 1 implement RagPort; người 2 implement AgentPort |
| HTTP contract | [p0-v1.openapi.json](p0-v1.openapi.json) | Người 3 implement API; người 4 sinh types/client hoặc dựng adapter/mock |
| Dữ liệu mẫu | [p0-v1.examples.json](p0-v1.examples.json) | Dùng chung payload trong mock và test |

Frontend + DevOps do người 4 phụ trách. Người 3 vẫn sở hữu logic workflow, migration, worker và retry ứng dụng. Không cần gán tên người vào contract.

## Kiểm chứng và cập nhật

Từ thư mục gốc repository, với môi trường Python đã cài requirements:

```bash
.venv/bin/python -m scripts.export_contracts_v1 --check
.venv/bin/pytest backend/tests/test_contracts/ -q --rootdir=backend
```

Artifact JSON được sinh tự động; không sửa tay. Khi thay đổi contract đã được thống nhất:

```bash
.venv/bin/python -m scripts.export_contracts_v1
```

PR phải bao gồm schema, artifact và fixture cập nhật. OpenAPI mô tả kiểu và endpoint; validator Pydantic kiểm tra thêm quan hệ giữa các field. Kiểm tra quyền, nguồn citation, commit DB, lock và chống trùng vẫn phải được implement ở runtime.

Fixture chứa dữ liệu giả lập. Token, ID, nguồn và điểm retrieval minh họa không có hiệu lực trên hệ thống thật. Các ví dụ không chứng minh AI đã tìm được nguồn hoặc backend đã lưu ticket.

## Bắt đầu song song

1. RAG: dùng RagRequest/RetrievalRequest, trả RagResult/RetrievalResult đúng schema.
2. Agent: dùng RagPort giả lập, implement routing/intake và OfficerBrief bằng schema chung.
3. Backend: implement endpoint theo OpenAPI, dùng kết quả agent giả lập để test quyền và transaction.
4. Frontend + DevOps: dựng API adapter/mock từ OpenAPI và examples, đồng thời thiết lập CI/môi trường demo.

Lần tích hợp đầu tiên: chat L1 → tiếp theo L2/Submit 1/L3/Submit 2 → cuối cùng L4 và các ca lỗi. Mỗi nhóm phải chạy fixture/test trước khi nối module thật.
