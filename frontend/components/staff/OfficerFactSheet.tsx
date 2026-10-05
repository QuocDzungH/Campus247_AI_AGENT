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
    <section className="mt-4 space-y-4 rounded-none border border-[#E7E5E4] p-4 text-sm dark:border-[#292524]" data-testid="officer-fact-sheet">
      <div>
        <h3 className="font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">Bản tóm tắt hồ sơ</h3>
        <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">
          {statusLabel[brief.status]}
          {brief.briefVersion != null ? ` · lần ${brief.briefVersion}` : ""}
          {stale ? " · hồ sơ đã đổi sau bản tóm tắt này" : ""}
        </p>
      </div>
      {brief.status === "failed" && brief.errorMessage ? (
        <p role="alert" className="rounded-none border-l-2 border-[#B91C1C] bg-[#F5F5F4] p-3 text-sm text-[#B91C1C] dark:border-[#EF4444] dark:bg-[#1C1917] dark:text-[#EF4444]">
          AI không tạo được hồ sơ: {brief.errorMessage}. Nháp cán bộ được giữ; không thay bằng câu mẫu.
        </p>
      ) : null}
      {brief.status === "pending" || brief.status === "processing" ? (
        <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">
          CampusAgent đang đọc đơn, hồ sơ nguồn và tài liệu được phép. Trang này không tự chạy lại AI.
          Nội dung sinh viên đã gửi nằm ở Đơn sinh viên đã gửi bên dưới; các mục tóm tắt chỉ có sau khi AI xong.
        </p>
      ) : (
      <>
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Mục tiêu sinh viên</h4>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-[#1C1917] dark:text-[#FAFAF9]">{brief.summary || "Chưa có dữ liệu"}</p>
      </section>
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Bối cảnh và dữ kiện</h4>
        {brief.facts.length ? (
          <ul className="mt-2 space-y-2">
            {brief.facts.map((fact) => (
              <li key={fact.id} data-testid={`brief-fact-${fact.key}`}>
                <p className="text-[#1C1917] dark:text-[#FAFAF9]">
                  {fieldLabel(fact.key)}: {formatStoredValue(fact.key, fact.value)}
                </p>
                <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                  {sourceLabel(fact.source)} · {fact.statusText}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Chưa có dữ liệu</p>
        )}
      </section>
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Thiếu / mâu thuẫn</h4>
        {brief.missingItems.length ? (
          <ul className="mt-2 space-y-1">
            {brief.missingItems.map((item) => (
              <li key={`${item.field}-${item.reason}`}>
                <button
                  type="button"
                  className="text-left text-[#1C1917] underline decoration-[#A8A29E] underline-offset-2 hover:decoration-[#1C1917] dark:text-[#FAFAF9]"
                  onClick={() => onOpenRequest?.(item.field.includes("file") || item.field.includes("attachment") ? "files" : "declared")}
                >
                  {fieldLabel(item.field)}: {item.reason}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Không có mục thiếu do agent ghi nhận</p>
        )}
      </section>
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Phân loại và lý do ưu tiên</h4>
        <p className="mt-1 text-[#1C1917] dark:text-[#FAFAF9]">
          {brief.suggestedPriority
            ? `Mức ưu tiên đề xuất: ${enumLabel(brief.suggestedPriority) || brief.suggestedPriority}`
            : "Chưa có phân loại ưu tiên từ bản tóm tắt"}
        </p>
        {brief.priorityReasons.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[#57534E] dark:text-[#D6D3D1]">
            {brief.priorityReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Việc cán bộ nên làm tiếp</h4>
        <p className="mt-1 text-sm leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">
          Đọc bản tóm tắt, đối chiếu minh chứng, xác nhận các việc bắt buộc, rồi mới gửi phản hồi hoặc tạo tài liệu khi đủ điều kiện.
        </p>
      </section>
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Cảnh báo từ AI</h4>
        {brief.warnings.length ? (
          <ul className="mt-2 space-y-1">
            {brief.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`} className="text-[#B45309] dark:text-[#FBBF24]">
                {warning.message}
                <span className="mt-0.5 block text-xs text-[#78716C] dark:text-[#A8A29E]">Mã kỹ thuật: {warning.code}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Không có cảnh báo từ bản tóm tắt.</p>
        )}
      </section>
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Việc AI gợi ý (không bắt buộc)</h4>
        {brief.checklist.length ? (
          <ul className="mt-2 space-y-1 text-[#57534E] dark:text-[#D6D3D1]">
            {brief.checklist.map((item) => (
              <li key={item.id} data-testid={`brief-check-${item.id}`}>
                {item.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Chưa có dữ liệu</p>
        )}
      </section>
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Nháp phản hồi</h4>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">{brief.draftReply || "Chưa có dữ liệu"}</p>
      </section>
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Nguồn</h4>
        {brief.citations.length ? (
          <ul className="mt-2 space-y-2">
            {brief.citations.map((citation, index) => (
              <li key={`${citation.documentId}-${citation.chunkId}-${index}`} data-testid="brief-citation">
                <p className="font-medium text-[#1C1917] dark:text-[#FAFAF9]">{citation.documentTitle}</p>
                <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                  {citation.documentId} · {citation.documentVersion} · {citation.locator}
                </p>
                <blockquote className="mt-1 border-l-2 border-[#78716C] pl-3 text-xs italic text-[#57534E] dark:border-[#A8A29E] dark:text-[#D6D3D1]">{citation.quote}</blockquote>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Chưa có dữ liệu</p>
        )}
      </section>
      <details className="rounded-none border border-[#E7E5E4] p-3 text-xs dark:border-[#292524]">
        <summary className="cursor-pointer font-medium text-[#1C1917] dark:text-[#FAFAF9]">Thông tin kỹ thuật</summary>
        <p className="mt-2 leading-relaxed text-[#78716C] dark:text-[#A8A29E]">
          Chất lượng: {displayValue(brief.qualityStatus)}
          {brief.modelName ? ` · model ${brief.modelName}` : ""}
          {brief.promptVersion ? ` · prompt ${brief.promptVersion}` : ""}
          {brief.templateVersion ? ` · template ${brief.templateVersion}` : ""}
          {brief.indexVersion ? ` · index ${brief.indexVersion}` : ""}
          {brief.sourceTicketRevision != null ? ` · hồ sơ lúc tóm tắt: lần ${brief.sourceTicketRevision}` : ""}
          {` · hồ sơ hiện tại: lần ${brief.currentTicketRevision}`}
        </p>
      </details>
      </>
      )}
    </section>
  );
}
