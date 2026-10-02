import {
  User,
  Ticket,
  TicketStatus,
  TicketMessage,
  ChatMessage,
  ChatSession,
  ReviewCase,
  FindingOfficerStatus,
  FindingAiLabel,
  SupplementRequest,
  IssuedCertificateDocument,
  StoredAttachment,
} from "../types";
import type {
  BriefView,
  CampusPreview,
  ChatTurnResult,
  ConversationView,
  PreviewFieldsPatch,
} from "./api/mappers";

export interface SessionOptions {
  remember?: boolean;
}

export interface CampusDataGateway {
  // Auth
  login(userId: string, options?: SessionOptions): Promise<User>;
  restoreSession?(): Promise<User | null>;
  endSession?(): Promise<void>;
  abortRequests?(): void;

  // Tickets
  getTickets(): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(student: User, data: Partial<Ticket>): Promise<Ticket>;
  updateTicketStatus(id: string, status: TicketStatus, actorName: string): Promise<void>;
  updateOfficerDraft(id: string, draft: string, actor?: User, expectedDraft?: string): Promise<void>;
  resetOfficerDraft(id: string): Promise<void>;
  toggleChecklistItem(ticketId: string, itemId: string): Promise<void>;
  addTicketMessage(
    ticketId: string,
    message: Omit<TicketMessage, "id" | "timestamp">
  ): Promise<void>;
  submitGate2Response(
    ticketId: string,
    actionType: "respond" | "request_info" | "resolve",
    customContent?: string,
    actor?: User,
    expectedSnapshot?: string
  ): Promise<void>;

  // Certificate Verification & BM-03 Issuance
  runTicketVerification(ticketId: string): Promise<void>;
  retryCriterionVerification(ticketId: string, criterionId: string): Promise<void>;
  confirmCriterionReview(ticketId: string, criterionId: string, note?: string): Promise<void>;
  updateCertificateDraft(ticketId: string, edits: Partial<IssuedCertificateDocument>): Promise<void>;

  // Chat Assistant State & Sessions
  getChatSessions(): Promise<ChatSession[]>;
  createChatSession(): Promise<ChatSession>;
  deleteChatSession(sessionId: string): Promise<void>;
  addChatMessage(sessionId: string, msg: Omit<ChatMessage, "id" | "timestamp">): Promise<void>;
  updateChatSessionGate1(
    sessionId: string,
    formData: NonNullable<ChatSession["gate1FormData"]>
  ): Promise<void>;
  updateChatSessionL4(sessionId: string, isActive: boolean): Promise<void>;

  // Academic Review Cases
  getReviewCases(): Promise<ReviewCase[]>;
  getReviewCase(id: string): Promise<ReviewCase | undefined>;
  createReviewCase(data: Partial<ReviewCase>): Promise<ReviewCase>;
  runAiReview(caseId: string): Promise<void>;
  updateFindingReview(
    caseId: string,
    findingId: string,
    updates: {
      officerStatus: FindingOfficerStatus;
      officerAdjustedLabel?: FindingAiLabel;
      officerNote?: string;
    },
    actor?: User,
    expectedSnapshot?: string
  ): Promise<void>;
  sendSupplementRequest(caseId: string, request: SupplementRequest, actor?: User, expectedSnapshot?: string): Promise<void>;
  submitStudentSupplement(
    caseId: string,
    payload: {
      note: string;
      docTitle?: string;
      fileName?: string;
      versionToActivate?: number;
      attachment?: StoredAttachment;
    }
  ): Promise<void>;
  finalizeReviewCase(caseId: string, report: NonNullable<ReviewCase["finalReport"]>, expectedSnapshot?: string): Promise<void>;

  // Demo / UAT Utilities
  getDemoUsers(): Promise<User[]>;
  resetDemoData(): Promise<void>;

  // P0 API operations. Mock mode leaves these unimplemented.
  createConversation?(options?: { idempotencyKey?: string }): Promise<ConversationView>;
  sendConversationMessage?(
    conversationId: string,
    content: string,
    options?: { signal?: AbortSignal; idempotencyKey?: string }
  ): Promise<ChatTurnResult>;
  listConversationMessages?(conversationId: string): Promise<ChatMessage[]>;
  patchPreview?(
    previewId: string,
    expectedVersion: number,
    fields: PreviewFieldsPatch,
    options?: { idempotencyKey?: string }
  ): Promise<CampusPreview>;
  submitPreview?(
    previewId: string,
    previewVersion: number,
    options?: { idempotencyKey?: string }
  ): Promise<Ticket>;
  claimTicket?(
    ticketId: string,
    expectedRevision: number,
    options?: { idempotencyKey?: string }
  ): Promise<Ticket>;
  prepareBrief?(
    ticketId: string,
    expectedRevision: number,
    options?: { signal?: AbortSignal; idempotencyKey?: string }
  ): Promise<BriefView>;
  getBrief?(ticketId: string): Promise<BriefView>;
  getTicketDetail?(ticketId: string): Promise<Ticket>;
  listAudit?(ticketId: string): Promise<Ticket["auditLogs"]>;
  sendTicketMessage?(
    ticketId: string,
    content: string,
    options?: { signal?: AbortSignal; idempotencyKey?: string }
  ): Promise<ChatTurnResult>;
  submitOfficerAction?(
    ticketId: string,
    payload: {
      action: "respond" | "request_info" | "resolve";
      content: string;
      expectedRevision: number;
      reviewedBriefVersion: number | null;
      idempotencyKey?: string;
    }
  ): Promise<Ticket>;
}
