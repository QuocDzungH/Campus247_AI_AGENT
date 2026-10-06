"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, FileSearch, ChevronLeft } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { LoadingState } from "@/components/shared/LoadingState";

export const staffButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-none border border-[#D6D3D1] bg-transparent px-3 py-2 text-sm font-medium text-[#57534E] hover:bg-[#F5F5F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#44403C] dark:text-[#D6D3D1] dark:hover:bg-[#292524] dark:focus-visible:ring-[#A8A29E]";
export const staffPrimary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-none bg-[#78716C] px-4 py-2 text-sm font-semibold text-[#FAFAF9] hover:bg-[#57534E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#A8A29E] dark:text-[#1C1917] dark:hover:bg-[#D6D3D1] dark:focus-visible:ring-[#A8A29E]";
export const staffField = "w-full min-h-10 rounded-none border border-[#D6D3D1] bg-[#FAFAF9] px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#78716C] dark:border-[#44403C] dark:bg-[#1C1917] dark:text-[#FAFAF9] dark:focus:ring-[#A8A29E]";
export const staffSurface = "rounded-none border border-[#E7E5E4] bg-[#F5F5F4] dark:border-[#292524] dark:bg-[#1C1917]";

export function StaffShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { currentUser, isDataLoading, dataConfig } = useStore();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(wide);
  if (isDataLoading) return <><Navbar /><LoadingState title="Đang tải bàn làm việc…" description="Đang đọc dữ liệu hồ sơ." /></>;
  if (currentUser?.role !== "officer") return <DataAccessState requiredRole="officer" />;
  return <div className="staff-workspace min-h-dvh bg-[var(--bg-page)] text-[var(--text-primary)]">
    <a href="#staff-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-none focus:border focus:border-[#D6D3D1] focus:bg-[#FAFAF9] focus:p-3 focus:text-[#1C1917] dark:focus:border-[#44403C] dark:focus:bg-[#1C1917] dark:focus:text-[#FAFAF9]">Đến nội dung chính</a>
    <Navbar />
    <div className="mx-auto flex max-w-[1920px] gap-5 px-4 py-3 xl:px-6">
      <aside className={`${collapsed ? "w-14" : "w-48"} hidden shrink-0 lg:block`} aria-label="Bàn làm việc cán bộ">
        <div className="sticky top-20 space-y-2">
          <button type="button" onClick={() => setCollapsed(!collapsed)} className={`${staffButton} w-full`} aria-label={collapsed ? "Mở rộng điều hướng" : "Thu gọn điều hướng"} aria-expanded={!collapsed}><ChevronLeft className={`h-4 w-4 ${collapsed ? "rotate-180" : ""}`} />{!collapsed && "Bàn làm việc"}</button>
          {[{ href: "/dashboard", label: "Hồ sơ dịch vụ", icon: Inbox, active: pathname.startsWith("/dashboard") || pathname.startsWith("/tickets") }, { href: "/reviews", label: "Rà soát học phần", icon: FileSearch, active: pathname.startsWith("/reviews") }].map(item => <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} aria-label={item.label} title={collapsed ? item.label : undefined} className={`flex min-h-11 items-center gap-3 rounded-none px-3 text-sm font-medium ${item.active ? "border-l-2 border-[#78716C] bg-[#EFEDEB] text-[#1C1917] dark:border-[#A8A29E] dark:bg-[#292524] dark:text-[#FAFAF9]" : "text-[#57534E] hover:bg-[#F5F5F4] dark:text-[#D6D3D1] dark:hover:bg-[#292524]"}`}><item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />{!collapsed && item.label}</Link>)}
          {!collapsed && <p className="px-3 pt-5 text-xs leading-relaxed text-[#78716C] dark:text-[#A8A29E]">{currentUser.department || "Bàn tiếp nhận và xử lý hồ sơ"}{dataConfig?.mode === "mock" && <span className="mt-3 block">Dữ liệu mẫu · lưu trên thiết bị</span>}</p>}
        </div>
      </aside>
      <main id="staff-content" className="min-w-0 flex-1">{children}</main>
    </div>
  </div>;
}
