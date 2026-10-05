"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUp, FileText, Sparkles } from "lucide-react";
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
  useEffect(() => {
    if (assistant.composerFocus > 0 && composer.current?.getClientRects().length) composer.current.focus();
  }, [assistant.composerFocus]);
  useEffect(() => {
    if (follow.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
  return <div className="flex min-h-0 flex-1 flex-col bg-[#FAFAF9] text-[#1C1917] dark:bg-[#141210] dark:text-[#FAFAF9]">
    <div className="border-b border-[#E7E5E4] bg-[#F5F5F4] px-4 py-3 text-xs text-[#57534E] dark:border-[#292524] dark:bg-[#1C1917] dark:text-[#D6D3D1]">
      Đang hỗ trợ: <span className="font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{draft ? draft.submission ? "Xem hồ sơ đã lưu" : draft.stage === 2 ? "Kiểm tra thông tin" : draft.stage === 1 ? task === "certificate" ? "Chọn cách nhận" : "Chuẩn bị minh chứng" : task === "certificate" ? "Chọn tài liệu" : "Thông tin học phần" : context.label}</span>
    </div>
    {(assistant.state.issue || error) && <p role="alert" className="border-b border-[#FEF08A] bg-[#FEFCE8] px-4 py-3 text-sm text-[#854D0E] dark:border-[rgba(234,179,8,0.4)] dark:bg-[rgba(113,63,18,0.35)] dark:text-[#FDE047]">{error || assistant.state.issue}</p>}
    {assistant.apiLocked && <p role="status" className="border-b border-[#FEF08A] bg-[#FEFCE8] px-4 py-2 text-sm text-[#854D0E] dark:border-[rgba(234,179,8,0.4)] dark:bg-[rgba(113,63,18,0.35)] dark:text-[#FDE047]">Trợ lý AI đã khóa. Tin nhắn tiếp theo được chuyển tới cán bộ; không khóa toàn bộ ô soạn thảo.</p>}
    <div ref={scrollRef} onScroll={() => { const el = scrollRef.current; if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
      {!active.exchanges.length && <div className="mx-auto max-w-2xl pb-6">
        <Sparkles className="mb-3 h-7 w-7 text-[#78716C] dark:text-[#A8A29E]" />
        <h2 className={`font-serif ${compact ? "text-lg" : "text-2xl sm:text-3xl"} font-normal tracking-tight text-[#1C1917] dark:text-[#FAFAF9]`}>Bạn cần hỗ trợ gì?</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">{context.requestCode ? "Bạn có thể hỏi về trạng thái, yêu cầu bổ sung và phản hồi đang hiển thị của hồ sơ này." : task ? "Hỏi về bước đang làm hoặc chọn Giải thích cạnh trường bạn cần hỗ trợ." : "Hỏi về thủ tục hoặc mở biểu mẫu để điền và kiểm tra cùng trợ lý."}</p>
        {!task && !context.requestCode && <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => assistant.openForm("certificate")} className={secondaryButton}><FileText className="h-4 w-4" />{assistant.isApiMode ? "Xin giấy xác nhận" : "Mở yêu cầu tài liệu"}</button>
          <button type="button" onClick={() => assistant.openForm("complaint")} className={secondaryButton}>{assistant.isApiMode ? "Khiếu nại" : "Mở khiếu nại"}</button>
        </div>}
      </div>}
      <div className="mx-auto mb-5 flex max-w-2xl flex-wrap gap-2" aria-label="Câu hỏi gợi ý">{suggestions.map(question => <button type="button" key={question} disabled={pending} onClick={() => send(question)} className="min-h-11 rounded-none border border-[#D6D3D1] px-3 py-2 text-left text-xs text-[#57534E] hover:bg-[#F5F5F4] disabled:opacity-50 dark:border-[#44403C] dark:text-[#D6D3D1] dark:hover:bg-[#23201D]">{question}</button>)}</div>
      <div role="log" aria-label="Trao đổi với trợ lý" aria-live="polite" aria-relevant="additions" className="mx-auto max-w-2xl space-y-7">
        {active.exchanges.map(exchange => <article key={exchange.id} className="space-y-4">
          <div className="flex justify-end"><p className="max-w-[90%] whitespace-pre-wrap break-words rounded-none border border-[#D6D3D1] bg-[#F5F5F4] px-4 py-3 text-sm leading-relaxed text-[#1C1917] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#FAFAF9]"><span className="sr-only">Bạn: </span>{exchange.question}</p></div>
          <div className="space-y-3 text-sm leading-7"><p className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Trợ lý học vụ</p><p className="whitespace-pre-wrap break-words"><span className="sr-only">Trợ lý: </span>{exchange.reply.text}</p>
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
          </div>
        </article>)}
      </div>
      {pending && <p role="status" className="mx-auto mt-5 max-w-2xl text-sm text-[#78716C] dark:text-[#A8A29E]">Đang chuẩn bị phản hồi…</p>}
    </div>
    <footer className="shrink-0 border-t border-[#E7E5E4] bg-[#FAFAF9] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-[#292524] dark:bg-[#141210]">
      <form onSubmit={event => { event.preventDefault(); send(active.input); }} className="mx-auto max-w-2xl rounded-none border border-[#D6D3D1] bg-[#FAFAF9] p-3 focus-within:border-[#78716C] focus-within:ring-2 focus-within:ring-[#78716C] dark:border-[#44403C] dark:bg-[#1C1917]">
        <label htmlFor={compact ? "assistant-question" : "chatbot-question"} className="sr-only">Câu hỏi cho trợ lý</label>
        <textarea ref={composer} id={compact ? "assistant-question" : "chatbot-question"} value={active.input} onChange={event => chat.input(event.target.value)} maxLength={2000} rows={2} placeholder={assistant.apiLocked ? "Gửi thông tin bổ sung cho cán bộ…" : "Nhập câu hỏi của bạn…"} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!pending) send(active.input); } }} className="min-h-12 w-full resize-none bg-transparent text-sm text-[#1C1917] outline-none dark:text-[#FAFAF9]" />
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">Enter để gửi · Shift + Enter xuống dòng</span>{pending ? <button type="button" onClick={assistant.cancel} className={secondaryButton}>Dừng</button> : <button type="submit" disabled={!active.input.trim()} aria-label="Gửi câu hỏi" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-none bg-[#78716C] text-[#FAFAF9] hover:bg-[#57534E] disabled:opacity-40 dark:bg-[#A8A29E] dark:text-[#1C1917]"><ArrowUp className="h-4 w-4" /></button>}</div>
      </form>
      <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-[#78716C] dark:text-[#A8A29E]">Trợ lý hướng dẫn thủ tục từ nguồn VinUni. Bạn kiểm tra thông tin và xác nhận trước khi nộp hồ sơ.</p>
    </footer>
  </div>;
}
