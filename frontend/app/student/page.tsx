"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FileCheck2,
  FileText,
  GraduationCap,
  Scale,
  Search,
  Wrench,
  Building2,
  Clock,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { collectRequests, requestDate, requestStatusLabel, type RequestItem } from "@/lib/my-requests";

const tasks = [
  {
    href: "/student/assistant?intent=certificate",
    title: "Xin giấy xác nhận học vụ",
    shortTitle: "Giấy xác nhận",
    description: "Cấp giấy xác nhận sinh viên chính quy, bảng điểm quá trình, xác nhận tạm hoãn NVQS hoặc làm thủ tục vay vốn.",
    icon: FileCheck2,
    badge: "Văn bản học vụ",
    turnaround: "Xử lý 1–2 ngày",
    highlights: ["Bản PDF ký số & bản in dấu đỏ", "Trợ lý hỗ trợ điền form"],
    actionLabel: "Bắt đầu thủ tục",
  },
  {
    href: "/student/lookup",
    title: "Tra cứu quy chế đào tạo",
    shortTitle: "Sổ tay quy chế",
    description: "Tra cứu quy định điểm rèn luyện, đăng ký tín chỉ, chuẩn đầu ra ngoại ngữ, điều kiện nhận học bổng và thôi học.",
    icon: BookOpen,
    badge: "Sổ tay sinh viên",
    turnaround: "Phản hồi tức thì",
    highlights: ["Dẫn nguồn điều khoản chính thức", "Giải đáp theo từng tình huống"],
    actionLabel: "Tra cứu ngay",
  },
  {
    href: "/student/assistant?intent=complaint",
    title: "Khiếu nại & Phúc khảo",
    shortTitle: "Đơn khiếu nại",
    description: "Gửi phản ánh sai lệch điểm thi kết thúc môn, sửa sai thông tin học vụ, điểm chuyên cần hoặc cơ sở vật chất.",
    icon: Scale,
    badge: "Khảo thí & Học vụ",
    turnaround: "Thụ lý 5 ngày",
    highlights: ["Đóng gói Fact Sheet trình hội đồng", "Giám sát tiến độ minh bạch"],
    actionLabel: "Gửi khiếu nại",
  },
];

const quickSearchChips = [
  { label: "Hoãn nghĩa vụ quân sự", href: "/student/assistant?intent=certificate" },
  { label: "Bảng điểm quá trình", href: "/student/assistant?intent=certificate" },
  { label: "Phúc khảo điểm thi", href: "/student/assistant?intent=complaint" },
  { label: "Quy chế đăng ký tín chỉ", href: "/student/lookup" },
  { label: "Xác nhận vay vốn", href: "/student/assistant?intent=certificate" },
];

function getRequestIcon(title: string, type: string) {
  const text = `${title} ${type}`.toLowerCase();
  if (text.includes("khiếu nại") || text.includes("phúc khảo") || text.includes("điểm thi")) {
    return Scale;
  }
  if (text.includes("máy chiếu") || text.includes("hỏng") || text.includes("phòng") || text.includes("cơ sở")) {
    return Wrench;
  }
  if (text.includes("học phần") || text.includes("công nhận") || text.includes("rà soát")) {
    return GraduationCap;
  }
  return FileCheck2;
}

function StatusIndicator({ item, localOnly }: { item: RequestItem; localOnly: boolean }) {
  const label = requestStatusLabel(item, localOnly);
  if (item.state === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-300/80 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
        <span>{label}</span>
      </span>
    );
  }
  if (item.state === "supplement") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-amber-300 bg-amber-50/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span>{label}</span>
      </span>
    );
  }
  if (item.state === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-blue-200 bg-blue-50/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-200">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#D6D3D1] bg-[#FAFAF9] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:border-[#44403C] dark:bg-[#1C1917] dark:text-[#A8A29E]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#A8A29E]" />
      <span>{label}</span>
    </span>
  );
}

export default function StudentHomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { currentUser, tickets, reviewCases, dataConfig } = useStore();
  const {
    state: { certificate, complaint },
  } = useVinUniForms();

  const myTickets = tickets.filter((ticket) => ticket.studentId === currentUser?.id);
  const activeTickets = myTickets.filter((ticket) => ticket.status !== "resolved");
  const resolvedTickets = myTickets.filter((ticket) => ticket.status === "resolved");
  const supplements = reviewCases.filter(
    (item) => item.studentId === currentUser?.id && item.status === "waiting_supplement"
  );
  const recentRequests = collectRequests(myTickets, reviewCases, currentUser?.id || "").slice(0, 4);

  const drafts = [
    ...(!certificate.submission &&
    (certificate.stage > 0 ||
      certificate.values.purpose ||
      certificate.values.extraRequest ||
      certificate.values.documentType !== "ENR")
      ? [
          {
            title: "Xin giấy xác nhận",
            href: "/student/assistant?intent=certificate",
            description: certificate.values.purpose || "Đang chuẩn bị thông tin hồ sơ",
          },
        ]
      : []),
    ...(!complaint.submission &&
    (complaint.values.course || complaint.values.courseCode || complaint.values.description)
      ? [
          {
            title: "Khiếu nại & Khảo thí",
            href: "/student/assistant?intent=complaint",
            description: complaint.values.course || "Đang chuẩn bị thông tin phản ánh",
          },
        ]
      : []),
  ];

  const firstName = currentUser?.name ? currentUser.name.trim().split(" ").slice(-1)[0] : "bạn";
  const studentInitials = currentUser?.name
    ? currentUser.name
        .trim()
        .split(" ")
        .slice(-2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "SV";

  const creditMatch = currentUser?.credits?.match(/(\d+)\s*\/\s*(\d+)/);
  const creditPercent = creditMatch
    ? Math.min(100, Math.round((parseInt(creditMatch[1], 10) / parseInt(creditMatch[2], 10)) * 100))
    : 82;

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/student/lookup?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/student/lookup");
    }
  }

  return (
    <div className="space-y-12">
      {/* ── Cần bổ sung banner ── */}
      {supplements.length > 0 && (
        <section
          aria-labelledby="supplements-title"
          className="rounded-sm border border-amber-300 bg-amber-50/80 p-5 dark:border-amber-900/60 dark:bg-amber-950/25"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="supplements-title"
              className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-950 dark:text-amber-200"
            >
              <CircleAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <span>Cần bổ sung hồ sơ</span>
              <span className="rounded-sm border border-amber-400/80 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                {supplements.length}
              </span>
            </h2>
          </div>
          <div className="mt-3 divide-y divide-amber-200/80 dark:divide-amber-900/50">
            {supplements.map((item) => (
              <Link
                key={item.id}
                href={`/my-requests?category=reviews&review=${encodeURIComponent(item.id)}`}
                className="group flex min-h-12 items-center justify-between gap-4 py-3 text-amber-950 transition-colors hover:text-amber-900 dark:text-amber-100 dark:hover:text-amber-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug sm:text-base">
                    Công nhận học phần · {item.targetCourseName}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-amber-800 dark:text-amber-300">
                    {item.code}
                  </p>
                </div>
                <span className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-sm border border-amber-400/80 bg-amber-100/90 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-950 transition-colors group-hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100 dark:group-hover:bg-amber-900">
                  <span>Bổ sung ngay</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Hero & Student Cockpit ── */}
      <section aria-labelledby="tasks-title" className="space-y-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Left: Greeting & Search */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#E7E5E4] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#78716C] dark:border-[#2E2A27] dark:bg-[#1C1917] dark:text-[#A8A29E]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Chào {firstName} · Cổng dịch vụ sinh viên HK I 2025–2026
              </span>
            </div>

            <h1
              id="tasks-title"
              className="font-serif text-[32px] font-bold tracking-tight text-[#1C1917] sm:text-[38px] leading-[1.2] dark:text-[#FAFAF9]"
            >
              Bạn cần hỗ trợ việc gì?
            </h1>

            <p className="mt-3 text-base leading-relaxed text-[#57534E] dark:text-[#A8A29E] max-w-[620px]">
              Tiếp nhận trực tuyến 24/7. Trợ lý số hỗ trợ chuẩn bị hồ sơ theo đúng quy chế đào tạo, tự động đối soát và chuyển tới cán bộ quản lý.
            </p>

            {/* Quick Search Affordance */}
            <form onSubmit={handleSearchSubmit} className="mt-6 max-w-[620px]">
              <div className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#78716C] dark:text-[#A8A29E]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm thủ tục: Xin hoãn NVQS, bảng điểm, phúc khảo bài thi..."
                  className="w-full rounded-sm border border-[#D6D3D1] bg-[#FFFFFF] py-3 pl-10 pr-24 text-sm text-[#1C1917] placeholder-[#78716C] transition-colors focus:border-[#78716C] focus:outline-none focus:ring-1 focus:ring-[#78716C] dark:border-[#44403C] dark:bg-[#1C1917] dark:text-[#FAFAF9] dark:placeholder-[#A8A29E] dark:focus:border-[#A8A29E] dark:focus:ring-[#A8A29E]"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 inline-flex min-h-9 items-center gap-1 rounded-sm border border-[#78716C] bg-[#1C1917] px-3 text-xs font-semibold uppercase tracking-wider text-[#FAFAF9] transition-colors hover:bg-[#57534E] dark:border-[#A8A29E] dark:bg-[#FAFAF9] dark:text-[#1C1917] dark:hover:bg-[#E7E5E4]"
                >
                  <span>Tra cứu</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E]">
                  Gợi ý:
                </span>
                {quickSearchChips.map((chip) => (
                  <Link
                    key={chip.label}
                    href={chip.href}
                    className="rounded-sm border border-[#E7E5E4] bg-[#FFFFFF] px-2.5 py-1 text-xs text-[#57534E] transition-colors hover:border-[#78716C] hover:text-[#1C1917] dark:border-[#2E2A27] dark:bg-[#1C1917] dark:text-[#D6D3D1] dark:hover:border-[#A8A29E] dark:hover:text-[#FAFAF9]"
                  >
                    {chip.label}
                  </Link>
                ))}
              </div>
            </form>
          </div>

          {/* Right: Academic Passport / Cockpit Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-sm border border-[#E7E5E4] bg-[#FFFFFF] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:border-[#2E2A27] dark:bg-[#1C1917] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-[#F5F5F4] pb-3 dark:border-[#292524]">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                  Hồ sơ học vụ
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{currentUser?.academicStatus || "Đang học chính quy"}</span>
                </span>
              </div>

              {/* Student Identity */}
              <div className="mt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-bold tracking-tight text-[#1C1917] dark:text-[#FAFAF9]">
                      {currentUser?.name || "Sinh viên"}
                    </h2>
                    <p className="mt-0.5 font-mono text-xs text-[#78716C] dark:text-[#A8A29E]">
                      MSSV: <span className="font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{currentUser?.mssv || "20210018"}</span>
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#E7E5E4] bg-[#F5F5F4] font-serif text-sm font-bold text-[#57534E] dark:border-[#383533] dark:bg-[#292524] dark:text-[#D6D3D1]">
                    {studentInitials}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-[#57534E] dark:text-[#D6D3D1]">
                  <span className="rounded-sm border border-[#E7E5E4] bg-[#F5F5F4] px-2 py-0.5 dark:border-[#383533] dark:bg-[#292524]">
                    {currentUser?.major || "Kỹ thuật Phần mềm"}
                  </span>
                  <span className="text-[#A8A29E]">·</span>
                  <span className="text-[#78716C] dark:text-[#A8A29E]">
                    {currentUser?.classYear || "K18 (2021 - 2025)"}
                  </span>
                </div>
              </div>

              {/* Academic Credits Progress */}
              <div className="mt-5 border-t border-[#F5F5F4] pt-4 dark:border-[#292524]">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-[#78716C] dark:text-[#A8A29E]">Tiến độ tích lũy tín chỉ</span>
                  <span className="font-mono font-semibold text-[#1C1917] dark:text-[#FAFAF9]">
                    {currentUser?.credits || "114 / 138 TC"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-[#E7E5E4] dark:bg-[#2E2A27]">
                  <div
                    className="h-full bg-[#78716C] transition-all duration-500 dark:bg-[#A8A29E]"
                    style={{ width: `${creditPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#A8A29E] dark:text-[#78716C]">
                  Đã tích lũy {creditPercent}% tổng số tín chỉ yêu cầu tốt nghiệp
                </p>
              </div>

              {/* Quick Status Metrics Strip */}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#F5F5F4] pt-4 dark:border-[#292524]">
                <div className="rounded-sm bg-[#FAFAF9] p-2.5 text-center dark:bg-[#141210]">
                  <div className="font-mono text-lg font-bold text-[#1C1917] dark:text-[#FAFAF9]">
                    {activeTickets.length}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                    Đang xử lý
                  </div>
                </div>
                <div className="rounded-sm bg-[#FAFAF9] p-2.5 text-center dark:bg-[#141210]">
                  <div
                    className={`font-mono text-lg font-bold ${
                      supplements.length > 0 ? "text-amber-800 dark:text-amber-400" : "text-[#1C1917] dark:text-[#FAFAF9]"
                    }`}
                  >
                    {supplements.length}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                    Cần bổ sung
                  </div>
                </div>
                <div className="rounded-sm bg-[#FAFAF9] p-2.5 text-center dark:bg-[#141210]">
                  <div className="font-mono text-lg font-bold text-emerald-800 dark:text-emerald-400">
                    {resolvedTickets.length}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                    Đã hoàn tất
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3 Main Pillar Action Cards ── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {tasks.map((task) => {
            const Icon = task.icon;
            return (
              <Link
                key={task.href}
                href={task.href}
                className="group relative flex flex-col justify-between rounded-sm border border-[#E7E5E4] bg-[#FFFFFF] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] transition-all duration-200 hover:border-[#78716C] hover:bg-[#FAF9F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] focus-visible:ring-offset-2 dark:border-[#2E2A27] dark:bg-[#1C1917] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:hover:border-[#A8A29E] dark:hover:bg-[#23201D] dark:focus-visible:ring-[#A8A29E] dark:focus-visible:ring-offset-[#141210]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-[#D6D3D1] bg-[#F5F5F4] text-[#57534E] transition-all group-hover:border-[#78716C] group-hover:bg-[#1C1917] group-hover:text-[#FAFAF9] dark:border-[#44403C] dark:bg-[#292524] dark:text-[#D6D3D1] dark:group-hover:border-[#A8A29E] dark:group-hover:bg-[#FAFAF9] dark:group-hover:text-[#1C1917]">
                      <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="rounded-sm border border-[#E7E5E4] bg-[#FAFAF9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#78716C] dark:border-[#2E2A27] dark:bg-[#141210] dark:text-[#A8A29E]">
                      {task.badge}
                    </span>
                  </div>

                  <h2 className="mt-5 font-serif text-[20px] font-bold tracking-tight text-[#1C1917] transition-colors group-hover:text-[#57534E] dark:text-[#FAFAF9] dark:group-hover:text-[#D6D3D1]">
                    {task.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#57534E] dark:text-[#A8A29E]">
                    {task.description}
                  </p>

                  <div className="mt-4 space-y-1.5 border-t border-[#F5F5F4] pt-3.5 dark:border-[#292524]">
                    {task.highlights.map((highlight) => (
                      <div key={highlight} className="flex items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E]">
                        <span className="h-1 w-1 rounded-full bg-[#78716C] dark:bg-[#A8A29E]" />
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#E7E5E4] pt-4 text-xs font-semibold uppercase tracking-wider text-[#78716C] transition-colors group-hover:text-[#1C1917] dark:border-[#2E2A27] dark:text-[#A8A29E] dark:group-hover:text-[#FAFAF9]">
                  <span className="shrink-0 font-mono text-[11px] font-medium text-[#A8A29E] dark:text-[#78716C]">
                    {task.turnaround}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5">
                    <span>{task.actionLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1.5" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Tiếp tục việc đang làm ── */}
      {drafts.length > 0 && (
        <section aria-labelledby="drafts-title" className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-[#E7E5E4] pb-2 dark:border-[#2E2A27]">
            <div className="flex items-center gap-3">
              <h2
                id="drafts-title"
                className="font-serif text-[24px] font-bold tracking-tight text-[#1C1917] dark:text-[#FAFAF9]"
              >
                Tiếp tục việc đang làm
              </h2>
              <span className="rounded-sm border border-[#D6D3D1] bg-[#F5F5F4] px-2 py-0.5 text-xs font-medium text-[#57534E] dark:border-[#44403C] dark:bg-[#292524] dark:text-[#D6D3D1]">
                {drafts.length} bản nháp
              </span>
            </div>
          </div>

          <div className="divide-y divide-[#E7E5E4] border border-[#E7E5E4] bg-[#FFFFFF] dark:divide-[#2E2A27] dark:border-[#2E2A27] dark:bg-[#1C1917]">
            {drafts.map((draft) => (
              <Link
                href={draft.href}
                key={draft.href}
                className="group flex min-h-16 items-center justify-between gap-4 p-4 sm:p-5 transition-colors hover:bg-[#FAF9F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] dark:hover:bg-[#23201D] dark:focus-visible:ring-[#A8A29E]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#E7E5E4] bg-[#F5F5F4] text-[#78716C] dark:border-[#383533] dark:bg-[#292524] dark:text-[#A8A29E]">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#1C1917] dark:text-[#FAFAF9]">
                      {draft.title}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-[#57534E] dark:text-[#A8A29E]">
                      {draft.description}
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-[#D6D3D1] bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#78716C] transition-colors group-hover:border-[#78716C] group-hover:bg-[#1C1917] group-hover:text-[#FAFAF9] dark:border-[#44403C] dark:text-[#D6D3D1] dark:group-hover:border-[#A8A29E] dark:group-hover:bg-[#FAFAF9] dark:group-hover:text-[#1C1917]">
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
              className="font-serif text-[24px] font-bold tracking-tight text-[#1C1917] dark:text-[#FAFAF9]"
            >
              Hồ sơ gần đây
            </h2>
            {activeTickets.length > 0 && (
              <span className="rounded-sm border border-[#D6D3D1] bg-[#F5F5F4] px-2.5 py-0.5 text-xs font-medium text-[#57534E] dark:border-[#44403C] dark:bg-[#292524] dark:text-[#D6D3D1]">
                {activeTickets.length} đang xử lý
              </span>
            )}
          </div>
          <Link
            href="/my-requests"
            className="group inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-[#78716C] transition-colors hover:text-[#1C1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] dark:text-[#A8A29E] dark:hover:text-[#FAFAF9] dark:focus-visible:ring-[#A8A29E]"
          >
            <span>Xem toàn bộ hồ sơ ({myTickets.length})</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <div className="rounded-sm border border-dashed border-[#D6D3D1] bg-[#FFFFFF] px-6 py-12 text-center dark:border-[#44403C] dark:bg-[#1C1917]">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-[#78716C] dark:text-[#A8A29E]" aria-hidden="true" />
            <p className="text-base font-medium text-[#1C1917] dark:text-[#FAFAF9]">
              Bạn chưa gửi hồ sơ nào
            </p>
            <p className="mt-1 text-sm text-[#57534E] dark:text-[#A8A29E]">
              Chọn một trong ba tác vụ phía trên để gửi yêu cầu hoặc tra cứu quy chế học vụ.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E7E5E4] border border-[#E7E5E4] bg-[#FFFFFF] dark:divide-[#2E2A27] dark:border-[#2E2A27] dark:bg-[#1C1917]">
            {recentRequests.map((item) => {
              const Icon = getRequestIcon(item.title, item.type);
              const linkHref =
                item.kind === "ticket"
                  ? `/my-requests?ticket=${encodeURIComponent(item.id)}`
                  : `/my-requests?category=reviews&review=${encodeURIComponent(item.id)}`;
              const cleanTitle = item.title.replace(/\s*\(BM-\d+\)/gi, "");
              const formattedDate = requestDate(item.submittedAt);

              return (
                <Link
                  key={item.id}
                  href={linkHref}
                  className="group flex min-h-[76px] items-center justify-between gap-4 p-4 transition-all duration-150 hover:bg-[#FAF9F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] dark:hover:bg-[#23201D] dark:focus-visible:ring-[#A8A29E]"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-[#E7E5E4] bg-[#F5F5F4] text-[#57534E] transition-colors group-hover:border-[#78716C] group-hover:bg-[#1C1917] group-hover:text-[#FAFAF9] dark:border-[#383533] dark:bg-[#292524] dark:text-[#D6D3D1] dark:group-hover:border-[#A8A29E] dark:group-hover:bg-[#FAFAF9] dark:group-hover:text-[#1C1917]">
                      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-snug text-[#1C1917] transition-colors group-hover:text-[#57534E] dark:text-[#FAFAF9] dark:group-hover:text-[#D6D3D1]">
                        {cleanTitle}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[#78716C] dark:text-[#A8A29E]">
                        <span className="break-all font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{item.code}</span>
                        {formattedDate && <span> · {formattedDate}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <StatusIndicator item={item} localOnly={dataConfig?.mode === "mock"} />
                    <ChevronRight className="hidden sm:block h-4 w-4 text-[#A8A29E] transition-transform group-hover:translate-x-1 group-hover:text-[#1C1917] dark:group-hover:text-[#FAFAF9]" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Institutional Help Strip ── */}
      <section className="rounded-sm border border-[#E7E5E4] bg-[#F5F5F4]/60 p-5 text-xs text-[#78716C] dark:border-[#2E2A27] dark:bg-[#1C1917]/60 dark:text-[#A8A29E]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#D6D3D1] bg-[#FFFFFF] text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1]">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="font-medium text-[#1C1917] dark:text-[#FAFAF9]">
                Phòng Chăm sóc & Quản lý Sinh viên (CTSV)
              </p>
              <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                Địa điểm: Phòng I-102, Tòa nhà Trung tâm · Giờ làm việc: Thứ 2 – Thứ 6 (08:00 – 17:00)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end text-[11px]">
            <span className="rounded-sm border border-[#D6D3D1] bg-[#FFFFFF] px-2.5 py-1 font-mono text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1]">
              Hotline: (024) 7108 9779
            </span>
            <span className="rounded-sm border border-[#D6D3D1] bg-[#FFFFFF] px-2.5 py-1 font-mono text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1]">
              ctsv@vinuni.edu.vn
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
