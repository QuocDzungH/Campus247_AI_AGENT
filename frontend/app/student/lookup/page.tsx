"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Loader2, Search } from "lucide-react";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { fieldClass, primaryButton, secondaryButton, SubmissionSuccess, surfaceClass } from "@/components/student/StudentFlowUI";
import { lookupStudentGuidance, type AssistantReply } from "@/lib/student-assistant";
import { useStudentWorkspace } from "@/lib/student-workspace";
import { VINUNI_SOURCES } from "@/lib/vinuni-forms";
import { useStore } from "@/lib/store";

export default function LookupPage() {
  const { lookupQuery, setLookupQuery } = useStudentWorkspace();
  const { createTicket, dataConfig } = useStore();
  const [result, setResult] = useState<{ question: string; reply: AssistantReply } | null>(null);
  const [confirmQuestion, setConfirmQuestion] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [topic, setTopic] = useState("academic");
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<{ ticketId: string; ticketCode: string } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const submitLock = useRef(false);
  const resultRef = useRef<HTMLHeadingElement>(null);

  function search(question: string) {
    const value = question.trim();
    if (!value) return;
    setLookupQuery(value);
    setResult({ question: value, reply: lookupStudentGuidance(value) });
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  function handleSearch(event: FormEvent) { event.preventDefault(); search(lookupQuery); }

  async function submitQuestion() {
    if (!confirmQuestion?.trim() || submitLock.current) return;
    submitLock.current = true; setSubmitting(true); setSubmitError("");
    try {
      const ticket = await createTicket({ type: "lookup", title: `Câu hỏi ${topic === "academic" ? "học vụ" : "chính sách"} · ${confirmQuestion.slice(0, 80)}`,
        certificateType: "Câu hỏi học vụ", purpose: confirmQuestion.trim(), destinationOrg: topic === "academic" ? "Registrar / Student Affairs" : "Đơn vị phụ trách chính sách",
        notes: [`Câu hỏi: ${confirmQuestion.trim()}`, `Bối cảnh: ${context.trim() || "Không cung cấp"}`, `Chủ đề: ${topic}`].join("\n\n"),
        submissionKey: `lookup-${Date.now()}`, priority: "normal", priorityReason: "Sinh viên đã gửi câu hỏi cần cán bộ hỗ trợ trong Campus 24/7." });
      setSubmission({ ticketId: ticket.id, ticketCode: ticket.code }); setConfirmQuestion(null);
    } catch { setSubmitError("Chưa gửi được câu hỏi. Nội dung vẫn được giữ; hãy thử lại."); }
    finally { submitLock.current = false; setSubmitting(false); }
  }

  if (submission) return <SubmissionSuccess localOnly={dataConfig?.mode === "mock"} title={dataConfig?.mode === "mock" ? "Đã lưu câu hỏi" : "Đã gửi câu hỏi"} ticketId={submission.ticketId} ticketCode={submission.ticketCode}>Bạn có thể mở Hồ sơ của tôi để xem lại câu hỏi và theo dõi phản hồi.</SubmissionSuccess>;

  return <div className="mx-auto max-w-[800px]">
    <Link href="/student" className={`${secondaryButton} -ml-4 mb-5`}><ArrowLeft className="h-4 w-4" />Trang dịch vụ</Link>
    <h1 className="font-serif text-2xl font-bold tracking-tight text-[#1C1917] sm:text-[32px] dark:text-[#FAFAF9]">Tra cứu quy chế</h1>
    <p className="mt-3 text-base text-[#57534E] dark:text-[#D6D3D1]">Nhập câu hỏi để tìm hướng dẫn và nguồn tham khảo.</p>
    <p className="mt-2 text-sm text-[#57534E] dark:text-[#A8A29E]">Tra cứu hướng dẫn về tài liệu học vụ và khiếu nại điểm. Với các chính sách khác, xem cổng chính sách VinUni hoặc gửi câu hỏi cho cán bộ.</p>
    <a href={VINUNI_SOURCES.policies} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[#78716C] underline dark:text-[#A8A29E]">Mở cổng chính sách VinUni</a>
    <form onSubmit={handleSearch} className="mt-6">
      <label htmlFor="lookup-question" className="mb-2 block text-sm font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E]">Bạn muốn tìm hiểu điều gì?</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input id="lookup-question" value={lookupQuery} onChange={(event) => setLookupQuery(event.target.value)} maxLength={2000} required placeholder="Ví dụ: Xin giấy xác nhận cần thông tin gì?" className={`${fieldClass} min-w-0 flex-1`} />
        <button type="submit" className={primaryButton}><Search className="h-4 w-4" />Tra cứu</button>
      </div>
    </form>
    {!result && <div className="mt-5 flex flex-wrap gap-2" aria-label="Câu hỏi gợi ý">
      {["Xin giấy xác nhận cần thông tin gì?", "Cách nhận bản điện tử?", "Khiếu nại điểm thi thế nào?"].map((question) => <button type="button" key={question} onClick={() => search(question)} className={`${secondaryButton} border border-[#D6D3D1] bg-[#FAFAF9] text-xs font-semibold uppercase tracking-wider text-[#57534E] hover:bg-[#F5F5F4] dark:border-[#44403C] dark:bg-[#1C1917] dark:text-[#D6D3D1]`}>{question}</button>)}
    </div>}
    {result && <section className={`${surfaceClass} mt-7`} aria-labelledby="lookup-result-title">
      <h2 ref={resultRef} tabIndex={-1} id="lookup-result-title" className="font-serif text-lg font-bold text-[#1C1917] dark:text-[#FAFAF9]">{result.question}</h2>
      <p className="mt-4 text-base leading-relaxed text-[#1C1917] dark:text-[#FAFAF9]">{result.reply.text}</p>
      {result.reply.source ? <div className="mt-6 border-t border-[#E7E5E4] pt-5 dark:border-[#2E2A27]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]"><BookOpen className="h-4 w-4" />Nguồn hướng dẫn</div>
        <p className="mt-2 text-sm text-[#57534E] dark:text-[#A8A29E]">{result.reply.source.title} · {result.reply.source.section}</p>
        <details className="mt-3 text-sm"><summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-[#1C1917] dark:text-[#FAFAF9]">Xem nội dung hướng dẫn</summary><blockquote className="mt-2 border-l-2 border-[#78716C] pl-4 leading-relaxed text-[#57534E] dark:border-[#A8A29E] dark:text-[#D6D3D1]">{result.reply.source.quote}</blockquote></details>
        {result.reply.source.href && <a href={result.reply.source.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#78716C] underline dark:text-[#A8A29E]">Mở nguồn chính thức</a>}
        {result.reply.action && <Link href={result.reply.action.href} className={`${secondaryButton} -ml-4 mt-3`}>{result.reply.action.label}<ArrowRight className="h-4 w-4" /></Link>}
      </div> : <button type="button" onClick={() => setConfirmQuestion(result.question)} className={`${secondaryButton} mt-5 border border-[#D6D3D1] dark:border-[#44403C]`}>Gửi câu hỏi cho cán bộ<ArrowRight className="h-4 w-4" /></button>}
    </section>}
    <AccessibleDialog open={confirmQuestion !== null} onClose={() => setConfirmQuestion(null)} labelledBy="lookup-confirm-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-none border border-[#E7E5E4] bg-[#FAFAF9] p-6 sm:p-8 dark:border-[#2E2A27] dark:bg-[#1C1917]">
      <h2 id="lookup-confirm-title" className="font-serif text-xl font-bold text-[#1C1917] dark:text-[#FAFAF9]">Kiểm tra câu hỏi trước khi gửi</h2>
      <label htmlFor="support-topic" className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E]">Chủ đề</label>
      <select id="support-topic" value={topic} onChange={(event) => setTopic(event.target.value)} className={fieldClass}><option value="academic">Học vụ / tài liệu</option><option value="other">Chính sách khác</option></select>
      <label htmlFor="support-question" className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E]">Câu hỏi</label>
      <textarea id="support-question" value={confirmQuestion || ""} onChange={(event) => setConfirmQuestion(event.target.value)} maxLength={2000} rows={3} className={fieldClass} />
      <label htmlFor="support-context" className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E]">Bối cảnh / học kỳ / chương trình (không bắt buộc)</label>
      <textarea id="support-context" value={context} onChange={(event) => setContext(event.target.value)} maxLength={4000} rows={2} className={fieldClass} />
      <p className="mt-4 text-sm text-[#57534E] dark:text-[#D6D3D1]">{dataConfig?.mode === "mock" ? "Câu hỏi được lưu vào hồ sơ trên thiết bị này để bạn xem lại." : "Câu hỏi được tạo thành hồ sơ và chuyển tới cán bộ phụ trách."}</p>
      <a href={topic === "academic" ? VINUNI_SOURCES.documents : VINUNI_SOURCES.policies} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#78716C] underline dark:text-[#A8A29E]">{topic === "academic" ? "Hướng dẫn và liên hệ Registrar" : "Cổng chính sách và đơn vị phụ trách"}</a>
      {submitError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{submitError}</p>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={() => setConfirmQuestion(null)} disabled={submitting} className={secondaryButton}>Quay lại</button>
        <button type="button" onClick={() => void submitQuestion()} disabled={!confirmQuestion?.trim() || submitting} className={primaryButton}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Đang gửi…</> : "Gửi câu hỏi"}</button>
      </div>
    </AccessibleDialog>
  </div>;
}
