"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Copy, FileText, MessageCircle, Sparkles, Square } from "lucide-react";
import { useAssistant } from "@/lib/assistant-context";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { validateForm } from "@/lib/vinuni-forms";
import { receiveMethodLabel } from "@/lib/student-assistant";
import { secondaryButton } from "./StudentFlowUI";
import { CitationList } from "./CitationList";

export function AssistantConversation({ compact = false }: { compact?: boolean }) {
  const assistant = useAssistant();
  const { active, chat, context, task, pending, error } = assistant;
  const { state: forms, store } = useVinUniForms();
  const draft = task ? forms[task] : undefined;
  const scrollRef = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const follow = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const centered = !compact && !active.exchanges.length && !pending;
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
    if (scrollRef.current && !active.exchanges.length && !pending) {
      follow.current = true;
      scrollRef.current.scrollTop = 0;
    } else if (follow.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active.id, active.exchanges.length, pending]);
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
  const composerPanel = <footer className={`shrink-0 bg-[var(--ts-bg)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${centered ? "w-full pt-6" : "pt-3 sm:px-6"}`}>
    {!centered && !!active.exchanges.length && <div className="mx-auto mb-3 flex max-w-[680px] flex-wrap gap-2" aria-label="Câu hỏi gợi ý">{suggestions.map(question => <button type="button" key={question} disabled={pending} onClick={() => send(question)} className="min-h-11 border border-[var(--ts-border-subtle)] px-3 py-2 text-left text-xs text-[var(--ts-text-secondary)] transition-colors hover:border-[var(--ts-border-medium)] hover:bg-[var(--ts-surface)] disabled:cursor-not-allowed disabled:opacity-40">{question}</button>)}</div>}
    <form onSubmit={event => { event.preventDefault(); if (!pending) send(active.input); }} className="mx-auto max-w-[680px] border border-[var(--ts-border-medium)] bg-[var(--ts-surface)] p-4 transition-colors focus-within:border-[var(--ts-primary)] focus-within:ring-1 focus-within:ring-[var(--ts-focus-ring)]">
      <label htmlFor={compact ? "assistant-question" : "chatbot-question"} className="sr-only">Câu hỏi cho trợ lý</label>
      <textarea ref={composer} id={compact ? "assistant-question" : "chatbot-question"} value={active.input} onChange={event => chat.input(event.target.value)} maxLength={2000} rows={2} placeholder={assistant.apiLocked ? "Gửi thông tin bổ sung cho cán bộ…" : "Bạn muốn hỏi gì về học vụ?"} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!pending) send(active.input); } }} className="max-h-40 min-h-14 w-full resize-none bg-transparent text-[15px] leading-6 text-[var(--ts-text-primary)] outline-none placeholder:text-[var(--ts-text-secondary)] focus-visible:outline-none" />
      <div className="mt-2 flex items-end justify-between gap-3"><span className="pb-2 text-xs leading-5 text-[var(--ts-text-secondary)]"><span className="hidden sm:inline">Enter để gửi · </span>Shift + Enter xuống dòng</span>{pending ? <button type="button" onClick={assistant.cancel} aria-label="Dừng phản hồi" className="flex min-h-11 items-center gap-2 border border-[var(--ts-border-medium)] px-3 text-sm hover:bg-[var(--ts-surface-raised)]"><Square className="h-4 w-4" />Dừng</button> : <button type="submit" disabled={!active.input.trim()} aria-label="Gửi câu hỏi" className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#1C1917] text-[#FAFAF9] transition-colors hover:bg-[#57534E] active:bg-[#44403C] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#FAFAF9] dark:text-[#1C1917] dark:hover:bg-[#D6D3D1]"><ArrowUp className="h-5 w-5" /></button>}</div>
    </form>
    <p className="mx-auto mt-3 max-w-[680px] text-center text-xs leading-relaxed text-[var(--ts-text-secondary)]">Trợ lý có thể nhầm lẫn. Bạn kiểm tra thông tin trước khi nộp hồ sơ.</p>
  </footer>;
  const welcome = <div className={`mx-auto w-full max-w-[680px] ${centered ? "px-4 sm:px-6" : "pb-6"}`}>
    <div className={`mb-6 flex items-center gap-2 text-xs text-[var(--ts-text-secondary)] ${centered ? "justify-center" : ""}`}><Sparkles className="h-5 w-5" /><span>Đồng hành cùng việc học của bạn</span></div>
    <h2 className={`font-serif font-normal tracking-tight text-[var(--ts-text-primary)] ${compact ? "text-2xl" : "text-3xl sm:text-[40px]"} ${centered ? "text-center" : ""}`}>Bạn cần hỗ trợ gì?</h2>
    <p className={`mt-3 text-sm leading-6 text-[var(--ts-text-secondary)] ${centered ? "text-center" : ""}`}>{context.requestCode ? "Hỏi về trạng thái, yêu cầu bổ sung và phản hồi của hồ sơ này." : task ? "Hỏi về bước đang làm hoặc chọn Giải thích cạnh trường cần hỗ trợ." : "Thủ tục học vụ, giấy xác nhận hay khiếu nại điểm — bắt đầu từ câu hỏi của bạn."}</p>
  </div>;
  const starters = <div className={`mx-auto w-full max-w-[680px] ${centered ? "px-4 pb-8 sm:px-6" : "pb-6"}`}>
    {!task && !context.requestCode && <div className="mb-5 flex flex-wrap justify-center gap-2">
      <button type="button" disabled={pending} onClick={() => assistant.openForm("certificate")} className={secondaryButton}><FileText className="h-4 w-4" />{assistant.isApiMode ? "Xin giấy xác nhận" : "Mở yêu cầu tài liệu"}</button>
      <button type="button" disabled={pending} onClick={() => assistant.openForm("complaint")} className={secondaryButton}><MessageCircle className="h-4 w-4" />{assistant.isApiMode ? "Khiếu nại" : "Mở khiếu nại"}</button>
    </div>}
    <div className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`} aria-label="Câu hỏi gợi ý">{suggestions.map(question => <button type="button" key={question} disabled={pending} onClick={() => send(question)} className="group flex min-h-14 items-center justify-between gap-3 border border-[var(--ts-border-subtle)] p-4 text-left text-sm text-[var(--ts-text-secondary)] transition-colors hover:border-[var(--ts-border-medium)] hover:bg-[var(--ts-surface)] active:bg-[var(--ts-surface-raised)] disabled:cursor-not-allowed disabled:opacity-40"><span>{question}</span><ArrowUp className="h-4 w-4 shrink-0 rotate-45 text-[var(--ts-primary)]" /></button>)}</div>
  </div>;
  return <div className="flex min-h-0 flex-1 flex-col bg-[#FAFAF9] text-[#1C1917] dark:bg-[#141210] dark:text-[#FAFAF9]">
    {(draft || context.requestCode) && <div className="border-b border-[#E7E5E4] bg-[#F5F5F4] px-4 py-3 text-xs text-[#57534E] dark:border-[#292524] dark:bg-[#1C1917] dark:text-[#D6D3D1]">
      Đang hỗ trợ: <span className="font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{draft ? draft.submission ? "Xem hồ sơ đã lưu" : draft.stage === 2 ? "Kiểm tra thông tin" : draft.stage === 1 ? task === "certificate" ? "Chọn cách nhận" : "Chuẩn bị minh chứng" : task === "certificate" ? "Chọn tài liệu" : "Thông tin học phần" : context.label}</span>
    </div>}
    {(assistant.state.issue || error) && <p role="alert" className="border-b border-[#FEF08A] bg-[#FEFCE8] px-4 py-3 text-sm text-[#854D0E] dark:border-[rgba(234,179,8,0.4)] dark:bg-[rgba(113,63,18,0.35)] dark:text-[#FDE047]">{error || assistant.state.issue}</p>}
    {assistant.apiLocked && <p role="status" className="border-b border-[#FEF08A] bg-[#FEFCE8] px-4 py-2 text-sm text-[#854D0E] dark:border-[rgba(234,179,8,0.4)] dark:bg-[rgba(113,63,18,0.35)] dark:text-[#FDE047]">Trợ lý AI đã khóa. Tin nhắn tiếp theo được chuyển tới cán bộ; không khóa toàn bộ ô soạn thảo.</p>}
    <div ref={scrollRef} onScroll={() => { const el = scrollRef.current; if (el) { follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; setShowLatest(!follow.current); } }} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${centered ? "flex flex-col justify-start pt-8 sm:pt-[clamp(2rem,10dvh,7rem)]" : "px-4 py-6 sm:px-6"}`}>
      {centered && <>{welcome}{composerPanel}{starters}</>}
      {!centered && !active.exchanges.length && !pending && <>{welcome}{starters}</>}
      <div role="log" aria-label="Trao đổi với trợ lý" aria-live="polite" aria-relevant="additions" className="mx-auto max-w-[680px] space-y-10">
        {active.exchanges.map(exchange => <article key={exchange.id} className="space-y-4">
          {exchange.question && <div className="flex justify-end"><p className="max-w-[90%] whitespace-pre-wrap break-words rounded-none border border-[#D6D3D1] bg-[#F5F5F4] px-4 py-3 text-sm leading-relaxed text-[#1C1917] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#FAFAF9]"><span className="sr-only">Bạn: </span>{exchange.question}</p></div>}
          {exchange.reply.text && <div className="space-y-4 text-[15px] leading-7"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ts-surface-raised)] text-[var(--ts-text-secondary)]"><Sparkles className="h-4 w-4" /></span><span className="text-sm font-semibold">Trợ lý học vụ</span></div><p className="whitespace-pre-wrap break-words"><span className="sr-only">Trợ lý: </span>{exchange.reply.text}</p>
            <CitationList sources={exchange.reply.sources} source={exchange.reply.source} />
            {exchange.change && <div className="rounded-none border border-[#D6D3D1] bg-[#F5F5F4] p-4 dark:border-[#44403C] dark:bg-[#23201D]">
              <p className="font-semibold text-[#1C1917] dark:text-[#FAFAF9]">Đề xuất: {exchange.change.label}</p>
              <dl className="mt-3 space-y-2"><div><dt className="text-xs text-[#57534E] dark:text-[#D6D3D1]">Hiện tại</dt><dd className="break-words">{receiveMethodLabel(Object.values(exchange.change.before)[0]) || "Chưa điền"}</dd></div><div><dt className="text-xs text-[#57534E] dark:text-[#D6D3D1]">Thay bằng</dt><dd className="break-words font-medium">{receiveMethodLabel(Object.values(exchange.change.after)[0])}</dd></div></dl>
              <div className="mt-3 flex flex-wrap gap-2">{!exchange.applied ? <button type="button" onClick={() => assistant.apply(exchange)} className={secondaryButton}>Áp dụng</button> : <><span role="status" className="inline-flex min-h-11 items-center font-medium text-[#3F6212] dark:text-[#86EFAC]">{exchange.undone ? "Đã hoàn tác" : "Đã áp dụng"}</span>{!exchange.undone && <button type="button" onClick={() => assistant.undo(exchange)} className={secondaryButton}>Hoàn tác</button>}</>}
                <button type="button" onClick={() => assistant.focusField(Object.keys(exchange.change!.after)[0])} className={secondaryButton}>Xem trường</button>
              </div>
              {exchange.error && <p role="alert" className="mt-2 text-[#B91C1C] dark:text-[#FCA5A5]">{exchange.error}</p>}
            </div>}
            {exchange.reply.action && (exchange.reply.action.href.includes("certificate") || exchange.reply.action.href.includes("complaint")
              ? <button type="button" onClick={() => assistant.openForm(exchange.reply.action!.href.includes("certificate") ? "certificate" : "complaint")} className={secondaryButton}>{task === (exchange.reply.action.href.includes("certificate") ? "certificate" : "complaint") ? "Tiếp tục hồ sơ" : "Mở biểu mẫu"} · {exchange.reply.action.href.includes("certificate") ? "Xin giấy xác nhận" : "Khiếu nại"}</button>
              : <Link href={exchange.reply.action.href} onClick={() => assistant.setOpen(false)} className={secondaryButton}>{exchange.reply.action.label}</Link>)}
            <button type="button" onClick={() => void copyAnswer(exchange.id, exchange.reply.text)} aria-label={copied === exchange.id ? "Đã sao chép phản hồi" : "Sao chép phản hồi"} className="inline-flex min-h-11 items-center gap-2 px-2 text-xs text-[var(--ts-text-secondary)] transition-colors hover:bg-[var(--ts-surface)]">{copied === exchange.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === exchange.id ? "Đã sao chép" : "Sao chép"}</button>
          </div>}
        </article>)}
      </div>
      {copyError && <p role="status" className="mx-auto mt-4 max-w-[680px] text-sm text-[var(--ts-text-secondary)]">Chưa sao chép được. Bạn có thể chọn nội dung để sao chép.</p>}
      {pending && <div className="mx-auto mt-6 max-w-[680px] space-y-6"><div className="flex justify-end"><p className="max-w-[90%] whitespace-pre-wrap break-words border border-[var(--ts-border-medium)] bg-[var(--ts-surface)] px-4 py-3 text-sm leading-relaxed"><span className="sr-only">Bạn: </span>{assistant.pendingQuestion}</p></div><div role="status" className="flex items-center gap-3 text-sm text-[var(--ts-text-secondary)]"><Sparkles className="h-5 w-5 animate-pulse" /><span>Đang chuẩn bị phản hồi…</span></div></div>}
    </div>
    {showLatest && !centered && <div className="flex shrink-0 justify-center py-2"><button type="button" onClick={() => { follow.current = true; setShowLatest(false); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "instant" }); }} className="inline-flex min-h-11 items-center gap-2 border border-[var(--ts-border-medium)] bg-[var(--ts-surface)] px-3 text-xs hover:bg-[var(--ts-surface-raised)]"><ArrowDown className="h-4 w-4" />Tin nhắn mới nhất</button></div>}
    {!centered && composerPanel}
  </div>;
}
