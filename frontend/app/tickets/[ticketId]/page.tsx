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
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params?.ticketId as string;

  const {
    getTicket,
    updateOfficerDraft,
    resetOfficerDraft,
    toggleChecklistItem,
    submitGate2Response,
  } = useStore();

  const ticket = getTicket(ticketId) || getTicket("TKT-2026-0142");

  const [draftContent, setDraftContent] = useState(() =>
    ticket ? ticket.officerDraft || ticket.officerDraftDefault : ""
  );
  const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [modalActionType, setModalActionType] = useState<"respond" | "request_info" | "resolve">("respond");
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [syncToast, setSyncToast] = useState(false);

  if (!ticket) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17]">
        <Navbar />
        <div className="max-w-4xl mx-auto p-12 text-center text-xs">
          <p className="text-slate-500">Không tìm thấy mã hồ sơ: {ticketId}</p>
          <Link href="/dashboard" className="text-blue-600 underline mt-2 inline-block">
            Quay lại Hàng chờ
          </Link>
        </div>
      </div>
    );
  }

  const isL4 = ticket.isL4 || ticket.code === "TKT-2026-0098";
  const checkedCount = ticket.checklist.filter((c) => c.checked).length;
  const allChecked = checkedCount === ticket.checklist.length;

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraftContent(val);
    updateOfficerDraft(ticket.id, val);
  };

  const handleResetDraft = () => {
    resetOfficerDraft(ticket.id);
    setDraftContent(ticket.officerDraftDefault);
  };

  const handleAiSync = () => {
    setSyncToast(true);
    setTimeout(() => setSyncToast(false), 2500);
  };

  const triggerAction = (type: "respond" | "request_info" | "resolve") => {
    setModalActionType(type);
    setShowPreflightModal(true);
  };

  const confirmSubmitGate2 = () => {
    submitGate2Response(ticket.id, modalActionType, draftContent);
    setShowPreflightModal(false);
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
                    : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                }`}
              >
                {ticket.status === "open"
                  ? "MỚI TIẾP NHẬN"
                  : ticket.status === "pending_officer"
                  ? "CHỜ CÁN BỘ"
                  : "ĐÃ HOÀN TẤT"}
              </span>

              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {isL4 ? "ƯU TIÊN CAO (L4)" : "BÌNH THƯỜNG (L2)"}
              </span>
            </div>
          </div>

          {/* Quick Case Switchers */}
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/tickets/TKT-2026-0142"
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                !isL4
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              📄 XEM CA CHUẨN L2 (TKT-2026-0142)
            </Link>

            <Link
              href="/tickets/TKT-2026-0098"
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                isL4
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              🚨 XEM CA KHẨN CẤP L4 (TKT-2026-0098)
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
            <p className="text-xs leading-relaxed text-rose-200/90">
              {ticket.l4TriggerReason ||
                "Hệ thống AI đã lập tức dừng đối thoại tự động lúc 09:15 sau khi phát hiện khiếu nại điểm môn Cấu trúc Dữ liệu. Toàn bộ lược sử tương tác và hồ sơ đối soát được đóng gói niêm phong chuyển sang Cán bộ OF001 kiểm duyệt độc lập. Mọi thay đổi điểm số bắt buộc phải có xác nhận số của Giảng viên và Trưởng bộ môn."}
            </p>
          </div>
        )}

        {/* Student Profile Banner */}
        <div className="p-4 sm:p-5 rounded-3xl glass-surface shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-base flex items-center justify-center border border-blue-200 dark:border-blue-800">
              {ticket.studentName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
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

          <div className="text-right sm:border-l sm:border-slate-200 sm:dark:border-slate-800 sm:pl-6">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              MỤC TIÊU YÊU CẦU
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
              {ticket.title}
            </div>
          </div>
        </div>

        {/* Sync Alert Banner */}
        {!notificationDismissed && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Hồ sơ vừa có tin nhắn mới từ sinh viên [MỚI]</strong> – Bấm &ldquo;Cập nhật phân tích AI&rdquo; để nạp lại dữ liệu đồng bộ (Bản thảo bạn đang gõ bên phải sẽ được giữ nguyên tuyệt đối, không bị ghi đè).
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAiSync}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Cập nhật phân tích AI</span>
              </button>
              <button
                type="button"
                onClick={() => setNotificationDismissed(true)}
                className="p-1 rounded-md text-amber-600 dark:text-amber-400 hover:text-amber-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {syncToast && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Dữ liệu AI đã được đồng bộ mới nhất. Bản thảo của cán bộ vẫn được giữ nguyên vẹn.</span>
          </div>
        )}

        {/* Two-Column Split Layout (Matching Image 7 & Image 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Facts, Evidence, Checklist, Audit */}
          <div className="lg:col-span-7 space-y-5">
            {/* AI Copilot Brief */}
            <div className="p-5 rounded-3xl glass-surface space-y-3.5">
              <div className="flex items-center justify-between border-b border-white/50 dark:border-white/10 pb-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>AI COPILOT TÓM TẮT CA XỬ LÝ</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  Engine v4.2 · Conf. {ticket.aiSummary.confidence}
                </span>
              </div>

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

            {/* Facts & Evidence Section (If L4: show 3 sources verification & grade diff scale; If L2: show Group A vs Group B) */}
            {isL4 && ticket.l4EvidenceVerification ? (
              <div className="p-5 rounded-2xl glass-surface space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <span>Khung Đối Soát Bằng Chứng (Facts Verification)</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    TIÊU CHUẨN KIỂM TOÁN: ISO 27001 EDU
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Hệ thống yêu cầu cán bộ kiểm tra tính xác thực chéo giữa 3 nguồn dữ liệu: lời khai sinh viên, máy chủ CSDL Đào tạo, và chứng từ ký tay gốc.
                </p>

                {/* 3 Sources */}
                <div className="space-y-2.5">
                  {/* Source 1 */}
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
                      CHƯA KIỂM CHỨNG (LỜI KHAI SV)
                    </span>
                  </div>

                  {/* Source 2 */}
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

                  {/* Source 3 */}
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
                      CÁN BỘ CHƯA KIỂM TRA THỦ CÔNG
                    </span>
                  </div>
                </div>

                {/* Grade Diff Visual Scale (Matching Image 1) */}
                <div className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 backdrop-blur-sm space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">
                      ĐỐI CHIẾU CHÊNH LỆCH ĐIỂM SỐ
                    </span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {ticket.l4EvidenceVerification.gradeDiff.diffText}
                    </span>
                  </div>

                  <div className="relative pt-4 pb-2">
                    <div className="h-3 w-full bg-slate-200/70 dark:bg-slate-700/70 rounded-full overflow-hidden flex">
                      <div style={{ width: "55%" }} className="bg-slate-400 dark:bg-slate-500" />
                      <div style={{ width: "20%" }} className="bg-gradient-to-r from-amber-500 to-emerald-500 animate-pulse" />
                    </div>

                    <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-2">
                      <span>0.0</span>
                      <span className="text-slate-700 dark:text-slate-300 font-bold">5.5 (Điểm cũ)</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">7.5 (Điểm đề xuất mới)</span>
                      <span>10.0</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* L2 Facts & Evidence (Matching Image 7) */
              <div className="p-5 rounded-2xl glass-surface space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Bảng Dữ kiện có Nguồn (Facts &amp; Evidence)</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    NGUYÊN TẮC: KHÔNG SUY ĐOÁN
                  </span>
                </div>

                {/* Nhóm A */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    • NHÓM A: DỮ LIỆU DO SINH VIÊN TỰ KHAI (CHƯA KIỂM CHỨNG ĐỘC LẬP)
                  </div>

                  <div className="space-y-1.5">
                    {ticket.facts
                      .filter((f) => f.key.includes("Mục đích") || f.key.includes("Định danh"))
                      .map((f) => (
                        <div
                          key={f.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono text-[10px] text-slate-400 mr-2">
                              {f.source}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {f.key}: <strong>{f.value}</strong>
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              f.status === "verified"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {f.statusText}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Nhóm B */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    • NHÓM B: DỮ KIỆN CÁN BỘ THẨM ĐỊNH NGHIỆP VỤ
                  </div>

                  <div className="space-y-1.5">
                    {ticket.facts
                      .filter((f) => !f.key.includes("Mục đích") && !f.key.includes("Định danh"))
                      .map((f) => (
                        <div
                          key={f.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono text-[10px] text-slate-400 mr-2">
                              {f.source}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {f.key}: <strong>{f.value}</strong>
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            {f.statusText}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Attachments & SOP Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      TÀI LIỆU HỒ SƠ ĐÍNH KÈM
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Không có tài liệu bắt buộc đối với yêu cầu cấp giấy BM-03 thông thường.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      QUY ĐỊNH THẨM ĐỊNH ÁP DỤNG
                    </span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                      {ticket.sopReference}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {ticket.sopDeadline}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist Section */}
            <div className="p-5 rounded-2xl glass-surface space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  <span>Checklist Thẩm định Nghiệp vụ (Cán bộ tick chọn)</span>
                </div>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {checkedCount} / {ticket.checklist.length} hoàn tất
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tất cả các mục mặc định ở trạng thái <strong>Chưa kiểm tra</strong>. Khi cán bộ tick xác nhận, hệ thống tự động ghi nhật ký trách nhiệm gắn mã cán bộ OF001.
              </p>

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
            <div className="p-5 rounded-2xl glass-surface space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  Nhật ký Trách nhiệm &amp; Audit Log
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  BLOCKCHAIN INTEGRITY LOG
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
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

          {/* Right Column (5 cols): Submit 2 Gate Enforcement & Draft */}
          <div className="lg:col-span-5 space-y-5 sticky top-20">
            <div className="p-5 rounded-2xl glass-surface shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Cổng Kiểm duyệt Cán bộ</span>
                </div>
                <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">
                  SUBMIT 2 GATE ENFORCEMENT
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Mọi nội dung phản hồi chỉ được phát hành tới sinh viên khi cán bộ đã trực tiếp kiểm tra và bấm xác nhận.
              </p>

              {/* Draft Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                    Dự thảo phản hồi AI soạn sẵn:
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

                <textarea
                  rows={6}
                  value={draftContent}
                  onChange={handleDraftChange}
                  className="w-full p-3 rounded-xl bg-white/60 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans backdrop-blur-sm"
                  placeholder="Nhập nội dung phản hồi chính thức cho sinh viên..."
                />

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>AI không tự động gửi nội dung này. Cán bộ toàn quyền chỉnh sửa và duyệt nội dung.</span>
                </div>
              </div>

              {/* Action Buttons (Submit 2 Gate Actions) */}
              <div className="space-y-2 pt-1">
                {/* 1. Respond (transitions to pending_officer) */}
                <button
                  type="button"
                  onClick={() => triggerAction("respond")}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi phản hồi cho sinh viên</span>
                </button>
                <div className="text-[10px] text-slate-400 text-center font-mono">
                  Trạng thái sau gửi: <strong className="text-amber-600 dark:text-amber-400">CHỜ CÁN BỘ (PENDING_OFFICER)</strong>
                </div>

                {/* 2. Request additional info */}
                <button
                  type="button"
                  onClick={() => triggerAction("request_info")}
                  className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Yêu cầu sinh viên bổ sung hồ sơ</span>
                </button>

                {/* 3. Resolve ticket */}
                <button
                  type="button"
                  onClick={() => triggerAction("resolve")}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Hoàn tất xử lý yêu cầu (Resolved)</span>
                </button>
                <div className="text-[10px] text-slate-400 text-center italic">
                  * Chỉ bấm hoàn tất khi đã kết thúc toàn bộ thủ tục thẩm định hồ sơ.
                </div>
              </div>

              {/* Pre-Flight Check Info Box */}
              <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-[11px] text-slate-900 dark:text-white">
                  <span>XEM TRƯỚC XÁC NHẬN CỔNG 2</span>
                  <span className="font-mono text-[9px] text-slate-400">Pre-Flight Check</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex justify-between">
                  <span>Người nhận:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{ticket.studentName} ({ticket.studentMssv})</strong>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex justify-between">
                  <span>Trạng thái sau khi gửi:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">pending_officer</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                  Thao tác gửi phản hồi KHÔNG đóng hồ sơ. Hồ sơ vẫn được duy trì trong danh sách thụ lý của Cán bộ OF001.
                </p>
              </div>

              {/* Student live conversation stream */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                    Trao đổi trực tiếp với Sinh viên
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

      {/* Pre-Flight Confirmation Modal */}
      {showPreflightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>
                  {modalActionType === "resolve"
                    ? "Xác nhận Phê duyệt Hoàn tất Hồ sơ (Resolved)"
                    : modalActionType === "request_info"
                    ? "Xác nhận Gửi yêu cầu Bổ sung Hồ sơ"
                    : "Xác nhận Phát hành Phản hồi Cổng 2"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPreflightModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/60 text-[11px] space-y-1">
                <div>Người nhận: <strong>{ticket.studentName} ({ticket.studentMssv})</strong></div>
                <div>Mã hồ sơ: <span className="font-mono font-bold text-blue-600">{ticket.code}</span></div>
                <div>
                  Hành động:{" "}
                  <strong>
                    {modalActionType === "resolve"
                      ? "Chuyển trạng thái sang ĐÃ HOÀN TẤT và xuất kết quả"
                      : "Gửi thông điệp nghiệp vụ sang Cổng Sinh viên (Trạng thái: Chờ cán bộ)"}
                  </strong>
                </div>
              </div>

              <div>
                <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200 block mb-1">
                  Nội dung gửi:
                </span>
                <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-[11px] leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">
                  {modalActionType === "request_info"
                    ? "Phòng Đào tạo & CTSV yêu cầu bạn gửi bổ sung ảnh chụp Thẻ sinh viên hoặc Giấy tờ chứng minh đối tượng chính sách để cán bộ hoàn tất hồ sơ."
                    : draftContent}
                </div>
              </div>

              {modalActionType === "resolve" && !allChecked && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    Lưu ý: Checklist thẩm định chưa được hoàn tất đầy đủ ({checkedCount}/{ticket.checklist.length}). Bạn vẫn có thể hoàn tất nếu đã đối soát thủ công ngoài hệ thống.
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPreflightModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmSubmitGate2}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20 transition-all"
              >
                Xác nhận thực hiện
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
