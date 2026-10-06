"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Copy, FileText, MessageCircle, Sparkles, Square } from "lucide-react";
import { useAssistant } from "@/lib/assistant-context";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { validateForm } from "@/lib/vinuni-forms";
import { receiveMethodLabel } from "@/lib/student-assistant";
import { secondaryButton } from "./StudentFlowUI";
import { CitationList } from "./CitationList";
import { SubmittedRequestCard, useSubmittedRequest } from "./SubmittedRequestCard";

export function AssistantConversation({ compact = false }: { compact?: boolean }) {
  const assistant = useAssistant();
  const { active, chat, context, task, pending, error } = assistant;
  const { ticketId: submittedTicketId } = useSubmittedRequest();
  const { state: forms, store } = useVinUniForms();
  const draft = task ? forms[task] : undefined;
  const scrollRef = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const follow = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const centered = !compact && !active.exchanges.length && !pending && !submittedTicketId;
  const submissionAnchor = active.submissionAnchor;
  const anchorExists = active.exchanges.some(exchange => exchange.id === submissionAnchor);
  const submissionCard = submittedTicketId ? <SubmittedRequestCard key={`${active.id}-${submittedTicketId}`} /> : null;
  useEffect(() => {
    const element = composer.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [active.input, active.id, centered]);
  async function copyAnswer(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  useEffect(() => {
    if (assistant.composerFocus > 0 && composer.current?.getClientRects().length) composer.current.focus();
  }, [assistant.composerFocus, centered]);
  useEffect(() => {
    if (scrollRef.current && !active.exchanges.length && !pending && !submittedTicketId) {
      follow.current = true;
      scrollRef.current.scrollTop = 0;
    } else if (follow.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active.id, active.exchanges.length, pending, submittedTicketId]);
  const suggestions = draft?.stage === 2 ? ["Tôi còn thiếu thông tin gì?"] : task === "certificate" ? draft?.stage === 1 ? ["PDF và bản giấy khác nhau thế nào?", "Đổi sang bản giấy"] : ["Xin giấy xác nhận cần thông tin gì?", "Mục đích sử dụng cần điền gì?"]
    : task === "complaint" ? draft?.stage === 1 ? ["Tôi cần chuẩn bị minh chứng gì?"] : ["Khiếu nại cần thông tin gì?"]
      : context.requestCode ? ["Giải thích trạng thái hồ sơ", "Tôi cần bổ sung gì?"] : ["Xin giấy xác nhận cần thông tin gì?", "Khiếu nại điểm thi thế nào?"];
  function send(question: string) {
    follow.current = true;
    if (question === "Tôi còn thiếu thông tin gì?" && task && draft) {
      const missing = Object.values(validateForm(task, draft.values, [0, 1], store.getFiles(task)));
      void assistant.send(question, { label: "Kiểm tra hồ sơ", hint: missing.length ? missing.join("\n") : "Các trường bắt buộc đã đầy đủ. Bạn cần kiểm tra nội dung ở bước cuối và xác nhận; trợ lý không xác minh thay nhà trường." });
    } else void assistant.send(question);
    composer.current?.focus();
  }
  const composerPanel = <footer className={`shrink-0 bg-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${centered ? "w-full pt-6" : "pt-3 sm:px-6"}`}>
    {!centered && !!active.exchanges.length && <div className="mx-auto mb-3 flex max-w-[700px] flex-wrap gap-2" aria-label="Câu hỏi gợi ý">{suggestions.map(question => <button type="button" key={question} disabled={pending} onClick={() => send(question)} className="rounded-none border border-[var(--ts-border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-left text-xs font-medium text-[var(--ts-text-secondary)] transition-colors hover:border-[var(--ts-border-strong)] hover:bg-[var(--ts-surface)] hover:text-[var(--ts-text-primary)] disabled:cursor-not-allowed disabled:opacity-40">{question}</button>)}</div>}
    <form onSubmit={event => { event.preventDefault(); if (!pending) send(active.input); }} className="mx-auto max-w-[700px] rounded-none border border-[var(--ts-border-medium)] bg-[var(--surface-card)] p-4 shadow-sm transition-colors focus-within:border-[var(--ts-focus-ring)] focus-within:ring-1 focus-within:ring-[var(--ts-focus-ring)]">
      <label htmlFor={compact ? "assistant-question" : "chatbot-question"} className="sr-only">Câu hỏi cho trợ lý</label>
      <textarea ref={composer} id={compact ? "assistant-question" : "chatbot-question"} value={active.input} onChange={event => chat.input(event.target.value)} maxLength={2000} rows={2} placeholder={assistant.apiLocked ? "Gửi thông tin bổ sung cho cán bộ…" : "Bạn muốn hỏi gì về học vụ?"} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!pending) send(active.input); } }} className="max-h-40 min-h-14 w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--ts-text-primary)] outline-none placeholder:text-[var(--ts-text-tertiary)] focus-visible:outline-none" />
      <div className="mt-2 flex items-end justify-between gap-3 border-t border-[var(--ts-border-subtle)] pt-2"><span className="pb-1 text-xs text-[var(--ts-text-secondary)]"><span className="hidden sm:inline font-mono">Enter</span> gửi · <span className="hidden sm:inline font-mono">Shift + Enter</span> xuống dòng</span>{pending ? <button type="button" onClick={assistant.cancel} aria-label="Dừng phản hồi" className="flex min-h-10 items-center gap-2 rounded-none border border-[var(--ts-status-error-border)] bg-[var(--surface-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--ts-status-error-text)] hover:bg-[var(--ts-status-error-bg)]"><Square className="h-3.5 w-3.5" />Dừng</button> : <button type="submit" disabled={!active.input.trim()} aria-label="Gửi câu hỏi" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-[var(--ts-text-primary)] text-[var(--ts-bg)] transition-colors hover:bg-[var(--ts-primary-hover)] active:bg-[var(--ts-primary-active)] disabled:cursor-not-allowed disabled:opacity-30"><ArrowUp className="h-4.5 w-4.5" /></button>}</div>
    </form>
    <p className="mx-auto mt-3 max-w-[700px] text-center text-xs leading-relaxed text-[var(--ts-text-tertiary)]">Trợ lý hỗ trợ chuẩn bị thông tin theo quy chế. Mọi phê duyệt chính thức thuộc thẩm quyền của Phòng Đào tạo & CTSV.</p>
  </footer>;
  const welcome = <div className={`mx-auto w-full max-w-[700px] ${centered ? "px-4 sm:px-6" : "pb-6"}`}>
    <div className={`mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--ts-text-secondary)] ${centered ? "justify-center" : ""}`}>
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[var(--ts-border-subtle)] bg-[var(--surface-card)] px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Trợ lý AI Đào tạo & Khảo thí · 24/7
      </span>
    </div>
    <h2 className={`font-serif font-bold tracking-tight text-[var(--ts-text-primary)] ${compact ? "text-2xl" : "text-3xl sm:text-[40px]"} ${centered ? "text-center" : ""}`}>Bạn cần hỗ trợ gì?</h2>
    <p className={`mt-3 text-sm leading-relaxed text-[var(--ts-text-secondary)] ${centered ? "text-center max-w-[560px] mx-auto" : ""}`}>{context.requestCode ? "Hỏi về trạng thái, yêu cầu bổ sung và phản hồi của hồ sơ này." : task ? "Hỏi về bước đang làm hoặc chọn Giải thích cạnh trường cần hỗ trợ." : "Thủ tục học vụ, giấy xác nhận hay khiếu nại điểm — bắt đầu từ câu hỏi của bạn."}</p>
  </div>;
  const starters = <div className={`mx-auto w-full max-w-[700px] ${centered ? "px-4 pb-8 sm:px-6" : "pb-6"}`}>
    {!task && !context.requestCode && <div className="mb-6 flex flex-wrap justify-center gap-3">
      <button type="button" disabled={pending} onClick={() => assistant.openForm("certificate")} className="inline-flex min-h-11 items-center gap-2.5 rounded-none border border-[var(--ts-border-medium)] bg-[var(--surface-card)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--ts-text-primary)] shadow-sm transition-colors hover:border-[var(--ts-border-strong)] hover:bg-[var(--ts-surface)]"><FileText className="h-4 w-4 text-[var(--ts-text-secondary)]" /><span>{assistant.isApiMode ? "Xin giấy xác nhận" : "Mở yêu cầu tài liệu"}</span></button>
      <button type="button" disabled={pending} onClick={() => assistant.openForm("complaint")} className="inline-flex min-h-11 items-center gap-2.5 rounded-none border border-[var(--ts-border-medium)] bg-[var(--surface-card)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--ts-text-primary)] shadow-sm transition-colors hover:border-[var(--ts-border-strong)] hover:bg-[var(--ts-surface)]"><MessageCircle className="h-4 w-4 text-[var(--ts-text-secondary)]" /><span>{assistant.isApiMode ? "Khiếu nại" : "Mở khiếu nại"}</span></button>
    </div>}
    <div className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`} aria-label="Câu hỏi gợi ý">{suggestions.map(question => <button type="button" key={question} disabled={pending} onClick={() => send(question)} className="group flex min-h-14 items-center justify-between gap-3 rounded-none border border-[var(--ts-border-subtle)] bg-[var(--surface-card)] p-4 text-left text-sm text-[var(--ts-text-secondary)] shadow-sm transition-all hover:border-[var(--ts-border-strong)] hover:bg-[var(--ts-surface)] hover:text-[var(--ts-text-primary)] active:bg-[var(--ts-surface-raised)] disabled:cursor-not-allowed disabled:opacity-40"><span>{question}</span><ArrowUp className="h-4 w-4 shrink-0 rotate-45 text-[var(--ts-text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>)}</div>
  </div>;
  return <div className="flex min-h-0 flex-1 flex-col bg-[var(--ts-bg)] text-[var(--ts-text-primary)]">
    {(draft || context.requestCode) && <div className="border-b border-[var(--ts-border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-xs text-[var(--ts-text-secondary)]">
      Đang hỗ trợ: <span className="font-semibold text-[var(--ts-text-primary)]">{draft ? draft.submission ? "Xem hồ sơ đã lưu" : draft.stage === 2 ? "Kiểm tra thông tin" : draft.stage === 1 ? task === "certificate" ? "Chọn cách nhận" : "Chuẩn bị minh chứng" : task === "certificate" ? "Chọn tài liệu" : "Thông tin học phần" : context.label}</span>
    </div>}
    {(assistant.state.issue || error) && <p role="alert" className="border-b border-[var(--ts-status-warning-border)] bg-[var(--ts-status-warning-bg)] px-4 py-3 text-sm text-[var(--ts-status-warning-text)]">{error || assistant.state.issue}</p>}
    {assistant.apiLocked && <p role="status" className="border-b border-[var(--ts-status-warning-border)] bg-[var(--ts-status-warning-bg)] px-4 py-2 text-sm text-[var(--ts-status-warning-text)]">Trợ lý AI đã khóa. Tin nhắn tiếp theo được chuyển tới cán bộ; không khóa toàn bộ ô soạn thảo.</p>}
    <div ref={scrollRef} onScroll={() => { const el = scrollRef.current; if (el) { follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; setShowLatest(!follow.current); } }} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${centered ? "flex flex-col justify-start pt-8 sm:pt-[clamp(2rem,10dvh,7rem)]" : "px-4 py-6 sm:px-6"}`}>
      {centered && <>{welcome}{composerPanel}{starters}</>}
      {!centered && !active.exchanges.length && !pending && !submittedTicketId && <>{welcome}{starters}</>}
      <div role="log" aria-label="Trao đổi với trợ lý" aria-live="polite" aria-relevant="additions" className="mx-auto max-w-[700px] space-y-8">
        {submissionAnchor === null && submissionCard}
        {active.exchanges.map(exchange => <Fragment key={exchange.id}><article className="space-y-4">
          {exchange.question && <div className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap break-words rounded-none border border-[var(--ts-border-medium)] bg-[var(--surface-card)] px-4 py-3 text-sm leading-relaxed text-[var(--ts-text-primary)] shadow-sm"><span className="sr-only">Bạn: </span>{exchange.question}</p></div>}
          {exchange.reply.text && <div className="space-y-4 text-[15px] leading-7 rounded-none border border-[var(--ts-border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm"><div className="flex items-center justify-between border-b border-[var(--ts-border-subtle)] pb-3"><div className="flex items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none border border-[var(--ts-border-medium)] bg-[var(--ts-text-primary)] text-[var(--ts-bg)]"><Sparkles className="h-3.5 w-3.5" /></span><span className="text-sm font-semibold text-[var(--ts-text-primary)]">Trợ lý học vụ</span></div><span className="font-mono text-[11px] text-[var(--ts-text-tertiary)]">Campus AI Engine</span></div><p className="whitespace-pre-wrap break-words leading-relaxed text-[var(--ts-text-primary)]"><span className="sr-only">Trợ lý: </span>{exchange.reply.text}</p>
            <CitationList sources={exchange.reply.sources} source={exchange.reply.source} />
            {exchange.change && <div className="rounded-none border border-[var(--ts-border-medium)] bg-[var(--ts-surface)] p-4">
              <p className="font-semibold text-[var(--ts-text-primary)]">Đề xuất: {exchange.change.label}</p>
              <dl className="mt-3 space-y-2"><div><dt className="text-xs text-[var(--ts-text-secondary)]">Hiện tại</dt><dd className="break-words font-mono text-sm">{receiveMethodLabel(Object.values(exchange.change.before)[0]) || "Chưa điền"}</dd></div><div><dt className="text-xs text-[var(--ts-text-secondary)]">Thay bằng</dt><dd className="break-words font-mono text-sm font-medium">{receiveMethodLabel(Object.values(exchange.change.after)[0])}</dd></div></dl>
              <div className="mt-3 flex flex-wrap gap-2">{!exchange.applied ? <button type="button" onClick={() => assistant.apply(exchange)} className={secondaryButton}>Áp dụng</button> : <><span role="status" className="inline-flex min-h-11 items-center font-medium text-[var(--ts-status-success-text)]">{exchange.undone ? "Đã hoàn tác" : "Đã áp dụng"}</span>{!exchange.undone && <button type="button" onClick={() => assistant.undo(exchange)} className={secondaryButton}>Hoàn tác</button>}</>}
                <button type="button" onClick={() => assistant.focusField(Object.keys(exchange.change!.after)[0])} className={secondaryButton}>Xem trường</button>
              </div>
              {exchange.error && <p role="alert" className="mt-2 text-[var(--ts-status-error-text)]">{exchange.error}</p>}
            </div>}
            {exchange.reply.action && (exchange.reply.action.href.includes("certificate") || exchange.reply.action.href.includes("complaint")
              ? <button type="button" onClick={() => assistant.openForm(exchange.reply.action!.href.includes("certificate") ? "certificate" : "complaint")} className={secondaryButton}>{task === (exchange.reply.action.href.includes("certificate") ? "certificate" : "complaint") ? "Tiếp tục hồ sơ" : "Mở biểu mẫu"} · {exchange.reply.action.href.includes("certificate") ? "Xin giấy xác nhận" : "Khiếu nại"}</button>
              : <Link href={exchange.reply.action.href} onClick={() => assistant.setOpen(false)} className={secondaryButton}>{exchange.reply.action.label}</Link>)}
            <div className="flex items-center justify-end border-t border-[var(--ts-border-subtle)] pt-2"><button type="button" onClick={() => void copyAnswer(exchange.id, exchange.reply.text)} aria-label={copied === exchange.id ? "Đã sao chép phản hồi" : "Sao chép phản hồi"} className="inline-flex min-h-9 items-center gap-2 rounded-none px-2.5 py-1 text-xs text-[var(--ts-text-secondary)] transition-colors hover:bg-[var(--ts-surface)] hover:text-[var(--ts-text-primary)]">{copied === exchange.id ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}{copied === exchange.id ? "Đã sao chép" : "Sao chép phản hồi"}</button></div>
          </div>}
        </article>{submissionAnchor === exchange.id && submissionCard}</Fragment>)}
        {submissionAnchor !== null && !anchorExists && submissionCard}
      </div>
      {copyError && <p role="status" className="mx-auto mt-4 max-w-[680px] text-sm text-[var(--ts-text-secondary)]">Chưa sao chép được. Bạn có thể chọn nội dung để sao chép.</p>}
      {pending && <div className="mx-auto mt-6 max-w-[680px] space-y-6"><div className="flex justify-end"><p className="max-w-[90%] whitespace-pre-wrap break-words border border-[var(--ts-border-medium)] bg-[var(--ts-surface)] px-4 py-3 text-sm leading-relaxed"><span className="sr-only">Bạn: </span>{assistant.pendingQuestion}</p></div><div role="status" className="flex items-center gap-3 text-sm text-[var(--ts-text-secondary)]"><Sparkles className="h-5 w-5 animate-pulse" /><span>Đang chuẩn bị phản hồi…</span></div></div>}
    </div>
    {showLatest && !centered && <div className="flex shrink-0 justify-center py-2"><button type="button" onClick={() => { follow.current = true; setShowLatest(false); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "instant" }); }} className="inline-flex min-h-11 items-center gap-2 border border-[var(--ts-border-medium)] bg-[var(--ts-surface)] px-3 text-xs hover:bg-[var(--ts-surface-raised)]"><ArrowDown className="h-4 w-4" />Tin nhắn mới nhất</button></div>}
    {!centered && composerPanel}
  </div>;
}
