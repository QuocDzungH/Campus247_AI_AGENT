'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/common/GlassCard';
import {
  GraduationCap,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';

export default function LoginPage() {
  const { switchUser } = useStore();
  const router = useRouter();

  const handleSelectRole = (userId: 'SV001' | 'OF001', targetPath: string) => {
    switchUser(userId);
    router.push(targetPath);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* Brand Header */}
      <div className="text-center mb-8 sm:mb-12 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25 text-xs font-semibold mb-5 shadow-[0_0_16px_rgba(59,130,246,0.15)] backdrop-blur-md">
          <GraduationCap className="w-4 h-4 text-blue-400" />
          <span className="tracking-wide">Hệ thống Hỗ trợ Học vụ Thông minh 24/7</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-[1.15]">
          Campus 24/7 · Cổng tiếp nhận Dịch vụ Học vụ
        </h1>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-normal">
          Quy trình mẫu chuẩn hóa hai giai đoạn: AI tự động hóa khâu thu thập & chuẩn bị hồ sơ;
          con người kiểm duyệt bắt buộc tại hai cổng <span className="font-semibold text-slate-200">Submit 1 (Sinh viên)</span> và{' '}
          <span className="font-semibold text-slate-200">Submit 2 (Cán bộ)</span>.
        </p>
      </div>

      {/* Role Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-10">
        {/* Card 1: Student SV001 */}
        <GlassCard
          hoverable
          elevated
          onClick={() => handleSelectRole('SV001', '/chat')}
          className="p-7 sm:p-8 flex flex-col justify-between group hover:border-blue-500/40 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-13 h-13 p-3 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                <GraduationCap className="w-7 h-7" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm backdrop-blur-md">
                Cổng Sinh viên
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white mb-1 group-hover:text-blue-400 transition-colors">
              Nguyễn Văn An
            </h2>
            <div className="text-xs font-mono text-slate-400 mb-4 tabular-nums font-medium">
              MSSV: SV001 · Khóa 18 · CNTT
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6 font-normal">
              Tra cứu quy chế học tập (L1), xin cấp Giấy xác nhận sinh viên với cổng kiểm duyệt preview{' '}
              <strong className="font-semibold text-white">(Submit 1)</strong>, và trải nghiệm cơ chế phanh an toàn{' '}
              <strong className="font-semibold text-white">(L4 khiếu nại)</strong>.
            </p>
          </div>

          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
            <span>Vào vai Sinh viên (SV001)</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </GlassCard>

        {/* Card 2: Officer OF001 */}
        <GlassCard
          hoverable
          elevated
          onClick={() => handleSelectRole('OF001', '/dashboard')}
          className="p-7 sm:p-8 flex flex-col justify-between group hover:border-indigo-500/40 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-13 h-13 p-3 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                <Briefcase className="w-7 h-7" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm backdrop-blur-md">
                Cổng Cán bộ Học vụ
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white mb-1 group-hover:text-indigo-400 transition-colors">
              Cán bộ hỗ trợ học vụ
            </h2>
            <div className="text-xs font-mono text-slate-400 mb-4 tabular-nums font-medium">
              Mã NV: OF001 · Phòng Đào tạo & CTSV
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6 font-normal">
              Hàng chờ tiếp nhận thông minh được AI phân loại ưu tiên, xem trọn bộ hồ sơ do AI chuẩn bị sẵn{' '}
              <strong className="font-semibold text-white">(AI Dossier)</strong>, và thực hiện kiểm duyệt phản hồi / hoàn tất{' '}
              <strong className="font-semibold text-white">(Submit 2)</strong>.
            </p>
          </div>

          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
            <span>Vào vai Cán bộ (OF001)</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </GlassCard>
      </div>

      {/* Pipeline Visual Guide Banner */}
      <GlassCard className="w-full max-w-3xl p-5 sm:p-6 border-white/[0.08]">
        <div className="flex items-center gap-2 mb-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Nguyên tắc vận hành cốt lõi (Khóa Pipeline)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] shadow-sm">
            <div className="font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              1. Cổng Submit 1 (SV)
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
              SV phải review và bấm Xác nhận nộp yêu cầu. Tuyệt đối không tự nộp, không phát hành PDF đã ký.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] shadow-sm">
            <div className="font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
              2. Cổng Submit 2 (CB)
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
              Gửi phản hồi chỉ đổi sang Chờ cán bộ (không tự hoàn tất). Chỉ nút "Hoàn tất xử lý" mới đóng ca.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] shadow-sm">
            <div className="font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              3. Cơ chế dừng L4
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
              Khiếu nại/nhạy cảm: AI lập tức câm, dừng tư vấn điểm, bàn giao ticket Cao sang cán bộ xử lý.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
