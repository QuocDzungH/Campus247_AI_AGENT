"use client";

import { useEffect, useRef, useState } from "react";
import { QueueBackLink } from "./QueueBackLink";
import { formatDate } from "@/lib/format-date";
import { Send, CheckCircle2, Sparkles, FileText } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { useStore } from "@/lib/store";
import { actionBlock, officerDraftFor, ticketSnapshot, ticketTypeLabels } from "@/lib/staff-policy";
import { hasIssuedDocument } from "@/lib/my-requests";
import { downloadCertificateFile } from "@/lib/certificate-service";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StaffShell, staffButton, staffField, staffPrimary, staffSurface } from "./StaffShell";
import { useStaffDraft } from "./useStaffDraft";
import { OfficerFactSheet } from "./OfficerFactSheet";
import { OriginalRequestPanel } from "./OriginalRequestPanel";
import { ProcessChecklistPanel, VerificationPanel } from "./VerificationChecklistPanels";
import { TicketAuditTimeline } from "./TicketAuditTimeline";
import { CertificateDocumentView, DisabledReason } from "./CertificateDocumentView";
import { certificateFromTicket } from "@/lib/certificate-document";
import { enumLabel, fieldLabel } from "@/lib/field-labels";
import { assignedToOtherOfficer, claimDisabled, decideReviewedBriefVersion, displayValue } from "@/lib/data/api/g2-flow";

type Action = "respond" | "request_info" | "resolve";
const labels: Record<Action, string> = { respond: "Gửi phản hồi", request_info: "Yêu cầu bổ sung", resolve: "Hoàn tất xử lý" };

function remainingIssueWork(ticket: Ticket, assignedToMe: boolean, closed: boolean): string[] {
  const reasons: string[] = [];
  if (closed) reasons.push("Hồ sơ đã đóng, không phát hành thêm tài liệu.");
  if (!assignedToMe) reasons.push("Nhận xử lý hồ sơ trước khi phát hành.");
  const process = ticket.process;
  if (!process?.issuesDocument) reasons.push("Loại dịch vụ này không phát hành tài liệu.");
  if (process?.templateStatus !== "approved") reasons.push("Chưa có mẫu được phê duyệt.");
  const required = ticket.checklist.filter((item) => item.required && item.source !== "ai" && !item.checked);
  if (required.length) reasons.push(`Còn việc bắt buộc chưa xác nhận: ${required.map((item) => item.label).join(", ")}`);
  for (const key of process?.issueRequiredCriteria || []) {
    const item = ticket.systemVerifications?.find((row) => row.criterionKey === key);
    if (!item) {
      reasons.push(`Chưa chạy kiểm tra: ${fieldLabel(key)}`);
      continue;
    }
    if (item.stale) {
      reasons.push(`${item.criterionLabel} cần kiểm tra lại vì nguồn đã đổi.`);
      continue;
    }
    const ok = item.status === "passed" || item.officerResolution === "manual_pass";
    if (!ok) reasons.push(`${item.criterionLabel}: ${enumLabel(item.status) || item.status}`);
  }
  return reasons;
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
    ensureProcessChecklist,
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
  const isComplaintTicket = ticket.type === "complaint" || ticket.serviceType === "academic_complaint" || ticket.serviceType === "student_support";
  const issuesDocument = !isComplaintTicket && ticket.process?.issuesDocument !== false;
  const [right, setRight] = useState<"response" | "document">(issuesDocument ? "document" : "response");
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
  const [verifying, setVerifying] = useState(false);
  const [originalOpen, setOriginalOpen] = useState(false);
  const [originalFocus, setOriginalFocus] = useState<"declared" | "files" | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const closed = ticket.status === "resolved";
  const isApi = dataConfig?.mode === "api";
  const assignedToMe = Boolean(currentUser && ticket.assignedOfficerId === currentUser.id);
  const assignedToOther = assignedToOtherOfficer(ticket, currentUser?.id);
  const claimLocked = claimDisabled(ticket);
  const process = ticket.process;
  const canIssue = Boolean(isApi && process?.issuesDocument && process.templateStatus === "approved" && ticket.documentDraft?.status !== "unavailable");
  const issued = ticket.issuedDocument;
  const issueReasons = remainingIssueWork(ticket, assignedToMe, closed);
  const issueBlocked = issueReasons.length > 0;
  const claimReason = closed
    ? "Hồ sơ đã đóng, không nhận xử lý thêm."
    : assignedToOther
      ? `Hồ sơ đang do ${ticket.assignedOfficerName || "cán bộ khác"} phụ trách.`
      : assignedToMe
        ? "Bạn đã nhận xử lý hồ sơ này."
        : undefined;
  const prepareReason = closed
    ? "Hồ sơ đã đóng."
    : !assignedToMe
      ? "Nhận xử lý hồ sơ trước khi chạy lại AI."
      : undefined;
  const respondReason = closed
    ? "Hồ sơ đã đóng."
    : isApi && !assignedToMe
      ? "Nhận xử lý hồ sơ trước khi gửi nội dung."
      : undefined;
  const briefGate = decideReviewedBriefVersion(ticket, { manualBrief });

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

  function openOriginal(target: "declared" | "files") {
    setOriginalFocus(target);
    setOriginalOpen(true);
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

  async function handleClaim() {
    await execute(async () => {
      await claimTicket(ticket.id);
      setSuccess("Đã nhận ca. Các việc cần kiểm tra theo quy trình đã được gắn vào hồ sơ.");
    });
  }

  const submittedAt = ticket.submittedAt || ticket.createdAt;
  const draftDoc = certificateFromTicket(ticket, {
    kind: "draft",
    purpose: purposeDraft.text,
    destinationOrg: destinationDraft.text,
    notes: certNotes.text,
  });
  const issuedDoc = issued
    ? certificateFromTicket(ticket, { kind: "issued", issued })
    : null;

  return (
    <StaffShell wide>
      <header className="mb-4 no-print">
        <QueueBackLink />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-blue-700 dark:text-blue-300">
              {ticket.code} · {process?.label || ticketTypeLabels[ticket.type]}
              {ticket.complaintSubtype === "grade_appeal" ? " · Điểm học phần" : ""}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {displayValue(ticket.studentName)} · {displayValue(ticket.studentMssv)} · {displayValue(ticket.studentEmail)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Nộp {submittedAt ? formatDate(submittedAt, "Asia/Bangkok") : "Chưa có dữ liệu"}
              {" · "}Cán bộ phụ trách: {ticket.assignedOfficerName || (ticket.assignedOfficerId ? "Cán bộ" : "Chưa nhận xử lý")}
              {" · "}Trạng thái tiếp nhận: {enumLabel(ticket.status) || ticket.status}
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
        <section className={`${staffSurface} mb-4 p-4 no-print`}>
          <h2 className="text-sm font-semibold">Tiếp nhận hồ sơ</h2>
          <p className="mt-1 text-xs text-slate-500">
            Quy trình {process?.processVersion || "chưa có phiên bản"} · mẫu {process?.templateStatus === "approved" ? `${process.templateId} ${process.templateVersion}` : "chưa có template được phê duyệt"}
            {process?.validityDays ? ` · thời hạn ${process.validityDays} ngày` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">Trang chỉ đọc dữ liệu đã lưu. Không tự nhận ca, gửi tin, phát hành hay chạy lại AI.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <DisabledReason disabled={busy || closed || claimLocked} reason={claimReason}>
              <button className={staffPrimary} disabled={busy || closed || claimLocked} onClick={() => void handleClaim()}>
                Nhận ca
              </button>
            </DisabledReason>
            {assignedToOther && (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Hồ sơ đang do {ticket.assignedOfficerName || "cán bộ khác"} phụ trách; chế độ chỉ xem.
              </p>
            )}
            <DisabledReason disabled={busy || closed || !assignedToMe} reason={prepareReason}>
              <button
                className={staffButton}
                disabled={busy || closed || !assignedToMe}
                onClick={() => void execute(async () => {
                  const brief = await prepareBrief(ticket.id);
                  setBriefNote(brief.status === "ready" ? brief.summary : `AI ${brief.status}${brief.errorMessage ? `: ${brief.errorMessage}` : ""}`);
                  if (brief.status === "ready" && brief.draftReply && !draft.text) draft.change(brief.draftReply);
                  if (brief.status === "ready") setSuccess("Bản tóm tắt hồ sơ đã sẵn sàng. Kiểm tra rồi mới gửi phản hồi hoặc phát hành.");
                  else if (brief.status === "failed") setError(brief.errorMessage ? `AI chưa tạo được bản tóm tắt: ${brief.errorMessage}` : "AI chưa tạo được bản tóm tắt. Có thể xử lý thủ công.");
                  else if (brief.status === "stale") setError("Bản tóm tắt đã cũ vì hồ sơ vừa thay đổi. Hãy chạy lại AI.");
                  else setSuccess("AI đang đọc hồ sơ.");
                })}
              >
                {ticket.briefStatus === "failed" || ticket.briefStatus === "stale" ? "Chạy lại AI" : "AI chuẩn bị hồ sơ"}
              </button>
            </DisabledReason>
            <button className={staffButton} disabled={busy} onClick={() => void execute(async () => { await refreshTicket(ticket.id); })}>
              Tải lại hồ sơ
            </button>
          </div>
          {ticket.briefLoadError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">Không đọc được bản tóm tắt: {ticket.briefLoadError}</p>}
          {ticket.auditLoadError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">Không đọc được nhật ký: {ticket.auditLoadError}</p>}
          {briefNote && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{briefNote}</p>}
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={manualBrief} onChange={(event) => setManualBrief(event.target.checked)} />
            <span>
              Xử lý thủ công (không gắn bản tóm tắt AI). Dùng khi bản tóm tắt chưa sẵn sàng, đã cũ, hoặc bạn chủ động không gắn AI.
            </span>
          </label>
        </section>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-5">
          {isApi && (
            <section className={`${staffSurface} p-5`} data-testid="officer-ai-panel">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">AI hỗ trợ xử lý hồ sơ</h2>
                  <p className="mt-1 text-xs text-slate-500">Bản tóm tắt đã có được hiển thị ngay, không cần nhận ca mới để đọc.</p>
                </div>
                <DisabledReason disabled={busy || closed || !assignedToMe} reason={prepareReason}>
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
                </DisabledReason>
              </div>
              {ticket.officerBrief ? (
                <OfficerFactSheet brief={ticket.officerBrief} onOpenRequest={openOriginal} />
              ) : ticket.briefStatus === "pending" || ticket.briefStatus === "processing" ? (
                <p className="mt-3 text-sm text-slate-500">AI đang đọc đơn, hồ sơ nguồn và tài liệu được phép. Trang này không tự chạy lại AI.</p>
              ) : ticket.briefStatus === "failed" ? (
                <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">AI chưa tạo được bản tóm tắt. Có thể xử lý thủ công hoặc chạy lại khi đã nhận hồ sơ.</p>
              ) : ticket.briefStatus === "stale" ? (
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">Bản tóm tắt đã cũ vì hồ sơ vừa thay đổi. Hãy chạy lại AI sau khi nhận xử lý.</p>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Chưa có bản tóm tắt. Nhận xử lý rồi nhấn tạo hồ sơ AI. Không dùng câu mẫu giả AI.</p>
              )}
            </section>
          )}

          <VerificationPanel
            ticket={ticket}
            assignedToMe={assignedToMe}
            assignedToOther={assignedToOther}
            closed={closed}
            busy={busy}
            verifying={verifying}
            isApi={Boolean(isApi)}
            onClaim={() => void handleClaim()}
            onRun={() => void execute(async () => {
              setVerifying(true);
              try {
                await runTicketVerification(ticket.id);
              } finally {
                setVerifying(false);
              }
            })}
            onConfirm={(id, outcome, note) => void execute(() => confirmCriterionReview(ticket.id, id, note, outcome))}
            onRetry={(key) => void execute(() => retryCriterionVerification(ticket.id, key))}
          />

          <ProcessChecklistPanel
            ticket={ticket}
            assignedToMe={assignedToMe}
            assignedToOther={assignedToOther}
            closed={closed}
            busy={busy}
            isApi={Boolean(isApi)}
            onClaim={() => void handleClaim()}
            onToggle={(id) => { void execute(() => toggleChecklistItem(ticket.id, id)); }}
            onEnsure={() => void execute(async () => {
              await ensureProcessChecklist(ticket.id);
              setSuccess("Đã bổ sung các việc cần kiểm tra theo quy trình.");
            })}
          />

          <OriginalRequestPanel
            ticket={ticket}
            open={originalOpen}
            onOpenChange={(next) => {
              setOriginalOpen(next);
              if (!next) setOriginalFocus(null);
            }}
            focusTarget={originalFocus}
          />

          <TicketAuditTimeline logs={ticket.auditLogs} loadError={ticket.auditLoadError} />
        </div>

        <section className={`${staffSurface} min-w-0`}>
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-2 dark:border-slate-800 no-print">
            <p className="px-2 text-sm font-semibold">{issuesDocument ? "Bản duyệt phát hành" : "Trao đổi xử lý"}</p>
            <div className="flex gap-1">
              {issuesDocument && (
                <button className={staffButton} aria-pressed={right === "document"} onClick={() => setRight("document")}>
                  <FileText className="h-4 w-4" />Bản giấy xác nhận
                </button>
              )}
              <button className={staffButton} aria-pressed={right === "response"} onClick={() => setRight("response")}>Tin nhắn phản hồi</button>
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
                    <textarea id="staff-response" className={`${staffField} min-h-36 resize-y leading-relaxed`} value={draft.text} onChange={(e) => draft.change(e.target.value)} disabled={busy} />
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
                      <DisabledReason disabled={busy || draft.saving || (isApi && !assignedToMe)} reason={respondReason}>
                        <button className={staffPrimary} disabled={busy || draft.saving || (isApi && !assignedToMe)} onClick={() => openAction("respond")}>
                          <Send className="h-4 w-4" />Gửi phản hồi
                        </button>
                      </DisabledReason>
                      <DisabledReason disabled={busy || draft.saving || (isApi && !assignedToMe)} reason={respondReason}>
                        <button className={staffButton} disabled={busy || draft.saving || (isApi && !assignedToMe)} onClick={() => openAction("request_info")}>Yêu cầu bổ sung</button>
                      </DisabledReason>
                      <DisabledReason disabled={busy || draft.saving || (isApi && !assignedToMe)} reason={respondReason}>
                        <button className={staffButton} disabled={busy || draft.saving || (isApi && !assignedToMe)} onClick={() => openAction("resolve")}>
                          <CheckCircle2 className="h-4 w-4" />Hoàn tất xử lý
                        </button>
                      </DisabledReason>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">Phản hồi và yêu cầu bổ sung giữ hồ sơ đang xử lý. Hoàn tất không đồng nghĩa phát hành tài liệu.</p>
                  </>
                )}
              </>
            )}
            {right === "document" && (
              <>
                {issued && issuedDoc ? (
                  <>
                    <h2 className="font-semibold">Tài liệu đã tạo</h2>
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      {issued.signatureStatus === "unsigned"
                        ? "Bản hệ thống đã tạo, chưa ký số, chưa phải giấy có giá trị chính thức."
                        : issued.signatureStatus === "pending_signature"
                          ? "Bản hệ thống đã tạo, đang chờ ký số."
                          : `Trạng thái chữ ký: ${enumLabel(issued.signatureStatus) || issued.signatureStatus}.`}
                    </p>
                    <CertificateDocumentView
                      doc={issuedDoc}
                      actions={
                        <button
                          className={staffPrimary}
                          onClick={() => void execute(async () => {
                            if (downloadIssuedDocument) await downloadIssuedDocument(ticket.id, issued.id);
                            else if (ticket.issuedCertificate) downloadCertificateFile(ticket.issuedCertificate);
                          })}
                        >
                          Tải bản đã tạo
                        </button>
                      }
                    />
                    <details className="text-xs">
                      <summary className="cursor-pointer">Chi tiết kỹ thuật</summary>
                      <p className="mt-2 text-slate-500">SHA-256: {issued.sha256}</p>
                      <p className="mt-1 text-slate-500">
                        Phát hành bởi {issued.issuedByName || "Cán bộ"}
                        {ticket.documentDraft?.version ? ` · bản thảo v${ticket.documentDraft.version}` : ""}
                      </p>
                    </details>
                  </>
                ) : canIssue ? (
                  <>
                    <h2 className="font-semibold">Giấy xác nhận sinh viên</h2>
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      Bản nháp hệ thống, chưa ký số, chưa phải giấy chính thức.
                    </p>
                    <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-800" open={editOpen} onToggle={(event) => setEditOpen((event.currentTarget as HTMLDetailsElement).open)}>
                      <summary className="cursor-pointer text-sm font-medium">Chỉnh sửa nội dung</summary>
                      <div className="mt-3 space-y-3">
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
                        <DisabledReason disabled={closed || busy || (isApi && !assignedToMe)} reason={respondReason}>
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
                        </DisabledReason>
                      </div>
                    </details>
                    <CertificateDocumentView doc={draftDoc} />
                    <DisabledReason disabled={closed || busy || !assignedToMe || issueBlocked} reason={issueReasons[0]}>
                      <button
                        className={staffPrimary}
                        disabled={closed || busy || !assignedToMe || issueBlocked}
                        onClick={() => void execute(async () => {
                          const result = await issueCertificate(ticket.id);
                          setSuccess(result ? "Đã tạo bản hệ thống (chưa ký số, không phải giấy chính thức)." : "Không phát hành được.");
                        })}
                      >
                        Phê duyệt và phát hành
                      </button>
                    </DisabledReason>
                    {issueReasons.length > 1 && (
                      <ul className="list-disc pl-5 text-xs text-slate-500">
                        {issueReasons.slice(1).map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    )}
                  </>
                ) : mockBm03 && !hasIssuedDocument(ticket) ? (
                  <>
                    <h2 className="font-semibold">Bản thảo tham khảo BM-03</h2>
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Bản mẫu, chưa ký số. Chưa kết nối dịch vụ phát hành; không sử dụng như giấy chính thức.</p>
                    <CertificateDocumentView
                      doc={certificateFromTicket(ticket, {
                        kind: "draft",
                        purpose: mockBm03.purpose,
                        destinationOrg: mockBm03.destinationOrg,
                        notes: certNotes.text,
                      })}
                    />
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
            <section className="border-t border-slate-200 pt-4 dark:border-slate-800" data-testid="officer-message-thread">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Lịch sử trao đổi với sinh viên</h2>
                <p className="text-xs text-slate-500">{ticket.messagesTotal ?? ticket.messages.length} tin</p>
              </div>
              <div className="mt-3 max-h-72 overflow-y-auto overscroll-contain pr-1" role="log" aria-label="Lịch sử trao đổi với sinh viên">
                {ticket.messages.length ? (
                  <div className="space-y-3">
                    {ticket.messages.map((message) => (
                      <article key={message.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{message.senderName}</span>
                          <time>{formatDate(message.timestamp, "Asia/Bangkok")}</time>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Chưa có trao đổi trên hồ sơ này.</p>
                )}
              </div>
            </section>
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
            {isApi ? (
              <div className="space-y-3">
                {briefGate.ok ? (
                  <p className="text-sm text-slate-500">
                    {manualBrief
                      ? "Thao tác này không gắn bản tóm tắt AI (xử lý thủ công)."
                      : "Thao tác này gắn bản tóm tắt hồ sơ hiện hành."}
                  </p>
                ) : (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    {briefGate.reason}
                  </p>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={manualBrief}
                    onChange={(event) => setManualBrief(event.target.checked)}
                  />
                  <span>Không gắn bản tóm tắt AI (xử lý thủ công)</span>
                </label>
              </div>
            ) : null}
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className={staffButton} disabled={busy} onClick={() => setPreview(null)}>Quay lại chỉnh sửa</button>
              <DisabledReason
                disabled={busy || (isApi && !briefGate.ok)}
                reason={isApi && !briefGate.ok ? "Chọn xử lý thủ công ở trên hoặc chạy lại AI trước." : undefined}
              >
                <button className={staffPrimary} disabled={busy || (isApi && !briefGate.ok)} onClick={() => void submit()}>{busy ? "Đang thực hiện…" : labels[preview.action]}</button>
              </DisabledReason>
            </div>
          </div>
        </AccessibleDialog>
      )}
    </StaffShell>
  );
}
