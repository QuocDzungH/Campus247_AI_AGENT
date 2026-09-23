'use client';

import React from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/common/GlassCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CheckCircle2, ArrowRight, ShieldCheck, Clock, FileText } from 'lucide-react';

interface TicketSuccessCardProps {
  ticketId: string;
}

export function TicketSuccessCard({ ticketId }: TicketSuccessCardProps) {
  return (
    <GlassCard elevated className="mt-3.5 p-5 bg-emerald-500/[0.1] border-emerald-500/30 shadow-[0_8px_24px_rgba(16,185,129,0.15)] text-xs">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm tracking-tight">
              Đã nộp yêu cầu vào hệ thống trường thành công!
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono font-extrabold text-blue-300 text-xs tabular-nums bg-white/[0.08] px-2.5 py-0.5 rounded-md border border-white/[0.1] shadow-sm">
                Mã: {ticketId}
              </span>
              <StatusBadge status="open" size="sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-slate-300 leading-relaxed mb-4 pl-12 font-normal">
        <p>
          Hồ sơ yêu cầu cấp <strong className="font-semibold text-white">Giấy xác nhận sinh viên</strong> của bạn đã được ghi nhận trên hàng chờ của Cán bộ hỗ trợ học vụ.
        </p>
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] text-slate-300 flex items-start gap-2 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-white">Lưu ý nghiệp vụ:</strong> Văn bản giấy hoặc chữ ký số <span className="underline font-semibold text-amber-300">chưa được ban hành</span> tại bước này. Cán bộ học vụ sẽ đối soát điều kiện sinh viên và thông báo kết quả qua mục "Yêu cầu của tôi".
          </span>
        </div>
      </div>

      <div className="pt-3.5 border-t border-emerald-500/25 flex items-center justify-between pl-12">
        <span className="text-[11px] text-slate-400 font-medium">Trạng thái hiện tại: Chờ cán bộ tiếp nhận xử lý</span>
        <Link
          href="/my-requests"
          className="btn-primary-glass bg-emerald-600 hover:bg-emerald-500 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
        >
          <span>Xem trong Yêu cầu của tôi</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </GlassCard>
  );
}
