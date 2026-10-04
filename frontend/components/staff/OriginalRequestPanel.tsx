"use client";

import { useEffect, useRef } from "react";
import type { Ticket } from "@/lib/types";
import { displayValue } from "@/lib/data/api/g2-flow";
import { fieldLabel, formatStoredValue, sourceLabel, verificationStatusLabel } from "@/lib/field-labels";
import { ticketTypeLabels } from "@/lib/staff-policy";
import { AttachmentDownload } from "@/components/student/AttachmentDownload";
import { staffButton, staffSurface } from "./StaffShell";

export function OriginalRequestPanel({
  ticket,
  open,
  onOpenChange,
  focusTarget,
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusTarget?: "declared" | "files" | null;
}) {
  const declaredRef = useRef<HTMLElement>(null);
  const filesRef = useRef<HTMLDivElement>(null);
  const profile = ticket.studentProfile;
  const fileCount = ticket.attachments?.length || 0;
  const supplemented = ticket.supplements?.some((row) => row.status === "fulfilled") === true;
  const changed = ticket.dataChangedSinceLastCheck === true;
  const processLabel = ticket.process?.label || ticketTypeLabels[ticket.type];

  useEffect(() => {
    if (!open || !focusTarget) return;
    const target = focusTarget === "files" ? filesRef.current : declaredRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open, focusTarget]);

  return (
    <section className={`${staffSurface} p-5`} data-testid="original-request-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="original-request-title" className="text-base font-semibold">Đơn sinh viên đã gửi</h2>
          <p className="mt-1 text-sm text-slate-500">
            {ticket.code} · {displayValue(ticket.studentName)} · {processLabel} · {fileCount} tệp
          </p>
        </div>
        <button
          type="button"
          className={staffButton}
          aria-expanded={open}
          aria-controls="original-request-body"
          onClick={() => onOpenChange(!open)}
        >
          {open ? "Thu gọn" : "Xem đơn gốc"}
        </button>
      </div>
      {(supplemented || changed) && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {supplemented ? "Sinh viên vừa bổ sung hồ sơ. " : ""}
          {changed ? "Dữ liệu nguồn đã thay đổi so với lần kiểm tra trước." : ""}
        </p>
      )}
      {open ? (
        <div id="original-request-body" role="region" aria-labelledby="original-request-title" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-sm font-medium">Thông tin từ hồ sơ sinh viên</h3>
              <p className="mt-1 text-xs text-slate-500">Dữ liệu hồ sơ nguồn trên máy chủ. Không gọi trạng thái nhập liệu là đã xác minh.</p>
              <dl className="mt-3 space-y-2 text-sm">
                {[
                  ["full_name", profile?.fullName || ticket.studentName],
                  ["mssv", profile?.mssv || ticket.studentMssv],
                  ["class_year", profile?.classYear || ticket.studentClassYear],
                  ["major", profile?.major || ticket.studentMajor],
                  ["faculty", profile?.faculty || ""],
                  ["source", profile?.source || ""],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-slate-500">{fieldLabel(key)}</dt>
                    <dd>{key === "source" ? sourceLabel(value) : displayValue(value)}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-slate-500">Trạng thái xác minh</dt>
                  <dd>{verificationStatusLabel(profile?.verificationStatus)}</dd>
                </div>
              </dl>
            </article>
            <article ref={declaredRef} id="original-request-declared" className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
              <h3 className="text-sm font-medium">Thông tin sinh viên kê khai</h3>
              <p className="mt-1 text-xs text-slate-500">Không coi lời khai là dữ liệu đã xác minh.</p>
              <dl className="mt-3 space-y-3 text-sm">
                {(ticket.requestPayload?.submittedFields || []).map((field) => (
                  <div key={field.name} className={field.value.length > 80 ? "sm:col-span-2" : ""}>
                    <dt className="text-xs text-slate-500">{fieldLabel(field.name, field.label)}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words">{formatStoredValue(field.name, field.value)}</dd>
                  </div>
                ))}
                {!ticket.requestPayload?.submittedFields.length && (
                  <>
                    {[
                      ["certificateType", ticket.certificateType],
                      ["purpose", ticket.purpose],
                      ["destination_org", ticket.destinationOrg],
                      ["receive_method", ticket.receiveMethod],
                    ].map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs text-slate-500">{fieldLabel(key)}</dt>
                        <dd className="mt-1 whitespace-pre-wrap">{formatStoredValue(key, value)}</dd>
                      </div>
                    ))}
                  </>
                )}
              </dl>
            </article>
          </div>
          {ticket.notes && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Nội dung bàn giao / ghi chú gốc</h3>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{ticket.notes}</p>
            </div>
          )}
          <div ref={filesRef} id="original-request-files" className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 className="mb-3 text-sm font-semibold">Tệp đính kèm ({fileCount})</h3>
            {fileCount ? (
              <div className="space-y-2">
                {ticket.attachments?.map((file) => (
                  <AttachmentDownload key={file.id} attachment={file} ownerId={ticket.studentId} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Không có tệp đính kèm được lưu trong hồ sơ.</p>
            )}
          </div>
          {ticket.supplements?.length ? (
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <h3 className="mb-3 text-sm font-semibold">Yêu cầu bổ sung</h3>
              <ul className="space-y-3 text-sm">
                {ticket.supplements.map((row) => (
                  <li key={row.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <p className="font-medium">
                      {row.status === "open" ? "Đang chờ sinh viên" : row.status === "fulfilled" ? "Sinh viên đã gửi lại" : row.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{row.reason}</p>
                    {row.items.map((item) => (
                      <p key={item.id || item.label} className="mt-1 text-xs">
                        {item.label} · {item.status === "fulfilled" ? "đã đáp ứng" : "chưa đáp ứng"}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
