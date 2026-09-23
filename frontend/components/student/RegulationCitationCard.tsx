'use client';

import React from 'react';
import { GlassCard } from '@/components/common/GlassCard';
import { BookOpen, ExternalLink, Calendar } from 'lucide-react';

interface CitationData {
  docTitle: string;
  article: string;
  snippet: string;
  effectiveDate: string;
}

export function RegulationCitationCard({ citation }: { citation: CitationData }) {
  return (
    <GlassCard className="mt-2.5 p-3.5 sm:p-4 bg-slate-950/60 border-blue-500/25 text-xs shadow-md">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] mb-2">
        <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
          <BookOpen className="w-3.5 h-3.5" />
          <span className="text-[10px] uppercase tracking-wider font-bold">Căn cứ văn bản quy chế (L1 Tra cứu)</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono tabular-nums">
          <Calendar className="w-3 h-3 text-slate-500" />
          {citation.effectiveDate}
        </span>
      </div>

      <div className="font-semibold text-white mb-1">{citation.docTitle}</div>
      <div className="text-[11px] font-semibold text-blue-400 mb-1.5">{citation.article}</div>
      <blockquote className="p-2.5 rounded-xl bg-white/[0.04] border-l-2 border-blue-500 text-[11px] text-slate-300 italic leading-relaxed">
        &ldquo;{citation.snippet}&rdquo;
      </blockquote>
      <div className="mt-2 text-[10px] text-slate-400">
        * Tra cứu thông tin quy chế không phát sinh hồ sơ/ticket trên hệ thống trường.
      </div>
    </GlassCard>
  );
}
