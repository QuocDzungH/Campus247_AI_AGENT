import React from "react";

type AnyStatus =
  | "open"
  | "pending_officer"
  | "resolved"
  | "draft"
  | "in_review"
  | "waiting_supplement"
  | "completed";

interface StatusBadgeProps {
  status: AnyStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const mapping: Record<AnyStatus, { label: string; className: string; dot: string }> = {
    open: {
      label: "Mới tiếp nhận",
      className: "border border-[#D6D3D1] bg-[#FAFAF9] text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1]",
      dot: "bg-[#78716C] dark:bg-[#A8A29E]",
    },
    pending_officer: {
      label: "Chờ xử lý",
      className: "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-200",
      dot: "bg-amber-500",
    },
    resolved: {
      label: "Hoàn tất",
      className: "border border-[#BBF7D0] bg-[#F0FDF4] text-[#3F6212] dark:border-[rgba(34,197,94,0.4)] dark:bg-[rgba(20,83,45,0.35)] dark:text-[#86EFAC]",
      dot: "bg-[#65A30D] dark:bg-[#86EFAC]",
    },
    draft: {
      label: "Bản nháp",
      className: "border border-[#D6D3D1] bg-[#F5F5F4] text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1]",
      dot: "bg-[#78716C] dark:bg-[#A8A29E]",
    },
    in_review: {
      label: "Đang rà soát",
      className: "border border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-200",
      dot: "bg-blue-600 dark:bg-blue-400",
    },
    waiting_supplement: {
      label: "Chờ bổ sung",
      className: "border border-[#FEF08A] bg-[#FEFCE8] text-[#854D0E] dark:border-[rgba(234,179,8,0.4)] dark:bg-[rgba(113,63,18,0.35)] dark:text-[#FDE047]",
      dot: "bg-[#CA8A04] dark:bg-[#FDE047]",
    },
    completed: {
      label: "Hoàn tất",
      className: "border border-[#BBF7D0] bg-[#F0FDF4] text-[#3F6212] dark:border-[rgba(34,197,94,0.4)] dark:bg-[rgba(20,83,45,0.35)] dark:text-[#86EFAC]",
      dot: "bg-[#65A30D] dark:bg-[#86EFAC]",
    },
  };

  const { label, className, dot } = mapping[status] || {
    label: "Không xác định",
    className: "border border-[#D6D3D1] bg-[#F5F5F4] text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1]",
    dot: "bg-[#78716C]",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap ${className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: "normal" | "high";
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (priority === "high") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none text-[11px] font-semibold uppercase tracking-wider border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] dark:border-[rgba(239,68,68,0.4)] dark:bg-[rgba(127,29,29,0.35)] dark:text-[#FCA5A5] whitespace-nowrap">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#DC2626] dark:bg-[#FCA5A5]" />
        Khẩn cấp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none text-[11px] font-medium uppercase tracking-wider border border-[#E7E5E4] bg-[#F5F5F4] text-[#57534E] dark:border-[#44403C] dark:bg-[#23201D] dark:text-[#D6D3D1] whitespace-nowrap">
      Bình thường
    </span>
  );
}
