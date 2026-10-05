"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { LoadingState } from "@/components/shared/LoadingState";
import { useStore } from "@/lib/store";
import { useStudentWorkspace } from "@/lib/student-workspace";

function PortalContents({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { storageIssue } = useStudentWorkspace();
  const isChat = pathname === "/student/assistant";
  return <div className="thoughtstream-theme min-h-dvh bg-[var(--ts-bg)] text-[var(--ts-text-primary)] transition-colors">
    <a href="#student-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-none focus:border focus:border-[var(--ts-border-strong)] focus:bg-[var(--ts-surface)] focus:px-4 focus:py-3 focus:text-[var(--ts-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ts-focus-ring)]">Đến nội dung chính</a>
    <Navbar />
    <main id="student-content" className={isChat ? "w-full" : "mx-auto w-full max-w-[1120px] px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8"}>
      {storageIssue && <p role="alert" className="mb-8 rounded-none border border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">{storageIssue}</p>}
      {children}
    </main>
  </div>;
}

export function StudentPortal({ children }: { children: ReactNode }) {
  const { currentUser, isDataLoading } = useStore();
  if (isDataLoading) return <div className="min-h-dvh"><Navbar /><LoadingState title="Đang tải dịch vụ sinh viên…" /></div>;
  if (!currentUser || currentUser.role !== "student") return <DataAccessState requiredRole="student" />;
  return <PortalContents>{children}</PortalContents>;
}
