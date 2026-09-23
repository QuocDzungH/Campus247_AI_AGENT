'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  GraduationCap,
  MessageSquareText,
  FileCheck2,
  User,
  ArrowLeftRight,
  ShieldAlert,
} from 'lucide-react';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, switchUser, tickets, isL4Active } = useStore();

  React.useEffect(() => {
    if (currentUser.id !== 'SV001') {
      switchUser('SV001');
    }
  }, [currentUser.id, switchUser]);

  const myTickets = tickets.filter((t) => t.studentId === currentUser.id);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Student Navigation Header */}
      <header className="w-full glass-panel border-b border-white/[0.08] px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Brand & Identity */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-white text-sm tracking-tight block">Campus 24/7</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Cổng Dịch vụ Sinh viên</span>
              </div>
            </Link>

            {/* Student ID Chip */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="font-semibold text-slate-200">{currentUser.name}</span>
              <span className="text-slate-400 font-mono text-[11px] tabular-nums">({currentUser.id})</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <Link
              href="/chat"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                pathname.startsWith('/chat')
                  ? 'bg-blue-600 text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <MessageSquareText className="w-4 h-4" />
              <span>Hỗ trợ trực tuyến & Xin giấy</span>
              {isL4Active && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse ml-0.5 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              )}
            </Link>

            <Link
              href="/my-requests"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                pathname.startsWith('/my-requests')
                  ? 'bg-blue-600 text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Yêu cầu của tôi</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                  pathname.startsWith('/my-requests')
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.1] text-slate-300'
                }`}
              >
                {myTickets.length}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
