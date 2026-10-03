"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  FileText,
  AlertTriangle,
  RotateCcw,
  Send,
  HelpCircle,
  Lock,
  CheckSquare,
  Square,
  RefreshCw,
  X,
  Eye,
  Printer,
  Download,
  AlertCircle,
  FileCheck,
  Edit3,
  History,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";
import { LoadingState } from "@/components/shared/LoadingState";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { Ticket } from "@/lib/types";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { SystemVerificationItem, IssuedCertificateDocument } from "@/lib/types";
import {
  downloadCertificateFile,
  openCertificatePrintWindow,
  buildDefaultCertificate,
} from "@/lib/certificate-service";
import { useDraftSession, useTicketDraftSession } from "@/lib/draft-context";
import { StaffTicketWorkspace } from "@/components/staff/StaffTicketWorkspace";

function StudentTicketView({ ticket }: { ticket: Ticket }) {
  const statusLabel =
    ticket.status === "open"
      ? "Mới tiếp nhận"
      : ticket.status === "pending_officer"
      ? "Đang được cán bộ xử lý"
      : "Đã hoàn tất";

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <Navbar />
      <main className="w-full max-w-4xl mx-auto flex-1 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <p className="font-mono text-xs text-blue-600 dark:text-blue-400">{ticket.code}</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Theo dõi hồ sơ của bạn
            </h1>
          </div>
          <Link
            href={`/my-requests?ticket=${encodeURIComponent(ticket.id)}`}
            className="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
          >
            Mở trong Yêu cầu của tôi
          </Link>
        </div>

        <section aria-labelledby="student-ticket-title" className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-5">
          <div>
            <h2 id="student-ticket-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {ticket.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span role="status" className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 font-semibold">
                {statusLabel}
              </span>
              <span className="text-slate-500 dark:text-slate-400">Gửi lúc: {ticket.submittedAt}</span>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3">
              <dt className="text-slate-500 dark:text-slate-400">Nơi nhận</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-white">{ticket.destinationOrg}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3">
              <dt className="text-slate-500 dark:text-slate-400">Mục đích</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-white">{ticket.purpose}</dd>
            </div>
          </dl>

          <div className="space-y-3" aria-labelledby="student-ticket-messages">
            <h3 id="student-ticket-messages" className="text-sm font-bold text-slate-900 dark:text-white">Trao đổi gần đây</h3>
            {ticket.messages.slice(-5).map((message) => (
              <article key={message.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2 font-semibold text-slate-700 dark:text-slate-300">
                  <span>{message.senderName}</span>
                  <time className="font-mono text-[11px] text-slate-400">{message.timestamp}</time>
                </div>
                <p className="mt-1.5 whitespace-pre-line leading-relaxed text-slate-600 dark:text-slate-400">{message.content}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function TicketEditor({ ticket }: { ticket: Ticket }) {
  const {
    updateOfficerDraft,
    resetOfficerDraft,
    toggleChecklistItem,
    submitGate2Response,
    runTicketVerification,
    retryCriterionVerification,
    confirmCriterionReview,
    updateCertificateDraft,
    issueCertificate,
  } = useStore();

  const {
    getDraft,
    setDraft,
    clearDraft,
    acquireOperation,
    releaseOperation,
  } = useDraftSession();
  const ticketDraftSession = useTicketDraftSession(ticket.id);
  const existingDraft = ticketDraftSession.draft;
  const pendingOperation = ticketDraftSession.operation;
  const isSavingDraft = pendingOperation?.kind === "save";
  const isSyncing = pendingOperation?.kind === "sync";
  const isSubmittingGate2 = pendingOperation?.kind === "submit";

  const [draftContent, setDraftContent] = useState(() =>
    ticket.officerDraft || ticket.officerDraftDefault || ""
  );

  const [activeRightTab, setActiveRightTab] = useState<"certificate" | "message">("certificate");

  const [certDestinationOrg, setCertDestinationOrg] = useState(
    () => existingDraft?.certDestinationOrg ?? (ticket.issuedCertificate?.destinationOrg || ticket.destinationOrg || "Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức")
  );
  const [certPurpose, setCertPurpose] = useState(
    () => existingDraft?.certPurpose ?? (ticket.issuedCertificate?.purpose || ticket.purpose || "Bổ sung hồ sơ vay vốn Ngân hàng Chính sách Xã hội kỳ 2 năm học 2025 - 2026")
  );
  const [certValidUntil, setCertValidUntil] = useState(
    () => existingDraft?.certValidUntil ?? (ticket.issuedCertificate?.validUntil || "Có giá trị sử dụng trong 30 ngày kể từ ngày cấp")
  );
  const [certNotes, setCertNotes] = useState(
    () => existingDraft?.certNotes ?? (ticket.issuedCertificate?.customOfficerNotes || "Sinh viên chấp hành tốt nội quy trường học và hoàn thành đầy đủ nghĩa vụ học kỳ.")
  );

  const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [modalActionType, setModalActionType] = useState<"respond" | "request_info" | "resolve">("respond");
  const [viewingEvidenceItem, setViewingEvidenceItem] = useState<SystemVerificationItem | null>(null);

  const [syncToast, setSyncToast] = useState(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState(false);
  const [certUpdateError, setCertUpdateError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [gate2Error, setGate2Error] = useState<string | null>(null);
  const hasUnsavedChanges = existingDraft?.hasUnsavedChanges ?? false;
  const draftRevision = existingDraft?.revision ?? 0;

  const isL4 = ticket.isL4 || ticket.code === "TKT-2026-0098";

  // Active certificate representation
  const activeCert: IssuedCertificateDocument = ticket.issuedCertificate || buildDefaultCertificate(ticket, {
    destinationOrg: certDestinationOrg,
    purpose: certPurpose,
    validUntil: certValidUntil,
    customOfficerNotes: certNotes,
  });

  // Pre-check verification items
  const verifications = ticket.systemVerifications || [];
  const hasErrorVerif = verifications.some((v) => v.status === "error");
  const hasInsufficientVerif = verifications.some((v) => v.status === "insufficient");

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraftContent(val);
    updateOfficerDraft(ticket.id, val);
  };

  const handleResetDraft = () => {
    resetOfficerDraft(ticket.id);
    setDraftContent(ticket.officerDraftDefault);
  };

  const handleCertFieldChange = (field: "destinationOrg" | "purpose" | "validUntil" | "customOfficerNotes", val: string) => {
    if (isSavingDraft || isSyncing || isSubmittingGate2) {
      setCertUpdateError("Đang có tiến trình chạy (lưu/đồng bộ/phát hành). Không thể sửa.");
      return;
    }

    let dest = certDestinationOrg, purp = certPurpose, vUntil = certValidUntil, notes = certNotes;

    if (field === "destinationOrg") { setCertDestinationOrg(val); dest = val; }
    if (field === "purpose") { setCertPurpose(val); purp = val; }
    if (field === "validUntil") { setCertValidUntil(val); vUntil = val; }
    if (field === "customOfficerNotes") { setCertNotes(val); notes = val; }

    setCertUpdateError(null);

    const newRev = (getDraft(ticket.id)?.revision ?? draftRevision) + 1;

    setDraft(ticket.id, {
      certDestinationOrg: dest,
      certPurpose: purp,
      certValidUntil: vUntil,
      certNotes: notes,
      hasUnsavedChanges: true,
      revision: newRev,
    });
  };

  const handleSaveDraft = async () => {
    if (isSavingDraft || isSyncing || isSubmittingGate2) {
      setCertUpdateError("Không thể lưu khi đang có tiến trình khác chạy.");
      return;
    }
    if (!hasUnsavedChanges) return;

    const operationToken = acquireOperation(ticket.id, "save");
    if (!operationToken) {
      setCertUpdateError("Không thể lưu khi hồ sơ đang có tiến trình khác chạy.");
      return;
    }

    setCertUpdateError(null);
    const snapRev = getDraft(ticket.id)?.revision ?? draftRevision;

    try {
      await updateCertificateDraft(ticket.id, {
        destinationOrg: certDestinationOrg,
        purpose: certPurpose,
        validUntil: certValidUntil,
        customOfficerNotes: certNotes,
      });

      const latestDraft = getDraft(ticket.id);
      if (latestDraft && latestDraft.revision === snapRev) {
        setDraft(ticket.id, { ...latestDraft, hasUnsavedChanges: false });
      }
    } catch (error) {
      setCertUpdateError(error instanceof Error ? error.message : "Không thể cập nhật biểu mẫu");
    } finally {
      releaseOperation(ticket.id, operationToken);
    }
  };

  const handleAiSync = async () => {
    if (isSyncing || isSavingDraft || isSubmittingGate2) {
      setSyncError("Hệ thống đang xử lý tác vụ khác.");
      return;
    }

    const operationToken = acquireOperation(ticket.id, "sync");
    if (!operationToken) {
      setSyncError("Hệ thống đang xử lý tác vụ khác.");
      return;
    }

    setSyncError(null);
    try {
      await runTicketVerification(ticket.id);
      setSyncToast(true);
      setTimeout(() => setSyncToast(false), 2500);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
    } finally {
      releaseOperation(ticket.id, operationToken);
    }
  };

  const triggerAction = (type: "respond" | "request_info" | "resolve") => {
    if (isSavingDraft || isSyncing || isSubmittingGate2) {
      return;
    }
    setModalActionType(type);
    setShowPreflightModal(true);
  };

  const confirmSubmitGate2 = async () => {
    if (hasUnsavedChanges || isSavingDraft || isSyncing || isSubmittingGate2) {
      setGate2Error("Bạn có thay đổi chưa lưu trên bản thảo, hoặc đang có tiến trình chạy.");
      return;
    }

    const operationToken = acquireOperation(ticket.id, "submit");
    if (!operationToken) {
      setGate2Error("Hồ sơ đang có tiến trình khác chạy. Vui lòng chờ hoàn tất.");
      return;
    }

    setGate2Error(null);
    try {
      if (modalActionType === "resolve" && ticket.type === "certificate") {
        const issued = await issueCertificate(ticket.id);
        if (!issued) throw new Error("Không thể phát hành giấy xác nhận cho hồ sơ này.");
        downloadCertificateFile(issued);
        setDownloadSuccessToast(true);
        setTimeout(() => setDownloadSuccessToast(false), 4000);
      } else {
        await submitGate2Response(ticket.id, modalActionType, draftContent);
      }
      clearDraft(ticket.id);
      setShowPreflightModal(false);
    } catch (error) {
      setGate2Error(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
    } finally {
      releaseOperation(ticket.id, operationToken);
    }
  };

  const handleDirectDownload = () => {
    downloadCertificateFile(activeCert);
    setDownloadSuccessToast(true);
    setTimeout(() => setDownloadSuccessToast(false), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent transition-colors">
      <Navbar />

      {/* Top Bar with Breadcrumb and Switchers */}
      <div className="w-full border-b border-white/50 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Hàng chờ tiếp nhận</span>
            </Link>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                {ticket.code}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  ticket.status === "open"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    : ticket.status === "pending_officer"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {ticket.status === "open"
                  ? "MỚI TIẾP NHẬN"
                  : ticket.status === "pending_officer"
                  ? "CHỜ CÁN BỘ"
                  : "ĐÃ HOÀN TẤT & CẤP GIẤY"}
              </span>

              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {isL4 ? "ƯU TIÊN CAO (L4)" : "TIÊU CHUẨN (L2)"}
              </span>

              {ticket.documentStatus === "issued" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <FileCheck className="w-3 h-3" />
                  <span>Đã tạo file BM-03</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick Case Switchers matching requirements */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-slate-400 mr-1 hidden lg:inline font-mono">Tình huống demo:</span>
            <Link
              href="/tickets/TKT-2026-0142"
              className={`px-2.5 py-1.5 rounded-xl font-semibold transition-all ${
                ticket.code === "TKT-2026-0142"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              title="Hồ sơ đủ dữ liệu và đáp ứng điều kiện"
            >
              1. Ca Chuẩn Đạt (0142)
            </Link>

            <Link
              href="/tickets/TKT-2026-0145"
              className={`px-2.5 py-1.5 rounded-xl font-semibold transition-all ${
                ticket.code === "TKT-2026-0145"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              title="Thiếu hoặc mâu thuẫn dữ liệu, cần xác minh"
            >
              2. Cảnh Báo Nợ HP (0145)
            </Link>

            <Link
              href="/tickets/TKT-2026-0146"
              className={`px-2.5 py-1.5 rounded-xl font-semibold transition-all ${
                ticket.code === "TKT-2026-0146"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              title="Lỗi tra cứu CSDL Đào tạo, có thể thử lại"
            >
              3. Lỗi CSDL 504 / Thử lại (0146)
            </Link>

            <Link
              href="/tickets/TKT-2026-0098"
              className={`px-2.5 py-1.5 rounded-xl font-semibold transition-all ${
                isL4
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              4. Ca L4 Điểm thi (0098)
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col space-y-5">
        {/* L4 Safety Trigger Banner (If L4) */}
        {isL4 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/80 via-red-950/70 to-slate-900 border border-rose-500/40 text-rose-100 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
                <span>Quy tắc L4 Kích hoạt: Ngắt Tự động do Tranh chấp Điểm thi</span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Trigger: DISPUTED_GRADE_EVENT
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
              <p className="text-xs leading-relaxed text-rose-200/90 flex-1">
                {ticket.l4TriggerReason ||
                  "Hệ thống AI đã lập tức dừng đối thoại tự động sau khi phát hiện khiếu nại điểm môn Cấu trúc Dữ liệu. Toàn bộ lược sử tương tác và hồ sơ đối soát được đóng gói niêm phong chuyển sang Cán bộ OF001 kiểm duyệt độc lập."}
              </p>
              <button className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-colors shrink-0 whitespace-nowrap shadow-md">
                Tiếp nhận thụ lý ca L4 này
              </button>
            </div>
          </div>
        )}

        {/* Data Changed / Stale Banner */}
        {ticket.dataChangedSinceLastCheck && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/40 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-md">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sm font-bold block text-slate-900 dark:text-white">
                  Cảnh báo: Dữ liệu kê khai của sinh viên vừa có thay đổi!
                </strong>
                <p className="mt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  Sinh viên vừa cập nhật thông tin mục đích sử dụng hoặc cơ quan tiếp nhận. Bản đối soát tự động và bản thảo giấy cần được làm mới lại. Các ghi chú chỉnh sửa của cán bộ sẽ được giữ nguyên vẹn.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAiSync}
                disabled={isSavingDraft || isSyncing || isSubmittingGate2}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isSyncing ? "Đang đối soát..." : "Chạy lại đối soát tự động"}</span>
              </button>
              {syncError && (
                <div role="alert" className="text-red-600 dark:text-red-400 font-semibold text-xs text-right w-full">
                  {syncError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Student Profile Banner */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-base flex items-center justify-center border border-blue-200 dark:border-blue-800">
              {ticket.studentName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                  {ticket.studentName}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
                  MSSV: {ticket.studentMssv}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  • {ticket.studentClassYear}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 mt-0.5">
                <span>{ticket.studentEmail}</span>
                <span>•</span>
                <span>Tiếp nhận: {ticket.submittedAt}</span>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right sm:border-l sm:border-slate-200 sm:dark:border-slate-800 sm:pl-6 space-y-2">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                MỤC TIÊU YÊU CẦU &amp; BIỂU MẪU
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                {ticket.title}
              </div>
              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                Biểu mẫu: BM-03/CTSV · Tiếp nhận: {ticket.receiveMethod === "digital_pdf" ? "Bản điện tử (PDF)" : "Bản giấy tại văn phòng"}
              </div>
            </div>

            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors">
              <History className="w-3.5 h-3.5" />
              <span>Xem lịch sử yêu cầu (3)</span>
            </button>
          </div>
        </div>

        {/* Sync Toast */}
        {syncToast && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Đã đối soát lại toàn bộ dữ liệu CSDL. Bản thảo giấy xác nhận của cán bộ vẫn được bảo toàn.</span>
          </div>
        )}

        {/* Download Success Toast */}
        {downloadSuccessToast && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                <strong>Đã tạo và tải file Giấy xác nhận thành công!</strong> Tệp <code>{activeCert.fileName}</code> đã được lưu về máy.
              </span>
            </div>
            <span className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
              BM-03 DEMO READY
            </span>
          </div>
        )}

        {/* Two-Column Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): System Automated Verification Pre-check, Facts, Audit */}
          <div className="lg:col-span-7 space-y-5">
            {/* AI Copilot Brief */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between border-b border-white/50 dark:border-white/10 pb-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>AI COPILOT TÓM TẮT &amp; CHUẨN BỊ CA XỬ LÝ</span>
                </div>
                <span
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400"
                  title="Bản mẫu chưa có thước đo tin cậy được hiệu chuẩn."
                >
                  AI tham khảo · Chưa hiệu chuẩn độ tin cậy
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Tóm tắt từ dữ liệu mẫu. Xem nguồn và thời điểm đối soát ở từng điều kiện bên dưới; cán bộ kiểm tra bằng chứng trước khi quyết định.
              </p>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div>
                  <strong className="text-slate-900 dark:text-white">01. Mục tiêu:</strong>{" "}
                  {ticket.aiSummary.target}
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white">02. Bối cảnh:</strong>{" "}
                  {ticket.aiSummary.context}
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white">03. Phân loại &amp; SLA:</strong>{" "}
                  {ticket.aiSummary.categorySla}
                </div>
              </div>

              {/* Next-Best Action */}
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Hành động đề xuất (Next-Best Action)</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {ticket.aiSummary.nextBestAction}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Lý do: {ticket.aiSummary.nextBestActionReason}
                </div>
              </div>
            </div>

            {/* BẢNG KẾT QUẢ ĐỐI SOÁT TỰ ĐỘNG CỦA HỆ THỐNG (System Automated Pre-check) */}
            {!isL4 && (
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <span>KẾT QUẢ ĐỐI SOÁT TỰ ĐỘNG CỦA HỆ THỐNG</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hệ thống tự động tra cứu CSDL Đào tạo &amp; KHTC. Cán bộ kiểm tra kết quả đã chuẩn bị sẵn, không phải tự đi tìm dữ liệu.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                        hasErrorVerif
                          ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                          : hasInsufficientVerif
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                          : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      }`}
                    >
                      {hasErrorVerif ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>LỖI TRA CỨU CSDL</span>
                        </>
                      ) : hasInsufficientVerif ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>CẦN XÁC MINH (1 ĐIỀU KIỆN)</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>HỆ THỐNG: ĐẠT 3/3 ĐIỀU KIỆN</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Pre-check Conditions List */}
                <div className="space-y-3">
                  {verifications.map((item) => {
                    const isPassed = item.status === "passed";
                    const isError = item.status === "error";
                    const isInsufficient = item.status === "insufficient";
                    const isConfirmedByOfficer = item.officerReviewStatus === "confirmed";

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                          isError
                            ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
                            : isInsufficient
                            ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
                            : "bg-white/50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60"
                        }`}
                      >
                        {/* Item Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{item.criterionLabel}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Nguồn: <strong>{item.sourceSystem}</strong> · Thời điểm: {item.lookupTimestamp}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* System Result Badge */}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                isPassed
                                  ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                  : isError
                                  ? "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                  : "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              }`}
                            >
                              {isPassed ? "Đáp ứng" : isError ? "Lỗi kết nối" : "Cần xác minh"}
                            </span>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-[11px] space-y-1.5 leading-relaxed">
                          <div>
                            <span className="text-slate-400 font-medium">Dữ liệu kiểm tra: </span>
                            <span className="text-slate-800 dark:text-slate-200 font-semibold">{item.dataChecked}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium">Điều kiện áp dụng: </span>
                            <span className="text-slate-700 dark:text-slate-300">{item.conditionApplied}</span>
                          </div>
                          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 font-medium">Lý do hệ thống: </span>
                            <span
                              className={`font-medium ${
                                isPassed
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : isError
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {item.reason}
                            </span>
                          </div>
                        </div>

                        {/* Actions Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            {item.evidenceDetails && (
                              <button
                                type="button"
                                onClick={() => setViewingEvidenceItem(item)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-500" />
                                <span>Xem bằng chứng tra cứu</span>
                              </button>
                            )}

                            {isError && (
                              <button
                                type="button"
                                onClick={() => retryCriterionVerification(ticket.id, item.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors shadow-2xs"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Thử lại tra cứu CSDL</span>
                              </button>
                            )}
                          </div>

                          {/* Officer Review State */}
                          <div className="flex items-center gap-2">
                            {isConfirmedByOfficer ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Cán bộ OF001 đã xác nhận</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => confirmCriterionReview(ticket.id, item.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-semibold transition-all shadow-2xs"
                              >
                                <CheckSquare className="w-3 h-3 text-emerald-400" />
                                <span>Xác nhận kết quả này</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Facts & Evidence Section (If L4) */}
            {isL4 && ticket.l4EvidenceVerification && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <span>Khung Đối Soát Bằng Chứng (Facts Verification)</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    TIÊU CHUẨN KIỂM TOÁN: ISO 27001 EDU
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 backdrop-blur-sm flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white text-[11px]">
                        NGUỒN 1: DỮ LIỆU SINH VIÊN TỰ KHAI
                      </div>
                      <p className="italic text-slate-600 dark:text-slate-300 text-[11px]">
                        &ldquo;{ticket.l4EvidenceVerification.source1StudentClaim}&rdquo;
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                      CHƯA KIỂM CHỨNG
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 backdrop-blur-sm flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white text-[11px]">
                        NGUỒN 2: ĐỒNG BỘ CSDL ĐÀO TẠO (DATABASE SYNC)
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 grid grid-cols-2 gap-x-4">
                        <span>Điểm hệ thống: <strong className="text-rose-600 dark:text-rose-400">{ticket.l4EvidenceVerification.source2DbSync.grade}</strong></span>
                        <span>Mã phòng thi: {ticket.l4EvidenceVerification.source2DbSync.room}</span>
                        <span>Giảng viên chấm: {ticket.l4EvidenceVerification.source2DbSync.lecturer}</span>
                        <span>Đồng bộ: {ticket.l4EvidenceVerification.source2DbSync.syncTime}</span>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                      ĐÃ ĐỐI SOÁT CSDL 09:20
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 backdrop-blur-sm flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white text-[11px]">
                        NGUỒN 3: BIÊN BẢN PHÒNG THI &amp; PHIẾU CHẤM PHÚC KHẢO
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        Tập tin scan: <strong className="text-blue-600 dark:text-blue-400 underline cursor-pointer">{ticket.l4EvidenceVerification.source3ExamMinutes.fileName}</strong> ({ticket.l4EvidenceVerification.source3ExamMinutes.scanTime})
                      </div>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Có ghi chữ: &ldquo;{ticket.l4EvidenceVerification.source3ExamMinutes.note}&rdquo;
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                      CẦN DUYỆT HỘI ĐỒNG
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist Thẩm định Nghiệp vụ (với L4) hoặc Thông tin hồ sơ đính kèm */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  <span>Quy định &amp; Checklist Thủ tục Áp dụng</span>
                </div>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {ticket.sopReference}
                </span>
              </div>

              <div className="space-y-2">
                {ticket.checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleChecklistItem(ticket.id, item.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      item.checked
                        ? "bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-950 dark:text-emerald-200"
                        : "bg-white/40 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400">
                      {item.checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-semibold text-xs text-slate-900 dark:text-white">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {item.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Log */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  Nhật ký Trách nhiệm &amp; Audit Log
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  NHẬT KÝ THAO TÁC MẪU
                </span>
              </div>

              <div className="space-y-2.5 text-xs max-h-48 overflow-y-auto">
                {ticket.auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400">{log.timestamp}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">{log.source}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">{log.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Submit 2 Gate - Certificate Draft Preview & Officer Review */}
          <div className="lg:col-span-5 space-y-5 sticky top-20">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
              {/* Header with Switcher Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>BÀN DUYỆT PHÁT HÀNH CÁN BỘ</span>
                </div>
                <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">
                  SUBMIT 2 GATE
                </span>
              </div>

              {/* View Selector Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveRightTab("certificate")}
                  className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeRightTab === "certificate"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>1. Bản Giấy Xác Nhận (BM-03)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab("message")}
                  className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeRightTab === "message"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>2. Tin nhắn phản hồi</span>
                </button>
              </div>

              {/* TAB 1: BẢN GIẤY XÁC NHẬN CHÍNH THỨC DỰ KIẾN PHÁT HÀNH */}
              {activeRightTab === "certificate" && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1.5">
                      <span>Mẫu BM-03 dự kiến cấp cho sinh viên:</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      BẢN MẪU DEMO — CHƯA KÝ SỐ
                    </span>
                  </div>

                  {/* Visual Paper A4 Simulation */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0c1220] border-2 border-slate-200/90 dark:border-slate-700/80 shadow-inner space-y-3.5 text-xs text-slate-800 dark:text-slate-200 relative overflow-hidden">
                    {/* Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-5 dark:opacity-10 rotate-[-25deg]">
                      <div className="text-3xl font-black border-4 border-dashed border-red-500 p-4 rounded-2xl text-red-500 uppercase tracking-widest text-center">
                        BẢN MẪU DEMO<br />CHƯA KÝ SỐ
                      </div>
                    </div>

                    {/* Paper Header */}
                    <div className="text-center space-y-0.5 border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                      </div>
                      <div className="text-[10px] font-bold text-slate-900 dark:text-white">
                        Độc lập - Tự do - Hạnh phúc
                      </div>
                      <div className="w-16 h-0.5 bg-slate-300 dark:bg-slate-700 mx-auto my-1" />
                      <div className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wide mt-1">
                        GIẤY XÁC NHẬN SINH VIÊN
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Số: {activeCert.docNumber} · {activeCert.templateVersion}
                      </div>
                    </div>

                    {/* Immutable Student Details (Locked to source) */}
                    <div className="space-y-1.5 text-[11px] bg-slate-50/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-800">
                        <span>THÔNG TIN ĐÀO TẠO</span>
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono">
                          <Lock className="w-3 h-3" />
                          Khóa cố định theo CSDL
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <div>Họ tên: <strong>{ticket.studentName}</strong></div>
                        <div>MSSV: <strong>{ticket.studentMssv}</strong></div>
                        <div>Ngày sinh: <strong>{activeCert.studentDob}</strong></div>
                        <div>Lớp: <strong>{ticket.studentClassYear}</strong></div>
                        <div className="col-span-2">Ngành: <strong>{ticket.studentMajor}</strong> (Khoa CNPM)</div>
                        <div className="col-span-2 text-emerald-700 dark:text-emerald-300">
                          Tình trạng: <strong>{activeCert.studentAcademicStatus}</strong>
                        </div>
                      </div>
                    </div>

                    {certUpdateError && (
                      <div role="alert" className="p-2.5 rounded-xl bg-red-50 text-red-700 text-[11px] border border-red-200">
                        {certUpdateError}
                      </div>
                    )}

                    {/* Editable Fields by Officer */}
                    <div className="space-y-2.5 text-[11px]">
                      <div>
                        <label htmlFor="certDestinationOrg" className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Edit3 className="w-3 h-3 text-blue-500" />
                          <span>Cơ quan / Đơn vị tiếp nhận văn bản:</span>
                        </label>
                        <input
                          id="certDestinationOrg"
                          type="text"
                          value={certDestinationOrg}
                          onChange={(e) => handleCertFieldChange("destinationOrg", e.target.value)}
                          disabled={isSavingDraft || isSyncing || isSubmittingGate2}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label htmlFor="certPurpose" className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Edit3 className="w-3 h-3 text-blue-500" />
                          <span>Mục đích cấp giấy (Chuẩn hóa câu chữ):</span>
                        </label>
                        <textarea
                          id="certPurpose"
                          rows={2}
                          value={certPurpose}
                          onChange={(e) => handleCertFieldChange("purpose", e.target.value)}
                          disabled={isSavingDraft || isSyncing || isSubmittingGate2}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label htmlFor="certValidUntil" className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                          Thời hạn có giá trị:
                        </label>
                        <input
                          id="certValidUntil"
                          type="text"
                          value={certValidUntil}
                          onChange={(e) => handleCertFieldChange("validUntil", e.target.value)}
                          disabled={isSavingDraft || isSyncing || isSubmittingGate2}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label htmlFor="certNotes" className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                          Ghi chú bổ sung của Cán bộ:
                        </label>
                        <input
                          id="certNotes"
                          type="text"
                          value={certNotes}
                          onChange={(e) => handleCertFieldChange("customOfficerNotes", e.target.value)}
                          disabled={isSavingDraft || isSyncing || isSubmittingGate2}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                        />
                      </div>
                      <div className="flex flex-col items-end pt-2 gap-1.5">
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={!hasUnsavedChanges || isSavingDraft || isSyncing || isSubmittingGate2}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs"
                        >
                          {isSavingDraft ? "Đang lưu..." : "Lưu bản thảo"}
                        </button>
                        {hasUnsavedChanges && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-500 max-w-xs text-right">
                            Bản thảo chưa lưu sẽ bị xóa khi kết thúc phiên đăng nhập hiện tại.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Paper Footer Disclaimer */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Cán bộ thẩm định: <strong>{activeCert.issuedByOfficerName}</strong></span>
                      <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">Chưa ký số CA</span>
                    </div>
                  </div>

                  {/* Fast Action Buttons on Paper */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openCertificatePrintWindow(activeCert)}
                      className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Xem bản in A4 / In</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDirectDownload}
                      className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải bản nháp HTML</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: TIN NHẮN PHẢN HỒI GỬI KÈM CHO SINH VIÊN */}
              {activeRightTab === "message" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                      Dự thảo tin nhắn phản hồi sinh viên:
                    </span>
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Khôi phục mẫu</span>
                    </button>
                  </div>

                  {/* Predefined Templates */}
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <span className="text-[10px] text-slate-500 font-semibold mr-1">Mẫu nhanh:</span>
                    <button
                      onClick={() => setDraftContent("Chào em, hồ sơ của em đã được tiếp nhận và đang trong quá trình xử lý. Phòng Đào tạo sẽ phản hồi kết quả trong vòng 2 ngày làm việc.")}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Đã tiếp nhận
                    </button>
                    <button
                      onClick={() => setDraftContent("Chào em, em vui lòng bổ sung thêm bản chụp CMND/CCCD và Đơn xin xác nhận có chữ ký tay để Phòng Đào tạo có đủ căn cứ giải quyết.")}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Yêu cầu bổ sung
                    </button>
                    <button
                      onClick={() => setDraftContent("Chào em, yêu cầu của em đã được giải quyết. Giấy xác nhận bản điện tử đã được đính kèm vào hồ sơ này. Em có thể tải về để sử dụng.")}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Đã giải quyết
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    value={draftContent}
                    onChange={handleDraftChange}
                    className="w-full p-3 rounded-xl bg-white/60 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans backdrop-blur-sm"
                    placeholder="Nhập nội dung phản hồi chính thức cho sinh viên..."
                  />

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>Tin nhắn phản hồi sẽ được gửi vào Cổng Sinh viên sau khi cán bộ duyệt.</span>
                  </div>
                </div>
              )}

              {/* Action Buttons (Submit 2 Gate Enforcement) */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                {/* Warnings before submission if verifications have problems */}
                {!isL4 && (hasErrorVerif || hasInsufficientVerif) && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      {hasErrorVerif
                        ? "Hệ thống gặp lỗi kết nối CSDL Đào tạo. Hãy bấm 'Thử lại tra cứu' trước khi phê duyệt."
                        : "Hồ sơ có điều kiện tài chính hoặc cơ quan chưa đủ căn cứ. Hãy gửi phản hồi yêu cầu bổ sung thay vì cấp giấy."}
                    </span>
                  </div>
                )}

                {/* 1. Respond (transitions to pending_officer) */}
                <button
                  type="button"
                  onClick={() => triggerAction("respond")}
                  disabled={isSavingDraft || isSyncing || isSubmittingGate2}
                  className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-blue-500" />
                  <span>Gửi tin nhắn phản hồi (Chờ cán bộ)</span>
                </button>

                {/* 2. Request additional info */}
                <button
                  type="button"
                  onClick={() => triggerAction("request_info")}
                  disabled={isSavingDraft || isSyncing || isSubmittingGate2}
                  className="w-full py-2 px-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Yêu cầu sinh viên bổ sung hồ sơ</span>
                </button>

                {/* 3. Resolve & Issue Certificate */}
                <button
                  type="button"
                  onClick={() => triggerAction("resolve")}
                  disabled={isSavingDraft || isSyncing || isSubmittingGate2}
                  className={`w-full py-2.5 px-4 rounded-xl text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 ${
                    ticket.status === "resolved"
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {ticket.type === "certificate"
                      ? "Phê duyệt & Phát hành Giấy xác nhận (BM-03)"
                      : "Hoàn tất xử lý yêu cầu (Resolved)"}
                  </span>
                </button>

                <div className="text-[10px] text-slate-400 text-center italic">
                  * Nhãn văn bản: &ldquo;BẢN MẪU DEMO — CHƯA KÝ SỐ&rdquo;. Tự động lưu và cho phép tải file.
                </div>
              </div>

              {/* Live conversation stream with student */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                    Lịch sử trao đổi với Sinh viên
                  </span>
                  <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                    Cổng 1 Live Sync
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 max-h-36 overflow-y-auto space-y-2 text-xs">
                  {ticket.messages.slice(-3).map((m) => (
                    <div key={m.id} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{m.senderName}</span>
                        <span className="font-mono text-slate-400">{m.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">{m.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Bằng chứng Tra cứu CSDL (Evidence Viewer) */}
      {viewingEvidenceItem && (
        <AccessibleDialog
          open={Boolean(viewingEvidenceItem)}
          onClose={() => setViewingEvidenceItem(null)}
          labelledBy="ticket-evidence-dialog-title"
          className="w-full max-w-xl"
        >
          <div className="max-w-xl w-full p-6 rounded-3xl glass-surface shadow-2xl border border-white/20 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 id="ticket-evidence-dialog-title" className="font-bold text-slate-900 dark:text-white text-sm">
                  Bằng chứng Tra cứu Hệ thống &amp; CSDL
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {viewingEvidenceItem.criterionLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingEvidenceItem(null)}
                aria-label="Đóng bằng chứng tra cứu hệ thống"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">Hệ thống nguồn &amp; Thời điểm:</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewingEvidenceItem.sourceSystem} · {viewingEvidenceItem.lookupTimestamp}
                </div>
                {viewingEvidenceItem.evidenceDetails?.systemUrl && (
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono truncate">
                    Endpoint: {viewingEvidenceItem.evidenceDetails.systemUrl}
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Câu lệnh đối soát / Dữ liệu truy vấn:</span>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {viewingEvidenceItem.evidenceDetails?.rawSnippet || "Không có câu lệnh trích dẫn chi tiết."}
                </pre>
              </div>

              {viewingEvidenceItem.evidenceDetails?.verifiedFields && (
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Các trường đã thẩm định:</span>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 space-y-1">
                    {Object.entries(viewingEvidenceItem.evidenceDetails.verifiedFields).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="text-slate-500">{k}:</span>
                        <strong className="text-slate-800 dark:text-slate-200">{v}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewingEvidenceItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold text-xs text-slate-800 dark:text-slate-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Modal: Xác nhận Cổng Kiểm duyệt 2 (Pre-Flight Check) */}
      {showPreflightModal && (
        <AccessibleDialog
          open={showPreflightModal}
          onClose={() => setShowPreflightModal(false)}
          preventClose={isSubmittingGate2}
          labelledBy="ticket-preflight-dialog-title"
          className="w-full max-w-md"
        >
          <div className="max-w-md w-full p-6 rounded-3xl glass-surface shadow-2xl border border-white/20 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 id="ticket-preflight-dialog-title" className="font-bold text-slate-900 dark:text-white text-sm">
                  Xác nhận Phê duyệt Cổng Kiểm duyệt 2
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreflightModal(false)}
                disabled={isSubmittingGate2}
                aria-label="Đóng xác nhận hành động hồ sơ"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Bạn đang chuẩn bị thực hiện hành động:{" "}
                <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                  {modalActionType === "respond"
                    ? "Gửi tin nhắn phản hồi nghiệp vụ"
                    : modalActionType === "request_info"
                    ? "Yêu cầu sinh viên bổ sung hồ sơ"
                    : "Phê duyệt & Phát hành Giấy xác nhận (BM-03)"}
                </strong>
              </p>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Hồ sơ thụ lý:</span>
                  <strong>{ticket.code} ({ticket.title})</strong>
                </div>
                <div className="flex justify-between">
                  <span>Sinh viên nhận:</span>
                  <strong>{ticket.studentName} ({ticket.studentMssv})</strong>
                </div>
                {modalActionType === "resolve" && (
                  <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
                    <span>Số giấy dự kiến:</span>
                    <span>{activeCert.docNumber}</span>
                  </div>
                )}
              </div>

              {modalActionType === "resolve" && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                  <strong>Lưu ý:</strong> Văn bản sẽ được phát hành với nhãn <em>&ldquo;BẢN MẪU DEMO — CHƯA KÝ SỐ&rdquo;</em>, gắn trực tiếp vào hồ sơ sinh viên tại Cổng Sinh viên và tự động tải về máy.
                </div>
              )}
            </div>

            {gate2Error && (
              <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-xs mt-2 border border-red-200">
                {gate2Error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPreflightModal(false)}
                disabled={isSubmittingGate2}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSubmittingGate2}
                onClick={confirmSubmitGate2}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingGate2 ? "Đang xử lý..." : "Xác nhận thực hiện"}
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params?.ticketId as string;
  const { getTicket, currentUser, isDataLoading } = useStore();

  const ticket = getTicket(ticketId);

  if (isDataLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <Navbar />
        <LoadingState title="Đang tải hồ sơ..." description="Hệ thống đang đồng bộ dữ liệu hồ sơ." />
      </div>
    );
  }

  if (!currentUser) return <DataAccessState />;

  if (!ticket) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17]">
        <Navbar />
        <div className="max-w-4xl mx-auto p-12 text-center text-xs">
          <p className="text-slate-500">Không tìm thấy mã hồ sơ: {ticketId}</p>
          <Link href={currentUser.role === "officer" ? "/dashboard" : "/my-requests"} className="text-blue-600 underline mt-2 inline-block">
            {currentUser.role === "officer" ? "Quay lại Hàng chờ" : "Quay lại Yêu cầu của tôi"}
          </Link>
        </div>
      </div>
    );
  }

  if (currentUser.role !== "officer") {
    if (ticket.studentId !== currentUser.id) {
      return (
        <div className="min-h-screen flex flex-col bg-transparent">
          <Navbar />
          <main className="max-w-2xl mx-auto w-full p-8 text-center">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Bạn không có quyền xem hồ sơ này</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Hãy quay lại danh sách hồ sơ của bạn để tiếp tục.</p>
            <Link href="/my-requests" className="inline-flex mt-5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Quay lại Yêu cầu của tôi</Link>
          </main>
        </div>
      );
    }
    return <StudentTicketView ticket={ticket} />;
  }

  void TicketEditor;
  return <StaffTicketWorkspace key={`${currentUser.id}-${ticket.id}`} ticket={ticket} />;
}
