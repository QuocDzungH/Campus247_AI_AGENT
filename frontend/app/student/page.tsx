"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, FileText, MessageSquareText, ChevronRight, ClipboardList, CircleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { collectRequests } from "@/lib/my-requests";
import { RequestStatus } from "@/components/student/RequestDetail";

const tasks = [
  {
    href: "/student/assistant?intent=certificate",
    title: "Xin giấy xác nhận",
    description: "Nói với trợ lý rồi điền form trong hội thoại",
    icon: FileText,
    badge: "Văn bản học vụ",
  },
  {
    href: "/student/lookup",
    title: "Tra cứu quy chế",
    description: "Xem câu trả lời kèm nguồn",
    icon: BookOpen,
    badge: "Sổ tay sinh viên",
  },
  {
    href: "/student/assistant?intent=complaint",
    title: "Khiếu nại",
    description: "Nói nhu cầu trong chat, trợ lý mở đúng form",
    icon: MessageSquareText,
    badge: "Đơn khiếu nại",
  },
];

export default function StudentHomePage() {
  const { currentUser, tickets, reviewCases, dataConfig } = useStore();
  const { state: { certificate, complaint } } = useVinUniForms();
  const myTickets = tickets.filter((ticket) => ticket.studentId === currentUser?.id);
  const activeTickets = myTickets.filter((ticket) => ticket.status !== "resolved");
  const supplements = reviewCases.filter((item) => item.studentId === currentUser?.id && item.status === "waiting_supplement");
  const recentTickets = collectRequests(myTickets, [], currentUser?.id || "").slice(0, 3);
  const drafts = [
    ...(!certificate.submission && (certificate.stage > 0 || certificate.values.purpose || certificate.values.extraRequest || certificate.values.documentType !== "ENR") ? [{ title: "Xin giấy xác nhận", href: "/student/assistant?intent=certificate", description: certificate.values.purpose || "Đang chuẩn bị thông tin" }] : []),
    ...(!complaint.submission && (complaint.values.course || complaint.values.courseCode || complaint.values.description) ? [{ title: "Khiếu nại", href: "/student/assistant?intent=complaint", description: complaint.values.course || "Đang chuẩn bị thông tin" }] : []),
  ];

  return (
    <div className="space-y-12">
      {/* ── Cần bổ sung banner ── */}
      {supplements.length > 0 && (
        <section
          aria-labelledby="supplements-title"
          className="rounded-none border border-amber-300 bg-amber-50/70 p-5 dark:border-amber-900/60 dark:bg-amber-950/25"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="supplements-title"
              className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-950 dark:text-amber-200"
            >
              <CircleAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <span>Cần bổ sung</span>
              <span className="rounded-none border border-amber-400/80 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                {supplements.length}
              </span>
            </h2>
          </div>
          <div className="mt-3 divide-y divide-amber-200/80 dark:divide-amber-900/50">
            {supplements.map((item) => (
              <Link
                key={item.id}
                href={`/my-requests?category=reviews&review=${encodeURIComponent(item.id)}`}
                className="group flex min-h-12 items-center justify-between gap-4 py-2.5 text-amber-950 transition-colors hover:text-amber-900 dark:text-amber-100 dark:hover:text-amber-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium sm:text-base leading-snug">
                    Công nhận học phần · {item.targetCourseName}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-amber-800 dark:text-amber-300">
                    {item.code}
                  </p>
                </div>
                <span className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-none border border-amber-400/80 bg-amber-100/80 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-950 transition-colors group-hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100 dark:group-hover:bg-amber-900">
                  <span>Bổ sung</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Header & Main Tasks ── */}
      <section aria-labelledby="tasks-title">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E] mb-2">
            Cổng dịch vụ sinh viên
          </p>
          <h1
            id="tasks-title"
            className="font-serif text-[30px] font-bold tracking-tight text-[#1C1917] sm:text-[36px] leading-[1.25] dark:text-[#FAFAF9]"
          >
            Bạn cần hỗ trợ việc gì?
          </h1>
          <p className="mt-3 text-base text-[#57534E] dark:text-[#D6D3D1] max-w-[680px] leading-relaxed">
            Thực hiện nhanh các thủ tục hành chính học vụ hoặc tương tác với trợ lý số để chuẩn bị hồ sơ chính xác theo quy định.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {tasks.map((task) => (
            <Link
              key={task.href}
              href={task.href}
              className="group relative flex flex-col justify-between rounded-none border border-[#E7E5E4] bg-[#FAFAF9] p-6 transition-all duration-200 hover:border-[#78716C] hover:bg-[#F5F5F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] focus-visible:ring-offset-2 dark:border-[#2E2A27] dark:bg-[#1C1917] dark:hover:border-[#A8A29E] dark:hover:bg-[#23201D] dark:focus-visible:ring-[#A8A29E] dark:focus-visible:ring-offset-[#141210]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-[#D6D3D1] bg-[#F5F5F4] text-[#78716C] transition-colors group-hover:border-[#78716C] group-hover:bg-[#78716C] group-hover:text-[#FAFAF9] dark:border-[#44403C] dark:bg-[#292524] dark:text-[#D6D3D1] dark:group-hover:border-[#A8A29E] dark:group-hover:bg-[#A8A29E] dark:group-hover:text-[#1C1917]">
                    <task.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                    {task.badge}
                  </span>
                </div>
                <h2 className="mt-5 text-lg font-semibold text-[#1C1917] transition-colors group-hover:text-[#78716C] dark:text-[#FAFAF9] dark:group-hover:text-[#FAFAF9]">
                  {task.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#57534E] dark:text-[#A8A29E]">
                  {task.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#E7E5E4] pt-4 text-xs font-semibold uppercase tracking-wider text-[#78716C] transition-colors group-hover:text-[#1C1917] dark:border-[#2E2A27] dark:text-[#A8A29E] dark:group-hover:text-[#FAFAF9]">
                <span>Bắt đầu</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Tiếp tục việc đang làm ── */}
      {drafts.length > 0 && (
        <section aria-labelledby="drafts-title" className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-[#E7E5E4] pb-2 dark:border-[#2E2A27]">
            <h2
              id="drafts-title"
              className="font-serif text-[22px] font-normal tracking-tight text-[#1C1917] dark:text-[#FAFAF9]"
            >
              Tiếp tục việc đang làm
            </h2>
            <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              {drafts.length} bản nháp
            </span>
          </div>

          <div className="divide-y divide-[#E7E5E4] border border-[#E7E5E4] bg-[#FAFAF9] dark:divide-[#2E2A27] dark:border-[#2E2A27] dark:bg-[#1C1917]">
            {drafts.map((draft) => (
              <Link
                href={draft.href}
                key={draft.href}
                className="group flex min-h-16 items-center justify-between gap-4 p-4 sm:p-5 transition-colors hover:bg-[#F5F5F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] dark:hover:bg-[#23201D] dark:focus-visible:ring-[#A8A29E]"
              >
                <div className="min-w-0">
                  <p className="text-base font-medium text-[#1C1917] dark:text-[#FAFAF9]">
                    {draft.title}
                  </p>
                  <p className="mt-1 truncate text-sm text-[#57534E] dark:text-[#A8A29E]">
                    {draft.description}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-none border border-[#D6D3D1] bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#78716C] transition-colors group-hover:border-[#78716C] group-hover:bg-[#78716C] group-hover:text-[#FAFAF9] dark:border-[#44403C] dark:text-[#D6D3D1] dark:group-hover:border-[#A8A29E] dark:group-hover:bg-[#A8A29E] dark:group-hover:text-[#1C1917]">
                  <span>Tiếp tục</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Hồ sơ gần đây ── */}
      <section aria-labelledby="requests-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#E7E5E4] pb-2 dark:border-[#2E2A27]">
          <div className="flex items-center gap-3">
            <h2
              id="requests-title"
              className="font-serif text-[22px] font-normal tracking-tight text-[#1C1917] dark:text-[#FAFAF9]"
            >
              Hồ sơ gần đây
            </h2>
            {activeTickets.length > 0 && (
              <span className="rounded-none border border-[#D6D3D1] bg-[#F5F5F4] px-2.5 py-0.5 text-xs font-medium text-[#57534E] dark:border-[#44403C] dark:bg-[#292524] dark:text-[#D6D3D1]">
                {activeTickets.length} chưa hoàn tất
              </span>
            )}
          </div>
          <Link
            href="/my-requests"
            className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-[#78716C] transition-colors hover:text-[#1C1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] dark:text-[#A8A29E] dark:hover:text-[#FAFAF9] dark:focus-visible:ring-[#A8A29E]"
          >
            <span>Xem tất cả</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {recentTickets.length === 0 ? (
          <div className="rounded-none border border-dashed border-[#D6D3D1] bg-[#FAFAF9] px-6 py-12 text-center dark:border-[#44403C] dark:bg-[#1C1917]">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-[#78716C] dark:text-[#A8A29E]" aria-hidden="true" />
            <p className="text-base font-medium text-[#1C1917] dark:text-[#FAFAF9]">
              Bạn chưa gửi yêu cầu nào
            </p>
            <p className="mt-1 text-sm text-[#57534E] dark:text-[#A8A29E]">
              Chọn một tác vụ ở trên để bắt đầu tạo hồ sơ hoặc tra cứu thông tin.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E7E5E4] border border-[#E7E5E4] bg-[#FAFAF9] dark:divide-[#2E2A27] dark:border-[#2E2A27] dark:bg-[#1C1917]">
            {recentTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/my-requests?ticket=${encodeURIComponent(ticket.id)}`}
                className="group flex min-h-20 items-center justify-between gap-4 p-4 sm:p-5 transition-colors hover:bg-[#F5F5F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] dark:hover:bg-[#23201D] dark:focus-visible:ring-[#A8A29E]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-[#E7E5E4] bg-[#F5F5F4] text-[#78716C] transition-colors group-hover:border-[#78716C] group-hover:text-[#1C1917] dark:border-[#383533] dark:bg-[#292524] dark:text-[#D6D3D1] dark:group-hover:border-[#A8A29E] dark:group-hover:text-[#FAFAF9]">
                    <FileText className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium leading-snug text-[#1C1917] transition-colors group-hover:text-[#78716C] dark:text-[#FAFAF9] dark:group-hover:text-[#FAFAF9]">
                      {ticket.title.replace(/\s*\(BM-\d+\)/gi, "")}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[#57534E] dark:text-[#A8A29E]">
                      {ticket.code}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <RequestStatus item={ticket} localOnly={dataConfig?.mode === "mock"} />
                  <ChevronRight className="hidden sm:block h-4 w-4 text-[#A8A29E] transition-all group-hover:translate-x-0.5 group-hover:text-[#1C1917] dark:group-hover:text-[#FAFAF9]" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
