'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { GlassCard } from '@/components/common/GlassCard';
import {
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  User,
  Hash,
  BookOpen,
  Send,
  ShieldAlert,
} from 'lucide-react';

interface Submit1ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ticketId: string) => void;
}

export function Submit1Modal({ isOpen, onClose, onSuccess }: Submit1ModalProps) {
  const { currentUser, submitCertificateRequest } = useStore();

  const [purpose, setPurpose] = useState<string>(
    'Bổ sung hồ sơ vay vốn Ngân hàng Chính sách Xã hội kỳ 2 năm học 2025-2026'
  );
  const [purposeInput, setPurposeInput] = useState<string>(
    'Bổ sung hồ sơ vay vốn Ngân hàng Chính sách Xã hội kỳ 2 năm học 2025-2026'
  );
  const [hasChangedPurpose, setHasChangedPurpose] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handlePurposeChange = (val: string) => {
    setPurposeInput(val);
    setHasChangedPurpose(val !== purpose);
  };

  const handleUpdatePreview = () => {
    setPurpose(purposeInput);
    setHasChangedPurpose(false);
  };

  const handleConfirmSubmit = () => {
    if (hasChangedPurpose) {
      // Must preview before submitting if purpose changed!
      setPurpose(purposeInput);
      setHasChangedPurpose(false);
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const ticket = submitCertificateRequest(purpose);
      setIsSubmitting(false);
      onClose();
      onSuccess(ticket.id);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-lg relative animate-in zoom-in-95 duration-200">
        <GlassCard elevated className="p-6 sm:p-7 border-white/15 bg-slate-900/90 shadow-[0_24px_64px_rgba(0,0,0,0.8)]">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.2)]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base tracking-tight">
                  Cổng Kiểm duyệt Submit 1: Review Hồ sơ Cấp giấy
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  Sinh viên kiểm tra đối chiếu dữ liệu trước khi nộp vào hệ thống
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Fields & Preview */}
          <div className="space-y-4 mb-6 text-xs">
            {/* Auto-prefilled read-only fields */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] shadow-sm">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Họ và tên sinh viên
                </label>
                <div className="font-semibold text-white text-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>{currentUser.name}</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Mã số sinh viên (MSSV)
                </label>
                <div className="font-mono font-semibold text-white text-sm flex items-center gap-1.5 tabular-nums">
                  <Hash className="w-3.5 h-3.5 text-blue-400" />
                  <span>{currentUser.id}</span>
                </div>
              </div>
              <div className="col-span-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
                <span>Ngành: {currentUser.major}</span>
                <span>Khóa: {currentUser.cohort}</span>
              </div>
            </div>

            {/* Document Type (Fixed by pipeline) */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Loại văn bản yêu cầu
              </label>
              <div className="px-3.5 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-200 font-semibold flex items-center justify-between">
                <span>Giấy xác nhận sinh viên (Bản chuẩn)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 font-bold uppercase font-mono">
                  Biểu mẫu BM-03
                </span>
              </div>
            </div>

            {/* Purpose field */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Mục đích sử dụng (SV có thể chỉnh sửa)
              </label>
              <textarea
                rows={2}
                value={purposeInput}
                onChange={(e) => handlePurposeChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs glass-input text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/30"
                placeholder="Nhập mục đích xin cấp giấy..."
              />
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  'Vay vốn Ngân hàng Chính sách Xã hội',
                  'Xin visa du lịch / du học',
                  'Tạm hoãn nghĩa vụ quân sự',
                  'Thực tập tốt nghiệp doanh nghiệp',
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handlePurposeChange(sug)}
                    className="px-2.5 py-1 text-[10px] rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/[0.08] transition-colors"
                  >
                    + {sug}
                  </button>
                ))}
              </div>

              {hasChangedPurpose && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] flex items-center justify-between">
                  <span>Bạn vừa thay đổi mục đích. Cần cập nhật preview trước khi nộp.</span>
                  <button
                    type="button"
                    onClick={handleUpdatePreview}
                    className="font-bold underline text-amber-300 hover:text-amber-100 ml-2"
                  >
                    Xem lại Preview
                  </button>
                </div>
              )}
            </div>

            {/* Strict Regulatory Notice */}
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-200 text-[11px] leading-relaxed flex items-start gap-2 shadow-inner">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block mb-0.5">Quy tắc nghiệp vụ Submit 1:</span>
                Thao tác này chỉ gửi <span className="font-semibold text-white">hồ sơ yêu cầu</span> vào hệ thống nhà trường để Cán bộ học vụ tiếp nhận.
                <span className="font-semibold text-amber-300 block mt-0.5">
                  Tuyệt đối chưa cấp/ký văn bản PDF tại bước này.
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-all"
            >
              Hủy yêu cầu (Không tạo ticket)
            </button>

            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isSubmitting || hasChangedPurpose}
              className={`btn-primary-glass flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold ${
                hasChangedPurpose ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Đang nộp...</span>
                </>
              ) : hasChangedPurpose ? (
                <span>Vui lòng bấm Xem lại Preview</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Xác nhận & Nộp yêu cầu (Submit 1)</span>
                </>
              )}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
