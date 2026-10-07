"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useStore } from "@/lib/store";

interface StudentWorkspaceHubProps {
  onOpenGate1: () => void;
  onSelectPreset: (reason: string, method?: "digital_pdf" | "paper_stamped") => void;
}

export function StudentWorkspaceHub({
  onOpenGate1,
  onSelectPreset,
}: StudentWorkspaceHubProps) {
  const { currentUser, tickets } = useStore();

  if (!currentUser) return null;

  const studentTickets = tickets.filter((t) => t.studentId === currentUser.id);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] rounded-none shadow-none overflow-hidden text-xs">
      {/* Panel Top Header */}
      <div className="shrink-0 p-4 bg-[#F5F5F4] dark:bg-[#1C1917] border-b border-[#E7E5E4] dark:border-[#292524] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none border border-[#78716C] bg-[#1C1917] text-[#FAFAF9] dark:bg-[#FAFAF9] dark:text-[#1C1917] flex items-center justify-center font-bold">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-normal text-[#1C1917] dark:text-[#FAFAF9]">
              Bàn làm việc sinh viên
            </h3>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
              Kê khai trực tuyến và theo dõi hồ sơ 24/7
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[10px] font-mono uppercase tracking-wider border border-[#3F6212] text-[#3F6212] dark:border-[#84CC16] dark:text-[#84CC16]">
          <span className="w-1.5 h-1.5 bg-[#3F6212] dark:bg-[#84CC16]" />
          <span role="status" aria-live="polite">Sẵn sàng</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
        {/* Card 1: Fast Service Launcher */}
        <div className="p-4 rounded-none bg-[#FAFAF9] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] shadow-none space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-normal text-[#1C1917] dark:text-[#FAFAF9]">
                Tạo yêu cầu cấp giấy
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-none bg-[#F5F5F4] dark:bg-[#141210] text-[#78716C] dark:text-[#A8A29E] border border-[#E7E5E4] dark:border-[#292524]">
                Mã biểu mẫu: BM-03
              </span>
            </div>
            <span className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">Giấy xác nhận sinh viên</span>
          </div>

          <p className="text-[11px] leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">
            Điền thông tin và gửi yêu cầu cấp Giấy xác nhận sinh viên. Trợ lý AI có thể hỗ trợ đối chiếu dữ liệu học vụ.
          </p>

          <button
            type="button"
            onClick={onOpenGate1}
            className="w-full py-2.5 px-4 rounded-none bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:hover:bg-[#D6D3D1] text-[#FAFAF9] dark:text-[#1C1917] font-medium flex items-center justify-center gap-2 transition-colors text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bắt đầu điền biểu mẫu</span>
          </button>

          <div className="space-y-1.5 pt-1 border-t border-[#E7E5E4] dark:border-[#292524]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block">
              Chọn nhanh loại yêu cầu
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onSelectPreset("Nộp Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức (Học kỳ 2)")
                }
                className="p-2 text-left rounded-none bg-[#F5F5F4] dark:bg-[#141210] hover:bg-[#E7E5E4] dark:hover:bg-[#292524] border border-[#E7E5E4] dark:border-[#292524] text-[#1C1917] dark:text-[#FAFAF9] transition-colors text-[11px]"
              >
                <div className="font-medium leading-snug min-h-[2rem]">Vay vốn ngân hàng</div>
                <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">Học kỳ 2 / 2026</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSelectPreset(
                    "Nộp Ban Chỉ huy Quân sự địa phương xin tạm hoãn gọi nhập ngũ năm 2026"
                  )
                }
                className="p-2 text-left rounded-none bg-[#F5F5F4] dark:bg-[#141210] hover:bg-[#E7E5E4] dark:hover:bg-[#292524] border border-[#E7E5E4] dark:border-[#292524] text-[#1C1917] dark:text-[#FAFAF9] transition-colors text-[11px]"
              >
                <div className="font-medium leading-snug min-h-[2rem]">Tạm hoãn NVQS</div>
                <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">Năm 2026</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSelectPreset("Nộp Đơn vị tiếp nhận Thực tập tốt nghiệp doanh nghiệp (Học kỳ 2)")
                }
                className="p-2 text-left rounded-none bg-[#F5F5F4] dark:bg-[#141210] hover:bg-[#E7E5E4] dark:hover:bg-[#292524] border border-[#E7E5E4] dark:border-[#292524] text-[#1C1917] dark:text-[#FAFAF9] transition-colors text-[11px]"
              >
                <div className="font-medium leading-snug min-h-[2rem]">Thực tập tốt nghiệp</div>
                <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">Kỳ tốt nghiệp</div>
              </button>
            </div>
          </div>

          <div className="p-2 rounded-none bg-[#F5F5F4] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] flex items-start gap-2 text-[10px] text-[#78716C] dark:text-[#A8A29E]">
            <Sparkles className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A8A29E] shrink-0 mt-0.5" />
            <span>
              <strong>Trợ lý có thể cập nhật biểu mẫu:</strong> Bạn có thể nhờ đổi mục đích hoặc phương thức nhận.
            </span>
          </div>
        </div>

        {/* Card 2: Tracked Tickets (As in Stitch Screenshot) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-serif text-sm font-normal text-[#1C1917] dark:text-[#FAFAF9] flex items-center gap-1.5">
              <span>Yêu cầu đang theo dõi</span>
              <span className="px-1.5 py-0.2 rounded-none bg-[#E7E5E4] dark:bg-[#292524] font-mono text-[10px]">
                {studentTickets.length}
              </span>
            </span>
            <Link
              href="/my-requests"
              className="inline-flex min-h-[44px] items-center gap-0.5 px-2 text-[11px] text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#FAFAF9] underline-offset-4 hover:underline"
            >
              <span>Xem tất cả yêu cầu</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {studentTickets.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-none bg-[#FAFAF9] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] shadow-none space-y-1.5 hover:border-[#78716C] dark:hover:border-[#A8A29E] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-[#1C1917] dark:text-[#FAFAF9] text-xs">
                    #{t.code}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-none text-[10px] font-mono uppercase tracking-wider ${
                      t.status === "open"
                        ? "border border-[#78716C] text-[#78716C] dark:border-[#A8A29E] dark:text-[#A8A29E]"
                        : t.status === "pending_officer"
                        ? "border border-[#57534E] text-[#57534E] dark:border-[#78716C] dark:text-[#78716C]"
                        : "border border-[#3F6212] text-[#3F6212] dark:border-[#84CC16] dark:text-[#84CC16]"
                    }`}
                  >
                    {t.status === "open"
                      ? "Mới tiếp nhận"
                      : t.status === "pending_officer"
                      ? "Đang chờ xử lý"
                      : "Đã hoàn tất"}
                  </span>
                </div>

                <div className="font-medium text-[#1C1917] dark:text-[#FAFAF9] text-xs min-h-[2rem] line-clamp-2">
                  {t.title}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-[#78716C] dark:text-[#A8A29E] pt-1 border-t border-[#E7E5E4] dark:border-[#292524]">
                  <span>Cán bộ phụ trách: {t.assignedOfficerName || "Phòng Đào tạo"}</span>
                  <span className="font-mono text-[#57534E] dark:text-[#A8A29E] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Thời gian còn lại: {t.slaRemaining || t.slaDeadline}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Academic Qualifications & Tuition */}
        <div className="p-3 rounded-none bg-[#FAFAF9] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] shadow-none space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-[#57534E] dark:text-[#D6D3D1]">
              <CheckCircle2 className="w-4 h-4 text-[#3F6212] dark:text-[#84CC16] shrink-0" />
              <span>Học phí Học kỳ II: Đã quyết toán</span>
            </div>
            <span className="font-mono font-medium text-[#1C1917] dark:text-[#FAFAF9]">
              0 VNĐ nợ
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#E7E5E4] dark:border-[#292524] text-[#78716C] dark:text-[#A8A29E]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A8A29E] shrink-0" />
              <span>Tư cách học thuật: Bình thường</span>
            </span>
            <span>Tín chỉ: {currentUser.credits || "114 / 138 TC"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
