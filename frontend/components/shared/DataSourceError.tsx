"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { AlertTriangle } from "lucide-react";
import { usePathname } from "next/navigation";

export function DataSourceError() {
  const { dataError, reloadData, isDataLoading } = useStore();
  const pathname = usePathname();

  // This page renders an inline error and retry action, without a covering technical toast.
  if (!dataError || pathname === "/my-requests") return null;

  const title = "Chưa tải được thông tin";

  return (
    <div role="alert" className="mx-auto my-3 flex w-[90%] max-w-xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-bold mb-1">{title}</p>
        <p>{dataError.message} Thông tin đã lưu vẫn được giữ; hãy thử tải lại.</p>
        <button type="button" disabled={isDataLoading} onClick={() => void reloadData().catch(() => { /* Error remains in the store for retry. */ })} className="mt-2 min-h-11 rounded-lg px-3 font-semibold underline disabled:opacity-50">{isDataLoading ? "Đang tải…" : "Thử tải lại"}</button>
      </div>
    </div>
  );
}
