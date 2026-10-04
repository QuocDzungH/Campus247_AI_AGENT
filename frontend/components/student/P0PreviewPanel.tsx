"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Send, ShieldAlert } from "lucide-react";
import { useAssistant } from "@/lib/assistant-context";
import { useStore } from "@/lib/store";
import { DataGatewayError } from "@/lib/data/errors";
import {
  errorDetails,
  fieldsFromForm,
  type CampusPreview,
  type ComplaintSubtype,
  type IntakeServiceType,
} from "@/lib/data/api/mappers";
import { alreadySubmittedTicketId, isDisplayTicketCode } from "@/lib/data/api/g2-flow";
import { fieldLabel } from "@/lib/field-labels";
import { primaryButton, secondaryButton } from "./StudentFlowUI";

type FormState = {
  purpose: string;
  destinationOrg: string;
  receiveMethod: "digital_pdf" | "paper_stamped" | "";
  complaintSubtype: ComplaintSubtype | "";
  course: string;
  courseCode: string;
  assessment: string;
  description: string;
  requestedOutcome: string;
  evidence: string;
};

function formFromPreview(preview: CampusPreview): FormState {
  return {
    purpose: preview.fields.purpose ?? "",
    destinationOrg: preview.fields.destinationOrg ?? "",
    receiveMethod: preview.fields.receiveMethod ?? "",
    complaintSubtype: preview.fields.complaintSubtype ?? "",
    course: preview.fields.course ?? "",
    courseCode: preview.fields.courseCode ?? "",
    assessment: preview.fields.assessment ?? "",
    description: preview.fields.description ?? "",
    requestedOutcome: preview.fields.requestedOutcome ?? "",
    evidence: preview.fields.evidence ?? "",
  };
}

function emptyForm(): FormState {
  return {
    purpose: "",
    destinationOrg: "",
    receiveMethod: "",
    complaintSubtype: "",
    course: "",
    courseCode: "",
    assessment: "",
    description: "",
    requestedOutcome: "",
    evidence: "",
  };
}

function serviceLabel(serviceType: IntakeServiceType, subtype?: ComplaintSubtype | "" | null) {
  if (serviceType === "student_certificate") return "Xin giấy xác nhận sinh viên";
  if (subtype === "grade_appeal") return "Khiếu nại · Điểm học phần";
  return "Khiếu nại";
}

function StudentIdentityCard({ declared }: { declared: boolean }) {
  const { currentUser } = useStore();
  if (!currentUser) return null;
  const rows = [
    ["Họ và tên SV", currentUser.name],
    ["Mã số sinh viên (MSSV)", currentUser.mssv || "—"],
    ["Khóa học / Lớp sinh hoạt", currentUser.classYear || "—"],
    ["Khoa quản lý chuyên môn", currentUser.major || currentUser.department || "—"],
  ] as const;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
        <p className="text-sm font-semibold">Thông tin sinh viên đã xác minh từ hồ sơ</p>
        <span className="text-[10px] font-mono text-slate-500">Từ hồ sơ tài khoản</span>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
      {declared && (
        <p className="mt-3 text-xs text-slate-500">
          Phần bên dưới là dữ liệu bạn kê khai, chưa được hệ thống xác minh.
        </p>
      )}
    </div>
  );
}

function mergeDirtyForm(previous: CampusPreview, incoming: CampusPreview, local: FormState): FormState {
  const oldForm = formFromPreview(previous);
  const next = formFromPreview(incoming);
  (Object.keys(local) as Array<keyof FormState>).forEach((key) => {
    if (local[key] !== oldForm[key]) {
      (next as FormState)[key] = local[key] as never;
    }
  });
  return next;
}

export function P0PreviewPanel() {
  const assistant = useAssistant();
  const { patchPreview, submitPreview } = useStore();
  const preview = assistant.apiPreview;
  const locked = assistant.apiLocked;
  const ticket = assistant.apiTicket;
  const displayCode = ticket && isDisplayTicketCode(ticket.code, ticket.id) ? ticket.code : null;
  const pendingTicketId = assistant.apiPendingTicketId;
  const [edit, setEdit] = useState<{ previewId: string; form: FormState } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmForId, setConfirmForId] = useState<string | null>(null);
  const previousPreview = useRef<CampusPreview | null>(preview);
  const form = preview && edit?.previewId === preview.id ? edit.form : preview ? formFromPreview(preview) : emptyForm();
  const confirming = Boolean(preview && confirmForId === preview.id);

  useEffect(() => {
    const previous = previousPreview.current;
    previousPreview.current = preview;
    if (!preview) {
      return;
    }
    if (edit && previous && previous.id === preview.id && edit.previewId === previous.id) {
      setEdit({ previewId: preview.id, form: mergeDirtyForm(previous, preview, edit.form) });
      return;
    }
    if (!edit || edit.previewId !== preview.id) {
      setEdit({ previewId: preview.id, form: formFromPreview(preview) });
    }
  }, [preview?.id, preview?.version]);

  function changeForm(patch: Partial<FormState>) {
    if (!preview) return;
    setEdit({ previewId: preview.id, form: { ...form, ...patch } });
    setConfirmForId(null);
  }

  if (locked) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950">
        <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
          <Lock className="h-4 w-4" />
          Đã gửi cán bộ xử lý
        </div>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          Đơn đã vào hàng chờ cán bộ. Bạn vẫn có thể gửi thông tin bổ sung trong chat; trợ lý không tự kết luận hay hứa sửa điểm.
        </p>
        {displayCode ? (
          <p className="mt-3 font-mono text-sm">Mã hồ sơ: {displayCode}</p>
        ) : pendingTicketId ? (
          <p className="mt-3 text-sm">Đã nộp yêu cầu. Đang đồng bộ mã hồ sơ.</p>
        ) : null}
        <Link href="/my-requests" className={`${primaryButton} mt-4`}>
          Mở Yêu cầu của tôi
        </Link>
      </section>
    );
  }

  if ((displayCode || pendingTicketId) && !preview) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950">
        <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">Đã nộp yêu cầu</h2>
        {displayCode ? (
          <p className="mt-2 font-mono text-sm">{displayCode}</p>
        ) : (
          <p className="mt-2 text-sm">Đang đồng bộ mã hồ sơ.</p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">
          Ticket đã vào hệ thống. Bước này không phát hành giấy xác nhận. Theo dõi phản hồi của cán bộ trong Yêu cầu của tôi.
        </p>
        <Link href="/my-requests" className={`${primaryButton} mt-4`}>
          Mở Yêu cầu của tôi
        </Link>
      </section>
    );
  }

  if (!preview) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="font-semibold">Biểu mẫu trong hội thoại</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Nói với trợ lý khi bạn muốn khiếu nại hoặc xin giấy xác nhận. Form sẽ mở ngay trong cuộc trò chuyện này.
        </p>
      </section>
    );
  }

  const isComplaint = preview.serviceType === "academic_complaint";
  const isGrade = form.complaintSubtype === "grade_appeal";

  async function persistIfDirty(current: CampusPreview): Promise<CampusPreview> {
    const patch = fieldsFromForm(form);
    const same =
      patch.purpose === current.fields.purpose &&
      patch.destination_org === current.fields.destinationOrg &&
      patch.receive_method === current.fields.receiveMethod &&
      patch.complaint_subtype === current.fields.complaintSubtype &&
      patch.course === current.fields.course &&
      patch.course_code === current.fields.courseCode &&
      patch.assessment === current.fields.assessment &&
      patch.description === current.fields.description &&
      patch.requested_outcome === current.fields.requestedOutcome &&
      patch.evidence === current.fields.evidence;
    if (same) return current;
    return patchPreview(current.id, current.version, patch);
  }

  async function savePreview() {
    if (!preview || busy) return;
    const threadId = assistant.active.id;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await persistIfDirty(preview);
      assistant.setApiPreview(next, threadId);
      setEdit({ previewId: next.id, form: formFromPreview(next) });
      setNotice("Đã cập nhật bản nháp. Hãy kiểm tra rồi nộp khi đủ thông tin.");
    } catch (failure) {
      handleConflict(failure, threadId);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!preview || busy) return;
    const threadId = assistant.active.id;
    setBusy(true); setError(""); setNotice("");
    try {
      const latest = await persistIfDirty(preview);
      assistant.setApiPreview(latest, threadId);
      if (!latest.canSubmit) {
        setError(isComplaint ? "Chưa đủ nội dung khiếu nại để gửi." : "Preview chưa đủ mục đích, nơi nhận và cách nhận.");
        setConfirmForId(null);
        return;
      }
      if (!confirming) {
        setConfirmForId(preview.id);
        setNotice("Hãy kiểm tra loại đơn và nội dung bên dưới, rồi xác nhận gửi.");
        return;
      }
      const ticketResult = await submitPreview(latest.id, latest.version);
      assistant.setApiPreview(null, threadId);
      if (isComplaint) assistant.setApiLocked(true, threadId);
      if (
        ticketResult.status === "submitted" &&
        isDisplayTicketCode(ticketResult.ticket.code, ticketResult.ticket.id)
      ) {
        assistant.setApiTicket({ id: ticketResult.ticket.id, code: ticketResult.ticket.code }, threadId);
        setNotice(`Đã nộp yêu cầu ${ticketResult.ticket.code}.`);
      } else {
        const pendingId = ticketResult.status === "submitted" ? ticketResult.ticket.id : ticketResult.ticketId;
        assistant.setApiPendingTicket(pendingId, threadId);
        setNotice("Đã nộp yêu cầu. Đang đồng bộ mã hồ sơ.");
      }
      setEdit(null);
      setConfirmForId(null);
    } catch (failure) {
      handleConflict(failure, threadId);
    } finally {
      setBusy(false);
    }
  }

  function handleConflict(failure: unknown, threadId: string) {
    const err = failure instanceof DataGatewayError ? failure : null;
    const details = err ? errorDetails(err) : undefined;
    if (err?.code === "STALE_PREVIEW" && preview && typeof details?.current_version === "number") {
      assistant.setApiPreview({ ...preview, version: details.current_version }, threadId);
      setError("Bản nháp đã thay đổi trên máy chủ. Nội dung bạn đang sửa được giữ; hãy kiểm tra rồi cập nhật lại.");
      return;
    }
    if (err?.code === "PREVIEW_ALREADY_SUBMITTED") {
      const pendingId = alreadySubmittedTicketId(err);
      assistant.setApiPreview(null, threadId);
      if (pendingId) assistant.setApiPendingTicket(pendingId, threadId);
      setNotice("Đã nộp yêu cầu. Đang đồng bộ mã hồ sơ.");
      return;
    }
    if (err?.code === "CONVERSATION_LOCKED") {
      setError("Cuộc trò chuyện đã chuyển cán bộ. Không thể nộp trên luồng này.");
      return;
    }
    setError(err?.message || "Chưa lưu được bản nháp. Nội dung đang sửa được giữ.");
  }

  function switchType(next: IntakeServiceType) {
    if (!preview || next === preview.serviceType) return;
    const starter = next === "student_certificate"
      ? "Tôi muốn đổi sang xin giấy xác nhận sinh viên."
      : "Tôi muốn đổi sang gửi khiếu nại.";
    void assistant.send(starter);
  }

  const missingLabels = preview.missingFields.map((field) => fieldLabel(field)).join(", ");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Kiểm tra thông tin trước khi nộp</h2>
          <p className="mt-1 text-xs text-slate-500">
            {serviceLabel(preview.serviceType, form.complaintSubtype)} · phiên bản {preview.version}
          </p>
        </div>
        {preview.canSubmit ? (
          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Đủ dữ liệu</span>
        ) : (
          <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Còn thiếu</span>
        )}
      </div>
      <label className="mt-4 block text-sm">
        Loại đơn
        <select
          className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"
          value={preview.serviceType}
          onChange={(event) => switchType(event.target.value as IntakeServiceType)}
          aria-label="Sửa loại đơn"
        >
          <option value="academic_complaint">Khiếu nại</option>
          <option value="student_certificate">Xin giấy xác nhận sinh viên</option>
        </select>
      </label>
      <div className="mt-4 space-y-4">
        <StudentIdentityCard declared />
        {isComplaint ? (
          <>
            <fieldset>
              <legend className="text-sm">Nội dung khiếu nại</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  ["grade_appeal", "Điểm học phần"],
                  ["other", "Nội dung khác"],
                ] as const).map(([value, label]) => (
                  <label key={value} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm ${form.complaintSubtype === value ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-slate-300 dark:border-slate-600"}`}>
                    <input
                      type="radio"
                      name="complaint-subtype"
                      checked={form.complaintSubtype === value}
                      onChange={() => changeForm({ complaintSubtype: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {(isGrade || !form.complaintSubtype) && (
              <>
                <label className="block text-sm" htmlFor="intake-course">
                  Môn học / học phần
                  <input
                    id="intake-course"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"
                    value={form.course}
                    onChange={(event) => changeForm({ course: event.target.value })}
                    maxLength={200}
                    placeholder="Ví dụ: Cơ sở dữ liệu"
                  />
                </label>
                <label className="block text-sm">
                  Mã học phần <span className="font-normal text-slate-500">(không bắt buộc)</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"
                    value={form.courseCode}
                    onChange={(event) => changeForm({ courseCode: event.target.value })}
                    maxLength={40}
                  />
                </label>
                <label className="block text-sm">
                  Loại điểm đang khiếu nại <span className="font-normal text-slate-500">(không bắt buộc)</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"
                    value={form.assessment}
                    onChange={(event) => changeForm({ assessment: event.target.value })}
                  >
                    <option value="">Chưa nêu</option>
                    <option>Điểm thi cuối kỳ</option>
                    <option>Điểm giữa kỳ</option>
                    <option>Điểm tổng kết học phần</option>
                    <option>Loại điểm khác</option>
                  </select>
                </label>
              </>
            )}
            <label className="block text-sm" htmlFor="intake-description">
              Nội dung khiếu nại
              <textarea
                id="intake-description"
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"
                value={form.description}
                onChange={(event) => changeForm({ description: event.target.value })}
                maxLength={4000}
                placeholder="Mô tả vấn đề cần cán bộ kiểm tra. Không tự điền điểm nếu bạn chưa nêu."
              />
            </label>
            <label className="block text-sm">
              Kết quả mong muốn <span className="font-normal text-slate-500">(không bắt buộc)</span>
              <textarea
                className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"
                value={form.requestedOutcome}
                onChange={(event) => changeForm({ requestedOutcome: event.target.value })}
                maxLength={2000}
              />
            </label>
            <label className="block text-sm">
              Minh chứng (kê khai) <span className="font-normal text-slate-500">(không bắt buộc)</span>
              <textarea
                className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"
                value={form.evidence}
                onChange={(event) => changeForm({ evidence: event.target.value })}
                maxLength={2000}
                placeholder="Nêu bài thi, biên bản hoặc trao đổi nếu có. Không bắt buộc tệp cho mọi khiếu nại."
              />
            </label>
          </>
        ) : (
          <>
            <label className="block text-sm" htmlFor="intake-purpose">
              Mục đích
              <textarea
                id="intake-purpose"
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"
                value={form.purpose}
                onChange={(event) => changeForm({ purpose: event.target.value })}
                maxLength={1000}
              />
            </label>
            <label className="block text-sm">
              Nơi nhận
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"
                value={form.destinationOrg}
                onChange={(event) => changeForm({ destinationOrg: event.target.value })}
                maxLength={300}
              />
            </label>
            <fieldset>
              <legend className="text-sm">Cách nhận</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  ["digital_pdf", "Bản điện tử (PDF)"],
                  ["paper_stamped", "Bản giấy đóng dấu"],
                ] as const).map(([value, label]) => (
                  <label key={value} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm ${form.receiveMethod === value ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-slate-300 dark:border-slate-600"}`}>
                    <input
                      type="radio"
                      name="p0-receive"
                      checked={form.receiveMethod === value}
                      onChange={() => changeForm({ receiveMethod: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </div>
      {preview.missingFields.length > 0 && (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">Còn thiếu: {missingLabels}</p>
      )}
      {confirming && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/40">
          <p className="font-semibold">Xác nhận gửi đơn</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div><dt className="text-xs text-slate-500">Loại đơn</dt><dd>{serviceLabel(preview.serviceType, form.complaintSubtype)}</dd></div>
            <div><dt className="text-xs text-slate-500">Bộ phận tiếp nhận</dt><dd>Phòng Đào tạo / học vụ</dd></div>
            {isComplaint ? (
              <>
                {form.course && <div><dt className="text-xs text-slate-500">Môn học</dt><dd>{form.course}{form.courseCode ? ` (${form.courseCode})` : ""}</dd></div>}
                {form.description && <div><dt className="text-xs text-slate-500">Nội dung</dt><dd className="whitespace-pre-wrap">{form.description}</dd></div>}
                <div><dt className="text-xs text-slate-500">Tệp / minh chứng</dt><dd>{form.evidence.trim() || "Không đính kèm tệp. Minh chứng kê khai nếu có được gửi cùng đơn."}</dd></div>
              </>
            ) : (
              <>
                <div><dt className="text-xs text-slate-500">Mục đích</dt><dd>{form.purpose}</dd></div>
                <div><dt className="text-xs text-slate-500">Nơi nhận</dt><dd>{form.destinationOrg}</dd></div>
                <div><dt className="text-xs text-slate-500">Cách nhận</dt><dd>{form.receiveMethod === "paper_stamped" ? "Bản giấy đóng dấu" : "Bản điện tử PDF"}</dd></div>
                <div><dt className="text-xs text-slate-500">Tệp</dt><dd>Không có tệp đính kèm ở bước này.</dd></div>
              </>
            )}
          </dl>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={secondaryButton} disabled={busy} onClick={() => void savePreview()}>
          Cập nhật preview
        </button>
        <button type="button" className={primaryButton} disabled={busy} onClick={() => void submit()}>
          <Send className="h-4 w-4" />
          {busy ? "Đang gửi…" : confirming ? "Xác nhận gửi" : "Nộp yêu cầu (Submit 1)"}
        </button>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        Chỉ tạo ticket sau khi bạn xác nhận gửi. Trợ lý không gửi hộ và không tự kết luận vụ việc.
      </p>
    </section>
  );
}
