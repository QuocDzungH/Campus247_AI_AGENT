import type { BriefView } from "@/lib/data/api/mappers";
import { displayValue } from "@/lib/data/api/g2-flow";

export function OfficerFactSheet({ brief }: { brief: BriefView }) {
  const stale = brief.status === "stale" || (brief.sourceTicketRevision != null && brief.sourceTicketRevision !== brief.currentTicketRevision);
  return (
    <section className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700" data-testid="officer-fact-sheet">
      <div>
        <h3 className="font-semibold">Fact Sheet L3</h3>
        <p className="mt-1 text-xs text-slate-500">
          Brief v{brief.briefVersion ?? "—"} · nguồn revision {brief.sourceTicketRevision ?? "—"} · ticket revision {brief.currentTicketRevision} · {brief.status}
          {stale ? " · đã cũ so với hồ sơ" : ""}
        </p>
      </div>
      {brief.summary ? <p className="whitespace-pre-wrap leading-relaxed">{brief.summary}</p> : null}
      <p className="text-xs text-slate-500">
        Chất lượng: {brief.qualityStatus || "Chưa có dữ liệu"}
        {brief.modelName ? ` · model ${brief.modelName}` : ""}
        {brief.promptVersion ? ` · prompt ${brief.promptVersion}` : ""}
        {brief.templateVersion ? ` · template ${brief.templateVersion}` : ""}
        {brief.indexVersion ? ` · index ${brief.indexVersion}` : ""}
      </p>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Facts</h4>
        {brief.facts.length ? (
          <ul className="mt-2 space-y-2">
            {brief.facts.map((fact) => (
              <li key={fact.id} data-testid={`brief-fact-${fact.key}`}>
                <p>
                  {fact.key}: {fact.value}
                </p>
                <p className="text-xs text-slate-500">
                  {displayValue(fact.source)} · {fact.statusText}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Chưa có dữ liệu</p>
        )}
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist (chỉ đọc)</h4>
        {brief.checklist.length ? (
          <ul className="mt-2 space-y-1">
            {brief.checklist.map((item) => (
              <li key={item.id} data-testid={`brief-check-${item.id}`}>
                {item.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Chưa có dữ liệu</p>
        )}
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thiếu dữ liệu</h4>
        {brief.missingItems.length ? (
          <ul className="mt-2 space-y-1">
            {brief.missingItems.map((item) => (
              <li key={`${item.field}-${item.reason}`}>
                {item.field}: {item.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Không có mục thiếu</p>
        )}
      </div>
      {brief.warnings.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">Cảnh báo</h4>
          <ul className="mt-2 space-y-1">
            {brief.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>
                {warning.code}: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Citations</h4>
        {brief.citations.length ? (
          <ul className="mt-2 space-y-2">
            {brief.citations.map((citation, index) => (
              <li key={`${citation.documentId}-${citation.chunkId}-${index}`} data-testid="brief-citation">
                <p className="font-medium">{citation.documentTitle}</p>
                <p className="text-xs text-slate-500">
                  {citation.documentId} · {citation.documentVersion} · {citation.locator}
                </p>
                <blockquote className="mt-1 border-l-2 border-slate-300 pl-3 text-xs">{citation.quote}</blockquote>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Chưa có dữ liệu</p>
        )}
      </div>
    </section>
  );
}
