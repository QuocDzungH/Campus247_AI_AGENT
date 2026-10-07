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
      <div className={`inline-flex items-center gap-2 rounded-none border px-3 py-1 text-xs text-[#57534E] dark:text-[#D6D3D1] border-[#D6D3D1] bg-[#F5F5F4] dark:border-[#44403C] dark:bg-[#1C1917] ${className}`}>
        <span className="flex items-center gap-1 font-medium text-[11px]">
          <Sparkles className="w-3 h-3 text-[#78716C] dark:text-[#A8A29E]" />
          Môi trường demo
        </span>
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          title="Khôi phục dữ liệu mẫu"
          aria-label="Khôi phục dữ liệu mẫu"
          className="inline-flex min-h-6 items-center gap-1 border-l border-[#D6D3D1] pl-2 text-[11px] text-[#78716C] hover:underline dark:border-[#44403C] dark:text-[#A8A29E]"
        >
          {justReset ? (
            <>
              <Check className="w-3 h-3 text-[#65A30D]" />
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
        <div className="p-6 bg-[#FAFAF9] dark:bg-[#1C1917] rounded-none border border-[#E7E5E4] dark:border-[#292524] space-y-4">
          <div className="flex items-center gap-3 text-[#CA8A04] dark:text-[#FDE047]">
            <div className="w-10 h-10 rounded-none border border-[#FEF08A] dark:border-[rgba(234,179,8,0.4)] bg-[#FEFCE8] dark:bg-[rgba(113,63,18,0.35)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 id="reset-demo-dialog-title" className="font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">
              Khôi phục dữ liệu mẫu?
            </h2>
          </div>
          <p className="text-sm text-[#57534E] dark:text-[#D6D3D1]">
            Toàn bộ dữ liệu bạn đã tạo thêm hoặc chỉnh sửa sẽ bị xóa. Hệ thống sẽ trở về trạng thái 3 hồ sơ mẫu ban đầu.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            {resetError && (
              <div role="alert" className="text-xs text-[#DC2626] mr-auto">{resetError}</div>
            )}
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isResetting}
              className="px-4 py-2 rounded-none text-sm font-semibold border border-[#D6D3D1] dark:border-[#44403C] text-[#57534E] dark:text-[#D6D3D1] hover:bg-[#F5F5F4] dark:hover:bg-[#292524] transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isResetting}
              className="px-4 py-2 rounded-none bg-[#CA8A04] hover:bg-[#A16207] text-[#FAFAF9] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResetting ? "Đang khôi phục..." : "Khôi phục dữ liệu"}
            </button>
          </div>
        </div>
      </AccessibleDialog>
    </>
  );
}
