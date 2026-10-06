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
    <div className="min-h-screen flex flex-col bg-transparent">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-16 h-16 border border-[#B91C1C]/30 bg-[#FEF2F2] dark:border-[#B91C1C]/50 dark:bg-[#450A0A]/30 rounded-none flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-[#B91C1C] dark:text-[#EF4444]" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-serif text-2xl font-normal text-[#1C1917] dark:text-[#FAFAF9] focus:outline-none"
          >
            Đã xảy ra lỗi hệ thống
          </h1>
          <p className="text-[#78716C] dark:text-[#A8A29E] text-sm">
            Rất tiếc, đã có sự cố không mong muốn trong quá trình xử lý yêu cầu.
          </p>
          {error.digest && (
            <div className="mt-4 p-3 bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] rounded-none text-xs font-mono text-[#78716C] dark:text-[#A8A29E] text-left overflow-hidden text-ellipsis">
              Mã lỗi: {error.digest}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-none border border-[#E7E5E4] dark:border-[#292524] bg-[#FAFAF9] dark:bg-[#141210] hover:bg-[#F5F5F4] dark:hover:bg-[#1C1917] text-[#1C1917] dark:text-[#FAFAF9] font-medium text-sm transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>

          <Link
            href="/"
            className="px-6 py-2.5 rounded-none bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:hover:bg-[#D6D3D1] text-[#FAFAF9] dark:text-[#1C1917] font-medium text-sm transition-colors"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
