import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { DemoBanner } from '@/components/common/DemoBanner';

export const metadata: Metadata = {
  title: 'Campus 24/7 · Trợ lý Vận hành Học vụ AI',
  description: 'Hệ thống trợ lý học vụ 24/7 cho trường đại học — Quy trình cấp giấy xác nhận sinh viên & tiếp nhận khiếu nại L4',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="antialiased min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col relative selection:bg-blue-500/30 selection:text-blue-200">
        {/* Layer 1: Ambient Mesh Light Sources (The backdrop that feeds the glass frost) */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          {/* Subtle architectural dot grid */}
          <div 
            className="absolute inset-0 opacity-[0.25]" 
            style={{
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }} 
          />
          
          {/* Luminous Mesh Orbs that illuminate the frosted glass panels */}
          <div className="absolute -top-40 -left-40 w-[42rem] h-[42rem] bg-blue-600/18 rounded-full blur-[130px]" />
          <div className="absolute top-[18%] -right-36 w-[38rem] h-[38rem] bg-indigo-600/16 rounded-full blur-[120px]" />
          <div className="absolute top-[50%] left-[8%] w-[36rem] h-[36rem] bg-sky-500/12 rounded-full blur-[140px]" />
          <div className="absolute -bottom-32 right-[12%] w-[44rem] h-[44rem] bg-blue-700/16 rounded-full blur-[130px]" />
          <div className="absolute top-[38%] right-[32%] w-[24rem] h-[24rem] bg-amber-500/10 rounded-full blur-[110px]" />
        </div>

        <StoreProvider>
          <DemoBanner />
          <div className="flex-1 flex flex-col">{children}</div>
        </StoreProvider>
      </body>
    </html>
  );
}
