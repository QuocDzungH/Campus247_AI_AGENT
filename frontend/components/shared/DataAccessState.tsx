"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";

export function DataAccessState({ requiredRole }: { requiredRole?: "student" | "officer" | "admin" }) {
  const { currentUser, dataError } = useStore();
  const wrongRole = Boolean(currentUser && requiredRole && currentUser.role !== requiredRole);
  const destination =
    wrongRole && currentUser?.role === "student"
      ? "/my-requests"
      : wrongRole && currentUser?.role === "admin"
        ? "/admin"
        : wrongRole
          ? "/dashboard"
          : "/login";

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <Navbar />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-serif text-2xl font-normal text-[#1C1917] dark:text-[#FAFAF9]">
          {dataError ? "Không thể tải dữ liệu" : wrongRole ? "Bạn không có quyền vào khu vực này" : "Chưa có phiên đăng nhập"}
        </h1>
        <p role={dataError ? "alert" : undefined} className="text-sm text-[#57534E] dark:text-[#D6D3D1]">
          {dataError
            ? "Chưa tải được thông tin của bạn. Hãy thử lại sau."
            : wrongRole
            ? "Tài khoản hiện tại không có quyền truy cập khu vực này."
            : "Đăng nhập để sử dụng dịch vụ và theo dõi hồ sơ của bạn."}
        </p>
        <Link href={destination} className="mt-2 rounded-none bg-[#78716C] hover:bg-[#57534E] px-4 py-2 text-sm font-semibold text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917] dark:hover:bg-[#D6D3D1]">
          {wrongRole ? "Quay lại khu vực của bạn" : "Mở trang đăng nhập"}
        </Link>
      </main>
    </div>
  );
}
