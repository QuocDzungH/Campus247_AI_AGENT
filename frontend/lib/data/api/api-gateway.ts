import { CampusDataGateway, SessionOptions } from "../gateway";
import {
  User,
  UserRole,
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
} from "../../types";
import { UnsupportedOperationError, DataGatewayError } from "../errors";
import { applyBriefToTicket, decideReviewedBriefVersion, isBriefPollComplete, markBriefLoadFailure } from "./g2-flow";
import { ApiClient, INTAKE_API_TIMEOUT_MS } from "./api-client";
import { createBrowserSessionStore, SessionStore } from "./session";
import { LoginResult } from "./types";
import {
  BriefView,
  CampusPreview,
  ChatTurnResult,
  ConversationView,
  PreviewFieldsPatch,
  mapAuditEntry,
  mapBrief,
  mapChatResult,
  mapConversation,
  mapConversationToSession,
  mapPreview,
  mapTicketDetail,
  mapWireMessageToChat,
  mapWireTicket,
  parsePage,
} from "./mappers";
import { pollUntil, requestUntilComplete } from "./replay";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUserRole(value: unknown): value is UserRole {
  return value === "student" || value === "officer";
}

export class ApiCampusDataGateway implements CampusDataGateway {
  private client: ApiClient;
  private sessionStore: SessionStore;
  private authEpoch = 0;

  constructor(baseUrl: string, options?: { client?: ApiClient; sessionStore?: SessionStore }) {
    this.client = options?.client ?? new ApiClient(baseUrl);
    this.sessionStore = options?.sessionStore ?? createBrowserSessionStore();
    const existing = this.sessionStore.load();
    if (existing) this.client.setAccessToken(existing.access_token);
  }

  private beginAuthEpoch(): number {
    this.authEpoch += 1;
    return this.authEpoch;
  }

  mapToUser(data: unknown): User {
    if (!isRecord(data)) {
      throw new DataGatewayError("validation", "Invalid user data received from API");
    }
    if (typeof data.id !== "string" || typeof data.name !== "string") {
      throw new DataGatewayError("validation", "Missing required user fields");
    }
    if (!isUserRole(data.role)) {
      throw new DataGatewayError("validation", `Invalid user role: ${String(data.role)}`);
    }

    return {
      id: data.id,
      name: data.name,
      role: data.role,
      email: typeof data.email === "string" ? data.email : "",
      mssv: typeof data.mssv === "string" ? data.mssv : undefined,
      major: typeof data.major === "string" ? data.major : undefined,
      classYear: typeof data.classYear === "string" ? data.classYear : undefined,
    };
  }

  private parseLoginResult(data: unknown): LoginResult {
    if (!isRecord(data)) {
      throw new DataGatewayError("validation", "Invalid login result received from API");
    }
    if (typeof data.access_token !== "string" || data.access_token.length === 0) {
      throw new DataGatewayError("validation", "Login result is missing access_token");
    }
    if (typeof data.expires_at !== "string") {
      throw new DataGatewayError("validation", "Login result is missing expires_at");
    }
    const user = this.mapToUser(data.user);
    return {
      access_token: data.access_token,
      token_type: "Bearer",
      expires_at: data.expires_at,
      user: { id: user.id, role: user.role, name: user.name },
    };
  }

  private persistSession(result: LoginResult, remember: boolean): User {
    this.client.setAccessToken(result.access_token);
    this.sessionStore.save({
      access_token: result.access_token,
      token_type: "Bearer",
      expires_at: result.expires_at,
      user: result.user,
      remember,
    });
    return this.mapToUser(result.user);
  }

  async login(userId: string, options?: SessionOptions): Promise<User> {
    const epoch = this.beginAuthEpoch();
    try {
      const response = await this.client.request<LoginResult>("/api/v1/auth/demo-login", {
        method: "POST",
        body: { user_id: userId },
        skipAuth: true,
        skipIdempotency: true,
      });
      const result = this.parseLoginResult(response.body);
      if (epoch !== this.authEpoch) {
        return this.mapToUser(result.user);
      }
      return this.persistSession(result, options?.remember !== false);
    } catch (err) {
      if (err instanceof DataGatewayError && err.reason === "not_found") {
        throw new DataGatewayError("unauthorized", "User not found (HTTP 404)");
      }
      throw err;
    }
  }

  async restoreSession(): Promise<User | null> {
    const stored = this.sessionStore.load();
    if (!stored) {
      this.client.setAccessToken(null);
      return null;
    }
    const token = stored.access_token;
    this.client.setAccessToken(token);
    try {
      const me = await this.client.get("/api/v1/me", { skipIdempotency: true });
      return this.mapToUser(me);
    } catch (err) {
      if (err instanceof DataGatewayError && err.reason === "unauthorized") {
        this.client.clearAccessTokenIfCurrent(token);
        this.sessionStore.clearIfCurrent(token);
        return null;
      }
      throw err;
    }
  }

  async endSession(): Promise<void> {
    this.beginAuthEpoch();
    const token = this.client.getAccessToken();
    if (token) {
      this.sessionStore.clearIfCurrent(token);
      this.client.clearAccessTokenIfCurrent(token);
    } else {
      this.sessionStore.clear();
      this.client.setAccessToken(null);
    }
    this.client.abortInFlight();
    if (!token) return;
    try {
      await this.client.request("/api/v1/auth/logout", {
        method: "POST",
        body: {},
        skipAuth: true,
        skipIdempotency: true,
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Local session was already discarded before this request.
    }
  }

  abortRequests(): void {
    this.client.abortInFlight();
  }

  private actorRole(): UserRole | null {
    return this.sessionStore.load()?.user.role ?? null;
  }

  private async collectPages<T>(path: string, mapItem: (item: unknown) => T): Promise<T[]> {
    const pageSize = 100;
    const firstBody = await this.client.get(`${path}${path.includes("?") ? "&" : "?"}page=1&page_size=${pageSize}`, {
      skipIdempotency: true,
    });
    const first = parsePage(firstBody, mapItem, path);
    const items = [...first.items];
    const totalPages = Math.max(1, Math.ceil(first.total / pageSize));
    for (let page = 2; page <= totalPages; page += 1) {
      const body = await this.client.get(`${path}${path.includes("?") ? "&" : "?"}page=${page}&page_size=${pageSize}`, {
        skipIdempotency: true,
      });
      items.push(...parsePage(body, mapItem, path).items);
    }
    return items;
  }

  async resetDemoData(): Promise<void> {
    throw new UnsupportedOperationError("resetDemoData");
  }

  async getTickets(): Promise<Ticket[]> {
    const role = this.actorRole();
    const path = role === "officer" ? "/api/v1/officer/tickets" : "/api/v1/tickets";
    return this.collectPages(path, mapWireTicket);
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    try {
      return await this.getTicketDetail(id);
    } catch (err) {
      if (err instanceof DataGatewayError && err.reason === "not_found") return undefined;
      throw err;
    }
  }

  async getTicketDetail(id: string): Promise<Ticket> {
    const body = await this.client.get(`/api/v1/tickets/${encodeURIComponent(id)}?page=1&page_size=100`, {
      skipIdempotency: true,
    });
    let auditLogs: Ticket["auditLogs"] = [];
    let auditLoadError: string | undefined;
    if (this.actorRole() === "officer") {
      try {
        auditLogs = await this.listAudit(id);
      } catch (error) {
        auditLoadError = error instanceof Error ? error.message : "Không tải được nhật ký.";
      }
    }
    let ticket = mapTicketDetail(body, auditLogs);
    if (auditLoadError) ticket.auditLoadError = auditLoadError;
    if (this.actorRole() === "officer") {
      try {
        const brief = await this.getBrief(id);
        ticket = applyBriefToTicket(ticket, brief);
      } catch (error) {
        const dataError =
          error instanceof DataGatewayError
            ? error
            : new DataGatewayError("unknown", error instanceof Error ? error.message : String(error), error);
        ticket = markBriefLoadFailure(ticket, dataError);
      }
    }
    return ticket;
  }

  async listAudit(ticketId: string): Promise<Ticket["auditLogs"]> {
    return this.collectPages(
      `/api/v1/officer/tickets/${encodeURIComponent(ticketId)}/audit`,
      mapAuditEntry
    );
  }

  async createTicket(_currentUser: User, _data: Partial<Ticket>): Promise<Ticket> {
    throw new UnsupportedOperationError("createTicket");
  }

  async updateTicketStatus(_id: string, _status: TicketStatus, _actorName: string): Promise<void> {
    throw new UnsupportedOperationError("updateTicketStatus");
  }

  async updateOfficerDraft(_id: string, _draft: string): Promise<void> {
    // G2: officer draft stays in the browser session. No P0 draft endpoint.
  }

  async resetOfficerDraft(_id: string): Promise<void> {
    // G2: local draft only.
  }

  async toggleChecklistItem(_ticketId: string, _itemId: string): Promise<void> {
    throw new UnsupportedOperationError("toggleChecklistItem");
  }

  async addTicketMessage(
    ticketId: string,
    message: Omit<TicketMessage, "id" | "timestamp">
  ): Promise<void> {
    await this.sendTicketMessage(ticketId, message.content);
  }

  async sendTicketMessage(
    ticketId: string,
    content: string,
    options?: { signal?: AbortSignal; idempotencyKey?: string }
  ): Promise<ChatTurnResult> {
    const result = await requestUntilComplete(
      this.client,
      `/api/v1/tickets/${encodeURIComponent(ticketId)}/messages`,
      {
        method: "POST",
        body: { content },
        timeoutMs: INTAKE_API_TIMEOUT_MS,
        signal: options?.signal,
        idempotencyKey: options?.idempotencyKey,
      }
    );
    return mapChatResult(result.body);
  }

  async submitGate2Response(
    ticketId: string,
    actionType: "respond" | "request_info" | "resolve",
    customContent?: string,
    _actor?: User,
    expectedSnapshot?: string
  ): Promise<void> {
    const ticket = await this.getTicketDetail(ticketId);
    const briefGate = decideReviewedBriefVersion(ticket, {
      manualBrief: expectedSnapshot === "manual-brief",
    });
    if (!briefGate.ok) throw new DataGatewayError("validation", briefGate.reason);
    await this.submitOfficerAction(ticketId, {
      action: actionType,
      content: customContent?.trim() || "Đã xử lý yêu cầu.",
      expectedRevision: ticket.serverRevision ?? 1,
      reviewedBriefVersion: briefGate.reviewedBriefVersion,
    });
  }

  async submitOfficerAction(
    ticketId: string,
    payload: {
      action: "respond" | "request_info" | "resolve";
      content: string;
      expectedRevision: number;
      reviewedBriefVersion: number | null;
      idempotencyKey?: string;
    }
  ): Promise<Ticket> {
    const result = await requestUntilComplete(this.client, `/api/v1/officer/tickets/${encodeURIComponent(ticketId)}/actions`, {
      method: "POST",
      body: {
        action: payload.action,
        content: payload.content,
        expected_revision: payload.expectedRevision,
        reviewed_brief_version: payload.reviewedBriefVersion,
        confirmed: true,
      },
      idempotencyKey: payload.idempotencyKey,
    });
    const body = result.body;
    if (!body || typeof body !== "object" || !("ticket" in body)) {
      throw new DataGatewayError("validation", "Invalid Submit2 result");
    }
    return mapWireTicket((body as { ticket: unknown }).ticket);
  }

  async createConversation(options?: { idempotencyKey?: string }): Promise<ConversationView> {
    const result = await requestUntilComplete(this.client, "/api/v1/conversations", {
      method: "POST",
      body: {},
      idempotencyKey: options?.idempotencyKey,
    });
    return mapConversation(result.body);
  }

  async sendConversationMessage(
    conversationId: string,
    content: string,
    options?: { signal?: AbortSignal; idempotencyKey?: string }
  ): Promise<ChatTurnResult> {
    const result = await requestUntilComplete(
      this.client,
      `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        body: { content },
        timeoutMs: INTAKE_API_TIMEOUT_MS,
        signal: options?.signal,
        idempotencyKey: options?.idempotencyKey,
      }
    );
    return mapChatResult(result.body);
  }

  async listConversationMessages(conversationId: string): Promise<ChatMessage[]> {
    return this.collectPages(
      `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
      (item) => mapWireMessageToChat(item)
    );
  }

  async patchPreview(
    previewId: string,
    expectedVersion: number,
    fields: PreviewFieldsPatch,
    options?: { idempotencyKey?: string }
  ): Promise<CampusPreview> {
    const result = await requestUntilComplete(this.client, `/api/v1/previews/${encodeURIComponent(previewId)}`, {
      method: "PATCH",
      body: { expected_version: expectedVersion, fields },
      idempotencyKey: options?.idempotencyKey,
    });
    return mapPreview(result.body);
  }

  async submitPreview(
    previewId: string,
    previewVersion: number,
    options?: { idempotencyKey?: string }
  ): Promise<Ticket> {
    const result = await requestUntilComplete(this.client, "/api/v1/tickets", {
      method: "POST",
      body: { preview_id: previewId, preview_version: previewVersion, confirmed: true },
      idempotencyKey: options?.idempotencyKey,
    });
    const body = result.body;
    if (!body || typeof body !== "object" || !("ticket" in body)) {
      throw new DataGatewayError("validation", "Invalid Submit1 result");
    }
    return mapWireTicket((body as { ticket: unknown }).ticket);
  }

  async claimTicket(
    ticketId: string,
    expectedRevision: number,
    options?: { idempotencyKey?: string }
  ): Promise<Ticket> {
    const result = await requestUntilComplete(
      this.client,
      `/api/v1/officer/tickets/${encodeURIComponent(ticketId)}/claim`,
      {
        method: "POST",
        body: { expected_revision: expectedRevision, confirmed: true },
        idempotencyKey: options?.idempotencyKey,
      }
    );
    const body = result.body;
    if (!body || typeof body !== "object" || !("ticket" in body)) {
      throw new DataGatewayError("validation", "Invalid claim result");
    }
    return mapWireTicket((body as { ticket: unknown }).ticket);
  }

  async getBrief(ticketId: string): Promise<BriefView> {
    const body = await this.client.get(`/api/v1/officer/tickets/${encodeURIComponent(ticketId)}/brief`, {
      skipIdempotency: true,
    });
    return mapBrief(body);
  }

  async prepareBrief(
    ticketId: string,
    expectedRevision: number,
    options?: { signal?: AbortSignal; idempotencyKey?: string }
  ): Promise<BriefView> {
    const accepted = await requestUntilComplete(
      this.client,
      `/api/v1/officer/tickets/${encodeURIComponent(ticketId)}/prepare`,
      {
        method: "POST",
        body: { expected_revision: expectedRevision },
        idempotencyKey: options?.idempotencyKey,
        signal: options?.signal,
      }
    );
    if (accepted.status !== 202 && accepted.status !== 200) {
      throw new DataGatewayError("server", `Unexpected prepare status ${accepted.status}`);
    }
    return pollUntil(
      () => this.getBrief(ticketId),
      (brief) => isBriefPollComplete(brief, expectedRevision),
      { maxAttempts: 20, intervalMs: 2000, signal: options?.signal }
    );
  }

  // --- Certificates ---
  async runTicketVerification(_ticketId: string): Promise<void> {
    throw new UnsupportedOperationError("runTicketVerification");
  }

  async retryCriterionVerification(_ticketId: string, _criterionId: string): Promise<void> {
    throw new UnsupportedOperationError("retryCriterionVerification");
  }

  async confirmCriterionReview(_ticketId: string, _criterionId: string, _note?: string): Promise<void> {
    throw new UnsupportedOperationError("confirmCriterionReview");
  }

  async updateCertificateDraft(_ticketId: string, _edits: Partial<IssuedCertificateDocument>): Promise<void> {
    throw new UnsupportedOperationError("updateCertificateDraft");
  }

  async getChatSessions(): Promise<ChatSession[]> {
    if (this.actorRole() !== "student") return [];
    const conversations = await this.collectPages("/api/v1/conversations", mapConversation);
    return conversations.map((conversation) => mapConversationToSession(conversation));
  }

  async createChatSession(): Promise<ChatSession> {
    const conversation = await this.createConversation({ idempotencyKey: crypto.randomUUID() });
    return mapConversationToSession(conversation);
  }

  async deleteChatSession(_sessionId: string): Promise<void> {
    throw new UnsupportedOperationError("deleteChatSession");
  }

  async addChatMessage(sessionId: string, msg: Omit<ChatMessage, "id" | "timestamp">): Promise<void> {
    if (msg.sender !== "user") return;
    await this.sendConversationMessage(sessionId, msg.text);
  }

  async updateChatSessionGate1(
    _sessionId: string,
    _formData: NonNullable<ChatSession["gate1FormData"]>
  ): Promise<void> {
    // Preview edits go through patchPreview in API mode.
  }

  async updateChatSessionL4(_sessionId: string, _isActive: boolean): Promise<void> {
    // Lock comes from ChatResult.conversation_state, not a client write.
  }

  // --- Reviews ---
  async getReviewCases(): Promise<ReviewCase[]> {
    throw new UnsupportedOperationError("getReviewCases");
  }

  async getReviewCase(_id: string): Promise<ReviewCase | undefined> {
    throw new UnsupportedOperationError("getReviewCase");
  }

  async createReviewCase(_data: Partial<ReviewCase>): Promise<ReviewCase> {
    throw new UnsupportedOperationError("createReviewCase");
  }

  async runAiReview(_caseId: string): Promise<void> {
    throw new UnsupportedOperationError("runAiReview");
  }

  async updateFindingReview(
    _caseId: string,
    _findingId: string,
    _updates: {
      officerStatus: FindingOfficerStatus;
      officerAdjustedLabel?: FindingAiLabel;
      officerNote?: string;
    }
  ): Promise<void> {
    throw new UnsupportedOperationError("updateFindingReview");
  }

  async sendSupplementRequest(_caseId: string, _request: SupplementRequest): Promise<void> {
    throw new UnsupportedOperationError("sendSupplementRequest");
  }

  async submitStudentSupplement(
    _caseId: string,
    _payload: { note: string; docTitle?: string; fileName?: string; versionToActivate?: number }
  ): Promise<void> {
    throw new UnsupportedOperationError("submitStudentSupplement");
  }

  async finalizeReviewCase(_caseId: string, _report: NonNullable<ReviewCase["finalReport"]>): Promise<void> {
    throw new UnsupportedOperationError("finalizeReviewCase");
  }

  async getDemoUsers(): Promise<User[]> {
    throw new UnsupportedOperationError("getDemoUsers");
  }
}
