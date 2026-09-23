'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { GlassCard } from '@/components/common/GlassCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  CheckSquare,
  Square,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  User,
  Hash,
  FileText,
  AlertTriangle,
  History,
  ShieldCheck,
  MessageSquare,
  Edit3,
} from 'lucide-react';

export default function OfficerTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.ticketId as string;

  const {
    getTicketById,
    officerSendReply,
    officerRequestMoreInfo,
    officerCompleteTicket,
  } = useStore();

  const ticket = getTicketById(ticketId);

  const [draftReply, setDraftReply] = useState<string>(ticket?.aiDraftReply || '');
  const [checklist, setChecklist] = useState(ticket?.aiChecklist || []);
  const [supplementaryNote, setSupplementaryNote] = useState<string>('');
  const [showMoreInfoModal, setShowMoreInfoModal] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  if (!ticket) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto text-center">
        <GlassCard elevated className="p-12 border-white/[0.08] shadow-2xl">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">
            Không tìm thấy hồ sơ {ticketId}
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Mã yêu cầu này không tồn tại hoặc đã bị xóa khỏi hệ thống.
          </p>
          <Link
            href="/dashboard"
            className="btn-primary-glass inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại hàng chờ tiếp nhận</span>
          </Link>
        </GlassCard>
      </div>
    );
  }

  // Toggle checklist items
  const handleToggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  // Submit 2 Action 1: Send reply (NOT resolved!)
  const handleSendReply = () => {
    if (!draftReply.trim()) return;

    officerSendReply(ticket.id, draftReply);
    setActionFeedback({
      type: 'info',
      message:
        '✓ Đã gửi phản hồi thành công đến sinh viên! Trạng thái hồ sơ chuyển sang: "Chờ cán bộ" (pending_officer). Lưu ý: Hồ sơ CHƯA hoàn tất cho đến khi bấm "Hoàn tất xử lý".',
    });
    setTimeout(() => setActionFeedback(null), 6000);
  };

  // Submit 2 Action 2: Request more info
  const handleRequestMoreInfo = () => {
    if (!supplementaryNote.trim()) return;

    officerRequestMoreInfo(ticket.id, supplementaryNote);
    setSupplementaryNote('');
    setShowMoreInfoModal(false);
    setActionFeedback({
      type: 'info',
      message: '✓ Đã gửi thông báo yêu cầu sinh viên bổ sung tài liệu. Hồ sơ vẫn đang mở.',
    });
    setTimeout(() => setActionFeedback(null), 6000);
  };

  // Submit 2 Action 3: Complete ticket (Sets resolved)
  const handleCompleteTicket = () => {
    officerCompleteTicket(
      ticket.id,
      'Cán bộ học vụ đã thẩm định hồ sơ, đối soát dữ liệu và hoàn tất xử lý yêu cầu.'
    );
    setActionFeedback({
      type: 'success',
      message:
        '✓ Đã hoàn tất xử lý thành công! Trạng thái chuyển sang: "Đã hoàn tất" (resolved). Sinh viên có thể xem kết quả.',
    });
    setTimeout(() => setActionFeedback(null), 6000);
  };

  const isHigh = ticket.priority === 'high';
  const isL4 = ticket.category === 'complaint';

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
      {/* Back and Navigation */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Hàng chờ tiếp nhận</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            Tạo: {ticket.createdAt} · Cập nhật: {ticket.updatedAt}
          </span>
        </div>
      </div>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl mb-5 text-xs font-semibold border flex items-start gap-2.5 shadow-xl animate-in fade-in duration-200 backdrop-blur-md ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
              : 'bg-blue-500/20 border-blue-500/40 text-blue-200 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-current" />
          <div className="leading-relaxed">{actionFeedback.message}</div>
        </div>
      )}

      {/* Main Dossier Header */}
      <GlassCard elevated className="p-6 mb-6 border-white/[0.08] shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
              <span className="font-mono text-lg font-extrabold text-white tabular-nums bg-white/[0.08] px-3 py-0.5 rounded-lg border border-white/[0.1] shadow-sm">
                {ticket.id}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {isL4 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/35">
                  L4 Khiếu nại Handover
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
              {ticket.title}
            </h1>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/[0.08] text-xs shrink-0 sm:text-right shadow-sm">
            <div className="font-bold text-white text-sm">{ticket.studentName}</div>
            <div className="font-mono text-slate-400 tabular-nums font-medium">MSSV: {ticket.studentId}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{ticket.studentEmail}</div>
          </div>
        </div>

        {/* L4 Warning Banner if applicable */}
        {isL4 && ticket.handoverReason && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-xs text-amber-200 shadow-inner">
            <div className="flex items-center gap-2 font-bold text-amber-300 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Hồ sơ bàn giao khẩn cấp L4 (AI đã dừng - Chuyển cán bộ chuyên trách)</span>
            </div>
            <p className="leading-relaxed pl-6 font-medium text-slate-200">{ticket.handoverReason}</p>
          </div>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Dossier & Verification (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: AI Summary */}
          <GlassCard className="p-5 border-indigo-500/25 shadow-lg">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="uppercase tracking-wider">Hồ sơ Tóm tắt do AI chuẩn bị (AI Summary)</span>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                Tự động trích xuất
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-medium bg-white/[0.04] p-3.5 rounded-xl border border-white/[0.08] shadow-inner">
              {ticket.aiSummary}
            </p>
          </GlassCard>

          {/* Section 2: Submitted Fields */}
          <GlassCard className="p-5 border-white/[0.08] shadow-lg">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 pb-2.5 border-b border-white/[0.08]">
              Dữ liệu Sinh viên đã xác nhận (Submit 1)
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5 font-bold">Loại văn bản:</span>
                <span className="font-bold text-white">
                  {ticket.certificateType || 'Khiếu nại học vụ'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5 font-bold">Tình trạng học tập:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Đang theo học chính quy
                </span>
              </div>
              {ticket.purpose && (
                <div className="col-span-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5 font-bold">Mục đích sử dụng:</span>
                  <span className="font-medium text-slate-200 leading-relaxed">
                    {ticket.purpose}
                  </span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Section 3: AI Checklist */}
          <GlassCard className="p-5 border-white/[0.08] shadow-lg">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/[0.08]">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-400" />
                <span>Danh sách kiểm tra nghiệp vụ (AI Checklist)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Cán bộ đối soát từng bước</span>
            </div>

            <div className="space-y-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleChecklist(item.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-150 text-xs ${
                    item.completed
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 font-medium'
                      : 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300'
                  }`}
                >
                  <button type="button" className="mt-0.5 shrink-0 text-current">
                    {item.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                  <span className={`leading-relaxed ${item.completed ? 'line-through text-slate-500' : ''}`}>
                    {item.task}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Section 4: Audit Log */}
          <GlassCard className="p-5 border-white/[0.08] shadow-lg">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-3.5 pb-2.5 border-b border-white/[0.08]">
              <History className="w-4 h-4 text-slate-400" />
              <span>Nhật ký xử lý & Trách nhiệm (Audit Log)</span>
            </div>

            <div className="space-y-3">
              {ticket.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 text-xs pb-2.5 border-b border-white/[0.06] last:border-b-0"
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{log.action}</span>
                      <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                        {log.timestamp}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Thực hiện bởi: <span className="font-semibold text-slate-200">{log.actorName}</span>{' '}
                      ({log.actor})
                    </div>
                    {log.notes && (
                      <div className="text-[11px] text-slate-300 bg-white/[0.04] p-2 rounded-lg mt-1 border border-white/[0.06] font-medium">
                        {log.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Submit 2 Review Gate & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Submit 2 Action Card */}
          <GlassCard elevated className="p-6 border-indigo-500/35 shadow-2xl bg-slate-900/90">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shadow-[0_0_12px_rgba(99,102,241,0.4)]">
                  S2
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Cổng Kiểm duyệt Submit 2 (Cán bộ)
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Phản hồi ≠ Hoàn tất · Cán bộ kiểm duyệt trước khi phát hành
                  </span>
                </div>
              </div>
            </div>

            {/* Unsent AI Draft reply container */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dự thảo phản hồi AI soạn (Unsent Draft)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">Có thể chỉnh sửa</span>
              </div>

              <textarea
                rows={6}
                value={draftReply}
                onChange={(e) => setDraftReply(e.target.value)}
                placeholder="Nội dung phản hồi chính thức cho sinh viên..."
                className="w-full p-3.5 rounded-xl text-xs glass-input text-white leading-relaxed border-indigo-500/35 shadow-inner"
              />

              <div className="text-[10px] text-slate-400 mt-1.5 italic font-medium">
                * AI không tự động gửi phản hồi này. Cán bộ đọc và chủ động nhấn nút bên dưới.
              </div>
            </div>

            {/* Submit 2 Action Buttons */}
            <div className="space-y-3 pt-2 border-t border-white/[0.08]">
              {/* Action 1: Send reply (Status becomes pending_officer, NOT resolved) */}
              <button
                type="button"
                onClick={handleSendReply}
                disabled={!draftReply.trim()}
                className="btn-primary-glass bg-indigo-600 hover:bg-indigo-500 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs"
              >
                <Send className="w-4 h-4" />
                <span>Gửi phản hồi cho SV (Chuyển "Chờ cán bộ")</span>
              </button>
              <div className="text-[10px] text-slate-400 text-center font-medium">
                (Thao tác này gửi tin nhưng <strong className="text-white">KHÔNG</strong> hoàn tất/đóng ticket)
              </div>

              {/* Action 2: Request more information */}
              <button
                type="button"
                onClick={() => setShowMoreInfoModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass-chip bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs border-amber-500/30 transition-all hover:-translate-y-0.5 active:scale-95"
              >
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>Yêu cầu SV bổ sung hồ sơ / minh chứng</span>
              </button>

              {/* Action 3: Complete Ticket (ONLY this sets resolved) */}
              <div className="pt-3 mt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={handleCompleteTicket}
                  disabled={ticket.status === 'resolved'}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs shadow-sm transition-all ${
                    ticket.status === 'resolved'
                      ? 'bg-emerald-500/15 text-emerald-300 cursor-not-allowed border border-emerald-500/30'
                      : 'btn-primary-glass bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {ticket.status === 'resolved'
                      ? '✓ Hồ sơ đã hoàn tất xử lý'
                      : 'Hoàn tất xử lý yêu cầu (Submit 2 - Complete)'}
                  </span>
                </button>
                <div className="text-[10px] text-slate-400 text-center mt-1.5 font-medium">
                  Chỉ bấm nút này khi đã phê duyệt xong và chuyển sang trạng thái <strong className="text-emerald-400 font-bold">Đã hoàn tất</strong>.
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Conversation Transcript with Student */}
          <GlassCard className="p-5 border-white/[0.08] shadow-lg">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-3.5 pb-2.5 border-b border-white/[0.08]">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span>Hội thoại trực tiếp với Sinh viên ({ticket.messages.length})</span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {ticket.messages.map((m) => {
                const isOfficer = m.sender === 'officer';
                const isSys = m.sender === 'system';

                if (isSys) {
                  return (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl glass-chip text-slate-400 text-[11px] text-center font-medium"
                    >
                      {m.content}
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-2xl text-xs ${
                      isOfficer
                        ? 'bg-indigo-600/20 border border-indigo-500/30 ml-3'
                        : 'bg-white/[0.04] border border-white/[0.08] mr-3'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-[11px]">
                        {m.senderName} ({m.sender})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                        {m.timestamp}
                      </span>
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed font-normal">
                      {m.content}
                    </p>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Modal: Request More Info */}
      {showMoreInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-md">
            <GlassCard elevated className="p-6 border-white/15 bg-slate-900/90 shadow-2xl">
              <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>Yêu cầu Sinh viên bổ sung tài liệu</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4 font-medium">
                Nhập nội dung hướng dẫn chi tiết các giấy tờ hoặc thông tin sinh viên cần nộp thêm.
              </p>
              <textarea
                rows={3}
                value={supplementaryNote}
                onChange={(e) => setSupplementaryNote(e.target.value)}
                placeholder="Ví dụ: Vui lòng nộp thêm ảnh chụp thẻ SV hoặc biên lai nộp học phí..."
                className="w-full p-3 rounded-xl text-xs glass-input text-white mb-4 placeholder-slate-500"
              />
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMoreInfoModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.08]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleRequestMoreInfo}
                  disabled={!supplementaryNote.trim()}
                  className="btn-primary-glass bg-amber-600 hover:bg-amber-500 px-4 py-1.5 rounded-xl text-xs font-bold"
                >
                  Gửi yêu cầu bổ sung
                </button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
