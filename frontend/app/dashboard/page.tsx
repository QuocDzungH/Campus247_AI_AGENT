"use client";

import React, { useState } from "react";
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
  FileSearch,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { StaffQueue } from "@/components/staff/StaffQueue";

export default function OfficerDashboardPage() { void PreviousOfficerDashboardPage; return <StaffQueue />; }

// Keep the previous surface available while migrating pre-existing workspace changes.
function PreviousOfficerDashboardPage() {
  const router = useRouter();
  const { tickets, currentUser, reviewCases, isDataLoading } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);

  if (isDataLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <Navbar />
        <LoadingState title="Đang tải Hàng chờ cán bộ..." description="Đang xác thực vai trò và đồng bộ hồ sơ." />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "officer") return <DataAccessState requiredRole="officer" />;

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
      return 0;
    });

  const paginatedTickets = filteredTickets.slice(0, visibleCount);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedTicketIds(paginatedTickets.map((t) => t.id));
    else setSelectedTicketIds([]);
  };

  const handleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTicketIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const totalInShift = tickets.length;
  const pendingOfficerCount = tickets.filter((t) => t.status === "pending_officer" || t.status === "open").length;
  const highPriorityCount = tickets.filter((t) => t.priority === "high").length;
  const resolvedTodayCount = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div className="min-h-screen flex flex-col bg-transparent transition-colors">
      <Navbar />

      <div className="max-w-[1440px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left Officer Sidebar (matching Image 6) */}
        <aside className="w-full lg:w-64 flex flex-col gap-6 shrink-0">
          {/* Officer identity block */}
          <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                CB
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-[13px]">
                  {currentUser?.name || "Cán bộ Học vụ"}
                </div>
                <div className="text-[12px] text-gray-500 dark:text-gray-400">
                  Phòng Đào tạo &amp; CTSV
                </div>
              </div>
            </div>
          </div>

          {/* Navigation group: Quản lý tiếp nhận */}
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Quản lý tiếp nhận
            </div>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setTypeFilter("all");
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-[13px] shadow-sm text-left transition-all"
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                <span>Hàng chờ tiếp nhận</span>
              </div>
              <span className="text-[12px] px-1.5 py-0.5 rounded bg-white/20">
                {totalInShift}
              </span>
            </button>

            <Link
              href="/reviews"
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium text-[13px] text-left transition-all"
            >
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4" />
                <span>Rà soát AI</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-semibold">
                {reviewCases.filter((r) => r.status !== "completed").length}
              </span>
            </Link>

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
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-red-500 dark:text-red-400">
              Khẩn cấp
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
              <span title="AI chỉ hỗ trợ tổng hợp; cán bộ vẫn là người quyết định cuối cùng.">
                AI hỗ trợ · Sẵn sàng
              </span>
            </div>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 flex flex-col space-y-6 min-w-0">
          {/* Top Title & Action Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Hàng chờ xử lý hồ sơ
              </h1>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
                Tiếp nhận và thẩm định hồ sơ sinh viên · Ca trực 08:00–17:00
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-[13px] font-medium text-gray-700 dark:text-gray-200 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Làm mới hàng chờ</span>
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất báo cáo ca trực</span>
              </button>
              <span className="sr-only" role="status" aria-live="polite">
                {isRefreshing ? "Đang làm mới hàng chờ" : ""}
              </span>
            </div>
          </div>

          {/* 4 Metric Cards (Matching Image 6) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Tổng hồ sơ
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalInShift}
                </div>
                <div className="text-[12px] text-gray-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-500" />
                  <span>Đồng bộ</span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <Monitor className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Chờ xử lý
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {pendingOfficerCount}
                </div>
                <div className="text-[12px] text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Cần đối soát</span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-[12px] font-medium text-red-600 dark:text-red-400">
                  Ưu tiên cao
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {highPriorityCount}
                </div>
                <div className="text-[12px] text-gray-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  <span>Gồm khiếu nại L4</span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Hoàn tất hôm nay
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {resolvedTodayCount}
                </div>
                <div className="text-[12px] text-gray-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Đã cấp chứng thư</span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Featured Module: Trợ lý AI rà soát hồ sơ công nhận học phần */}
          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white text-[14px]">
                  AI rà soát hồ sơ công nhận học phần
                </h2>
                <p className="text-[13px] text-gray-600 dark:text-gray-300 mt-0.5 max-w-2xl">
                  Đối chiếu đề cương, tín chỉ và nội dung môn học tự động.
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[12px] text-gray-500 dark:text-gray-400">
                  <span>{(reviewCases || []).filter((r) => r.status === "in_review").length} đang thẩm định</span>
                  <span>·</span>
                  <span>{(reviewCases || []).filter((r) => r.status === "waiting_supplement").length} chờ bổ sung</span>
                  <span>·</span>
                  <span>{(reviewCases || []).filter((r) => r.status === "completed").length} hoàn tất</span>
                </div>
              </div>
            </div>

            <Link
              href="/reviews"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[13px] shadow-sm transition-colors shrink-0 self-stretch md:self-auto justify-center"
            >
              <FileSearch className="w-4 h-4" />
              <span>Mở rà soát ({(reviewCases || []).length})</span>
            </Link>
          </div>


          {/* Search, Filter Bar & Quick Shortcut Chips */}
          <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search */}
              <div className="md:col-span-1 relative">
                <label htmlFor="ticket-search" className="sr-only">Tìm hồ sơ theo mã, tên hoặc mã sinh viên</label>
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="ticket-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã ticket, tên SV..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Status Dropdown */}
              <div>
                <label htmlFor="status-filter" className="sr-only">Lọc theo trạng thái</label>
                <select
                  id="status-filter"
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
                <label htmlFor="priority-filter" className="sr-only">Lọc theo mức ưu tiên</label>
                <select
                  id="priority-filter"
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
                <label htmlFor="type-filter" className="sr-only">Lọc theo loại nghiệp vụ</label>
                <select
                  id="type-filter"
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
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="space-y-3 p-3 md:hidden">
              {paginatedTickets.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Không có hồ sơ phù hợp"
                  description="Hãy thay đổi từ khóa hoặc bộ lọc để xem lại toàn bộ hàng chờ."
                />
              ) : paginatedTickets.map((t) => (
                <div
                  key={t.id}
                  className="w-full relative rounded-2xl border border-slate-200 bg-white/90 p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-blue-700"
                >
                  <div className="absolute top-4 right-4 z-10">
                    <input
                      type="checkbox"
                      aria-label={`Chọn hồ sơ ${t.code}`}
                      checked={selectedTicketIds.includes(t.id)}
                      onChange={() => handleSelectOne(t.id)}
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <Link href={`/tickets/${t.id}`} aria-label={`Mở hồ sơ ${t.code}: ${t.title}`} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                  <div className="flex items-start justify-between gap-3 pr-6">
                    <div>
                      <div className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">{t.code}</div>
                      <div className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{t.title}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">Sinh viên</div>
                      <div className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{t.studentName}</div>
                      <div className="font-mono text-slate-500">{t.studentMssv}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500 dark:text-slate-400">Thời hạn xử lý</div>
                      <div className={`mt-0.5 font-semibold ${t.status === "resolved" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"}`}>
                        {t.status === "resolved" ? "Đã giải quyết" : `SLA: ${t.slaRemaining || t.slaDeadline}`}
                      </div>
                    </div>
                  </div>
                  </Link>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-3.5 px-4 w-10">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả hồ sơ hàng chờ"
                        onChange={handleSelectAll}
                        checked={selectedTicketIds.length > 0 && selectedTicketIds.length === paginatedTickets.length}
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-4">MÃ HỒ SƠ</th>
                    <th className="py-3.5 px-4">SINH VIÊN</th>
                    <th className="py-3.5 px-4">NỘI DUNG YÊU CẦU / TÓM TẮT AI</th>
                    <th className="py-3.5 px-4">ƯU TIÊN</th>
                    <th className="py-3.5 px-4">TRẠNG THÁI</th>
                    <th className="py-3.5 px-4">THỜI GIAN / SLA</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-5">
                        <EmptyState
                          icon={Inbox}
                          title="Không có hồ sơ phù hợp"
                          description="Hãy thay đổi từ khóa hoặc bộ lọc để xem lại toàn bộ hàng chờ."
                          action={(
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery("");
                                setStatusFilter("all");
                                setPriorityFilter("all");
                                setTypeFilter("all");
                              }}
                              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                            >
                              Xóa bộ lọc
                            </button>
                          )}
                        />
                      </td>
                    </tr>
                  ) : paginatedTickets.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/tickets/${t.id}`)}
                      className="hover:bg-blue-50/70 dark:hover:bg-slate-800/60 focus-visible:bg-blue-50 dark:focus-visible:bg-slate-800 cursor-pointer transition-colors group"
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Chọn hồ sơ ${t.code}`}
                          checked={selectedTicketIds.includes(t.id)}
                          onChange={() => handleSelectOne(t.id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Code */}
                      <td className="py-4 px-4 align-top">
                        <Link
                          href={`/tickets/${t.id}`}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Mở hồ sơ ${t.code}: ${t.title}`}
                          className="block font-mono text-[13px] font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                        >
                          {t.code}
                        </Link>
                        <div className="text-[11px] text-gray-400 uppercase mt-0.5">
                          {t.isL4 ? "L4" : "L2"}
                        </div>
                      </td>

                      {/* Student */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-medium text-[13px] text-gray-900 dark:text-white">
                          {t.studentName}
                        </div>
                        <div className="text-[12px] text-gray-500 dark:text-gray-400">
                          {t.studentMssv}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t.studentClassYear}
                        </div>
                      </td>

                      {/* AI Summary / Content */}
                      <td className="py-4 px-4 align-top max-w-md">
                        <div className="font-medium text-[13px] text-gray-900 dark:text-white mb-1">
                          {t.title}
                        </div>

                        {t.isL4 ? (
                          <div className="mt-1 space-y-1 text-[11px]">
                            <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Lý do L4: {t.priorityReason || t.l4TriggerReason}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                              <Sparkles className="w-3 h-3" />
                              <span>AI Tóm tắt</span>
                            </div>
                            <p className="text-[12px] text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                              {t.purpose}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-4 px-4 align-top">
                        <PriorityBadge priority={t.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 align-top">
                        <StatusBadge status={t.status} />
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

            {/* Pagination Load More */}
            {visibleCount < filteredTickets.length && (
              <div className="p-4 flex justify-center border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setVisibleCount((v) => v + 10)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Tải thêm ({filteredTickets.length - visibleCount} hồ sơ)
                </button>
              </div>
            )}

            {/* Footer Status Bar (matching Image 6) */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-[12px] text-gray-400">
              <span>
                Hiển thị {filteredTickets.length} / {totalInShift} hồ sơ
              </span>
              <span>
                Tự động làm mới mỗi 30 giây
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Action Bar */}
      {selectedTicketIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex items-center gap-4 animate-fade-in">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            Đã chọn {selectedTicketIds.length} hồ sơ
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedTicketIds([])}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap transition-colors"
            >
              Bỏ chọn
            </button>
            <button
              onClick={() => {
                // Bulk action mock
                setSelectedTicketIds([]);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm whitespace-nowrap transition-colors"
              disabled
            >
              Đánh dấu Đã xong (Demo UI)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
