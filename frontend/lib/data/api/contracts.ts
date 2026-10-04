export type WireRole = "student" | "officer";
export type WireStatus = "open" | "pending_officer" | "resolved";
export type WirePriority = "normal" | "high";
export type WireRoute = "L1" | "L2" | "L4";
export type WireReceiveMethod = "digital_pdf" | "paper_stamped";
export type WireConversationStatus = "active" | "handover" | "closed";
export type WireHandoverStatus = "none" | "pending" | "failed" | "completed";
export type WireMessageSender = "student" | "officer" | "assistant" | "system";
export type WireBriefStatus = "pending" | "processing" | "ready" | "failed" | "stale";
export type WireJobStatus = "pending" | "processing";
export type WireOfficerAction = "respond" | "request_info" | "resolve";
export type WirePreviewField =
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
export type WireComplaintSubtype = "grade_appeal" | "other";
export type WireIntakeService = "student_certificate" | "academic_complaint";

export interface WirePage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface WireFields {
  purpose: string | null;
  destination_org: string | null;
  receive_method: WireReceiveMethod | null;
  complaint_subtype?: WireComplaintSubtype | null;
  course?: string | null;
  course_code?: string | null;
  assessment?: string | null;
  description?: string | null;
  requested_outcome?: string | null;
  evidence?: string | null;
  extras?: Record<string, string>;
}

export interface WireFieldIssue {
  field: WirePreviewField;
  reason: string;
}

export interface WirePreview {
  id: string;
  version: number;
  can_submit: boolean;
  expires_at: string;
  service_type: WireIntakeService;
  fields: WireFields;
  missing_fields: WirePreviewField[];
  invalid_fields: WireFieldIssue[];
}

export interface WireCitation {
  document_id: string;
  document_title: string;
  document_version: string;
  chunk_id: string;
  locator: string;
  quote: string;
  url: string | null;
}

export interface WireMessage {
  id: string;
  conversation_id: string;
  ticket_id: string | null;
  sender: WireMessageSender;
  content: string;
  created_at: string;
}

export interface WireConversationState {
  status: WireConversationStatus;
  ai_response_locked: boolean;
  handover_status: WireHandoverStatus;
}

export interface WireConversation extends WireConversationState {
  id: string;
  revision: number;
  ticket_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WireTicketRef {
  id: string;
  code: string;
  status: WireStatus;
  priority: WirePriority;
}

export interface WireTicket extends WireTicketRef {
  conversation_id: string;
  student_id: string;
  category: "action" | "complaint";
  service_type: "student_certificate" | "academic_complaint" | "student_support";
  priority_reasons: string[];
  summary: string;
  request_data: WireFields | null;
  handover_reason: string | null;
  assigned_officer_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface WireChatResult {
  conversation_id: string;
  user_message_id: string;
  route: WireRoute;
  outcome: string;
  reply: WireMessage;
  citations: WireCitation[];
  preview: WirePreview | null;
  ticket: WireTicketRef | null;
  conversation_state: WireConversationState;
}

export interface WireSubmit1Result {
  ticket: WireTicket;
  brief_status: "pending";
}

export interface WireSubmit2Result {
  ticket: WireTicket;
  message: WireMessage;
  audit_id: string;
}

export interface WireClaimResult {
  ticket: WireTicket;
  audit_id: string;
}

export interface WireTicketDetail {
  ticket: WireTicket;
  messages: WirePage<WireMessage>;
}

export interface WireAuditEntry {
  id: string;
  ticket_id: string;
  actor_id: string | null;
  actor_type: "student" | "officer" | "system";
  action: string;
  from_status: WireStatus | null;
  to_status: WireStatus | null;
  request_id: string;
  created_at: string;
}

export interface WireFact {
  key: string;
  value: string;
  source_type: string;
  source_id: string;
  verification_status: "unverified" | "verified" | "disputed";
}

export interface WireChecklistItem {
  id: string;
  label: string;
  checked: false;
}

export interface WireOfficerBrief {
  ticket_id: string;
  source_ticket_revision: number;
  summary: string;
  facts: WireFact[];
  missing_items: Array<{ field: string; reason: string }>;
  checklist: WireChecklistItem[];
  suggested_priority: WirePriority;
  priority_reasons: string[];
  draft_reply: string | null;
  citations: WireCitation[];
  warnings: Array<{ code: string; message: string }>;
  quality_status: "pass" | "fail";
}

export interface WireArtifact {
  brief: WireOfficerBrief;
  brief_version: number;
  source_ticket_revision: number;
  model_name: string;
  prompt_version: string;
  template_version: string;
  index_version: string | null;
  created_at: string;
}

export interface WireModuleError {
  code: string;
  retryable: boolean;
  stage: string;
  request_id: string;
}

export interface WireBriefEnvelope {
  status: WireBriefStatus;
  current_ticket_revision: number;
  brief_version: number | null;
  source_ticket_revision: number | null;
  artifact: WireArtifact | null;
  error: WireModuleError | null;
}

export interface WireJobAccepted {
  job_id: string;
  ticket_id: string;
  source_ticket_revision: number;
  status: WireJobStatus;
}

export interface WireProcessing {
  operation_id: string;
  status: "processing";
  poll_after_ms: 2000;
}
