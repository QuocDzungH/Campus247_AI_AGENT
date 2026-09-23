'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { Sparkles, RefreshCw, UserCheck, ShieldAlert, Layers } from 'lucide-react';
import Link from 'next/link';

export function DemoBanner() {
  const { currentUser, switchUser, resetDemoData, isL4Active } = useStore();

  return (
    <div className="relative z-50 w-full bg-[#0B0F17]/85 text-white backdrop-blur-xl border-b border-white/[0.08] px-4 py-2.5 text-xs shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: System Status & Demo Flag */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
            </span>
            <span className="tracking-wide">Bản mẫu · Dữ liệu giả lập</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-slate-400 text-xs">
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            <span className="font-medium text-slate-300">Campus 24/7 Academic Ops</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono">
              Pipeline L2·L3·L4
            </span>
          </div>

          {isL4Active && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/35 text-[11px] font-semibold animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.3)]">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              L4 Bàn giao đang kích hoạt
            </span>
          )}
        </div>

        {/* Right: Quick Role Switcher + Reset */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Glass segmented switcher */}
          <div className="flex items-center bg-white/[0.06] backdrop-blur-md rounded-xl p-1 border border-white/[0.1] shadow-inner">
            <Link
              href="/chat"
              onClick={() => switchUser('SV001')}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                currentUser.id === 'SV001'
                  ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              Sinh viên (SV001)
            </Link>
            <Link
              href="/dashboard"
              onClick={() => switchUser('OF001')}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                currentUser.id === 'OF001'
                  ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              Cán bộ (OF001)
            </Link>
          </div>

          {/* Reset button */}
          <button
            onClick={resetDemoData}
            title="Khôi phục dữ liệu mẫu ban đầu"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.1] text-[11px] font-medium transition-all duration-150 active:scale-95"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
            <span className="hidden sm:inline">Đặt lại</span>
          </button>
        </div>
      </div>
    </div>
  );
}
