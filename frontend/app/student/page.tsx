"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, FileText, MessageSquareText, ChevronRight, ClipboardList, CircleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { collectRequests } from "@/lib/my-requests";
import { RequestStatus } from "@/components/student/RequestDetail";

const tasks = [
  { href: "/student/certificate", title: "Xin giấy xác nhận", description: "Chuẩn bị tài liệu cho Registrar", icon: FileText,
    card: "border-blue-200 bg-blue-50/80 hover:border-blue-400 hover:bg-blue-100/70 dark:border-blue-900 dark:bg-blue-950/40 dark:hover:bg-blue-950/70", accent: "bg-blue-600 text-white", arrow: "text-blue-600 dark:text-blue-300" },
  { href: "/student/lookup", title: "Tra cứu quy chế", description: "Xem câu trả lời kèm nguồn", icon: BookOpen,
    card: "border-indigo-200 bg-indigo-50/80 hover:border-indigo-400 hover:bg-indigo-100/70 dark:border-indigo-900 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70", accent: "bg-indigo-600 text-white", arrow: "text-indigo-600 dark:text-indigo-300" },
  { href: "/student/complaint", title: "Khiếu nại điểm học phần", description: "Chuẩn bị Grade Appeal", icon: MessageSquareText,
    card: "border-violet-200 bg-violet-50/80 hover:border-violet-400 hover:bg-violet-100/70 dark:border-violet-900 dark:bg-violet-950/40 dark:hover:bg-violet-950/70", accent: "bg-violet-600 text-white", arrow: "text-violet-600 dark:text-violet-300" },
];

export default function StudentHomePage() {
  const { currentUser, tickets, reviewCases, dataConfig } = useStore();
  const { state: { certificate, complaint } } = useVinUniForms();
  const myTickets = tickets.filter((ticket) => ticket.studentId === currentUser?.id);
  const activeTickets = myTickets.filter((ticket) => ticket.status !== "resolved");
  const supplements = reviewCases.filter((item) => item.studentId === currentUser?.id && item.status === "waiting_supplement");
  const recentTickets = collectRequests(myTickets, [], currentUser?.id || "").slice(0, 3);
  const drafts = [
    ...(!certificate.submission && (certificate.stage > 0 || certificate.values.purpose || certificate.values.extraRequest || certificate.values.documentType !== "ENR") ? [{ title: "Tài liệu VinUni", href: `/student/certificate${certificate.checked === JSON.stringify(certificate.values) ? "/review" : ""}`, description: certificate.values.purpose || "Đang chuẩn bị thông tin" }] : []),
    ...(!complaint.submission && (complaint.values.course || complaint.values.courseCode || complaint.values.description) ? [{ title: "Khiếu nại điểm học phần", href: `/student/complaint${complaint.checked === JSON.stringify(complaint.values) ? "/review" : ""}`, description: complaint.values.course || "Đang chuẩn bị thông tin" }] : []),
  ];

  return <div className="space-y-6">
    {supplements.length > 0 && <section aria-labelledby="supplements-title" className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:gap-5 sm:px-5 dark:border-amber-800 dark:bg-amber-950/40">
      <h2 id="supplements-title" className="flex shrink-0 items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100"><CircleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />Cần bổ sung <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-200 px-1.5 text-xs dark:bg-amber-900">{supplements.length}</span></h2>
      <div className="min-w-0 flex-1 divide-y divide-amber-200 dark:divide-amber-800">
        {supplements.map((item) => <Link key={item.id} href={`/my-requests?category=reviews&review=${encodeURIComponent(item.id)}`}
          className="flex min-h-11 items-center justify-between gap-3 py-1 text-amber-950 dark:text-amber-100">
          <div className="min-w-0"><p className="text-sm font-medium sm:text-base">Công nhận học phần · {item.targetCourseName}</p><p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">{item.code}</p></div>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-amber-100 px-3 text-sm font-semibold dark:bg-amber-900/60">Bổ sung<ArrowRight className="h-4 w-4" /></span>
        </Link>)}
      </div>
    </section>}

    <section aria-labelledby="tasks-title">
      <h1 id="tasks-title" className="text-2xl font-semibold tracking-tight sm:text-[28px]">Bạn cần hỗ trợ việc gì?</h1>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {tasks.map((task) => <Link key={task.href} href={task.href}
          className={`group flex min-h-24 items-center gap-3 rounded-2xl border p-4 transition-colors md:min-h-[116px] ${task.card}`}>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${task.accent}`}><task.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-base font-semibold">{task.title}</h2><p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-300">{task.description}</p></div>
          <ArrowRight className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 ${task.arrow}`} aria-hidden="true" />
        </Link>)}
      </div>
    </section>

    {drafts.length > 0 && <section aria-labelledby="drafts-title">
      <h2 id="drafts-title" className="text-lg font-semibold">Tiếp tục việc đang làm</h2>
      <div className="mt-2 divide-y divide-indigo-100 rounded-2xl border border-indigo-200 bg-indigo-50/50 px-4 dark:divide-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30">
        {drafts.map((draft) => <Link href={draft.href} key={draft.href} className="flex min-h-16 items-center justify-between gap-4 py-3">
          <div className="min-w-0"><p className="text-base font-medium">{draft.title}</p><p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{draft.description}</p></div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium">Tiếp tục<ChevronRight className="h-4 w-4" /></span>
        </Link>)}
      </div>
    </section>}

    <section aria-labelledby="requests-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3"><h2 id="requests-title" className="text-lg font-semibold">Hồ sơ gần đây</h2>{activeTickets.length > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">{activeTickets.length} chưa hoàn tất</span>}</div>
        <Link href="/my-requests" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Xem tất cả<ChevronRight className="h-4 w-4" /></Link>
      </div>
      {recentTickets.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center dark:border-slate-700"><ClipboardList className="mx-auto mb-3 h-7 w-7 text-slate-400" /><p className="text-base font-medium">Bạn chưa gửi yêu cầu nào</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Chọn một tác vụ ở trên để bắt đầu.</p></div>
        : <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
          {recentTickets.map((ticket) => <Link key={ticket.id} href={`/my-requests?ticket=${encodeURIComponent(ticket.id)}`} className="flex min-h-20 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-blue-50/60 sm:gap-4 sm:px-5 dark:hover:bg-slate-800/60">
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 sm:flex dark:bg-blue-950 dark:text-blue-300"><FileText className="h-4 w-4" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="text-base font-medium leading-snug">{ticket.title.replace(/\s*\(BM-\d+\)/gi, "")}</p><p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{ticket.code}</p></div>
            <span className="shrink-0"><RequestStatus item={ticket} localOnly={dataConfig?.mode === "mock"} /></span>
            <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
          </Link>)}
        </div>}
    </section>
  </div>;
}
