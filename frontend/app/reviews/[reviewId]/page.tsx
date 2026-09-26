"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  ChevronRight,
  ExternalLink,
  Edit3,
  Send,
  Printer,
  Download,
  Share2,
  RefreshCw,
  Building,
  GraduationCap,
  FileCheck,
  History,
  Shield,
  X,
  FileQuestion,
  Eye,
  Bookmark,
  Check,
  Upload,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";
import {
  ReviewCase,
  ReviewFinding,
  FindingAiLabel,
  FindingOfficerStatus,
  EvidenceCitation,
  DocumentLegibility,
  SupplementRequest,
} from "@/lib/types";
import { draftSupplementRequest, generateReviewReport, AI_PROGRESS_STEPS } from "@/lib/review-service";

interface PageProps {
  params: Promise<{ reviewId: string }>;
}

export default function ReviewWorkstationPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const reviewId = resolvedParams.reviewId;

  const {
    getReviewCase,
    runAiReview,
    updateFindingReview,
    sendSupplementRequest,
    submitStudentSupplement,
    finalizeReviewCase,
    currentUser,
    login,
    isAiAnalyzing,
    aiAnalyzingStep,
  } = useStore();

  const caseItem = getReviewCase(reviewId);

  // Switch to officer OF001 if needed
  useEffect(() => {
    if (currentUser.role !== "officer") {
      login("OF001");
    }
  }, [currentUser.role, login]);

  // Center Tab State
  const [activeCenterTab, setActiveCenterTab] = useState<
    "overview" | "comparison" | "issues" | "report" | "history"
  >("comparison");

  // Right Pane Active State
  const [activeRightTab, setActiveRightTab] = useState<"document" | "supplement_draft" | "report_draft">("document");
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [selectedDocVersion, setSelectedDocVersion] = useState<number>(1);
  const [activeCitation, setActiveCitation] = useState<EvidenceCitation | null>(null);

  // Modals
  const [editingFinding, setEditingFinding] = useState<ReviewFinding | null>(null);
  const [editFindingLabel, setEditFindingLabel] = useState<FindingAiLabel>("has_evidence");
  const [editFindingReason, setEditFindingReason] = useState("");

  const [isSupplementModalOpen, setIsSupplementModalOpen] = useState(false);
  const [supplementDraft, setSupplementDraft] = useState<SupplementRequest | null>(null);

  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalizeRecommendation, setFinalizeRecommendation] = useState<
    "propose_recognition" | "propose_conditional" | "propose_rejection"
  >("propose_recognition");
  const [finalizeSummary, setFinalizeSummary] = useState("");
  const [finalizeConfirmed, setFinalizeConfirmed] = useState(false);

  // Sync default selected document
  useEffect(() => {
    if (caseItem && caseItem.documents.length > 0) {
      if (!selectedDocId) {
        const oldSyl = caseItem.documents.find((d) => d.type === "syllabus_old") || caseItem.documents[0];
        setSelectedDocId(oldSyl.id);
        setSelectedDocVersion(oldSyl.currentVersion);
      }
    }
  }, [caseItem, selectedDocId]);

  if (!caseItem) {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <Navbar />
        <div className="max-w-4xl mx-auto p-12 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold">Không tìm thấy hồ sơ rà soát</h2>
          <p className="text-xs text-slate-500">Mã hồ sơ: {reviewId} không tồn tại hoặc đã được làm mới.</p>
          <Link
            href="/reviews"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại danh sách</span>
          </Link>
        </div>
      </div>
    );
  }

  const selectedDocument = caseItem.documents.find((d) => d.id === selectedDocId) || caseItem.documents[0];
  const currentDocVersionObj =
    selectedDocument?.versions.find((v) => v.version === selectedDocVersion) ||
    selectedDocument?.versions[selectedDocument.versions.length - 1];

  // Citation click handler
  const handleOpenCitation = (cit: EvidenceCitation) => {
    setActiveCitation(cit);
    setSelectedDocId(cit.documentId);
    setSelectedDocVersion(cit.version);
    setActiveRightTab("document");
  };

  // Open modal to edit finding
  const handleOpenEditFinding = (finding: ReviewFinding) => {
    setEditingFinding(finding);
    setEditFindingLabel(finding.officerAdjustedLabel || finding.aiLabel);
    setEditFindingReason(finding.officerNote || "");
  };

  const handleSaveEditFinding = () => {
    if (!editingFinding) return;
    updateFindingReview(caseItem.id, editingFinding.id, {
      officerStatus: "edited",
      officerAdjustedLabel: editFindingLabel,
      officerNote: editFindingReason.trim() || "Cán bộ đã thẩm định lại và điều chỉnh nhận định dựa trên hồ sơ.",
    });
    setEditingFinding(null);
  };

  // Quick confirm finding
  const handleQuickConfirmFinding = (finding: ReviewFinding) => {
    updateFindingReview(caseItem.id, finding.id, {
      officerStatus: "confirmed",
      officerNote: "Cán bộ đồng thuận với nhận định và bằng chứng do AI trích xuất.",
    });
  };

  // Open Supplement Request Drawer/Modal
  const handleOpenSupplementModal = () => {
    const issueFindingIds = caseItem.findings
      .filter((f) => f.aiLabel === "insufficient_evidence" || f.aiLabel === "contradiction" || f.aiLabel === "has_difference")
      .map((f) => f.id);

    const draft = draftSupplementRequest(caseItem, issueFindingIds.length > 0 ? issueFindingIds : [caseItem.findings[0]?.id]);
    setSupplementDraft(draft);
    setIsSupplementModalOpen(true);
  };

  const handleSendSupplementRequest = () => {
    if (!supplementDraft) return;
    sendSupplementRequest(caseItem.id, supplementDraft);
    setIsSupplementModalOpen(false);
  };

  // Open Finalize Modal
  const handleOpenFinalizeModal = () => {
    const hasUnresolvedIssues = caseItem.findings.some(
      (f) => f.aiLabel === "contradiction" || (f.aiLabel === "insufficient_evidence" && f.officerStatus === "unverified")
    );
    setFinalizeRecommendation(hasUnresolvedIssues ? "propose_conditional" : "propose_recognition");
    setFinalizeSummary(
      hasUnresolvedIssues
        ? "Đề xuất công nhận có điều kiện: Yêu cầu sinh viên thi sát hạch chuẩn đầu ra môn học hoặc nộp bổ sung chứng từ xác minh trước đợt xét tốt nghiệp."
        : "Đề nghị công nhận học phần: Toàn bộ tiêu chí cốt lõi (tín chỉ, đề cương, chuẩn đầu ra) đã được cán bộ đối soát đạt yêu cầu theo quy chế."
    );
    setFinalizeConfirmed(false);
    setIsFinalizeModalOpen(true);
  };

  const handleExecuteFinalize = () => {
    if (!finalizeConfirmed) return;
    const report = generateReviewReport(caseItem, currentUser, finalizeRecommendation, finalizeSummary);
    finalizeReviewCase(caseItem.id, report);
    setIsFinalizeModalOpen(false);
  };

  // Quick Demo Action: Simulate student submitting syllabus v2
  const handleDemoStudentUploadV2 = () => {
    submitStudentSupplement(caseItem.id, {
      note: "Em đã xin được Đề cương chi tiết có đóng dấu mộc đỏ và chữ ký của Phó Trưởng Khoa CNTT - ĐH Bách Khoa, có bổ sung đầy đủ Chương 5 về Đồ thị và thuật toán duyệt BFS/DFS, Dijkstra.",
      fileName: "De_cuong_IT2020_Co_xac_nhan_Khoa_CNTT_v2.pdf",
      versionToActivate: 2,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent transition-colors">
      <Navbar />

      {/* Top Breadcrumb & Dossier Meta Bar */}
      <div className="w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/reviews"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors shadow-xs"
              title="Quay lại danh sách hồ sơ"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {caseItem.code}
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="font-semibold text-slate-900 dark:text-white text-xs">
                  {caseItem.studentName} ({caseItem.studentMssv})
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {caseItem.studentMajor}
                </span>

                {caseItem.status === "in_review" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Đang rà soát
                  </span>
                )}
                {caseItem.status === "waiting_supplement" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Chờ sinh viên bổ sung
                  </span>
                )}
                {caseItem.status === "completed" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Đã hoàn tất rà soát
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Building className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="font-medium">{caseItem.priorCourseName} ({caseItem.priorCourseCode})</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {caseItem.targetCourseCode} - {caseItem.targetCourseName}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons on Top Bar */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            {caseItem.aiSummary.isStale && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-semibold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Có tài liệu mới chưa cập nhật</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => runAiReview(caseItem.id)}
              disabled={isAiAnalyzing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAiAnalyzing ? "animate-spin" : ""}`} />
              <span>{isAiAnalyzing ? "Đang chạy AI..." : "Chạy lại AI rà soát"}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenSupplementModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-amber-500" />
              <span>Soạn yêu cầu bổ sung</span>
            </button>

            <button
              type="button"
              onClick={handleOpenFinalizeModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hoàn tất rà soát</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Analyzing Progress Overlay Banner */}
      {isAiAnalyzing && (
        <div className="w-full bg-indigo-600 text-white px-4 py-2 text-xs flex items-center justify-center gap-3 animate-in fade-in shadow-md">
          <Sparkles className="w-4 h-4 animate-spin shrink-0" />
          <span className="font-semibold">
            AI đang phân tích đối chiếu hồ sơ: Bước {aiAnalyzingStep}/4 —{" "}
            {AI_PROGRESS_STEPS[aiAnalyzingStep - 1]?.label} ({AI_PROGRESS_STEPS[aiAnalyzingStep - 1]?.description})
          </span>
        </div>
      )}

      {/* 3-PANE WORKSPACE DESK */}
      <div className="max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col xl:flex-row gap-6">
        {/* ========================================================
            VÙNG 1: TRÁI (LEFT PANE) — TÀI LIỆU, PHIÊN BẢN & CHẤT LƯỢNG
            ======================================================== */}
        <aside className="w-full xl:w-[320px] flex flex-col gap-5 shrink-0">
          {/* Box 1: Hồ sơ đính kèm & Phiên bản */}
          <div className="p-4 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>Tài liệu đính kèm ({caseItem.documents.length})</span>
              </span>
              <span className="text-[10px] font-mono text-indigo-600 font-semibold">
                Minh chứng
              </span>
            </div>

            <div className="space-y-2">
              {caseItem.documents.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const latestVersion = doc.versions.find((v) => v.version === doc.currentVersion);
                const hasMultipleVersions = doc.versions.length > 1;

                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setSelectedDocVersion(doc.currentVersion);
                      setActiveRightTab("document");
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-500 shadow-sm ring-1 ring-indigo-500"
                        : "bg-white/60 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs text-slate-900 dark:text-white leading-tight">
                        {doc.title}
                      </div>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 shrink-0">
                        v{doc.currentVersion}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1 truncate">
                      {doc.institution}
                    </div>

                    {/* Quality badge */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                      {latestVersion?.legibility === "good" ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Đọc tốt 100%</span>
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Mờ một phần (Trang 2-3)</span>
                        </span>
                      )}

                      {hasMultipleVersions && (
                        <span className="font-mono text-[9px] text-indigo-600 font-bold">
                          {doc.versions.length} phiên bản
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Box 2: Tình trạng đọc & Kiểm tra OCR */}
          <div className="p-4 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              <span>Chất lượng Nhận dạng &amp; Đọc hiểu</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Tài liệu đang xem:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                  {selectedDocument?.title}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Phiên bản:</span>
                <div className="flex items-center gap-1">
                  {selectedDocument?.versions.map((v) => (
                    <button
                      key={v.version}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDocVersion(v.version);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        selectedDocVersion === v.version
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      v{v.version}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Tình trạng scan:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {currentDocVersionObj?.legibility === "good" ? "Bản rõ nét" : "Mờ scan nét đứt"}
                </span>
              </div>
              {currentDocVersionObj?.legibilityNote && (
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-200">
                  {currentDocVersionObj.legibilityNote}
                </div>
              )}
            </div>

            {/* Quick Demo Button for Testing: Upload v2 for Dossier A */}
            {caseItem.code === "REV-2026-001" && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleDemoStudentUploadV2}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  <span>Mô phỏng: SV nộp Đề cương v2</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1">
                  (Bổ sung Chương Đồ thị để test đổi nhận định)
                </p>
              </div>
            )}
          </div>

          {/* Box 3: Thông tin Cán bộ phụ trách */}
          <div className="p-4 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>Cán bộ Thẩm định</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                CB
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {currentUser.name} ({currentUser.id})
                </div>
                <div className="text-[10px] text-slate-400">Phòng Đào tạo &amp; CTSV</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ========================================================
            VÙNG 2: GIỮA (CENTER PANE) — VÙNG RỘNG NHẤT: KẾT QUẢ ĐỐI CHIẾU
            ======================================================== */}
        <main className="flex-1 flex flex-col space-y-4 min-w-0">
          {/* Navigation Tabs for Center Workspace */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-surface border border-slate-200/80 dark:border-slate-800 text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveCenterTab("overview")}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeCenterTab === "overview"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              1. Tổng quan hồ sơ
            </button>
            <button
              type="button"
              onClick={() => setActiveCenterTab("comparison")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeCenterTab === "comparison"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>2. Đối chiếu học phần</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {caseItem.findings.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCenterTab("issues")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeCenterTab === "issues"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>3. Vấn đề cần xác minh</span>
              {(caseItem.aiSummary.insufficientCount > 0 || caseItem.aiSummary.contradictionCount > 0) && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveCenterTab("report")}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeCenterTab === "report"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              4. Phiếu rà soát (BM-RS-01)
            </button>
            <button
              type="button"
              onClick={() => setActiveCenterTab("history")}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeCenterTab === "history"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              5. Lịch sử ({caseItem.auditLogs.length})
            </button>
          </div>

          {/* TAB 1: TỔNG QUAN (OVERVIEW) */}
          {activeCenterTab === "overview" && (
            <div className="space-y-4 animate-in fade-in">
              {/* Summary Card */}
              <div className="p-5 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      Đánh giá Tổng hợp từ Campus Review AI Engine
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Lần chạy cuối: {caseItem.aiLastRunAt}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                  {caseItem.aiSummary.overallRecommendation}
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      Có bằng chứng
                    </div>
                    <div className="text-2xl font-black text-emerald-600 mt-0.5">
                      {caseItem.aiSummary.matchCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center">
                    <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                      Có khác biệt
                    </div>
                    <div className="text-2xl font-black text-blue-600 mt-0.5">
                      {caseItem.aiSummary.differenceCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      Chưa đủ căn cứ
                    </div>
                    <div className="text-2xl font-black text-amber-600 mt-0.5">
                      {caseItem.aiSummary.insufficientCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      Dữ liệu mâu thuẫn
                    </div>
                    <div className="text-2xl font-black text-rose-600 mt-0.5">
                      {caseItem.aiSummary.contradictionCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    HỌC PHẦN ĐÃ HỌC (TRƯỜNG CŨ)
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {caseItem.priorCourseName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Mã môn: {caseItem.priorCourseCode} · {caseItem.priorCourseCredits} Tín chỉ
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Nơi tích lũy: {caseItem.priorInstitution}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Kết quả điểm: <span className="font-bold text-emerald-600">{caseItem.priorGrade}</span>
                  </div>
                </div>

                <div className="p-4 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
                    HỌC PHẦN TẠI TRƯỜNG TIẾP NHẬN
                  </div>
                  <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                    {caseItem.targetCourseCode} - {caseItem.targetCourseName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Khối lượng: {caseItem.targetCourseCredits} Tín chỉ chuẩn (45 tiết)
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Đơn vị chuyên môn: {caseItem.targetDepartment}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Chuẩn đầu ra yêu cầu: Nền tảng thuật toán, thực hành lab &amp; đồ thị
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ĐỐI CHIẾU HỌC PHẦN (COURSE COMPARISON TABLE) */}
          {activeCenterTab === "comparison" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-3.5 w-44">Tiêu chí / Nội dung</th>
                        <th className="py-3 px-3.5 min-w-[200px]">Yêu cầu trường tiếp nhận</th>
                        <th className="py-3 px-3.5 min-w-[220px]">Bằng chứng từ học phần đã học</th>
                        <th className="py-3 px-3.5 w-36">Nhận định AI</th>
                        <th className="py-3 px-3.5 w-36">Kiểm tra Cán bộ</th>
                        <th className="py-3 px-3.5 text-right w-28">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {caseItem.findings.map((f) => {
                        const displayLabel = f.officerAdjustedLabel || f.aiLabel;

                        return (
                          <tr
                            key={f.id}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            {/* Tiêu chí */}
                            <td className="py-3.5 px-3.5 align-top">
                              <div className="font-bold text-slate-900 dark:text-white leading-tight">
                                {f.criterionTitle}
                              </div>
                              <span className="font-mono text-[9px] text-slate-400 uppercase mt-0.5 inline-block">
                                {f.category}
                              </span>
                            </td>

                            {/* Yêu cầu trường tiếp nhận */}
                            <td className="py-3.5 px-3.5 align-top text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                              {f.targetRequirement}
                            </td>

                            {/* Bằng chứng trích xuất */}
                            <td className="py-3.5 px-3.5 align-top space-y-1.5">
                              <div className="text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                {f.extractedEvidence}
                              </div>

                              {/* Clickable Citations */}
                              {f.citations.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {f.citations.map((cit, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleOpenCitation(cit)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-mono transition-all hover:scale-105"
                                      title="Bấm để mở tài liệu và xem đoạn dẫn chứng"
                                    >
                                      <Bookmark className="w-2.5 h-2.5" />
                                      <span>
                                        {cit.documentTitle.slice(0, 14)}... · Tr.{cit.pageNumber}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {f.aiExplanation && (
                                <div className="text-[10px] text-slate-500 italic mt-1">
                                  AI: {f.aiExplanation}
                                </div>
                              )}
                            </td>

                            {/* Nhận định AI */}
                            <td className="py-3.5 px-3.5 align-top">
                              {f.aiLabel === "has_evidence" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Có bằng chứng tương ứng</span>
                                </span>
                              )}
                              {f.aiLabel === "has_difference" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Có khác biệt cần xét</span>
                                </span>
                              )}
                              {f.aiLabel === "insufficient_evidence" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                                  <HelpCircle className="w-3 h-3" />
                                  <span>Chưa đủ căn cứ</span>
                                </span>
                              )}
                              {f.aiLabel === "contradiction" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Dữ liệu mâu thuẫn</span>
                                </span>
                              )}
                            </td>

                            {/* Kiểm tra Cán bộ */}
                            <td className="py-3.5 px-3.5 align-top space-y-1">
                              {f.officerStatus === "unverified" && (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                                  Chưa kiểm tra
                                </span>
                              )}
                              {f.officerStatus === "confirmed" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  <span>Cán bộ xác nhận</span>
                                </span>
                              )}
                              {f.officerStatus === "edited" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">
                                  <Edit3 className="w-3 h-3" />
                                  <span>Cán bộ đã chỉnh sửa</span>
                                </span>
                              )}

                              {f.officerNote && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2" title={f.officerNote}>
                                  &quot;{f.officerNote}&quot;
                                </div>
                              )}
                            </td>

                            {/* Thao tác */}
                            <td className="py-3.5 px-3.5 align-top text-right space-y-1">
                              {f.officerStatus === "unverified" && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickConfirmFinding(f)}
                                  className="w-full text-center px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-semibold transition-colors"
                                >
                                  Xác nhận
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditFinding(f)}
                                className="w-full text-center px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-semibold transition-colors"
                              >
                                Sửa nhận định
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VẤN ĐỀ CẦN XÁC MINH (ISSUES) */}
          {activeCenterTab === "issues" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      Danh mục Vấn đề &amp; Thông tin cần làm rõ
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenSupplementModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Tạo bản yêu cầu bổ sung từ các mục này</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {caseItem.findings
                    .filter((f) => f.aiLabel !== "has_evidence")
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border space-y-2 ${
                          item.aiLabel === "contradiction"
                            ? "bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60"
                            : "bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-slate-900 dark:text-white text-xs">
                            {item.criterionTitle}
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.aiLabel === "contradiction"
                                ? "bg-rose-500 text-white"
                                : "bg-amber-500 text-white"
                            }`}
                          >
                            {item.aiLabel === "contradiction" ? "Mâu thuẫn dữ liệu" : "Chưa đủ căn cứ"}
                          </span>
                        </div>

                        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {item.aiExplanation}
                        </div>

                        {item.aiSuggestedAction && (
                          <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 mt-1">
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span>Khuyến nghị xử lý: {item.aiSuggestedAction}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PHIẾU RÀ SOÁT (REVIEW SHEET PREVIEW BM-RS-01) */}
          {activeCenterTab === "report" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </div>
                  <div className="text-[10px] text-slate-400">Độc lập - Tự do - Hạnh phúc</div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white mt-2">
                    PHIẾU RÀ SOÁT HỒ SƠ ĐỀ NGHỊ CÔNG NHẬN HỌC PHẦN
                  </h2>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">
                    Mã biểu mẫu: BM-RS-01 · Hồ sơ: {caseItem.code}
                  </div>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Sinh viên đề nghị:</span>{" "}
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {caseItem.studentName} ({caseItem.studentMssv})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Khóa / Ngành:</span>{" "}
                    <span className="font-semibold">{caseItem.studentMajor}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Học phần trường cũ:</span>{" "}
                    <span className="font-semibold">{caseItem.priorCourseName} ({caseItem.priorCourseCredits} TC)</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Học phần đề nghị:</span>{" "}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {caseItem.targetCourseCode} - {caseItem.targetCourseName}
                    </span>
                  </div>
                </div>

                {/* Final status */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    Kết luận sơ bộ &amp; Đề xuất trình Hội đồng Chuyên môn:
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {caseItem.finalReport?.conclusionSummary ||
                      "Hồ sơ đang trong quá trình rà soát đối chiếu minh chứng. Cán bộ chưa hoàn tất thẩm định phiếu chính thức."}
                  </p>
                  {caseItem.finalReport && (
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
                      Đã ký số rà soát bởi: {caseItem.finalReport.officerName} · {caseItem.finalReport.completedAt}
                    </div>
                  )}
                </div>

                {/* Mandatory Legal Disclaimer */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-300/60 text-amber-900 dark:text-amber-200 text-xs">
                  <span className="font-bold">Lưu ý:</span> Lưu bản rà soát để người có thẩm quyền xem xét; chưa phải quyết định công nhận học phần.
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LỊCH SỬ (AUDIT TRAIL) */}
          {activeCenterTab === "history" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-5 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <span>Nhật ký Xử lý Hồ sơ (Audit Trail)</span>
                </h3>

                <div className="space-y-3 pt-2">
                  {caseItem.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {log.actorName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {log.timestamp}
                        </span>
                      </div>
                      <div className="text-slate-700 dark:text-slate-300 font-medium">
                        {log.action}
                      </div>
                      {log.details && (
                        <div className="text-[11px] text-slate-500 italic mt-0.5">
                          {log.details}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ========================================================
            VÙNG 3: PHẢI (RIGHT PANE) — NGUỒN BẰNG CHỨNG & BẢN NHÁP
            ======================================================== */}
        <aside className="w-full xl:w-[460px] flex flex-col gap-4 shrink-0">
          {/* Header of Right Pane */}
          <div className="p-4 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                  Trình xem Bằng chứng &amp; Văn bản gốc
                </h3>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
                Trang {activeCitation ? activeCitation.pageNumber : currentDocVersionObj?.sections[0]?.pageNumber || 1}
              </span>
            </div>

            {/* Document Selection Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {caseItem.documents.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setSelectedDocId(d.id);
                    setSelectedDocVersion(d.currentVersion);
                    setActiveCitation(null);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all whitespace-nowrap ${
                    selectedDocId === d.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {d.title.split("(")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Document Content Viewer (with real paragraphs & highlighted citations) */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex-1 flex flex-col space-y-4 max-h-[750px] overflow-y-auto shadow-sm">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  {selectedDocument?.title}
                </span>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                  Phiên bản {selectedDocVersion}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {selectedDocument?.institution} · Tập tin: {currentDocVersionObj?.fileName}
              </div>
            </div>

            {/* Citation Banner if citation clicked */}
            {activeCitation && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs space-y-1 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200 text-[11px]">
                  <span>Đang xem đoạn trích dẫn chứng:</span>
                  <button
                    type="button"
                    onClick={() => setActiveCitation(null)}
                    className="text-amber-700 hover:underline"
                  >
                    Bỏ đánh dấu
                  </button>
                </div>
                <div className="text-[11px] text-amber-800 dark:text-amber-300 italic font-mono bg-white/60 dark:bg-black/30 p-1.5 rounded-lg border border-amber-200/60">
                  &quot;{activeCitation.snippet}&quot;
                </div>
              </div>
            )}

            {/* Render sections with highlight */}
            <div className="space-y-4 text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200">
              {currentDocVersionObj?.sections.map((section) => {
                const isSectionActive = activeCitation && activeCitation.snippet && section.content.includes(activeCitation.snippet);

                return (
                  <div
                    key={section.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isSectionActive
                        ? "bg-amber-50/90 dark:bg-amber-950/50 border-amber-400 shadow-md ring-2 ring-amber-400/50"
                        : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-[11px] mb-2 pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span>{section.title}</span>
                      <span className="text-[9px] text-slate-400">Trang {section.pageNumber}</span>
                    </div>

                    <div className="whitespace-pre-wrap text-[11px] leading-relaxed">
                      {isSectionActive ? (
                        <>
                          {section.content.split(activeCitation.snippet).map((part, i, arr) => (
                            <React.Fragment key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <mark className="bg-yellow-200 dark:bg-yellow-800/80 text-slate-900 dark:text-white px-1 py-0.5 rounded font-bold transition-all shadow-xs">
                                  {activeCitation.snippet}
                                </mark>
                              )}
                            </React.Fragment>
                          ))}
                        </>
                      ) : (
                        section.content
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* ========================================================
          MODAL: SỬA NHẬN ĐỊNH CỦA CÁN BỘ (EDIT FINDING)
          ======================================================== */}
      {editingFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Cán bộ Điều chỉnh Nhận định
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingFinding(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <span className="text-slate-400">Tiêu chí:</span>{" "}
                <span className="font-bold text-slate-900 dark:text-white">
                  {editingFinding.criterionTitle}
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Nhận định sau điều chỉnh của Cán bộ:</label>
                <select
                  value={editFindingLabel}
                  onChange={(e) => setEditFindingLabel(e.target.value as FindingAiLabel)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="has_evidence">Có bằng chứng tương ứng</option>
                  <option value="has_difference">Có khác biệt cần xem xét</option>
                  <option value="insufficient_evidence">Chưa đủ căn cứ</option>
                  <option value="contradiction">Dữ liệu mâu thuẫn</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Lý do điều chỉnh của Cán bộ (Bắt buộc để lưu hồ sơ):
                </label>
                <textarea
                  value={editFindingReason}
                  onChange={(e) => setEditFindingReason(e.target.value)}
                  rows={3}
                  placeholder="Ghi rõ lý do điều chỉnh nhận định dựa trên chứng từ thực tế..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setEditingFinding(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditFinding}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
              >
                Lưu chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: SOẠN & XEM TRƯỚC YÊU CẦU BỔ SUNG
          ======================================================== */}
      {isSupplementModalOpen && supplementDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Soạn thảo Yêu cầu Bổ sung Hồ sơ cho Sinh viên
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSupplementModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Tiêu đề thông báo:</label>
                <input
                  type="text"
                  value={supplementDraft.subject}
                  onChange={(e) => setSupplementDraft({ ...supplementDraft, subject: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nội dung văn bản yêu cầu (Cán bộ có thể chỉnh sửa):</label>
                <textarea
                  value={supplementDraft.messageBody}
                  onChange={(e) => setSupplementDraft({ ...supplementDraft, messageBody: e.target.value })}
                  rows={8}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono leading-relaxed"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200">
                Thông báo này sẽ được gửi trực tiếp đến Cổng Sinh viên (/my-requests) của sinh viên{" "}
                <span className="font-bold">{caseItem.studentName}</span>. Sinh viên sẽ nộp tài liệu bổ sung trực tiếp trên cùng hồ sơ này.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setIsSupplementModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSendSupplementRequest}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Gửi yêu cầu bổ sung</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: HOÀN TẤT BẢN RÀ SOÁT (FINALIZE REVIEW)
          ======================================================== */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Xác nhận Hoàn tất Bản rà soát Học thuật
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFinalizeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <label className="block font-semibold mb-1">Đề xuất chuyên môn của Cán bộ:</label>
                <select
                  value={finalizeRecommendation}
                  onChange={(e) => setFinalizeRecommendation(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  <option value="propose_recognition">Đề nghị Công nhận học phần (Đủ điều kiện)</option>
                  <option value="propose_conditional">Đề nghị Công nhận có điều kiện</option>
                  <option value="propose_rejection">Đề nghị Từ chối công nhận</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Tóm tắt kết luận của Cán bộ:</label>
                <textarea
                  value={finalizeSummary}
                  onChange={(e) => setFinalizeSummary(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                />
              </div>

              {/* MANDATORY LEGAL DISCLAIMER CONFIRMATION */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-xs">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>Quy định bắt buộc:</span>
                </div>
                <p className="text-[11px] leading-relaxed italic">
                  &quot;Lưu bản rà soát để người có thẩm quyền xem xét; chưa phải quyết định công nhận học phần.&quot;
                </p>
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={finalizeConfirmed}
                    onChange={(e) => setFinalizeConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-[11px]">
                    Tôi đã kiểm tra đối soát toàn bộ bằng chứng và xác nhận lưu bản rà soát BM-RS-01.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setIsFinalizeModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={!finalizeConfirmed}
                onClick={handleExecuteFinalize}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Hoàn tất &amp; Lưu phiếu BM-RS-01</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
