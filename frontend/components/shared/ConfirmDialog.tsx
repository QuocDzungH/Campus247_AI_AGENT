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
      className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95"
    >
      <h3 id="dialog-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {title}
      </h3>
      <p id="dialog-description" className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {description}
      </p>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
            isDestructive
              ? "bg-red-600 hover:bg-red-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </AccessibleDialog>
  );
}
