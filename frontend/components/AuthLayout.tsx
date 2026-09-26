"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap, ShieldCheck, Cpu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { DemoBadge } from "./DemoBadge";

interface AuthLayoutProps {
  children: React.ReactNode;
  introContent?: React.ReactNode;
}

export function AuthLayout({ children, introContent }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Full Viewport Campus Wallpaper */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-700"
        style={{
          backgroundImage: "url('/assets/images/home-banner-1-2.918477da.webp')",
        }}
      >
        {/* Subtle base gradient so background image stays vibrant but dark/light modes have appropriate contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/60 via-slate-900/30 to-slate-900/50 dark:from-[#0B0F17]/80 dark:via-[#0B0F17]/50 dark:to-[#0B0F17]/70" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 w-full px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold tracking-tight text-white text-lg drop-shadow-sm">
              Campus 24/7
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30 font-semibold backdrop-blur-sm">
                AI OPS
              </span>
            </div>
            <div className="text-[11px] text-slate-200 font-medium tracking-wide uppercase drop-shadow-sm">
              Hệ Thống Trợ Lý Vận Hành Học Vụ AI
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <DemoBadge className="hidden sm:inline-flex bg-white/20 dark:bg-slate-900/60 backdrop-blur-md text-white border-white/20" />
          <div className="bg-white/20 dark:bg-slate-900/60 backdrop-blur-md p-1 rounded-xl border border-white/20">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content: Left 55-60% Frosted Glass & Right 380-440px Functional Card */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-stretch justify-between w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-8">
        {/* Left Side: Frosted Glass Panel with Diagonal Edge (55-60%) */}
        <div className="flex-1 flex flex-col justify-center min-w-0 lg:max-w-[58%]">
          <div className="relative rounded-3xl overflow-hidden p-6 sm:p-10 border border-white/30 dark:border-white/10 shadow-2xl backdrop-blur-xl bg-white/75 dark:bg-[#0B0F17]/80 transition-all">
            {introContent ? (
              introContent
            ) : (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-600/10 dark:bg-blue-400/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Campus 24/7 · Trợ lý Vận hành Học vụ AI</span>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                    Cổng Tiếp nhận & Xử lý Dịch Vụ Học Vụ
                  </h1>
                  <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                    Mô hình phối hợp Người và AI: AI thu thập và chuẩn bị hồ sơ sẵn; Sinh viên và Cán bộ giữ quyền kiểm tra và duyệt trước mỗi lần gửi.
                  </p>
                </div>

                {/* 3 Core Rules Preview */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs mb-1">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Cổng 1 (Sinh viên)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                      SV xem lại toàn bộ thông tin kê khai trước khi gửi; chưa cấp giấy tại bước này.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs mb-1">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Cổng 2 (Cán bộ)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                      Cán bộ thẩm định đối soát 3 nguồn; AI không tự ý resolved hoặc đóng hồ sơ.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs mb-1">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Chốt chặn L4</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                      Tự động ngắt AI khi có khiếu nại điểm thi môn học, bảo vệ tính trung thực học thuật.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: 380-440px Functional Glass Card */}
        <div className="w-full lg:w-[420px] flex items-center justify-center shrink-0">
          <div className="w-full rounded-3xl p-7 border border-white/40 dark:border-white/10 shadow-2xl backdrop-blur-2xl bg-white/85 dark:bg-[#111827]/85 transition-all">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 w-full px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-200/80 gap-2 border-t border-white/10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span>© 2026 Đại học Quốc gia. Vận hành bởi AI Academic Ops Framework.</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/chat" className="hover:underline hover:text-white">Quy chế đào tạo L1</Link>
          <Link href="/dashboard" className="hover:underline hover:text-white">Cam kết SLA</Link>
          <Link href="/my-requests" className="hover:underline hover:text-white">Trợ giúp trực tuyến</Link>
        </div>
      </footer>
    </div>
  );
}
