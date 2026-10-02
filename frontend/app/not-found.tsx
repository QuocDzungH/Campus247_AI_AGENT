"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Navbar } from "@/components/Navbar";

export default function NotFound() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17]">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center">
          <FileSearch className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="space-y-2">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold text-slate-900 dark:text-white focus:outline-none"
          >
            Không tìm thấy trang (404)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-md">
            Địa chỉ bạn truy cập không tồn tại hoặc đã bị xóa. Vui lòng kiểm tra lại đường dẫn.
          </p>
        </div>
        <Link href="/" className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shadow-xs">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
