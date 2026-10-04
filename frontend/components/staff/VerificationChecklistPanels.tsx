"use client";

import { useState } from "react";
import { CheckSquare, Eye, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { ChecklistItem, SystemVerificationItem, Ticket } from "@/lib/types";
import { enumLabel, fieldLabel, formatStoredValue, sourceLabel } from "@/lib/field-labels";
import { displayActorName } from "@/lib/audit-labels";
import { formatDate } from "@/lib/format-date";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { staffButton, staffPrimary, staffSurface } from "./StaffShell";
import { DisabledReason } from "./CertificateDocumentView";

function lookupTime(value?: string): string {
  if (!value?.trim()) return "chưa truy xuất";
  if (!/^\d{4}-/.test(value)) return value;
  return formatDate(value, "Asia/Bangkok");
}

function systemBadge(item: SystemVerificationItem): { label: string; className: string } {
  if (item.stale) {
    return { label: "Cần kiểm tra lại", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" };
  }
  if (item.status === "passed") {
    return { label: "Đáp ứng", className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800" };
  }
  if (item.status === "failed") {
    return { label: "Không đạt", className: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800" };
  }
  if (item.status === "error") {
    return { label: "Lỗi kết nối", className: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800" };
  }
  return { label: "Cần xác minh", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" };
}

function cardTone(item: SystemVerificationItem): string {
  if (item.stale || item.status === "insufficient") return "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20";
  if (item.status === "failed" || item.status === "error") return "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20";
  return "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
}

function officerConfirmedPass(item: SystemVerificationItem): boolean {
  if (item.officerResolution === "manual_pass") return true;
  return item.status === "passed" && !item.stale && (item.officerResolution === "viewed" || item.officerReviewStatus === "confirmed");
}

function dataKey(key: string): string {
  const trimmed = key
    .replace(/^(profile|user|account|extras)[._]/, "")
    .replace(/^extras\./, "");
  return trimmed.includes(".") ? trimmed.slice(trimmed.lastIndexOf(".") + 1) : trimmed;
}

function formatDataChecked(raw?: string): string {
  if (!raw?.trim()) return "Chưa có dữ liệu truy vấn.";
  const parts = raw.split(";").map((part) => part.trim()).filter(Boolean);
  const formatted: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const match = part.match(/^([^=]+)=(.*)$/);
    if (!match) {
      if (!seen.has(part)) {
        seen.add(part);
        formatted.push(part);
      }
      continue;
    }
    const rawKey = match[1].trim();
    if (/connector/i.test(rawKey)) continue;
    const key = dataKey(rawKey);
    let value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (value === "False") value = "Không";
    if (value === "True") value = "Có";
    if (value === "none" || value === "[]") value = "Không có";
    const line = `${fieldLabel(key)}: ${enumLabel(value) || formatStoredValue(key, value)}`;
    if (seen.has(line)) continue;
    seen.add(line);
    formatted.push(line);
  }
  return formatted.join(" · ") || "Chưa có dữ liệu truy vấn.";
}

function confirmPass(item: SystemVerificationItem): { outcome: "viewed" | "manual_pass"; note?: string } {
  if (item.status === "passed") return { outcome: "viewed", note: item.officerReviewNote };
  return {
    outcome: "manual_pass",
    note: item.officerReviewNote?.trim() || "Cán bộ xác nhận đạt sau khi xem bằng chứng tra cứu.",
  };
}

function evidenceFields(item: SystemVerificationItem): Array<[string, string]> {
  const raw = item.evidenceDetails?.verifiedFields || item.evidence || {};
  const seen = new Set<string>();
  const rows: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string" || !value.trim() || /connector/i.test(key)) continue;
    const label = fieldLabel(dataKey(key));
    const display = enumLabel(value) || formatStoredValue(dataKey(key), value);
    const dedupe = `${label}|${display}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    rows.push([label, display]);
  }
  return rows;
}

export function VerificationPanel({
  ticket,
  assignedToMe,
  assignedToOther,
  closed,
  busy,
  verifying,
  isApi,
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
  onClaim: () => void;
  onRun: () => void;
  onConfirm: (id: string, outcome: "viewed" | "manual_pass" | "manual_fail", note?: string) => void;
  onRetry: (criterionKey: string) => void;
}) {
  const items = ticket.systemVerifications || [];
  const passedCount = items.filter((item) => item.status === "passed" && !item.stale).length;
  const [evidenceItem, setEvidenceItem] = useState<SystemVerificationItem | null>(null);
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
  const actionsLocked = busy || closed || !assignedToMe;

  return (
    <section className={`${staffSurface} p-5`} data-testid="verification-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Kết quả đối soát tự động của hệ thống
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Hệ thống tra cứu các nguồn đã kết nối. Cán bộ xem bằng chứng rồi xác nhận đạt hoặc không đạt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              Hệ thống: đạt {passedCount}/{items.length} điều kiện
            </span>
          )}
          {isApi && assignedToMe && (
            <DisabledReason disabled={runDisabled} reason={runReason}>
              <button className={staffButton} disabled={runDisabled} onClick={onRun}>
                {verifying ? "Đang kiểm tra…" : items.length ? "Chạy lại kiểm tra" : "Bắt đầu kiểm tra"}
              </button>
            </DisabledReason>
          )}
        </div>
      </div>
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
        {items.map((item, index) => {
          const badge = systemBadge(item);
          const confirmed = officerConfirmedPass(item);
          const failedByOfficer = item.officerResolution === "manual_fail";
          const staleLock = Boolean(item.stale);
          const officerName = displayActorName(item.officerReviewedBy, "officer");
          return (
            <article key={item.id} className={`rounded-2xl border p-4 ${cardTone(item)}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">
                    {index + 1}. {item.criterionLabel || fieldLabel(item.criterionKey)}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Nguồn: {sourceLabel(item.sourceSystem) || item.sourceSystem} · Thời điểm: {lookupTime(item.lookupTimestamp)}
                  </p>
                </div>
                <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              {item.connectorStatus === "not_configured" && (
                <p className="mt-2 rounded-lg bg-white/80 p-2 text-sm dark:bg-slate-950/40">
                  Chưa có kết nối để kiểm tra tự động. Xem bằng chứng hiện có rồi xác nhận đạt hoặc không đạt.
                </p>
              )}
              <div className="mt-3 space-y-1.5 rounded-xl border border-slate-200/80 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                <p>
                  <span className="text-slate-500">Dữ liệu kiểm tra: </span>
                  <span className="font-medium">{formatDataChecked(item.dataChecked)}</span>
                </p>
                <p>
                  <span className="text-slate-500">Điều kiện áp dụng: </span>
                  {item.conditionApplied || "Chưa có điều kiện."}
                </p>
                <p className="border-t border-slate-100 pt-1.5 dark:border-slate-800">
                  <span className="text-slate-500">Lý do hệ thống: </span>
                  <span className={item.status === "passed" && !item.stale ? "font-medium text-emerald-700 dark:text-emerald-300" : "font-medium text-amber-800 dark:text-amber-200"}>
                    {item.reason}
                  </span>
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={staffButton} onClick={() => setEvidenceItem(item)}>
                    <Eye className="h-4 w-4" />
                    Xem bằng chứng tra cứu
                  </button>
                  {(item.status === "error" || item.stale) && assignedToMe && !closed && (
                    <DisabledReason disabled={busy} reason={busy ? "Đang xử lý." : undefined}>
                      <button type="button" className={staffButton} disabled={busy} onClick={() => onRetry(item.criterionKey)}>
                        <RefreshCw className="h-4 w-4" />
                        Thử lại tra cứu
                      </button>
                    </DisabledReason>
                  )}
                </div>
                {isApi && assignedToMe && !closed ? (
                  confirmed && !failedByOfficer ? (
                    <p className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {officerName === "Cán bộ" ? "Cán bộ đã xác nhận" : `Cán bộ ${officerName} đã xác nhận`}
                    </p>
                  ) : failedByOfficer ? (
                    <p className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
                      Cán bộ ghi nhận không đạt
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <DisabledReason disabled={actionsLocked || staleLock} reason={staleLock ? "Nguồn đã đổi, hãy thử lại tra cứu trước." : !assignedToMe ? "Nhận xử lý hồ sơ trước." : undefined}>
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={actionsLocked || staleLock}
                          onClick={() => {
                            const next = confirmPass(item);
                            onConfirm(item.id, next.outcome, next.note);
                          }}
                        >
                          <CheckSquare className="h-4 w-4" />
                          Xác nhận kết quả này
                        </button>
                      </DisabledReason>
                      <DisabledReason disabled={actionsLocked || staleLock} reason={staleLock ? "Nguồn đã đổi, hãy thử lại tra cứu trước." : undefined}>
                        <button
                          type="button"
                          className={staffButton}
                          disabled={actionsLocked || staleLock}
                          onClick={() => onConfirm(item.id, "manual_fail")}
                        >
                          Không đạt
                        </button>
                      </DisabledReason>
                    </div>
                  )
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {evidenceItem ? (
        <AccessibleDialog open labelledBy="verification-evidence-title" className="max-w-xl" onClose={() => setEvidenceItem(null)}>
          <div className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="verification-evidence-title" className="text-base font-semibold">Bằng chứng tra cứu</h3>
                <p className="mt-1 text-sm text-slate-500">{evidenceItem.criterionLabel || fieldLabel(evidenceItem.criterionKey)}</p>
              </div>
              <button type="button" className={staffButton} aria-label="Đóng bằng chứng tra cứu" onClick={() => setEvidenceItem(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="text-xs text-slate-500">Nguồn và thời điểm</p>
              <p className="mt-1 font-medium">
                {sourceLabel(evidenceItem.sourceSystem) || evidenceItem.sourceSystem} · {lookupTime(evidenceItem.lookupTimestamp)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Dữ liệu truy vấn</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{formatDataChecked(evidenceItem.dataChecked || evidenceItem.evidenceDetails?.rawSnippet)}</p>
            </div>
            {evidenceFields(evidenceItem).length > 0 && (
              <div>
                <p className="text-xs text-slate-500">Các trường đã đối chiếu</p>
                <dl className="mt-2 space-y-1 text-sm">
                  {evidenceFields(evidenceItem).map(([label, value]) => (
                    <div key={`${label}-${value}`} className="flex justify-between gap-3 border-b border-slate-100 py-1 last:border-0 dark:border-slate-800">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <p className="text-sm leading-relaxed">
              <span className="text-slate-500">Lý do hệ thống: </span>
              {evidenceItem.reason}
            </p>
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">Chi tiết kỹ thuật</summary>
              {evidenceItem.sourceVersion ? <p className="mt-2">Phiên bản nguồn: {evidenceItem.sourceVersion}</p> : null}
              {evidenceItem.sourceHash ? <p className="mt-1 break-all">Mã kiểm tra: {evidenceItem.sourceHash}</p> : null}
              {evidenceItem.conditionSource ? <p className="mt-1">Điều kiện: {evidenceItem.conditionSource}</p> : null}
            </details>
            <div className="flex justify-end">
              <button type="button" className={staffPrimary} onClick={() => setEvidenceItem(null)}>Đóng</button>
            </div>
          </div>
        </AccessibleDialog>
      ) : null}
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
