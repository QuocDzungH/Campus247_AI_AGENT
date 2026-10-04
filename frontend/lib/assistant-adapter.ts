import { lookupStudentGuidance, type AssistantReply, type GuidanceSource } from "./student-assistant";
import { VINUNI_SOURCES, type VinUniTask } from "./vinuni-forms";
import type { CampusPreview, ChatTurnResult } from "./data/api/mappers";
import type { WireCitation } from "./data/api/contracts";

export interface AssistantRequest {
  question: string;
  context: { label: string; task?: VinUniTask; requestCode?: string; status?: string; supplement?: string; field?: { label: string; hint?: string } };
}
export interface AssistantResult {
  reply: AssistantReply;
  edit?: { field: string; value: string };
  preview?: CampusPreview | null;
  ticket?: ChatTurnResult["ticket"];
  conversationState?: ChatTurnResult["conversationState"];
  route?: ChatTurnResult["route"];
  outcome?: string;
  conversationId?: string;
}
/** An API adapter can implement this contract without exposing API keys in the browser. */
export interface AssistantAdapter { respond(request: AssistantRequest, signal: AbortSignal): Promise<AssistantResult> }

export function isSafeCitationHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isAssistantResult(value: unknown): value is AssistantResult {
  if (!value || typeof value !== "object") return false;
  const result = value as AssistantResult;
  const reply = result.reply;
  return Boolean(reply && typeof reply.text === "string" && reply.text.length <= 20000 && !reply.proposal &&
    (!reply.action || (typeof reply.action.label === "string" && (
      reply.action.href === "/student/certificate" ||
      reply.action.href === "/student/complaint" ||
      reply.action.href === "/student/assistant?intent=certificate" ||
      reply.action.href === "/student/assistant?intent=complaint" ||
      reply.action.href === "/my-requests"
    ))) &&
    (!reply.source || validGuidanceSource(reply.source)) &&
    (!reply.sources || (Array.isArray(reply.sources) && reply.sources.every(validGuidanceSource))) &&
    (!result.edit || (typeof result.edit.field === "string" && typeof result.edit.value === "string" && result.edit.value.length <= 4000)));
}

function optionalString(value: unknown): boolean {
  return value == null || typeof value === "string";
}

function validGuidanceSource(source: GuidanceSource): boolean {
  return Boolean(
    typeof source.title === "string" &&
      typeof source.section === "string" &&
      typeof source.quote === "string" &&
      optionalString(source.documentId) &&
      optionalString(source.documentVersion) &&
      optionalString(source.chunkId) &&
      (!source.href || isSafeCitationHref(source.href) || Object.values(VINUNI_SOURCES).includes(source.href))
  );
}

export function citationToSource(citation: WireCitation): GuidanceSource {
  const href = citation.url && isSafeCitationHref(citation.url) ? citation.url : undefined;
  return {
    title: citation.document_title,
    section: citation.locator || citation.chunk_id || citation.document_id,
    quote: citation.quote,
    href,
    documentId: citation.document_id,
    documentVersion: citation.document_version,
    chunkId: citation.chunk_id,
  };
}

export function mapChatTurnToAssistantResult(turn: ChatTurnResult): AssistantResult {
  const sources = turn.citations.map(citationToSource);
  const action =
    turn.conversationState.aiResponseLocked
      ? { label: "Xem hồ sơ đã bàn giao", href: "/my-requests" }
      : undefined;
  return {
    reply: {
      text: turn.reply.text,
      source: sources[0],
      sources: sources.length ? sources : undefined,
      action,
    },
    preview: turn.preview,
    ticket: turn.ticket,
    conversationState: turn.conversationState,
    route: turn.route,
    outcome: turn.outcome,
    conversationId: turn.conversationId,
  };
}

export const guidanceAdapter: AssistantAdapter = {
  async respond({ question, context }, signal) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (context.field) return { reply: { text: `Bạn đang hỏi về trường “${context.field.label}”. ${context.field.hint || "Điền đúng thông tin tương ứng với yêu cầu của bạn. Bạn có thể sửa trực tiếp trong biểu mẫu và kiểm tra lại ở bước cuối."}` } };
    if (context.requestCode && /trạng thái|tiến độ|theo dõi|bổ sung|phản hồi/i.test(question)) {
      return { reply: { text: `Bạn đang xem hồ sơ ${context.requestCode}${context.status ? `, trạng thái hiển thị: ${context.status}` : ""}. ${context.supplement || "Xem tiến trình và phản hồi của cán bộ trong chi tiết hồ sơ."} Trợ lý chỉ giải thích thông tin đang hiển thị, không xác nhận thay cán bộ.` } };
    }
    if (context.task && /^(?:hãy\s+|giúp (?:mình|tôi|em)\s+)?(?:đổi|chuyển|sửa|cập nhật)\b/i.test(question.normalize("NFC"))) {
      const purpose = question.match(/(?:đổi|sửa|cập nhật)\s+mục đích\s*(?:(?:thành|sang|là)\s+|:\s*)(.+)/i);
      const destination = question.match(/(?:đổi|sửa|cập nhật)\s+(?:nơi nhận|nơi gửi)\s*(?:(?:thành|sang|là)\s+|:\s*)(.+)/i);
      const description = question.match(/(?:đổi|sửa|cập nhật)\s+(?:căn cứ|mô tả)\s*(?:(?:thành|sang|là)\s+|:\s*)(.+)/i);
      const edit = context.task === "certificate"
        ? purpose ? { field: "purpose", value: purpose[1].trim() } : destination ? { field: "destinationOrg", value: destination[1].trim() } : /bản giấy/i.test(question) ? { field: "receiveMethod", value: "paper_stamped" } : /điện tử|pdf/i.test(question) ? { field: "receiveMethod", value: "digital_pdf" } : undefined
        : description ? { field: "description", value: description[1].trim() } : undefined;
      if (edit) return { reply: { text: "Đây là đề xuất cập nhật bản nháp. Bạn kiểm tra thay đổi rồi chọn Áp dụng; hồ sơ chỉ được gửi khi bạn xác nhận nộp trong biểu mẫu." }, edit };
    }
    return { reply: lookupStudentGuidance(question) };
  },
};
