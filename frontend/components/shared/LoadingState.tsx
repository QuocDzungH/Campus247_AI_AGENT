import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  title?: string;
  description?: string;
}

export function LoadingState({ title = "Đang tải dữ liệu...", description }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center animate-in fade-in">
      <Loader2 className="w-8 h-8 text-[#78716C] dark:text-[#A8A29E] animate-spin" />
      <div>
        <h3 className="font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">{title}</h3>
        {description && (
          <p className="text-sm text-[#57534E] dark:text-[#D6D3D1] mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}
