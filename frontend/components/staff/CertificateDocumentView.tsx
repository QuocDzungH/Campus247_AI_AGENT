"use client";

import { useState } from "react";
import { Printer, Maximize2 } from "lucide-react";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import {
  CertificateContent,
  certificateNotice,
  confirmationParagraph,
  kindBanner,
} from "@/lib/certificate-document";
import { formatDate } from "@/lib/format-date";
import { staffButton } from "./StaffShell";

function displayDate(value?: string | null): string | null {
  if (!value?.trim()) return null;
  if (!/^\d{4}-/.test(value)) return value;
  return formatDate(value, "Asia/Bangkok");
}

function CertificateBody({ doc }: { doc: CertificateContent }) {
  return (
    <article className="certificate-sheet text-slate-900">
      <header className="text-center">
        <p className="text-[1.05em] font-semibold tracking-wide">{doc.institutionName}</p>
        {doc.institutionUnit ? <p className="mt-1 text-[0.95em]">{doc.institutionUnit}</p> : null}
        <div className="mx-auto mt-3 h-px w-full bg-slate-800" />
        <h3 className="mt-5 text-[1.25em] font-bold uppercase tracking-wide">{doc.title}</h3>
        <p className="mt-2 text-[0.78em] font-medium text-amber-800">{kindBanner(doc)}</p>
      </header>
      <p className="mt-6 text-justify leading-relaxed">{confirmationParagraph(doc)}</p>
      {doc.purpose ? (
        <section className="mt-5">
          <h4 className="text-[0.85em] font-semibold">Mục đích</h4>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{doc.purpose}</p>
        </section>
      ) : null}
      {doc.destinationOrg ? (
        <section className="mt-4">
          <h4 className="text-[0.85em] font-semibold">Cơ quan/đơn vị nhận</h4>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{doc.destinationOrg}</p>
        </section>
      ) : null}
      {doc.notes ? (
        <section className="mt-4">
          <h4 className="text-[0.85em] font-semibold">Ghi chú</h4>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{doc.notes}</p>
        </section>
      ) : null}
      <dl className="mt-5 space-y-1 text-[0.92em]">
        {doc.documentNumber ? (
          <div>
            <dt className="inline font-medium">Số văn bản: </dt>
            <dd className="inline">{doc.documentNumber}</dd>
          </div>
        ) : null}
        {displayDate(doc.issuedAt) ? (
          <div>
            <dt className="inline font-medium">Ngày: </dt>
            <dd className="inline">{displayDate(doc.issuedAt)}</dd>
          </div>
        ) : null}
        {displayDate(doc.validUntil) ? (
          <div>
            <dt className="inline font-medium">Thời hạn: </dt>
            <dd className="inline">{displayDate(doc.validUntil)}</dd>
          </div>
        ) : null}
        {doc.ticketCode ? (
          <div>
            <dt className="inline font-medium">Hồ sơ: </dt>
            <dd className="inline">{doc.ticketCode}</dd>
          </div>
        ) : null}
      </dl>
      <section className="mt-10">
        <h4 className="text-[0.85em] font-semibold">Người có thẩm quyền ký</h4>
        {doc.signatureStatus === "signed" && doc.issuedByName ? (
          <p className="mt-3">{doc.issuedByName}</p>
        ) : (
          <>
            <div className="mt-8 h-10" />
            <p className="text-[0.9em]">Chưa có chữ ký số.</p>
            {doc.issuedByName ? <p className="mt-1 text-[0.9em]">Cán bộ soạn: {doc.issuedByName}</p> : null}
          </>
        )}
      </section>
      <p className="mt-8 text-[0.82em] leading-relaxed text-slate-600">{certificateNotice(doc)}</p>
    </article>
  );
}

export function CertificateDocumentView({
  doc,
  actions,
}: {
  doc: CertificateContent;
  actions?: React.ReactNode;
}) {
  const [large, setLarge] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 no-print">
        {actions}
        <button type="button" className={staffButton} onClick={() => window.print()}>
          <Printer className="h-4 w-4" />In A4
        </button>
        <button type="button" className={staffButton} onClick={() => setLarge(true)}>
          <Maximize2 className="h-4 w-4" />Mở bản xem trước lớn
        </button>
      </div>
      <div className="certificate-a4-frame no-print" data-testid="certificate-a4-preview">
        <div className="certificate-a4-page">
          <CertificateBody doc={doc} />
        </div>
      </div>
      <div className="certificate-print-root">
        <CertificateBody doc={doc} />
      </div>
      {large ? (
        <AccessibleDialog open labelledBy="certificate-large-title" className="max-w-4xl" onClose={() => setLarge(false)}>
          <div className="space-y-3 p-4">
            <h2 id="certificate-large-title" className="text-lg font-semibold">Bản xem trước A4</h2>
            <div className="certificate-a4-frame is-large">
              <div className="certificate-a4-page">
                <CertificateBody doc={doc} />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className={staffButton} onClick={() => setLarge(false)}>Đóng</button>
            </div>
          </div>
        </AccessibleDialog>
      ) : null}
    </div>
  );
}

export function DisabledReason({
  disabled,
  reason,
  children,
}: {
  disabled: boolean;
  reason?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      {children}
      {disabled && reason ? <span className="max-w-xs text-xs leading-relaxed text-slate-500">{reason}</span> : null}
    </span>
  );
}
