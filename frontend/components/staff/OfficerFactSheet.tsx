import type { BriefView } from "@/lib/data/api/mappers";
import { displayValue } from "@/lib/data/api/g2-flow";
import { enumLabel, fieldLabel, formatStoredValue, sourceLabel } from "@/lib/field-labels";

const statusLabel: Record<BriefView["status"], string> = {
  pending: "Đang soạn bản tóm tắt",
  processing: "AI đang đọc hồ sơ",
  ready: "Đã có bản tóm tắt",
  failed: "Chưa tạo được bản tóm tắt",
  stale: "Bản tóm tắt đã cũ vì hồ sơ vừa thay đổi",
};

export function OfficerFactSheet({
  brief,
  onOpenRequest,
}: {
  brief: BriefView;
  onOpenRequest?: (target: "declared" | "files") => void;
}) {
  const stale =
    brief.status === "stale" ||
    (brief.sourceTicketRevision != null && brief.sourceTicketRevision !== brief.currentTicketRevision);
  return (
    <section className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700" data-testid="officer-fact-sheet">
      <div>
        <h3 className="font-semibold">Bản tóm tắt hồ sơ</h3>
        <p className="mt-1 text-xs text-slate-500">
          {statusLabel[brief.status]}
          {brief.briefVersion != null ? ` · lần ${brief.briefVersion}` : ""}
          {stale ? " · hồ sơ đã đổi sau bản tóm tắt này" : ""}
        </p>
      </div>
      {brief.status === "failed" && brief.errorMessage ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          AI không tạo được hồ sơ: {brief.errorMessage}. Nháp cán bộ được giữ; không thay bằng câu mẫu.
        </p>
      ) : null}
      {brief.status === "pending" || brief.status === "processing" ? (
        <p className="text-sm text-slate-500">CampusAgent đang đọc đơn, hồ sơ nguồn và tài liệu được phép. Trang này không tự chạy lại AI.</p>
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
                  {fieldLabel(fact.key)}: {formatStoredValue(fact.key, fact.value)}
                </p>
                <p className="text-xs text-slate-500">
                  {sourceLabel(fact.source)} · {fact.statusText}
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
                <button
                  type="button"
                  className="text-left text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                  onClick={() => onOpenRequest?.(item.field.includes("file") || item.field.includes("attachment") ? "files" : "declared")}
                >
                  {fieldLabel(item.field)}: {item.reason}
                </button>
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
          {brief.suggestedPriority
            ? `Mức ưu tiên đề xuất: ${enumLabel(brief.suggestedPriority) || brief.suggestedPriority}`
            : "Chưa có phân loại ưu tiên từ bản tóm tắt"}
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
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Việc cán bộ nên làm tiếp</h4>
        <p className="mt-1 text-sm leading-relaxed">
          Đọc bản tóm tắt, đối chiếu minh chứng, xác nhận các việc bắt buộc, rồi mới gửi phản hồi hoặc tạo tài liệu khi đủ điều kiện.
        </p>
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cảnh báo từ AI</h4>
        {brief.warnings.length ? (
          <ul className="mt-2 space-y-1">
            {brief.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>
                {warning.message}
                <span className="mt-0.5 block text-xs text-slate-500">Mã kỹ thuật: {warning.code}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Không có cảnh báo từ bản tóm tắt.</p>
        )}
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Việc AI gợi ý (không bắt buộc)</h4>
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
      <details className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
        <summary className="cursor-pointer font-medium">Thông tin kỹ thuật</summary>
        <p className="mt-2 leading-relaxed text-slate-500">
          Chất lượng: {displayValue(brief.qualityStatus)}
          {brief.modelName ? ` · model ${brief.modelName}` : ""}
          {brief.promptVersion ? ` · prompt ${brief.promptVersion}` : ""}
          {brief.templateVersion ? ` · template ${brief.templateVersion}` : ""}
          {brief.indexVersion ? ` · index ${brief.indexVersion}` : ""}
          {brief.sourceTicketRevision != null ? ` · hồ sơ lúc tóm tắt: lần ${brief.sourceTicketRevision}` : ""}
          {` · hồ sơ hiện tại: lần ${brief.currentTicketRevision}`}
        </p>
      </details>
    </section>
  );
}
