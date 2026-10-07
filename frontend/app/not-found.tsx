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
    <div className="min-h-screen flex flex-col bg-transparent">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-16 h-16 border border-[#E7E5E4] bg-[#F5F5F4] dark:border-[#292524] dark:bg-[#1C1917] rounded-none flex items-center justify-center">
          <FileSearch className="w-8 h-8 text-[#78716C] dark:text-[#A8A29E]" />
        </div>
        <div className="space-y-2">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-serif text-2xl font-normal text-[#1C1917] dark:text-[#FAFAF9] focus:outline-none"
          >
            Không tìm thấy trang (404)
          </h1>
          <p className="text-sm text-[#78716C] dark:text-[#A8A29E] max-w-md">
            Địa chỉ bạn truy cập không tồn tại hoặc đã bị xóa. Vui lòng kiểm tra lại đường dẫn.
          </p>
        </div>
        <Link href="/" className="px-6 py-2.5 rounded-none bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:hover:bg-[#D6D3D1] text-[#FAFAF9] dark:text-[#1C1917] font-medium text-sm transition-colors">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
