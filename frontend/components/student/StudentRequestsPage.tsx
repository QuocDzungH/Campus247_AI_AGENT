"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, Clock3, FileCheck2, FileText, GraduationCap, Inbox, Plus, Scale, Search, TriangleAlert, Wrench, X } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { useStore } from "@/lib/store";
import { collectRequests, filterRequests, normalizeFilter, type RequestItem, type RequestState } from "@/lib/my-requests";
import { formatDate } from "@/lib/format-date";
import { RequestDetail, RequestStatus } from "./RequestDetail";
import { fieldClass, primaryButton, secondaryButton } from "./StudentFlowUI";

const baseFilters: Array<["all" | RequestState, string]> = [["all", "Tất cả"], ["new", "Mới nộp"], ["processing", "Đang xử lý"], ["supplement", "Cần bổ sung"], ["completed", "Hoàn tất"], ["draft", "Bản nháp"]];

function getRequestRowIcon(item: RequestItem): "review" | "complaint" | "service" | "document" {
  if (item.kind === "review") return "review";
  const text = `${item.title} ${item.type}`.toLowerCase();
  if (text.includes("khiếu nại") || text.includes("phúc khảo") || text.includes("điểm thi")) return "complaint";
  if (text.includes("máy chiếu") || text.includes("hỏng") || text.includes("phòng") || text.includes("cơ sở")) return "service";
  return "document";
}

function RequestRow({ item, compact, selected, localOnly, onSelect }: {
  item: RequestItem; compact: boolean; selected: boolean; localOnly: boolean; onSelect: () => void;
}) {
  const icon = getRequestRowIcon(item);
  return <button
    id={`request-${item.kind}-${item.id}`}
    type="button"
    aria-current={selected ? "true" : undefined}
    onClick={onSelect}
    className={`group relative w-full p-4 text-left transition-colors sm:px-5 ${selected ? "bg-[#FFFFFF] dark:bg-[#1C1917] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#1C1917] dark:before:bg-[#FAFAF9]" : "bg-[#FFFFFF] hover:bg-[#FAF9F7] dark:bg-[#1C1917] dark:hover:bg-[#23201D]"}`}
  >
    {compact ? <>
      <div className="mb-2.5 flex items-center justify-between gap-2"><RequestStatus item={item} localOnly={localOnly} /><ChevronRight className="h-4 w-4 shrink-0 text-[#A8A29E] transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></div>
      <h3 className="break-words text-sm font-semibold leading-snug text-[#1C1917] dark:text-[#FAFAF9]">{item.title}</h3>
      <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">{item.type}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#78716C] dark:text-[#A8A29E]"><span className="break-all font-mono font-medium text-[#1C1917] dark:text-[#FAFAF9]">{item.code}</span><span>·</span><span className="font-mono">{formatDate(item.submittedAt)}</span></div>
    </> : <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-[minmax(0,1fr)_200px_180px_20px] lg:gap-6">
      <div className="flex min-w-0 items-start gap-3.5 pr-6 sm:gap-4 lg:pr-0">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#E7E5E4] bg-[#F5F5F4] text-[#57534E] transition-colors group-hover:border-[#78716C] group-hover:bg-[#1C1917] group-hover:text-[#FAFAF9] dark:border-[#383533] dark:bg-[#292524] dark:text-[#D6D3D1] dark:group-hover:border-[#A8A29E] dark:group-hover:bg-[#FAFAF9] dark:group-hover:text-[#1C1917]">
          {icon === "review" ? <GraduationCap className="h-4.5 w-4.5" aria-hidden="true" /> : icon === "complaint" ? <Scale className="h-4.5 w-4.5" aria-hidden="true" /> : icon === "service" ? <Wrench className="h-4.5 w-4.5" aria-hidden="true" /> : <FileCheck2 className="h-4.5 w-4.5" aria-hidden="true" />}
        </span>
        <div className="min-w-0"><h3 className="break-words text-[15px] font-semibold leading-snug text-[#1C1917] transition-colors group-hover:text-[#57534E] dark:text-[#FAFAF9] dark:group-hover:text-[#D6D3D1]">{item.title}</h3><p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">{item.type}</p>{item.state === "supplement" && <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />Cần bạn bổ sung thông tin hoặc tài liệu</p>}</div>
      </div>
      <div className="pl-[54px] text-xs leading-6 text-[#78716C] dark:text-[#A8A29E] sm:pl-0"><p className="break-all font-mono font-medium text-[#1C1917] dark:text-[#FAFAF9]">{item.code}</p><p className="font-mono">{formatDate(item.submittedAt)}</p></div>
      <div className="pl-[54px] sm:col-span-2 sm:pl-[56px] lg:col-span-1 lg:pl-0"><RequestStatus item={item} localOnly={localOnly} /></div>
      <ChevronRight className="absolute right-4 top-5 h-4 w-4 text-[#A8A29E] transition-transform group-hover:translate-x-1 group-hover:text-[#1C1917] dark:group-hover:text-[#FAFAF9] lg:static" aria-hidden="true" />
    </div>}
  </button>;
}

const selectionEvent = "campus-requests-navigation";
function subscribeToSelection(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(selectionEvent, notify);
  return () => { window.removeEventListener("popstate", notify); window.removeEventListener(selectionEvent, notify); };
}
const readSelection = () => window.location.search;
const serverSelection = () => "";

export function RequestsLoading() {
  return <div className="thoughtstream-theme min-h-screen bg-[var(--ts-bg)] text-[var(--ts-text-primary)]"><Navbar /><main className="mx-auto max-w-3xl px-5 py-12"><h1 className="font-serif text-2xl font-bold">Hồ sơ của tôi</h1><p role="status" className="mt-4 text-[#57534E] dark:text-[#A8A29E]">Đang tải hồ sơ…</p></main></div>;
}

export function RequestsLoadError({ retry, retrying = false }: { retry: () => void; retrying?: boolean }) {
  return <section className="rounded-none border border-red-300 bg-red-50/50 p-6 dark:border-red-900/60 dark:bg-red-950/20" aria-labelledby="requests-error-title">
    <h2 id="requests-error-title" className="font-serif text-xl font-bold">Chưa tải được hồ sơ</h2>
    <p role="alert" className="mt-3 text-base leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">Không thể xác định danh sách hoặc trạng thái mới nhất lúc này. Điều này không có nghĩa hồ sơ của bạn bị mất. Hãy thử tải lại.</p>
    <button type="button" disabled={retrying} onClick={retry} className={`${primaryButton} mt-5`}>{retrying ? "Đang tải…" : "Thử tải lại"}</button>
  </section>;
}

export function RequestsEmpty({ filtered, reset }: { filtered: boolean; reset: () => void }) {
  return <div className="rounded-none border border-dashed border-[#D6D3D1] bg-[#FAFAF9] px-5 py-10 text-center dark:border-[#44403C] dark:bg-[#1C1917]">
    <FileText className="mx-auto mb-4 h-8 w-8 text-[#78716C] dark:text-[#A8A29E]" aria-hidden="true" />
    <h2 className="font-serif text-lg font-bold">{filtered ? "Không có hồ sơ phù hợp" : "Bạn chưa có hồ sơ"}</h2>
    <p className="mt-2 text-sm leading-relaxed text-[#57534E] dark:text-[#A8A29E]">{filtered ? "Thử đổi trạng thái, loại yêu cầu hoặc từ khóa tìm kiếm." : "Sau khi nộp yêu cầu, mã hồ sơ và trạng thái sẽ xuất hiện tại đây."}</p>
    {filtered ? <button type="button" onClick={reset} className={`${secondaryButton} mt-4`}>Xóa bộ lọc</button> : <Link href="/student" className={`${primaryButton} mt-5`}>Tạo yêu cầu</Link>}
  </div>;
}

export function StudentRequestsPage() {
  // Selection is browser state over already loaded records, with no server navigation.
  const selection = useSyncExternalStore(subscribeToSelection, readSelection, serverSelection);
  const params = new URLSearchParams(selection);
  const { currentUser, tickets, reviewCases, isDataLoading, dataError, dataConfig, reloadData, addTicketMessage, submitStudentSupplement, refreshTicket } = useStore();
  const [detailStatus, setDetailStatus] = useState<{ id: string; loading: boolean; error: string | null }>({
    id: "",
    loading: false,
    error: null,
  });
  const [detailRetry, setDetailRetry] = useState(0);
  const listTitle = useRef<HTMLHeadingElement>(null);
  const lastSelected = useRef<{ id: string; kind: string } | null>(null);
  const localOnly = dataConfig?.mode === "mock";
  const filters = baseFilters.map(([value, label]) => [value, value === "new" && localOnly ? "Đã lưu hồ sơ" : label] as const);
  const filter = normalizeFilter(params.get("filter"));
  const category = params.get("category") === "reviews" ? "reviews" : params.get("category") === "tickets" ? "tickets" : "all";
  const query = params.get("q") || "";
  const selectedKind = params.has("review") ? "review" : "ticket";
  const selectedId = params.get(selectedKind) || "";
  const items = currentUser ? collectRequests(tickets, reviewCases, currentUser.id) : [];
  const filtered = filterRequests(items, filter, query, category);
  const selected = filtered.find((item) => item.id === selectedId && item.kind === selectedKind);
  const hasFilter = filter !== "all" || category !== "all" || Boolean(query.trim());
  const categoryItems = items.filter((item) => category === "all" || (category === "tickets" ? item.kind === "ticket" : item.kind === "review"));
  const counts: Record<string, number> = {
    all: categoryItems.length,
    new: categoryItems.filter((item) => item.state === "new").length,
    processing: categoryItems.filter((item) => item.state === "processing").length,
    supplement: categoryItems.filter((item) => item.state === "supplement").length,
    completed: categoryItems.filter((item) => item.state === "completed").length,
    draft: categoryItems.filter((item) => item.state === "draft").length,
  };
  const pendingAndProcessingCount = counts.new + counts.processing;
  const summaries = [
    { value: "all", label: "Tổng hồ sơ", count: counts.all, Icon: Inbox },
    { value: "processing", label: "Chờ & đang xử lý", count: pendingAndProcessingCount, Icon: Clock3 },
    { value: "supplement", label: "Cần bổ sung", count: counts.supplement, Icon: TriangleAlert },
    { value: "completed", label: "Hoàn tất", count: counts.completed, Icon: CheckCircle2 },
  ] as const;

  useEffect(() => {
    if (!selectedId && lastSelected.current) {
      const previous = lastSelected.current;
      (document.getElementById(`request-${previous.kind}-${previous.id}`) || listTitle.current)?.focus();
    }
    lastSelected.current = selectedId ? { id: selectedId, kind: selectedKind } : null;
  }, [selectedId, selectedKind]);

  useEffect(() => {
    // Account hydration replaces list records, which do not contain messages.
    // Fetch the selected detail after hydration so its thread is not overwritten.
    if (isDataLoading || currentUser?.role !== "student" || dataConfig?.mode !== "api" || selectedKind !== "ticket" || !selectedId) return;
    let cancelled = false;
    void refreshTicket(selectedId)
      .then(() => {
        if (!cancelled) setDetailStatus({ id: selectedId, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDetailStatus({
            id: selectedId,
            loading: false,
            error: error instanceof Error ? error.message : "Không tải được chi tiết hồ sơ.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isDataLoading, currentUser?.id, currentUser?.role, dataConfig?.mode, selectedId, selectedKind, refreshTicket, detailRetry]);
  const detailLoading =
    dataConfig?.mode === "api" &&
    selectedKind === "ticket" &&
    Boolean(selectedId) &&
    (detailStatus.id !== selectedId || detailStatus.loading);
  const detailError = detailStatus.id === selectedId ? detailStatus.error : null;

  function navigate(changes: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    const url = `/my-requests${next.size ? `?${next.toString()}` : ""}`;
    if (replace) window.history.replaceState(null, "", url); else window.history.pushState(null, "", url);
    window.dispatchEvent(new Event(selectionEvent));
  }

  function clearSelection(changes: Record<string, string | null> = {}) {
    navigate({ ticket: null, review: null, ...changes });
    requestAnimationFrame(() => listTitle.current?.focus());
  }

  function backToList() {
    const previous = lastSelected.current || { id: selectedId, kind: selectedKind };
    navigate({ ticket: null, review: null });
    requestAnimationFrame(() => {
      const button = document.getElementById(`request-${previous.kind}-${previous.id}`);
      (button || listTitle.current)?.focus();
    });
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const value = String(new FormData(event.currentTarget).get("q") || "").trim();
    clearSelection({ q: value });
  }

  if (isDataLoading) return <RequestsLoading />;
  if (!currentUser && !dataError) return <DataAccessState requiredRole="student" />;
  if (currentUser && currentUser.role !== "student") return <DataAccessState requiredRole="student" />;

  return <div className="thoughtstream-theme min-h-screen bg-[var(--ts-bg)] text-[var(--ts-text-primary)]">
    <a href="#requests-main" className="sr-only z-50 bg-[var(--ts-text-primary)] p-3 text-[var(--ts-bg)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Đi đến nội dung hồ sơ</a>
    <Navbar />
    <main id="requests-main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8 sm:gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--ts-text-secondary)]">Theo dõi yêu cầu học vụ</p>
          <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px]">Hồ sơ của tôi</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ts-text-secondary)]">Theo dõi yêu cầu, xem phản hồi và hoàn thành những việc cần làm.</p>
        </div>
        <Link href="/student" className="inline-flex min-h-12 items-center gap-2 bg-[#1C1917] px-5 py-3 text-sm font-semibold text-[#FAFAF9] transition-colors hover:bg-[#57534E] dark:bg-[#FAFAF9] dark:text-[#1C1917] dark:hover:bg-[#D6D3D1]"><Plus className="h-4 w-4" aria-hidden="true" />Tạo yêu cầu</Link>
      </header>
      {dataError && <div className="mb-6"><RequestsLoadError retry={() => void reloadData()} /></div>}
      {currentUser && <>
        <div aria-label="Tổng quan hồ sơ" className={`${selected ? "hidden lg:grid" : "grid"} mb-6 grid-cols-2 rounded-sm border border-[#E7E5E4] bg-[#FFFFFF] dark:border-[#292524] dark:bg-[#1C1917] sm:mb-8 sm:grid-cols-4`}>
          {summaries.map(({ value, label, count, Icon }, index) => {
            const isSelected = filter === value || (value === "all" && !params.get("filter"));
            const isSupplementAlert = value === "supplement" && count > 0;
            const isCompletedEmpty = value === "completed" && count === 0;
            return (
              <button
                key={value}
                type="button"
                onClick={() => clearSelection({ filter: value === "all" ? null : value, category: null, q: null })}
                aria-label={`Xem ${label.toLowerCase()}: ${count} hồ sơ`}
                className={`group relative flex min-h-20 items-center justify-between gap-3 border-[#E7E5E4] p-4 text-left transition-all duration-150 hover:bg-[#F5F5F4] active:bg-[#E7E5E4] dark:border-[#292524] dark:hover:bg-[#23201D] sm:min-h-28 sm:p-5 ${
                  index < 2 ? "border-b sm:border-b-0" : ""
                } ${index % 2 === 0 ? "border-r" : "sm:border-r"} ${index === 3 ? "sm:border-r-0" : ""} ${
                  isSelected ? "bg-[#F5F5F4]/70 dark:bg-[#23201D]/70" : ""
                } ${
                  isSupplementAlert ? "!border-amber-300 !bg-amber-50/60 dark:!border-amber-800/60 dark:!bg-amber-950/25" : ""
                }`}
              >
                {isSelected && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C1917] dark:bg-[#FAFAF9]" aria-hidden="true" />
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isSupplementAlert ? "text-amber-900 dark:text-amber-300" : "text-[#78716C] dark:text-[#A8A29E]"
                    }`}>{label}</p>
                    {isSupplementAlert && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900/50 animate-pulse" aria-hidden="true" />
                    )}
                  </div>
                  <p className={`mt-2 font-serif text-3xl font-medium leading-none tabular-nums sm:text-4xl ${
                    isSupplementAlert
                      ? "text-amber-900 dark:text-amber-200 font-semibold"
                      : isCompletedEmpty
                      ? "text-[#A8A29E] dark:text-[#78716C]"
                      : "text-[#1C1917] dark:text-[#FAFAF9]"
                  }`}>{count}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                  isSelected
                    ? "border-[#1C1917] bg-[#1C1917] text-[#FAFAF9] dark:border-[#FAFAF9] dark:bg-[#FAFAF9] dark:text-[#1C1917]"
                    : isSupplementAlert
                    ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800/80 dark:bg-amber-900/40 dark:text-amber-200"
                    : "border-[#E7E5E4] bg-[#FAFAF9] text-[#78716C] dark:border-[#2E2A27] dark:bg-[#201D1A] dark:text-[#A8A29E] group-hover:border-[#D6D3D1] dark:group-hover:border-[#383533]"
                }`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>

        <section aria-label="Tìm và lọc hồ sơ" className={`${selected ? "hidden lg:block" : ""} mb-6`}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <form key={query} onSubmit={search} className="flex w-full items-center rounded-sm border border-[#D6D3D1] bg-[#FFFFFF] transition-all focus-within:border-[#1C1917] focus-within:ring-1 focus-within:ring-[#1C1917] dark:border-[#44403C] dark:bg-[#1C1917] dark:focus-within:border-[#FAFAF9] dark:focus-within:ring-[#FAFAF9] sm:max-w-[480px]">
              <label htmlFor="request-search" className="sr-only">Tìm theo mã hoặc nội dung yêu cầu</label>
              <Search className="ml-4 h-4 w-4 shrink-0 text-[#78716C] dark:text-[#A8A29E]" aria-hidden="true" />
              <input id="request-search" name="q" type="search" defaultValue={query} maxLength={200} placeholder="Tìm mã hồ sơ hoặc nội dung yêu cầu…" className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#A8A29E] dark:placeholder:text-[#78716C] focus-visible:outline-none" />
              <button type="submit" aria-label="Tìm hồ sơ" className="m-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-[#57534E] transition-colors hover:bg-[#F5F5F4] dark:text-[#A8A29E] dark:hover:bg-[#292524]"><ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
            </form>
            <div className="flex items-center gap-3">
              <label htmlFor="request-category" className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Loại hồ sơ</label>
              <select id="request-category" value={category} onChange={e => clearSelection({ category: e.target.value === "all" ? null : e.target.value })} className={`${fieldClass} min-w-0 flex-1 py-2 pr-8 text-sm rounded-sm sm:w-[260px]`}>
                <option value="all">Tất cả loại yêu cầu</option>
                <option value="tickets">Tài liệu, khiếu nại và câu hỏi</option>
                <option value="reviews">Rà soát công nhận học phần</option>
              </select>
            </div>
          </div>
          <div role="group" aria-label="Lọc trạng thái hồ sơ" className="mt-5 flex gap-4 overflow-x-auto whitespace-nowrap border-b border-[#E7E5E4] pb-px dark:border-[#292524] sm:gap-6">
            {filters.filter(([state]) => state !== "draft" || items.some(item => item.state === "draft")).map(([value, label]) => {
              const isActive = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => clearSelection({ filter: value === "all" ? null : value })}
                  className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-1 pb-3 pt-2 text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? "border-[#1C1917] font-semibold text-[#1C1917] dark:border-[#FAFAF9] dark:text-[#FAFAF9]"
                      : "border-transparent text-[#78716C] hover:text-[#1C1917] dark:text-[#A8A29E] dark:hover:text-[#FAFAF9]"
                  }`}
                >
                  {label}
                  <span className={`text-[11px] font-mono rounded-sm px-1.5 py-0.5 tabular-nums transition-colors ${
                    isActive
                      ? "bg-[#1C1917] text-[#FAFAF9] dark:bg-[#FAFAF9] dark:text-[#1C1917]"
                      : "bg-[#F5F5F4] text-[#78716C] dark:bg-[#292524] dark:text-[#A8A29E]"
                  }`}>
                    {counts[value]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="request-list-title" ref={listTitle} tabIndex={-1} className={`${selected ? "hidden lg:block" : ""} text-sm font-semibold`}>Danh sách hồ sơ <span role="status" className="ml-2 font-normal text-[var(--ts-text-secondary)]">{filtered.length} hồ sơ{hasFilter ? " phù hợp" : ""}</span></h2>
          <div className={`${selected ? "hidden lg:flex" : "flex"} items-center gap-3 text-xs text-[var(--ts-text-secondary)]`}><span>{filter === "processing" ? "Gồm mới nộp và chờ cán bộ" : "Mới nhất trước"}</span>{hasFilter && <button type="button" onClick={() => clearSelection({ filter: null, category: null, q: null })} className="inline-flex min-h-11 items-center gap-1.5 px-2 hover:bg-[var(--ts-surface)]"><X className="h-3.5 w-3.5" aria-hidden="true" />Xóa bộ lọc</button>}</div>
        </div>
        {selectedId && !selected && <div role="alert" className="mb-5 border border-[var(--ts-status-warning-border)] bg-[var(--ts-status-warning-bg)] p-4 text-sm text-[var(--ts-status-warning-text)]"><p className="font-semibold">Không tìm thấy hồ sơ trong danh sách này</p><p className="mt-1">Mã hồ sơ không thuộc tài khoản này hoặc không phù hợp với bộ lọc hiện tại.</p></div>}
        <div className={`grid items-start gap-6 ${selected ? "lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]" : "grid-cols-1"}`}>
          <section className={`${selected ? "hidden lg:block" : ""} min-w-0 ${selected ? "lg:sticky lg:top-20 lg:max-h-[calc(100dvh-96px)] lg:overflow-y-auto lg:overscroll-contain" : ""}`} aria-labelledby="request-list-title">
            {!filtered.length ? <RequestsEmpty filtered={hasFilter} reset={() => clearSelection({ filter: null, category: null, q: null })} /> : <div className="overflow-hidden border border-[#E7E5E4] bg-[#FFFFFF] dark:border-[#292524] dark:bg-[#1C1917]">
              {!selected && <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_200px_180px_20px] gap-6 border-b border-[#E7E5E4] bg-[#F5F5F4]/60 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:border-[#292524] dark:bg-[#23201D]/60 dark:text-[#A8A29E] lg:grid"><span>Yêu cầu</span><span>Mã hồ sơ · Ngày ghi nhận</span><span>Trạng thái</span><span /></div>}
              <ul className="divide-y divide-[#E7E5E4] dark:divide-[#292524]">{filtered.map(item => <li key={`${item.kind}-${item.id}`}><RequestRow item={item} compact={Boolean(selected)} selected={selected?.id === item.id && selected.kind === item.kind} localOnly={localOnly} onSelect={() => navigate({ ticket: item.kind === "ticket" ? item.id : null, review: item.kind === "review" ? item.id : null })} /></li>)}</ul>
            </div>}
          </section>
          {selected && <RequestDetail key={`${currentUser.id}-${selected.kind}-${selected.id}`} item={selected} localOnly={localOnly} detailLoading={detailLoading} detailError={detailError} onRetryDetail={() => { setDetailStatus({ id: "", loading: true, error: null }); setDetailRetry(value => value + 1); }} onBack={backToList} onMessage={(id, content) => addTicketMessage(id, { senderId: currentUser.id, senderName: currentUser.name, senderRole: "student", content })} onSupplement={async (id, payload) => { await submitStudentSupplement(id, payload); navigate({ filter: null }); }} />}
        </div>
      </>}
    </main>
  </div>;
}
