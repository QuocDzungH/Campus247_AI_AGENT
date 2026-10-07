import type { BriefView } from "@/lib/data/api/mappers";
import { displayValue } from "@/lib/data/api/g2-flow";
import { enumLabel, fieldLabel, formatStoredValue, sourceLabel } from "@/lib/field-labels";
import {
  Compass,
  Database,
  AlertTriangle,
  Flame,
  ArrowRightCircle,
  AlertOctagon,
  Sparkles,
  MessageSquareQuote,
  BookOpen,
  Cpu,
  CheckCircle2,
} from "lucide-react";

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
    <section className="mt-4 space-y-4 rounded-none border border-[var(--ts-border-subtle)] bg-[var(--surface-card)] dark:bg-[#181614] p-4 sm:p-5 text-sm" data-testid="officer-fact-sheet">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ts-border-subtle)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-none bg-[#78716C]/10 text-[#78716C] dark:bg-[#A8A29E]/10 dark:text-[#A8A29E]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-serif text-base font-medium text-[#1C1917] dark:text-[#FAFAF9]">Bản tóm tắt hồ sơ</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#78716C] dark:text-[#A8A29E]">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${brief.status === "ready" ? "bg-[#10B981]" : brief.status === "stale" ? "bg-[#F59E0B]" : "bg-[#78716C]"}`} />
              <span>{statusLabel[brief.status]}</span>
              {brief.briefVersion != null ? (
                <span className="font-mono text-[11px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#23201D] border border-[var(--ts-border-subtle)]">
                  lần {brief.briefVersion}
                </span>
              ) : null}
              {stale ? <span className="font-medium text-[#B45309] dark:text-[#FBBF24]">· hồ sơ đã đổi sau bản tóm tắt này</span> : null}
            </p>
          </div>
        </div>
        {brief.modelName && (
          <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E] bg-[#F5F5F4] dark:bg-[#23201D] px-2 py-0.5 border border-[var(--ts-border-subtle)]">
            <Cpu className="h-3 w-3" />
            {brief.modelName}
          </span>
        )}
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
          <section className="rounded-none border border-[var(--ts-border-subtle)] bg-[#F5F5F4]/60 p-4 dark:bg-[#1E1B18]/60">
            <div className="mb-2 flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Mục tiêu sinh viên</h4>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1C1917] dark:text-[#FAFAF9]">{brief.summary || "Chưa có dữ liệu"}</p>
          </section>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Bối cảnh và dữ kiện</h4>
              </div>
              {brief.facts.length > 0 && (
                <span className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E]">{brief.facts.length} dữ kiện trích xuất</span>
              )}
            </div>
            {brief.facts.length ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 list-none m-0 p-0">
                {brief.facts.map((fact) => (
                  <li
                    key={fact.id}
                    data-testid={`brief-fact-${fact.key}`}
                    className="rounded-none border border-[var(--ts-border-subtle)] bg-[#FAF9F8] p-3 transition-colors hover:border-[#78716C] dark:bg-[#1E1B18] dark:hover:border-[#A8A29E]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-medium tracking-wide text-[#78716C] uppercase dark:text-[#A8A29E]">
                        {fieldLabel(fact.key)}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 border ${
                        fact.status === "verified"
                          ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "border-[var(--ts-border-subtle)] bg-[#F5F5F4] text-[#78716C] dark:bg-[#292524] dark:text-[#A8A29E]"
                      }`}>
                        {fact.statusText}
                      </span>
                    </div>
                    <p className="mt-1.5 font-medium text-[#1C1917] dark:text-[#FAFAF9] text-sm break-words">
                      {formatStoredValue(fact.key, fact.value)}
                    </p>
                    <p className="mt-2 pt-1.5 border-t border-[var(--ts-border-subtle)] text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                      {sourceLabel(fact.source)} · {fact.statusText}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Chưa có dữ liệu</p>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${brief.missingItems.length ? "text-[#B45309] dark:text-[#FBBF24]" : "text-[#78716C] dark:text-[#A8A29E]"}`} />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Thiếu / mâu thuẫn</h4>
            </div>
            {brief.missingItems.length ? (
              <div className="rounded-none border border-amber-300/80 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <ul className="space-y-1.5">
                  {brief.missingItems.map((item) => (
                    <li key={`${item.field}-${item.reason}`}>
                      <button
                        type="button"
                        className="group flex w-full items-start justify-between gap-2 text-left text-sm text-[#92400E] transition-colors hover:text-[#78350F] dark:text-[#FDE68A] dark:hover:text-[#FEF3C7]"
                        onClick={() => onOpenRequest?.(item.field.includes("file") || item.field.includes("attachment") ? "files" : "declared")}
                      >
                        <span>
                          <strong className="font-semibold underline decoration-amber-400 underline-offset-2">{fieldLabel(item.field)}</strong>: {item.reason}
                        </span>
                        <span className="shrink-0 text-xs text-amber-700 underline group-hover:no-underline dark:text-amber-300">
                          Xem đơn gốc →
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-none border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Không có mục thiếu do agent ghi nhận</span>
              </div>
            )}
          </section>

          <section className="rounded-none border border-[var(--ts-border-subtle)] bg-[#FAF9F8] p-3.5 dark:bg-[#1E1B18]">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#B45309] dark:text-[#FBBF24]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Phân loại và lý do ưu tiên</h4>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border ${
                brief.suggestedPriority === "high"
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  : "border-[var(--ts-border-subtle)] bg-[#F5F5F4] text-[#1C1917] dark:bg-[#23201D] dark:text-[#FAFAF9]"
              }`}>
                {brief.suggestedPriority
                  ? `Mức ưu tiên đề xuất: ${enumLabel(brief.suggestedPriority) || brief.suggestedPriority}`
                  : "Chưa có phân loại ưu tiên từ bản tóm tắt"}
              </span>
            </div>
            {brief.priorityReasons.length ? (
              <ul className="mt-2.5 space-y-1 border-t border-[var(--ts-border-subtle)] pt-2 text-xs text-[#57534E] dark:text-[#D6D3D1]">
                {brief.priorityReasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#B45309] dark:bg-[#FBBF24]" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-none border border-[var(--ts-border-subtle)] bg-[#FAF9F8] p-3.5 dark:bg-[#1E1B18]">
            <div className="flex items-center gap-2">
              <ArrowRightCircle className="h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Việc cán bộ nên làm tiếp</h4>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">
              Đọc bản tóm tắt, đối chiếu minh chứng, xác nhận các việc bắt buộc, rồi mới gửi phản hồi hoặc tạo tài liệu khi đủ điều kiện.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Cảnh báo từ AI</h4>
            </div>
            {brief.warnings.length ? (
              <div className="space-y-2">
                {brief.warnings.map((warning) => (
                  <div key={`${warning.code}-${warning.message}`} className="rounded-none border border-amber-300 bg-amber-50/70 p-3 text-xs text-[#B45309] dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-[#FBBF24]">
                    <p className="font-medium">{warning.message}</p>
                    <span className="mt-1 inline-block font-mono text-[10px] text-[#78716C] dark:text-[#A8A29E]">Mã kỹ thuật: {warning.code}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">Không có cảnh báo từ bản tóm tắt.</p>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Việc AI gợi ý (không bắt buộc)</h4>
            </div>
            {brief.checklist.length ? (
              <ul className="space-y-1.5 rounded-none border border-[var(--ts-border-subtle)] bg-[#FAF9F8] p-3 text-xs text-[#57534E] dark:bg-[#1E1B18] dark:text-[#D6D3D1]">
                {brief.checklist.map((item) => (
                  <li key={item.id} data-testid={`brief-check-${item.id}`} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block h-3.5 w-3.5 border border-[#D6D3D1] dark:border-[#44403C] rounded-none shrink-0" />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Chưa có dữ liệu</p>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Nháp phản hồi</h4>
            </div>
            <div className="rounded-none border border-[var(--ts-border-subtle)] bg-[#FAF9F8] p-3.5 dark:bg-[#1E1B18]">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">{brief.draftReply || "Chưa có dữ liệu"}</p>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#78716C] dark:text-[#A8A29E]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">Nguồn</h4>
            </div>
            {brief.citations.length ? (
              <ul className="space-y-2">
                {brief.citations.map((citation, index) => (
                  <li key={`${citation.documentId}-${citation.chunkId}-${index}`} data-testid="brief-citation" className="rounded-none border border-[var(--ts-border-subtle)] bg-[#FAF9F8] p-3 dark:bg-[#1E1B18]">
                    <p className="font-medium text-xs text-[#1C1917] dark:text-[#FAFAF9]">{citation.documentTitle}</p>
                    <p className="mt-1 font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                      {citation.documentId} · {citation.documentVersion} · {citation.locator}
                    </p>
                    <blockquote className="mt-2 border-l-2 border-[#78716C] pl-2.5 text-xs italic text-[#57534E] dark:border-[#A8A29E] dark:text-[#D6D3D1]">
                      {citation.quote}
                    </blockquote>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Chưa có dữ liệu</p>
            )}
          </section>

          <details className="rounded-none border border-[var(--ts-border-subtle)] bg-[#FAF9F8] p-3 text-xs dark:bg-[#1E1B18]">
            <summary className="cursor-pointer font-medium text-[#1C1917] dark:text-[#FAFAF9] flex items-center justify-between">
              <span>Thông tin kỹ thuật</span>
              <span className="font-mono text-[10px] text-[#78716C] dark:text-[#A8A29E]">Hồ sơ v{brief.currentTicketRevision}</span>
            </summary>
            <p className="mt-2 leading-relaxed text-[#78716C] dark:text-[#A8A29E] font-mono text-[11px]">
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
