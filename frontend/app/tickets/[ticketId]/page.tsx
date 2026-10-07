"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";
import { LoadingState } from "@/components/shared/LoadingState";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { Ticket } from "@/lib/types";
import { StaffTicketWorkspace } from "@/components/staff/StaffTicketWorkspace";

function StudentTicketView({ ticket }: { ticket: Ticket }) {
  const statusLabel =
    ticket.status === "open"
      ? "Mới tiếp nhận"
      : ticket.status === "pending_officer"
      ? "Đang được cán bộ xử lý"
      : "Đã hoàn tất";

  return (
    <div className="thoughtstream-theme min-h-screen flex flex-col bg-[var(--ts-bg)] text-[var(--ts-text-primary)]">
      <Navbar />
      <main className="w-full max-w-[1440px] mx-auto flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
                {ticket.code}
              </span>
            </div>
            <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px] text-[#1C1917] dark:text-[#FAFAF9]">
              Theo dõi hồ sơ của bạn
            </h1>
            <p className="mt-2 text-sm text-[var(--ts-text-secondary)]">
              Thông tin chi tiết yêu cầu học vụ và trao đổi với cán bộ xử lý.
            </p>
          </div>
          <Link
            href={`/my-requests?ticket=${encodeURIComponent(ticket.id)}`}
            className="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-sm bg-[#1C1917] hover:bg-[#57534E] dark:bg-[#FAFAF9] dark:hover:bg-[#E7E5E4] text-[#FAFAF9] dark:text-[#1C1917] text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            Mở trong Yêu cầu của tôi
          </Link>
        </div>

        <section aria-labelledby="student-ticket-title" className="max-w-4xl rounded-sm bg-[#FFFFFF] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] shadow-none p-5 sm:p-6 space-y-5">
          <div>
            <h2 id="student-ticket-title" className="font-serif text-base sm:text-lg font-normal text-[#1C1917] dark:text-[#FAFAF9]">
              {ticket.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span role="status" className="px-2 py-0.5 rounded-none font-mono text-[10px] uppercase tracking-wider border border-[#78716C] text-[#78716C] dark:border-[#A8A29E] dark:text-[#A8A29E]">
                {statusLabel}
              </span>
              <span className="text-[#78716C] dark:text-[#A8A29E]">Gửi lúc: {ticket.submittedAt}</span>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] p-3">
              <dt className="text-[#78716C] dark:text-[#A8A29E]">Nơi nhận</dt>
              <dd className="mt-1 font-medium text-[#1C1917] dark:text-[#FAFAF9]">{ticket.destinationOrg}</dd>
            </div>
            <div className="rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] p-3">
              <dt className="text-[#78716C] dark:text-[#A8A29E]">Mục đích</dt>
              <dd className="mt-1 font-medium text-[#1C1917] dark:text-[#FAFAF9]">{ticket.purpose}</dd>
            </div>
          </dl>

          <div className="space-y-3" aria-labelledby="student-ticket-messages">
            <h3 id="student-ticket-messages" className="font-serif text-sm font-normal text-[#1C1917] dark:text-[#FAFAF9]">Trao đổi gần đây</h3>
            {ticket.messages.slice(-5).map((message) => (
              <article key={message.id} className="rounded-none border border-[#E7E5E4] dark:border-[#292524] bg-[#F5F5F4] dark:bg-[#1C1917] p-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2 font-medium text-[#1C1917] dark:text-[#FAFAF9]">
                  <span>{message.senderName}</span>
                  <time className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E]">{message.timestamp}</time>
                </div>
                <p className="mt-1.5 whitespace-pre-line leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">{message.content}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params?.ticketId as string;
  const { getTicket, currentUser, isDataLoading, dataConfig, refreshTicket } = useStore();

  const ticket = getTicket(ticketId);

  React.useEffect(() => {
    if (dataConfig?.mode !== "api" || !ticketId || !currentUser) return;
    void refreshTicket(ticketId).catch(() => {
      /* Detail error is shown via dataError. */
    });
    // Load once per ticket/account; refreshTicket identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, currentUser?.id, dataConfig?.mode]);

  if (isDataLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <Navbar />
        <LoadingState title="Đang tải hồ sơ..." description="Hệ thống đang đồng bộ dữ liệu hồ sơ." />
      </div>
    );
  }

  if (!currentUser) return <DataAccessState />;

  if (!ticket) {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <Navbar />
        <div className="max-w-4xl mx-auto p-12 text-center text-xs">
          <p className="text-[#78716C] dark:text-[#A8A29E]">Không tìm thấy mã hồ sơ: {ticketId}</p>
          <Link href={currentUser.role === "officer" ? "/dashboard" : "/my-requests"} className="text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#FAFAF9] underline-offset-4 hover:underline mt-2 inline-block">
            {currentUser.role === "officer" ? "Quay lại Hàng chờ" : "Quay lại Yêu cầu của tôi"}
          </Link>
        </div>
      </div>
    );
  }

  if (currentUser.role !== "officer") {
    if (ticket.studentId !== currentUser.id) {
      return (
        <div className="min-h-screen flex flex-col bg-transparent">
          <Navbar />
          <main className="max-w-2xl mx-auto w-full p-8 text-center space-y-4">
            <h1 className="font-serif text-2xl font-normal text-[#1C1917] dark:text-[#FAFAF9]">Bạn không có quyền xem hồ sơ này</h1>
            <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">Hãy quay lại danh sách hồ sơ của bạn để tiếp tục.</p>
            <Link href="/my-requests" className="inline-flex min-h-[44px] items-center px-5 py-2.5 rounded-none bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:hover:bg-[#D6D3D1] text-[#FAFAF9] dark:text-[#1C1917] text-sm font-medium transition-colors">Quay lại Yêu cầu của tôi</Link>
          </main>
        </div>
      );
    }
    return <StudentTicketView ticket={ticket} />;
  }

  return <StaffTicketWorkspace key={`${currentUser.id}-${ticket.id}`} ticket={ticket} />;
}
