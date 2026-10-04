"use client";

import { useEffect, useRef, useState } from "react";
import { QueueBackLink } from "./QueueBackLink";
import { formatDate } from "@/lib/format-date";
import { Send, CheckCircle2, Sparkles, FileText, Printer } from "lucide-react";
import type { SystemVerificationItem, Ticket } from "@/lib/types";
import { useStore } from "@/lib/store";
import { actionBlock, officerDraftFor, ticketSnapshot, ticketTypeLabels } from "@/lib/staff-policy";
import { hasIssuedDocument } from "@/lib/my-requests";
import { downloadCertificateFile } from "@/lib/certificate-service";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AttachmentDownload } from "@/components/student/AttachmentDownload";
import { StaffShell, staffButton, staffField, staffPrimary, staffSurface } from "./StaffShell";
import { useStaffDraft } from "./useStaffDraft";
import { OfficerFactSheet } from "./OfficerFactSheet";
import { assignedToOtherOfficer, claimDisabled, decideReviewedBriefVersion, displayValue, receiveMethodDisplay } from "@/lib/data/api/g2-flow";

type Action = "respond" | "request_info" | "resolve";
const labels: Record<Action, string> = { respond: "Gửi phản hồi", request_info: "Yêu cầu bổ sung", resolve: "Hoàn tất xử lý" };
const verificationStatus: Record<SystemVerificationItem["status"], string> = {
  passed: "Đạt",
  failed: "Không đạt",
  insufficient: "Chưa đủ dữ liệu",
  error: "Lỗi nguồn",
};

function verificationTone(item: SystemVerificationItem): string {
  if (item.stale) return "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950";
  if (item.status === "passed") return "border-emerald-200 dark:border-emerald-900";
  if (item.status === "failed") return "border-red-200 dark:border-red-900";
  return "border-slate-200 dark:border-slate-800";
}

export function StaffTicketWorkspace({ ticket }: { ticket: Ticket }) {
  const {
    currentUser,
    dataConfig,
    updateOfficerDraft,
    toggleChecklistItem,
    confirmCriterionReview,
    submitGate2Response,
    updateCertificateDraft,
    issueCertificate,
    downloadIssuedDocument,
    reloadData,
    claimTicket,
    prepareBrief,
    refreshTicket,
    runTicketVerification,
    retryCriterionVerification,
  } = useStore();
  const draft = useStaffDraft(`${currentUser!.id}:ticket:${ticket.id}:response`, officerDraftFor(ticket, currentUser!.id));
  const mockBm03 =
    ticket.type === "certificate" &&
    !ticket.requestPayload &&
    /BM-03/i.test(`${ticket.title} ${ticket.certificateType}`) &&
    ticket.issuedCertificate?.templateCode === "BM-03"
      ? ticket.issuedCertificate
      : undefined;
  const certNotes = useStaffDraft(
    `${currentUser!.id}:ticket:${ticket.id}:document-notes`,
    ticket.documentDraft?.notes || mockBm03?.customOfficerNotes || ""
  );
  const purposeDraft = useStaffDraft(
    `${currentUser!.id}:ticket:${ticket.id}:document-purpose`,
    ticket.documentDraft?.purpose || ticket.purpose || ""
  );
  const destinationDraft = useStaffDraft(
    `${currentUser!.id}:ticket:${ticket.id}:document-destination`,
    ticket.documentDraft?.destinationOrg || ticket.destinationOrg || ""
  );
  const [right, setRight] = useState<"response" | "document">("response");
  const [proposal, setProposal] = useState("");
  const [proposalBase, setProposalBase] = useState<{ source: string; text: string } | null>(null);
  const [beforeApply, setBeforeApply] = useState<{ before: string; applied: string } | null>(null);
  const [preview, setPreview] = useState<{ action: Action; content: string; source: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [briefNote, setBriefNote] = useState("");
  const [manualBrief, setManualBrief] = useState(false);
  const [verifyNote, setVerifyNote] = useState<Record<string, string>>({});
  const closed = ticket.status === "resolved";
  const isApi = dataConfig?.mode === "api";
  const assignedToMe = Boolean(currentUser && ticket.assignedOfficerId === currentUser.id);
  const assignedToOther = assignedToOtherOfficer(ticket, currentUser?.id);
  const claimLocked = claimDisabled(ticket);
  const process = ticket.process;
  const canIssue = Boolean(isApi && process?.issuesDocument && process.templateStatus === "approved" && ticket.documentDraft?.status !== "unavailable");
  const issued = ticket.issuedDocument;
  const profile = ticket.studentProfile;

  useEffect(() => {
    if (!isApi) return;
    const timer = window.setInterval(() => {
      if (lock.current) return;
      void refreshTicket(ticket.id);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isApi, ticket.id, refreshTicket]);

  async function execute(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thực hiện được; nội dung đang soạn được giữ lại.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function openAction(action: Action) {
    const reason = isApi && action === "resolve"
      ? (!draft.text.trim() ? "Nhập kết quả xử lý trước khi hoàn tất." : "")
      : actionBlock(ticket, action, draft.text);
    setError(reason);
    if (!reason) setPreview({ action, content: draft.text.trim(), source: ticketSnapshot(ticket) });
  }

  function applyProposal() {
    if (!proposalBase || proposalBase.source !== ticketSnapshot(ticket) || proposalBase.text !== draft.text) {
      setError("Hồ sơ hoặc nháp đã đổi từ lúc tạo gợi ý. Hãy tạo lại gợi ý để giữ nội dung bạn đang sửa.");
      return;
    }
    setBeforeApply({ before: draft.text, applied: proposal });
    draft.change(proposal);
    setRight("response");
    setProposal("");
  }

  function undoProposal() {
    if (!beforeApply) return;
    if (draft.text !== beforeApply.applied) {
      setError("Bạn đã sửa nháp sau khi áp dụng. Nội dung mới được giữ; không tự hoàn tác ghi đè.");
      return;
    }
    draft.change(beforeApply.before);
    setBeforeApply(null);
  }

  async function submit() {
    if (!preview) return;
    await execute(async () => {
      if (!isApi && preview.source !== ticketSnapshot(ticket)) throw new Error("Hồ sơ đã thay đổi. Hãy đóng xác nhận và kiểm tra lại; nháp vẫn được giữ.");
      if (isApi && !assignedToMe) throw new Error("Cần nhận ca trước khi xử lý.");
      const reason = isApi && preview.action === "resolve" ? "" : actionBlock(ticket, preview.action, preview.content);
      if (reason) throw new Error(reason);
      if (isApi) {
        const briefGate = decideReviewedBriefVersion(ticket, { manualBrief });
        if (!briefGate.ok) throw new Error(briefGate.reason);
      }
      await submitGate2Response(ticket.id, preview.action, preview.content, isApi ? (manualBrief ? "manual-brief" : undefined) : preview.source);
      setSuccess(preview.action === "resolve" ? "Đã hoàn tất xử lý hồ sơ. Thao tác này không phát hành tài liệu." : "Đã gửi nội dung tới sinh viên.");
      setPreview(null);
    });
  }

  function printDraft() {
    window.print();
  }

  const submittedAt = ticket.submittedAt || ticket.createdAt;

  return (
    <StaffShell wide>
      <header className="mb-4">
        <QueueBackLink />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-blue-700 dark:text-blue-300">
              {ticket.code} · {process?.label || ticketTypeLabels[ticket.type]}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {displayValue(ticket.studentName)} · {displayValue(ticket.studentMssv)} · {displayValue(ticket.studentEmail)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Nộp {submittedAt ? formatDate(submittedAt, "Asia/Bangkok") : "Chưa có dữ liệu"}
              {" · "}Cán bộ phụ trách: {ticket.assignedOfficerName || ticket.assignedOfficerId || "Chưa nhận ca"}
              {ticket.serverRevision != null ? ` · revision ${ticket.serverRevision}` : ""}
            </p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
      </header>
      {ticket.priority === "high" && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Ưu tiên cao:</strong> {ticket.priorityReason || ticket.l4TriggerReason || "Cần cán bộ xem xét."}
        </p>
      )}
      {isApi && (
        <section className={`${staffSurface} mb-4 p-4`}>
          <h2 className="text-sm font-semibold">Ca xử lý</h2>
          <p className="mt-1 text-xs text-slate-500">
            Quy trình {process?.processVersion || "unknown"} · mẫu {process?.templateStatus === "approved" ? `${process.templateId} ${process.templateVersion}` : "chưa có template được phê duyệt"}
            {process?.validityDays ? ` · thời hạn ${process.validityDays} ngày` : " · không cấu hình thời hạn"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tự tải lại hồ sơ mỗi 15 giây khi trang đang mở.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={staffPrimary}
              disabled={busy || closed || claimLocked}
              onClick={() => void execute(async () => {
                await claimTicket(ticket.id);
                setSuccess("Đã nhận ca. Dùng revision mới trước khi chuẩn bị hồ sơ AI.");
              })}
            >
              Nhận ca
            </button>
            {assignedToOther && <p className="text-xs text-amber-800 dark:text-amber-200">Ca đã thuộc cán bộ khác; không thể nhận lại.</p>}
            <button
              className={staffButton}
              disabled={busy || closed || !assignedToMe}
              onClick={() => void execute(async () => {
                const brief = await prepareBrief(ticket.id);
                setBriefNote(brief.status === "ready" ? brief.summary : `Brief ${brief.status}${brief.errorMessage ? `: ${brief.errorMessage}` : ""}`);
                if (brief.status === "ready" && brief.draftReply && !draft.text) draft.change(brief.draftReply);
                if (brief.status === "ready") setSuccess("Brief đã sẵn sàng. Kiểm tra rồi mới gửi phản hồi hoặc phát hành.");
                else if (brief.status === "failed") setError(brief.errorMessage ? `Brief thất bại: ${brief.errorMessage}` : "Brief thất bại. Có thể xử lý thủ công.");
                else if (brief.status === "stale") setError("Brief đã cũ sau thay đổi hồ sơ. Hãy chuẩn bị lại.");
                else setSuccess(`Brief ${brief.status}.`);
              })}
            >
              {ticket.briefStatus === "failed" || ticket.briefStatus === "stale" ? "Chạy lại AI" : "AI chuẩn bị hồ sơ"}
            </button>
            <button className={staffButton} disabled={busy} onClick={() => void execute(async () => { await refreshTicket(ticket.id); })}>
              Tải lại hồ sơ
            </button>
          </div>
          {ticket.briefLoadError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">Không đọc được brief: {ticket.briefLoadError}</p>}
          {ticket.auditLoadError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">Không đọc được nhật ký: {ticket.auditLoadError}</p>}
          {briefNote && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{briefNote}</p>}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manualBrief} onChange={(event) => setManualBrief(event.target.checked)} />
            Xử lý thủ công (reviewed_brief_version = null)
          </label>
        </section>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-5">
          <section className={`${staffSurface} p-5`}>
            <h2 className="text-base font-semibold">Đơn gốc</h2>
            <p className="mt-1 text-xs text-slate-500">Bản khai của sinh viên tách khỏi dữ liệu hồ sơ đã xác minh trên máy chủ.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-medium">Hồ sơ nguồn (máy chủ)</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  {[
                    ["Họ tên", profile?.fullName || ticket.studentName],
                    ["MSSV", profile?.mssv || ticket.studentMssv],
                    ["Khóa / lớp", profile?.classYear || ticket.studentClassYear],
                    ["Ngành", profile?.major || ticket.studentMajor],
                    ["Khoa", profile?.faculty || ""],
                    ["Nguồn", profile?.source || ""],
                    ["Trạng thái xác minh", profile?.verificationStatus || "Chưa có dữ liệu"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd>{displayValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
              <article className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
                <h3 className="text-sm font-medium">Bản khai trên đơn</h3>
                <p className="mt-1 text-xs text-slate-500">Không coi lời khai là dữ liệu đã xác minh.</p>
                <dl className="mt-3 space-y-3 text-sm">
                  {(ticket.requestPayload?.submittedFields || []).map((field) => (
                    <div key={field.name} className={field.value.length > 80 ? "sm:col-span-2" : ""}>
                      <dt className="text-xs text-slate-500">{field.label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words">{field.value}</dd>
                    </div>
                  ))}
                  {!ticket.requestPayload?.submittedFields.length && (
                    <>
                      {[["Loại yêu cầu", ticket.certificateType], ["Mục đích", ticket.purpose], ["Nơi nhận", ticket.destinationOrg], ["Cách nhận", receiveMethodDisplay(ticket.receiveMethod)]].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="mt-1 whitespace-pre-wrap">{displayValue(value)}</dd>
                        </div>
                      ))}
                    </>
                  )}
                </dl>
              </article>
            </div>
            {ticket.notes && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium">Nội dung bàn giao / ghi chú gốc</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{ticket.notes}</p>
              </div>
            )}
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <h3 className="mb-3 text-sm font-semibold">Tệp đính kèm ({ticket.attachments?.length || 0})</h3>
              {ticket.attachments?.length ? (
                <div className="space-y-2">
                  {ticket.attachments.map((file) => (
                    <AttachmentDownload key={file.id} attachment={file} ownerId={ticket.studentId} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Không có tệp đính kèm được lưu trong hồ sơ.</p>
              )}
            </div>
            {ticket.supplements?.length ? (
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="mb-3 text-sm font-semibold">Yêu cầu bổ sung</h3>
                <ul className="space-y-3 text-sm">
                  {ticket.supplements.map((row) => (
                    <li key={row.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <p className="font-medium">{row.status === "open" ? "Đang chờ sinh viên" : row.status === "fulfilled" ? "Sinh viên đã gửi lại" : row.status}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.reason}</p>
                      {row.items.map((item) => (
                        <p key={item.id || item.label} className="mt-1 text-xs">
                          {item.label} · {item.status === "fulfilled" ? "đã đáp ứng" : "chưa đáp ứng"}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {isApi && (
            <section className={`${staffSurface} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">AI Copilot</h2>
                <button
                  className={staffButton}
                  disabled={busy || closed || !assignedToMe}
                  onClick={() => void execute(async () => {
                    const brief = await prepareBrief(ticket.id);
                    if (brief.status === "failed") setError(brief.errorMessage || "AI không tạo được hồ sơ.");
                  })}
                >
                  <Sparkles className="h-4 w-4" />
                  {ticket.briefStatus === "ready" ? "Chạy lại" : "Tạo hồ sơ AI"}
                </button>
              </div>
              {ticket.officerBrief ? (
                <OfficerFactSheet brief={ticket.officerBrief} />
              ) : (
                <p className="mt-3 text-sm text-slate-500">Chưa có brief. Nhận ca rồi nhấn tạo hồ sơ AI. Không dùng câu mẫu giả AI.</p>
              )}
            </section>
          )}

          <section className={`${staffSurface} p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Đối soát bằng chứng</h2>
              {isApi && (
                <button className={staffButton} disabled={busy || closed || !assignedToMe} onClick={() => void execute(() => runTicketVerification(ticket.id))}>
                  Chạy đối soát
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">Đã xem kết quả khác với đạt điều kiện. Nguồn chưa kết nối không được đánh dấu đạt.</p>
            {!ticket.systemVerifications?.length && <p className="mt-3 text-sm text-slate-500">Chưa chạy đối soát cho hồ sơ này.</p>}
            <div className="mt-4 space-y-3">
              {ticket.systemVerifications?.map((item) => (
                <article key={item.id} className={`rounded-xl border p-4 ${verificationTone(item)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-medium">{item.criterionLabel}</h3>
                    <p className="text-xs">
                      {verificationStatus[item.status]}
                      {item.stale ? " · đã cũ" : ""}
                      {item.connectorStatus === "not_configured" ? " · nguồn chưa kết nối" : ""}
                    </p>
                  </div>
                  <p className="mt-2 text-sm">{item.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Điều kiện: {item.conditionApplied}
                    {item.conditionSource ? ` · ${item.conditionSource}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Nguồn: {item.sourceSystem} · truy xuất {item.lookupTimestamp ? formatDate(item.lookupTimestamp, "Asia/Bangkok") : "Chưa có dữ liệu"}
                    {item.sourceVersion ? ` · phiên bản ${item.sourceVersion}` : ""}
                    {item.sourceHash ? ` · hash ${item.sourceHash}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Cán bộ: {item.officerResolution === "viewed" ? "đã xem, chưa kết luận đạt" : item.officerResolution === "manual_pass" ? "đối chiếu thủ công: đạt" : item.officerResolution === "manual_fail" ? "đối chiếu thủ công: không đạt" : "chưa kiểm tra"}
                    {item.officerReviewedBy ? ` · ${item.officerReviewedBy}` : ""}
                    {item.officerReviewedAt ? ` · ${formatDate(item.officerReviewedAt, "Asia/Bangkok")}` : ""}
                  </p>
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">Xem bằng chứng</summary>
                    <p className="mt-2 whitespace-pre-wrap">{item.dataChecked}</p>
                    {item.evidence && (
                      <pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(item.evidence, null, 2)}</pre>
                    )}
                  </details>
                  {isApi && assignedToMe && !closed && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        className={`${staffField} min-h-16`}
                        placeholder="Ghi chú khi xem hoặc đối chiếu thủ công"
                        value={verifyNote[item.id] || item.officerReviewNote || ""}
                        onChange={(event) => setVerifyNote((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={staffButton}
                          disabled={busy || item.stale}
                          onClick={() => void execute(() => confirmCriterionReview(ticket.id, item.id, verifyNote[item.id], "viewed"))}
                        >
                          Đã xem kết quả
                        </button>
                        <button
                          className={staffButton}
                          disabled={busy || item.stale || !(verifyNote[item.id] || item.officerReviewNote)}
                          onClick={() => void execute(() => confirmCriterionReview(ticket.id, item.id, verifyNote[item.id], "manual_pass"))}
                        >
                          Đối chiếu thủ công: đạt
                        </button>
                        <button
                          className={staffButton}
                          disabled={busy || item.stale}
                          onClick={() => void execute(() => confirmCriterionReview(ticket.id, item.id, verifyNote[item.id], "manual_fail"))}
                        >
                          Không đạt
                        </button>
                        <button className={staffButton} disabled={busy} onClick={() => void execute(() => retryCriterionVerification(ticket.id, item.criterionKey))}>
                          Retry tiêu chí
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className={`${staffSurface} p-5`}>
            <h2 className="text-base font-semibold">Checklist quy trình</h2>
            <p className="mt-1 text-xs text-slate-500">Tiêu chí bắt buộc lấy từ phiên bản quy trình. Checklist AI chỉ là gợi ý.</p>
            {!ticket.checklist.length && <p className="mt-3 text-sm text-slate-500">Chưa có checklist trên máy chủ. Nhận ca để gắn tiêu chí của quy trình.</p>}
            <div className="mt-3 space-y-3">
              {ticket.checklist.map((item) => (
                <label key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={item.checked}
                    disabled={busy || closed || (isApi && !assignedToMe)}
                    onChange={() => { void execute(() => toggleChecklistItem(ticket.id, item.id)); }}
                  />
                  <span>
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {item.required ? "Bắt buộc" : "Gợi ý"} · {item.source === "ai" ? "AI đề xuất" : "Quy trình"}
                      {item.sourceVersion ? ` · ${item.sourceVersion}` : ""}
                      {item.checkedBy ? ` · ${item.checkedBy}` : ""}
                      {item.checkedAt ? ` · ${formatDate(item.checkedAt, "Asia/Bangkok")}` : ""}
                    </span>
                    {item.description ? <span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.description}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className={`${staffSurface} p-5`}>
            <h2 className="font-semibold">Trao đổi ({ticket.messagesTotal ?? ticket.messages.length})</h2>
            <div className="mt-3 space-y-3">
              {ticket.messages.map((message) => (
                <article key={message.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                    <span>{message.senderName}</span>
                    <time>{formatDate(message.timestamp, "Asia/Bangkok")}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={`${staffSurface} p-5`}>
            <h2 className="font-semibold">Nhật ký xử lý</h2>
            <p className="mt-1 text-xs text-slate-500">Nhật ký cơ sở dữ liệu. Không phải blockchain.</p>
            <div className="mt-3 space-y-3">
              {ticket.auditLogs.map((log) => (
                <article key={log.id} className="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
                  <p className="text-sm">{log.action}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {log.actor} · {/^\d{4}-/.test(log.timestamp) ? formatDate(log.timestamp, "Asia/Bangkok") : log.timestamp}
                  </p>
                  {log.details && <p className="mt-1 text-xs">{log.details}</p>}
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className={`${staffSurface} min-w-0 xl:sticky xl:top-20`}>
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-2 dark:border-slate-800">
            <div className="flex gap-1">
              <button className={staffButton} aria-pressed={right === "response"} onClick={() => setRight("response")}>Phản hồi</button>
              <button className={staffButton} aria-pressed={right === "document"} onClick={() => setRight("document")}>
                <FileText className="h-4 w-4" />Tài liệu
              </button>
            </div>
          </div>
          <div className="space-y-4 p-5">
            {right === "response" && (
              <>
                <h2 className="text-base font-semibold">{closed ? "Kết quả xử lý" : "Soạn nội dung gửi sinh viên"}</h2>
                {closed ? (
                  <p className="text-sm leading-relaxed">Hồ sơ đã hoàn tất. Xem kết quả trong trao đổi và nhật ký; không thực hiện lại thao tác đóng hồ sơ.</p>
                ) : (
                  <>
                    <label htmlFor="staff-response" className="block text-xs text-slate-500">Nêu rõ kết quả xử lý hoặc thông tin cần bổ sung.</label>
                    <textarea id="staff-response" className={`${staffField} min-h-64 resize-y leading-relaxed`} value={draft.text} onChange={(e) => draft.change(e.target.value)} disabled={busy} />
                    <div className="flex items-center justify-between gap-2">
                      <p role="status" className="text-xs text-slate-500">{draft.saving ? "Đang lưu…" : draft.dirty ? "Chưa lưu · giữ trong phiên làm việc" : "Nháp đã lưu"}</p>
                      <button className={staffButton} disabled={busy || draft.saving || !draft.dirty} onClick={() => void draft.save((text) => updateOfficerDraft(ticket.id, text))}>Lưu nháp</button>
                    </div>
                    {draft.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{draft.error}</p>}
                    {isApi && ticket.officerBrief?.draftReply && (
                      <div className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                        <h3 className="text-sm font-medium">Nháp AI (không ghi đè nháp đang sửa)</h3>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed">{ticket.officerBrief.draftReply}</p>
                        <button
                          className={staffButton}
                          disabled={busy || closed}
                          onClick={() => {
                            setProposalBase({ source: ticketSnapshot(ticket), text: draft.text });
                            setProposal(ticket.officerBrief?.draftReply || "");
                          }}
                        >
                          So sánh với nháp
                        </button>
                      </div>
                    )}
                    {proposal && (
                      <>
                        <label className="text-xs">
                          Nội dung đề xuất
                          <textarea className={`${staffField} mt-2 min-h-28`} value={proposal} onChange={(e) => setProposal(e.target.value)} />
                        </label>
                        <details className="text-xs">
                          <summary className="cursor-pointer">So sánh với nháp hiện tại</summary>
                          <p className="mt-2 whitespace-pre-wrap">{draft.text || "Nháp đang trống"}</p>
                        </details>
                        <button className={staffButton} disabled={busy || closed} onClick={applyProposal}>Áp dụng vào nháp</button>
                      </>
                    )}
                    {beforeApply !== null && <button className={staffButton} disabled={busy || closed} onClick={undoProposal}>Hoàn tác áp dụng</button>}
                    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <button className={staffPrimary} disabled={busy || draft.saving || (isApi && !assignedToMe)} onClick={() => openAction("respond")}>
                        <Send className="h-4 w-4" />Gửi phản hồi
                      </button>
                      <button className={staffButton} disabled={busy || draft.saving || (isApi && !assignedToMe)} onClick={() => openAction("request_info")}>Yêu cầu bổ sung</button>
                      <button className={staffButton} disabled={busy || draft.saving || (isApi && !assignedToMe)} onClick={() => openAction("resolve")}>
                        <CheckCircle2 className="h-4 w-4" />Hoàn tất xử lý
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">Phản hồi và yêu cầu bổ sung giữ hồ sơ đang xử lý. Hoàn tất không đồng nghĩa phát hành tài liệu.</p>
                  </>
                )}
              </>
            )}
            {right === "document" && (
              <>
                {issued ? (
                  <>
                    <h2 className="font-semibold">Tài liệu đã phát hành</h2>
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      Trạng thái chữ ký: {issued.signatureStatus === "unsigned" ? "chưa ký số" : issued.signatureStatus === "pending_signature" ? "chờ ký" : issued.signatureStatus}.
                      Provider: {issued.signingProvider}. Đây không phải giấy có giá trị chính thức.
                    </p>
                    <p className="text-xs text-slate-500">SHA-256: {issued.sha256}</p>
                    <p className="text-xs text-slate-500">
                      Phát hành bởi {issued.issuedBy}
                      {ticket.documentDraft?.approvedBy ? ` · duyệt ${ticket.documentDraft.approvedBy}` : ""}
                      {ticket.documentDraft?.version ? ` · bản thảo v${ticket.documentDraft.version}` : ""}
                    </p>
                    <button
                      className={staffPrimary}
                      onClick={() => void execute(async () => {
                        if (downloadIssuedDocument) await downloadIssuedDocument(ticket.id, issued.id);
                        else if (ticket.issuedCertificate) downloadCertificateFile(ticket.issuedCertificate);
                      })}
                    >
                      Tải bản đã phát hành
                    </button>
                  </>
                ) : canIssue ? (
                  <>
                    <h2 className="font-semibold">Bản thảo tài liệu</h2>
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      Bản nháp hệ thống, chưa ký số, chưa phải giấy chính thức. Mẫu {ticket.documentDraft?.templateId} {ticket.documentDraft?.templateVersion}.
                    </p>
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">Sinh viên (hồ sơ nguồn)</dt>
                        <dd>{displayValue(ticket.documentDraft?.studentSnapshot?.full_name || ticket.studentName)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">MSSV</dt>
                        <dd>{displayValue(ticket.documentDraft?.studentSnapshot?.mssv || ticket.studentMssv)}</dd>
                      </div>
                    </dl>
                    <label className="block text-sm">
                      Mục đích
                      <textarea className={`${staffField} mt-2 min-h-20`} value={purposeDraft.text} disabled={closed || busy} onChange={(e) => purposeDraft.change(e.target.value)} />
                    </label>
                    <label className="block text-sm">
                      Nơi nhận
                      <input className={`${staffField} mt-2`} value={destinationDraft.text} disabled={closed || busy} onChange={(e) => destinationDraft.change(e.target.value)} />
                    </label>
                    <label className="block text-sm">
                      Ghi chú bản thảo
                      <textarea className={`${staffField} mt-2 min-h-24`} value={certNotes.text} disabled={closed || busy} onChange={(e) => certNotes.change(e.target.value)} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={staffButton}
                        disabled={closed || busy || (isApi && !assignedToMe)}
                        onClick={() => void execute(async () => {
                          await updateCertificateDraft(ticket.id, {
                            purpose: purposeDraft.text,
                            destinationOrg: destinationDraft.text,
                            customOfficerNotes: certNotes.text,
                          });
                          setSuccess("Đã lưu bản thảo trên máy chủ.");
                        })}
                      >
                        Lưu nháp
                      </button>
                      <button className={staffButton} onClick={printDraft}><Printer className="h-4 w-4" />In / xem A4</button>
                      <button
                        className={staffPrimary}
                        disabled={closed || busy || !assignedToMe}
                        onClick={() => void execute(async () => {
                          const result = await issueCertificate(ticket.id);
                          setSuccess(result ? "Đã phát hành bản hệ thống (chưa ký số, không phải giấy chính thức)." : "Không phát hành được.");
                        })}
                      >
                        Phê duyệt và phát hành
                      </button>
                    </div>
                    <article className="print-document rounded-xl border border-slate-200 bg-white p-8 text-sm dark:border-slate-800" style={{ minHeight: "297mm" }}>
                      <p className="text-center text-xs uppercase tracking-wide text-slate-500">Bản thảo · A4 · chưa phát hành</p>
                      <h3 className="mt-4 text-center text-lg font-semibold">{process?.label}</h3>
                      <p className="mt-6">Họ tên: {displayValue(ticket.documentDraft?.studentSnapshot?.full_name || ticket.studentName)}</p>
                      <p>MSSV: {displayValue(ticket.documentDraft?.studentSnapshot?.mssv || ticket.studentMssv)}</p>
                      <p>Mục đích: {purposeDraft.text || "Chưa có dữ liệu"}</p>
                      <p>Nơi nhận: {destinationDraft.text || "Chưa có dữ liệu"}</p>
                      {certNotes.text ? <p className="mt-4">Ghi chú: {certNotes.text}</p> : null}
                      <p className="mt-8 text-xs text-slate-500">Chưa ký số. Không sử dụng như giấy có giá trị chính thức.</p>
                    </article>
                  </>
                ) : mockBm03 && !hasIssuedDocument(ticket) ? (
                  <>
                    <h2 className="font-semibold">Bản thảo tham khảo BM-03</h2>
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Bản mẫu, chưa ký số. Chưa kết nối dịch vụ phát hành; không sử dụng như giấy chính thức.</p>
                    <dl className="space-y-3 text-sm">
                      {[["Sinh viên", mockBm03.studentName], ["Mã SV", mockBm03.studentMssv], ["Mục đích", mockBm03.purpose], ["Nơi nhận", mockBm03.destinationOrg]].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="mt-1">{value || "Chưa có thông tin"}</dd>
                        </div>
                      ))}
                    </dl>
                    <label className="block text-sm">
                      Ghi chú bản thảo
                      <textarea className={`${staffField} mt-2 min-h-28`} value={certNotes.text} disabled={closed || busy} onChange={(e) => certNotes.change(e.target.value)} />
                    </label>
                    <button className={staffButton} disabled={closed || busy || certNotes.saving || !certNotes.dirty} onClick={() => void certNotes.save((text) => updateCertificateDraft(ticket.id, { customOfficerNotes: text }))}>
                      Lưu ghi chú bản thảo
                    </button>
                  </>
                ) : hasIssuedDocument(ticket) && ticket.issuedCertificate ? (
                  <>
                    <h2 className="font-semibold">Tài liệu đã phát hành</h2>
                    <button className={staffPrimary} onClick={() => ticket.issuedCertificate && downloadCertificateFile(ticket.issuedCertificate)}>Tải tài liệu đã phát hành</button>
                  </>
                ) : (
                  <>
                    <h2 className="font-semibold">Tài liệu</h2>
                    <p className="text-sm leading-relaxed text-slate-500">
                      {process?.templateStatus === "unavailable" || !process?.issuesDocument
                        ? "Loại dịch vụ này chưa có mẫu được phê duyệt hoặc không phát hành tài liệu. Cán bộ phản hồi và có thể hoàn tất bằng kết quả xử lý rõ ràng."
                        : "Chưa có bản thảo. Nhận ca để hệ thống tạo nháp từ hồ sơ nguồn."}
                    </p>
                  </>
                )}
              </>
            )}
            {!isApi && (
              <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="text-sm font-medium">Gợi ý theo hồ sơ đang xem</h3>
                <p className="text-xs text-slate-500">Chế độ mẫu: gợi ý cục bộ, chưa gọi CampusAgent.</p>
                <button
                  className={staffButton}
                  disabled={closed || busy}
                  onClick={() => {
                    setProposalBase({ source: ticketSnapshot(ticket), text: draft.text });
                    setProposal(`Chào bạn ${ticket.studentName}, chúng tôi đã tiếp nhận ${ticket.title}. ${ticket.checklist.some((c) => !c.checked) ? "Để tiếp tục xử lý, bạn vui lòng bổ sung: [ghi rõ thông tin/tệp còn thiếu và lý do]." : "Cán bộ đang đối chiếu thông tin và minh chứng; chúng tôi sẽ phản hồi kết quả sau khi kiểm tra."}`);
                  }}
                >
                  Gợi ý phản hồi tiếp nhận
                </button>
              </div>
            )}
            {error && (
              <div role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
                <button className={`${staffButton} mt-2`} onClick={() => void execute(reloadData)}>Tải lại hồ sơ, giữ nháp</button>
              </div>
            )}
            {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}
          </div>
        </section>
      </div>
      {preview && (
        <AccessibleDialog open labelledBy="ticket-action-title" preventClose={busy} className="max-w-2xl" onClose={() => !busy && setPreview(null)}>
          <div className="space-y-4 p-6">
            <h2 id="ticket-action-title" className="text-lg font-semibold">{labels[preview.action]}</h2>
            <p className="text-sm">{ticket.code} · Người nhận: {ticket.studentName} ({ticket.studentEmail})</p>
            <p className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-relaxed dark:bg-slate-800">{preview.content}</p>
            <p className="text-sm text-slate-500">
              {preview.action === "resolve"
                ? "Hồ sơ sẽ hoàn tất và không nhận thêm thao tác. Không phát hành tài liệu trong bước này."
                : "Nội dung này sẽ hiển thị cho sinh viên. Hồ sơ tiếp tục ở trạng thái chờ xử lý."}
            </p>
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className={staffButton} disabled={busy} onClick={() => setPreview(null)}>Quay lại chỉnh sửa</button>
              <button className={staffPrimary} disabled={busy} onClick={() => void submit()}>{busy ? "Đang thực hiện…" : labels[preview.action]}</button>
            </div>
          </div>
        </AccessibleDialog>
      )}
    </StaffShell>
  );
}
