"use client";

import { type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { LoadingState } from "@/components/shared/LoadingState";

export const staffButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-[#D6D3D1] bg-transparent px-3 py-2 text-sm font-medium text-[#57534E] hover:bg-[#F5F5F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#44403C] dark:text-[#D6D3D1] dark:hover:bg-[#292524] dark:focus-visible:ring-[#A8A29E]";
export const staffPrimary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-[#78716C] px-4 py-2 text-sm font-semibold text-[#FAFAF9] hover:bg-[#57534E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78716C] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#A8A29E] dark:text-[#1C1917] dark:hover:bg-[#D6D3D1] dark:focus-visible:ring-[#A8A29E]";
export const staffField = "w-full min-h-10 rounded-sm border border-[#D6D3D1] bg-[#FAFAF9] px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#78716C] dark:border-[#44403C] dark:bg-[#1C1917] dark:text-[#FAFAF9] dark:focus:ring-[#A8A29E]";
export const staffSurface = "rounded-sm border border-[#E7E5E4] bg-[#F5F5F4] dark:border-[#292524] dark:bg-[#1C1917]";

export function StaffShell({ children, wide: _wide = false }: { children: ReactNode; wide?: boolean }) {
  const { currentUser, isDataLoading, dataConfig } = useStore();
  if (isDataLoading) return <><Navbar /><LoadingState title="Đang tải bàn làm việc…" description="Đang đọc dữ liệu hồ sơ." /></>;
  if (currentUser?.role !== "officer") return <DataAccessState requiredRole="officer" />;
  return <div className="thoughtstream-theme staff-workspace min-h-dvh bg-[var(--ts-bg)] text-[var(--ts-text-primary)]">
    <a href="#staff-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-none focus:border focus:border-[#D6D3D1] focus:bg-[#FAFAF9] focus:p-3 focus:text-[#1C1917] dark:focus:border-[#44403C] dark:focus:bg-[#1C1917] dark:focus:text-[#FAFAF9]">Đến nội dung chính</a>
    <Navbar />
    <div className="mx-auto flex max-w-[1440px] w-full px-4 py-6 sm:px-6 lg:px-8">
      <main id="staff-content" className="min-w-0 flex-1">
        {children}
        <footer className="mt-12 border-t border-[var(--ts-border-subtle)] py-4 text-center text-xs text-[var(--ts-text-tertiary)] break-words">
          <span>{currentUser.department || "Bàn tiếp nhận và xử lý hồ sơ"}</span>
          {dataConfig?.mode === "mock" && (
            <span className="inline-block before:mx-2 before:content-['·']">Dữ liệu mẫu · lưu trên thiết bị</span>
          )}
        </footer>
      </main>
    </div>
  </div>;
}
