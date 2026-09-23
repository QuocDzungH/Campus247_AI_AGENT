'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { GlassCard } from '@/components/common/GlassCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { TicketStatus, TicketPriority, TicketCategory } from '@/lib/types';
import Link from 'next/link';
import {
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Inbox,
  UserCheck,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';

export default function OfficerDashboardPage() {
  const { tickets, resetDemoData } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Metrics
  const totalCount = tickets.length;
  const pendingOfficerCount = tickets.filter((t) => t.status === 'open' || t.status === 'pending_officer').length;
  const highPriorityCount = tickets.filter((t) => t.priority === 'high' && t.status !== 'resolved').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved').length;

  // AI-Sorted filtering: High priority tickets come first, then date descending
  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        // Search filter (handles exact TKT-2026-0142 search, student name, purpose)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchId = ticket.id.toLowerCase().includes(q);
          const matchName = ticket.studentName.toLowerCase().includes(q);
          const matchStudentId = ticket.studentId.toLowerCase().includes(q);
          const matchTitle = ticket.title.toLowerCase().includes(q);
          if (!matchId && !matchName && !matchStudentId && !matchTitle) {
            return false;
          }
        }

        // Status filter
        if (statusFilter !== 'all' && ticket.status !== statusFilter) {
          return false;
        }

        // Priority filter
        if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
          return false;
        }

        // Category filter
        if (categoryFilter !== 'all' && ticket.category !== categoryFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // 1. High priority first
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;

        // 2. Pending before resolved
        if (a.status !== 'resolved' && b.status === 'resolved') return -1;
        if (a.status === 'resolved' && b.status !== 'resolved') return 1;

        // 3. Newest first
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [tickets, searchQuery, statusFilter, priorityFilter, categoryFilter]);

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Hàng chờ Xử lý Dịch vụ Học vụ
            </h1>
            <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-semibold backdrop-blur-md shadow-[0_0_12px_rgba(99,102,241,0.2)]">
              OF001 Cán bộ Học vụ
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Hồ sơ được AI phân loại, gán mức độ ưu tiên và chuẩn bị sẵn tóm tắt đối soát trước khi Cán bộ phê duyệt (Submit 2)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetDemoData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-chip hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-semibold border-white/[0.1] shadow-sm transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Làm mới hàng chờ</span>
          </button>
        </div>
      </div>

      {/* Metrics Row (Compact density + Luminous Accents per taste-skill) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <GlassCard elevated className="p-4 bg-slate-900/60 border-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tổng số hồ sơ</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center">
              <Inbox className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-white tabular-nums">
            {totalCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Giấy xác nhận SV & L4 Handover</div>
        </GlassCard>

        <GlassCard elevated className="p-4 bg-amber-500/[0.08] border-amber-500/25 shadow-[0_8px_24px_rgba(245,158,11,0.12)]">
          <div className="flex items-center justify-between text-amber-300 mb-1.5">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Chờ cán bộ xử lý</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-300 tabular-nums">
            {pendingOfficerCount}
          </div>
          <div className="text-[10px] text-amber-400/80 mt-1 font-medium">Mới tiếp nhận + Chờ cán bộ</div>
        </GlassCard>

        <GlassCard elevated className="p-4 bg-rose-500/[0.1] border-rose-500/30 shadow-[0_8px_24px_rgba(244,63,94,0.15)]">
          <div className="flex items-center justify-between text-rose-300 mb-1.5">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Ưu tiên Cao (L4)</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/35 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-rose-300 tabular-nums">
            {highPriorityCount}
          </div>
          <div className="text-[10px] text-rose-400/80 mt-1 font-medium">AI xếp nổi lên đầu hàng chờ</div>
        </GlassCard>

        <GlassCard elevated className="p-4 bg-emerald-500/[0.08] border-emerald-500/25 shadow-[0_8px_24px_rgba(16,185,129,0.12)]">
          <div className="flex items-center justify-between text-emerald-300 mb-1.5">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Đã hoàn tất</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-300 tabular-nums">
            {resolvedCount}
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-1 font-medium">Submit 2 hoàn tất</div>
        </GlassCard>
      </div>

      {/* Filter and Search Bar */}
      <GlassCard className="p-4 mb-5 border-white/[0.08] shadow-lg">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box - one row search for TKT-2026-0142 */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã ticket (gõ TKT-2026-0142 để lọc ra đúng 1 dòng), tên SV hoặc MSSV..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs glass-input text-white placeholder-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Quick Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl glass-input text-slate-200 text-xs font-semibold cursor-pointer bg-slate-900"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="open">Mới tiếp nhận (open)</option>
              <option value="pending_officer">Chờ cán bộ (pending)</option>
              <option value="resolved">Đã hoàn tất (resolved)</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl glass-input text-slate-200 text-xs font-semibold cursor-pointer bg-slate-900"
            >
              <option value="all">Tất cả ưu tiên</option>
              <option value="high">Ưu tiên Cao (High)</option>
              <option value="normal">Ưu tiên Bình thường (Normal)</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl glass-input text-slate-200 text-xs font-semibold cursor-pointer bg-slate-900"
            >
              <option value="all">Tất cả loại việc</option>
              <option value="action">Hành chính - Cấp giấy</option>
              <option value="complaint">Khiếu nại - Bàn giao L4</option>
            </select>
          </div>
        </div>

        {/* Quick shortcut for demo click-path */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="font-medium text-slate-400">Tìm nhanh demo:</span>
          <button
            type="button"
            onClick={() => setSearchQuery('TKT-2026-0142')}
            className="px-2.5 py-1 rounded-lg glass-chip hover:bg-blue-500/20 text-blue-300 font-mono font-semibold border-blue-500/30 transition-colors"
          >
            TKT-2026-0142 (Giấy xác nhận SV)
          </button>
          <button
            type="button"
            onClick={() => setSearchQuery('TKT-2026-0098')}
            className="px-2.5 py-1 rounded-lg glass-chip hover:bg-rose-500/20 text-rose-300 font-mono font-semibold border-rose-500/30 transition-colors"
          >
            TKT-2026-0098 (Khiếu nại L4)
          </button>
          {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPriorityFilter('all');
                setCategoryFilter('all');
              }}
              className="text-slate-400 hover:text-white underline ml-auto text-xs font-semibold"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      </GlassCard>

      {/* Queue Table (Compact Density per spec) */}
      <GlassCard elevated className="overflow-hidden border-white/[0.08] shadow-2xl">
        <div className="p-3.5 bg-white/[0.02] backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between text-xs">
          <div className="font-bold text-white flex items-center gap-2">
            <span>Danh sách yêu cầu tiếp nhận</span>
            <span className="px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300 text-[10px] font-bold tabular-nums">
              {filteredTickets.length} ca
            </span>
          </div>
          <div className="text-[11px] text-indigo-300 flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Sắp xếp tự động bởi AI: Ưu tiên Cao nổi lên trên</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="py-3 px-3.5">Mã Ticket</th>
                <th className="py-3 px-3.5">Sinh viên</th>
                <th className="py-3 px-4">Nội dung yêu cầu / Tóm tắt AI</th>
                <th className="py-3 px-3.5">Ưu tiên</th>
                <th className="py-3 px-3.5">Trạng thái</th>
                <th className="py-3 px-3.5">Thời gian</th>
                <th className="py-3 px-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-500" />
                    <p className="font-semibold text-slate-300">Không tìm thấy hồ sơ nào khớp với bộ lọc</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Vui lòng thử điều chỉnh lại từ khóa hoặc xóa bộ lọc</p>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                  const isHigh = ticket.priority === 'high';
                  const isComplaint = ticket.category === 'complaint';

                  return (
                    <tr
                      key={ticket.id}
                      className={`hover:bg-white/[0.04] transition-colors ${
                        isHigh ? 'bg-rose-500/[0.06]' : ''
                      }`}
                    >
                      {/* Code */}
                      <td className="py-3 px-3.5 font-mono font-bold text-white tabular-nums whitespace-nowrap">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="hover:text-blue-400 hover:underline"
                        >
                          {ticket.id}
                        </Link>
                      </td>

                      {/* Student */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-white">{ticket.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                          {ticket.studentId}
                        </div>
                      </td>

                      {/* Title & AI Summary */}
                      <td className="py-3 px-4 min-w-[280px]">
                        <div className="font-semibold text-slate-100 mb-0.5">
                          {ticket.title}
                        </div>
                        <div className="flex items-start gap-1 text-[11px] text-slate-300 line-clamp-1">
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                            AI
                          </span>
                          <span className="text-slate-400 italic font-normal">{ticket.aiSummary}</span>
                        </div>
                        {isComplaint && ticket.handoverReason && (
                          <div className="mt-1 text-[10px] font-semibold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 inline-block line-clamp-1">
                            Lý do L4: {ticket.handoverReason}
                          </div>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <PriorityBadge priority={ticket.priority} size="sm" />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={ticket.status} size="sm" />
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-[11px] text-slate-400 font-mono tabular-nums">
                        {ticket.createdAt}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-right">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="btn-primary-glass inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs"
                        >
                          <span>Xử lý</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
