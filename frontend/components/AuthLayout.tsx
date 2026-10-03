"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  introContent?: React.ReactNode;
}

export function AuthLayout({ children, introContent }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-[100svh] w-full flex-col overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Keep the focal point of the campus image visible between the two panels. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <Image
          src="/assets/images/home-banner-1-2.918477da.webp"
          alt=""
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-slate-950/25 dark:bg-slate-950/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/55 via-transparent to-slate-950/45" />
      </div>

      <header className="relative z-20 w-full px-4 py-4 sm:px-6 lg:px-8 xl:py-5">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform group-hover:scale-105">
              <GraduationCap className="h-6 w-6" />
          </div>
          <div className="min-w-0 shrink-0">
            <div className="flex items-center gap-2 whitespace-nowrap text-[15px] font-bold tracking-tight text-white drop-shadow-sm sm:text-lg">
              <span>Campus 24/7</span>
              <span className="hidden rounded border border-blue-300/30 bg-blue-400/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-100 backdrop-blur-sm min-[420px]:inline-flex">
                DỊCH VỤ SINH VIÊN
              </span>
            </div>
            <div className="hidden truncate text-[11px] font-medium uppercase tracking-wide text-slate-100 drop-shadow-sm min-[420px]:block">
              Dịch vụ học vụ VinUni
            </div>
          </div>
        </Link>

        </div>
      </header>

      {/* The empty middle column is intentional: it protects the campus focal point. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:py-10">
        <div className="grid w-full grid-cols-1 items-center gap-6 xl:grid-cols-[minmax(0,420px)_minmax(180px,1fr)_minmax(0,420px)] xl:gap-8">
          <section className="order-2 flex min-w-0 justify-center xl:order-1">
            <div className="w-full max-w-[420px] rounded-[28px] border border-white/25 bg-slate-950/50 p-7 text-white shadow-2xl shadow-slate-950/25 backdrop-blur-md sm:p-8">
              {introContent ? (
                introContent
              ) : (
                <div className="space-y-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                    <Sparkles className="h-3.5 w-3.5 text-blue-200" />
                    <span>Campus 24/7 · Dịch vụ sinh viên</span>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/90">
                      Cổng dịch vụ học vụ
                    </p>
                    <h1 className="text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl">
                      Dịch vụ học vụ trong tầm tay
                    </h1>
                    <p className="text-sm leading-relaxed text-slate-100/85 sm:text-base">
                      Chuẩn bị yêu cầu tài liệu, tra cứu hướng dẫn và theo dõi hồ sơ tại một nơi.
                    </p>
                  </div>

                  <div className="space-y-3 border-t border-white/15 pt-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <p className="text-sm leading-relaxed text-slate-100/85">
                        <span className="font-semibold text-white">Bạn kiểm tra trước khi gửi</span>
                        <span className="block text-xs text-slate-200/70">Không có hồ sơ nào được gửi tự động.</span>
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                      <p className="text-sm leading-relaxed text-slate-100/85">
                        <span className="font-semibold text-white">Cán bộ đối soát hồ sơ</span>
                        <span className="block text-xs text-slate-200/70">Thông tin quan trọng luôn được kiểm tra bởi con người.</span>
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                      <p className="text-sm leading-relaxed text-slate-100/85">
                        <span className="font-semibold text-white">Theo dõi từng bước xử lý</span>
                        <span className="block text-xs text-slate-200/70">Xem tiến trình, phản hồi và việc cần bổ sung trong hồ sơ.</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="order-2 hidden xl:block" aria-hidden="true" />

          <section className="order-1 flex min-w-0 justify-center xl:order-3">
            <div className="w-full max-w-[420px] rounded-[28px] border border-white/70 bg-white/[0.96] p-6 shadow-2xl shadow-slate-950/20 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/[0.96] sm:p-7">
              {children}
            </div>
          </section>
        </div>
      </main>

      <footer className="relative z-20 w-full border-t border-white/15 bg-slate-950/20 px-4 py-3 text-xs text-slate-100/75 backdrop-blur-sm sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-center text-center">
          <span>© 2026 Campus 24/7 · Dịch vụ sinh viên VinUni</span>
        </div>
      </footer>
    </div>
  );
}
