"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Navbar } from "@/components/Navbar";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error Caught:", error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17]">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-950/50 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-rose-600 dark:text-rose-500" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold text-slate-900 dark:text-white focus:outline-none"
          >
            Đã xảy ra lỗi hệ thống
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Rất tiếc, đã có sự cố không mong muốn trong quá trình xử lý yêu cầu.
          </p>
          {error.digest && (
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-mono text-slate-500 text-left overflow-hidden text-ellipsis">
              Mã lỗi: {error.digest}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition-colors shadow-xs"
          >
            <RefreshCcw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>

          <Link
            href="/"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shadow-xs"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
