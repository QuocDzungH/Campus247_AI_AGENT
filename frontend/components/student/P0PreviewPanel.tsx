"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Send, ShieldAlert } from "lucide-react";
import { useAssistant } from "@/lib/assistant-context";
import { useStore } from "@/lib/store";
import { DataGatewayError } from "@/lib/data/errors";
import { errorDetails, fieldsFromForm, type CampusPreview } from "@/lib/data/api/mappers";
import { primaryButton, secondaryButton } from "./StudentFlowUI";

function formFromPreview(preview: CampusPreview) {
  return {
    purpose: preview.fields.purpose ?? "",
    destinationOrg: preview.fields.destinationOrg ?? "",
    receiveMethod: preview.fields.receiveMethod ?? ("" as const),
  };
}

export function P0PreviewPanel() {
  const assistant = useAssistant();
  const { patchPreview, submitPreview } = useStore();
  const preview = assistant.apiPreview;
  const locked = assistant.apiLocked;
  const ticket = assistant.apiTicket;
  const [edit, setEdit] = useState<{ previewId: string; form: ReturnType<typeof formFromPreview> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const form =
    preview && edit?.previewId === preview.id ? edit.form : preview ? formFromPreview(preview) : { purpose: "", destinationOrg: "", receiveMethod: "" as const };

  function changeForm(patch: Partial<typeof form>) {
    if (!preview) return;
    setEdit({ previewId: preview.id, form: { ...form, ...patch } });
  }

  if (locked) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950">
        <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
          <Lock className="h-4 w-4" />
          Trợ lý AI đã khóa trên luồng này
        </div>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          Yêu cầu đã được bàn giao cho cán bộ. Bạn vẫn có thể gửi thông tin bổ sung trong chat; phản hồi sẽ đến từ cán bộ.
        </p>
        {ticket && (
          <p className="mt-3 font-mono text-sm">
            Mã hồ sơ: {ticket.code}
          </p>
        )}
        <Link href="/my-requests" className={`${primaryButton} mt-4`}>
          Mở Yêu cầu của tôi
        </Link>
      </section>
    );
  }

  if (ticket && !preview) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950">
        <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">Đã nộp yêu cầu</h2>
        <p className="mt-2 font-mono text-sm">{ticket.code}</p>
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
        <h2 className="font-semibold">Preview giấy xác nhận (P0)</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Chat với trợ lý để thu thập 3 trường: mục đích, nơi nhận và cách nhận. Transcript và biểu mẫu VinUni đầy đủ chưa được nối ở giai đoạn này.
        </p>
      </section>
    );
  }

  async function persistIfDirty(current: CampusPreview): Promise<CampusPreview> {
    const patch = fieldsFromForm({
      purpose: form.purpose,
      destinationOrg: form.destinationOrg,
      receiveMethod: form.receiveMethod === "digital_pdf" || form.receiveMethod === "paper_stamped" ? form.receiveMethod : "",
    });
    const same =
      patch.purpose === current.fields.purpose &&
      patch.destination_org === current.fields.destinationOrg &&
      patch.receive_method === current.fields.receiveMethod;
    if (same) return current;
    return patchPreview(current.id, current.version, patch);
  }

  async function savePreview() {
    if (!preview || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await persistIfDirty(preview);
      assistant.setApiPreview(next);
      setEdit({ previewId: next.id, form: formFromPreview(next) });
      setNotice("Đã cập nhật preview. Hãy kiểm tra rồi nộp khi đủ 3 trường.");
    } catch (failure) {
      handleConflict(failure);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!preview || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const latest = await persistIfDirty(preview);
      assistant.setApiPreview(latest);
      if (!latest.canSubmit) {
        setError("Preview chưa đủ mục đích, nơi nhận và cách nhận.");
        return;
      }
      const ticketResult = await submitPreview(latest.id, latest.version);
      assistant.setApiPreview(null);
      assistant.setApiTicket({ id: ticketResult.id, code: ticketResult.code });
      setEdit(null);
      setNotice(`Đã nộp yêu cầu ${ticketResult.code}. Đây chưa phải giấy đã phát hành.`);
    } catch (failure) {
      handleConflict(failure);
    } finally {
      setBusy(false);
    }
  }

  function handleConflict(failure: unknown) {
    const err = failure instanceof DataGatewayError ? failure : null;
    const details = err ? errorDetails(err) : undefined;
    if (err?.code === "STALE_PREVIEW" && preview && typeof details?.current_version === "number") {
      assistant.setApiPreview({ ...preview, version: details.current_version });
      setError("Preview đã thay đổi trên máy chủ. Nội dung bạn đang sửa được giữ; hãy kiểm tra rồi cập nhật lại.");
      return;
    }
    if (err?.code === "PREVIEW_ALREADY_SUBMITTED") {
      setError("Yêu cầu này đã được nộp.");
      return;
    }
    if (err?.code === "CONVERSATION_LOCKED") {
      setError("Cuộc trò chuyện đã chuyển cán bộ. Không thể nộp Submit 1 trên luồng này.");
      return;
    }
    setError(err?.message || "Chưa lưu được preview. Nội dung đang sửa được giữ.");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Kiểm tra thông tin trước khi nộp</h2>
          <p className="mt-1 text-xs text-slate-500">P0 · giấy xác nhận sinh viên · 3 trường · phiên bản {preview.version}</p>
        </div>
        {preview.canSubmit ? (
          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Đủ dữ liệu</span>
        ) : (
          <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Còn thiếu</span>
        )}
      </div>
      <div className="mt-4 space-y-4">
        <label className="block text-sm">
          Mục đích
          <textarea
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
      </div>
      {preview.missingFields.length > 0 && (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">Còn thiếu: {preview.missingFields.join(", ")}</p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={secondaryButton} disabled={busy} onClick={() => void savePreview()}>
          Cập nhật preview
        </button>
        <button type="button" className={primaryButton} disabled={busy} onClick={() => void submit()}>
          <Send className="h-4 w-4" />
          {busy ? "Đang gửi…" : "Nộp yêu cầu (Submit 1)"}
        </button>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        Nộp yêu cầu tạo ticket trong hệ thống. Bước này không phát hành giấy xác nhận.
      </p>
    </section>
  );
}
