"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Clock3, Download, MessageSquare, Paperclip } from "lucide-react";
import { hasIssuedDocument, latestOfficerReply, receiptHtml, requestDate as formatDate, requestStates, requestStatusLabel, ticketThreadSenderLabel, ticketThreadTitle, validateSupplementFile, type RequestItem } from "@/lib/my-requests";
import { useStore } from "@/lib/store";
import { fieldClass, primaryButton, secondaryButton } from "./StudentFlowUI";
import { saveLocalAttachments } from "@/lib/local-attachments";
import type { StoredAttachment } from "@/lib/types";
import { AttachmentDownload } from "./AttachmentDownload";

export function RequestStatus({ item, localOnly = false, className = "" }: { item: RequestItem; localOnly?: boolean; className?: string }) {
  const label = requestStatusLabel(item, localOnly);
  const configs: Record<string, { container: string; dot: string; pulse?: boolean }> = {
    completed: {
      container: "border border-emerald-300/80 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
      dot: "bg-emerald-600 dark:bg-emerald-400",
    },
    supplement: {
      container: "border border-amber-300 bg-amber-50/90 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300",
      dot: "bg-amber-500",
      pulse: true,
    },
    processing: {
      container: "border border-blue-200 bg-blue-50/90 text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-200",
      dot: "bg-blue-600 dark:bg-blue-400",
    },
    new: {
      container: "border border-[#D6D3D1] bg-[#FAFAF9] text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1]",
      dot: "bg-[#78716C] dark:bg-[#A8A29E]",
    },
    draft: {
      container: "border border-[#E7E5E4] bg-[#F5F5F4] text-[#78716C] dark:border-[#383533] dark:bg-[#201D1A] dark:text-[#A8A29E]",
      dot: "bg-[#A8A29E]",
    },
  };
  const config = configs[item.state] || configs.new;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${config.container} ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot} ${config.pulse ? "animate-pulse" : ""}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

const section = "border-b border-[#E7E5E4] px-5 py-6 last:border-b-0 dark:border-[#292524] sm:px-6";
const muted = "text-sm leading-relaxed text-[#57534E] dark:text-[#A8A29E]";

export function RequestDetail({ item, localOnly, onBack, onMessage, onSupplement, detailLoading = false, detailError = null, onRetryDetail }: {
  item: RequestItem; localOnly: boolean; onBack: () => void;
  onMessage: (id: string, text: string) => Promise<void>;
  onSupplement: (id: string, payload: { note: string; fileName?: string; docTitle?: string; attachment?: StoredAttachment }) => Promise<void>;
  detailLoading?: boolean;
  detailError?: string | null;
  onRetryDetail?: () => void;
}) {
  const { downloadIssuedDocument } = useStore();
  const heading = useRef<HTMLHeadingElement>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const latest = latestOfficerReply(item);
  const pending = item.kind === "review" ? [...item.record.supplementRequests].reverse().find((r) => r.status === "sent") : undefined;

  useEffect(() => { heading.current?.focus(); }, [item.id]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await onMessage(item.id, text.trim()); setText("");
      setNotice(localOnly ? "Đã lưu tin nhắn vào hồ sơ trên thiết bị này." : "Đã gửi tin nhắn. Bạn có thể theo dõi phản hồi tại đây.");
    } catch { setError("Chưa gửi được tin nhắn. Nội dung đang nhập vẫn được giữ để bạn thử lại."); }
    finally { setBusy(false); }
  }

  async function supplement(event: FormEvent) {
    event.preventDefault();
    if (busy || !localOnly || !note.trim() || !file || fileError) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const [attachment] = await saveLocalAttachments(item.record.studentId, item.id, { supplement: [file] });
      await onSupplement(item.id, { note: note.trim(), fileName: file.name, docTitle: `Tài liệu bổ sung: ${file.name}`, attachment });
      setNotice("Đã lưu ghi chú và tệp bổ sung vào hồ sơ trên thiết bị này.");
      setNote(""); setFile(null); if (fileInput.current) fileInput.current.value = "";
    } catch { setError("Chưa lưu được bổ sung. Ghi chú và tệp đang chọn vẫn được giữ để bạn thử lại."); }
    finally { setBusy(false); }
  }

  function downloadReceipt() {
    const url = URL.createObjectURL(new Blob([receiptHtml(item, localOnly)], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `bien-nhan-${item.code.replace(/[^a-zA-Z0-9-]/g, "-")}.html`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Đã tạo biên nhận HTML gồm thông tin đã khai. Đây không phải tài liệu học vụ được phát hành.");
  }

  const stages = item.state === "draft" ? ["Bản nháp chưa nộp"] : [
    "Đã ghi nhận hồ sơ",
    item.state === "new" ? "Chờ cán bộ xử lý" : item.state === "supplement" ? "Chờ sinh viên bổ sung" : item.kind === "ticket" && item.record.status === "pending_officer" ? "Chờ cán bộ phản hồi" : "Cán bộ xử lý",
    item.kind === "review" ? "Rà soát sơ bộ" : "Kết quả xử lý",
  ];
  const activeStep = item.state === "draft" || item.state === "new" ? 0 : item.state === "completed" ? 2 : 1;

  return <article className="min-w-0 rounded-sm border border-[#E7E5E4] bg-[#FFFFFF] dark:border-[#292524] dark:bg-[#1C1917]" aria-labelledby="request-detail-title">
    <div className={section}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">Chi tiết hồ sơ</span>
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-sm px-2 text-xs font-medium text-[#78716C] transition-colors hover:bg-[#F5F5F4] hover:text-[#1C1917] dark:text-[#A8A29E] dark:hover:bg-[#292524] dark:hover:text-[#FAFAF9]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Quay lại danh sách
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <RequestStatus item={item} localOnly={localOnly} />
        <span className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">{item.type}</span>
      </div>
      <h2 id="request-detail-title" ref={heading} tabIndex={-1} className="break-words font-serif text-2xl font-semibold leading-snug tracking-tight text-[#1C1917] dark:text-[#FAFAF9] sm:text-3xl">{item.title}</h2>
      <dl className="mt-5 grid gap-4 border-y border-[#E7E5E4] py-4 dark:border-[#292524] sm:grid-cols-2">
        <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Mã hồ sơ</dt><dd className="mt-1 break-all font-mono text-sm font-medium text-[#1C1917] dark:text-[#FAFAF9]">{item.code}</dd></div>
        <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">{item.state === "draft" || localOnly ? "Ngày ghi nhận" : "Ngày nộp"}</dt><dd className="mt-1 text-sm text-[#1C1917] dark:text-[#FAFAF9]">{formatDate(item.submittedAt)}</dd></div>
        {item.updatedAt && <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Cập nhật gần nhất</dt><dd className="mt-1 text-sm text-[#1C1917] dark:text-[#FAFAF9]">{formatDate(item.updatedAt)}</dd></div>}
      </dl>
      <p className={`mt-4 ${muted}`}>{item.kind === "review" && item.state === "completed" ? "Đã hoàn tất rà soát sơ bộ. Chưa có quyết định công nhận học phần cuối cùng trong hồ sơ này." : item.kind === "ticket" && item.record.status === "pending_officer" ? "Hồ sơ đã chuyển tới bước cán bộ. Chưa có xác nhận bắt đầu xử lý; hãy theo dõi phản hồi." : requestStates[item.state].description}</p>
      <div className="mt-5 rounded-sm border-l-2 border-[#1C1917] bg-[#F5F5F4]/70 p-4 dark:border-[#FAFAF9] dark:bg-[#23201D]/70">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#1C1917] dark:text-[#FAFAF9]"><Clock3 className="h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" aria-hidden="true" />Việc bạn cần làm</p>
        <p className={`mt-1 ${muted}`}>{item.state === "supplement" ? "Xem yêu cầu bổ sung ngay bên dưới." : item.state === "completed" ? "Đọc kết quả xử lý và phản hồi của cán bộ." : item.state === "draft" ? "Hoàn thiện và nộp hồ sơ để được xử lý." : "Theo dõi phản hồi. Bạn chưa cần nộp lại hồ sơ này."}</p>
        {item.state !== "draft" && <a className={`${secondaryButton} -ml-3 mt-1 text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#FAFAF9]`} href={pending ? "#supplement-title" : item.state === "completed" ? "#result-title" : "#latest-reply-title"}>{pending ? "Xem yêu cầu bổ sung" : item.state === "completed" ? "Xem kết quả xử lý" : "Xem phản hồi gần nhất"}</a>}
        <p className={`mt-2 ${muted}`}>Thời gian xử lý: chưa có thời hạn được cán bộ xác nhận cho hồ sơ này.</p>
        {item.kind === "ticket" && ["certificate", "transcript"].includes(item.record.type) && <p className={`mt-1 ${muted}`}>Thời gian tham khảo: 2–3 ngày làm việc, cao điểm tới 5 ngày. Cán bộ xác nhận thời gian cụ thể khi tiếp nhận.</p>}
      </div>
    </div>

    {notice && <p role="status" className="rounded-sm border border-[#78716C] bg-[#EFEDEB] p-4 text-sm leading-relaxed text-[#1C1917] dark:border-[#A8A29E] dark:bg-[#292524] dark:text-[#FAFAF9]">{notice}</p>}
    {error && <p role="alert" className="rounded-sm border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

    {pending && <section aria-labelledby="supplement-title" className={`${section} border-amber-300 dark:border-amber-700`}>
      <h3 id="supplement-title" tabIndex={-1} className="text-base font-semibold text-[#1C1917] dark:text-[#FAFAF9]">Yêu cầu bổ sung của cán bộ</h3>
      <p className={`mt-1 ${muted}`}>Gửi lúc: {formatDate(pending.sentAt || pending.createdAt)}</p>
      <p className="mt-3 font-medium text-[#1C1917] dark:text-[#FAFAF9]">{pending.subject}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">{pending.messageBody}</p>
      {pending.requestedDocuments.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{pending.requestedDocuments.map((title, index) => <li key={index}>{title}</li>)}</ul>}
      <form onSubmit={supplement} className="mt-5 space-y-4">
        <p id="supplement-limit" className={muted}>{localOnly ? "Ghi chú và tệp bổ sung được lưu cùng hồ sơ trên thiết bị này." : "Chưa kết nối nơi tiếp nhận tệp. Liên hệ cán bộ phụ trách theo yêu cầu bên trên."}</p>
        {localOnly && <>
          <div><label htmlFor="supplement-file" className="mb-2 block text-sm font-semibold text-[#57534E] dark:text-[#D6D3D1]">Chọn tệp bổ sung (bắt buộc)</label>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileInput} id="supplement-file" type="file" accept=".pdf,.png,.jpg,.jpeg" required disabled={busy} aria-describedby={`supplement-file-hint supplement-limit${fileError ? " supplement-file-error" : ""}`} aria-invalid={Boolean(fileError)} className="sr-only" onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                const validation = validateSupplementFile(selected);
                setFile(validation ? null : selected); setFileError(validation);
              }} />
              <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className={`${secondaryButton} rounded-sm`}>
                <Paperclip className="h-4 w-4" aria-hidden="true" />
                <span>{file ? "Đổi tệp khác" : "Chọn tệp"}</span>
              </button>
              <span className="text-sm text-[#57534E] dark:text-[#D6D3D1] break-all">
                {file ? file.name : "Chưa chọn tệp"}
              </span>
            </div>
            <p id="supplement-file-hint" className={`mt-2 ${muted}`}>1 tệp PDF/PNG/JPG, tối đa 10MB. Kiểm tra đúng tài liệu được yêu cầu trước khi xác nhận.</p>
            {fileError && <p id="supplement-file-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{fileError}</p>}
          </div>
          <div><label htmlFor="supplement-note" className="mb-2 block text-sm font-semibold text-[#57534E] dark:text-[#D6D3D1]">Ghi chú bổ sung (bắt buộc)</label><textarea id="supplement-note" required value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} maxLength={4000} rows={3} className={fieldClass} /></div>
          <button type="submit" disabled={busy || !note.trim() || !file || Boolean(fileError)} className={`${primaryButton} w-full sm:w-auto`}>{busy ? "Đang lưu…" : "Xác nhận bổ sung"}</button>
        </>}
      </form>
    </section>}

    {!pending && <section className={section} aria-labelledby="latest-reply-title">
      <h3 id="latest-reply-title" tabIndex={-1} className="flex items-center gap-2 text-base font-semibold text-[#1C1917] dark:text-[#FAFAF9]"><MessageSquare className="h-5 w-5" aria-hidden="true" />Phản hồi gần nhất của cán bộ</h3>
      {detailLoading && <p role="status" className={`mt-3 ${muted}`}>Đang tải chi tiết hồ sơ…</p>}
      {detailError && <p role="alert" className="mt-3 rounded-none border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{detailError} Danh sách hồ sơ vẫn được giữ.{onRetryDetail && <button type="button" className={`${secondaryButton} mt-2`} onClick={onRetryDetail}>Thử tải lại chi tiết</button>}</p>}
      {!detailLoading && <p className={`mt-3 whitespace-pre-wrap break-words ${muted}`}>{latest || "Chưa có phản hồi của cán bộ trong hồ sơ này."}</p>}
    </section>}

    {item.state === "completed" && <section className={section} aria-labelledby="result-title">
      <h3 id="result-title" tabIndex={-1} className="text-base font-semibold">Kết quả xử lý</h3>
      {item.kind === "review" ? <>
        <p className={`mt-3 ${muted}`}>{item.record.finalReport?.conclusionSummary || "Chưa có báo cáo kết quả được đính kèm."}</p>
        {item.record.finalReport && <p className={`mt-2 ${muted}`}>Người lập báo cáo: {item.record.finalReport.officerName} · {formatDate(item.record.finalReport.completedAt)}</p>}
        <p className={`mt-3 ${muted}`}>Rà soát sơ bộ không thay thế quyết định của Hội đồng. Chưa có quyết định cuối cùng được cung cấp tại đây.</p>
      </> : <p className={`mt-3 ${muted}`}>{["certificate", "transcript"].includes(item.record.type) ? "Xem tình trạng tài liệu bên dưới. Hồ sơ hoàn tất không đồng nghĩa tài liệu đã được phát hành." : "Xem phản hồi của cán bộ và lịch sử trao đổi để biết cách giải quyết."}</p>}
    </section>}

    {item.kind === "ticket" && ["certificate", "transcript"].includes(item.record.type) && <section className={section} aria-labelledby="document-title">
      <h3 id="document-title" className="text-base font-semibold">Tài liệu kết quả</h3>
      {hasIssuedDocument(item.record) && !localOnly ? <>
        <p className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">Đã ghi nhận phát hành</p>
        <p className={`mt-2 ${muted}`}>Số văn bản: {item.record.issuedDocument?.id || item.record.issuedCertificate?.docNumber} · Người phát hành: {item.record.issuedCertificate?.issuedByOfficerName || item.record.issuedDocument?.issuedBy}</p>
        <p className={muted}>Ngày phát hành: {formatDate(item.record.issuedDocument?.issuedAt || item.record.issuedCertificate?.issuedAt || "")}</p>
        {item.record.issuedDocument ? (
          <>
            <p className={`mt-2 ${muted}`}>Chữ ký: {item.record.issuedDocument.signatureStatus === "unsigned" ? "chưa ký số" : item.record.issuedDocument.signatureStatus}. Không phải giấy có giá trị chính thức.</p>
            <button type="button" className={`${primaryButton} mt-3`} onClick={() => void downloadIssuedDocument(item.record.id, item.record.issuedDocument!.id)}>
              <Download className="h-4 w-4" />Tải bản hệ thống đã phát hành
            </button>
          </>
        ) : (
          <p className={`mt-3 ${muted}`}>Chưa có tệp chính thức để tải trong hồ sơ này. Liên hệ cán bộ phụ trách để nhận tài liệu.</p>
        )}
      </> : <>
        <p className={`mt-3 ${muted}`}>Tài liệu chính thức chưa được cung cấp trong hồ sơ này. Bạn sẽ nhận thông báo khi có kết quả.</p>
        <p className={`mt-2 ${muted}`}>Cách nhận đã khai: {item.record.receiveMethod === "paper_stamped" ? "Bản giấy có đóng dấu" : item.record.receiveMethod === "digital_pdf" ? "Bản điện tử" : "Chưa có dữ liệu"}. Hãy theo dõi phản hồi của cán bộ.</p>
      </>}
    </section>}

    <section className={section} aria-labelledby="progress-title">
      <h3 id="progress-title" className="text-base font-semibold text-[#1C1917] dark:text-[#FAFAF9]">Tiến trình hồ sơ</h3>
      <ol className="mt-4 space-y-3">{stages.map((stage, index) => <li key={stage} aria-current={index === activeStep ? "step" : undefined} className="flex items-start gap-3 text-sm">
        <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border text-xs font-semibold ${index <= activeStep ? "border-[#1C1917] bg-[#1C1917] text-[#FAFAF9] dark:border-[#FAFAF9] dark:bg-[#FAFAF9] dark:text-[#1C1917]" : "border-[#E7E5E4] bg-[#FAFAF9] text-[#78716C] dark:border-[#2E2A27] dark:bg-[#201D1A] dark:text-[#A8A29E]"}`}>{index < activeStep ? <Check className="h-4 w-4" /> : index + 1}</span>
        <span className="pt-1 font-medium text-[#1C1917] dark:text-[#FAFAF9]">{stage}<span className={`ml-2 font-normal ${muted}`}>{index < activeStep ? "· Đã qua" : index === activeStep ? "· Hiện tại" : "· Chưa có xác nhận"}</span></span>
      </li>)}</ol>
      {item.kind === "review" && item.state === "completed" && <p className={`mt-3 ${muted}`}>Quyết định công nhận của Hội đồng: chưa có thông tin.</p>}
    </section>

    <section className={section} aria-labelledby="conversation-title">
      <h3 id="conversation-title" className="text-base font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{item.kind === "ticket" ? ticketThreadTitle(item.record.messages) : "Trao đổi với cán bộ"}</h3>
      {item.kind === "ticket" ? <>
        <div className="mt-4 space-y-3">{item.record.messages.filter((m) => m.content.trim()).map((m) => <div key={m.id} className={`rounded-sm border p-4 ${m.senderRole === "student" ? "border-[#E7E5E4] bg-[#F5F5F4]/70 dark:border-[#292524] dark:bg-[#201D1A]/70" : "border-[#D6D3D1] bg-[#FFFFFF] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:border-[#383533] dark:bg-[#1C1917]"}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-serif text-sm font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{ticketThreadSenderLabel(m)}</p>
            <span className="text-[11px] tabular-nums text-[#78716C] dark:text-[#A8A29E]">{formatDate(m.timestamp)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">{m.content}</p>
          {m.attachments?.map((attachment, index) => <p key={index} className={`mt-2 flex items-start gap-2 ${muted}`}><Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-[#78716C] dark:text-[#A8A29E]" aria-hidden="true" /><span className="break-all">{attachment.name} · Chưa có tệp đính kèm để tải</span></p>)}
        </div>)}</div>
        {!item.record.messages.some((m) => m.content.trim()) && <p className={`mt-3 ${muted}`}>Chưa có hội thoại trên hồ sơ này.</p>}
        <form onSubmit={sendMessage} className="mt-5 space-y-3">
          <label htmlFor="request-message" className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Tin nhắn về hồ sơ {item.code}</label>
          <textarea id="request-message" value={text} disabled={busy} onChange={(e) => setText(e.target.value)} required maxLength={4000} rows={3} className={fieldClass} aria-describedby="request-message-hint" />
          <p id="request-message-hint" className={muted}>{localOnly ? "Tin nhắn được lưu trong hồ sơ trên thiết bị này." : "Tin nhắn được gửi vào hồ sơ; không phải yêu cầu mới."}</p>
          <button type="submit" disabled={busy || !text.trim()} className={`${primaryButton} w-full sm:w-auto`}>{busy ? "Đang lưu…" : localOnly ? "Lưu tin nhắn" : "Gửi tin nhắn"}</button>
        </form>
      </> : <>
        {item.record.supplementRequests.filter((r) => r.status === "responded").map((r) => <div key={r.id} className="mt-5 rounded-sm border-l-2 border-[#1C1917] bg-[#F5F5F4]/70 p-4 dark:border-[#FAFAF9] dark:bg-[#201D1A]/70">
          <p className="font-serif text-sm font-semibold text-[#1C1917] dark:text-[#FAFAF9]">Cán bộ · {r.subject}</p><p className={`mt-1 ${muted}`}>{formatDate(r.sentAt || r.createdAt)}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">{r.messageBody}</p>
          {r.studentReply && <div className="mt-3 border-t border-[#E7E5E4] pt-3 dark:border-[#292524]"><p className="font-serif text-sm font-semibold text-[#1C1917] dark:text-[#FAFAF9]">Bạn · {formatDate(r.studentReply.submittedAt)}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#57534E] dark:text-[#D6D3D1]">{r.studentReply.note}</p></div>}
        </div>)}
        <p className={`mt-3 ${muted}`}>Trao đổi về hồ sơ được ghi nhận qua các yêu cầu bổ sung của cán bộ.</p>
      </>}
    </section>

    <details className={section}>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-base font-semibold">Thông tin bạn đã khai<span aria-hidden="true">⌄</span></summary>
      <p className={`mt-2 ${muted}`}>Thông tin do sinh viên cung cấp; chưa thể hiện xác minh hoặc phê duyệt của cán bộ.</p>
      <dl className="mt-4 space-y-4 text-sm">
        <div><dt className={muted}>Sinh viên / Student ID đã khai</dt><dd className="mt-1 break-words font-medium">{item.record.studentName} · {item.record.studentMssv}</dd></div>
        {item.kind === "ticket" ? <>
          <div><dt className={muted}>Mục đích / Nội dung yêu cầu</dt><dd className="mt-1 whitespace-pre-wrap break-words">{item.record.purpose}</dd></div>
          <div><dt className={muted}>Đơn vị nhận</dt><dd className="mt-1 break-words">{item.record.destinationOrg || "Không cung cấp"}</dd></div>
          {item.record.notes && <div><dt className={muted}>Thông tin hồ sơ</dt><dd className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{item.record.notes}</dd></div>}
        </> : <>
          <div><dt className={muted}>Học phần đã học</dt><dd className="mt-1">{item.record.priorCourseCode} · {item.record.priorCourseName} · {item.record.priorCourseCredits} tín chỉ</dd></div>
          <div><dt className={muted}>Cơ sở đào tạo</dt><dd className="mt-1">{item.record.priorInstitution.replace(/\s*\(Minh họa\)/gi, "")}</dd></div>
          <div><dt className={muted}>Học phần đề nghị công nhận</dt><dd className="mt-1">{item.title} · {item.record.targetCourseCredits} tín chỉ</dd></div>
        </>}
      </dl>
      <button type="button" onClick={downloadReceipt} className={`${secondaryButton} mt-4 border border-slate-300 dark:border-slate-600`}><Download className="h-4 w-4" aria-hidden="true" />Tải thông tin hồ sơ</button>
      <p className={`mt-2 ${muted}`}>Biên nhận ghi thông tin đã khai, không phải giấy học vụ hoặc quyết định.</p>
    </details>

    {item.kind === "ticket" && Boolean(item.record.attachments?.length) && <section className={section} aria-labelledby="attachments-title">
      <h3 id="attachments-title" className="text-base font-semibold">Tệp đính kèm</h3>
      <div className="mt-4 space-y-3">{item.record.attachments?.map(attachment => <AttachmentDownload key={attachment.id} attachment={attachment} ownerId={item.record.studentId} />)}</div>
    </section>}

    {item.kind === "review" && <details className={section} open={Boolean(item.record.documents.some(document => document.versions.some(version => version.attachment)))}>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-base font-semibold">Danh sách tài liệu đã ghi nhận<span aria-hidden="true">⌄</span></summary>
      <p className={`mt-2 ${muted}`}>Cán bộ kiểm tra nội dung và tính hợp lệ của tài liệu khi xử lý hồ sơ.</p>
      <ul className="mt-3 space-y-3">{item.record.documents.map((document) => {
        const version = document.versions.find(v => v.version === document.currentVersion);
        return <li key={document.id} className="space-y-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-700"><p className="font-semibold">{document.title}</p><p className="mt-1 break-all">{version?.fileName || "Chưa có tên tệp"} · phiên bản {document.currentVersion}</p>{version?.attachment ? <AttachmentDownload attachment={version.attachment} ownerId={item.record.studentId} /> : <p className={muted}>Chưa có tệp đính kèm để tải.</p>}</li>;
      })}</ul>
    </details>}
  </article>;
}
