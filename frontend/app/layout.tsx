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
      <body className="min-h-screen flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
