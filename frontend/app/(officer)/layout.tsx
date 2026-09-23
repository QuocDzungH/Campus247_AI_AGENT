'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  Briefcase,
  LayoutDashboard,
  Inbox,
  CheckCircle,
  AlertTriangle,
  User,
  ShieldAlert,
  GraduationCap,
  Settings,
  HelpCircle,
} from 'lucide-react';

export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, switchUser, tickets, isL4Active } = useStore();

  React.useEffect(() => {
    if (currentUser.id !== 'OF001') {
      switchUser('OF001');
    }
  }, [currentUser.id, switchUser]);

  const pendingCount = tickets.filter((t) => t.status === 'open' || t.status === 'pending_officer').length;
  const highPriorityCount = tickets.filter((t) => t.priority === 'high' && t.status !== 'resolved').length;

  return (
    <div className="flex-1 flex min-h-screen">
      {/* Officer Sidebar (248px standard per spec) */}
      <aside className="w-[248px] shrink-0 glass-panel border-r border-white/[0.08] hidden md:flex flex-col justify-between p-4 sticky top-0 h-screen">
        <div>
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-3 mb-4 group">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight block">Campus 24/7</span>
              <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider block">
                Bàn làm việc Học vụ
              </span>
            </div>
          </Link>

          {/* Officer Profile Badge */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-6 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-[10px]">
                OF
              </div>
              <div>
                <div className="font-bold text-white leading-none">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 tabular-nums">Mã: {currentUser.id}</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-1.5 border-t border-white/[0.06] mt-1">
              Phòng Đào tạo & CTSV
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs">
            <div className="px-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Nghiệp vụ xử lý
            </div>

            <Link
              href="/dashboard"
              className={`flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-all ${
                pathname === '/dashboard' || pathname.startsWith('/tickets')
                  ? 'bg-indigo-600 text-white shadow-[0_4px_16px_rgba(99,102,241,0.4)]'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span>Hàng chờ tiếp nhận</span>
              </div>
              {pendingCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                    pathname.startsWith('/dashboard')
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </Link>

            {highPriorityCount > 0 && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  <span className="font-semibold text-[11px]">Hồ sơ ưu tiên Cao</span>
                </div>
                <span className="font-bold font-mono text-[11px] tabular-nums">{highPriorityCount}</span>
              </div>
            )}
          </nav>
        </div>

        {/* Footer Sidebar Info */}
        <div className="pt-4 border-t border-white/[0.08] space-y-2">
          <button
            type="button"
            onClick={() => switchUser('SV001')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-white/[0.08] text-xs font-semibold transition-colors"
          >
            <GraduationCap className="w-4 h-4 text-blue-400" />
            <span>Chuyển sang vai Sinh viên</span>
          </button>
          <div className="text-[10px] text-slate-500 text-center font-mono">
            Campus 24/7 Academic Ops v1.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header Bar */}
        <div className="md:hidden glass-panel border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-sm text-white">Bàn làm việc Cán bộ</span>
          </div>
          <Link
            href="/chat"
            onClick={() => switchUser('SV001')}
            className="text-xs font-semibold text-blue-400 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30"
          >
            Sang cổng SV
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}
