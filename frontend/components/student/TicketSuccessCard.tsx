"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowRight, Clock } from "lucide-react";

interface TicketSuccessCardProps {
  ticketId?: string;
  ticketCode?: string;
  title?: string;
}

export function TicketSuccessCard({
  ticketCode = "TKT-2026-0142",
  title = "Giấy xác nhận sinh viên",
}: TicketSuccessCardProps) {
  return (
    <div className="p-4 rounded-none bg-[#F0FDF4] dark:bg-[rgba(20,83,45,0.25)] border border-[#BBF7D0] dark:border-[rgba(34,197,94,0.4)] text-xs space-y-3 transition-all shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-none bg-[#BBF7D0] text-[#3F6212] dark:bg-[rgba(34,197,94,0.4)] dark:text-[#86EFAC] flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-serif font-normal text-[#1C1917] dark:text-[#FAFAF9] text-sm">
              Đã gửi yêu cầu vào hệ thống thành công!
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono font-bold text-[#3F6212] dark:text-[#86EFAC]">
                {ticketCode}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[10px] font-semibold uppercase tracking-wider bg-[#F5F5F4] text-[#57534E] dark:bg-[#23201D] dark:text-[#D6D3D1] border border-[#D6D3D1] dark:border-[#44403C]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#78716C]" />
                MỚI TIẾP NHẬN
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[#57534E] dark:text-[#D6D3D1] leading-relaxed text-[11px]">
        Yêu cầu cấp <strong>{title}</strong> của bạn đã được chuyển đến Cán bộ học vụ để kiểm tra điều kiện. Kết quả xử lý sẽ được cập nhật tự động tại mục &ldquo;Yêu cầu của tôi&rdquo;.
      </p>

      {/* Business rule disclaimer */}
      <div className="p-2.5 rounded-none bg-[#FEFCE8] dark:bg-[rgba(113,63,18,0.25)] border border-[#FEF08A] dark:border-[rgba(234,179,8,0.4)] text-[#854D0E] dark:text-[#FDE047] flex items-start gap-2 text-[11px]">
        <AlertTriangle className="w-4 h-4 text-[#CA8A04] dark:text-[#FDE047] shrink-0 mt-0.5" />
        <div>
          <strong>Ghi chú nghiệp vụ:</strong> Văn bản chưa được ban hành tại bước này (đang chờ cán bộ thẩm định và ký số).
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[#BBF7D0] dark:border-[rgba(34,197,94,0.3)] text-[11px]">
        <span className="text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Thời gian xử lý cam kết (SLA): 24h – 48h</span>
        </span>

        <Link
          href="/my-requests"
          className="inline-flex items-center gap-1 font-semibold text-[#78716C] dark:text-[#A8A29E] hover:underline"
        >
          <span>Theo dõi tại Yêu cầu của tôi</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
