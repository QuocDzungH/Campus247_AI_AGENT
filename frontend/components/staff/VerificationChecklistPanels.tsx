"use client";

import type { ChecklistItem, SystemVerificationItem, Ticket } from "@/lib/types";
import { enumLabel, fieldLabel, sourceLabel } from "@/lib/field-labels";
import { formatDate } from "@/lib/format-date";
import { staffButton, staffField, staffPrimary, staffSurface } from "./StaffShell";
import { DisabledReason } from "./CertificateDocumentView";

function verificationTone(item: SystemVerificationItem): string {
  if (item.stale) return "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950";
  if (item.status === "passed") return "border-emerald-200 dark:border-emerald-900";
  if (item.status === "failed") return "border-red-200 dark:border-red-900";
  return "border-slate-200 dark:border-slate-800";
}

export function VerificationPanel({
  ticket,
  assignedToMe,
  assignedToOther,
  closed,
  busy,
  verifying,
  isApi,
  verifyNote,
  onVerifyNote,
  onClaim,
  onRun,
  onConfirm,
  onRetry,
}: {
  ticket: Ticket;
  assignedToMe: boolean;
  assignedToOther: boolean;
  closed: boolean;
  busy: boolean;
  verifying: boolean;
  isApi: boolean;
  verifyNote: Record<string, string>;
  onVerifyNote: (id: string, value: string) => void;
  onClaim: () => void;
  onRun: () => void;
  onConfirm: (id: string, outcome: "viewed" | "manual_pass" | "manual_fail") => void;
  onRetry: (criterionKey: string) => void;
}) {
  const items = ticket.systemVerifications || [];
  const claimReason = closed
    ? "Hồ sơ đã đóng, không nhận xử lý thêm."
    : assignedToOther
      ? `Hồ sơ đang do ${ticket.assignedOfficerName || "cán bộ khác"} phụ trách.`
      : assignedToMe
        ? "Bạn đã nhận xử lý hồ sơ này."
        : undefined;
  const runReason = closed
    ? "Hồ sơ đã đóng nên không chạy kiểm tra mới."
    : !assignedToMe
      ? assignedToOther
        ? `Chỉ xem. Người phụ trách: ${ticket.assignedOfficerName || "cán bộ khác"}.`
        : "Nhận xử lý hồ sơ để bắt đầu kiểm tra."
      : verifying
        ? "Đang chạy kiểm tra."
        : undefined;
  const runDisabled = busy || closed || !assignedToMe || verifying;

  return (
    <section className={`${staffSurface} p-5`} data-testid="verification-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Kiểm tra thông tin và minh chứng</h2>
        {isApi && assignedToMe && (
          <DisabledReason disabled={runDisabled} reason={runReason}>
            <button className={staffButton} disabled={runDisabled} onClick={onRun}>
              {verifying ? "Đang kiểm tra…" : items.length ? "Chạy lại kiểm tra" : "Bắt đầu kiểm tra"}
            </button>
          </DisabledReason>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">Đối chiếu thông tin trong đơn với hồ sơ và các nguồn liên quan.</p>
      {isApi && !assignedToMe && !assignedToOther && !closed && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-sm">Nhận xử lý hồ sơ để bắt đầu kiểm tra.</p>
          <DisabledReason disabled={busy || closed} reason={claimReason}>
            <button className={`${staffPrimary} mt-2`} disabled={busy || closed} onClick={onClaim}>
              Nhận xử lý hồ sơ
            </button>
          </DisabledReason>
        </div>
      )}
      {assignedToOther && (
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
          Hồ sơ đang do {ticket.assignedOfficerName || "cán bộ khác"} phụ trách. Bạn đang xem ở chế độ chỉ xem.
        </p>
      )}
      {closed && <p className="mt-3 text-sm text-slate-500">Hồ sơ đã đóng nên không chạy kiểm tra mới.</p>}
      {verifying && <p className="mt-3 text-sm text-slate-500">Đang đối chiếu nguồn. Kết quả sẽ hiện khi hoàn tất.</p>}
      {assignedToMe && !items.length && !verifying && (
        <p className="mt-3 text-sm text-slate-500">Chưa chạy kiểm tra cho hồ sơ này. Các tiêu chí sẽ hiện sau khi bắt đầu kiểm tra.</p>
      )}
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <article key={item.id} className={`rounded-xl border p-4 ${verificationTone(item)}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-medium">{item.criterionLabel || fieldLabel(item.criterionKey)}</h3>
              <p className="text-xs">
                {enumLabel(item.status) || item.status}
                {item.stale ? " · nguồn đã đổi, cần kiểm tra lại" : ""}
              </p>
            </div>
            {item.connectorStatus === "not_configured" && (
              <p className="mt-2 rounded-lg bg-white/70 p-2 text-sm dark:bg-slate-950/40">
                Chưa có kết nối để kiểm tra tự động. Cán bộ đối chiếu thủ công với hồ sơ giấy/tệp, ghi chú và lưu kết quả.
              </p>
            )}
            <p className="mt-2 text-sm">{item.reason}</p>
            <p className="mt-2 text-xs text-slate-500">
              Điều kiện: {item.conditionApplied}
              {item.conditionSource ? ` · ${item.conditionSource}` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Nguồn: {sourceLabel(item.sourceSystem) || item.sourceSystem}
              {item.lookupTimestamp ? ` · truy xuất ${formatDate(item.lookupTimestamp, "Asia/Bangkok")}` : " · chưa truy xuất"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Cán bộ: {enumLabel(item.officerResolution || "none") || "chưa kiểm tra"}
              {item.officerReviewedBy ? ` · ${item.officerReviewedBy}` : ""}
              {item.officerReviewedAt ? ` · ${formatDate(item.officerReviewedAt, "Asia/Bangkok")}` : ""}
            </p>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Chi tiết kỹ thuật</summary>
              <p className="mt-2 whitespace-pre-wrap">{item.dataChecked}</p>
              {item.sourceVersion ? <p className="mt-1">source_version {item.sourceVersion}</p> : null}
              {item.sourceHash ? <p className="mt-1">hash {item.sourceHash}</p> : null}
              {item.evidence && (
                <pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(item.evidence, null, 2)}</pre>
              )}
            </details>
            {isApi && assignedToMe && !closed && (
              <div className="mt-3 space-y-2">
                <textarea
                  className={`${staffField} min-h-16`}
                  placeholder="Ghi chú khi xem hoặc đối chiếu thủ công"
                  value={verifyNote[item.id] || item.officerReviewNote || ""}
                  onChange={(event) => onVerifyNote(item.id, event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <DisabledReason disabled={busy || Boolean(item.stale)} reason={item.stale ? "Nguồn đã đổi, hãy chạy lại kiểm tra trước." : undefined}>
                    <button className={staffButton} disabled={busy || item.stale} onClick={() => onConfirm(item.id, "viewed")}>
                      Đã xem kết quả
                    </button>
                  </DisabledReason>
                  <DisabledReason
                    disabled={busy || Boolean(item.stale) || !(verifyNote[item.id] || item.officerReviewNote)}
                    reason={
                      item.stale
                        ? "Nguồn đã đổi, hãy chạy lại kiểm tra trước."
                        : !(verifyNote[item.id] || item.officerReviewNote)
                          ? "Nhập ghi chú minh chứng trước khi ghi nhận đạt thủ công."
                          : undefined
                    }
                  >
                    <button
                      className={staffButton}
                      disabled={busy || item.stale || !(verifyNote[item.id] || item.officerReviewNote)}
                      onClick={() => onConfirm(item.id, "manual_pass")}
                    >
                      Đối chiếu thủ công: đạt
                    </button>
                  </DisabledReason>
                  <DisabledReason disabled={busy || Boolean(item.stale)} reason={item.stale ? "Nguồn đã đổi, hãy chạy lại kiểm tra trước." : undefined}>
                    <button className={staffButton} disabled={busy || item.stale} onClick={() => onConfirm(item.id, "manual_fail")}>
                      Không đạt
                    </button>
                  </DisabledReason>
                  <button className={staffButton} disabled={busy} onClick={() => onRetry(item.criterionKey)}>
                    Kiểm tra lại tiêu chí
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ProcessChecklistPanel({
  ticket,
  assignedToMe,
  assignedToOther,
  closed,
  busy,
  isApi,
  onClaim,
  onToggle,
  onEnsure,
}: {
  ticket: Ticket;
  assignedToMe: boolean;
  assignedToOther: boolean;
  closed: boolean;
  busy: boolean;
  isApi: boolean;
  onClaim: () => void;
  onToggle: (id: string) => void;
  onEnsure: () => void;
}) {
  const processItems = ticket.checklist.filter((item) => item.source !== "ai");
  const aiItems = ticket.checklist.filter((item) => item.source === "ai");
  const planned = ticket.process?.plannedChecklist || [];
  const showPlanned = !ticket.checklist.length && !assignedToMe;
  const toggleReason = closed
    ? "Hồ sơ đã đóng, không sửa checklist."
    : !assignedToMe
      ? assignedToOther
        ? `Chỉ xem. Người phụ trách: ${ticket.assignedOfficerName || "cán bộ khác"}.`
        : "Nhận xử lý hồ sơ trước khi xác nhận việc cần kiểm tra."
      : undefined;

  return (
    <section className={`${staffSurface} p-5`} data-testid="process-checklist-panel">
      <h2 className="text-base font-semibold">Các việc cần kiểm tra</h2>
      <p className="mt-1 text-xs text-slate-500">Cán bộ xác nhận từng việc đã hoàn thành trước khi xử lý kết quả.</p>
      {isApi && !assignedToMe && !assignedToOther && !closed && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-sm">Nhận xử lý hồ sơ để bắt đầu kiểm tra.</p>
          <button className={`${staffPrimary} mt-2`} disabled={busy || closed} onClick={onClaim}>
            Nhận xử lý hồ sơ
          </button>
        </div>
      )}
      {assignedToMe && !ticket.checklist.length && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-sm">Hồ sơ đã nhận nhưng chưa có checklist đúng phiên bản quy trình.</p>
          <DisabledReason disabled={busy || closed} reason={closed ? "Hồ sơ đã đóng." : undefined}>
            <button className={`${staffButton} mt-2`} disabled={busy || closed} onClick={onEnsure}>
              Bổ sung các việc cần kiểm tra
            </button>
          </DisabledReason>
        </div>
      )}
      {showPlanned && planned.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500">Danh sách việc dự kiến theo quy trình. Chưa bắt đầu vì hồ sơ chưa được nhận xử lý.</p>
          {planned.map((item) => (
            <div key={item.id} className="rounded-xl border border-dashed border-slate-300 p-3 text-sm dark:border-slate-700">
              <p className="font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500">Bắt buộc · chưa bắt đầu</p>
            </div>
          ))}
        </div>
      )}
      <ChecklistGroup
        title="Việc bắt buộc của quy trình"
        items={processItems}
        disabled={busy || closed || (isApi && !assignedToMe)}
        reason={toggleReason}
        onToggle={onToggle}
      />
      {aiItems.length > 0 && (
        <ChecklistGroup
          title="Việc AI gợi ý (không bắt buộc)"
          items={aiItems}
          disabled={busy || closed || (isApi && !assignedToMe)}
          reason={toggleReason}
          onToggle={onToggle}
        />
      )}
    </section>
  );
}

function ChecklistGroup({
  title,
  items,
  disabled,
  reason,
  onToggle,
}: {
  title: string;
  items: ChecklistItem[];
  disabled: boolean;
  reason?: string;
  onToggle: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-3 space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {items.map((item) => (
        <label key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={item.checked}
            disabled={disabled}
            onChange={() => onToggle(item.id)}
          />
          <span>
            <span className="text-sm font-medium">{item.label}</span>
            <span className="mt-1 block text-xs text-slate-500">
              {item.required ? "Bắt buộc" : "Gợi ý"} · {item.source === "ai" ? "AI đề xuất" : "Quy trình"}
              {item.checkedBy ? ` · ${item.checkedBy}` : ""}
              {item.checkedAt ? ` · ${formatDate(item.checkedAt, "Asia/Bangkok")}` : ""}
            </span>
            {item.description ? <span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.description}</span> : null}
            {disabled && reason ? <span className="mt-1 block text-xs text-slate-500">{reason}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}
