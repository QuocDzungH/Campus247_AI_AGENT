import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { DraftSessionProvider } from "@/lib/draft-context";
import { DataSourceError } from "@/components/shared/DataSourceError";
import { StudentRuntime } from "@/components/student/StudentRuntime";

export const metadata: Metadata = {
  title: "Campus 24/7 · Dịch vụ sinh viên",
  description: "Yêu cầu tài liệu học vụ, tra cứu hướng dẫn và theo dõi hồ sơ sinh viên trong Campus 24/7.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white transition-colors" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>

        <StoreProvider>
          <DraftSessionProvider>
            <DataSourceError />
            <div className="flex-1 flex flex-col min-h-0">
              <StudentRuntime>{children}</StudentRuntime>
            </div>
          </DraftSessionProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
