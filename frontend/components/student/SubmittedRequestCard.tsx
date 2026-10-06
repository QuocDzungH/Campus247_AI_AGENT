"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Eye, FileText, TriangleAlert, X } from "lucide-react";
import { useAssistant } from "@/lib/assistant-context";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { useStore } from "@/lib/store";
import { collectRequests, hasIssuedDocument, requestDate } from "@/lib/my-requests";
import { isDisplayTicketCode, receiveMethodDisplay } from "@/lib/data/api/g2-flow";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { RequestStatus } from "./RequestDetail";
import { secondaryButton } from "./StudentFlowUI";

export function useSubmittedRequest() {
  const assistant = useAssistant();
  const { state: forms } = useVinUniForms();
  const { tickets, currentUser } = useStore();
  const localSubmission = assistant.task ? forms[assistant.task].submission : undefined;
  const ticketId = assistant.isApiMode ? assistant.apiTicket?.id || assistant.apiPendingTicketId : localSubmission?.ticketId;
  const item = currentUser && ticketId ? collectRequests(tickets, [], currentUser.id).find(item => item.id === ticketId) : undefined;
  const candidate = item?.code || (assistant.isApiMode ? assistant.apiTicket?.code : localSubmission?.ticketCode);
  const code = candidate && ticketId && (!assistant.isApiMode || isDisplayTicketCode(candidate, ticketId)) ? candidate : null;
  return { ticketId, item, code, localOnly: !assistant.isApiMode };
}

export function SubmittedRequestCard() {
  const { ticketId, item, code, localOnly } = useSubmittedRequest();
  const { refreshTicket } = useStore();
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sync, setSync] = useState<{ id?: string; loading: boolean; error: string | null }>({ loading: false, error: null });
  const loading = !localOnly && Boolean(ticketId) && (sync.id !== ticketId || sync.loading);
  const error = sync.id === ticketId ? sync.error : null;
  const record = item?.kind === "ticket" ? item.record : undefined;
  const documentRequest = record?.type === "certificate" || record?.type === "transcript";
  const issued = record && !localOnly && hasIssuedDocument(record);
  const href = ticketId ? `/my-requests?ticket=${encodeURIComponent(ticketId)}` : "/my-requests";

  useEffect(() => {
    if (localOnly || !ticketId) return;
    let cancelled = false;
    void refreshTicket(ticketId).then(ticket => {
      if (!cancelled) setSync({ id: ticketId, loading: false, error: ticket ? null : "Chưa tải được nội dung đơn." });
    }).catch(() => {
      if (!cancelled) setSync({ id: ticketId, loading: false, error: "Chưa cập nhật được hồ sơ. Thông tin đã có vẫn được giữ." });
    });
    return () => { cancelled = true; };
  }, [ticketId, localOnly, refreshTicket, retry]);

  if (!ticketId) return null;
  function reload() { setSync({ id: ticketId || undefined, loading: true, error: null }); setRetry(value => value + 1); }
  function view() { setOpen(true); if (!localOnly) reload(); }
  const status = item ? <RequestStatus item={item} localOnly={localOnly} /> : <span className="text-xs text-[var(--ts-text-secondary)]">Đang đồng bộ trạng thái</span>;
  const declaration = record?.requestPayload?.submittedFields || (record ? [
    { name: "purpose", label: "Mục đích / Nội dung yêu cầu", value: record.purpose },
    { name: "destinationOrg", label: "Đơn vị nhận", value: record.destinationOrg || "Chưa cung cấp" },
    { name: "receiveMethod", label: "Cách nhận", value: receiveMethodDisplay(record.receiveMethod) },
    ...(record.notes ? [{ name: "notes", label: "Thông tin đã khai", value: record.notes }] : []),
  ] : []);
  function displayValue(name: string, value: string) {
    if (["receive_method", "receiveMethod"].includes(name) && ["paper_stamped", "digital_pdf"].includes(value)) return receiveMethodDisplay(value);
    if (["complaint_subtype", "complaintSubtype"].includes(name)) return ({ grade_appeal: "Điểm học phần", other: "Nội dung khác" } as Record<string, string>)[value] || value;
    return value || "Chưa cung cấp";
  }

  return <>
    <section aria-label="Đơn đã gửi trong hội thoại" className="border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-[var(--ts-text-primary)] dark:border-[rgba(34,197,94,0.4)] dark:bg-[rgba(20,83,45,0.2)] sm:p-5">
      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#3F6212] dark:text-[#86EFAC]" aria-hidden="true" /><div><h3 className="text-sm font-semibold">{localOnly ? "Đã lưu hồ sơ trên thiết bị" : "Yêu cầu đã được gửi vào hệ thống"}</h3><p className="mt-1 text-xs leading-5 text-[var(--ts-text-secondary)]">{localOnly ? "Bạn có thể xem lại nội dung đơn đã lưu." : "Theo dõi trạng thái và phản hồi của cán bộ trong Hồ sơ của tôi."}</p></div></div>
      <button type="button" onClick={view} aria-haspopup="dialog" aria-label="Xem đơn đã gửi" className="group mt-4 flex min-h-20 w-full items-center gap-3 border border-[var(--ts-border-medium)] bg-[var(--ts-bg)] p-3 text-left transition-colors hover:bg-[var(--ts-surface)] active:bg-[var(--ts-surface-raised)] sm:p-4">
        <span className="flex h-12 w-10 shrink-0 items-center justify-center border border-[var(--ts-border-medium)] bg-[var(--ts-surface)] text-[var(--ts-text-secondary)]"><FileText className="h-5 w-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-6">{record?.title || "Đơn yêu cầu học vụ đã gửi"}</span><span className="mt-1 block break-all font-mono text-xs text-[var(--ts-text-secondary)]">{code || "Đang đồng bộ mã hồ sơ"}</span><span className="mt-2 flex flex-wrap items-center gap-2">{status}</span></span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-[var(--ts-text-secondary)]"><span className="hidden sm:inline">Xem đơn</span><Eye className="h-4 w-4" aria-hidden="true" /></span>
      </button>
      {documentRequest && !issued && <p className="mt-3 flex items-start gap-2 border border-[var(--ts-status-warning-border)] bg-[var(--ts-status-warning-bg)] p-3 text-xs leading-5 text-[var(--ts-status-warning-text)]"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{localOnly ? "Đây là đơn yêu cầu được lưu trên thiết bị. Chưa có giấy xác nhận được phát hành." : "Đơn đã được tiếp nhận. Giấy xác nhận chưa được phát hành tại bước này."}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[var(--ts-text-secondary)]"><span>{item ? `Ghi nhận: ${requestDate(item.submittedAt)}` : loading ? "Đang cập nhật hồ sơ…" : "Mã hồ sơ sẽ hiển thị sau khi đồng bộ."}</span><Link href={href} className="inline-flex min-h-11 items-center gap-1 font-medium hover:underline">Theo dõi hồ sơ<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></div>
      {error && <p role="status" className="mt-2 text-xs leading-5 text-[var(--ts-text-secondary)]">{error}</p>}
    </section>

    <AccessibleDialog open={open} onClose={() => setOpen(false)} labelledBy="submitted-request-title" className="!max-w-[860px] !p-0">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--ts-border-subtle)] bg-[var(--ts-bg)] px-5 py-4 sm:px-8"><div><p className="text-xs text-[var(--ts-text-secondary)]">Nội dung đơn đã gửi</p><h2 id="submitted-request-title" className="mt-1 font-serif text-2xl font-semibold">{record?.type === "complaint" ? "Đơn khiếu nại" : record?.type === "certificate" ? "Đơn xin giấy xác nhận" : record?.type === "transcript" ? "Đơn yêu cầu bảng điểm" : "Đơn yêu cầu học vụ"}</h2><p className="mt-2 break-all font-mono text-xs text-[var(--ts-text-secondary)]">{code || "Đang đồng bộ mã hồ sơ"}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Đóng đơn đã gửi" className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--ts-text-secondary)] hover:bg-[var(--ts-surface)]"><X className="h-5 w-5" aria-hidden="true" /></button></header>
      <div className="bg-[var(--ts-bg)] px-5 py-6 sm:px-8 sm:py-8">
        {loading && <p role="status" className="mb-4 text-sm text-[var(--ts-text-secondary)]">Đang cập nhật nội dung và trạng thái…</p>}
        {error && <div role="alert" className="mb-5 border border-[var(--ts-status-warning-border)] bg-[var(--ts-status-warning-bg)] p-4 text-sm text-[var(--ts-status-warning-text)]"><p>{error}</p><button type="button" disabled={loading} onClick={reload} className={`${secondaryButton} mt-2 disabled:opacity-40`}>Thử tải lại đơn</button></div>}
        {record ? <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ts-border-subtle)] pb-5"><h3 className="max-w-full break-words text-base font-semibold">{record.title}</h3>{status}</div>
          <section aria-label="Sinh viên gửi đơn" className="py-6"><h3 className="mb-4 text-sm font-semibold">Thông tin sinh viên</h3><dl className="grid gap-4 text-sm sm:grid-cols-2">{[["Họ và tên", record.studentName], ["Mã số sinh viên", record.studentMssv], ["Email", record.studentEmail], ["Ngành / Khoa", record.studentMajor], ["Khóa / Lớp", record.studentClassYear], ["Ngày ghi nhận", requestDate(item!.submittedAt)]].map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--ts-text-secondary)]">{label}</dt><dd className="mt-1 break-words">{value || "Chưa cung cấp"}</dd></div>)}</dl></section>
          <section aria-label="Nội dung đã khai" className="border-t border-[var(--ts-border-subtle)] pt-6"><h3 className="mb-4 text-sm font-semibold">Nội dung đơn</h3><dl className="space-y-5 text-sm">{declaration.map((field, index) => <div key={`${field.name}-${index}`}><dt className="text-xs text-[var(--ts-text-secondary)]">{field.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-6">{displayValue(field.name, field.value)}</dd></div>)}</dl></section>
          <p className="mt-6 border-l-2 border-[var(--ts-primary)] bg-[var(--ts-surface)] p-4 text-xs leading-5 text-[var(--ts-text-secondary)]">{issued ? "Đã ghi nhận phát hành tài liệu. Xem tài liệu kết quả trong Hồ sơ của tôi." : "Đây là nội dung đơn yêu cầu đã gửi, chưa phải giấy xác nhận hay quyết định phê duyệt của nhà trường."}</p>
        </> : !loading && !error && <p role="status" className="text-sm leading-6 text-[var(--ts-text-secondary)]">Đơn đã được ghi nhận. Nội dung sẽ hiển thị khi hồ sơ được đồng bộ.</p>}
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ts-border-subtle)] bg-[var(--ts-bg)] px-5 py-4 sm:px-8"><button type="button" onClick={() => setOpen(false)} className={secondaryButton}>Đóng</button><Link href={href} className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold hover:bg-[var(--ts-surface)]">Mở Hồ sơ của tôi<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></footer>
    </AccessibleDialog>
  </>;
}
