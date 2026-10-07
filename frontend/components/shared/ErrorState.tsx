import React from "react";
import { AlertOctagon } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Đã xảy ra lỗi", description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-[#FEF2F2] dark:bg-[rgba(127,29,29,0.2)] border border-[#FECACA] dark:border-[rgba(239,68,68,0.3)] rounded-none">
      <AlertOctagon className="w-10 h-10 text-[#DC2626] dark:text-[#FCA5A5] mb-3" />
      <h3 className="font-serif text-base font-semibold text-[#B91C1C] dark:text-[#FCA5A5] mb-1">{title}</h3>
      <p className="text-sm text-[#57534E] dark:text-[#D6D3D1] mb-4">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-[#78716C] hover:bg-[#57534E] text-[#FAFAF9] rounded-none text-sm font-medium transition-colors"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
