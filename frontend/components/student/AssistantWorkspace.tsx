"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, MessageCircle, PanelLeft, PanelLeftClose, Search, Sparkles, SquarePen, X } from "lucide-react";
import { useAssistant } from "@/lib/assistant-context";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { isDisplayTicketCode } from "@/lib/data/api/g2-flow";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { AssistantConversation } from "./AssistantConversation";
import { VinUniForm } from "./VinUniForm";
import { P0PreviewPanel } from "./P0PreviewPanel";
import { useSubmittedRequest } from "./SubmittedRequestCard";

const subscribeDesktop = (notify: () => void) => {
  const media = window.matchMedia("(min-width: 1024px)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readDesktop = () => window.matchMedia("(min-width: 1024px)").matches;

function AssistantHistory({ onNavigate, mobile = false }: { onNavigate: () => void; mobile?: boolean }) {
  const assistant = useAssistant();
  const [query, setQuery] = useState("");
  const normalize = (value: string) => value.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const threads = assistant.state.threads.filter(thread => normalize(thread.title).includes(normalize(query.trim())));
  const searchId = mobile ? "mobile-conversation-search" : "conversation-search";
  return <>
    <div className="space-y-3 px-3 pb-5">
      <button type="button" onClick={() => { assistant.startNewThread(); setQuery(""); onNavigate(); }} className="flex min-h-11 w-full items-center gap-3 border border-[var(--ts-border-medium)] bg-[var(--ts-bg)] px-3 text-sm font-semibold transition-colors hover:bg-[var(--ts-surface-raised)] active:bg-[var(--ts-surface-raised)]"><SquarePen className="h-4 w-4 shrink-0" aria-hidden="true" />Trò chuyện mới</button>
      <div className="flex h-11 items-center gap-2 border-b border-[var(--ts-border-medium)] px-3 focus-within:border-[var(--ts-focus-ring)] focus-within:ring-1 focus-within:ring-[var(--ts-focus-ring)]">
        <Search className="h-4 w-4 shrink-0 text-[var(--ts-text-secondary)]" aria-hidden="true" />
        <label htmlFor={searchId} className="sr-only">Tìm cuộc trò chuyện</label>
        <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={200} placeholder="Tìm cuộc trò chuyện" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--ts-text-primary)] outline-none placeholder:text-[var(--ts-text-secondary)]" />
      </div>
    </div>
    <nav aria-label="Lịch sử hội thoại" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
      <h2 className="mb-3 px-3 text-xs font-semibold text-[var(--ts-text-secondary)]">Cuộc trò chuyện</h2>
      {threads.length ? <ul className="space-y-1">{threads.map(thread => <li key={thread.id}><button type="button" title={thread.title} aria-current={thread.id === assistant.active.id ? "true" : undefined} onClick={() => { assistant.selectThread(thread.id); onNavigate(); }} className={`flex min-h-11 w-full items-start gap-2.5 border-l-2 px-3 py-3 text-left text-sm transition-colors active:bg-[var(--ts-surface-raised)] ${thread.id === assistant.active.id ? "border-[var(--ts-primary)] bg-[var(--ts-surface-raised)] font-semibold" : "border-transparent text-[var(--ts-text-secondary)] hover:bg-[var(--ts-surface-raised)]"}`}><MessageCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0"><span className="line-clamp-2 break-words leading-5">{thread.title}</span>{(thread.formTask || thread.apiPreview || thread.apiTicket || thread.apiPendingTicketId) && <span className="mt-1 block text-xs font-normal text-[var(--ts-text-secondary)]">Có hồ sơ</span>}{!thread.exchanges.length && thread.input && <span className="mt-1 block text-xs font-normal text-[var(--ts-text-secondary)]">Có câu hỏi chưa gửi</span>}</span></button></li>)}</ul> : <p role="status" className="px-3 text-sm leading-6 text-[var(--ts-text-secondary)]">Không tìm thấy cuộc trò chuyện. Thử từ khóa khác.</p>}
    </nav>
    <p className="border-t border-[var(--ts-border-subtle)] px-6 py-4 text-xs leading-5 text-[var(--ts-text-secondary)]">{assistant.isApiMode ? "Hội thoại được đồng bộ với tài khoản của bạn." : "Hội thoại và bản nháp lưu trên thiết bị này."}</p>
  </>;
}

export function AssistantWorkspace() {
  const assistant = useAssistant();
  const { state: forms } = useVinUniForms();
  const { ticketId: submittedTicketId, code: submittedCode } = useSubmittedRequest();
  const ticketCode = submittedCode || (
    assistant.apiTicket && isDisplayTicketCode(assistant.apiTicket.code, assistant.apiTicket.id)
      ? assistant.apiTicket.code
      : null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const desktop = useSyncExternalStore(subscribeDesktop, readDesktop, () => false);
  const sidebarToggle = useRef<HTMLButtonElement>(null);
  const [readMessages, setReadMessages] = useState(0);
  const [supportExpanded, setSupportExpanded] = useState(true);
  const chatTab = useRef<HTMLButtonElement>(null);
  const formTab = useRef<HTMLButtonElement>(null);
  const task = assistant.active.formTask;
  const hasForm = assistant.isApiMode
    ? Boolean(assistant.apiPreview || assistant.apiLocked || assistant.apiTicket || assistant.apiPendingTicketId)
    : Boolean(task);
  // A task remains mounted under mobile tabs so file selection and errors survive.
  const showForm = hasForm && assistant.formExpanded && !submittedTicketId;
  const showSupport = supportExpanded || assistant.tab === "chat";
  const unread = assistant.tab === "form" && assistant.active.exchanges.length > readMessages;
  function choose(tab: "chat" | "form") { assistant.setTab(tab); setReadMessages(assistant.active.exchanges.length); }
  function afterHistoryNavigation() {
    setHistoryOpen(false);
    requestAnimationFrame(() => {
      const targets = document.querySelectorAll<HTMLElement>("#chatbot-question, #assistant-question, #workspace-form input, #workspace-form button");
      Array.from(targets).find(target => target.getClientRects().length)?.focus();
    });
  }
  return <div className="assistant-workspace flex h-[calc(100dvh-64px)] min-h-0 overflow-hidden bg-[var(--ts-bg)] text-[var(--ts-text-primary)]">
    {sidebarExpanded && <aside id="assistant-sidebar" aria-label="Thanh bên hội thoại" className="hidden w-60 shrink-0 flex-col border-r border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] lg:flex xl:w-64">
      <div className="flex min-h-16 shrink-0 items-center justify-between gap-2 px-6"><span className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[var(--ts-text-secondary)]" aria-hidden="true" />Trợ lý học vụ</span><button type="button" onClick={() => { setSidebarExpanded(false); requestAnimationFrame(() => sidebarToggle.current?.focus()); }} aria-label="Thu gọn thanh bên" className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center text-[var(--ts-text-secondary)] transition-colors hover:bg-[var(--ts-surface-raised)]"><PanelLeftClose className="h-4 w-4" aria-hidden="true" /></button></div>
      <AssistantHistory onNavigate={afterHistoryNavigation} />
    </aside>}
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button type="button" onClick={() => setHistoryOpen(true)} aria-label="Mở lịch sử hội thoại" aria-expanded={historyOpen && !desktop} aria-haspopup="dialog" className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--ts-text-secondary)] transition-colors hover:bg-[var(--ts-surface)] lg:hidden"><PanelLeft className="h-5 w-5" aria-hidden="true" /></button>
        <button ref={sidebarToggle} type="button" onClick={() => setSidebarExpanded(!sidebarExpanded)} aria-label={sidebarExpanded ? "Thu gọn thanh bên" : "Mở thanh bên hội thoại"} aria-expanded={sidebarExpanded} aria-controls="assistant-sidebar" className={`${sidebarExpanded ? "hidden" : "hidden lg:flex"} h-11 w-11 shrink-0 items-center justify-center text-[var(--ts-text-secondary)] transition-colors hover:bg-[var(--ts-surface)]`}><PanelLeft className="h-5 w-5" aria-hidden="true" /></button>
        {hasForm && <button type="button" onClick={assistant.returnToStart} className="inline-flex min-h-11 items-center gap-2 rounded-none border border-[#D6D3D1] px-2 text-sm font-medium text-[#57534E] hover:bg-[#F5F5F4] dark:border-[#44403C] dark:text-[#D6D3D1] dark:hover:bg-[#292524]"><ArrowLeft className="h-4 w-4" />Trở về</button>}
        <div className="min-w-0"><h1 className="text-base font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{showForm ? assistant.isApiMode ? assistant.apiLocked ? "Chờ cán bộ xử lý" : assistant.apiPreview?.serviceType === "academic_complaint" ? "Khiếu nại trong hội thoại" : "Xin giấy xác nhận trong hội thoại" : task === "certificate" ? "Yêu cầu tài liệu VinUni" : "Khiếu nại" : "Trợ lý học vụ"}</h1>{!assistant.isApiMode && (!showForm || forms[task!].submission) && <p className="text-xs text-[#57534E] dark:text-[#D6D3D1]">{showForm ? `Mã hồ sơ: ${forms[task!].submission!.ticketCode}` : "Hướng dẫn thủ tục và hỗ trợ điền hồ sơ"}</p>}{assistant.isApiMode && <p className="text-xs text-[#57534E] dark:text-[#D6D3D1]">{ticketCode ? `Mã hồ sơ: ${ticketCode}` : assistant.apiPendingTicketId ? "Đã nộp yêu cầu. Đang đồng bộ mã hồ sơ." : "Hướng dẫn thủ tục và hỗ trợ hồ sơ"}</p>}</div>
      </div>
      <div className="flex items-center gap-2"><button type="button" onClick={assistant.startNewThread} aria-label="Trò chuyện mới" title="Trò chuyện mới" className={`flex h-11 w-11 items-center justify-center text-[var(--ts-text-secondary)] transition-colors hover:bg-[var(--ts-surface)] ${sidebarExpanded ? "lg:hidden" : ""}`}><SquarePen className="h-5 w-5" aria-hidden="true" /></button>
        {showForm && <button type="button" aria-expanded={showSupport} aria-controls="workspace-chat" onClick={() => { setSupportExpanded(!showSupport); choose("form"); }} className="hidden min-h-11 items-center gap-2 rounded-none border border-[#D6D3D1] px-3 text-sm text-[#78716C] lg:flex hover:bg-[#F5F5F4] dark:border-[#44403C] dark:text-[#A8A29E] dark:hover:bg-[#292524]"><MessageCircle className="h-4 w-4" />{showSupport ? "Thu gọn trợ lý" : "Hỏi trợ lý"}</button>}
        {hasForm && !showForm && !submittedTicketId && <button type="button" onClick={() => { assistant.setFormExpanded(true); choose("form"); }} className="min-h-11 rounded-none border border-[#D6D3D1] px-3 text-sm text-[#78716C] hover:bg-[#F5F5F4] dark:border-[#44403C] dark:text-[#A8A29E] dark:hover:bg-[#292524]">Tiếp tục hồ sơ</button>}
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
    </div>
    <AccessibleDialog open={historyOpen && !desktop} onClose={() => setHistoryOpen(false)} labelledBy="assistant-history-title" className="fixed inset-y-0 left-0 flex !max-h-none !w-[min(300px,88vw)] flex-col border-r border-[var(--ts-border-subtle)] !bg-[var(--ts-surface)] !p-0 shadow-none">
      <div className="flex min-h-16 shrink-0 items-center justify-between gap-2 px-6"><h2 id="assistant-history-title" className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[var(--ts-text-secondary)]" aria-hidden="true" />Lịch sử hội thoại</h2><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Đóng lịch sử" className="-mr-3 flex h-11 w-11 items-center justify-center text-[var(--ts-text-secondary)] transition-colors hover:bg-[var(--ts-surface-raised)]"><X className="h-5 w-5" aria-hidden="true" /></button></div>
      <AssistantHistory mobile onNavigate={afterHistoryNavigation} />
    </AccessibleDialog>
  </div>;
}
