"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Send,
  Lock,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";

interface Submit1ModalProps {
  onSuccess: (ticketId: string) => void;
  onCancel: () => void;
}

export function Submit1Modal({ onSuccess, onCancel }: Submit1ModalProps) {
  const {
    currentUser,
    createTicket,
    gate1FormData,
    setGate1FormData,
    lastUpdatedField,
    tickets,
  } = useStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  const handleSubmit = async () => {
    const reason = gate1FormData.reason.trim();
    if (!reason) {
      setValidationError("Vui lòng nhập mục đích xin giấy trước khi gửi hồ sơ.");
      requestAnimationFrame(() => reasonInputRef.current?.focus());
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      const created = await createTicket({
        title: "Cấp Giấy xác nhận sinh viên (BM-03)",
        certificateType: "Giấy xác nhận sinh viên chính quy (BM-03)",
        destinationOrg:
          gate1FormData.destinationOrg ||
          reason ||
          "Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức",
        purpose: reason,
        receiveMethod: gate1FormData.receiveMethod,
        priority: "normal",
        priorityReason: "Hồ sơ đã xác nhận thông tin, không ghi nhận vi phạm kỷ luật.",
      });

      setIsSubmitting(false);
      onSuccess(created.id);
    } catch (err) {
      console.error(err);
      setValidationError("Không thể gửi hồ sơ lúc này. Vui lòng kiểm tra lại và thử lại.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#FAFAF9] dark:bg-[#1C1917] shadow-none border border-[#E7E5E4] dark:border-[#292524] rounded-none overflow-hidden text-xs">
      {/* Header */}
      <div className="shrink-0 p-4 bg-[#F5F5F4] dark:bg-[#1C1917] border-b border-[#E7E5E4] dark:border-[#292524] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#78716C] dark:bg-[#A8A29E]" />
          <h3 className="font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">
            Biểu mẫu yêu cầu
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-none bg-[#EFEDEB] text-[#57534E] dark:bg-[#292524] dark:text-[#D6D3D1] font-semibold border border-[#D6D3D1] dark:border-[#44403C]">
            Bước 1/2: Kiểm tra thông tin
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng biểu mẫu yêu cầu"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-none text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#FAFAF9]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
        {/* Academic Verification Notice */}
        <div className="p-3 rounded-none border-l-2 border-[#B45309] bg-[#F5F5F4] text-[#1C1917] dark:border-[#FBBF24] dark:bg-[#1C1917] dark:text-[#FAFAF9] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-[#B45309] dark:text-[#FBBF24]">
            <ShieldAlert className="w-4 h-4 text-[#B45309] dark:text-[#FBBF24] shrink-0" />
            <span>Thông tin cần được kiểm tra:</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">
            Dữ liệu bạn kê khai sẽ được cán bộ đối chiếu với thông tin đào tạo trước khi yêu cầu được xử lý.
          </p>
        </div>

        {/* Form Preview */}
        <div className="p-4 rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] shadow-none space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4] dark:border-[#292524]">
            <span className="font-serif text-sm font-normal text-[#1C1917] dark:text-[#FAFAF9]">
              Thông tin giấy xác nhận sinh viên
            </span>
            <span className="text-[10px] font-mono text-[#78716C] dark:text-[#A8A29E]">Mã biểu mẫu: XN-VV-2025</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[#57534E] dark:text-[#D6D3D1]">
            <div>
              <span className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] block">
                Họ và tên SV:
              </span>
              <span className="font-semibold text-[#1C1917] dark:text-[#FAFAF9] text-xs">
                {currentUser.name}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] block">
                Mã số sinh viên (MSSV):
              </span>
              <span className="font-mono font-semibold text-[#1C1917] dark:text-[#FAFAF9] text-xs">
                {currentUser.mssv || currentUser.id}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] block">
                Khóa học / Lớp sinh hoạt:
              </span>
              <span className="text-xs text-[#1C1917] dark:text-[#FAFAF9]">{currentUser.classYear || "—"}</span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] block">
                Khoa quản lý chuyên môn:
              </span>
              <span className="text-xs text-[#1C1917] dark:text-[#FAFAF9]">{currentUser.major || currentUser.department || "—"}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="gate1-reason" className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] block">
                Mục đích và nơi gửi:
              </label>
              {lastUpdatedField === "reason" && (
                <span className="text-[10px] text-[#3F6212] dark:text-[#4ADE80] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Vừa được cập nhật
                </span>
              )}
            </div>
            <input
              ref={reasonInputRef}
              id="gate1-reason"
              name="purpose"
              type="text"
              value={gate1FormData.reason}
              onChange={(e) => {
                const nextReason = e.target.value;
                setGate1FormData((prev) => ({ ...prev, reason: nextReason }));
                if (validationError && nextReason.trim()) setValidationError(null);
              }}
              required
              aria-invalid={validationError ? "true" : "false"}
              aria-describedby={validationError ? "gate1-reason-error" : undefined}
              placeholder="Nhập mục đích xin giấy hoặc nhờ trợ lý chỉnh sửa..."
              className={`w-full p-2.5 rounded-none text-xs border text-[#1C1917] dark:text-[#FAFAF9] ${
                lastUpdatedField === "reason"
                  ? "bg-[#EFEDEB] dark:bg-[#292524] border-[#78716C] ring-1 ring-[#78716C]"
                  : "bg-[#FAFAF9] dark:bg-[#1C1917] border-[#D6D3D1] dark:border-[#44403C] focus:outline-none focus:ring-1 focus:ring-[#78716C]"
              }`}
            />
            {validationError && (
              <p id="gate1-reason-error" role="alert" aria-live="polite" className="text-[11px] font-medium text-[#B91C1C] dark:text-[#EF4444]">
                {validationError}
              </p>
            )}
          </div>

          {/* Receive Method */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] block">
                Phương thức nhận văn bản:
              </label>
              {lastUpdatedField === "receiveMethod" && (
                <span className="text-[10px] text-[#3F6212] dark:text-[#4ADE80] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Vừa được cập nhật
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2 p-2.5 rounded-none border cursor-pointer ${
                  gate1FormData.receiveMethod === "digital_pdf"
                    ? "bg-[#EFEDEB] dark:bg-[#292524] border-[#78716C] text-[#1C1917] dark:text-[#FAFAF9]"
                    : "bg-[#FAFAF9] dark:bg-[#1C1917] border-[#D6D3D1] dark:border-[#44403C] text-[#57534E] dark:text-[#D6D3D1]"
                }`}
              >
                <input
                  type="radio"
                  name="receiveMethod"
                  checked={gate1FormData.receiveMethod === "digital_pdf"}
                  onChange={() =>
                    setGate1FormData((prev) => ({ ...prev, receiveMethod: "digital_pdf" }))
                  }
                  className="mt-0.5 accent-[#78716C]"
                />
                <div>
                  <div className="font-semibold text-xs text-[#1C1917] dark:text-[#FAFAF9]">Bản điện tử (PDF)</div>
                  <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">
                    Ký số, gửi qua Cổng dịch vụ sinh viên
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-none border cursor-pointer ${
                  gate1FormData.receiveMethod === "paper_stamped"
                    ? "bg-[#EFEDEB] dark:bg-[#292524] border-[#78716C] text-[#1C1917] dark:text-[#FAFAF9]"
                    : "bg-[#FAFAF9] dark:bg-[#1C1917] border-[#D6D3D1] dark:border-[#44403C] text-[#57534E] dark:text-[#D6D3D1]"
                }`}
              >
                <input
                  type="radio"
                  name="receiveMethod"
                  checked={gate1FormData.receiveMethod === "paper_stamped"}
                  onChange={() =>
                    setGate1FormData((prev) => ({ ...prev, receiveMethod: "paper_stamped" }))
                  }
                  className="mt-0.5 accent-[#78716C]"
                />
                <div>
                  <div className="font-semibold text-xs text-[#1C1917] dark:text-[#FAFAF9]">Bản giấy</div>
                  <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">
                    Nhận tại Phòng Đào tạo (Bàn 3)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-none bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:hover:bg-[#D6D3D1] text-[#FAFAF9] dark:text-[#1C1917] font-medium flex items-center justify-center gap-2 transition-colors text-xs disabled:opacity-60"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Gửi yêu cầu</span>
              </>
            )}
          </button>

          {/* Business rule disclaimer */}
          <div className="flex items-start gap-2 p-2.5 rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] text-[10px] text-[#78716C] dark:text-[#A8A29E]">
            <Lock className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A8A29E] shrink-0 mt-0.5" />
            <span>
              <strong>Lưu ý:</strong> Chỉ sau khi bấm nút trên, yêu cầu mới được chuyển đến cán bộ xử lý. Văn bản chưa được phát hành ở bước này.
            </span>
          </div>
        </div>

        {/* Existing Tracked Tickets Mini List */}
        <div className="space-y-2 pt-2 border-t border-[#E7E5E4] dark:border-[#292524]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-serif text-sm font-normal text-[#1C1917] dark:text-[#FAFAF9]">
              Yêu cầu đang theo dõi ({tickets.filter((t) => t.studentId === currentUser.id).length} yêu cầu)
            </span>
            <Link
              href="/my-requests"
              className="inline-flex min-h-[44px] items-center px-2 text-[11px] text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#FAFAF9] underline-offset-4 hover:underline"
            >
              Xem tất cả yêu cầu
            </Link>
          </div>

          <div className="space-y-2">
            {tickets
              .filter((t) => t.studentId === currentUser.id)
              .map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-none bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-xs text-[#1C1917] dark:text-[#FAFAF9]">
                      #{t.code}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
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

                  <div className="font-medium text-[#1C1917] dark:text-[#FAFAF9] text-[11px] min-h-[2rem] line-clamp-2">
                    {t.title}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-[#78716C] dark:text-[#A8A29E] pt-1">
                    <span>Cán bộ phụ trách: {t.assignedOfficerName || "Phòng Đào tạo"}</span>
                    <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                      Thời gian còn lại: {t.slaRemaining || t.slaDeadline}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* Tuition Status Banner */}
          <div className="p-2.5 rounded-none bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-[#57534E] dark:text-[#D6D3D1]">
              <CheckCircle2 className="w-4 h-4 text-[#3F6212] dark:text-[#84CC16] shrink-0" />
              <span>Học phí Học kỳ II: Đã quyết toán (Không nợ phí)</span>
            </div>
            <span className="font-mono font-medium text-[#1C1917] dark:text-[#FAFAF9]">0 VNĐ nợ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
