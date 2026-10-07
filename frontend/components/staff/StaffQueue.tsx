"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search, Clock, AlertTriangle, CheckCircle2, GraduationCap, Scale, Wrench, FileCheck2, LayoutDashboard } from "lucide-react";
import { useStore } from "@/lib/store";
import { filterTickets, ticketQueueTypeLabel, ticketTypeLabels } from "@/lib/staff-policy";
import { formatDate } from "@/lib/format-date";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StaffShell, staffButton, staffField, staffSurface } from "./StaffShell";
import { queuePosition, rememberQueuePosition } from "./queue-navigation";

function getTicketCategoryIcon(ticket: { type: string; title?: string }) {
  const text = `${ticket.type} ${ticket.title || ""}`.toLowerCase();
  if (text.includes("khiếu nại") || text.includes("phúc khảo") || text.includes("complaint") || text.includes("điểm thi")) return Scale;
  if (text.includes("máy chiếu") || text.includes("cơ sở") || text.includes("facility") || text.includes("hỏng")) return Wrench;
  if (text.includes("công nhận") || text.includes("học phần") || text.includes("recognition")) return GraduationCap;
  return FileCheck2;
}

export function StaffQueue() {
  const { tickets, reloadData, currentUser } = useStore();
  const [filters, setFilters] = useState({ q: "", status: "active", priority: "all", type: "all", page: 1 });
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");

  useEffect(() => {
    const read = () => {
      const p = new URLSearchParams(window.location.search);
      setFilters({
        q: p.get("q") || "",
        status: ["all", "active", "open", "pending_officer", "resolved"].includes(p.get("status") || "") ? p.get("status")! : "active",
        priority: p.get("priority") === "high" ? "high" : "all",
        type: Object.keys(ticketTypeLabels).includes(p.get("type") || "") ? p.get("type")! : "all",
        page: Math.max(1, Number(p.get("page")) || 1),
      });
      setHydrated(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  function change(next: Partial<typeof filters>) {
    const value = { ...filters, ...next, page: next.page ?? 1 };
    setFilters(value);
    const p = new URLSearchParams();
    Object.entries(value).forEach(([key, val]) => p.set(key, String(val)));
    const path = typeof window !== "undefined" ? window.location.pathname : "/queue";
    const url = `${path}?${p}`;
    if (url !== window.location.pathname + window.location.search) {
      if (Object.keys(next).length === 1 && "q" in next) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    }
  }

  const result = filterTickets(tickets, filters.q, filters.status, filters.priority, filters.type);
  const pages = Math.max(1, Math.ceil(result.length / 20));
  const page = Math.min(pages, Math.floor(filters.page));
  const visible = result.slice((page - 1) * 20, page * 20);

  useEffect(() => {
    if (!hydrated || !Number.isFinite(page)) return;
    if (filters.page !== page) {
      const params = new URLSearchParams(window.location.search);
      params.set("page", String(page));
      const path = typeof window !== "undefined" ? window.location.pathname : "/queue";
      window.history.replaceState(null, "", `${path}?${params}`);
    }
  }, [hydrated, filters.page, page]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;
    const saved = queuePosition(currentUser.id);
    if (!saved || saved.url !== window.location.pathname + window.location.search) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(saved.focusId)?.focus({ preventScroll: true });
      window.scrollTo({ top: saved.scrollY });
    });
    return () => cancelAnimationFrame(frame);
  }, [hydrated, currentUser]);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await reloadData();
      setUpdated(new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa làm mới được. Kết quả trước đó được giữ lại.");
    } finally {
      setBusy(false);
    }
  }

  const allCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === "open").length;
  const highPriorityCount = tickets.filter((t) => t.status !== "resolved" && t.priority === "high").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;

  return (
    <StaffShell>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8 sm:gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
              Bàn làm việc cán bộ · VinUni Registrar
            </span>
          </div>
          <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px] text-[#1C1917] dark:text-[#FAFAF9]">
            Hàng chờ hồ sơ
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ts-text-secondary)]">
            Tiếp nhận, kiểm tra dữ liệu và phản hồi kết quả cho sinh viên.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updated && (
            <span role="status" className="flex items-center gap-1.5 text-xs text-[#78716C] dark:text-[#A8A29E]">
              <Clock className="h-3.5 w-3.5" />
              Đã làm mới {updated}
            </span>
          )}
          <button
            onClick={() => void refresh()}
            disabled={busy}
            className={`${staffButton} transition-colors hover:border-[#78716C] dark:hover:border-[#A8A29E]`}
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Đang làm mới…" : "Làm mới"}
          </button>
        </div>
      </header>

      <div
        role="group"
        aria-label="Phạm vi hàng chờ"
        className="mb-6 grid grid-cols-2 rounded-sm border border-[#E7E5E4] bg-[#FFFFFF] dark:border-[#292524] dark:bg-[#1C1917] sm:mb-8 sm:grid-cols-4"
      >
        {[
          { label: "Tất cả hồ sơ", count: allCount, status: "all", priority: "all", Icon: LayoutDashboard },
          { label: "Mới tiếp nhận", count: openCount, status: "open", priority: "all", Icon: Clock },
          { label: "Ưu tiên cao", count: highPriorityCount, status: "active", priority: "high", isHigh: true, Icon: AlertTriangle },
          { label: "Đã hoàn tất", count: resolvedCount, status: "resolved", priority: "all", Icon: CheckCircle2 },
        ].map((item, index) => {
          const active = filters.status === item.status && filters.priority === item.priority;
          const isHighAlert = item.isHigh && item.count > 0;
          const isZeroCompleted = item.status === "resolved" && item.count === 0;
          const Icon = item.Icon;
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={active}
              onClick={() => change({ status: item.status, priority: item.priority })}
              className={`group relative flex min-h-20 items-center justify-between gap-3 border-[#E7E5E4] p-4 text-left transition-all duration-150 hover:bg-[#F5F5F4] active:bg-[#E7E5E4] dark:border-[#292524] dark:hover:bg-[#23201D] sm:min-h-24 sm:p-5 ${
                index < 2 ? "border-b sm:border-b-0" : ""
              } ${index % 2 === 0 ? "border-r" : "sm:border-r"} ${index === 3 ? "sm:border-r-0" : ""} ${
                active ? "bg-[#F5F5F4]/70 dark:bg-[#23201D]/70" : ""
              } ${
                isHighAlert ? "!border-amber-300 !bg-amber-50/60 dark:!border-amber-800/60 dark:!bg-amber-950/25" : ""
              }`}
            >
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C1917] dark:bg-[#FAFAF9]" aria-hidden="true" />
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${
                    isHighAlert ? "text-amber-900 dark:text-amber-300" : "text-[#78716C] dark:text-[#A8A29E]"
                  }`}>{item.label}</p>
                  {isHighAlert && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900/50 animate-pulse" aria-hidden="true" />
                  )}
                </div>
                <p className={`mt-2 font-serif text-3xl font-medium leading-none tabular-nums sm:text-4xl ${
                  isHighAlert
                    ? "text-amber-900 dark:text-amber-200 font-semibold"
                    : isZeroCompleted
                    ? "text-[#A8A29E] dark:text-[#78716C]"
                    : "text-[#1C1917] dark:text-[#FAFAF9]"
                }`}>{item.count}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                active
                  ? "border-[#1C1917] bg-[#1C1917] text-[#FAFAF9] dark:border-[#FAFAF9] dark:bg-[#FAFAF9] dark:text-[#1C1917]"
                  : isHighAlert
                  ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800/80 dark:bg-amber-900/40 dark:text-amber-200"
                  : "border-[#E7E5E4] bg-[#FAFAF9] text-[#78716C] dark:border-[#2E2A27] dark:bg-[#201D1A] dark:text-[#A8A29E] group-hover:border-[#D6D3D1] dark:group-hover:border-[#383533]"
              }`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
            </button>
          );
        })}
      </div>

      <section className={`${staffSurface} overflow-hidden shadow-xs`} aria-label="Danh sách hồ sơ">
        <div className="grid gap-3 border-b border-[var(--ts-border-subtle)] p-3.5 md:grid-cols-[minmax(240px,1fr)_190px_180px_160px]">
          <label className="relative">
            <span className="sr-only">Tìm mã hồ sơ, tên, mã sinh viên</span>
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" />
            <input
              className={`${staffField} min-h-11 pl-10`}
              value={filters.q}
              onChange={(e) => change({ q: e.target.value })}
              placeholder="Mã hồ sơ, tên, mã sinh viên…"
            />
          </label>
          <select
            aria-label="Loại yêu cầu"
            className={`${staffField} min-h-11`}
            value={filters.type}
            onChange={(e) => change({ type: e.target.value })}
          >
            <option value="all">Mọi loại yêu cầu</option>
            {Object.entries(ticketTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Trạng thái hồ sơ"
            className={`${staffField} min-h-11`}
            value={filters.status}
            onChange={(e) => change({ status: e.target.value })}
          >
            <option value="active">Chưa hoàn tất</option>
            <option value="all">Mọi trạng thái</option>
            <option value="open">Mới tiếp nhận</option>
            <option value="pending_officer">Chờ xử lý</option>
            <option value="resolved">Hoàn tất</option>
          </select>
          <select
            aria-label="Mức ưu tiên"
            className={`${staffField} min-h-11`}
            value={filters.priority}
            onChange={(e) => change({ priority: e.target.value })}
          >
            <option value="all">Mọi mức ưu tiên</option>
            <option value="high">Ưu tiên cao</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="border-b border-[var(--ts-border-subtle)] bg-red-50/50 p-3 text-sm text-[#B91C1C] dark:bg-red-950/20 dark:text-[#EF4444]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between border-b border-[var(--ts-border-subtle)] bg-[#FAF9F8] px-4 py-2 text-xs text-[#78716C] dark:bg-[#1C1917]/70 dark:text-[#A8A29E]">
          <span className="tabular-nums">
            {result.length} hồ sơ · sắp xếp: ưu tiên cao trước, nhận lâu trước
          </span>
          <button
            className="text-[#57534E] hover:underline dark:text-[#D6D3D1]"
            onClick={() => change({ q: "", type: "all", status: "active", priority: "all" })}
          >
            Đặt lại bộ lọc
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--ts-border-subtle)] bg-[#F5F5F4] text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:bg-[#1C1917] dark:text-[#A8A29E]">
              <tr>
                {["Hồ sơ", "Sinh viên", "Nội dung yêu cầu", "Trạng thái", "Ưu tiên", "Tiếp nhận"].map((label) => (
                  <th scope="col" key={label} className="px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ts-border-subtle)]">
              {visible.map((ticket) => {
                const CategoryIcon = getTicketCategoryIcon(ticket);
                return (
                <tr
                  key={ticket.id}
                  className="align-top transition-colors hover:bg-[#F5F5F4]/80 dark:hover:bg-[#292524]/50"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#E7E5E4] bg-[#F5F5F4] text-[#57534E] dark:border-[#383533] dark:bg-[#292524] dark:text-[#D6D3D1]">
                        <CategoryIcon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <Link
                          id={`queue-ticket-${ticket.id}`}
                          onClick={() => currentUser && rememberQueuePosition(currentUser.id, `queue-ticket-${ticket.id}`)}
                          href={`/tickets/${encodeURIComponent(ticket.id)}`}
                          className="inline-block max-w-[200px] break-all line-clamp-1 font-mono text-xs font-semibold text-[#1C1917] underline decoration-[#A8A29E] underline-offset-2 hover:decoration-[#1C1917] dark:text-[#FAFAF9] dark:decoration-[#78716C] dark:hover:decoration-[#FAFAF9]"
                        >
                          {ticket.code}
                        </Link>
                        <p className="mt-0.5 text-xs text-[#78716C] dark:text-[#A8A29E]">
                          {ticketQueueTypeLabel(ticket)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="whitespace-nowrap font-medium text-[#1C1917] dark:text-[#FAFAF9]">
                      {ticket.studentName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[#78716C] dark:text-[#A8A29E]">
                      {ticket.studentMssv}
                    </p>
                  </td>
                  <td className="max-w-md px-4 py-3.5">
                    <Link
                      onClick={() => currentUser && rememberQueuePosition(currentUser.id, `queue-ticket-${ticket.id}`)}
                      href={`/tickets/${encodeURIComponent(ticket.id)}`}
                      className="line-clamp-2 text-[#3A3532] hover:text-[#1C1917] dark:text-[#D6D3D1] dark:hover:text-[#FAFAF9]"
                    >
                      {ticket.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    {ticket.priority === "high" ? (
                      <span
                        title={ticket.priorityReason}
                        className="inline-flex items-center gap-1.5 rounded-sm border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                      >
                        <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        Ưu tiên cao
                      </span>
                    ) : (
                      <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">Bình thường</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-[#78716C] dark:text-[#A8A29E]">
                    {formatDate(ticket.createdAt, "Asia/Bangkok")}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>

        {hydrated && !result.length && (
          <div className="p-12 text-center">
            <h2 className="font-serif text-lg font-normal text-[#1C1917] dark:text-[#FAFAF9]">
              {tickets.length ? "Không có hồ sơ khớp bộ lọc" : "Chưa có hồ sơ"}
            </h2>
            <p className="mt-2 text-sm text-[#78716C] dark:text-[#A8A29E]">
              {tickets.length
                ? "Thử tìm từ khóa khác hoặc đặt lại bộ lọc để xem toàn bộ hàng chờ."
                : "Hồ sơ mới sẽ xuất hiện khi sinh viên gửi yêu cầu."}
            </p>
          </div>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--ts-border-subtle)] bg-[#FAF9F8] p-3.5 text-xs text-[#78716C] dark:bg-[#1C1917]/70 dark:text-[#A8A29E]">
          <span className="tabular-nums">
            {result.length ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, result.length)}` : "0"} / {result.length} hồ sơ
          </span>
          <div className="flex items-center gap-3">
            <button
              className={staffButton}
              disabled={page === 1}
              onClick={() => change({ page: page - 1 })}
            >
              Trước
            </button>
            <span className="tabular-nums">
              Trang {page}/{pages}
            </span>
            <button
              className={staffButton}
              disabled={page === pages}
              onClick={() => change({ page: page + 1 })}
            >
              Sau
            </button>
          </div>
        </footer>
      </section>
    </StaffShell>
  );
}
