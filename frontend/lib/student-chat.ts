import { lookupStudentGuidance, type AssistantReply, type GuidanceSource } from "./student-assistant";
import { VINUNI_SOURCES } from "./vinuni-forms";
import { isSafeCitationHref } from "./assistant-adapter";
import type { VinUniTask } from "./vinuni-forms";
import type { FormChange } from "./vinuni-form-store";
import type { CampusPreview } from "./data/api/mappers";
import type { ChatMessage } from "./types";

export interface StudentChatExchange {
  id: string;
  question: string;
  reply: AssistantReply;
  change?: FormChange;
  applied?: FormChange;
  undone?: boolean;
  error?: string;
}
export interface StudentChatThread {
  id: string;
  title: string;
  input: string;
  exchanges: StudentChatExchange[];
  contextKey?: string;
  formTask?: VinUniTask;
  draftId?: string;
  conversationId?: string;
  apiPreview?: CampusPreview | null;
  apiLocked?: boolean;
  apiTicket?: { id: string; code: string } | null;
  apiPendingTicketId?: string;
  createIntentKey?: string;
}
export interface ChatSnapshot { threads: StudentChatThread[]; activeId: string; issue: string | null }
export type ThreadFlowPatch = Partial<Pick<StudentChatThread, "conversationId" | "apiPreview" | "apiLocked" | "apiTicket" | "apiPendingTicketId" | "createIntentKey">>;
export interface ServerConversationSeed {
  conversationId: string;
  title: string;
  locked?: boolean;
  ticket?: { id: string; code: string } | null;
}

function validSource(source: GuidanceSource): boolean {
  return (
    typeof source.title === "string" &&
    typeof source.section === "string" &&
    typeof source.quote === "string" &&
    (source.documentId == null || typeof source.documentId === "string") &&
    (source.documentVersion == null || typeof source.documentVersion === "string") &&
    (source.chunkId == null || typeof source.chunkId === "string") &&
    (!source.href || isSafeCitationHref(source.href) || Object.values(VINUNI_SOURCES).includes(source.href))
  );
}

function validPreview(value: unknown): value is CampusPreview {
  if (!value || typeof value !== "object") return false;
  const preview = value as CampusPreview;
  return (
    typeof preview.id === "string" &&
    typeof preview.version === "number" &&
    typeof preview.canSubmit === "boolean" &&
    preview.fields != null &&
    typeof preview.fields === "object"
  );
}

function validTicketRef(value: unknown): value is { id: string; code: string } {
  return Boolean(value && typeof value === "object" && typeof (value as { id: unknown }).id === "string" && typeof (value as { code: unknown }).code === "string");
}

function validExchange(item: StudentChatExchange): boolean {
  return (
    typeof item.id === "string" &&
    typeof item.question === "string" &&
    typeof item.reply?.text === "string" &&
    !item.reply.proposal &&
    (!item.reply.source || validSource(item.reply.source)) &&
    (!item.reply.sources || (Array.isArray(item.reply.sources) && item.reply.sources.every(validSource))) &&
    (!item.reply.action ||
      (typeof item.reply.action.label === "string" &&
        ["/student/certificate", "/student/complaint", "/my-requests"].includes(item.reply.action.href))) &&
    (!item.change || validChange(item.change)) &&
    (!item.applied || validChange(item.applied))
  );
}

function validThread(thread: StudentChatThread): boolean {
  return (
    typeof thread.id === "string" &&
    typeof thread.title === "string" &&
    typeof thread.input === "string" &&
    Array.isArray(thread.exchanges) &&
    thread.exchanges.every(validExchange) &&
    (!thread.formTask || ["certificate", "complaint"].includes(thread.formTask)) &&
    (!thread.draftId || typeof thread.draftId === "string") &&
    (!thread.contextKey || typeof thread.contextKey === "string") &&
    (!thread.conversationId || typeof thread.conversationId === "string") &&
    (thread.apiPreview == null || validPreview(thread.apiPreview)) &&
    (thread.apiTicket == null || validTicketRef(thread.apiTicket)) &&
    (thread.apiLocked == null || typeof thread.apiLocked === "boolean") &&
    (!thread.apiPendingTicketId || typeof thread.apiPendingTicketId === "string") &&
    (!thread.createIntentKey || typeof thread.createIntentKey === "string")
  );
}

export function exchangesFromChatMessages(messages: ChatMessage[]): StudentChatExchange[] {
  const exchanges: StudentChatExchange[] = [];
  let pendingQuestion = "";
  for (const message of messages) {
    if (message.sender === "user") {
      if (pendingQuestion) {
        exchanges.push({ id: crypto.randomUUID(), question: pendingQuestion, reply: { text: "" } });
      }
      pendingQuestion = message.text;
      continue;
    }
    const sources =
      message.citations?.map((citation) => ({
        title: citation.documentTitle,
        section: citation.locator || citation.chunkId || citation.documentId,
        quote: citation.quote,
        href: citation.url && isSafeCitationHref(citation.url) ? citation.url : undefined,
        documentId: citation.documentId,
        documentVersion: citation.documentVersion,
        chunkId: citation.chunkId,
      })) ?? undefined;
    exchanges.push({
      id: message.id,
      question: pendingQuestion,
      reply: {
        text: message.text,
        source: sources?.[0] || (message.citation
          ? { title: message.citation.title, section: message.citation.source, quote: message.citation.quote }
          : undefined),
        sources,
      },
    });
    pendingQuestion = "";
  }
  if (pendingQuestion) {
    exchanges.push({ id: crypto.randomUUID(), question: pendingQuestion, reply: { text: "" } });
  }
  return exchanges;
}

export function createStudentChatStore(key: string, legacyKey?: string) {
  const fresh = (): StudentChatThread => ({ id: crypto.randomUUID(), title: "Cuộc trò chuyện mới", input: "", exchanges: [] });
  const first = fresh();
  let snapshot: ChatSnapshot = { threads: [first], activeId: first.id, issue: null };
  let preserveSaved = false;
  try {
    const saved = localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null);
    if (saved) {
      const value = JSON.parse(saved);
      if (![1, 2, 3].includes(value.version) || !Array.isArray(value.threads) || !value.threads.length || !value.threads.every(validThread)) {
        throw new Error("Invalid history");
      }
      snapshot = {
        threads: value.threads,
        activeId: value.threads.some((thread: StudentChatThread) => thread.id === value.activeId) ? value.activeId : value.threads[0].id,
        issue: null,
      };
    }
  } catch {
    preserveSaved = true;
    snapshot.issue = "Không đọc được lịch sử đã lưu. Dữ liệu cũ được giữ nguyên; cuộc trò chuyện mới chỉ lưu trong phiên này.";
  }
  const listeners = new Set<() => void>();
  function update(next: ChatSnapshot) {
    snapshot = next;
    if (!preserveSaved) {
      try {
        localStorage.setItem(key, JSON.stringify({ version: 3, threads: next.threads, activeId: next.activeId }));
        snapshot = { ...next, issue: null };
      } catch {
        snapshot = { ...next, issue: "Chưa lưu được hội thoại trên thiết bị. Hãy giữ trang này mở để tiếp tục." };
      }
    }
    listeners.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select(id: string) {
      if (snapshot.threads.some((thread) => thread.id === id)) update({ ...snapshot, activeId: id });
    },
    start() {
      const thread = fresh();
      update({ ...snapshot, threads: [thread, ...snapshot.threads], activeId: thread.id });
    },
    context(contextKey: string, title: string, formTask?: VinUniTask, draftId?: string) {
      const existing = snapshot.threads.find((thread) => thread.contextKey === contextKey);
      if (existing) {
        if (existing.id !== snapshot.activeId) update({ ...snapshot, activeId: existing.id });
        return;
      }
      const thread = { ...fresh(), title, contextKey, formTask, draftId };
      update({ ...snapshot, threads: [thread, ...snapshot.threads], activeId: thread.id });
    },
    bindConversation(threadId: string, conversationId: string) {
      update({
        ...snapshot,
        threads: snapshot.threads.map((thread) =>
          thread.id === threadId ? { ...thread, conversationId, createIntentKey: undefined } : thread
        ),
      });
    },
    setFlow(threadId: string, patch: ThreadFlowPatch) {
      update({
        ...snapshot,
        threads: snapshot.threads.map((thread) => (thread.id === threadId ? { ...thread, ...patch } : thread)),
      });
    },
    replaceExchanges(threadId: string, exchanges: StudentChatExchange[]) {
      update({
        ...snapshot,
        threads: snapshot.threads.map((thread) =>
          thread.id === threadId && thread.exchanges.length === 0 ? { ...thread, exchanges } : thread
        ),
      });
    },
    mergeFromServer(seeds: ServerConversationSeed[]) {
      const byConversation = new Map(
        snapshot.threads.filter((thread) => thread.conversationId).map((thread) => [thread.conversationId as string, thread])
      );
      let changed = false;
      const extras: StudentChatThread[] = [];
      const merged = snapshot.threads.map((thread) => {
        const seed = seeds.find((item) => item.conversationId === thread.conversationId);
        if (!seed) return thread;
        const nextLocked = thread.apiLocked || !!seed.locked;
        const nextTicket = thread.apiTicket || seed.ticket || null;
        const nextPending = nextTicket ? undefined : thread.apiPendingTicketId;
        if (
          nextLocked === Boolean(thread.apiLocked) &&
          nextTicket?.id === thread.apiTicket?.id &&
          nextTicket?.code === thread.apiTicket?.code &&
          nextPending === thread.apiPendingTicketId
        ) {
          return thread;
        }
        changed = true;
        return { ...thread, apiLocked: nextLocked, apiTicket: nextTicket, apiPendingTicketId: nextPending };
      });
      for (const seed of seeds) {
        if (byConversation.has(seed.conversationId)) continue;
        changed = true;
        extras.push({
          id: seed.conversationId,
          title: seed.title || "Cuộc trò chuyện",
          input: "",
          exchanges: [],
          conversationId: seed.conversationId,
          apiLocked: !!seed.locked,
          apiTicket: seed.ticket || null,
        });
      }
      if (!changed) return;
      update({ ...snapshot, threads: extras.length ? [...merged, ...extras] : merged });
    },
    bindForm(formTask: VinUniTask, draftId: string) {
      const active = snapshot.threads.find((thread) => thread.id === snapshot.activeId)!;
      if (active.draftId && active.draftId !== draftId) {
        this.context(`draft:${draftId}`, formTask === "certificate" ? "Yêu cầu tài liệu" : "Khiếu nại điểm học phần", formTask, draftId);
        return;
      }
      update({
        ...snapshot,
        threads: snapshot.threads.map((thread) =>
          thread.id === snapshot.activeId ? { ...thread, formTask, draftId, contextKey: `draft:${draftId}` } : thread
        ),
      });
    },
    exchange(id: string, fields: Partial<Pick<StudentChatExchange, "applied" | "undone" | "error">>) {
      update({
        ...snapshot,
        threads: snapshot.threads.map((thread) => ({
          ...thread,
          exchanges: thread.exchanges.map((item) => (item.id === id ? { ...item, ...fields } : item)),
        })),
      });
    },
    input(value: string) {
      update({
        ...snapshot,
        threads: snapshot.threads.map((thread) => (thread.id === snapshot.activeId ? { ...thread, input: value } : thread)),
      });
    },
    send(question: string, answer?: AssistantReply, change?: FormChange, threadId = snapshot.activeId) {
      const value = question.trim();
      if (!value) return;
      const reply =
        answer ??
        (/^(xin chào|chào|hello|hi)[!.\s]*$/i.test(value)
          ? {
              text: "Chào bạn! Tôi có thể hướng dẫn xin giấy xác nhận, tra cứu hướng dẫn dịch vụ, khiếu nại điểm thi và theo dõi hồ sơ. Bạn muốn bắt đầu từ việc nào?",
            }
          : lookupStudentGuidance(value));
      update({
        ...snapshot,
        threads: snapshot.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                title: thread.exchanges.length ? thread.title : value.slice(0, 64),
                input: "",
                exchanges: [...thread.exchanges, { id: crypto.randomUUID(), question: value, reply, change }],
              }
            : thread
        ),
      });
    },
  };
}

function validChange(change: FormChange) {
  return (
    ["certificate", "complaint"].includes(change.task) &&
    typeof change.draftId === "string" &&
    Number.isSafeInteger(change.revision) &&
    change.revision >= 0 &&
    typeof change.label === "string" &&
    [change.before, change.after].every(
      (values) =>
        values &&
        typeof values === "object" &&
        !Array.isArray(values) &&
        Object.values(values).every((value) => typeof value === "string" && value.length <= 4000)
    )
  );
}
