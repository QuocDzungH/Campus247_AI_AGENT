import React from "react";
import { AccessibleDialog } from "./AccessibleDialog";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <AccessibleDialog
      open={isOpen}
      onClose={onCancel}
      labelledBy="dialog-title"
      describedBy="dialog-description"
      className="relative bg-[#FAFAF9] dark:bg-[#1C1917] rounded-none border border-[#E7E5E4] dark:border-[#292524] p-6 w-full max-w-sm shadow-none"
    >
      <h3 id="dialog-title" className="font-serif text-lg font-normal text-[#1C1917] dark:text-[#FAFAF9] mb-2">
        {title}
      </h3>
      <p id="dialog-description" className="text-sm text-[#57534E] dark:text-[#D6D3D1] mb-6">
        {description}
      </p>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-none text-sm font-medium border border-[#D6D3D1] dark:border-[#44403C] bg-transparent text-[#57534E] hover:bg-[#F5F5F4] dark:text-[#D6D3D1] dark:hover:bg-[#292524] transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`px-4 py-2 rounded-none text-sm font-medium text-white transition-colors ${
            isDestructive
              ? "bg-[#DC2626] hover:bg-[#B91C1C]"
              : "bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:text-[#1C1917]"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </AccessibleDialog>
  );
}
