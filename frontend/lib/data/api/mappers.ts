import {
  AuditLogEntry,
  ChatMessage,
  ChatSession,
  ChecklistItem,
  FactItem,
  Ticket,
  TicketMessage,
  TicketType,
} from "../../types";
import { DataGatewayError } from "../errors";
import type { WireCitation, WirePage, WireTicket } from "./contracts";
import { ErrorBody } from "./types";

export type PreviewFieldKey = "purpose" | "destination_org" | "receive_method";

export interface CampusPreview {
  id: string;
  version: number;
  canSubmit: boolean;
  expiresAt: string;
  serviceType: "student_certificate";
  fields: {
    purpose: string | null;
    destinationOrg: string | null;
    receiveMethod: "digital_pdf" | "paper_stamped" | null;
  };
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
}

export interface PreviewFieldsPatch {
  purpose: string | null;
  destination_org: string | null;
  receive_method: "digital_pdf" | "paper_stamped" | null;
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

export function mapPreview(raw: unknown): CampusPreview {
  const record = requireRecord(raw, "preview");
  const fields = requireRecord(record.fields, "preview.fields");
  const receive = fields.receive_method;
  if (receive !== null && receive !== "digital_pdf" && receive !== "paper_stamped") {
    throw new DataGatewayError("validation", "Invalid preview receive_method");
  }
  const missing = Array.isArray(record.missing_fields)
    ? (record.missing_fields.filter(
        (item) => item === "purpose" || item === "destination_org" || item === "receive_method"
      ) as PreviewFieldKey[])
    : [];
  const invalid = Array.isArray(record.invalid_fields)
    ? record.invalid_fields.flatMap((item): Array<{ field: PreviewFieldKey; reason: string }> => {
        if (!isRecord(item)) return [];
        const field = item.field;
        if (field !== "purpose" && field !== "destination_org" && field !== "receive_method") return [];
        if (typeof item.reason !== "string") return [];
        return [{ field, reason: item.reason }];
      })
    : [];
  return {
    id: requireString(record.id, "preview.id"),
    version: requireNumber(record.version, "preview.version"),
    canSubmit: record.can_submit === true,
    expiresAt: requireString(record.expires_at, "preview.expires_at"),
    serviceType: "student_certificate",
    fields: {
      purpose: typeof fields.purpose === "string" ? fields.purpose : null,
      destinationOrg: typeof fields.destination_org === "string" ? fields.destination_org : null,
      receiveMethod: receive,
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
  const purpose = typeof requestData?.purpose === "string" ? requestData.purpose : "";
  const destinationOrg = typeof requestData?.destination_org === "string" ? requestData.destination_org : "";
  const receiveMethod =
    requestData?.receive_method === "paper_stamped" || requestData?.receive_method === "digital_pdf"
      ? requestData.receive_method
      : "";
  const summary = requireString(record.summary, "ticket.summary");
  const reasons = Array.isArray(record.priority_reasons)
    ? record.priority_reasons.filter((item): item is string => typeof item === "string")
    : [];
  const isComplaint = category === "complaint" || serviceType === "academic_complaint";
  return {
    id: requireString(record.id, "ticket.id"),
    code: requireString(record.code, "ticket.code"),
    title: summary,
    type: asTicketType(serviceType),
    studentId: requireString(record.student_id, "ticket.student_id"),
    studentName: "",
    studentMssv: "",
    studentMajor: "",
    studentClassYear: "",
    studentEmail: "",
    status,
    priority,
    priorityReason: reasons[0],
    createdAt: requireString(record.created_at, "ticket.created_at"),
    submittedAt: requireString(record.created_at, "ticket.created_at"),
    slaDeadline: "",
    certificateType: serviceType === "student_certificate" ? "Giấy xác nhận sinh viên" : "",
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
    isL4: isComplaint,
    l4TriggerReason: typeof record.handover_reason === "string" ? record.handover_reason : undefined,
    messages: extras?.messages ?? [],
    auditLogs: extras?.auditLogs ?? [],
    serverRevision: requireNumber(record.revision, "ticket.revision"),
    conversationId: requireString(record.conversation_id, "ticket.conversation_id"),
    category: category === "complaint" ? "complaint" : "action",
    serviceType,
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
  const actorType = record.actor_type === "officer" ? "Cán bộ" : record.actor_type === "student" ? "Sinh viên" : "Hệ thống";
  return {
    id: requireString(record.id, "audit.id"),
    timestamp: requireString(record.created_at, "audit.created_at"),
    source: actorType,
    action: requireString(record.action, "audit.action"),
    actor: typeof record.actor_id === "string" ? record.actor_id : actorType,
    details: record.request_id && typeof record.request_id === "string" ? `request_id ${record.request_id}` : undefined,
  };
}

export function mapTicketDetail(raw: unknown, auditLogs: AuditLogEntry[] = []): Ticket {
  const record = requireRecord(raw, "ticket_detail");
  const messagesPage = parsePage(record.messages, mapWireMessageToTicketMessage, "ticket_detail.messages");
  return mapWireTicket(record.ticket, { messages: messagesPage.items, auditLogs });
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
        const statusValue =
          item.verification_status === "verified" || item.verification_status === "disputed"
            ? item.verification_status
            : "unverified";
        return [
          {
            id: `${item.source_id || item.key}-${index}`,
            key: item.key,
            source: typeof item.source_type === "string" ? item.source_type : "",
            value: item.value,
            status: statusValue,
            statusText:
              statusValue === "verified" ? "Đã xác minh" : statusValue === "disputed" ? "Đang tranh chấp" : "Chưa xác minh",
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
    errorMessage: typeof error?.code === "string" ? error.code : null,
    modelName: typeof artifactMeta?.model_name === "string" ? artifactMeta.model_name : null,
    promptVersion: typeof artifactMeta?.prompt_version === "string" ? artifactMeta.prompt_version : null,
    templateVersion: typeof artifactMeta?.template_version === "string" ? artifactMeta.template_version : null,
    indexVersion: typeof artifactMeta?.index_version === "string" ? artifactMeta.index_version : null,
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
  };
}

export function fieldsFromForm(fields: {
  purpose: string;
  destinationOrg: string;
  receiveMethod: "digital_pdf" | "paper_stamped" | "";
}): PreviewFieldsPatch {
  return {
    purpose: fields.purpose.trim() ? fields.purpose.trim() : null,
    destination_org: fields.destinationOrg.trim() ? fields.destinationOrg.trim() : null,
    receive_method: fields.receiveMethod === "digital_pdf" || fields.receiveMethod === "paper_stamped" ? fields.receiveMethod : null,
  };
}
