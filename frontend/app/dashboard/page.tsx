"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  Download,
  ChevronRight,
  Sparkles,
  Inbox,
  FileCheck,
  History,
  Flame,
  ArrowUpRight,
  Monitor,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";

export default function OfficerDashboardPage() {
  const router = useRouter();
  const { tickets, currentUser, login } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Switch to OF001 if needed
  useEffect(() => {
    if (currentUser.id !== "OF001") {
      login("OF001");
    }
  }, [currentUser.id, login]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Filter & Sort tickets (High priority always on top!)
  const filteredTickets = tickets
    .filter((t) => {
      // Search by ticket code or student name
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesCode = t.code.toLowerCase().includes(query);
        const matchesName = t.studentName.toLowerCase().includes(query);
        const matchesMssv = t.studentMssv.toLowerCase().includes(query);
        if (!matchesCode && !matchesName && !matchesMssv) return false;
      }

      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (typeFilter !== "all") {
        if (typeFilter === "L4" && !t.isL4) return false;
        if (typeFilter === "L2" && t.isL4) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // High priority first
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (b.priority === "high" && a.priority !== "high") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalInShift = tickets.length;
  const pendingOfficerCount = tickets.filter((t) => t.status === "pending_officer" || t.status === "open").length;
  const highPriorityCount = tickets.filter((t) => t.priority === "high").length;
  const resolvedTodayCount = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17] bg-dot-pattern transition-colors">
      <Navbar />

      <div className="max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left Officer Sidebar (matching Image 6) */}
        <aside className="w-full lg:w-64 flex flex-col gap-6 shrink-0">
          {/* Officer identity block */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center border border-blue-200 dark:border-blue-800">
                0F
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-white text-xs">
                  OF001 Cán bộ Học vụ
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Phòng Đào tạo &amp; CTSV
                </div>
              </div>
            </div>
          </div>

          {/* Navigation group: Quản lý tiếp nhận */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              QUẢN LÝ TIẾP NHẬN
            </div>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setTypeFilter("all");
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-md shadow-blue-500/20 text-left transition-all"
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                <span>Hàng chờ tiếp nhận</span>
              </div>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-white/20">
                {totalInShift}
              </span>
            </button>

            <Link
              href="/tickets/TKT-2026-0142"
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium text-xs text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-slate-400" />
                <span>Thẩm định hồ sơ L2/L4</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            <button
              type="button"
              onClick={() => setStatusFilter("resolved")}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium text-xs text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <span>Lịch sử xử lý &amp; Đã xong</span>
              </div>
            </button>
          </div>

          {/* Navigation group: Cảnh báo khẩn cấp */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
              CẢNH BÁO KHẨN CẤP
            </div>

            <button
              type="button"
              onClick={() => setPriorityFilter("high")}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-xs text-left hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>Hồ sơ Ưu tiên Cao</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold">
                {highPriorityCount}
              </span>
            </button>

            <Link
              href="/tickets/TKT-2026-0098"
              className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-medium transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Sự cố điểm thi L4</span>
            </Link>
          </div>

          {/* Bottom Sidebar Action */}
          <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <Link
              href="/chat"
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
            >
              <span>Chuyển sang Cổng Sinh viên</span>
              <ArrowUpRight className="w-4 h-4 text-blue-500" />
            </Link>

            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>AI Engine v4.2 · Sẵn sàng</span>
            </div>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 flex flex-col space-y-6 min-w-0">
          {/* Top Title & Action Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mb-1">
                <span>Phòng Đào tạo &amp; CTSV</span>
                <span>/</span>
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  Hàng chờ Xử lý Dịch Vụ Học vụ
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Hàng chờ Xử lý Dịch vụ Học vụ
              </h1>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                  OF001 Cán bộ Học vụ · Ca trực 08:00 - 17:00
                </span>
                <span>•</span>
                <span>Điều phối tiếp nhận, thẩm định hồ sơ sinh viên L2 &amp; quy trình giải quyết sự cố điểm thi L4</span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Làm mới hàng chờ</span>
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất báo cáo ca trực</span>
              </button>
            </div>
          </div>

          {/* 4 Metric Cards (Matching Image 6) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  TỔNG SỐ HỒ SƠ TRONG CA
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {totalInShift}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-500" />
                  <span>100% đồng bộ Cổng Đào tạo</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
                <Monitor className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  CHỜ CÁN BỘ THỤ LÝ
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {pendingOfficerCount}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Cần đối soát bảng điểm &amp; đơn</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    HỒ SƠ ƯU TIÊN CAO
                  </span>
                  <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold">
                    L4 CAP
                  </span>
                </div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  {highPriorityCount}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  <span>Gồm ca khiếu nại L4 v..</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  ĐÃ HOÀN TẤT TRONG NGÀY
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {resolvedTodayCount}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Đã cấp chứng thư số ký</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search, Filter Bar & Quick Shortcut Chips */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search */}
              <div className="md:col-span-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã ticket, tên SV..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Status Dropdown */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Trạng thái: Tất cả</option>
                  <option value="open">Mới tiếp nhận (Open)</option>
                  <option value="pending_officer">Chờ cán bộ (Pending)</option>
                  <option value="resolved">Đã hoàn tất (Resolved)</option>
                </select>
              </div>

              {/* Priority Dropdown */}
              <div>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Mức ưu tiên: Tất cả</option>
                  <option value="high">Ưu tiên Cao (L4 / Gấp)</option>
                  <option value="normal">Bình thường</option>
                </select>
              </div>

              {/* Type Dropdown */}
              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Loại nghiệp vụ: Tất cả</option>
                  <option value="L2">Dịch vụ L2 (Cấp giấy)</option>
                  <option value="L4">Dịch vụ L4 (Khiếu nại/Sự cố)</option>
                </select>
              </div>
            </div>

            {/* Quick Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <span className="text-slate-400 dark:text-slate-500 font-bold">
                PHÍM TẮT TÌM NHANH:
              </span>

              <button
                type="button"
                onClick={() => setSearchQuery("TKT-2026-0142")}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors font-mono"
              >
                ⚡ TKT-2026-0142 (Giấy xác nhận SV)
              </button>

              <button
                type="button"
                onClick={() => setSearchQuery("TKT-2026-0098")}
                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors font-mono"
              >
                🚨 TKT-2026-0098 (Khiếu nại L4)
              </button>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                  setTypeFilter("all");
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Tất cả hồ sơ ({totalInShift})
              </button>

              <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto hidden sm:inline-block">
                Nhấn phím tắt để kích hoạt bộ lọc trực quan
              </span>
            </div>
          </div>

          {/* Queue Table (matching Image 6 layout) */}
          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th className="py-3 px-4">MÃ HỒ SƠ</th>
                    <th className="py-3 px-4">SINH VIÊN</th>
                    <th className="py-3 px-4">NỘI DUNG YÊU CẦU / TÓM TẮT AI</th>
                    <th className="py-3 px-4">ƯU TIÊN</th>
                    <th className="py-3 px-4">TRẠNG THÁI</th>
                    <th className="py-3 px-4">THỜI GIAN / SLA</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredTickets.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/tickets/${t.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      {/* Code */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {t.code}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase mt-0.5">
                          {t.isL4 ? "DỊCH VỤ L4" : "DỊCH VỤ L2"}
                        </div>
                      </td>

                      {/* Student */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {t.studentName}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          MSSV: <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{t.studentMssv}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t.studentClassYear}
                        </div>
                      </td>

                      {/* AI Summary / Content */}
                      <td className="py-4 px-4 align-top max-w-md">
                        <div className="font-semibold text-slate-900 dark:text-white mb-1">
                          {t.title}
                        </div>

                        {t.isL4 ? (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                              <span>Lý do L4:</span>
                            </div>
                            <p className="leading-relaxed">
                              {t.priorityReason || t.l4TriggerReason}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 font-mono text-[9px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                              <Sparkles className="w-2.5 h-2.5" />
                              AI TÓM TẮT
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {t.purpose}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-4 px-4 align-top">
                        {t.priority === "high" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Ưu tiên Cao
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Bình thường
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                            t.status === "open"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : t.status === "pending_officer"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              t.status === "open"
                                ? "bg-blue-500"
                                : t.status === "pending_officer"
                                ? "bg-amber-500"
                                : "bg-indigo-500"
                            }`}
                          />
                          {t.status === "open"
                            ? "Mới tiếp nhận"
                            : t.status === "pending_officer"
                            ? "Chờ cán bộ"
                            : "Đã hoàn tất"}
                        </span>
                      </td>

                      {/* Time / SLA */}
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        <div className="font-mono text-slate-900 dark:text-white text-[11px]">
                          {t.submittedAt.split("·")[0]}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t.submittedAt.split("·")[1] || "24/10/2026"}
                        </div>
                        <div className="text-[10px] font-mono mt-1 font-semibold text-amber-600 dark:text-amber-400">
                          {t.status === "resolved" ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Đã giải quyết</span>
                          ) : (
                            `SLA: ${t.slaRemaining || t.slaDeadline}`
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Status Bar (matching Image 6) */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Hiển thị {filteredTickets.length} / {totalInShift} hồ sơ học vụ
                </span>
                <span>•</span>
                <span>Phân loại bởi Campus AI Ops Engine v4.2</span>
              </div>

              <div className="flex items-center gap-4">
                <span>Mật độ hiển thị: Cao (Compact)</span>
                <span>•</span>
                <span>Tự động làm mới mỗi 30s</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
