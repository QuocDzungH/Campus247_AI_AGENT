"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ExternalLink, FileText, Loader2, MessageCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { useVinUniForms } from "@/lib/vinuni-workspace";
import { VINUNI_SOURCES, documentTypes, validateForm, visibleFields, type VinUniTask, type FormField } from "@/lib/vinuni-forms";
import { useAssistant } from "@/lib/assistant-context";
import { saveLocalAttachments, validateAttachment } from "@/lib/local-attachments";
import { fieldClass, primaryButton, secondaryButton, SubmissionSuccess, surfaceClass, SummaryRow } from "./StudentFlowUI";

interface FormProps { task: VinUniTask; review?: boolean; embedded?: boolean }
export function VinUniForm(props: FormProps) {
  const { state } = useVinUniForms();
  return <VinUniFormContent key={state[props.task].id} {...props} />;
}
function VinUniFormContent({ task, review: routeReview = false, embedded = false }: FormProps) {
  const router = useRouter();
  const { currentUser, createTicket, uploadTicketFile, dataConfig } = useStore();
  const { state, store } = useVinUniForms();
  const draft = state[task];
  const review = routeReview || draft.stage === 2;
  const assistant = useAssistant();
  const prefix = useId();
  const container = useRef<HTMLDivElement>(null);
  const values = draft.values;
  const files = store.getFiles(task);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const submitting = state.pending.includes(draft.id);
  const [submitError, setSubmitError] = useState("");
  const submission = draft.submission;
  const heading = useRef<HTMLHeadingElement>(null);
  const base = `/student/${task}`;
  const isDocument = task === "certificate";
  const localOnly = dataConfig?.mode === "mock";
  const stepTitle = review ? "Kiểm tra thông tin trước khi xác nhận" : isDocument ? draft.stage === 0 ? "Bạn cần loại tài liệu nào?" : "Bạn muốn nhận tài liệu thế nào?" : draft.stage === 0 ? "Thông tin học phần cần xem xét" : "Căn cứ và tài liệu minh chứng";
  const steps = isDocument ? ["Tài liệu", "Cách nhận", "Kiểm tra"] : ["Học phần", "Minh chứng", "Kiểm tra"];
  const allErrors = validateForm(task, values, [0, 1], files);
  const valid = Object.keys(allErrors).length === 0;
  const checked = draft.checked === JSON.stringify(values);

  useEffect(() => { heading.current?.focus(); }, [review, draft.stage]);
  useEffect(() => {
    if (assistant.fieldTarget?.task !== task) return;
    const element = container.current?.querySelector<HTMLElement>(`[data-form-field="${assistant.fieldTarget.name}"]`);
    element?.focus(); element?.scrollIntoView({ block: "nearest" });
  }, [assistant.fieldTarget, task, draft.stage]);

  function goEdit(stage: number) { store.stage(task, stage); if (routeReview && !embedded) router.push(base); }
  function startNew() {
    assistant.openForm(task);
    if (store.startNew(task, /@(?:[\w-]+\.)*vinuni\.edu\.vn$/i.test(currentUser?.email || "") ? currentUser!.email : "")) {
      assistant.openForm(task); if (routeReview && !embedded) router.push(base);
    }
  }

  function edit(name: string, value: string) {
    store.update(task, { [name]: value });
    setErrors((previous) => ({ ...previous, [name]: "" }));
    setSubmitError("");
  }
  function focusFirst(next: Record<string, string>) { requestAnimationFrame(() => container.current?.querySelector<HTMLElement>(`[data-form-field="${Object.keys(next)[0]}"]`)?.focus()); }
  function advance(event: FormEvent) {
    event.preventDefault();
    const next = { ...validateForm(task, values, [draft.stage], files), ...(draft.stage === 1 ? fileErrors : {}) };
    setErrors(next);
    if (Object.keys(next).length) { focusFirst(next); return; }
    if (draft.stage === 0) { store.stage(task, 1); return; }
    store.check(task); store.stage(task, 2); if (!embedded) router.push(`${base}/review`);
  }
  function formNotes() {
    const rows = [`Sinh viên: ${currentUser?.name}`, `Student ID: ${currentUser?.mssv || currentUser?.id}`];
    if (currentUser?.classYear) rows.push(`Khóa học: ${currentUser.classYear}`);
    if (currentUser?.major) rows.push(`Ngành: ${currentUser.major}`);
    for (const stage of [0, 1]) for (const f of visibleFields(task, stage, values)) {
      const value = values[f.name] || "";
      rows.push(`${f.label}: ${f.type === "checkbox" ? value === "yes" ? "Có" : "Không" : f.options?.find(([id]) => id === value)?.[1] || value || "Không cung cấp"}`);
    }
    return rows.join("\n\n");
  }
  function submissionKey() {
    let hash = 2166136261;
    for (const character of `${draft.id}:${draft.checked}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return `vinuni-${task}-${(hash >>> 0).toString(36)}`;
  }
  async function submit() {
    if (!valid || !checked || !currentUser) return;
    const operation = store.beginSubmission(task);
    if (!operation) return;
    const threadId = assistant.active.id;
    setSubmitError("");
    const documentLabel = documentTypes.find(([id]) => id === values.documentType)?.[1] || "Tài liệu học vụ";
    try {
      const attachments = Object.values(files).some(group => group.length) && dataConfig?.mode === "mock"
        ? await saveLocalAttachments(currentUser.id, submissionKey(), files)
        : [];
      const requestPayload = { schemaVersion: 1 as const, task, documentType: isDocument ? values.documentType : undefined,
        submittedFields: [0, 1].flatMap(stage => visibleFields(task, stage, values)).filter(field => field.type !== "file").map(field => ({ name: field.name, label: field.label, value: field.type === "checkbox" ? values[field.name] === "yes" ? "Có" : "Không" : field.options?.find(([id]) => id === values[field.name])?.[1] || values[field.name] || "Không cung cấp" })) };
      const ticket = await createTicket(isDocument ? {
        requestPayload,
        type: values.documentType === "TNR" ? "transcript" : "certificate", title: `${documentLabel} · ${values.copies} bản`, certificateType: documentLabel,
        submissionKey: submissionKey(), attachments, purpose: values.purpose?.trim() || `Yêu cầu ${documentLabel}`,
        destinationOrg: values.destinationOrg?.trim() || (values.recipient === "other" ? values.recipientEmail : "VinUni Registrar"),
        receiveMethod: values.receiveMethod === "paper_stamped" ? "paper_stamped" : "digital_pdf", notes: formNotes(), priority: "normal",
        priorityReason: "Sinh viên đã kiểm tra và gửi yêu cầu tài liệu trong Campus 24/7.",
      } : {
        type: "complaint", title: `Grade Appeal · ${values.courseCode} · ${values.course}`, certificateType: "Khiếu nại điểm tổng kết học phần",
        requestPayload,
        submissionKey: submissionKey(), attachments, purpose: values.description.trim(), destinationOrg: "Academic Quality Assurance",
        receiveMethod: "digital_pdf", notes: formNotes(), priority: "high", isL4: true,
        l4TriggerReason: "Sinh viên đã xác nhận gửi Grade Appeal để cán bộ xem xét.",
        priorityReason: "Khiếu nại điểm tổng kết học phần cần cán bộ xác minh và phản hồi.",
      });
      if (dataConfig?.mode === "api") {
        for (const [field, group] of Object.entries(files)) {
          for (const file of group) {
            await uploadTicketFile(ticket.id, file, field);
          }
        }
      }
      store.recordSubmission(task, operation, { ticketId: ticket.id, ticketCode: ticket.code });
      assistant.markSubmitted(threadId);
    } catch (failure) {
      setSubmitError(failure instanceof Error && /tệp|thiết bị|trình duyệt/.test(failure.message) ? failure.message : "Chưa nộp được hồ sơ. Bản nháp và tệp đã chọn vẫn được giữ; hãy thử lại.");
    } finally { store.endSubmission(operation); }
  }
  function attachment(field: FormField, selected: File[]) {
    const invalid = selected.length > 5 || selected.some((f) => validateAttachment(f));
    if (invalid) {
      const message = "Chọn tối đa 5 tệp PDF/PNG/JPG, mỗi tệp không rỗng và tối đa 10MB. Tệp hợp lệ đã chọn trước đó vẫn được giữ.";
      setFileErrors((previous) => ({ ...previous, [field.name]: message }));
      setErrors((previous) => ({ ...previous, [field.name]: message })); return;
    }
    setFileErrors((previous) => { const next = { ...previous }; delete next[field.name]; return next; });
    store.attach(task, field.name, selected); setErrors((previous) => ({ ...previous, [field.name]: "" })); setSubmitError("");
  }
  function renderField(field: FormField) {
    const id = `${prefix}-${field.name}`;
    const error = errors[field.name];
    const props = { id, "data-form-field": field.name, disabled: submitting, "aria-invalid": Boolean(error), "aria-describedby": `${id}-hint${error ? ` ${id}-error` : ""}` };
    if (field.type === "select" && ["documentType", "receiveMethod", "delivery", "recipient"].includes(field.name)) return <fieldset key={field.name} className="sm:col-span-2" aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}>
      <legend className="text-sm font-semibold text-[#1C1917] dark:text-[#FAFAF9]">{field.label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{field.options?.map(([value, label], index) => <label key={value} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-none border p-3 transition-colors ${values[field.name] === value ? "border-[#78716C] bg-[#F5F5F4] dark:border-[#A8A29E] dark:bg-[#1C1917]" : "border-[#E7E5E4] bg-[#FAFAF9] hover:border-[#D6D3D1] dark:border-[#292524] dark:bg-[#141210] dark:hover:border-[#44403C]"}`}>
        <input {...props} id={`${id}-${value}`} data-form-field={index === 0 ? field.name : undefined} type="radio" name={id} value={value} checked={values[field.name] === value} onChange={() => edit(field.name, value)} className="mt-1 h-4 w-4 shrink-0 accent-[#78716C]" />
        <span className="text-sm font-medium leading-relaxed text-[#1C1917] dark:text-[#FAFAF9]">{label}{field.name === "documentType" && <span className="mt-1 block text-xs font-normal text-[#78716C] dark:text-[#A8A29E]">{documentTypes.find(([code]) => code === value)?.[2]}</span>}</span>
      </label>)}</div>
      <p id={`${id}-hint`} className="mt-2 text-xs text-[#78716C] dark:text-[#A8A29E]">{field.hint || "Chọn một phương án phù hợp với yêu cầu của bạn."}</p>
      <button type="button" onClick={() => assistant.helpField(task, field.name, field.label, field.hint)} className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#FAFAF9]"><MessageCircle className="h-4 w-4" />Giải thích lựa chọn</button>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-[#B91C1C] dark:text-[#EF4444]">{error}</p>}
    </fieldset>;
    const wide = field.type === "textarea" || field.type === "file" || field.type === "checkbox" || ["documentType", "contactOutcome", "contactDates", "scope", "delivery", "recipient", "address"].includes(field.name);
    return <div key={field.name} className={`${wide ? "sm:col-span-2" : ""} ${field.type === "checkbox" ? "rounded-none border border-[#E7E5E4] p-3 dark:border-[#292524] bg-[#FAFAF9] dark:bg-[#141210]" : ""}`}>
      {field.type === "checkbox" ? <label className="flex min-h-11 items-start gap-3" htmlFor={id}><input {...props} type="checkbox" checked={values[field.name] === "yes"} onChange={(event) => edit(field.name, event.target.checked ? "yes" : "")} className="mt-1 h-5 w-5 shrink-0 accent-[#78716C]" /><span className="text-sm font-medium leading-relaxed text-[#1C1917] dark:text-[#FAFAF9]">{field.label}{field.required && " *"}</span></label>
        : <><div className="mb-2 flex items-center justify-between gap-2"><label htmlFor={id} className="block text-sm font-medium text-[#1C1917] dark:text-[#FAFAF9]">{field.label}{!field.required && " (không bắt buộc)"}</label><button type="button" onClick={() => assistant.helpField(task, field.name, field.label, field.hint)} aria-label={`Giải thích trường ${field.label}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-none px-2 text-xs font-medium text-[#78716C] hover:bg-[#E7E5E4] dark:text-[#A8A29E] dark:hover:bg-[#292524]"><MessageCircle className="h-4 w-4" />Giải thích</button></div>
          {field.type === "select" ? <select {...props} value={values[field.name] || ""} onChange={(event) => edit(field.name, event.target.value)} className={fieldClass}>{field.options?.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            : field.type === "textarea" ? <textarea {...props} value={values[field.name] || ""} onChange={(event) => edit(field.name, event.target.value)} maxLength={4000} rows={3} className={fieldClass} />
              : field.type === "file" ? <><input {...props} type="file" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={(event) => attachment(field, Array.from(event.target.files || []))} className={`${fieldClass} text-sm file:mr-3 file:rounded-none file:border-0 file:bg-[#E7E5E4] dark:file:bg-[#292524] file:px-3 file:py-2 file:text-[#1C1917] dark:file:text-[#FAFAF9]`} />
                {values[field.name] && <p className="mt-2 whitespace-pre-wrap break-all text-xs text-[#78716C] dark:text-[#A8A29E]">{files[field.name]?.length ? "Đã chọn trong phiên này:" : "Tệp trong bản nháp — cần chọn lại:"}{"\n"}{values[field.name]}</p>}</>
                : <input {...props} type={field.type || "text"} value={values[field.name] || ""} onChange={(event) => edit(field.name, event.target.value)} min={field.type === "number" ? 1 : undefined} max={field.type === "number" ? 99 : undefined} maxLength={field.type === "number" || field.type === "date" ? undefined : 4000} className={fieldClass} />}
        </>}
      <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-[#78716C] dark:text-[#A8A29E]">{field.hint}</p>
      {field.type === "checkbox" && <button type="button" onClick={() => assistant.helpField(task, field.name, field.label, field.hint)} aria-label={`Hỏi trợ lý về ${field.label}`} className="inline-flex min-h-11 items-center text-xs font-medium text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#FAFAF9]">Hỏi về mục này</button>}
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-[#B91C1C] dark:text-[#EF4444]">{error}</p>}
    </div>;
  }

  if (submission) return <div><SubmissionSuccess embedded={embedded} localOnly={dataConfig?.mode === "mock"} title={dataConfig?.mode === "mock" ? "Đã lưu hồ sơ" : isDocument ? "Đã nộp yêu cầu tài liệu" : "Đã nộp khiếu nại điểm"} ticketId={submission.ticketId} ticketCode={submission.ticketCode}>
    Bạn đã nhận mã hồ sơ. Mở Hồ sơ của tôi để xem thông tin đã khai, trạng thái và phản hồi.
  </SubmissionSuccess><button type="button" onClick={startNew} className={`${secondaryButton} mt-4 border border-slate-300 dark:border-slate-600`}>Tạo yêu cầu mới</button></div>;

  return <div ref={container} className="mx-auto max-w-[800px]">
    {!embedded && <Link href="/student" className={`${secondaryButton} -ml-3 mb-3`}><ArrowLeft className="h-4 w-4" />Dịch vụ sinh viên</Link>}
    {embedded ? <h2 ref={heading} tabIndex={-1} className="sr-only">{stepTitle}</h2> : <h1 ref={heading} tabIndex={-1} className="font-serif text-2xl font-normal tracking-tight text-[#1C1917] dark:text-[#FAFAF9]">{review ? "Kiểm tra hồ sơ trước khi nộp" : isDocument ? "Yêu cầu tài liệu VinUni" : "Khiếu nại điểm học phần"}</h1>}
    <ol aria-label="Các bước nộp hồ sơ" className={`${embedded ? "mb-3" : "my-3"} grid max-w-md grid-cols-3 gap-2 text-xs`}>{steps.map((label, index) => {
      const current = review ? 2 : draft.stage;
      return <li key={label} aria-current={current === index ? "step" : undefined} className={`flex min-w-0 items-center gap-1.5 border-b-2 pb-2 ${current === index ? "border-[#78716C] font-medium text-[#1C1917] dark:border-[#A8A29E] dark:text-[#FAFAF9]" : index < current ? "border-[#D6D3D1] text-[#57534E] dark:border-[#44403C] dark:text-[#D6D3D1]" : "border-[#E7E5E4] text-[#78716C] dark:border-[#292524] dark:text-[#A8A29E]"}`}><span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-[11px] ${current === index ? "bg-[#78716C] text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]" : "bg-[#E7E5E4] text-[#57534E] dark:bg-[#292524] dark:text-[#A8A29E]"}`}>{index < current ? <Check className="h-3 w-3" /> : index + 1}</span><span className="truncate">{label}</span></li>;
    })}</ol>
    {state.issue && <p role="alert" className="mb-4 text-sm text-[#B45309] dark:text-[#FBBF24]">{state.issue}</p>}
    {review ? <div className={surfaceClass}>
      <div className="flex items-center gap-2 text-base font-semibold text-[#1C1917] dark:text-[#FAFAF9]"><FileText className="h-5 w-5 text-[#78716C] dark:text-[#A8A29E]" />{isDocument ? documentTypes.find(([id]) => id === values.documentType)?.[1] : "Grade Appeal"}</div>
      <dl className="mt-3"><SummaryRow label="Sinh viên" editable={false}>{currentUser?.name} · {currentUser?.mssv || currentUser?.id}</SummaryRow>
        {(currentUser?.classYear || currentUser?.major) && (
          <SummaryRow label="Khóa học / ngành" editable={false}>
            {[currentUser?.classYear, currentUser?.major].filter(Boolean).join(" · ")}
          </SummaryRow>
        )}
        {[0, 1].map((stage) => <div key={stage}>{visibleFields(task, stage, values).map((field) => <SummaryRow key={field.name} label={field.label} onEdit={() => { goEdit(stage); assistant.focusField(field.name); }}>{field.type === "checkbox" ? values[field.name] === "yes" ? "Đã chọn" : "Không chọn" : field.options?.find(([id]) => id === values[field.name])?.[1] || values[field.name] || "Không cung cấp"}</SummaryRow>)}</div>)}
      </dl>
      {!valid && <div role="alert" className="mt-4 rounded-none bg-[#F5F5F4] p-4 text-sm text-[#B45309] dark:bg-[#1C1917] dark:text-[#FBBF24] border border-[#B45309]/30 dark:border-[#B45309]/50"><p className="font-semibold">Hồ sơ chưa đủ thông tin</p><ul className="mt-2 list-disc space-y-1 pl-5">{Object.entries(allErrors).map(([name, text]) => <li key={name}>{text}</li>)}</ul></div>}
      {valid && !checked && <p role="status" className="mt-4 text-sm text-[#B45309] dark:text-[#FBBF24]">Bản nháp đã thay đổi. Kiểm tra lại trước khi nộp hồ sơ.</p>}
      <div className="mt-5 rounded-none bg-[#F5F5F4] p-4 text-sm leading-relaxed dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524]"><p className="font-medium text-[#1C1917] dark:text-[#FAFAF9]">{isDocument ? `Phí tham khảo: ${(Number(values.copies || 1) * 50000).toLocaleString("vi-VN")}đ (${values.copies || 1} bản)` : "Phí Exam Score Review tham khảo: 1.000.000đ/yêu cầu/học phần"}</p>
        <p className="mt-2 text-[#57534E] dark:text-[#D6D3D1]">{isDocument ? "Thời gian tham khảo 2–3 ngày làm việc; cao điểm tới 5 ngày. Cán bộ xác nhận phí, điều kiện và thời gian thực tế. Chuyển phát quốc tế có phí riêng." : "Theo quy trình VinUni: nộp trong 5 ngày làm việc sau khi điểm chính thức đăng trên Canvas. Campus 24/7 ghi nhận hồ sơ và danh sách tệp minh chứng để cán bộ phụ trách xem xét."}</p>
        {!isDocument && <p className="mt-2 font-medium text-[#1C1917] dark:text-[#FAFAF9]">AQA: qualityassurance@vinuni.edu.vn</p>}
      </div>
      {submitError && <p role="alert" className="mt-4 text-sm text-[#B91C1C] dark:text-[#EF4444]">{submitError}</p>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" disabled={submitting} onClick={() => goEdit(0)} className={secondaryButton}>Sửa thông tin</button>
        {!valid ? <button type="button" onClick={() => { const first = Object.keys(allErrors)[0]; goEdit(visibleFields(task, 0, values).some((f) => f.name === first) ? 0 : 1); }} className={primaryButton}>Bổ sung thông tin</button>
          : !checked ? <button type="button" onClick={() => store.check(task)} className={primaryButton}>Xác nhận thông tin mới</button> : <button type="button" onClick={() => void submit()} disabled={submitting} className={primaryButton}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />{localOnly ? "Đang lưu…" : "Đang gửi…"}</> : localOnly ? "Lưu hồ sơ thử nghiệm" : isDocument ? "Gửi yêu cầu đến Registrar" : "Gửi khiếu nại điểm"}</button>}
      </div>
      {!isDocument && <a href={VINUNI_SOURCES.appealForm} target="_blank" rel="noopener noreferrer" className={`${secondaryButton} mt-4 border border-[#E7E5E4] dark:border-[#292524]`}>{<ExternalLink className="h-4 w-4" />}Xem Grade Appeal Form tham chiếu</a>}
    </div> : <form noValidate onSubmit={advance} className={surfaceClass}>
      <div className="mb-4 flex items-center gap-3 border-b border-[#E7E5E4] pb-4 dark:border-[#292524]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-[#3F6212] bg-[#F5F5F4] text-[#3F6212] dark:border-[#84CC16] dark:bg-[#1C1917] dark:text-[#84CC16]"><Check className="h-4 w-4" /></span><div><p className="text-sm font-medium text-[#1C1917] dark:text-[#FAFAF9]">{currentUser?.name} · {currentUser?.mssv || currentUser?.id}</p>{(currentUser?.classYear || currentUser?.major) && <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">{[currentUser?.classYear, currentUser?.major].filter(Boolean).join(" · ")}</p>}<p className="text-xs text-[#78716C] dark:text-[#A8A29E]">Thông tin lấy từ tài khoản của bạn</p></div></div>
      {!isDocument && draft.stage === 0 && <p className="mb-5 text-sm leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">Chỉ áp dụng điểm tổng kết học phần. Trao đổi với giảng viên qua email trước khi lập khiếu nại chính thức.</p>}
      {isDocument && values.documentType === "GRD" && draft.stage === 0 && <p className="mb-5 text-sm text-[#B45309] dark:text-[#FBBF24]">Xác nhận tốt nghiệp chỉ được cấp sau khi Registrar xác nhận đủ điều kiện. Nếu chưa đủ, liên hệ về xác nhận tốt nghiệp dự kiến.</p>}
      <p className="mb-4 text-xs text-[#78716C] dark:text-[#A8A29E]">Điền các mục bên dưới; mục tùy chọn có nhãn “không bắt buộc”.</p>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">{visibleFields(task, draft.stage, values).sort((a, b) => Number(b.name === "documentType") - Number(a.name === "documentType")).map(renderField)}</div>
      <div className="sticky -bottom-4 z-10 -mx-5 -mb-5 mt-6 flex flex-col-reverse gap-3 rounded-none border-t border-[#E7E5E4] bg-[#FAFAF9] p-4 sm:-bottom-6 sm:-mx-8 sm:-mb-8 sm:flex-row sm:items-center sm:justify-between dark:border-[#292524] dark:bg-[#141210]">{draft.stage === 1 ? <button type="button" onClick={() => { store.stage(task, 0); setErrors({}); }} className={secondaryButton}>Quay lại</button> : <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">Chưa gửi hồ sơ · bạn có thể sửa lại</p>}<button type="submit" className={primaryButton}>{draft.stage === 0 ? isDocument ? "Tiếp tục · Cách nhận" : "Tiếp tục · Minh chứng" : "Kiểm tra hồ sơ"}<ArrowRight className="h-4 w-4" /></button></div>
    </form>}
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#78716C] dark:text-[#A8A29E]"><a href={isDocument ? VINUNI_SOURCES.documents : VINUNI_SOURCES.appeal} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">Nguồn hướng dẫn VinUni<ExternalLink className="h-3 w-3" /></a><a href={VINUNI_SOURCES.fees} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">Biểu phí chính thức<ExternalLink className="h-3 w-3" /></a></div>
    <button type="button" disabled={submitting} onClick={startNew} className="inline-flex min-h-11 items-center text-xs font-medium text-[#78716C] hover:text-[#1C1917] disabled:opacity-40 dark:text-[#A8A29E] dark:hover:text-[#FAFAF9] underline-offset-4 hover:underline">Tạo bản nháp khác · giữ bản hiện tại trong lịch sử</button>
  </div>;
}
