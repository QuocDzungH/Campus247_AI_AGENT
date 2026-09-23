'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { GlassCard } from '@/components/common/GlassCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import {
  FileCheck2,
  Clock,
  Send,
  MessageSquare,
  AlertTriangle,
  FileText,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  CornerDownRight,
} from 'lucide-react';
import Link from 'next/link';

export default function MyRequestsPage() {
  const { currentUser, tickets, studentSendTicketReply } = useStore();

  // Filter only tickets for current student (SV001)
  const myTickets = tickets.filter((t) => t.studentId === currentUser.id);

  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    myTickets[0]?.id || ''
  );
  const [replyInput, setReplyInput] = useState<string>('');
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);

  const selectedTicket = myTickets.find((t) => t.id === selectedTicketId) || myTickets[0];

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !selectedTicket) return;

    setIsSendingReply(true);
    setTimeout(() => {
      studentSendTicketReply(selectedTicket.id, replyInput);
      setReplyInput('');
      setIsSendingReply(false);
    }, 300);
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Yêu cầu của tôi
            </h1>
            <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs font-semibold backdrop-blur-md shadow-[0_0_12px_rgba(59,130,246,0.15)]">
              {currentUser.id} · {currentUser.name}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Theo dõi trạng thái xử lý các thủ tục hành chính học vụ và tiếp nhận phản hồi từ Cán bộ nhà trường
          </p>
        </div>

        <Link
          href="/chat"
          className="btn-primary-glass inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Tạo yêu cầu mới</span>
        </Link>
      </div>

      {myTickets.length === 0 ? (
        <GlassCard elevated className="p-12 text-center text-slate-400 border-white/[0.08] shadow-2xl">
          <FileCheck2 className="w-12 h-12 mx-auto text-slate-500 mb-3 opacity-60" />
          <h3 className="font-bold text-white text-base mb-1">
            Bạn chưa có yêu cầu nào
          </h3>
          <p className="text-xs max-w-sm mx-auto mb-5 text-slate-400 font-medium">
            Hãy bắt đầu bằng cách trò chuyện với Trợ lý AI và nộp yêu cầu cấp Giấy xác nhận sinh viên.
          </p>
          <Link
            href="/chat"
            className="btn-primary-glass inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs"
          >
            <span>Đến trang Chat Hỗ trợ</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Tickets List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
              Danh sách yêu cầu ({myTickets.length})
            </div>

            {myTickets.map((ticket) => {
              const isSelected = ticket.id === selectedTicket?.id;
              const isL4 = ticket.category === 'complaint';

              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 border text-xs relative ${
                    isSelected
                      ? 'glass-panel-elevated bg-slate-900/90 shadow-2xl border-blue-500/50 ring-1 ring-blue-500/30'
                      : 'glass-panel bg-slate-900/50 hover:bg-slate-900/80 border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white tabular-nums">
                        {ticket.id}
                      </span>
                      {isL4 && <PriorityBadge priority="high" size="sm" />}
                    </div>
                    <StatusBadge status={ticket.status} size="sm" />
                  </div>

                  <h3 className="font-bold text-white mb-1 line-clamp-1">
                    {ticket.title}
                  </h3>

                  {ticket.purpose && (
                    <p className="text-[11px] text-slate-400 line-clamp-1 mb-2 font-normal">
                      Mục đích: {ticket.purpose}
                    </p>
                  )}

                  {isL4 && ticket.handoverReason && (
                    <p className="text-[11px] text-amber-300 line-clamp-1 mb-2 italic font-medium bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/30">
                      Lý do: {ticket.handoverReason}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2.5 border-t border-white/[0.06] font-mono tabular-nums">
                    <span>Khởi tạo: {ticket.createdAt}</span>
                    <span className="flex items-center gap-1 text-blue-400 font-bold">
                      Xem chi tiết <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Ticket Detail View */}
          {selectedTicket && (
            <div className="lg:col-span-7">
              <GlassCard elevated className="p-6 border-white/[0.1] shadow-2xl">
                {/* Detail Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 mb-4 border-b border-white/[0.08]">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="font-mono text-base font-extrabold text-blue-300 bg-blue-500/15 px-3 py-0.5 rounded-lg border border-blue-500/30 tabular-nums">
                        {selectedTicket.id}
                      </span>
                      <StatusBadge status={selectedTicket.status} />
                      <PriorityBadge priority={selectedTicket.priority} />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-white">
                      {selectedTicket.title}
                    </h2>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-mono tabular-nums font-medium">
                    <div>Tạo lúc: {selectedTicket.createdAt}</div>
                    <div>Cập nhật: {selectedTicket.updatedAt}</div>
                  </div>
                </div>

                {/* Status Explanation Bar */}
                <div className="mb-5 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs backdrop-blur-md">
                  <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Tiến trình xử lý:</span>
                  </div>
                  {selectedTicket.status === 'open' && (
                    <p className="text-slate-300 text-[11px] leading-relaxed font-normal">
                      Hồ sơ của bạn đã được gửi thành công vào hệ thống (Submit 1). Cán bộ phụ trách sẽ sớm tiếp nhận và xem xét biểu mẫu.
                    </p>
                  )}
                  {selectedTicket.status === 'pending_officer' && (
                    <p className="text-amber-300 font-semibold text-[11px] leading-relaxed">
                      Hồ sơ đang được Cán bộ hỗ trợ học vụ trực tiếp rà soát và xử lý nghiệp vụ.
                    </p>
                  )}
                  {selectedTicket.status === 'resolved' && (
                    <p className="text-emerald-300 font-bold text-[11px] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Yêu cầu đã được hoàn tất xử lý. Kết quả văn bản đã được thông báo.
                    </p>
                  )}
                </div>

                {/* Submitted Data Fields */}
                <div className="mb-5 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs backdrop-blur-md">
                  <div className="font-bold text-slate-400 mb-2.5 uppercase text-[10px] tracking-widest">
                    Thông tin hồ sơ đã xác nhận
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold block mb-0.5">Sinh viên:</span>
                      <span className="font-bold text-white">
                        {selectedTicket.studentName} ({selectedTicket.studentId})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold block mb-0.5">Loại văn bản:</span>
                      <span className="font-bold text-white">
                        {selectedTicket.certificateType || 'Khiếu nại học vụ'}
                      </span>
                    </div>
                    {selectedTicket.purpose && (
                      <div className="col-span-2">
                        <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold block mb-0.5">Mục đích sử dụng:</span>
                        <span className="font-medium text-slate-200 leading-relaxed">
                          {selectedTicket.purpose}
                        </span>
                      </div>
                    )}
                    {selectedTicket.handoverReason && (
                      <div className="col-span-2 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 font-medium">
                        <span className="font-bold block mb-0.5 text-amber-300">Lý do bàn giao L4:</span>
                        <span>{selectedTicket.handoverReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Messages / Communication with Officer */}
                <div className="mb-5">
                  <div className="font-bold text-slate-300 mb-2.5 uppercase text-[10px] tracking-widest flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                    <span>Trao đổi với Cán bộ học vụ ({selectedTicket.messages.length})</span>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {selectedTicket.messages.map((m) => {
                      const isMe = m.sender === 'student';
                      const isSys = m.sender === 'system';

                      if (isSys) {
                        return (
                          <div
                            key={m.id}
                            className="p-2.5 rounded-xl glass-chip text-slate-400 text-[11px] italic text-center font-medium"
                          >
                            {m.content}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-2xl text-xs ${
                            isMe
                              ? 'bg-blue-600/20 border border-blue-500/30 text-slate-200 ml-4 shadow-sm'
                              : 'bg-indigo-600/20 border border-indigo-500/30 text-slate-200 mr-4 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-white text-[11px]">
                              {m.senderName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                              {m.timestamp}
                            </span>
                          </div>
                          <p className="text-slate-200 leading-relaxed whitespace-pre-wrap font-normal">
                            {m.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Supplementary Reply Form */}
                {selectedTicket.status !== 'resolved' ? (
                  <form onSubmit={handleSendReply} className="pt-3.5 border-t border-white/[0.08]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                      Gửi phản hồi / Thông tin bổ sung cho cán bộ:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        placeholder="Nhập nội dung cần trao đổi hoặc phản hồi yêu cầu..."
                        className="flex-1 px-4 py-2.5 rounded-xl text-xs glass-input text-white placeholder-slate-500"
                      />
                      <button
                        type="submit"
                        disabled={!replyInput.trim() || isSendingReply}
                        className="btn-primary-glass inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs text-center font-bold">
                    ✓ Yêu cầu này đã hoàn tất. Nếu có thắc mắc mới, bạn vui lòng tạo yêu cầu mới.
                  </div>
                )}
              </GlassCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
