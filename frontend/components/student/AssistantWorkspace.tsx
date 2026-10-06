"use client";

import { useRef, useState } from "react";
import { ArrowLeft, History, MessageCircle, Plus, X } from "lucide-react";
import { useAssistant } from "@/lib/assistant-context";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { isDisplayTicketCode } from "@/lib/data/api/g2-flow";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { AssistantConversation } from "./AssistantConversation";
import { VinUniForm } from "./VinUniForm";
import { P0PreviewPanel } from "./P0PreviewPanel";

export function AssistantWorkspace() {
  const assistant = useAssistant();
  const { state: forms } = useVinUniForms();
  const ticketCode =
    assistant.apiTicket && isDisplayTicketCode(assistant.apiTicket.code, assistant.apiTicket.id)
      ? assistant.apiTicket.code
      : null;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [readMessages, setReadMessages] = useState(0);
  const [supportExpanded, setSupportExpanded] = useState(true);
  const chatTab = useRef<HTMLButtonElement>(null);
  const formTab = useRef<HTMLButtonElement>(null);
  const task = assistant.active.formTask;
  const hasForm = assistant.isApiMode
    ? Boolean(assistant.apiPreview || assistant.apiLocked || assistant.apiTicket || assistant.apiPendingTicketId)
    : Boolean(task);
  // A task remains mounted under mobile tabs so file selection and errors survive.
  const showForm = hasForm && assistant.formExpanded;
  const showSupport = supportExpanded || assistant.tab === "chat";
  const unread = assistant.tab === "form" && assistant.active.exchanges.length > readMessages;
  function choose(tab: "chat" | "form") { assistant.setTab(tab); setReadMessages(assistant.active.exchanges.length); }
  const history = <>
    <button type="button" onClick={() => { assistant.startNewThread(); setHistoryOpen(false); }} className="mb-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-none bg-[#78716C] hover:bg-[#57534E] px-4 text-sm font-semibold text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]"><Plus className="h-4 w-4" />Trò chuyện mới</button>
    <nav aria-label="Lịch sử hội thoại" className="flex-1 space-y-2 overflow-y-auto">{assistant.state.threads.map(thread => <button type="button" key={thread.id} aria-current={thread.id === assistant.active.id ? "true" : undefined} onClick={() => { assistant.selectThread(thread.id); setHistoryOpen(false); }} className={`flex min-h-11 w-full items-center gap-2 rounded-none px-3 py-2 text-left text-sm ${thread.id === assistant.active.id ? "border-l-2 border-[#78716C] bg-[#EFEDEB] font-semibold text-[#1C1917] dark:border-[#A8A29E] dark:bg-[#292524] dark:text-[#FAFAF9]" : "text-[#57534E] hover:bg-[#F5F5F4] dark:text-[#D6D3D1] dark:hover:bg-[#1C1917]"}`}><MessageCircle className="h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{thread.title}{thread.formTask && <span className="mt-1 block text-xs font-normal text-[#78716C] dark:text-[#A8A29E]">Có biểu mẫu</span>}</span></button>)}</nav>
    <p className="mt-4 text-xs text-[#78716C] dark:text-[#A8A29E]">{assistant.isApiMode ? "Hội thoại được đồng bộ với tài khoản của bạn." : "Hội thoại và bản nháp lưu trên thiết bị này."}</p>
  </>;
  return <div className="assistant-workspace flex h-[calc(100dvh-64px)] min-h-0 flex-col overflow-hidden bg-[#FAFAF9] text-[#1C1917] dark:bg-[#141210] dark:text-[#FAFAF9]">
    <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#E7E5E4] px-4 py-1 dark:border-[#292524]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {hasForm && <button type="button" onClick={assistant.returnToStart} className="inline-flex min-h-11 items-center gap-2 rounded-none border border-[#D6D3D1] px-2 text-sm font-medium text-[#57534E] hover:bg-[#F5F5F4] dark:border-[#44403C] dark:text-[#D6D3D1] dark:hover:bg-[#292524]"><ArrowLeft className="h-4 w-4" />Trở về</button>}
        <div className="min-w-0"><h1 className="font-serif text-lg font-normal text-[#1C1917] dark:text-[#FAFAF9]">{showForm ? assistant.isApiMode ? assistant.apiLocked ? "Chờ cán bộ xử lý" : assistant.apiPreview?.serviceType === "academic_complaint" ? "Khiếu nại trong hội thoại" : "Xin giấy xác nhận trong hội thoại" : task === "certificate" ? "Yêu cầu tài liệu VinUni" : "Khiếu nại" : "Trợ lý học vụ"}</h1>{!assistant.isApiMode && (!showForm || forms[task!].submission) && <p className="text-xs text-[#57534E] dark:text-[#D6D3D1]">{showForm ? `Mã hồ sơ: ${forms[task!].submission!.ticketCode}` : "Hướng dẫn thủ tục và hỗ trợ điền hồ sơ"}</p>}{assistant.isApiMode && <p className="text-xs text-[#57534E] dark:text-[#D6D3D1]">{ticketCode ? `Mã hồ sơ: ${ticketCode}` : assistant.apiPendingTicketId ? "Đã nộp yêu cầu. Đang đồng bộ mã hồ sơ." : "Một khung chat cho khiếu nại và xin giấy xác nhận"}</p>}</div>
      </div>
      <div className="flex items-center gap-2"><button type="button" onClick={assistant.startNewThread} aria-label="Trò chuyện mới" className="flex min-h-11 items-center gap-2 border border-[#D6D3D1] px-3 text-sm text-[#57534E] transition-colors hover:bg-[#F5F5F4] dark:border-[#44403C] dark:text-[#D6D3D1] dark:hover:bg-[#292524]"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Trò chuyện mới</span></button><button type="button" onClick={() => setHistoryOpen(true)} aria-label="Mở lịch sử hội thoại" className="flex min-h-11 items-center gap-2 rounded-none border border-[#D6D3D1] px-3 text-sm text-[#57534E] hover:bg-[#F5F5F4] dark:border-[#44403C] dark:text-[#D6D3D1] dark:hover:bg-[#292524]"><History className="h-4 w-4" /><span className="hidden sm:inline">Lịch sử</span></button>
        {showForm && <button type="button" aria-expanded={showSupport} aria-controls="workspace-chat" onClick={() => { setSupportExpanded(!showSupport); choose("form"); }} className="hidden min-h-11 items-center gap-2 rounded-none border border-[#D6D3D1] px-3 text-sm text-[#78716C] lg:flex hover:bg-[#F5F5F4] dark:border-[#44403C] dark:text-[#A8A29E] dark:hover:bg-[#292524]"><MessageCircle className="h-4 w-4" />{showSupport ? "Thu gọn trợ lý" : "Hỏi trợ lý"}</button>}
        {hasForm && !showForm && <button type="button" onClick={() => { assistant.setFormExpanded(true); choose("form"); }} className="min-h-11 rounded-none border border-[#D6D3D1] px-3 text-sm text-[#78716C] hover:bg-[#F5F5F4] dark:border-[#44403C] dark:text-[#A8A29E] dark:hover:bg-[#292524]">Tiếp tục hồ sơ</button>}
      </div>
    </header>
    {showForm && <div role="tablist" aria-label="Chọn vùng làm việc" className="flex shrink-0 border-b border-[#E7E5E4] px-4 lg:hidden dark:border-[#292524]">
      {(["chat", "form"] as const).map(tab => <button key={tab} ref={tab === "chat" ? chatTab : formTab} id={`workspace-${tab}-tab`} role="tab" aria-selected={assistant.tab === tab} aria-controls={`workspace-${tab}`} tabIndex={assistant.tab === tab ? 0 : -1} onClick={() => choose(tab)} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "chat" : event.key === "End" ? "form" : tab === "chat" ? "form" : "chat"; choose(next); (next === "chat" ? chatTab : formTab).current?.focus(); } }} className={`min-h-12 flex-1 rounded-none border-b-2 px-3 text-sm font-semibold ${assistant.tab === tab ? "border-[#78716C] text-[#1C1917] dark:border-[#A8A29E] dark:text-[#FAFAF9]" : "border-transparent text-[#78716C] dark:text-[#A8A29E]"}`}>{tab === "chat" ? `Hội thoại${unread ? " · Có phản hồi" : ""}` : "Biểu mẫu"}</button>)}
    </div>}
    <div className={`grid min-h-0 flex-1 ${showForm && showSupport ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"}`}>
      <section id="workspace-chat" aria-label="Hội thoại với trợ lý" className={`${showForm ? assistant.tab === "form" ? showSupport ? "hidden lg:flex" : "hidden" : "flex" : "flex"} order-2 min-h-0 min-w-0 flex-col border-[#E7E5E4] dark:border-[#292524] ${showForm ? "lg:border-l" : ""}`}>
        {showForm && <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-[#E7E5E4] px-4 dark:border-[#292524]"><h2 className="font-serif text-sm font-semibold">Trợ lý học vụ</h2><button type="button" onClick={() => choose("form")} className="min-h-11 rounded-none border border-[#D6D3D1] px-3 text-sm text-[#78716C] lg:hidden dark:border-[#44403C] dark:text-[#A8A29E]">Trở lại biểu mẫu</button></div>}
        <AssistantConversation compact={showForm} />
      </section>
      {hasForm && <section id="workspace-form" aria-label="Biểu mẫu đang làm" className={`${!showForm ? "hidden" : assistant.tab === "chat" ? "hidden lg:block" : "block"} order-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-[#FAFAF9] p-4 sm:p-6 dark:bg-[#141210]`}>
        {assistant.isApiMode ? <P0PreviewPanel /> : task && <VinUniForm key={forms[task].id} task={task} embedded />}
      </section>}
    </div>
    <AccessibleDialog open={historyOpen} onClose={() => setHistoryOpen(false)} labelledBy="assistant-history-title" className="fixed inset-y-0 left-0 flex w-[min(340px,90vw)] flex-col rounded-none border-r border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-[#292524] dark:bg-[#1C1917] shadow-none"><div className="mb-4 flex items-center justify-between"><h2 id="assistant-history-title" className="font-serif text-base font-normal">Lịch sử hội thoại</h2><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Đóng lịch sử" className="flex h-11 w-11 items-center justify-center rounded-none text-[#78716C] hover:bg-[#F5F5F4] dark:hover:bg-[#292524]"><X className="h-5 w-5" /></button></div>{history}</AccessibleDialog>
  </div>;
}
