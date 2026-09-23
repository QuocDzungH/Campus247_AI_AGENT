'use client';

import React from 'react';
import { TicketStatus } from '@/lib/types';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: TicketStatus;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, className = '', size = 'md' }: StatusBadgeProps) {
  const configs: Record<
    TicketStatus,
    { label: string; bg: string; text: string; border: string; dot: string; icon: React.ReactNode }
  > = {
    open: {
      label: 'Mới tiếp nhận',
      bg: 'bg-blue-500/15 backdrop-blur-md',
      text: 'text-blue-300',
      border: 'border-blue-500/30',
      dot: 'bg-blue-400',
      icon: <Clock className={size === 'sm' ? 'w-3 h-3 text-blue-400' : 'w-3.5 h-3.5 text-blue-400'} />,
    },
    pending_officer: {
      label: 'Chờ cán bộ',
      bg: 'bg-amber-500/15 backdrop-blur-md',
      text: 'text-amber-300',
      border: 'border-amber-500/30',
      dot: 'bg-amber-400',
      icon: <AlertCircle className={size === 'sm' ? 'w-3 h-3 text-amber-400' : 'w-3.5 h-3.5 text-amber-400'} />,
    },
    resolved: {
      label: 'Đã hoàn tất',
      bg: 'bg-emerald-500/15 backdrop-blur-md',
      text: 'text-emerald-300',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
      icon: <CheckCircle2 className={size === 'sm' ? 'w-3 h-3 text-emerald-400' : 'w-3.5 h-3.5 text-emerald-400'} />,
    },
  };

  const config = configs[status] || configs.open;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border shadow-sm ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {status === 'pending_officer' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dot}`}></span>
      </span>
      <span>{config.label}</span>
    </span>
  );
}
