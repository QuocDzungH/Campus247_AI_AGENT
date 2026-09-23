'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { GlassCard } from '@/components/common/GlassCard';
import { Submit1Modal } from '@/components/student/Submit1Modal';
import { RegulationCitationCard } from '@/components/student/RegulationCitationCard';
import { TicketSuccessCard } from '@/components/student/TicketSuccessCard';
import { L4HandoverBanner } from '@/components/student/L4HandoverBanner';
import {
  Send,
  Sparkles,
  User,
  Bot,
  FileText,
  AlertTriangle,
  ArrowRight,
  Info,
  ShieldAlert,
  Zap,
} from 'lucide-react';

export default function StudentChatPage() {
  const {
    chatMessages,
    studentSendChatMessage,
    currentUser,
    isL4Active,
    activeL4TicketId,
  } = useStore();

  const [inputVal, setInputVal] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isL4Active]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;

    studentSendChatMessage(inputVal);
    setInputVal('');
  };

  const handleQuickPrompt = (promptText: string) => {
    studentSendChatMessage(promptText);
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 sm:p-6 lg:p-8">
      {/* Page Title & Context Bar */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shadow-[0_0_12px_rgba(59,130,246,0.2)]">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
              Trợ lý Học vụ Campus 24/7
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Tra cứu quy chế (L1) · Điền sẵn hồ sơ (L2) · Tự động phát hiện khiếu nại (L4)
            </p>
          </div>
        </div>

        {isL4Active ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/35 text-xs font-semibold shadow-[0_0_12px_rgba(244,63,94,0.25)] animate-pulse">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>AI đã dừng (Chế độ Bàn giao L4)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span>AI Đang sẵn sàng 24/7</span>
          </div>
        )}
      </div>

      {/* Demo Quick Prompts */}
      <div className="mb-4">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span>Kịch bản thử nghiệm nhanh (Click-path Demo):</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              handleQuickPrompt('Quy chế cấp Giấy xác nhận sinh viên mất bao lâu và cần điều kiện gì?')
            }
            className="px-3.5 py-1.5 rounded-xl glass-chip hover:bg-white/[0.1] text-slate-200 hover:text-white transition-all font-medium shadow-sm hover:-translate-y-0.5 active:scale-95"
          >
            📘 Hỏi quy chế (L1 - có trích dẫn, không ticket)
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt('Tôi muốn tạo yêu cầu xin Giấy xác nhận sinh viên')}
            className="px-3.5 py-1.5 rounded-xl glass-chip bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20 transition-all font-semibold shadow-sm hover:-translate-y-0.5 active:scale-95"
          >
            📝 Xin cấp Giấy xác nhận SV (L2 - Submit 1)
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickPrompt(
                'Em muốn khiếu nại điểm thi môn Triết học Mác - Lênin, kết quả bị chấm sai lệch!'
              )
            }
            className="px-3.5 py-1.5 rounded-xl glass-chip bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 transition-all font-semibold shadow-sm hover:-translate-y-0.5 active:scale-95"
          >
            ⚠️ Khiếu nại điểm thi (L4 - AI dừng & Bàn giao)
          </button>
        </div>
      </div>

      {/* Chat Messages Timeline */}
      <GlassCard elevated className="flex-1 flex flex-col p-4 sm:p-6 mb-4 min-h-[460px] max-h-[640px] overflow-y-auto border-white/[0.1] shadow-2xl">
        <div className="space-y-4">
          {chatMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="px-3.5 py-1.5 rounded-xl glass-chip text-slate-300 text-xs text-center max-w-lg border-white/[0.08] font-medium">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs leading-relaxed ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    isUser
                      ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                      : 'bg-indigo-600/30 text-indigo-300 border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble Container */}
                <div className={`max-w-[85%] sm:max-w-[78%]`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="font-semibold text-slate-300 text-[11px]">
                      {isUser ? currentUser.name : 'Trợ lý Campus 24/7'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Main Bubble */}
                  <div
                    className={`p-4 rounded-2xl ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-sm shadow-[0_4px_16px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]'
                        : 'glass-panel bg-slate-900/70 text-slate-100 rounded-tl-sm border-white/[0.1] shadow-lg'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                    {/* L1 Citation Card */}
                    {msg.type === 'citation' && msg.citation && (
                      <RegulationCitationCard citation={msg.citation} />
                    )}

                    {/* L2 Certificate CTA button */}
                    {msg.type === 'certificate_cta' && (
                      <div className="mt-3.5 pt-3.5 border-t border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(true)}
                          className="btn-primary-glass w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Tạo yêu cầu cấp Giấy xác nhận sinh viên</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <div className="text-[10px] text-slate-400 mt-2 font-medium">
                          * Bước này sẽ mở màn hình Preview kiểm duyệt (Submit 1) trước khi gửi vào hệ thống.
                        </div>
                      </div>
                    )}

                    {/* L2 Submit 1 Success Card */}
                    {msg.type === 'submit1_success' && msg.ticketId && (
                      <TicketSuccessCard ticketId={msg.ticketId} />
                    )}

                    {/* L4 Handover Banner */}
                    {msg.type === 'l4_handover' && msg.ticketId && (
                      <L4HandoverBanner ticketId={msg.ticketId} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </GlassCard>

      {/* Composer Input Area */}
      <GlassCard elevated className="p-3 border-white/[0.1] shadow-xl">
        {isL4Active && (
          <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between shadow-[0_0_12px_rgba(245,158,11,0.15)]">
            <span className="flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Chế độ bàn giao: Tin nhắn sẽ được gửi thẳng đến Cán bộ hỗ trợ học vụ (OF001).
            </span>
            <span className="font-mono text-[11px] font-bold text-amber-400 tabular-nums">
              {activeL4TicketId}
            </span>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={
              isL4Active
                ? 'Gửi thông tin bổ sung cho cán bộ hỗ trợ học vụ...'
                : 'Nhập câu hỏi quy chế học tập, xin giấy xác nhận hoặc khiếu nại...'
            }
            className="flex-1 px-4 py-2.5 rounded-xl text-xs glass-input text-white placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="btn-primary-glass inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <span>Gửi</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </GlassCard>

      {/* Submit 1 Modal */}
      <Submit1Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(ticketId) => {
          // Handled via store inside modal
        }}
      />
    </div>
  );
}
