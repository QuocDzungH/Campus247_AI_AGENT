/** Display labels for stored field keys and enums. Does not rename DB values. */

export const FIELD_LABELS: Record<string, string> = {
  student_name: "Tên sinh viên",
  full_name: "Tên sinh viên",
  fullName: "Tên sinh viên",
  name: "Tên sinh viên",
  source: "Nguồn dữ liệu",
  mssv: "Mã số sinh viên",
  email: "Email",
  purpose: "Mục đích xin giấy",
  destination_org: "Cơ quan/đơn vị nhận",
  destinationOrg: "Cơ quan/đơn vị nhận",
  receive_method: "Hình thức nhận",
  receiveMethod: "Hình thức nhận",
  class_year: "Lớp/khóa",
  classYear: "Lớp/khóa",
  cohort: "Khóa",
  major: "Ngành",
  faculty: "Khoa",
  student_status: "Tình trạng học tập",
  studentStatus: "Tình trạng học tập",
  verification_status: "Trạng thái xác minh",
  verificationStatus: "Trạng thái xác minh",
  summary: "Nội dung gốc",
  extras: "Trường bổ sung",
  documentType: "Loại tài liệu",
  document_type: "Loại tài liệu",
  copies: "Số bản",
  language: "Ngôn ngữ",
  notes: "Ghi chú",
  ticket_code: "Mã đơn",
  expectedGraduation: "Đề nghị ghi ngày tốt nghiệp dự kiến",
  programDetails: "Thông tin chương trình/trao đổi/thực tập",
  extraRequest: "Yêu cầu bổ sung",
  recipient: "Gửi PDF tới",
  recipientEmail: "Email người nhận",
  delivery: "Cách nhận bản giấy",
  recipientName: "Họ tên người nhận",
  recipientPhone: "Số điện thoại người nhận",
  address: "Địa chỉ đầy đủ",
  country: "Quốc gia",
  identity_match: "Đối chiếu danh tính",
  academic_status: "Tình trạng học tập",
  form_completeness: "Đầy đủ bản khai",
  financial_obligation: "Nghĩa vụ học phí",
};

export const ENUM_LABELS: Record<string, string> = {
  paper_stamped: "Bản giấy có đóng dấu",
  digital_pdf: "Bản điện tử PDF",
  imported: "Đã nhập vào hệ thống",
  unverified: "Chưa xác minh",
  officer_verified: "Đã được cán bộ xác minh",
  profile: "Hồ sơ sinh viên",
  student_message: "Thông tin sinh viên cung cấp",
  student: "Thông tin sinh viên cung cấp",
  policy: "Tài liệu quy định",
  tool_result: "Kết quả tra cứu",
  tool: "Kết quả tra cứu",
  operational_identities: "Hồ sơ nguồn đã nhập",
  sis: "Hệ thống quản lý đào tạo",
  khtc: "Hệ thống kế hoạch tài chính",
  identity: "Đối chiếu danh tính",
  none: "Chưa có",
  normal: "Bình thường",
  high: "Cao",
  open: "Chờ tiếp nhận",
  pending_officer: "Đang xử lý",
  resolved: "Đã hoàn tất",
  passed: "Đạt",
  failed: "Không đạt",
  insufficient: "Chưa đủ dữ liệu",
  error: "Lỗi nguồn",
  viewed: "Đã xem, chưa kết luận đạt",
  manual_pass: "Đối chiếu thủ công: đạt",
  manual_fail: "Đối chiếu thủ công: không đạt",
  not_configured: "Chưa có kết nối để kiểm tra tự động",
  connected: "Đã kết nối",
  unsigned: "Chưa ký số",
  pending_signature: "Chờ ký số",
  signed: "Đã ký số",
  ENR: "Xác nhận đang theo học",
  TNR: "Bảng điểm chính thức",
  RCM: "Thư hỗ trợ chương trình/trao đổi/thực tập",
  ENG: "Xác nhận chương trình học bằng tiếng Anh",
  GRD: "Xác nhận tốt nghiệp",
  CRS: "Danh sách học phần học kỳ hiện tại",
  bilingual: "Song ngữ Anh – Việt",
  english: "Tiếng Anh",
  self: "Email VinUni của tôi",
  pickup: "Nhận tại Registrar — phòng I114",
  shipping: "Yêu cầu chuyển phát",
  verified: "Đã xác minh",
  disputed: "Đang tranh chấp",
};

const ENUM_KEYS = new Set([
  "receive_method",
  "receiveMethod",
  "verification_status",
  "verificationStatus",
  "priority",
  "status",
  "student_status",
  "studentStatus",
  "documentType",
  "document_type",
  "language",
  "recipient",
  "delivery",
  "connector_status",
  "connectorStatus",
  "officer_resolution",
  "officerResolution",
  "signature_status",
  "signatureStatus",
]);

export function humanizeKey(key: string): string {
  const trimmed = key.replace(/^extras\./, "").replace(/[._]/g, " ").trim();
  if (!trimmed) return "Trường dữ liệu";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function fieldLabel(key: string, schemaLabel?: string | null): string {
  if (schemaLabel && schemaLabel.trim() && schemaLabel.trim() !== key) return schemaLabel.trim();
  const direct = FIELD_LABELS[key] || FIELD_LABELS[key.replace(/^extras\./, "")];
  if (direct) return direct;
  return humanizeKey(key);
}

export function enumLabel(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return ENUM_LABELS[value] ?? null;
}

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Chưa có nguồn";
  return ENUM_LABELS[source] || source;
}

export function formatStoredValue(key: string, value: string | null | undefined): string {
  if (value == null || value === "") return "Chưa có dữ liệu";
  const normalized = key.replace(/^extras\./, "");
  if (ENUM_KEYS.has(key) || ENUM_KEYS.has(normalized)) return ENUM_LABELS[value] || value;
  return value;
}

export function verificationStatusLabel(status: string | null | undefined): string {
  if (status === "officer_verified") return "Đã được cán bộ xác minh";
  if (status === "imported") return "Đã nhập vào hệ thống";
  if (status === "unverified") return "Chưa xác minh";
  if (status === "verified") return "Đã xác minh";
  if (status === "disputed") return "Đang tranh chấp";
  return status?.trim() ? status : "Chưa có dữ liệu";
}
