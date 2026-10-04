import type { BriefView } from "@/lib/data/api/mappers";
import { displayValue } from "@/lib/data/api/g2-flow";

const statusLabel: Record<BriefView["status"], string> = {
  pending: "Đang chờ",
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  failed: "Thất bại",
  stale: "Đã cũ",
};

export function OfficerFactSheet({ brief }: { brief: BriefView }) {
  const stale =
    brief.status === "stale" ||
    (brief.sourceTicketRevision != null && brief.sourceTicketRevision !== brief.currentTicketRevision);
  return (
    <section className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700" data-testid="officer-fact-sheet">
      <div>
        <h3 className="font-semibold">AI Copilot · Fact Sheet L3</h3>
        <p className="mt-1 text-xs text-slate-500">
          {statusLabel[brief.status]} · Brief v{brief.briefVersion ?? "—"} · nguồn revision {brief.sourceTicketRevision ?? "—"} · ticket revision {brief.currentTicketRevision}
          {stale ? " · hồ sơ đã đổi, cần chạy lại" : ""}
        </p>
      </div>
      {brief.status === "failed" && brief.errorMessage ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          AI không tạo được hồ sơ: {brief.errorMessage}. Nháp cán bộ được giữ; không thay bằng câu mẫu.
        </p>
      ) : null}
      {brief.status === "pending" || brief.status === "processing" ? (
        <p className="text-sm text-slate-500">CampusAgent đang chuẩn bị hồ sơ từ đơn, hồ sơ nguồn và tài liệu được phép.</p>
      ) : null}
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mục tiêu sinh viên</h4>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{brief.summary || "Chưa có dữ liệu"}</p>
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bối cảnh và dữ kiện</h4>
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
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thiếu / mâu thuẫn</h4>
        {brief.missingItems.length ? (
          <ul className="mt-2 space-y-1">
            {brief.missingItems.map((item) => (
              <li key={`${item.field}-${item.reason}`}>
                {item.field}: {item.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Không có mục thiếu do agent ghi nhận</p>
        )}
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phân loại và lý do ưu tiên</h4>
        <p className="mt-1">
          {brief.suggestedPriority ? `Ưu tiên đề xuất: ${brief.suggestedPriority}` : "Chưa có phân loại ưu tiên từ brief"}
        </p>
        {brief.priorityReasons.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {brief.priorityReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hành động tiếp theo</h4>
        {brief.warnings.length ? (
          <ul className="mt-2 space-y-1">
            {brief.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>
                {warning.code}: {warning.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Không có cảnh báo. Cán bộ đối soát bằng chứng rồi mới phản hồi hoặc phát hành.</p>
        )}
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist đề xuất (AI, không bắt buộc)</h4>
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
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nháp phản hồi</h4>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{brief.draftReply || "Chưa có dữ liệu"}</p>
      </section>
      <p className="text-xs text-slate-500">
        Chất lượng: {brief.qualityStatus || "Chưa có dữ liệu"}
        {brief.modelName ? ` · model ${brief.modelName}` : ""}
        {brief.promptVersion ? ` · prompt ${brief.promptVersion}` : ""}
        {brief.templateVersion ? ` · template ${brief.templateVersion}` : ""}
        {brief.indexVersion ? ` · index ${brief.indexVersion}` : ""}
      </p>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nguồn</h4>
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
      </section>
    </section>
  );
}
