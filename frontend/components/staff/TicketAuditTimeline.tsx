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
      <h2 className="font-semibold">Lịch sử tiếp nhận và xử lý hồ sơ</h2>
      {loadError ? <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{loadError}</p> : null}
      <div className="mt-3 space-y-3">
        {logs.map((log) => {
          const actor = displayActorName(log.actorName || log.actor, log.actorType);
          const technical = log.technical || auditTechnical(undefined, log.requestId, log.rawAction);
          return (
            <article key={log.id} className="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
              <p className="text-sm">{log.action}</p>
              <p className="mt-1 text-xs text-slate-500">
                {actor} · {log.actorType ? roleLabel(log.actorType) : log.source} · {stamp(log)}
              </p>
              {technical ? (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-slate-500">Chi tiết kỹ thuật</summary>
                  <p className="mt-1 break-words text-slate-500">{technical}</p>
                  {log.rawAction ? <p className="mt-1 text-slate-500">action {log.rawAction}</p> : null}
                </details>
              ) : null}
            </article>
          );
        })}
        {!logs.length && <p className="text-sm text-slate-500">Chưa có dữ liệu lịch sử trên hồ sơ này.</p>}
      </div>
    </section>
  );
}
