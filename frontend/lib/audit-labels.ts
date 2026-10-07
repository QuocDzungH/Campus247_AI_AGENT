import { fieldLabel } from "./field-labels";

const ACTION_LABELS: Record<string, string> = {
  create: "Sinh viên đã gửi đơn",
  handover: "Hồ sơ đã được bàn giao cho cán bộ",
  supplement: "Sinh viên đã bổ sung hồ sơ",
  respond: "Đã gửi phản hồi cho sinh viên",
  request_info: "Đã yêu cầu sinh viên bổ sung",
  resolve: "Đã hoàn tất xử lý hồ sơ",
  brief_ready: "AI đã hoàn tất bản tóm tắt hồ sơ",
  brief_failed: "AI chưa tạo được bản tóm tắt",
  claim: "Cán bộ đã nhận xử lý",
  workspace_update: "Đã cập nhật nội dung xử lý",
  attachment: "Đã đính kèm tệp vào hồ sơ",
  verification: "Đã thực hiện kiểm tra thông tin",
  review: "Đã ghi nhận kết quả kiểm tra",
  document_draft: "Đã lưu bản nháp giấy xác nhận",
  document_issue: "Đã tạo tài liệu hệ thống (chưa ký số, chưa phải giấy chính thức)",
  prepare: "Đã yêu cầu AI chuẩn bị hồ sơ",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function roleLabel(actorType: string | null | undefined): string {
  if (actorType === "officer") return "Cán bộ";
  if (actorType === "student") return "Sinh viên";
  return "Hệ thống";
}

export function looksLikeRawId(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^(usr_|OF-|SV-|of_|sv_|tkt_|req_|aud_)/i.test(value) || /^[a-z]+_[a-f0-9]{8,}$/i.test(value);
}

export function displayActorName(name: string | null | undefined, actorType?: string | null): string {
  if (name && !looksLikeRawId(name)) return name;
  return roleLabel(actorType);
}

export function auditActionLabel(action: string, details?: unknown): string {
  const data = asRecord(details);
  if (action === "document_issue") {
    const signature = typeof data?.signature_status === "string" ? data.signature_status : "";
    if (signature === "unsigned" || data?.official === false) {
      return "Đã tạo tài liệu hệ thống (chưa ký số, chưa phải giấy chính thức)";
    }
    if (signature === "pending_signature") return "Đã tạo tài liệu và chuyển chờ ký số";
    if (signature === "signed") return "Đã phát hành tài liệu đã ký số";
  }
  if (action === "verification") {
    const outcome = typeof data?.outcome === "string" ? data.outcome : "";
    if (outcome === "viewed") return "Cán bộ đã xem kết quả kiểm tra (chưa kết luận đạt)";
    if (outcome === "manual_pass") return "Cán bộ đã đối chiếu thủ công và ghi nhận đạt";
    if (outcome === "manual_fail") return "Cán bộ đã đối chiếu thủ công và ghi nhận không đạt";
  }
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (/[ \u00C0-\u024F]/.test(action)) return action;
  return fieldLabel(action);
}

export function auditTechnical(details: unknown, requestId?: string | null, action?: string | null): string | undefined {
  const parts: string[] = [];
  if (action) parts.push(`action ${action}`);
  if (requestId) parts.push(`request_id ${requestId}`);
  const data = asRecord(details);
  if (data) {
    const interesting = ["revision", "draft_version", "criterion_key", "sha256", "document_id", "brief_version"];
    for (const key of interesting) {
      if (data[key] != null && data[key] !== "") parts.push(`${key} ${String(data[key])}`);
    }
  }
  return parts.length ? parts.join(" · ") : undefined;
}
