"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { DEMO_USERS } from "@/lib/mock-data";

export default function WelcomePage() {
  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Chọn Cổng Đăng Nhập</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Truy Cập Hệ Thống
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Vui lòng chọn vai trò để chuyển đến màn đăng nhập tương ứng.
          </p>
        </div>

        {/* Portal 1: Student */}
        <div className="p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/30 dark:to-slate-900/40 hover:border-blue-400 dark:hover:border-blue-700 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                SV
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {DEMO_USERS.SV001.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  MSSV: {DEMO_USERS.SV001.id} · {DEMO_USERS.SV001.major}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              Sinh viên
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
            Tra cứu quy chế L1, xin cấp Giấy xác nhận học tập qua Cổng kiểm duyệt 1, và gửi khiếu nại L4 khi cần.
          </p>

          <Link
            href="/login?role=student"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all group-hover:translate-x-0.5"
          >
            <span>Vào cổng Sinh viên</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Portal 2: Officer */}
        <div className="p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 dark:from-indigo-950/30 dark:to-slate-900/40 hover:border-indigo-400 dark:hover:border-indigo-700 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                CB
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {DEMO_USERS.OF001.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Mã NV: {DEMO_USERS.OF001.id} · {DEMO_USERS.OF001.department}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              Cán bộ
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
            Hàng chờ thẩm định L2/L4, Facts đối soát 3 nguồn, kiểm tra checklist và duyệt phản hồi Cổng 2.
          </p>

          <Link
            href="/login?role=officer"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/25 transition-all group-hover:translate-x-0.5"
          >
            <span>Vào bàn làm việc Cán bộ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="pt-1 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <span>Hoặc đăng nhập bằng tài khoản khác</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
