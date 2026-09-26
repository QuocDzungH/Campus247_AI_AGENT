"use client";

import React, { useState } from "react";
import { RotateCcw, Check, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";

export function DemoBadge({ className = "" }: { className?: string }) {
  const { resetAllDemoData } = useStore();
  const [justReset, setJustReset] = useState(false);

  const handleReset = () => {
    resetAllDemoData();
    setJustReset(true);
    setTimeout(() => setJustReset(false), 2000);
  };

  return (
    <div className={`inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700/60 ${className}`}>
      <span className="flex items-center gap-1 font-mono text-[11px]">
        <Sparkles className="w-3 h-3 text-blue-500" />
        Bản mẫu · Dữ liệu giả lập
      </span>
      <button
        type="button"
        onClick={handleReset}
        title="Khôi phục trạng thái ban đầu"
        className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline pl-1 border-l border-slate-300 dark:border-slate-700"
      >
        {justReset ? (
          <>
            <Check className="w-3 h-3 text-emerald-500" />
            <span>Đã reset</span>
          </>
        ) : (
          <>
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </>
        )}
      </button>
    </div>
  );
}
