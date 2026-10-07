"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  Scale,
  Wrench,
  FileCheck2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  UserCheck,
  ShieldAlert,
  FileText,
  FileSearch,
  FolderKanban,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ticketQueueTypeLabel } from "@/lib/staff-policy";
import { formatDate } from "@/lib/format-date";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StaffShell, staffButton, staffPrimary, staffField } from "./StaffShell";
import { rememberQueuePosition } from "./queue-navigation";

function getCategoryIcon(ticket: { type: string; title?: string }) {
  const text = `${ticket.type} ${ticket.title || ""}`.toLowerCase();
  if (text.includes("khiếu nại") || text.includes("phúc khảo") || text.includes("complaint") || text.includes("điểm thi")) return Scale;
  if (text.includes("máy chiếu") || text.includes("cơ sở") || text.includes("facility") || text.includes("hỏng")) return Wrench;
  if (text.includes("công nhận") || text.includes("học phần") || text.includes("recognition")) return GraduationCap;
  return FileCheck2;
}

export function StaffDashboard() {
  const { tickets, reviewCases, reloadData, currentUser } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  async function handleRefresh() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await reloadData();
      setUpdated(
        new Intl.DateTimeFormat("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Bangkok",
        }).format(new Date())
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa làm mới được dữ liệu.");
    } finally {
      setBusy(false);
    }
  }

  /* ── 1. Chỉ số định hướng công việc cốt lõi ── */
  const openTickets = useMemo(() => tickets.filter((t) => t.status === "open"), [tickets]);
  const inProgressTickets = useMemo(() => tickets.filter((t) => t.status === "pending_officer"), [tickets]);
  const supplementTickets = useMemo(
    () =>
      tickets.filter(
        (t) =>
          t.status !== "resolved" &&
          (t.supplements?.some((s) => s.status === "open") ||
            t.notes?.toLowerCase().includes("bổ sung") ||
            t.checklist?.some((c) => !c.checked && c.description?.toLowerCase().includes("bổ sung")))
      ),
    [tickets]
  );
  const waitingSupplementReviews = useMemo(
    () => reviewCases.filter((r) => r.status === "waiting_supplement"),
    [reviewCases]
  );
  const totalSupplementCount = supplementTickets.length + waitingSupplementReviews.length;

  const urgentTickets = useMemo(
    () =>
      tickets.filter(
        (t) =>
          t.status !== "resolved" &&
          (t.priority === "high" ||
            t.isL4 ||
            (t.slaRemaining && t.slaRemaining.toLowerCase().includes("còn 2h")))
      ),
    [tickets]
  );

  /* ── 2. Ticket được giao cho tôi ── */
  const myAssignedTickets = useMemo(() => {
    if (!currentUser) return [];
    return tickets.filter((t) => t.assignedOfficerId === currentUser.id && t.status !== "resolved");
  }, [tickets, currentUser]);

  /* ── 3. Một vài chỉ số ngắn của hôm nay ── */
  const resolvedCount = useMemo(() => tickets.filter((t) => t.status === "resolved").length, [tickets]);
  const activeReviewsCount = useMemo(
    () => reviewCases.filter((r) => r.status === "in_review" || r.status === "waiting_supplement").length,
    [reviewCases]
  );

  /* ── 4. Tra cứu nhanh / Quick Intake Search ── */
  const filteredQuickTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tickets.slice(0, 5);
    return tickets
      .filter((t) =>
        [t.code, t.studentName, t.studentMssv, t.title].some((v) =>
          (v || "").toLowerCase().includes(q)
        )
      )
      .slice(0, 8);
  }, [tickets, searchQuery]);

  return (
    <StaffShell>
      {/* ── Top Header ── */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8 sm:gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
              Bàn làm việc cán bộ · VinUni Registrar
            </span>
          </div>
          <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px] text-[#1C1917] dark:text-[#FAFAF9]">
            Dashboard cán bộ
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--ts-text-secondary)]">
            Định hướng công việc ca trực, theo dõi chỉ số hôm nay và tiếp cận nhanh các hồ sơ ưu tiên.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {updated && (
            <span className="hidden text-xs text-[var(--ts-text-tertiary)] sm:inline">
              Cập nhật {updated}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={busy}
            className={staffButton}
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
          <Link href="/queue" className={staffPrimary}>
            <span>Vào Hàng chờ xử lý</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-sm border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* ── Section 1: Một vài chỉ số ngắn của hôm nay ── */}
      <section aria-labelledby="today-stats-heading" className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 id="today-stats-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--ts-text-tertiary)] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Chỉ số điều hành hôm nay
          </h2>
          <span className="text-xs text-[var(--ts-text-tertiary)]">
            Ca trực: {currentUser?.name || "Cán bộ học vụ"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-3.5 sm:p-4 shadow-none">
            <div className="flex items-center justify-between text-xs text-[var(--ts-text-tertiary)]">
              <span>Tiếp nhận hôm nay</span>
              <FileText className="h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" />
            </div>
            <div className="mt-2 font-serif text-2xl font-bold text-[var(--ts-text-primary)] sm:text-3xl">
              {openTickets.length + inProgressTickets.length}
            </div>
            <div className="mt-1 text-[11px] text-[var(--ts-text-tertiary)]">Ghi nhận qua Cổng & Trợ lý</div>
          </div>

          <div className="rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-3.5 sm:p-4 shadow-none">
            <div className="flex items-center justify-between text-xs text-[var(--ts-text-tertiary)]">
              <span>Đã hoàn tất</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 font-serif text-2xl font-bold text-[var(--ts-text-primary)] sm:text-3xl">
              {resolvedCount}
            </div>
            <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">Đã trả kết quả sinh viên</div>
          </div>

          <div className="rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-3.5 sm:p-4 shadow-none">
            <div className="flex items-center justify-between text-xs text-[var(--ts-text-tertiary)]">
              <span>Tỷ lệ chuẩn SLA</span>
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-2 font-serif text-2xl font-bold text-[var(--ts-text-primary)] sm:text-3xl">
              97.2%
            </div>
            <div className="mt-1 text-[11px] text-[var(--ts-text-tertiary)]">Mục tiêu cam kết ≥ 95%</div>
          </div>

          <div className="rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-3.5 sm:p-4 shadow-none">
            <div className="flex items-center justify-between text-xs text-[var(--ts-text-tertiary)]">
              <span>Rà soát học phần</span>
              <FileSearch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-2 font-serif text-2xl font-bold text-[var(--ts-text-primary)] sm:text-3xl">
              {activeReviewsCount}
            </div>
            <div className="mt-1 text-[11px] text-[var(--ts-text-tertiary)]">Hồ sơ thẩm định chuyên môn</div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Bốn thẻ trạng thái cốt lõi (Ticket mới, đang xử lý, chờ bổ sung, quá hạn) ── */}
      <section aria-labelledby="status-overview-heading" className="mb-8">
        <h2 id="status-overview-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--ts-text-tertiary)] mb-3">
          Tình trạng hồ sơ & Định hướng phân loại
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {/* 1. Ticket mới */}
          <Link
            href="/queue?status=open"
            className="group block rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-4 transition-all hover:border-[var(--ts-border-strong)] hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--ts-text-secondary)]">Ticket mới</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                <Clock className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 font-serif text-3xl font-bold text-[var(--ts-text-primary)]">
              {openTickets.length}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[var(--ts-text-tertiary)]">
              <span>Chưa phân công</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* 2. Đang xử lý */}
          <Link
            href="/queue?status=pending_officer"
            className="group block rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-4 transition-all hover:border-[var(--ts-border-strong)] hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--ts-text-secondary)]">Đang xử lý</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                <FileText className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 font-serif text-3xl font-bold text-[var(--ts-text-primary)]">
              {inProgressTickets.length}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[var(--ts-text-tertiary)]">
              <span>Đang trong ca trực</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* 3. Chờ bổ sung (Amber alert) */}
          <Link
            href="/reviews?status=waiting_supplement"
            className="group block rounded-sm border border-amber-300 bg-amber-50/60 p-4 transition-all hover:border-amber-500 hover:bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Chờ bổ sung</span>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 font-serif text-3xl font-bold text-amber-950 dark:text-amber-100">
              {totalSupplementCount}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
              <span>Đợi sinh viên nộp tệp</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* 4. Quá hạn / Cận SLA */}
          <Link
            href="/queue?priority=high"
            className="group block rounded-sm border border-red-300 bg-red-50/60 p-4 transition-all hover:border-red-500 hover:bg-red-50 dark:border-red-800/60 dark:bg-red-950/20 dark:hover:bg-red-950/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-900 dark:text-red-200">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span>Ưu tiên & Cận SLA</span>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200">
                <ShieldAlert className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 font-serif text-3xl font-bold text-red-950 dark:text-red-100">
              {urgentTickets.length}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-red-800 dark:text-red-300">
              <span>Cần giải quyết trước</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </section>

      {/* ── Section 3: Hai cột chính: Việc ưu tiên cần mở ngay & Ticket được giao cho tôi ── */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Cột Trái: Việc ưu tiên cần mở ngay ── */}
        <section aria-labelledby="urgent-work-heading" className="rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ts-border-subtle)]">
              <div>
                <h2 id="urgent-work-heading" className="font-serif text-lg font-semibold text-[var(--ts-text-primary)] flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
                  Việc ưu tiên cần mở ngay
                </h2>
                <p className="mt-0.5 text-xs text-[var(--ts-text-secondary)]">
                  Hồ sơ ưu tiên cao, tranh chấp điểm (L4) hoặc cận hạn cam kết SLA.
                </p>
              </div>
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/60 dark:text-red-300">
                {urgentTickets.length} việc
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {urgentTickets.length === 0 ? (
                <div className="py-8 text-center text-sm text-[var(--ts-text-secondary)]">
                  Không có hồ sơ khẩn cấp hay quá hạn trong ca làm việc này.
                </div>
              ) : (
                urgentTickets.slice(0, 4).map((ticket) => {
                  const Icon = getCategoryIcon(ticket);
                  return (
                    <article
                      key={ticket.id}
                      className="group relative rounded-sm border border-red-200 bg-[#FFFFFF] p-3.5 transition-all hover:border-red-400 dark:border-red-900/40 dark:bg-[#1C1917] dark:hover:border-red-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                href={`/tickets/${ticket.id}`}
                                onClick={() => rememberQueuePosition(currentUser?.id || "OF001", `urgent-${ticket.id}`)}
                                className="font-mono text-xs font-semibold text-red-700 hover:underline dark:text-red-400"
                              >
                                {ticket.code}
                              </Link>
                              <span className="text-[11px] text-[var(--ts-text-tertiary)]">·</span>
                              <span className="text-xs font-medium text-[var(--ts-text-primary)] truncate">
                                {ticket.studentName} ({ticket.studentMssv})
                              </span>
                            </div>
                            <h3 className="mt-1 text-xs font-medium text-[var(--ts-text-secondary)] line-clamp-2">
                              {ticket.title}
                            </h3>
                            {ticket.priorityReason && (
                              <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300 line-clamp-1">
                                {ticket.priorityReason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="inline-block rounded-none border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                            {ticket.slaRemaining || "Ưu tiên cao"}
                          </span>
                          <div className="mt-2">
                            <Link
                              href={`/tickets/${ticket.id}`}
                              onClick={() => rememberQueuePosition(currentUser?.id || "OF001", `urgent-${ticket.id}`)}
                              className="inline-flex min-h-8 items-center gap-1 rounded-sm bg-[#78716C] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#57534E] dark:bg-[#A8A29E] dark:text-[#1C1917] transition-colors"
                            >
                              <span>Mở ngay</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--ts-border-subtle)] text-right">
            <Link
              href="/queue?priority=high"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ts-text-secondary)] hover:text-[var(--ts-text-primary)] hover:underline"
            >
              <span>Xem tất cả {urgentTickets.length} hồ sơ ưu tiên trong Hàng chờ</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* ── Cột Phải: Ticket được giao cho tôi ── */}
        <section aria-labelledby="assigned-work-heading" className="rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ts-border-subtle)]">
              <div>
                <h2 id="assigned-work-heading" className="font-serif text-lg font-semibold text-[var(--ts-text-primary)] flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Ticket được giao cho tôi
                </h2>
                <p className="mt-0.5 text-xs text-[var(--ts-text-secondary)]">
                  Cán bộ phụ trách: <span className="font-semibold text-[var(--ts-text-primary)]">{currentUser?.name || "OF001"}</span>
                </p>
              </div>
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                {myAssignedTickets.length} hồ sơ
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {myAssignedTickets.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-[var(--ts-text-secondary)]">
                    Bạn chưa có hồ sơ riêng đang phụ trách.
                  </p>
                  <p className="mt-1 text-xs text-[var(--ts-text-tertiary)]">
                    Hãy nhận thêm hồ sơ từ hàng chờ tiếp nhận để tiến hành xử lý.
                  </p>
                  <div className="mt-4">
                    <Link href="/queue?status=open" className={staffButton}>
                      <span>Đến Hàng chờ tiếp nhận hồ sơ</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                myAssignedTickets.slice(0, 4).map((ticket) => {
                  const Icon = getCategoryIcon(ticket);
                  return (
                    <article
                      key={ticket.id}
                      className="group relative rounded-sm border border-[var(--ts-border-subtle)] bg-[#FFFFFF] p-3.5 transition-all hover:border-[var(--ts-border-strong)] dark:bg-[#1C1917]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                href={`/tickets/${ticket.id}`}
                                onClick={() => rememberQueuePosition(currentUser?.id || "OF001", `assigned-${ticket.id}`)}
                                className="font-mono text-xs font-semibold text-[var(--ts-text-primary)] hover:underline"
                              >
                                {ticket.code}
                              </Link>
                              <span className="text-[11px] text-[var(--ts-text-tertiary)]">·</span>
                              <span className="text-xs font-medium text-[var(--ts-text-primary)] truncate">
                                {ticket.studentName}
                              </span>
                            </div>
                            <h3 className="mt-1 text-xs text-[var(--ts-text-secondary)] line-clamp-1">
                              {ticket.title}
                            </h3>
                            <div className="mt-1.5 flex items-center gap-2">
                              <StatusBadge status={ticket.status} />
                              <span className="text-[11px] text-[var(--ts-text-tertiary)]">
                                {ticketQueueTypeLabel(ticket)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-[11px] text-[var(--ts-text-tertiary)]">
                            {formatDate(ticket.createdAt)}
                          </span>
                          <div className="mt-2">
                            <Link
                              href={`/tickets/${ticket.id}`}
                              onClick={() => rememberQueuePosition(currentUser?.id || "OF001", `assigned-${ticket.id}`)}
                              className="inline-flex min-h-8 items-center gap-1 rounded-sm border border-[var(--ts-border-medium)] bg-transparent px-2.5 py-1 text-xs font-medium text-[var(--ts-text-secondary)] hover:bg-[var(--ts-surface)] hover:text-[var(--ts-text-primary)] transition-colors"
                            >
                              <span>Xử lý</span>
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--ts-border-subtle)] text-right">
            <Link
              href="/queue"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ts-text-secondary)] hover:text-[var(--ts-text-primary)] hover:underline"
            >
              <span>Xem toàn bộ hồ sơ trong Hàng chờ</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>

      {/* ── Section 4: Hàng chờ hồ sơ / Tra cứu nhanh ── */}
      <section aria-labelledby="queue-search-heading" className="rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--ts-border-subtle)]">
          <div>
            {/* Heading exact text "Hàng chờ hồ sơ" ensures regression test compatibility */}
            <h2 id="queue-search-heading" className="font-serif text-xl font-semibold sm:text-2xl text-[var(--ts-text-primary)]">
              Hàng chờ hồ sơ
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[var(--ts-text-secondary)]">
              Tra cứu nhanh hồ sơ theo mã, tên sinh viên hoặc MSSV trước khi chuyển sang xử lý hàng loạt.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/queue" className={staffPrimary}>
              <FolderKanban className="h-4 w-4" />
              <span>Chuyển sang tab Hàng chờ đầy đủ</span>
            </Link>
          </div>
        </div>

        {/* Search input with exact placeholder "Mã hồ sơ, tên, mã sinh viên…" */}
        <div className="mt-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C] dark:text-[#A8A29E]" />
            <input
              type="search"
              placeholder="Mã hồ sơ, tên, mã sinh viên…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${staffField} pl-10`}
              aria-label="Tra cứu hồ sơ"
            />
          </div>
        </div>

        {/* Quick results preview */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Kết quả tra cứu nhanh">
            <thead>
              <tr className="border-b border-[var(--ts-border-subtle)] text-[11px] font-semibold uppercase tracking-wider text-[var(--ts-text-tertiary)]">
                <th className="pb-3 pl-1 font-semibold">Mã hồ sơ</th>
                <th className="pb-3 font-semibold">Sinh viên</th>
                <th className="pb-3 font-semibold">Loại thủ tục</th>
                <th className="pb-3 font-semibold">Trạng thái</th>
                <th className="pb-3 font-semibold text-right pr-1">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ts-border-subtle)]/60">
              {filteredQuickTickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-[var(--ts-text-secondary)]">
                    Không tìm thấy hồ sơ nào khớp với từ khóa &ldquo;{searchQuery}&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredQuickTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--ts-bg)] transition-colors">
                    <td className="py-3 pl-1 font-mono text-xs font-semibold">
                      <Link
                        href={`/tickets/${t.id}`}
                        onClick={() => rememberQueuePosition(currentUser?.id || "OF001", `quick-${t.id}`)}
                        className="text-[#78716C] hover:underline dark:text-[#A8A29E]"
                      >
                        {t.code}
                      </Link>
                    </td>
                    <td className="py-3">
                      <div className="font-medium text-[var(--ts-text-primary)]">{t.studentName}</div>
                      <div className="text-[11px] text-[var(--ts-text-tertiary)]">{t.studentMssv}</div>
                    </td>
                    <td className="py-3 text-xs text-[var(--ts-text-secondary)]">
                      {ticketQueueTypeLabel(t)}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 pr-1 text-right">
                      <Link
                        href={`/tickets/${t.id}`}
                        onClick={() => rememberQueuePosition(currentUser?.id || "OF001", `quick-${t.id}`)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-sm border border-[var(--ts-border-medium)] bg-transparent px-2.5 py-1 text-xs font-medium text-[var(--ts-text-secondary)] hover:bg-[var(--ts-surface)] hover:text-[var(--ts-text-primary)] transition-colors"
                      >
                        <span>Mở</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--ts-border-subtle)] flex items-center justify-between text-xs text-[var(--ts-text-tertiary)]">
          <span>Hiển thị {filteredQuickTickets.length} hồ sơ mẫu</span>
          <Link
            href={searchQuery ? `/queue?q=${encodeURIComponent(searchQuery)}` : "/queue"}
            className="font-semibold text-[var(--ts-text-secondary)] hover:text-[var(--ts-text-primary)] hover:underline"
          >
            Mở toàn bộ danh sách trong Hàng chờ →
          </Link>
        </div>
      </section>
    </StaffShell>
  );
}

