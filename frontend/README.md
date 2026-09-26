# Campus 24/7 — Prototype Dịch vụ Học vụ & Sinh viên

Hệ thống Trợ lý Ảo và Xử lý Yêu cầu Dịch vụ Học vụ (Cấp Giấy chứng nhận, Bảng điểm, Tiếp nhận Khiếu nại).

## Khởi chạy nhanh (Quick Start)

```bash
# 1. Cài đặt thư viện
npm install

# 2. Khởi chạy máy chủ phát triển
npm run dev
```

Mở trình duyệt: **[http://localhost:3000](http://localhost:3000)**

---

## Cấu trúc các phân hệ trong nhánh này

- `/chat`: Cổng Trợ lý AI Sinh viên (hỗ trợ tạo đơn, điền thông tin tự động, quản lý lịch sử phiên chat).
- `/my-requests`: Danh sách yêu cầu học vụ và khiếu nại của sinh viên (sinh viên có thể xem chi tiết và chỉnh sửa khiếu nại).
- `/dashboard`: Bàn làm việc của Cán bộ Học vụ (OF001 - ThS. Trần Thu Hà) để tiếp nhận, xử lý và phê duyệt hồ sơ.
- `/tickets/[ticketId]`: Chi tiết hồ sơ yêu cầu học vụ.

---

## Lưu ý về nhánh phát triển

- Nhánh này (`feat/prototype-ver2`): Tập trung vào nghiệp vụ **Dịch vụ Học vụ & Khiếu nại của Sinh viên**.
- Nhánh mở rộng (`feat/facility-materials`): Chứa phân hệ mở rộng quản lý **Cơ sở vật chất, Vật tư xuất/hoàn kho & Hóa đơn thuê ngoài**.

