"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export const primaryButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-none border border-[#78716C] bg-[#78716C] px-6 py-3 text-[15px] font-semibold text-[#FAFAF9] transition-colors hover:bg-[#57534E] hover:border-[#57534E] active:bg-[#44403C] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#A8A29E] dark:bg-[#A8A29E] dark:text-[#1C1917] dark:hover:bg-[#D6D3D1] dark:hover:border-[#D6D3D1]";
export const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-none border border-[#D6D3D1] bg-transparent px-4 py-2 text-[14px] font-semibold text-[#1C1917] transition-colors hover:bg-[#F5F5F4] active:bg-[#EFEDEB] dark:border-[#44403C] dark:text-[#FAFAF9] dark:hover:bg-[#23201D] dark:active:bg-[#2E2A27]";
export const fieldClass = "w-full min-h-12 rounded-none border border-[#D6D3D1] bg-[#FAFAF9] px-4 py-3 text-[15px] text-[#1C1917] placeholder:text-[#A8A29E] transition-colors focus:border-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#78716C] dark:border-[#44403C] dark:bg-[#1C1917] dark:text-[#FAFAF9] dark:placeholder:text-[#78716C] dark:focus:border-[#A8A29E] dark:focus:ring-[#A8A29E]";
export const surfaceClass = "rounded-none border border-[#E7E5E4] bg-[#FAFAF9] p-6 sm:p-8 dark:border-[#2E2A27] dark:bg-[#1C1917]";

export function FlowHeader({ title, step }: { title: string; step: "details" | "review" }) {
  return <div className="mb-8 space-y-5">
    <Link href="/student" className={`${secondaryButton} -ml-4`}><ArrowLeft className="h-4 w-4" />Trang dịch vụ</Link>
    <h1 className="font-serif text-2xl font-bold tracking-tight text-[#1C1917] dark:text-[#FAFAF9] sm:text-[30px]">{title}</h1>
    <ol aria-label="Các bước thực hiện" className="flex flex-wrap items-center gap-3 text-sm">
      <li aria-current={step === "details" ? "step" : undefined} className="flex items-center gap-2 font-medium">
        <span className={`flex h-7 w-7 items-center justify-center rounded-none text-xs font-semibold ${step === "details" ? "bg-[#78716C] text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]" : "border border-[#D6D3D1] bg-[#F5F5F4] text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1]"}`}>
          {step === "review" ? <Check className="h-3.5 w-3.5" /> : "1"}
        </span>Điền thông tin
      </li>
      <li aria-hidden="true"><span className="block h-px w-8 bg-[#D6D3D1] dark:bg-[#44403C]" /></li>
      <li aria-current={step === "review" ? "step" : undefined} className={`flex items-center gap-2 ${step === "details" ? "text-[#57534E] dark:text-[#A8A29E]" : "font-medium"}`}>
        <span className={`flex h-7 w-7 items-center justify-center rounded-none text-xs font-semibold ${step === "review" ? "bg-[#78716C] text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]" : "border border-[#D6D3D1] bg-[#F5F5F4] text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1]"}`}>2</span>Kiểm tra &amp; gửi
      </li>
    </ol>
  </div>;
}

export function SummaryRow({ label, children, onEdit, editable = true }: { label: string; children: ReactNode; onEdit?: () => void; editable?: boolean }) {
  return <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E7E5E4] py-4 last:border-0 dark:border-[#2E2A27]">
    <div className="min-w-0 flex-1">
      <dt className="text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-base font-medium text-[#1C1917] dark:text-[#FAFAF9]">{children || "Không cung cấp"}</dd>
    </div>
    {editable && onEdit && <button type="button" onClick={onEdit} aria-label={`Sửa ${label.toLowerCase()}`} className={`${secondaryButton} -my-2 shrink-0 text-xs`}>Sửa</button>}
  </div>;
}

export function SubmissionSuccess({ ticketId, ticketCode, title, children, onNew, localOnly = false, embedded = false }: { ticketId: string; ticketCode: string; title: string; children: ReactNode; onNew?: () => void; localOnly?: boolean; embedded?: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const Heading = embedded ? "h2" : "h1";
  useEffect(() => { headingRef.current?.focus(); }, []);
  return <div className="mx-auto max-w-[720px] pt-4 sm:pt-10">
    <div className={surfaceClass}>
      <CheckCircle2 className="mb-5 h-12 w-12 text-[#3F6212] dark:text-[#86EFAC]" aria-hidden="true" />
      <Heading ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-bold tracking-tight text-[#1C1917] dark:text-[#FAFAF9]">{title}</Heading>
      <p className="mt-3 text-base text-[#57534E] dark:text-[#D6D3D1]">{children}</p>
      {localOnly && <p className="mt-3 text-sm text-[#57534E] dark:text-[#A8A29E]">Hồ sơ được lưu trên thiết bị này. Để gửi đến nhà trường, sử dụng kênh tiếp nhận chính thức trong hướng dẫn dịch vụ.</p>}
      <div className="my-6 rounded-none border border-[#E7E5E4] bg-[#F5F5F4] p-4 dark:border-[#2E2A27] dark:bg-[#1C1917]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E]">Mã hồ sơ</p>
        <p className="mt-1 break-all font-mono text-base font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{ticketCode}</p>
        <p className="mt-2 text-sm text-[#57534E] dark:text-[#D6D3D1]">Trạng thái: {localOnly ? "Đã lưu hồ sơ" : "Mới nộp"}. Bạn có thể xem lại thông tin trong Hồ sơ của tôi.</p>
      </div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Link href={`/my-requests?ticket=${encodeURIComponent(ticketId)}`} className={primaryButton}>Xem hồ sơ<ArrowRight className="h-4 w-4" /></Link>
        <Link href="/student" className={secondaryButton}>Về trang dịch vụ</Link>
      </div>
      {onNew && <button type="button" onClick={onNew} className={`${secondaryButton} mt-5 -ml-4`}>Tạo yêu cầu khác</button>}
    </div>
  </div>;
}
