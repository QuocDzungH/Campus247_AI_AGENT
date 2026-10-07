import { DataGatewayError } from "../errors";
import type { Ticket } from "../../types";
import { errorDetails } from "./mappers";
import type { BriefView } from "./mappers";

export const MISSING_DATA_LABEL = "Chưa có dữ liệu";

export function displayValue(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value : MISSING_DATA_LABEL;
}

export function receiveMethodDisplay(value: string | null | undefined): string {
  if (value === "paper_stamped") return "Bản giấy có đóng dấu";
  if (value === "digital_pdf") return "Bản điện tử PDF";
  return MISSING_DATA_LABEL;
}

export function isConnectionError(error: unknown): boolean {
  if (!(error instanceof DataGatewayError)) return false;
  return error.reason === "network" || error.reason === "server";
}

export type LoginHydrateResult<TUser, TTickets, TSessions> =
  | { ok: true; user: TUser; tickets: TTickets; chatSessions: TSessions }
  | { ok: false; stage: "auth"; error?: unknown }
  | { ok: false; stage: "hydrate"; user: TUser; error: unknown };

export async function loginThenHydrate<TUser, TTickets, TSessions>(options: {
  login: () => Promise<TUser | null>;
  hydrate: (user: TUser) => Promise<{ tickets: TTickets; chatSessions: TSessions }>;
  isCurrent: () => boolean;
}): Promise<LoginHydrateResult<TUser, TTickets, TSessions>> {
  let user: TUser | null = null;
  try {
    user = await options.login();
  } catch (error) {
    if (!options.isCurrent()) return { ok: false, stage: "auth" };
    return { ok: false, stage: "auth", error };
  }
  if (!options.isCurrent() || !user) return { ok: false, stage: "auth" };
  try {
    const data = await options.hydrate(user);
    if (!options.isCurrent()) return { ok: false, stage: "auth" };
    return { ok: true, user, tickets: data.tickets, chatSessions: data.chatSessions };
  } catch (error) {
    if (!options.isCurrent()) return { ok: false, stage: "auth" };
    return { ok: false, stage: "hydrate", user, error };
  }
}

export function shouldCommitLoginSession(
  startedGeneration: number,
  currentGeneration: number,
  result: LoginHydrateResult<unknown, unknown, unknown>
): boolean {
  if (startedGeneration !== currentGeneration) return false;
  if (!result.ok && result.stage === "auth") return false;
  return true;
}

export function reuseOrMintIntentKey(existing?: string | null): string {
  if (typeof existing === "string" && existing.length > 0) return existing;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function shouldRetainIntentKey(error: unknown | undefined): boolean {
  if (error == null) return false;
  if (!(error instanceof DataGatewayError)) return true;
  if (error.retryable === false) return false;
  if (error.retryable === true) return true;
  if (error.reason === "network" || error.reason === "server") return true;
  if (typeof error.status === "number" && (error.status >= 500 || error.status === 429)) return true;
  return false;
}

export function isDisplayTicketCode(code: string | undefined | null, ticketId?: string): boolean {
  return typeof code === "string" && code.trim().length > 0 && code !== ticketId && !/^tkt_/i.test(code);
}

export function resolveSubmittedTicket(
  ticketId: string,
  fetched: Ticket | undefined,
  cached: Ticket | undefined
): Ticket | undefined {
  if (fetched && (fetched.id === ticketId || fetched.code === ticketId) && isDisplayTicketCode(fetched.code, fetched.id)) {
    return fetched;
  }
  if (cached && (cached.id === ticketId || cached.code === ticketId) && isDisplayTicketCode(cached.code, cached.id)) {
    return cached;
  }
  return undefined;
}

export type SubmitPreviewResult =
  | { status: "submitted"; ticket: Ticket }
  | { status: "pending_sync"; ticketId: string };

export function submittedPreviewResult(
  ticketId: string,
  fetched: Ticket | undefined,
  cached: Ticket | undefined
): SubmitPreviewResult {
  const ticket = resolveSubmittedTicket(ticketId, fetched, cached);
  if (ticket) return { status: "submitted", ticket };
  return { status: "pending_sync", ticketId };
}

export async function commitThenReconcile<T>(committed: T, refetch: () => Promise<T | undefined>): Promise<T> {
  try {
    const fresh = await refetch();
    return fresh ?? committed;
  } catch {
    return committed;
  }
}

export function isBriefPollComplete(
  brief: Pick<BriefView, "status" | "sourceTicketRevision">,
  expectedRevision: number
): boolean {
  if (brief.sourceTicketRevision != null && brief.sourceTicketRevision !== expectedRevision) return false;
  return brief.status === "ready" || brief.status === "failed" || brief.status === "stale";
}

export function alreadySubmittedTicketId(error: unknown): string | null {
  if (!(error instanceof DataGatewayError) || error.code !== "PREVIEW_ALREADY_SUBMITTED") return null;
  const details = errorDetails(error);
  return typeof details?.ticket_id === "string" && details.ticket_id ? details.ticket_id : null;
}

export type Submit2BriefDecision =
  | { ok: true; reviewedBriefVersion: number | null }
  | { ok: false; reason: string };

type BriefGateTicket = Pick<Ticket, "briefStatus" | "reviewedBriefVersion" | "briefLoadError"> & {
  officerBrief?: Pick<BriefView, "status" | "briefVersion"> | null;
};

function briefStatusOf(ticket: BriefGateTicket): Ticket["briefStatus"] {
  return ticket.officerBrief?.status ?? ticket.briefStatus;
}

function readyBriefVersion(ticket: BriefGateTicket): number | null {
  if (briefStatusOf(ticket) !== "ready") return null;
  if (ticket.officerBrief?.briefVersion != null) return ticket.officerBrief.briefVersion;
  return ticket.reviewedBriefVersion ?? null;
}

export function decideReviewedBriefVersion(
  ticket: BriefGateTicket,
  options: { manualBrief: boolean }
): Submit2BriefDecision {
  if (options.manualBrief) {
    return { ok: true, reviewedBriefVersion: null };
  }
  if (ticket.briefLoadError) {
    return {
      ok: false,
      reason: "Không đọc được bản tóm tắt hồ sơ. Hãy tải lại trang hoặc chọn xử lý thủ công.",
    };
  }
  const status = briefStatusOf(ticket);
  const version = readyBriefVersion(ticket);
  if (status === "ready" && version != null) {
    return { ok: true, reviewedBriefVersion: version };
  }
  if (status === "pending" || status === "processing") {
    return {
      ok: false,
      reason: "AI đang tạo bản tóm tắt. Đợi hoàn tất, chạy lại AI, hoặc chọn xử lý thủ công.",
    };
  }
  if (status === "failed") {
    return {
      ok: false,
      reason: "AI chưa tạo được bản tóm tắt. Chạy lại AI hoặc chọn xử lý thủ công.",
    };
  }
  if (status === "stale") {
    return {
      ok: false,
      reason:
        "Bản tóm tắt đã cũ vì hồ sơ vừa thay đổi (ví dụ sau khi nhận ca hoặc kiểm tra thông tin). Chạy lại AI hoặc chọn xử lý thủ công.",
    };
  }
  if (status === "ready" && version == null) {
    return {
      ok: false,
      reason: "Bản tóm tắt chưa gắn được vào thao tác này. Tải lại hồ sơ, chạy lại AI, hoặc chọn xử lý thủ công.",
    };
  }
  return {
    ok: false,
    reason: "Chưa có bản tóm tắt hiện hành. Tạo hồ sơ AI hoặc chọn xử lý thủ công để hoàn tất mà không gắn bản tóm tắt.",
  };
}

export function applyBriefToTicket(ticket: Ticket, brief: BriefView): Ticket {
  return {
    ...ticket,
    briefStatus: brief.status,
    reviewedBriefVersion: brief.status === "ready" ? brief.briefVersion : ticket.reviewedBriefVersion ?? null,
    officerDraft: ticket.officerDraft || brief.draftReply || "",
    officerDraftDefault: brief.draftReply || ticket.officerDraftDefault,
    facts: brief.facts.length ? brief.facts : ticket.facts,
    aiSummary: brief.summary
      ? { ...ticket.aiSummary, target: ticket.aiSummary.target, context: brief.summary }
      : ticket.aiSummary,
    officerBrief: brief,
    briefLoadError: undefined,
  };
}

export function markBriefLoadFailure(ticket: Ticket, error: DataGatewayError): Ticket {
  if (error.reason === "not_found") {
    return { ...ticket, briefStatus: "none", briefLoadError: undefined };
  }
  return { ...ticket, briefLoadError: error.message };
}

export function claimDisabled(ticket: Pick<Ticket, "assignedOfficerId" | "status">): boolean {
  return ticket.status === "resolved" || Boolean(ticket.assignedOfficerId);
}

export function assignedToOtherOfficer(
  ticket: Pick<Ticket, "assignedOfficerId">,
  currentUserId: string | undefined
): boolean {
  return Boolean(ticket.assignedOfficerId && currentUserId && ticket.assignedOfficerId !== currentUserId);
}
