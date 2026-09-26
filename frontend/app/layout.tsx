import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Campus 24/7 - Hệ thống Trợ lý Vận hành Học vụ AI",
  description: "Cổng Tiếp nhận & Xử lý Dịch Vụ Học vụ Campus 24/7 - Mô hình phối hợp Người và AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white relative bg-slate-100/80 dark:bg-[#070A10] transition-colors">
        {/* Full-view Luminous & Campus Refraction Backdrop for Real Glassmorphism */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {/* Subtle Campus Graphic Texture for backdrop refraction */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.16] dark:opacity-[0.10] filter saturate-150 contrast-125"
            style={{
              backgroundImage: "url('/assets/images/home-banner-1-2.918477da.webp')",
            }}
          />

          {/* Dynamic Aurora Luminous Orbs */}
          <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] bg-gradient-to-br from-blue-500/35 to-indigo-600/30 dark:from-blue-600/30 dark:to-indigo-500/25 rounded-full blur-[110px]" />
          <div className="absolute top-1/4 -right-32 w-[34rem] h-[34rem] bg-gradient-to-tr from-cyan-400/30 via-sky-500/25 to-indigo-500/30 dark:from-cyan-600/25 dark:via-blue-600/20 dark:to-purple-600/25 rounded-full blur-[120px]" />
          <div className="absolute -bottom-32 left-1/3 w-[38rem] h-[38rem] bg-gradient-to-tr from-indigo-500/30 via-purple-500/25 to-pink-500/20 dark:from-indigo-600/25 dark:via-purple-600/20 dark:to-slate-900/30 rounded-full blur-[130px]" />
          <div className="absolute top-2/3 -left-32 w-[28rem] h-[28rem] bg-gradient-to-r from-emerald-400/20 to-teal-500/20 dark:from-teal-600/15 dark:to-emerald-600/15 rounded-full blur-[110px]" />

          {/* Subtle Glass Dot Grid */}
          <div className="absolute inset-0 bg-dot-pattern opacity-60 dark:opacity-40" />
        </div>

        <StoreProvider>
          <div className="relative z-10 flex-1 flex flex-col min-h-0">
            {children}
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
