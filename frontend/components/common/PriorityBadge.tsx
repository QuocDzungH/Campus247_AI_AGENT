'use client';

import React from 'react';
import { TicketPriority } from '@/lib/types';
import { AlertTriangle, Minus } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
  size?: 'sm' | 'md';
}

export function PriorityBadge({ priority, className = '', size = 'md' }: PriorityBadgeProps) {
  const isHigh = priority === 'high';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs';

  if (isHigh) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-bold rounded-full border bg-rose-500/20 text-rose-300 border-rose-500/35 backdrop-blur-md shadow-[0_0_10px_rgba(244,63,94,0.25)] ${sizeClasses} ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-400"></span>
        </span>
        <AlertTriangle className={size === 'sm' ? 'w-3 h-3 text-rose-400' : 'w-3.5 h-3.5 text-rose-400'} />
        <span>Cao</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border bg-slate-800/80 text-slate-300 border-white/[0.08] backdrop-blur-md ${sizeClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
      <span>Bình thường</span>
    </span>
  );
}
