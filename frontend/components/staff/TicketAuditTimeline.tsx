"use client";

import type { AuditLogEntry } from "@/lib/types";
import { auditTechnical, displayActorName, roleLabel } from "@/lib/audit-labels";
import { formatDate } from "@/lib/format-date";
import { staffSurface } from "./StaffShell";

function stamp(log: AuditLogEntry): string {
  return /^\d{4}-/.test(log.timestamp) ? formatDate(log.timestamp, "Asia/Bangkok") : log.timestamp;
}

export function TicketAuditTimeline({ logs, loadError }: { logs: AuditLogEntry[]; loadError?: string }) {
  return (
    <section className={`${staffSurface} p-5`} data-testid="ticket-audit-timeline">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">Lịch sử tiếp nhận và xử lý hồ sơ</h2>
        <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">{logs.length} mục</p>
      </div>
      {loadError ? <p role="alert" className="mt-2 text-sm text-[#B91C1C] dark:text-[#EF4444]">{loadError}</p> : null}
      <div className="mt-3 max-h-56 overflow-y-auto overscroll-contain pr-1" role="log" aria-label="Nhật ký xử lý hồ sơ">
        <div className="space-y-2">
          {logs.map((log) => {
            const actor = displayActorName(log.actorName || log.actor, log.actorType);
            const technical = log.technical || auditTechnical(undefined, log.requestId, log.rawAction);
            return (
              <article key={log.id} className="border-l-2 border-[#E7E5E4] py-1 pl-3 dark:border-[#292524]">
                <p className="text-sm leading-snug text-[#1C1917] dark:text-[#FAFAF9]">{log.action}</p>
                <p className="mt-0.5 text-xs text-[#78716C] dark:text-[#A8A29E]">
                  {actor} · {log.actorType ? roleLabel(log.actorType) : log.source} · {stamp(log)}
                </p>
                {technical ? (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-[#78716C] dark:text-[#A8A29E]">Chi tiết kỹ thuật</summary>
                    <p className="mt-1 break-words text-[#78716C] dark:text-[#A8A29E]">{technical}</p>
                    {log.rawAction ? <p className="mt-1 text-[#78716C] dark:text-[#A8A29E]">action {log.rawAction}</p> : null}
                  </details>
                ) : null}
              </article>
            );
          })}
          {!logs.length && <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">Chưa có dữ liệu lịch sử trên hồ sơ này.</p>}
        </div>
      </div>
    </section>
  );
}
