/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { ApiClient } from "./api-client";
import { createBrowserSessionStore, SessionStore } from "./session";
import { LoginResult } from "./types";

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

  async resetDemoData(): Promise<void> {
    throw new UnsupportedOperationError("resetDemoData");
  }

  // --- Tickets ---
  async getTickets(): Promise<Ticket[]> {
    throw new UnsupportedOperationError("getTickets");
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    throw new UnsupportedOperationError("getTicket");
  }

  async createTicket(currentUser: User, data: Partial<Ticket>): Promise<Ticket> {
    throw new UnsupportedOperationError("createTicket");
  }

  async updateTicketStatus(id: string, status: TicketStatus, actorName: string): Promise<void> {
    throw new UnsupportedOperationError("updateTicketStatus");
  }

  async updateOfficerDraft(id: string, draft: string): Promise<void> {
    throw new UnsupportedOperationError("updateOfficerDraft");
  }

  async resetOfficerDraft(id: string): Promise<void> {
    throw new UnsupportedOperationError("resetOfficerDraft");
  }

  async toggleChecklistItem(ticketId: string, itemId: string): Promise<void> {
    throw new UnsupportedOperationError("toggleChecklistItem");
  }

  async addTicketMessage(
    ticketId: string,
    message: Omit<TicketMessage, "id" | "timestamp">
  ): Promise<void> {
    throw new UnsupportedOperationError("addTicketMessage");
  }

  async submitGate2Response(
    ticketId: string,
    actionType: "respond" | "request_info" | "resolve",
    customContent?: string
  ): Promise<void> {
    throw new UnsupportedOperationError("submitGate2Response");
  }

  // --- Certificates ---
  async runTicketVerification(ticketId: string): Promise<void> {
    throw new UnsupportedOperationError("runTicketVerification");
  }

  async retryCriterionVerification(ticketId: string, criterionId: string): Promise<void> {
    throw new UnsupportedOperationError("retryCriterionVerification");
  }

  async confirmCriterionReview(ticketId: string, criterionId: string, note?: string): Promise<void> {
    throw new UnsupportedOperationError("confirmCriterionReview");
  }

  async updateCertificateDraft(ticketId: string, edits: Partial<IssuedCertificateDocument>): Promise<void> {
    throw new UnsupportedOperationError("updateCertificateDraft");
  }

  // --- Chat ---
  async getChatSessions(): Promise<ChatSession[]> {
    throw new UnsupportedOperationError("getChatSessions");
  }

  async createChatSession(): Promise<ChatSession> {
    throw new UnsupportedOperationError("createChatSession");
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    throw new UnsupportedOperationError("deleteChatSession");
  }

  async addChatMessage(sessionId: string, msg: Omit<ChatMessage, "id" | "timestamp">): Promise<void> {
    throw new UnsupportedOperationError("addChatMessage");
  }

  async updateChatSessionGate1(
    sessionId: string,
    formData: NonNullable<ChatSession["gate1FormData"]>
  ): Promise<void> {
    throw new UnsupportedOperationError("updateChatSessionGate1");
  }

  async updateChatSessionL4(sessionId: string, isActive: boolean): Promise<void> {
    throw new UnsupportedOperationError("updateChatSessionL4");
  }

  // --- Reviews ---
  async getReviewCases(): Promise<ReviewCase[]> {
    throw new UnsupportedOperationError("getReviewCases");
  }

  async getReviewCase(id: string): Promise<ReviewCase | undefined> {
    throw new UnsupportedOperationError("getReviewCase");
  }

  async createReviewCase(data: Partial<ReviewCase>): Promise<ReviewCase> {
    throw new UnsupportedOperationError("createReviewCase");
  }

  async runAiReview(caseId: string): Promise<void> {
    throw new UnsupportedOperationError("runAiReview");
  }

  async updateFindingReview(
    caseId: string,
    findingId: string,
    updates: {
      officerStatus: FindingOfficerStatus;
      officerAdjustedLabel?: FindingAiLabel;
      officerNote?: string;
    }
  ): Promise<void> {
    throw new UnsupportedOperationError("updateFindingReview");
  }

  async sendSupplementRequest(caseId: string, request: SupplementRequest): Promise<void> {
    throw new UnsupportedOperationError("sendSupplementRequest");
  }

  async submitStudentSupplement(
    caseId: string,
    payload: { note: string; docTitle?: string; fileName?: string; versionToActivate?: number }
  ): Promise<void> {
    throw new UnsupportedOperationError("submitStudentSupplement");
  }

  async finalizeReviewCase(caseId: string, report: NonNullable<ReviewCase["finalReport"]>): Promise<void> {
    throw new UnsupportedOperationError("finalizeReviewCase");
  }

  async getDemoUsers(): Promise<User[]> {
    throw new UnsupportedOperationError("getDemoUsers");
  }
}
