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
          <h2 id="original-request-title" className="font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">Đơn sinh viên đã gửi</h2>
          <p className="mt-1 text-sm text-[#78716C] dark:text-[#A8A29E]">
            {ticket.code} · {displayValue(ticket.studentName)} · {processLabel} · {fileCount} tệp
          </p>
          {!open && ticket.title ? (
            <p className="mt-2 text-sm leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">{ticket.title}</p>
          ) : null}
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
        <p className="mt-3 rounded-none border-l-2 border-[#B45309] bg-[#F5F5F4] px-3 py-2 text-xs text-[#1C1917] dark:border-[#FBBF24] dark:bg-[#1C1917] dark:text-[#FAFAF9]">
          {supplemented ? "Sinh viên vừa bổ sung hồ sơ. " : ""}
          {changed ? "Dữ liệu nguồn đã thay đổi so với lần kiểm tra trước." : ""}
        </p>
      )}
      {open ? (
        <div id="original-request-body" role="region" aria-labelledby="original-request-title" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-none border border-[#E7E5E4] p-4 dark:border-[#292524]">
              <h3 className="text-sm font-medium text-[#1C1917] dark:text-[#FAFAF9]">Thông tin từ hồ sơ sinh viên</h3>
              <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Dữ liệu hồ sơ nguồn trên máy chủ. Không gọi trạng thái nhập liệu là đã xác minh.</p>
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
                    <dt className="text-xs text-[#78716C] dark:text-[#A8A29E]">{fieldLabel(key)}</dt>
                    <dd className="text-[#1C1917] dark:text-[#FAFAF9]">{key === "source" ? sourceLabel(value) : displayValue(value)}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-[#78716C] dark:text-[#A8A29E]">Trạng thái xác minh</dt>
                  <dd className="text-[#1C1917] dark:text-[#FAFAF9]">{verificationStatusLabel(profile?.verificationStatus)}</dd>
                </div>
              </dl>
            </article>
            <article ref={declaredRef} id="original-request-declared" className="rounded-none border border-dashed border-[#D6D3D1] p-4 dark:border-[#44403C]">
              <h3 className="text-sm font-medium text-[#1C1917] dark:text-[#FAFAF9]">Thông tin sinh viên kê khai</h3>
              <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">Không coi lời khai là dữ liệu đã xác minh.</p>
              <dl className="mt-3 space-y-3 text-sm">
                {(ticket.requestPayload?.submittedFields || []).map((field) => (
                  <div key={field.name} className={field.value.length > 80 ? "sm:col-span-2" : ""}>
                    <dt className="text-xs text-[#78716C] dark:text-[#A8A29E]">{fieldLabel(field.name, field.label)}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-[#1C1917] dark:text-[#FAFAF9]">{formatStoredValue(field.name, field.value)}</dd>
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
                        <dt className="text-xs text-[#78716C] dark:text-[#A8A29E]">{fieldLabel(key)}</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-[#1C1917] dark:text-[#FAFAF9]">{formatStoredValue(key, value)}</dd>
                      </div>
                    ))}
                  </>
                )}
              </dl>
            </article>
          </div>
          {ticket.notes && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-[#1C1917] dark:text-[#FAFAF9]">Nội dung bàn giao / ghi chú gốc</h3>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">{ticket.notes}</p>
            </div>
          )}
          <div ref={filesRef} id="original-request-files" className="border-t border-[#E7E5E4] pt-4 dark:border-[#292524]">
            <h3 className="mb-3 font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">Tệp đính kèm ({fileCount})</h3>
            {fileCount ? (
              <div className="space-y-2">
                {ticket.attachments?.map((file) => (
                  <AttachmentDownload key={file.id} attachment={file} ownerId={ticket.studentId} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">Không có tệp đính kèm được lưu trong hồ sơ.</p>
            )}
          </div>
          {ticket.supplements?.length ? (
            <div className="border-t border-[#E7E5E4] pt-4 dark:border-[#292524]">
              <h3 className="mb-3 font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">Yêu cầu bổ sung</h3>
              <ul className="space-y-3 text-sm">
                {ticket.supplements.map((row) => (
                  <li key={row.id} className="rounded-none border border-[#E7E5E4] p-3 dark:border-[#292524]">
                    <p className="font-medium text-[#1C1917] dark:text-[#FAFAF9]">
                      {row.status === "open" ? "Đang chờ sinh viên" : row.status === "fulfilled" ? "Sinh viên đã gửi lại" : row.status}
                    </p>
                    <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E]">{row.reason}</p>
                    {row.items.map((item) => (
                      <p key={item.id || item.label} className="mt-1 text-xs text-[#57534E] dark:text-[#D6D3D1]">
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
