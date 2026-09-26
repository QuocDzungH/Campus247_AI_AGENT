"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Send,
  Lock,
  CheckCircle2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";

interface Submit1ModalProps {
  onSuccess: (ticketId: string) => void;
  onCancel: () => void;
}

export function Submit1Modal({ onSuccess, onCancel }: Submit1ModalProps) {
  const { currentUser, createTicket, gate1FormData, tickets } = useStore();

  const [reason, setReason] = useState(gate1FormData.reason);
  const [receiveMethod, setReceiveMethod] = useState<"digital_pdf" | "paper_stamped">(
    gate1FormData.receiveMethod
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const created = createTicket({
        title: "Cấp Giấy xác nhận sinh viên (BM-03)",
        certificateType: "Giấy xác nhận sinh viên chính quy (BM-03)",
        destinationOrg: "Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức",
        purpose: reason,
        receiveMethod,
        priority: "normal",
        priorityReason: "Hồ sơ Cổng 1 đã ký cam đoan thông tin, không ghi nhận vi phạm kỷ luật.",
      });

      setIsSubmitting(false);
      onSuccess(created.id);
    }, 400);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden text-xs">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Cổng Kiểm duyệt 1 (Cổng Sinh viên)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-700/50">
            BƯỚC 1: XÁC THỰC KÊ KHAI
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Academic Verification Notice */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Nguyên tắc kiểm chứng học thuật:</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/80">
            Dữ liệu do sinh viên kê khai sẽ ở trạng thái <strong className="font-semibold underline">[CHƯA KIỂM CHỨNG]</strong> cho đến khi cán bộ đối soát thành công với CSDL Đào tạo Quốc gia.
          </p>
        </div>

        {/* Form Preview */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-slate-900 dark:text-white text-xs">
              Xem lại thông tin: Giấy xác nhận SV vay vốn
            </span>
            <span className="text-[10px] font-mono text-slate-500">Mẫu: XN-VV-2025</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Họ và tên SV:
              </span>
              <span className="font-semibold text-slate-900 dark:text-white text-xs">
                {currentUser.name}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Mã số sinh viên (MSSV):
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white text-xs">
                {currentUser.mssv || currentUser.id}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Khóa học / Lớp sinh hoạt:
              </span>
              <span className="text-xs">{currentUser.classYear || "Khóa 18 (2021 - 2025)"}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Khoa quản lý chuyên môn:
              </span>
              <span className="text-xs">{currentUser.major || "Khoa Công nghệ Phần mềm"}</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Lý do & Nơi gửi xác nhận:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Receive Method */}
          <div>
            <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
              Phương thức nhận văn bản:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  receiveMethod === "digital_pdf"
                    ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="receiveMethod"
                  checked={receiveMethod === "digital_pdf"}
                  onChange={() => setReceiveMethod("digital_pdf")}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-xs">Bản điện tử (PDF)</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Ký số CA, gửi qua Cổng SV
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  receiveMethod === "paper_stamped"
                    ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="receiveMethod"
                  checked={receiveMethod === "paper_stamped"}
                  onChange={() => setReceiveMethod("paper_stamped")}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-xs">Bản giấy (Dấu đỏ)</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Nhận tại P. Đào tạo (Bàn 3)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all text-xs"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Xác nhận gửi hồ sơ tới Phòng Đào tạo</span>
              </>
            )}
          </button>

          {/* Business rule disclaimer */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              <strong>Lưu ý nghiệp vụ:</strong> Chỉ khi bấm nút trên, yêu cầu mới chính thức được chuyển vào Hàng chờ trạng thái &ldquo;Mới tiếp nhận&rdquo; (Open) của Cán bộ. Hệ thống tuyệt đối chưa phát hành văn bản tại bước này.
            </span>
          </div>
        </div>

        {/* Existing Tracked Tickets Mini List */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900 dark:text-white">
              Hồ sơ cá nhân đang theo dõi ({tickets.filter((t) => t.studentId === currentUser.id).length} hồ sơ)
            </span>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
              Xem lịch sử học vụ
            </span>
          </div>

          <div className="space-y-2">
            {tickets
              .filter((t) => t.studentId === currentUser.id)
              .map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      #{t.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        t.status === "open"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          : t.status === "pending_officer"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                      }`}
                    >
                      {t.status === "open"
                        ? "MỚI TIẾP NHẬN"
                        : t.status === "pending_officer"
                        ? "CHỜ CÁN BỘ (PENDING_OFFICER)"
                        : "ĐÃ HOÀN TẤT (RESOLVED)"}
                    </span>
                  </div>

                  <div className="font-medium text-slate-900 dark:text-white text-[11px]">
                    {t.title}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                    <span>Cán bộ thụ lý: {t.assignedOfficerName || "Phòng Đào tạo"}</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400">
                      SLA: {t.slaRemaining || t.slaDeadline}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* Tuition Status Banner */}
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Học phí Học kỳ II: Đã quyết toán (Không nợ phí)</span>
            </div>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">0 VNĐ nợ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
