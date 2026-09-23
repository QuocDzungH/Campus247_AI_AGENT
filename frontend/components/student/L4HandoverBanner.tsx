'use client';

import React from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/common/GlassCard';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  PhoneCall,
  UserCheck,
  Lock,
} from 'lucide-react';

interface L4HandoverBannerProps {
  ticketId: string;
}

export function L4HandoverBanner({ ticketId }: L4HandoverBannerProps) {
  return (
    <GlassCard elevated className="mt-3.5 p-5 bg-amber-500/[0.12] border-amber-500/35 shadow-[0_8px_24px_rgba(245,158,11,0.2)] text-xs">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/35 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-amber-300 text-sm tracking-tight">
                Phanh an toàn L4: Đã bàn giao sang Cán bộ hỗ trợ học vụ
              </h4>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono font-extrabold text-amber-300 text-xs tabular-nums bg-white/[0.08] px-2.5 py-0.5 rounded-md border border-white/[0.1] shadow-sm">
                Hồ sơ: {ticketId}
              </span>
              <PriorityBadge priority="high" size="sm" />
              <StatusBadge status="pending_officer" size="sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="pl-12 space-y-2 text-slate-300 leading-relaxed mb-4">
        <p className="font-normal">
          Hệ thống phát hiện nội dung mang tính chất <strong className="font-bold text-amber-300">khiếu nại học vụ / nhạy cảm</strong> vượt thẩm quyền giải quyết của AI.
        </p>
        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-amber-500/25 text-[11px] text-slate-300 flex items-start gap-2 shadow-sm">
          <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="text-white block mb-1">Trạng thái xử lý theo quy định:</strong>
            <div>• Trợ lý AI đã <strong className="text-rose-400">dừng phản hồi tự động</strong> trên phiên này.</div>
            <div>• Hồ sơ đã được đẩy thẳng vào hàng chờ ưu tiên <strong className="text-rose-400">Cao</strong> của Cán bộ học vụ.</div>
            <div>• Ô soạn thảo phía dưới đã chuyển sang chế độ <strong className="text-blue-400">Gửi thông tin bổ sung cho cán bộ</strong>.</div>
          </div>
        </div>
      </div>

      <div className="pt-3.5 border-t border-amber-500/25 flex items-center justify-between pl-12">
        <span className="text-[11px] text-slate-400 font-medium">
          Cán bộ phụ trách sẽ liên hệ qua thông báo hệ thống hoặc email trường.
        </span>
        <Link
          href="/my-requests"
          className="btn-primary-glass bg-amber-600 hover:bg-amber-500 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
        >
          <span>Xem tiến độ hồ sơ L4</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </GlassCard>
  );
}
