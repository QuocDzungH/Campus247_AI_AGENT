"use client";

import React, { useState } from "react";
import { RotateCcw, Check, Sparkles, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";

export function DemoBadge({ className = "" }: { className?: string }) {
  const { resetAllDemoData } = useStore();
  const [justReset, setJustReset] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    setResetError(null);
    try {
      await resetAllDemoData();
      setIsConfirmOpen(false);
      setJustReset(true);
      setTimeout(() => setJustReset(false), 2000);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 border-slate-200 bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800/80 ${className}`}>
        <span className="flex items-center gap-1 font-medium text-[11px]">
          <Sparkles className="w-3 h-3 text-blue-500" />
          Môi trường demo
        </span>
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          title="Khôi phục dữ liệu mẫu"
          aria-label="Khôi phục dữ liệu mẫu"
          className="inline-flex min-h-6 items-center gap-1 border-l border-slate-300 pl-2 text-[11px] text-blue-600 hover:underline dark:border-slate-700 dark:text-blue-400"
        >
          {justReset ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span>Đã khôi phục</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3 h-3" />
              <span>Khôi phục</span>
            </>
          )}
        </button>
      </div>

      <AccessibleDialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        preventClose={isResetting}
        labelledBy="reset-demo-dialog-title"
        className="w-full max-w-sm"
      >
        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl space-y-4">
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 id="reset-demo-dialog-title" className="text-base font-bold text-slate-900 dark:text-white">
              Khôi phục dữ liệu mẫu?
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Toàn bộ dữ liệu bạn đã tạo thêm hoặc chỉnh sửa sẽ bị xóa. Hệ thống sẽ trở về trạng thái 3 hồ sơ mẫu ban đầu.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            {resetError && (
              <div role="alert" className="text-xs text-red-500 mr-auto">{resetError}</div>
            )}
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isResetting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isResetting}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResetting ? "Đang khôi phục..." : "Khôi phục dữ liệu"}
            </button>
          </div>
        </div>
      </AccessibleDialog>
    </>
  );
}
