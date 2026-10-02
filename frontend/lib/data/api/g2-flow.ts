import { DataGatewayError } from "../errors";
import type { Ticket } from "../../types";
import { errorDetails } from "./mappers";
import type { BriefView } from "./mappers";

export const MISSING_DATA_LABEL = "Chưa có dữ liệu";

export function displayValue(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value : MISSING_DATA_LABEL;
}

export function receiveMethodDisplay(value: string | null | undefined): string {
  if (value === "paper_stamped") return "Bản giấy";
  if (value === "digital_pdf") return "Bản điện tử";
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
    return { ok: false, stage: "auth", error };
  }
  if (!options.isCurrent() || !user) return { ok: false, stage: "auth" };
  try {
    const data = await options.hydrate(user);
    if (!options.isCurrent()) return { ok: false, stage: "auth" };
    return { ok: true, user, tickets: data.tickets, chatSessions: data.chatSessions };
  } catch (error) {
    return { ok: false, stage: "hydrate", user, error };
  }
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

export function decideReviewedBriefVersion(
  ticket: Pick<Ticket, "briefStatus" | "reviewedBriefVersion" | "briefLoadError">,
  options: { manualBrief: boolean }
): Submit2BriefDecision {
  if (options.manualBrief) {
    return { ok: true, reviewedBriefVersion: null };
  }
  if (ticket.briefLoadError) {
    return {
      ok: false,
      reason:
        "Không đọc được brief. Hãy tải lại hồ sơ hoặc chọn xử lý thủ công và gửi reviewed_brief_version:null.",
    };
  }
  if (ticket.briefStatus === "ready" && ticket.reviewedBriefVersion != null) {
    return { ok: true, reviewedBriefVersion: ticket.reviewedBriefVersion };
  }
  return {
    ok: false,
    reason:
      "Submit 2 chỉ khi brief ready có version hiện hành, hoặc cán bộ chọn xử lý thủ công và gửi reviewed_brief_version:null.",
  };
}

export function applyBriefToTicket(ticket: Ticket, brief: BriefView): Ticket {
  return {
    ...ticket,
    briefStatus: brief.status,
    reviewedBriefVersion: brief.status === "ready" ? brief.briefVersion : ticket.reviewedBriefVersion ?? null,
    officerDraft: brief.draftReply || ticket.officerDraft,
    officerDraftDefault: brief.draftReply || ticket.officerDraftDefault,
    facts: brief.facts.length ? brief.facts : ticket.facts,
    aiSummary: brief.summary ? { ...ticket.aiSummary, context: brief.summary } : ticket.aiSummary,
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
