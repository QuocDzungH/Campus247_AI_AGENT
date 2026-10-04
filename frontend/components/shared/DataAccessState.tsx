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
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {dataError ? "Không thể tải dữ liệu" : wrongRole ? "Bạn không có quyền vào khu vực này" : "Chưa có phiên đăng nhập"}
        </h1>
        <p role={dataError ? "alert" : undefined} className="text-sm text-slate-600 dark:text-slate-300">
          {dataError
            ? "Chưa tải được thông tin của bạn. Hãy thử lại sau."
            : wrongRole
            ? "Tài khoản hiện tại không có quyền truy cập khu vực này."
            : "Đăng nhập để sử dụng dịch vụ và theo dõi hồ sơ của bạn."}
        </p>
        <Link href={destination} className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          {wrongRole ? "Quay lại khu vực của bạn" : "Mở trang đăng nhập"}
        </Link>
      </main>
    </div>
  );
}
