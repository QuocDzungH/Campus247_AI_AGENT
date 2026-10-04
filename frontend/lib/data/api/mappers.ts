import {
  AuditLogEntry,
  ChatMessage,
  ChatSession,
  ChecklistItem,
  DocumentDraft,
  FactItem,
  InstitutionInfo,
  IssuedCertificateDocument,
  IssuedDocumentInfo,
  ProcessInfo,
  StudentProfileSnapshot,
  SupplementRecord,
  SystemVerificationItem,
  Ticket,
  TicketMessage,
  TicketType,
} from "../../types";
import { DataGatewayError } from "../errors";
import type { WireCitation, WirePage, WireTicket } from "./contracts";
import { ErrorBody } from "./types";
import { auditActionLabel, auditTechnical, displayActorName, roleLabel } from "../../audit-labels";
import { fieldLabel as sharedFieldLabel, verificationStatusLabel } from "../../field-labels";

export type PreviewFieldKey =
  | "purpose"
  | "destination_org"
  | "receive_method"
  | "complaint_subtype"
  | "course"
  | "course_code"
  | "assessment"
  | "description"
  | "requested_outcome"
  | "evidence";
export type ComplaintSubtype = "grade_appeal" | "other";
export type IntakeServiceType = "student_certificate" | "academic_complaint";

const PREVIEW_FIELD_KEYS: PreviewFieldKey[] = [
  "purpose",
  "destination_org",
  "receive_method",
  "complaint_subtype",
  "course",
  "course_code",
  "assessment",
  "description",
  "requested_outcome",
  "evidence",
];

export interface CampusPreviewFields {
  purpose: string | null;
  destinationOrg: string | null;
  receiveMethod: "digital_pdf" | "paper_stamped" | null;
  complaintSubtype: ComplaintSubtype | null;
  course: string | null;
  courseCode: string | null;
  assessment: string | null;
  description: string | null;
  requestedOutcome: string | null;
  evidence: string | null;
}

export interface CampusPreview {
  id: string;
  version: number;
  canSubmit: boolean;
  expiresAt: string;
  serviceType: IntakeServiceType;
  fields: CampusPreviewFields;
  missingFields: PreviewFieldKey[];
  invalidFields: Array<{ field: PreviewFieldKey; reason: string }>;
}

export interface ConversationView {
  id: string;
  revision: number;
  ticketId: string | null;
  status: "active" | "handover" | "closed";
  aiResponseLocked: boolean;
  handoverStatus: "none" | "pending" | "failed" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface ChatTurnResult {
  conversationId: string;
  userMessageId: string;
  route: "L1" | "L2" | "L4";
  outcome: string;
  reply: ChatMessage;
  citations: WireCitation[];
  preview: CampusPreview | null;
  ticket: Ticket | null;
  conversationState: {
    status: "active" | "handover" | "closed";
    aiResponseLocked: boolean;
    handoverStatus: "none" | "pending" | "failed" | "completed";
  };
}

export interface BriefCitation {
  documentId: string;
  documentTitle: string;
  documentVersion: string;
  chunkId: string;
  locator: string;
  quote: string;
  url?: string;
}

export interface BriefView {
  status: "pending" | "processing" | "ready" | "failed" | "stale";
  currentTicketRevision: number;
  briefVersion: number | null;
  sourceTicketRevision: number | null;
  summary: string;
  draftReply: string | null;
  facts: FactItem[];
  checklist: ChecklistItem[];
  missingItems: Array<{ field: string; reason: string }>;
  citations: BriefCitation[];
  warnings: Array<{ code: string; message: string }>;
  qualityStatus: "pass" | "fail" | null;
  errorMessage: string | null;
  modelName: string | null;
  promptVersion: string | null;
  templateVersion: string | null;
  indexVersion: string | null;
  suggestedPriority: "normal" | "high" | null;
  priorityReasons: string[];
}

function fieldLabel(name: string): string {
  return sharedFieldLabel(name);
}

function stringifyFieldValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function submittedFieldsFromRequest(requestData: Record<string, unknown> | null): { name: string; label: string; value: string }[] {
  if (!requestData) return [];
  const fields: { name: string; label: string; value: string }[] = [];
  for (const [name, value] of Object.entries(requestData)) {
    if (name === "extras" && isRecord(value)) {
      for (const [extraName, extraValue] of Object.entries(value)) {
        const text = stringifyFieldValue(extraValue);
        if (text) fields.push({ name: `extras.${extraName}`, label: fieldLabel(extraName), value: text });
      }
      continue;
    }
    const text = stringifyFieldValue(value);
    if (text) fields.push({ name, label: fieldLabel(name), value: text });
  }
  return fields;
}

export interface PreviewFieldsPatch {
  purpose: string | null;
  destination_org: string | null;
  receive_method: "digital_pdf" | "paper_stamped" | null;
  complaint_subtype: ComplaintSubtype | null;
  course: string | null;
  course_code: string | null;
  assessment: string | null;
  description: string | null;
  requested_outcome: string | null;
  evidence: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new DataGatewayError("validation", `Invalid ${label} received from API`);
  }
  return value;
}

export function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DataGatewayError("validation", `Missing ${label} from API`);
  }
  return value;
}

export function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DataGatewayError("validation", `Missing ${label} from API`);
  }
  return value;
}

export function parsePage<T>(value: unknown, mapItem: (item: unknown) => T, label: string): WirePage<T> {
  const record = requireRecord(value, label);
  if (!Array.isArray(record.items)) {
    throw new DataGatewayError("validation", `${label} is not a Page`);
  }
  return {
    items: record.items.map(mapItem),
    total: requireNumber(record.total, `${label}.total`),
    page: requireNumber(record.page, `${label}.page`),
    page_size: requireNumber(record.page_size, `${label}.page_size`),
  };
}

function asTicketType(serviceType: WireTicket["service_type"]): TicketType {
  if (serviceType === "student_certificate") return "certificate";
  if (serviceType === "academic_complaint") return "complaint";
  return "lookup";
}

function emptyAiSummary(summary: string): Ticket["aiSummary"] {
  return {
    target: "",
    context: summary,
    categorySla: "",
    confidence: "",
    nextBestAction: "",
    nextBestActionReason: "",
  };
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asPreviewFieldKey(value: unknown): PreviewFieldKey | null {
  return PREVIEW_FIELD_KEYS.includes(value as PreviewFieldKey) ? (value as PreviewFieldKey) : null;
}

export function mapPreview(raw: unknown): CampusPreview {
  const record = requireRecord(raw, "preview");
  const fields = requireRecord(record.fields, "preview.fields");
  const receive = fields.receive_method;
  if (receive !== null && receive !== undefined && receive !== "digital_pdf" && receive !== "paper_stamped") {
    throw new DataGatewayError("validation", "Invalid preview receive_method");
  }
  const subtype = fields.complaint_subtype;
  if (subtype !== null && subtype !== undefined && subtype !== "grade_appeal" && subtype !== "other") {
    throw new DataGatewayError("validation", "Invalid preview complaint_subtype");
  }
  const serviceType = record.service_type === "academic_complaint" ? "academic_complaint" : "student_certificate";
  const missing = Array.isArray(record.missing_fields)
    ? record.missing_fields.flatMap((item): PreviewFieldKey[] => {
        const key = asPreviewFieldKey(item);
        return key ? [key] : [];
      })
    : [];
  const invalid = Array.isArray(record.invalid_fields)
    ? record.invalid_fields.flatMap((item): Array<{ field: PreviewFieldKey; reason: string }> => {
        if (!isRecord(item)) return [];
        const field = asPreviewFieldKey(item.field);
        if (!field || typeof item.reason !== "string") return [];
        return [{ field, reason: item.reason }];
      })
    : [];
  return {
    id: requireString(record.id, "preview.id"),
    version: requireNumber(record.version, "preview.version"),
    canSubmit: record.can_submit === true,
    expiresAt: requireString(record.expires_at, "preview.expires_at"),
    serviceType,
    fields: {
      purpose: optionalText(fields.purpose),
      destinationOrg: optionalText(fields.destination_org),
      receiveMethod: receive === "digital_pdf" || receive === "paper_stamped" ? receive : null,
      complaintSubtype: subtype === "grade_appeal" || subtype === "other" ? subtype : null,
      course: optionalText(fields.course),
      courseCode: optionalText(fields.course_code),
      assessment: optionalText(fields.assessment),
      description: optionalText(fields.description),
      requestedOutcome: optionalText(fields.requested_outcome),
      evidence: optionalText(fields.evidence),
    },
    missingFields: missing,
    invalidFields: invalid,
  };
}

export function mapConversation(raw: unknown): ConversationView {
  const record = requireRecord(raw, "conversation");
  const status = record.status;
  const handover = record.handover_status;
  if (status !== "active" && status !== "handover" && status !== "closed") {
    throw new DataGatewayError("validation", "Invalid conversation status");
  }
  if (handover !== "none" && handover !== "pending" && handover !== "failed" && handover !== "completed") {
    throw new DataGatewayError("validation", "Invalid handover_status");
  }
  return {
    id: requireString(record.id, "conversation.id"),
    revision: requireNumber(record.revision, "conversation.revision"),
    ticketId: typeof record.ticket_id === "string" ? record.ticket_id : null,
    status,
    aiResponseLocked: record.ai_response_locked === true,
    handoverStatus: handover,
    createdAt: requireString(record.created_at, "conversation.created_at"),
    updatedAt: requireString(record.updated_at, "conversation.updated_at"),
  };
}

export function mapWireTicket(raw: unknown, extras?: { messages?: TicketMessage[]; auditLogs?: AuditLogEntry[] }): Ticket {
  const record = requireRecord(raw, "ticket");
  const status = record.status;
  const priority = record.priority;
  const serviceType = record.service_type;
  const category = record.category;
  if (status !== "open" && status !== "pending_officer" && status !== "resolved") {
    throw new DataGatewayError("validation", "Invalid ticket status");
  }
  if (priority !== "normal" && priority !== "high") {
    throw new DataGatewayError("validation", "Invalid ticket priority");
  }
  if (
    serviceType !== "student_certificate" &&
    serviceType !== "academic_complaint" &&
    serviceType !== "student_support"
  ) {
    throw new DataGatewayError("validation", "Invalid ticket service_type");
  }
  const requestData = isRecord(record.request_data) ? record.request_data : null;
  const submittedFields = submittedFieldsFromRequest(requestData);
  const purpose = typeof requestData?.purpose === "string" ? requestData.purpose : "";
  const destinationOrg = typeof requestData?.destination_org === "string" ? requestData.destination_org : "";
  const receiveMethod =
    requestData?.receive_method === "paper_stamped" || requestData?.receive_method === "digital_pdf"
      ? requestData.receive_method
      : "";
  const summary = requireString(record.summary, "ticket.summary");
  if (summary && !submittedFields.some((field) => field.name === "summary")) {
    submittedFields.unshift({ name: "summary", label: "Nội dung gốc", value: summary });
  }
  const reasons = Array.isArray(record.priority_reasons)
    ? record.priority_reasons.filter((item): item is string => typeof item === "string")
    : [];
  const isComplaint = category === "complaint" || serviceType === "academic_complaint";
  const complaintSubtype =
    requestData?.complaint_subtype === "grade_appeal" || requestData?.complaint_subtype === "other"
      ? requestData.complaint_subtype
      : null;
  return {
    id: requireString(record.id, "ticket.id"),
    code: requireString(record.code, "ticket.code"),
    title: summary,
    type: asTicketType(serviceType),
    studentId: requireString(record.student_id, "ticket.student_id"),
    studentName: typeof record.student_name === "string" ? record.student_name : "",
    studentMssv: typeof record.student_mssv === "string" ? record.student_mssv : "",
    studentMajor: "",
    studentClassYear: "",
    studentEmail: "",
    status,
    priority,
    priorityReason: reasons[0],
    createdAt: requireString(record.created_at, "ticket.created_at"),
    submittedAt: requireString(record.created_at, "ticket.created_at"),
    slaDeadline: "",
    certificateType:
      serviceType === "student_certificate"
        ? "Giấy xác nhận sinh viên"
        : complaintSubtype === "grade_appeal"
          ? "Khiếu nại điểm học phần"
          : isComplaint
            ? "Khiếu nại"
            : "",
    receiveMethod,
    destinationOrg,
    purpose,
    notes: typeof record.handover_reason === "string" ? record.handover_reason : undefined,
    aiSummary: emptyAiSummary(summary),
    facts: [],
    checklist: [],
    sopReference: "",
    sopDeadline: "",
    officerDraft: "",
    officerDraftDefault: "",
    assignedOfficerId: typeof record.assigned_officer_id === "string" ? record.assigned_officer_id : undefined,
    isL4: typeof record.handover_reason === "string" && record.handover_reason.length > 0,
    l4TriggerReason: typeof record.handover_reason === "string" ? record.handover_reason : undefined,
    messages: extras?.messages ?? [],
    auditLogs: extras?.auditLogs ?? [],
    serverRevision: requireNumber(record.revision, "ticket.revision"),
    conversationId: requireString(record.conversation_id, "ticket.conversation_id"),
    category: category === "complaint" ? "complaint" : "action",
    serviceType,
    complaintSubtype,
    requestPayload:
      submittedFields.length || summary
        ? {
            schemaVersion: 1,
            task: isComplaint ? "complaint" : "certificate",
            submittedFields: submittedFields.length
              ? submittedFields
              : [{ name: "summary", label: "Nội dung gốc", value: summary }],
          }
        : undefined,
  };
}

export function mapTicketRefToStub(raw: unknown): Ticket {
  const record = requireRecord(raw, "ticket_ref");
  return mapWireTicket({
    ...record,
    conversation_id: typeof record.conversation_id === "string" ? record.conversation_id : "unknown",
    student_id: typeof record.student_id === "string" ? record.student_id : "unknown",
    category: record.category === "complaint" ? "complaint" : "action",
    service_type:
      record.service_type === "academic_complaint" || record.service_type === "student_support"
        ? record.service_type
        : "student_certificate",
    priority_reasons: [],
    summary: typeof record.summary === "string" ? record.summary : requireString(record.code, "ticket_ref.code"),
    request_data: null,
    handover_reason: null,
    assigned_officer_id: null,
    revision: typeof record.revision === "number" ? record.revision : 1,
    created_at: typeof record.created_at === "string" ? record.created_at : new Date().toISOString(),
    updated_at: typeof record.updated_at === "string" ? record.updated_at : new Date().toISOString(),
  });
}

export function mapWireMessageToTicketMessage(raw: unknown): TicketMessage {
  const record = requireRecord(raw, "message");
  const sender = record.sender;
  const senderRole: TicketMessage["senderRole"] =
    sender === "officer" ? "officer" : sender === "student" ? "student" : sender === "assistant" ? "ai" : "system";
  const senderName =
    sender === "officer" ? "Cán bộ" : sender === "student" ? "Sinh viên" : sender === "assistant" ? "Trợ lý học vụ" : "Hệ thống";
  return {
    id: requireString(record.id, "message.id"),
    senderId: senderRole,
    senderName,
    senderRole,
    content: requireString(record.content, "message.content"),
    timestamp: requireString(record.created_at, "message.created_at"),
  };
}

export function mapWireMessageToChat(raw: unknown, extras?: { level?: ChatMessage["level"]; ticketId?: string }): ChatMessage {
  const record = requireRecord(raw, "chat_message");
  const sender = record.sender;
  const uiSender: ChatMessage["sender"] = sender === "student" ? "user" : sender === "system" ? "system" : "bot";
  return {
    id: requireString(record.id, "chat_message.id"),
    sender: uiSender,
    text: requireString(record.content, "chat_message.content"),
    timestamp: requireString(record.created_at, "chat_message.created_at"),
    level: extras?.level,
    ticketId: extras?.ticketId,
  };
}

export function mapChatResult(raw: unknown): ChatTurnResult {
  const record = requireRecord(raw, "ChatResult");
  const route = record.route;
  if (route !== "L1" && route !== "L2" && route !== "L4") {
    throw new DataGatewayError("validation", "Invalid ChatResult route");
  }
  const state = requireRecord(record.conversation_state, "conversation_state");
  const status = state.status;
  const handover = state.handover_status;
  if (status !== "active" && status !== "handover" && status !== "closed") {
    throw new DataGatewayError("validation", "Invalid conversation_state.status");
  }
  if (handover !== "none" && handover !== "pending" && handover !== "failed" && handover !== "completed") {
    throw new DataGatewayError("validation", "Invalid conversation_state.handover_status");
  }
  const citations = Array.isArray(record.citations)
    ? record.citations.filter((item): item is WireCitation => isRecord(item) && typeof item.document_id === "string")
    : [];
  const ticketRef = record.ticket == null ? null : mapTicketRefToStub(record.ticket);
  const preview = record.preview == null ? null : mapPreview(record.preview);
  const reply = mapWireMessageToChat(record.reply, {
    level: route,
    ticketId: ticketRef?.id,
  });
  if (preview?.canSubmit) reply.actionCard = "submit1_prompt";
  if (record.outcome === "handover_completed" || record.outcome === "forwarded_to_officer") {
    reply.actionCard = "l4_handover";
  }
  const firstCitation = citations[0];
  if (firstCitation) {
    reply.citation = {
      code: firstCitation.chunk_id || firstCitation.document_id,
      title: firstCitation.document_title,
      quote: firstCitation.quote,
      source: firstCitation.locator,
    };
    reply.citations = citations.map((item) => ({
      documentId: item.document_id,
      documentTitle: item.document_title,
      documentVersion: item.document_version,
      chunkId: item.chunk_id,
      locator: item.locator,
      quote: item.quote,
      url: item.url ?? undefined,
    }));
  }
  return {
    conversationId: requireString(record.conversation_id, "ChatResult.conversation_id"),
    userMessageId: requireString(record.user_message_id, "ChatResult.user_message_id"),
    route,
    outcome: requireString(record.outcome, "ChatResult.outcome"),
    reply,
    citations,
    preview,
    ticket: ticketRef,
    conversationState: {
      status,
      aiResponseLocked: state.ai_response_locked === true,
      handoverStatus: handover,
    },
  };
}

export function mapAuditEntry(raw: unknown): AuditLogEntry {
  const record = requireRecord(raw, "audit");
  const actorType =
    record.actor_type === "officer" ? "officer" : record.actor_type === "student" ? "student" : "system";
  const actorName = typeof record.actor_name === "string" ? record.actor_name : null;
  const rawAction = requireString(record.action, "audit.action");
  const requestId = typeof record.request_id === "string" ? record.request_id : null;
  return {
    id: requireString(record.id, "audit.id"),
    timestamp: requireString(record.created_at, "audit.created_at"),
    source: roleLabel(actorType),
    action: auditActionLabel(rawAction, record.details),
    actor: displayActorName(actorName, actorType),
    actorName,
    actorType,
    rawAction,
    requestId,
    technical: auditTechnical(record.details, requestId, rawAction),
  };
}

export function mapProcessInfo(raw: unknown): ProcessInfo | undefined {
  if (!isRecord(raw)) return undefined;
  const templateStatus = raw.template_status === "approved" ? "approved" : "unavailable";
  return {
    serviceType: typeof raw.service_type === "string" ? raw.service_type : "",
    label: typeof raw.label === "string" ? raw.label : "",
    processVersion: typeof raw.process_version === "string" ? raw.process_version : "",
    issuesDocument: raw.issues_document === true,
    templateId: typeof raw.template_id === "string" ? raw.template_id : null,
    templateVersion: typeof raw.template_version === "string" ? raw.template_version : null,
    templateStatus,
    validityDays: typeof raw.validity_days === "number" ? raw.validity_days : null,
    requiresAcademicStatus: raw.requires_academic_status === true,
    requiresFinancialClearance: raw.requires_financial_clearance === true,
    requiredCriteria: Array.isArray(raw.required_criteria)
      ? raw.required_criteria.filter((item): item is string => typeof item === "string")
      : [],
    issueRequiredCriteria: Array.isArray(raw.issue_required_criteria)
      ? raw.issue_required_criteria.filter((item): item is string => typeof item === "string")
      : [],
    plannedChecklist: Array.isArray(raw.planned_checklist)
      ? raw.planned_checklist.flatMap((item) => {
          if (!isRecord(item) || typeof item.id !== "string" || typeof item.label !== "string") return [];
          return [{ id: item.id, label: item.label, required: item.required !== false }];
        })
      : [],
  };
}

export function mapStudentProfile(raw: unknown): StudentProfileSnapshot | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    userId: typeof raw.user_id === "string" ? raw.user_id : "",
    fullName: typeof raw.full_name === "string" ? raw.full_name : null,
    mssv: typeof raw.mssv === "string" ? raw.mssv : null,
    email: typeof raw.email === "string" ? raw.email : null,
    faculty: typeof raw.faculty === "string" ? raw.faculty : null,
    major: typeof raw.major === "string" ? raw.major : null,
    cohort: typeof raw.cohort === "string" ? raw.cohort : null,
    classYear: typeof raw.class_year === "string" ? raw.class_year : null,
    studentStatus: typeof raw.student_status === "string" ? raw.student_status : null,
    verificationStatus: typeof raw.verification_status === "string" ? raw.verification_status : "unverified",
    source: typeof raw.source === "string" ? raw.source : null,
    isDemo: raw.is_demo === true,
  };
}

export function mapDocumentDraft(raw: unknown): DocumentDraft | undefined {
  if (!isRecord(raw)) return undefined;
  const status =
    raw.status === "approved" || raw.status === "issued" || raw.status === "unavailable" || raw.status === "draft"
      ? raw.status
      : "draft";
  const snapshot = isRecord(raw.student_snapshot) ? raw.student_snapshot : {};
  const studentSnapshot: Record<string, string | null | undefined> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    studentSnapshot[key] = value == null ? null : String(value);
  }
  return {
    ticketId: typeof raw.ticket_id === "string" ? raw.ticket_id : "",
    version: typeof raw.version === "number" ? raw.version : 0,
    templateId: typeof raw.template_id === "string" ? raw.template_id : "none",
    templateVersion: typeof raw.template_version === "string" ? raw.template_version : "none",
    templateStatus: raw.template_status === "approved" ? "approved" : "unavailable",
    status,
    studentSnapshot,
    purpose: typeof raw.purpose === "string" ? raw.purpose : null,
    destinationOrg: typeof raw.destination_org === "string" ? raw.destination_org : null,
    notes: typeof raw.notes === "string" ? raw.notes : null,
    validUntil: typeof raw.valid_until === "string" ? raw.valid_until : null,
    authoredBy: typeof raw.authored_by === "string" ? raw.authored_by : null,
    approvedBy: typeof raw.approved_by === "string" ? raw.approved_by : null,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

export function mapIssuedDocument(raw: unknown): IssuedDocumentInfo | undefined {
  if (!isRecord(raw)) return undefined;
  const signature =
    raw.signature_status === "pending_signature" || raw.signature_status === "signed" || raw.signature_status === "unsigned"
      ? raw.signature_status
      : "unsigned";
  return {
    id: requireString(raw.id, "issued_document.id"),
    ticketId: typeof raw.ticket_id === "string" ? raw.ticket_id : "",
    draftVersion: typeof raw.draft_version === "number" ? raw.draft_version : 1,
    templateId: typeof raw.template_id === "string" ? raw.template_id : "",
    templateVersion: typeof raw.template_version === "string" ? raw.template_version : "",
    filename: typeof raw.filename === "string" ? raw.filename : "document.pdf",
    sha256: typeof raw.sha256 === "string" ? raw.sha256 : "",
    issuedBy: typeof raw.issued_by === "string" ? raw.issued_by : "",
    issuedAt: typeof raw.issued_at === "string" ? raw.issued_at : "",
    signatureStatus: signature,
    signingProvider: typeof raw.signing_provider === "string" ? raw.signing_provider : "none",
    official: false,
    issuedByName: typeof raw.issued_by_name === "string" ? raw.issued_by_name : null,
    studentSnapshot: isRecord(raw.student_snapshot)
      ? Object.fromEntries(Object.entries(raw.student_snapshot).map(([key, value]) => [key, value == null ? null : String(value)]))
      : {},
    purpose: typeof raw.purpose === "string" ? raw.purpose : null,
    destinationOrg: typeof raw.destination_org === "string" ? raw.destination_org : null,
    notes: typeof raw.notes === "string" ? raw.notes : null,
    validUntil: typeof raw.valid_until === "string" ? raw.valid_until : null,
    documentNumber: typeof raw.document_number === "string" ? raw.document_number : null,
    institutionName: typeof raw.institution_name === "string" ? raw.institution_name : null,
    institutionUnit: typeof raw.institution_unit === "string" ? raw.institution_unit : null,
  };
}

export function issuedInfoToCertificate(
  issued: IssuedDocumentInfo,
  ticket: Ticket,
  draft?: DocumentDraft
): IssuedCertificateDocument {
  const snapshot = issued.studentSnapshot || draft?.studentSnapshot || {};
  return {
    id: issued.id,
    docNumber: issued.documentNumber || issued.id,
    templateCode: issued.templateId,
    templateName: ticket.process?.label || issued.templateId,
    templateVersion: issued.templateVersion,
    issuedAt: issued.issuedAt,
    issuedAtFormatted: issued.issuedAt,
    issuedByOfficerId: issued.issuedBy,
    issuedByOfficerName: issued.issuedByName || ticket.assignedOfficerName || issued.issuedBy,
    studentId: ticket.studentId,
    studentName: snapshot.full_name || ticket.studentName,
    studentMssv: snapshot.mssv || ticket.studentMssv,
    studentDob: "",
    studentGender: "",
    studentMajor: snapshot.major || ticket.studentMajor,
    studentClassYear: snapshot.class_year || ticket.studentClassYear,
    studentFaculty: snapshot.faculty || "",
    studentAcademicStatus: snapshot.student_status || "",
    purpose: issued.purpose || draft?.purpose || ticket.purpose,
    destinationOrg: issued.destinationOrg || draft?.destinationOrg || ticket.destinationOrg,
    validUntil: issued.validUntil || draft?.validUntil || "",
    customOfficerNotes: issued.notes || draft?.notes || undefined,
    status: "issued",
    fileName: issued.filename,
    isDemoSample: false,
  };
}

function mapVerificationItem(item: unknown): SystemVerificationItem[] {
  if (!isRecord(item) || typeof item.id !== "string") return [];
  const status = item.status;
  if (status !== "passed" && status !== "failed" && status !== "insufficient" && status !== "error") return [];
  const review = item.officer_review_status;
  const resolution =
    item.officer_resolution === "viewed" ||
    item.officer_resolution === "manual_pass" ||
    item.officer_resolution === "manual_fail" ||
    item.officer_resolution === "none"
      ? item.officer_resolution
      : "none";
  const evidence = isRecord(item.evidence)
    ? Object.fromEntries(
        Object.entries(item.evidence).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      )
    : undefined;
  return [
    {
      id: item.id,
      criterionKey: typeof item.criterion_key === "string" ? item.criterion_key : item.id,
      criterionLabel: typeof item.criterion_label === "string" ? item.criterion_label : "",
      conditionApplied: typeof item.condition_applied === "string" ? item.condition_applied : "",
      dataChecked: typeof item.data_checked === "string" ? item.data_checked : "",
      sourceSystem: typeof item.source_system === "string" ? item.source_system : "",
      lookupTimestamp: typeof item.lookup_timestamp === "string" ? item.lookup_timestamp : "",
      status,
      reason: typeof item.reason === "string" ? item.reason : "",
      evidenceDetails: {
        rawSnippet: typeof item.data_checked === "string" ? item.data_checked : "",
        verifiedFields: evidence,
      },
      officerReviewStatus: review === "confirmed" || review === "overridden" ? review : "pending",
      officerReviewNote: typeof item.officer_note === "string" ? item.officer_note : undefined,
      conditionSource: typeof item.condition_source === "string" ? item.condition_source : undefined,
      dataSource: typeof item.data_source === "string" ? item.data_source : undefined,
      sourceVersion: typeof item.source_version === "string" ? item.source_version : undefined,
      sourceHash: typeof item.source_hash === "string" ? item.source_hash : undefined,
      evidence,
      connectorStatus:
        item.connector_status === "connected" ||
        item.connector_status === "not_configured" ||
        item.connector_status === "error"
          ? item.connector_status
          : undefined,
      applies: item.applies !== false,
      stale: item.stale === true,
      officerResolution: resolution,
      officerReviewedBy: typeof item.officer_reviewed_by === "string" ? item.officer_reviewed_by : undefined,
      officerReviewedAt: typeof item.officer_reviewed_at === "string" ? item.officer_reviewed_at : undefined,
    },
  ];
}

export function mapTicketDetail(raw: unknown, auditLogs: AuditLogEntry[] = []): Ticket {
  const record = requireRecord(raw, "ticket_detail");
  const messagesPage = parsePage(record.messages, mapWireMessageToTicketMessage, "ticket_detail.messages");
  const ticket = mapWireTicket(record.ticket, { messages: messagesPage.items, auditLogs });
  ticket.messagesTotal = messagesPage.total;
  const workspace = isRecord(record.workspace) ? record.workspace : null;
  if (typeof workspace?.officer_draft === "string") {
    ticket.officerDraft = workspace.officer_draft;
  }
  if (Array.isArray(workspace?.checklist)) {
    ticket.checklist = workspace.checklist.flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.label !== "string") return [];
      return [
        {
          id: item.id,
          label: item.label,
          checked: item.checked === true,
          description: typeof item.description === "string" ? item.description : "",
          required: item.required === true,
          source: item.source === "ai" ? "ai" : "process",
          checkedBy: typeof item.checked_by === "string" ? item.checked_by : undefined,
          checkedAt: typeof item.checked_at === "string" ? item.checked_at : undefined,
          note: typeof item.note === "string" ? item.note : undefined,
          sourceVersion: typeof item.source_version === "string" ? item.source_version : undefined,
        },
      ];
    });
  }
  if (Array.isArray(record.attachments)) {
    ticket.attachments = record.attachments.flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== "string") return [];
      return [
        {
          id: item.id,
          name: typeof item.filename === "string" ? item.filename : item.id,
          size: typeof item.size_bytes === "number" ? item.size_bytes : 0,
          contentType: typeof item.mime_type === "string" ? item.mime_type : "application/octet-stream",
          field: typeof item.field === "string" ? item.field : undefined,
        },
      ];
    });
  }
  ticket.systemVerifications = (Array.isArray(record.verifications) ? record.verifications : []).flatMap(mapVerificationItem);
  ticket.process = mapProcessInfo(record.process);
  ticket.studentProfile = mapStudentProfile(record.student_profile);
  if (ticket.studentProfile) {
    ticket.studentName = ticket.studentProfile.fullName || ticket.studentName;
    ticket.studentMssv = ticket.studentProfile.mssv || ticket.studentMssv;
    ticket.studentMajor = ticket.studentProfile.major || ticket.studentMajor;
    ticket.studentClassYear = ticket.studentProfile.classYear || ticket.studentClassYear;
    ticket.studentEmail = ticket.studentProfile.email || ticket.studentEmail;
  }
  if (isRecord(record.assigned_officer) && typeof record.assigned_officer.name === "string") {
    ticket.assignedOfficerName = record.assigned_officer.name;
    if (typeof record.assigned_officer.id === "string") ticket.assignedOfficerId = record.assigned_officer.id;
  }
  ticket.documentDraft = mapDocumentDraft(record.document_draft);
  ticket.issuedDocument = mapIssuedDocument(record.issued_document);
  if (ticket.documentDraft) {
    ticket.documentStatus = ticket.documentDraft.status === "unavailable" ? "not_generated" : ticket.documentDraft.status;
    ticket.purpose = ticket.documentDraft.purpose || ticket.purpose;
    ticket.destinationOrg = ticket.documentDraft.destinationOrg || ticket.destinationOrg;
  }
  if (ticket.issuedDocument) {
    ticket.documentStatus = "issued";
    ticket.issuedCertificate = issuedInfoToCertificate(ticket.issuedDocument, ticket, ticket.documentDraft);
  }
  ticket.supplements = (Array.isArray(record.supplements) ? record.supplements : []).flatMap((item): SupplementRecord[] => {
    if (!isRecord(item) || typeof item.id !== "string") return [];
    const status = item.status === "fulfilled" || item.status === "cancelled" || item.status === "open" ? item.status : "open";
    return [
      {
        id: item.id,
        reason: typeof item.reason === "string" ? item.reason : "",
        status,
        requestedBy: typeof item.requested_by === "string" ? item.requested_by : "",
        requestedAt: typeof item.requested_at === "string" ? item.requested_at : "",
        items: Array.isArray(item.items)
          ? item.items.flatMap((entry) => {
              if (!isRecord(entry) || typeof entry.label !== "string") return [];
              return [
                {
                  id: typeof entry.id === "string" ? entry.id : undefined,
                  label: entry.label,
                  reason: typeof entry.reason === "string" ? entry.reason : null,
                  status: entry.status === "fulfilled" ? "fulfilled" : "open",
                },
              ];
            })
          : [],
      },
    ];
  });
  ticket.evidenceFingerprint = typeof record.evidence_fingerprint === "string" ? record.evidence_fingerprint : undefined;
  ticket.dataChangedSinceLastCheck = ticket.systemVerifications?.some((item) => item.stale) === true;
  if (isRecord(record.institution) && typeof record.institution.name === "string") {
    const institution: InstitutionInfo = {
      name: record.institution.name,
      unit: typeof record.institution.unit === "string" ? record.institution.unit : null,
    };
    ticket.institution = institution;
  }
  return ticket;
}

export function mapConversationToSession(conversation: ConversationView, messages: ChatMessage[] = []): ChatSession {
  const last = messages[messages.length - 1];
  const tag = conversation.aiResponseLocked ? "L4" : conversation.ticketId ? "L2" : "Chung";
  return {
    id: conversation.id,
    title: last?.text.slice(0, 64) || "Cuộc trò chuyện",
    preview: last?.text.slice(0, 140) || "",
    updatedAt: conversation.updatedAt,
    tag,
    messages,
    isL4HandoverActive: conversation.aiResponseLocked,
    ticketId: conversation.ticketId,
  };
}

export function mapBrief(raw: unknown): BriefView {
  const record = requireRecord(raw, "brief");
  const status = record.status;
  if (
    status !== "pending" &&
    status !== "processing" &&
    status !== "ready" &&
    status !== "failed" &&
    status !== "stale"
  ) {
    throw new DataGatewayError("validation", "Invalid brief status");
  }
  const artifact = isRecord(record.artifact) ? record.artifact : null;
  const brief = artifact && isRecord(artifact.brief) ? artifact.brief : null;
  const facts: FactItem[] = Array.isArray(brief?.facts)
    ? brief.facts.flatMap((item, index) => {
        if (!isRecord(item) || typeof item.key !== "string" || typeof item.value !== "string") return [];
        const rawStatus = typeof item.verification_status === "string" ? item.verification_status : "unverified";
        const statusValue =
          rawStatus === "officer_verified" || rawStatus === "verified"
            ? "verified"
            : rawStatus === "disputed"
              ? "disputed"
              : "unverified";
        return [
          {
            id: `${item.source_id || item.key}-${index}`,
            key: item.key,
            source: typeof item.source_type === "string" ? item.source_type : "",
            value: item.value,
            status: statusValue,
            statusText: verificationStatusLabel(rawStatus),
          },
        ];
      })
    : [];
  const checklist: ChecklistItem[] = Array.isArray(brief?.checklist)
    ? brief.checklist.flatMap((item) => {
        if (!isRecord(item) || typeof item.id !== "string" || typeof item.label !== "string") return [];
        return [{ id: item.id, label: item.label, description: "", checked: false }];
      })
    : [];
  const error = isRecord(record.error) ? record.error : null;
  const artifactMeta = isRecord(record.artifact) ? record.artifact : null;
  const citations: BriefCitation[] = Array.isArray(brief?.citations)
    ? brief.citations.flatMap((item) => {
        if (!isRecord(item) || typeof item.document_id !== "string") return [];
        return [
          {
            documentId: item.document_id,
            documentTitle: typeof item.document_title === "string" ? item.document_title : item.document_id,
            documentVersion: typeof item.document_version === "string" ? item.document_version : "",
            chunkId: typeof item.chunk_id === "string" ? item.chunk_id : "",
            locator: typeof item.locator === "string" ? item.locator : "",
            quote: typeof item.quote === "string" ? item.quote : "",
            url: typeof item.url === "string" ? item.url : undefined,
          },
        ];
      })
    : [];
  const missingItems = Array.isArray(brief?.missing_items)
    ? brief.missing_items.flatMap((item) =>
        isRecord(item) && typeof item.field === "string" && typeof item.reason === "string"
          ? [{ field: item.field, reason: item.reason }]
          : []
      )
    : [];
  return {
    status,
    currentTicketRevision: requireNumber(record.current_ticket_revision, "brief.current_ticket_revision"),
    briefVersion: typeof record.brief_version === "number" ? record.brief_version : null,
    sourceTicketRevision: typeof record.source_ticket_revision === "number" ? record.source_ticket_revision : null,
    summary: typeof brief?.summary === "string" ? brief.summary : "",
    draftReply: typeof brief?.draft_reply === "string" ? brief.draft_reply : null,
    facts,
    checklist,
    missingItems,
    citations,
    warnings: Array.isArray(brief?.warnings)
      ? brief.warnings.flatMap((item) =>
          isRecord(item) && typeof item.code === "string" && typeof item.message === "string"
            ? [{ code: item.code, message: item.message }]
            : []
        )
      : [],
    qualityStatus: brief?.quality_status === "pass" || brief?.quality_status === "fail" ? brief.quality_status : null,
    errorMessage: typeof error?.code === "string" ? `${error.code}${typeof error.message === "string" ? `: ${error.message}` : ""}` : null,
    modelName: typeof artifactMeta?.model_name === "string" ? artifactMeta.model_name : null,
    promptVersion: typeof artifactMeta?.prompt_version === "string" ? artifactMeta.prompt_version : null,
    templateVersion: typeof artifactMeta?.template_version === "string" ? artifactMeta.template_version : null,
    indexVersion: typeof artifactMeta?.index_version === "string" ? artifactMeta.index_version : null,
    suggestedPriority: brief?.suggested_priority === "high" || brief?.suggested_priority === "normal" ? brief.suggested_priority : null,
    priorityReasons: Array.isArray(brief?.priority_reasons)
      ? brief.priority_reasons.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function errorDetails(error: DataGatewayError): ErrorBody["details"] | undefined {
  const details = error.details;
  if (isRecord(details) && isRecord(details.details)) return details.details as ErrorBody["details"];
  if (
    isRecord(details) &&
    (typeof details.current_revision === "number" ||
      typeof details.current_version === "number" ||
      typeof details.ticket_id === "string")
  ) {
    return details as ErrorBody["details"];
  }
  return undefined;
}

export function previewFieldsToPatch(preview: CampusPreview): PreviewFieldsPatch {
  return {
    purpose: preview.fields.purpose,
    destination_org: preview.fields.destinationOrg,
    receive_method: preview.fields.receiveMethod,
    complaint_subtype: preview.fields.complaintSubtype,
    course: preview.fields.course,
    course_code: preview.fields.courseCode,
    assessment: preview.fields.assessment,
    description: preview.fields.description,
    requested_outcome: preview.fields.requestedOutcome,
    evidence: preview.fields.evidence,
  };
}

function blankToNull(value: string | null | undefined): string | null {
  const text = (value || "").trim();
  return text ? text : null;
}

export function fieldsFromForm(fields: {
  purpose?: string;
  destinationOrg?: string;
  receiveMethod?: "digital_pdf" | "paper_stamped" | "";
  complaintSubtype?: ComplaintSubtype | "";
  course?: string;
  courseCode?: string;
  assessment?: string;
  description?: string;
  requestedOutcome?: string;
  evidence?: string;
}): PreviewFieldsPatch {
  const subtype = fields.complaintSubtype;
  return {
    purpose: blankToNull(fields.purpose),
    destination_org: blankToNull(fields.destinationOrg),
    receive_method: fields.receiveMethod === "digital_pdf" || fields.receiveMethod === "paper_stamped" ? fields.receiveMethod : null,
    complaint_subtype: subtype === "grade_appeal" || subtype === "other" ? subtype : null,
    course: blankToNull(fields.course),
    course_code: blankToNull(fields.courseCode),
    assessment: blankToNull(fields.assessment),
    description: blankToNull(fields.description),
    requested_outcome: blankToNull(fields.requestedOutcome),
    evidence: blankToNull(fields.evidence),
  };
}
