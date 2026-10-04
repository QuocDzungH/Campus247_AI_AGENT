import type { IssuedDocumentInfo, Ticket } from "./types";

export type CertificateKind = "draft" | "issued";

export interface CertificateContent {
  institutionName: string;
  institutionUnit?: string | null;
  title: string;
  ticketCode?: string | null;
  studentName?: string | null;
  mssv?: string | null;
  classYear?: string | null;
  major?: string | null;
  faculty?: string | null;
  studentStatus?: string | null;
  verificationStatus?: string | null;
  purpose?: string | null;
  destinationOrg?: string | null;
  notes?: string | null;
  issuedAt?: string | null;
  issuedByName?: string | null;
  validUntil?: string | null;
  documentNumber?: string | null;
  signatureStatus: "unsigned" | "pending_signature" | "signed" | "none";
  signingProvider?: string | null;
  official: boolean;
  kind: CertificateKind;
}

export function canStateEnrollment(verificationStatus?: string | null): boolean {
  return verificationStatus === "officer_verified";
}

export function confirmationParagraph(doc: CertificateContent): string {
  const name = doc.studentName?.trim();
  const mssv = doc.mssv?.trim();
  let lead = "Nhà trường xác nhận";
  lead += name ? ` sinh viên ${name}` : " sinh viên theo hồ sơ dưới đây";
  if (mssv) lead += `, mã số sinh viên ${mssv}`;
  const extras: string[] = [];
  if (doc.classYear?.trim()) extras.push(`lớp/khóa ${doc.classYear.trim()}`);
  if (doc.major?.trim()) extras.push(`ngành ${doc.major.trim()}`);
  if (doc.faculty?.trim()) extras.push(`khoa ${doc.faculty.trim()}`);
  if (extras.length) lead += `, ${extras.join(", ")}`;
  if (canStateEnrollment(doc.verificationStatus) && doc.studentStatus?.trim()) {
    lead += `. Tình trạng học tập theo hồ sơ đã được cán bộ xác minh: ${doc.studentStatus.trim()}`;
  }
  return `${lead}.`;
}

export function kindBanner(doc: CertificateContent): string {
  if (doc.kind === "draft") return "Bản nháp · chưa phát hành";
  if (doc.signatureStatus === "unsigned") {
    return "Bản hệ thống đã tạo · chưa ký số · chưa phải giấy có giá trị chính thức";
  }
  if (doc.signatureStatus === "pending_signature") return "Bản hệ thống đã tạo · đang chờ ký số";
  if (doc.official) return "Tài liệu đã phát hành";
  return "Bản hệ thống đã tạo";
}

export function certificateNotice(doc: CertificateContent): string {
  if (doc.kind === "draft" || doc.signatureStatus === "unsigned" || doc.signatureStatus === "none") {
    return "Chưa ký số. Không sử dụng như giấy có giá trị chính thức.";
  }
  if (doc.signatureStatus === "pending_signature") return "Đang chờ ký số. Chưa phải bản có giá trị chính thức.";
  return "Chỉ dùng khi đã hoàn tất ký số theo quy trình nhà trường.";
}

function text(value?: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function certificateFromTicket(
  ticket: Ticket,
  options: {
    kind: CertificateKind;
    purpose?: string | null;
    destinationOrg?: string | null;
    notes?: string | null;
    issued?: IssuedDocumentInfo | null;
  }
): CertificateContent {
  const issued = options.issued;
  const snapshot = issued?.studentSnapshot || ticket.documentDraft?.studentSnapshot || {};
  const profile = ticket.studentProfile;
  const institutionName =
    text(issued?.institutionName) || text(ticket.institution?.name) || "VinUniversity";
  const institutionUnit = text(issued?.institutionUnit) || text(ticket.institution?.unit) || "Phòng Đào tạo";
  const purpose = options.kind === "issued" ? text(issued?.purpose) : text(options.purpose);
  const destinationOrg = options.kind === "issued" ? text(issued?.destinationOrg) : text(options.destinationOrg);
  const notes = options.kind === "issued" ? text(issued?.notes) : text(options.notes);
  return {
    institutionName,
    institutionUnit,
    title: "GIẤY XÁC NHẬN SINH VIÊN",
    ticketCode: ticket.code,
    studentName:
      text(snapshot.full_name) || text(profile?.fullName) || text(ticket.studentName),
    mssv: text(snapshot.mssv) || text(profile?.mssv) || text(ticket.studentMssv),
    classYear: text(snapshot.class_year) || text(profile?.classYear) || text(ticket.studentClassYear),
    major: text(snapshot.major) || text(profile?.major) || text(ticket.studentMajor),
    faculty: text(snapshot.faculty) || text(profile?.faculty),
    studentStatus: text(snapshot.student_status) || text(profile?.studentStatus),
    verificationStatus: text(snapshot.verification_status) || text(profile?.verificationStatus),
    purpose,
    destinationOrg,
    notes,
    issuedAt: options.kind === "issued" ? text(issued?.issuedAt) : null,
    issuedByName:
      options.kind === "issued"
        ? text(issued?.issuedByName) || text(ticket.assignedOfficerName)
        : text(ticket.assignedOfficerName),
    validUntil: options.kind === "issued" ? text(issued?.validUntil) : text(ticket.documentDraft?.validUntil),
    documentNumber: options.kind === "issued" ? text(issued?.documentNumber) : null,
    signatureStatus: options.kind === "issued" ? issued?.signatureStatus || "unsigned" : "none",
    signingProvider: issued?.signingProvider,
    official: options.kind === "issued" ? Boolean(issued?.official) : false,
    kind: options.kind,
  };
}
