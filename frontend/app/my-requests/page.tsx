"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle2,
  Printer,
  Share2,
  Send,
  Plus,
  Info,
  Download,
  Lock,
  FileSearch,
  BookOpen,
  AlertTriangle,
  Upload,
  ArrowRight,
  Shield,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Check,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";

export default function MyRequestsPage() {
  const { currentUser, tickets, addTicketMessage, reviewCases, submitStudentSupplement } = useStore();

  // Filter tickets and reviews by current student to ensure strict isolation
  const myTickets = (tickets || []).filter((t) => t.studentId === currentUser.id);
  const myReviews = (reviewCases || []).filter((r) => r.studentId === currentUser.id);

  const [activeCategory, setActiveCategory] = useState<"tickets" | "reviews">("tickets");
  const [selectedReviewId, setSelectedReviewId] = useState<string>(myReviews[0]?.id || "");

  const [activeTab, setActiveTab] = useState<"all" | "in_progress" | "resolved">("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    myTickets[0]?.id || "TKT-2026-0142"
  );
  const [replyText, setReplyText] = useState("");
  const [showEmptyStateMock, setShowEmptyStateMock] = useState(false);

  // Student supplement submission state
  const [supplementNote, setSupplementNote] = useState("");
  const [supplementPreset, setSupplementPreset] = useState<"syllabus_v2" | "scan_clear" | "code_equiv">("syllabus_v2");
  const [supplementSuccess, setSupplementSuccess] = useState(false);

  const filteredTickets = myTickets.filter((t) => {
    if (activeTab === "in_progress") return t.status === "open" || t.status === "pending_officer";
    if (activeTab === "resolved") return t.status === "resolved";
    return true;
  });

  const selectedTicket = myTickets.find((t) => t.id === selectedTicketId) || myTickets[0];
  const selectedReview = myReviews.find((r) => r.id === selectedReviewId) || myReviews[0];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    addTicketMessage(selectedTicket.id, {
      senderId: currentUser.id,
      senderName: `${currentUser.name} (${currentUser.id})`,
      senderRole: "student",
      content: replyText.trim(),
    });
    setReplyText("");
  };

  const handleStudentSubmitSupplement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview) return;

    let fileName = "De_cuong_chi_tiet_v2_Co_xac_nhan.pdf";
    let versionToActivate = 2;

    if (supplementPreset === "scan_clear") {
      fileName = "Ban_scan_mau_ro_net_Do_phan_giai_cao.pdf";
      versionToActivate = 1;
    } else if (supplementPreset === "code_equiv") {
      fileName = "Giay_xac_nhan_tuong_duong_ma_mon_truong_cu.pdf";
      versionToActivate = 1;
    }

    submitStudentSupplement(selectedReview.id, {
      note: supplementNote.trim() || "Sinh viên nộp bổ sung tài liệu theo yêu cầu của Cán bộ Học vụ.",
      fileName,
      versionToActivate,
    });

    setSupplementSuccess(true);
    setSupplementNote("");
    setTimeout(() => setSupplementSuccess(false), 5000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent transition-colors">
      <Navbar />

      {/* Header Banner */}
      <div className="w-full border-b border-white/50 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Cổng Dịch vụ &amp; Yêu cầu Sinh viên
              </h1>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                {currentUser.name} ({currentUser.id}) · {currentUser.classYear || "K18 KTPM"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Theo dõi tiến độ xử lý hồ sơ dịch vụ học vụ, đối chiếu rà soát học phần và trao đổi với cán bộ phụ trách.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nộp đơn / Trợ lý AI</span>
            </Link>
          </div>
        </div>

        {/* Primary Category Switcher Tabs */}
        <div className="max-w-7xl mx-auto mt-4 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveCategory("tickets")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeCategory === "tickets"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Yêu cầu Học vụ &amp; Khiếu nại ({myTickets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("reviews")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeCategory === "reviews"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700"
            }`}
          >
            <FileSearch className="w-4 h-4" />
            <span>Hồ sơ Rà soát Học phần ({myReviews.length})</span>
            {myReviews.some((r) => r.status === "waiting_supplement") && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="Có yêu cầu bổ sung" />
            )}
          </button>
        </div>
      </div>


      {/* Main Content Workspace */}
      {activeCategory === "tickets" ? (
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col lg:flex-row gap-6">
          {/* Left Column: Tickets List */}
          <div className="w-full lg:w-[380px] flex flex-col shrink-0 space-y-4">
          <div className="p-4 rounded-3xl glass-surface space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white text-xs">
                HỒ SƠ ĐÃ GỬI ({myTickets.length})
              </span>
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Đồng bộ 24/7
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-white/50 dark:bg-slate-800/60 backdrop-blur-md rounded-xl text-xs border border-white/40 dark:border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "all"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tất cả ({myTickets.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("in_progress")}
                className={`py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "in_progress"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Đang xử lý ({myTickets.filter((t) => t.status !== "resolved").length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("resolved")}
                className={`py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "resolved"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Đã xong ({myTickets.filter((t) => t.status === "resolved").length})
              </button>
            </div>
          </div>

          {/* Ticket List Cards */}
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[700px]">
            {filteredTickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all glass-card-interactive ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/50 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500"
                      : "bg-white/65 dark:bg-[#111827]/65 backdrop-blur-md border-white/60 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700/60 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {t.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {t.priority === "high" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          ƯU TIÊN CAO
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          t.status === "open"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            : t.status === "pending_officer"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                        }`}
                      >
                        {t.status === "open"
                          ? "MỚI TIẾP NHẬN"
                          : t.status === "pending_officer"
                          ? "CHỜ CÁN BỘ"
                          : "ĐÃ HOÀN TẤT"}
                      </span>
                    </div>
                  </div>

                  <h4 className="font-semibold text-slate-900 dark:text-white text-xs mb-1 line-clamp-1">
                    {t.title}
                  </h4>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2.5">
                    {t.priorityReason || t.purpose}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>{t.submittedAt}</span>
                    <span className="font-mono">
                      {t.status === "resolved" ? (
                        <span className="text-emerald-600 dark:text-emerald-400">File PDF ký số CA</span>
                      ) : (
                        `SLA: ${t.slaDeadline}`
                      )}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Toggle demo empty state */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowEmptyStateMock(!showEmptyStateMock)}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors text-center"
              >
                {showEmptyStateMock ? "Ẩn mẫu trạng thái trống" : "Xem mẫu trạng thái: Chưa có hồ sơ nào"}
              </button>
            </div>

            {showEmptyStateMock && (
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                  Chưa có yêu cầu nào
                </div>
                <p className="text-[11px] text-slate-500">
                  Khi bạn nộp hồ sơ xin cấp giấy hoặc khiếu nại, hồ sơ sẽ xuất hiện tại đây.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ticket Detailed View */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col glass-surface rounded-3xl overflow-hidden shadow-2xl">
            {/* Ticket Header */}
            <div className="p-5 sm:p-6 bg-white/40 dark:bg-slate-900/60 backdrop-blur-md border-b border-white/40 dark:border-white/10 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {selectedTicket.code}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedTicket.status === "open"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                        : selectedTicket.status === "pending_officer"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                    }`}
                  >
                    {selectedTicket.status === "open"
                      ? "MỚI TIẾP NHẬN"
                      : selectedTicket.status === "pending_officer"
                      ? "CHỜ CÁN BỘ"
                      : "ĐÃ HOÀN TẤT"}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {selectedTicket.title}
                </h2>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{selectedTicket.submittedAt}</span>
                  </span>
                  <span>•</span>
                  <span>Trợ lý Học vụ AI Campus 24/7</span>
                  <span>•</span>
                  <span className="font-mono">MSSV: {selectedTicket.studentMssv}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="In biên nhận hồ sơ"
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Chia sẻ thông tin hồ sơ"
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
              {/* Status Context Banner */}
              <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 text-slate-700 dark:text-slate-300 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Tình trạng tiếp nhận nghiệp vụ
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {selectedTicket.status === "open"
                      ? "Yêu cầu đã được ghi nhận trên hệ thống và đang chờ cán bộ học vụ Phòng Đào tạo & CTSV tiếp nhận thụ lý chính thức."
                      : selectedTicket.status === "pending_officer"
                      ? "Cán bộ học vụ đang thụ lý đối soát bằng chứng và văn bản. Mọi cập nhật bổ sung sẽ hiển thị tức thời."
                      : "Hồ sơ đã được phê duyệt và hoàn tất. Bạn có thể tải trực tiếp file văn bản có chữ ký số CA hợp lệ."}
                  </p>
                </div>
              </div>

              {/* 3-Step Progress Stepper */}
              <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-xs">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-blue-600" />
                    <div className="font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                      1. MỚI TIẾP NHẬN
                    </div>
                    <div className="text-[10px] text-slate-400">09:42 · Hoàn tất tiếp nhận</div>
                  </div>

                  <div className="space-y-1">
                    <div
                      className={`h-1.5 rounded-full ${
                        selectedTicket.status === "pending_officer" || selectedTicket.status === "resolved"
                          ? "bg-amber-500"
                          : "bg-slate-200 dark:bg-slate-800"
                      }`}
                    />
                    <div
                      className={`font-bold text-[11px] ${
                        selectedTicket.status === "pending_officer" || selectedTicket.status === "resolved"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-400"
                      }`}
                    >
                      2. CHỜ CÁN BỘ
                    </div>
                    <div className="text-[10px] text-slate-400">OF001 thụ lý hồ sơ</div>
                  </div>

                  <div className="space-y-1">
                    <div
                      className={`h-1.5 rounded-full ${
                        selectedTicket.status === "resolved"
                          ? "bg-emerald-600"
                          : "bg-slate-200 dark:bg-slate-800"
                      }`}
                    />
                    <div
                      className={`font-bold text-[11px] ${
                        selectedTicket.status === "resolved"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-400"
                      }`}
                    >
                      3. ĐÃ HOÀN TẤT
                    </div>
                    <div className="text-[10px] text-slate-400">Ký số CA &amp; cấp PDF</div>
                  </div>
                </div>
              </div>

              {/* Declared Information Section */}
              <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-xs space-y-3">
                <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-slate-100 dark:border-slate-800 pb-2">
                  THÔNG TIN HỒ SƠ ĐÃ KÊ KHAI
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Loại giấy học vụ:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedTicket.certificateType}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Phương thức tiếp nhận:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      {selectedTicket.receiveMethod === "digital_pdf"
                        ? "Bản điện tử (PDF ký số CA qua Cổng)"
                        : "Bản giấy (Đóng dấu mộc nhận tại P. Đào tạo)"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Nơi nhận văn bản:
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {selectedTicket.destinationOrg}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Mục đích sử dụng chi tiết:
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {selectedTicket.purpose}
                    </span>
                  </div>
                </div>

                {selectedTicket.status === "resolved" && (
                  <div className="mt-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Văn bản điện tử ký số CA sẵn sàng tải xuống.</span>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải bản PDF</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Communication & Officer Feedback Log */}
              <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                    NHẬT KÝ TRAO ĐỔI &amp; PHẢN HỒI TỪ CÁN BỘ
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    Kênh mã hóa đầu-cuối
                  </span>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {selectedTicket.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-2xl text-xs space-y-1 ${
                        msg.senderRole === "system"
                          ? "bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                          : msg.senderRole === "officer"
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200 ml-0 mr-auto max-w-[90%]"
                          : "bg-blue-600 text-white ml-auto mr-0 max-w-[90%]"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-[11px] gap-2">
                        <span>{msg.senderName}</span>
                        <span className="text-[10px] font-mono opacity-80">{msg.timestamp}</span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-line text-[11px]">{msg.content}</p>
                    </div>
                  ))}
                </div>

                {/* Reply Composer */}
                <form onSubmit={handleSendMessage} className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="relative flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Nhập tin nhắn hoặc gửi thêm thông tin cho cán bộ phụ trách..."
                      disabled={selectedTicket.status === "resolved"}
                      className="w-full pl-4 pr-16 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim() || selectedTicket.status === "resolved"}
                      className="absolute right-1.5 top-1.5 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                    >
                      <span>Gửi</span>
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Mọi tin nhắn được chuyển tức thì tới Bàn làm việc cán bộ OF001.</span>
                    <span>Enter để gửi</span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
            Chọn một hồ sơ bên trái để xem tiến độ chi tiết.
          </div>
        )}
      </div>
      ) : (
        /* ========================================================
           2. PHÂN HỆ HỒ SƠ RÀ SOÁT HỌC PHẦN DÀNH CHO SINH VIÊN
           ======================================================== */
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col lg:flex-row gap-6">
          {/* Cột trái: Danh sách hồ sơ rà soát của sinh viên */}
          <div className="w-full lg:w-[380px] flex flex-col shrink-0 space-y-4">
            <div className="p-4 rounded-3xl glass-surface space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <FileSearch className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>HỒ SƠ RÀ SOÁT CỦA BẠN ({myReviews.length})</span>
                </span>
                <span className="font-mono text-[10px] text-indigo-600 font-semibold">
                  Học phần
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Các hồ sơ đề nghị công nhận học phần tương đương từ trường khác.
              </p>
            </div>

            {/* List Cards */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[700px]">
              {myReviews.length === 0 ? (
                <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                  Bạn chưa có hồ sơ rà soát công nhận học phần nào trong học kỳ này.
                </div>
              ) : (
                myReviews.map((item) => {
                  const isSelected = selectedReview?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedReviewId(item.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all glass-card-interactive ${
                        isSelected
                          ? "bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500"
                          : "bg-white/65 dark:bg-[#111827]/65 backdrop-blur-md border-white/60 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-700/60 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {item.code}
                        </span>
                        {item.status === "waiting_supplement" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                            CẦN BỔ SUNG
                          </span>
                        )}
                        {item.status === "in_review" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Đang rà soát
                          </span>
                        )}
                        {item.status === "completed" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ĐÃ XONG SƠ BỘ
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {item.targetCourseCode} - {item.targetCourseName}
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                        <span>Đã học:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{item.priorCourseName}</span>
                      </div>

                      <div className="text-[10px] text-slate-400 mt-1 truncate">
                        {item.priorInstitution}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{item.documents.length} tài liệu đính kèm</span>
                        <span>{item.updatedAt}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cột phải: Chi tiết tiến độ, thông báo cán bộ và form bổ sung tài liệu */}
          {selectedReview ? (
            <div className="flex-1 flex flex-col space-y-4 min-w-0">
              {/* Header Box */}
              <div className="p-5 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedReview.code}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-500 font-mono">
                        Nộp ngày: {selectedReview.createdAt.split("T")[0]}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      Đề nghị Công nhận Học phần: {selectedReview.targetCourseCode} - {selectedReview.targetCourseName}
                    </h2>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Học phần đối chiếu: <span className="font-semibold">{selectedReview.priorCourseName}</span> ({selectedReview.priorCourseCode}) · {selectedReview.priorCourseCredits} TC tại {selectedReview.priorInstitution}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {selectedReview.status === "in_review" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Đang thẩm định sơ bộ</span>
                      </span>
                    )}
                    {selectedReview.status === "waiting_supplement" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Cần bổ sung chứng từ</span>
                      </span>
                    )}
                    {selectedReview.status === "completed" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã hoàn tất rà soát sơ bộ</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3-Step Progress Tracker */}
                <div className="pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        ✓
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                          1. Tiếp nhận hồ sơ
                        </div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          Đã đủ hồ sơ cơ bản
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                        selectedReview.status === "waiting_supplement"
                          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                          : selectedReview.status === "completed"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900"
                          : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 text-blue-900"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          selectedReview.status === "completed"
                            ? "bg-emerald-600 text-white"
                            : selectedReview.status === "waiting_supplement"
                            ? "bg-amber-600 text-white animate-pulse"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        2
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs">2. Thẩm định &amp; Đối chiếu</div>
                        <div className="text-[10px] opacity-80">
                          {selectedReview.status === "waiting_supplement"
                            ? "Đang chờ sinh viên nộp bổ sung"
                            : selectedReview.status === "completed"
                            ? "Đã lập phiếu BM-RS-01"
                            : "Cán bộ đang kiểm tra đề cương"}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                        selectedReview.status === "completed"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          selectedReview.status === "completed"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                        }`}
                      >
                        3
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs">3. Hội đồng Phê duyệt</div>
                        <div className="text-[10px] opacity-80">
                          {selectedReview.status === "completed"
                            ? "Đã chuyển hồ sơ Hội đồng"
                            : "Chờ hoàn tất thẩm định"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thông báo từ Cán bộ Học vụ */}
              <div className="p-5 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Thông báo từ Cán bộ Học vụ (Phòng Đào tạo &amp; CTSV)
                  </h3>
                </div>

                {selectedReview.supplementRequests.length > 0 ? (
                  <div className="space-y-3">
                    {selectedReview.supplementRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                          <span className="text-sm">{req.subject}</span>
                          <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400 font-normal">
                            {req.sentAt || "Vừa xong"}
                          </span>
                        </div>

                        <div className="whitespace-pre-line text-slate-700 dark:text-slate-200 leading-relaxed font-mono bg-white/60 dark:bg-black/30 p-3 rounded-xl border border-amber-200/60">
                          {req.messageBody}
                        </div>

                        {req.studentReply && (
                          <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200">
                            <span className="font-bold">✓ Sinh viên đã phản hồi ({req.studentReply.submittedAt}):</span>{" "}
                            {req.studentReply.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                    Chưa có thông báo yêu cầu bổ sung nào cho hồ sơ này. Cán bộ học vụ đang thực hiện rà soát theo quy trình.
                  </div>
                )}

                {/* Form nộp bổ sung tài liệu nếu hồ sơ đang ở trạng thái waiting_supplement */}
                {selectedReview.status === "waiting_supplement" && (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3 pt-4">
                    <div className="flex items-center gap-2 font-bold text-xs text-indigo-900 dark:text-indigo-200">
                      <Upload className="w-4 h-4 text-indigo-600" />
                      <span>Nộp Bổ sung Chứng từ &amp; Giải trình</span>
                    </div>

                    {supplementSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Đã nộp bổ sung tài liệu thành công! Cán bộ học vụ đã nhận được cập nhật và đang đối soát lại.</span>
                      </div>
                    )}

                    <form onSubmit={handleStudentSubmitSupplement} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                          Chọn loại tài liệu bổ sung:
                        </label>
                        <select
                          value={supplementPreset}
                          onChange={(e) => setSupplementPreset(e.target.value as any)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          <option value="syllabus_v2">
                            Đề cương chi tiết học phần v2 (có chữ ký và đóng dấu xác nhận của Khoa/Bộ môn trường cũ)
                          </option>
                          <option value="scan_clear">
                            Bản scan màu rõ nét độ phân giải cao (Bổ sung phần bị mờ nét)
                          </option>
                          <option value="code_equiv">
                            Văn bản xác nhận tương đương mã học phần của Phòng Đào tạo trường cũ
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                          Lời giải trình / Ghi chú gửi Cán bộ học vụ:
                        </label>
                        <textarea
                          value={supplementNote}
                          onChange={(e) => setSupplementNote(e.target.value)}
                          rows={3}
                          required
                          placeholder="Ví dụ: Em đã xin được đề cương v2 có xác nhận dấu mộc đỏ của Khoa, bổ sung chi tiết chương Đồ thị và thuật toán Dijkstra..."
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi tài liệu bổ sung ngay</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Danh sách chứng từ đã đính kèm */}
              <div className="p-5 rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span>Danh mục Chứng từ Đã nộp trong Hồ sơ ({selectedReview.documents.length})</span>
                </div>

                <div className="space-y-2">
                  {selectedReview.documents.map((doc) => {
                    const latest = doc.versions.find((v) => v.version === doc.currentVersion);
                    return (
                      <div
                        key={doc.id}
                        className="p-3 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {doc.title}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Tệp: {latest?.fileName} · Phiên bản v{doc.currentVersion} ({latest?.uploadedAt})
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 shrink-0">
                          {latest?.legibility === "good" ? "Hợp lệ" : "Scan mờ"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legal Disclaimer */}
              <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Lưu ý: Mọi kết quả rà soát sơ bộ trên hệ thống chỉ mang tính chất đối soát kỹ thuật. Quyết định công nhận học phần và số tín chỉ miễn trừ chính thức sẽ do Hội đồng Chuyên môn và Trưởng Bộ môn phê duyệt theo Quy chế Đào tạo.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
              Chọn một hồ sơ rà soát bên trái để xem tiến độ.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

