"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, MessageCircle, X } from "lucide-react";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { answerStudentQuestion, receiveMethodLabel, type AssistantReply } from "@/lib/student-assistant";
import { CitationList } from "./CitationList";
import type { StudentTask, StudentDraft, CertificateData } from "@/lib/student-workspace";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { fieldClass, secondaryButton } from "./StudentFlowUI";

interface Exchange { id: string; question: string; reply: AssistantReply; applied?: boolean; error?: string }

const suggestions: Record<StudentTask, string[]> = {
  home: ["Xin giấy xác nhận cần thông tin gì?", "Theo dõi hồ sơ ở đâu?"],
  certificate: ["Mục đích và nơi nhận điền thế nào?", "Đổi sang bản giấy"],
  complaint: ["Khiếu nại cần thông tin gì?", "Theo dõi phản hồi ở đâu?"],
  lookup: ["Xin giấy xác nhận cần thông tin gì?", "Cách nhận bản điện tử?"],
};

export function AssistantDrawer({ task }: { task: StudentTask }) {
  const { state, store } = useVinUniForms();
  const certificate: StudentDraft<CertificateData> = { id: "vinuni-certificate", step: "details", updatedAt: "", data: {
    purpose: state.certificate.values.purpose || "", destinationOrg: state.certificate.values.destinationOrg || "",
    receiveMethod: state.certificate.values.receiveMethod === "paper_stamped" ? "paper_stamped" : "digital_pdf",
  } };
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, exchanges]);

  function send(question: string) {
    const value = question.trim();
    if (!value) return;
    const reply = answerStudentQuestion(value, task, certificate);
    setExchanges((current) => [...current, { id: crypto.randomUUID(), question: value, reply }]);
    setInput("");
    inputRef.current?.focus();
  }

  function apply(exchange: Exchange) {
    if (!exchange.reply.proposal) return;
    const proposal = exchange.reply.proposal;
    const applied = proposal.draftId === certificate.id && certificate.data[proposal.field] === proposal.before;
    if (applied) store.update("certificate", { [proposal.field]: proposal.value });
    setExchanges((current) => current.map((item) => item.id === exchange.id
                    ? { ...item, applied, error: applied ? undefined : "Không thể áp dụng đề xuất này vì bản nháp đã thay đổi. Hãy hỏi lại sau khi kiểm tra biểu mẫu." }
      : item));
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      className="fixed bottom-5 right-4 z-30 inline-flex min-h-12 items-center gap-2 rounded-none border border-[#78716C] bg-[#1C1917] px-5 py-3 text-sm font-medium text-[#FAFAF9] shadow-none hover:bg-[#57534E] sm:bottom-6 sm:right-6 dark:border-[#A8A29E] dark:bg-[#FAFAF9] dark:text-[#1C1917] dark:hover:bg-[#E7E5E4] transition-colors">
      <MessageCircle className="h-5 w-5" />Hỏi trợ lý
    </button>
    <AccessibleDialog open={open} onClose={() => setOpen(false)} labelledBy="student-assistant-title"
      className="fixed inset-x-0 bottom-0 flex h-[85dvh] max-h-[900px] flex-col rounded-none bg-[#FAFAF9] shadow-none sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-0 sm:h-dvh sm:max-h-none sm:w-[420px] dark:bg-[#141210] border-l border-[#E7E5E4] dark:border-[#292524]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#E7E5E4] px-5 py-4 dark:border-[#292524] bg-[#F5F5F4] dark:bg-[#1C1917]">
        <div>
          <h2 id="student-assistant-title" className="font-serif text-lg font-normal text-[#1C1917] dark:text-[#FAFAF9]">Trợ lý học vụ</h2>
          <p className="mt-1 text-sm text-[#78716C] dark:text-[#A8A29E]">Hỗ trợ bạn hoàn thành tác vụ</p>
          <Link href="/student/assistant" onClick={() => setOpen(false)} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#FAFAF9] underline-offset-4 hover:underline">Mở trang chatbot →</Link>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="flex h-11 w-11 items-center justify-center rounded-none hover:bg-[#E7E5E4] dark:hover:bg-[#292524] text-[#57534E] dark:text-[#A8A29E]"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain p-5">
        {exchanges.length === 0 && <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">Bạn đang cần hướng dẫn ở bước nào?</p>}
        <div className="flex flex-wrap gap-2" aria-label="Câu hỏi gợi ý">
          {suggestions[task].map((question) => <button key={question} type="button" onClick={() => send(question)}
            className="min-h-11 rounded-none border border-[#E7E5E4] px-3 py-2 text-left text-sm hover:bg-[#F5F5F4] dark:border-[#292524] dark:hover:bg-[#1C1917] text-[#1C1917] dark:text-[#FAFAF9]">{question}</button>)}
        </div>
        <div role="log" aria-label="Trao đổi với trợ lý" aria-live="polite" aria-relevant="additions" className="space-y-6">
          {exchanges.map((exchange) => <div key={exchange.id} className="space-y-3">
            <p className="ml-8 rounded-none bg-[#E7E5E4] px-4 py-3 text-sm text-[#1C1917] dark:bg-[#292524] dark:text-[#FAFAF9]"><span className="sr-only">Bạn: </span>{exchange.question}</p>
            <div className="space-y-3 pr-2 text-sm leading-relaxed"><p><span className="sr-only">Trợ lý: </span>{exchange.reply.text}</p>
              <CitationList sources={exchange.reply.sources} source={exchange.reply.source} />
              {exchange.reply.proposal && <div className="rounded-none border border-[#E7E5E4] p-4 dark:border-[#292524] bg-[#F5F5F4] dark:bg-[#1C1917]">
                <p className="text-sm font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{exchange.reply.proposal.label}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div><dt className="text-[#78716C] dark:text-[#A8A29E]">Hiện tại</dt><dd className="break-words text-[#1C1917] dark:text-[#FAFAF9]">{receiveMethodLabel(exchange.reply.proposal.before) || "Chưa điền"}</dd></div>
                  <div><dt className="text-[#78716C] dark:text-[#A8A29E]">Đề xuất</dt><dd className="break-words font-medium text-[#1C1917] dark:text-[#FAFAF9]">{receiveMethodLabel(exchange.reply.proposal.value)}</dd></div>
                </dl>
                <button type="button" onClick={() => apply(exchange)} disabled={exchange.applied}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-none border border-[#78716C] px-4 py-2 text-sm font-medium hover:bg-[#E7E5E4] disabled:cursor-default disabled:text-[#3F6212] dark:border-[#A8A29E] dark:hover:bg-[#292524] dark:disabled:text-[#84CC16]">
                  {exchange.applied ? <><Check className="h-4 w-4" />Đã áp dụng</> : "Áp dụng thay đổi"}
                </button>
                {exchange.error && <p role="alert" className="mt-2 text-sm text-[#B91C1C] dark:text-[#EF4444]">{exchange.error}</p>}
              </div>}
              {exchange.reply.action && <Link href={exchange.reply.action.href} onClick={() => setOpen(false)} className={`${secondaryButton} border border-[#E7E5E4] dark:border-[#292524]`}>{exchange.reply.action.label}</Link>}
            </div>
          </div>)}
        </div>
        <div ref={endRef} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); send(input); }} className="shrink-0 border-t border-[#E7E5E4] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-[#292524] bg-[#FAFAF9] dark:bg-[#141210]">
        <label htmlFor="assistant-question" className="sr-only">Câu hỏi cho trợ lý</label>
        <div className="flex gap-2">
          <input ref={inputRef} id="assistant-question" value={input} onChange={(event) => setInput(event.target.value)} maxLength={2000} placeholder="Nhập câu hỏi của bạn…" className={`${fieldClass} min-w-0 flex-1`} />
          <button type="submit" aria-label="Gửi câu hỏi" disabled={!input.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-[#78716C] text-[#FAFAF9] hover:bg-[#57534E] disabled:opacity-40 dark:bg-[#A8A29E] dark:text-[#1C1917]"><ArrowUp className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-xs text-[#78716C] dark:text-[#A8A29E]">Hướng dẫn từ nguồn VinUni. Kiểm tra thông tin trước khi xác nhận hồ sơ.</p>
      </form>
    </AccessibleDialog>
  </>;
}
