"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { Database, Wifi } from "lucide-react";

export function DataModeBadge() {
  const { dataConfig, dataStatus, isDataLoading, dataError } = useStore();

  if (!dataConfig || dataStatus === "configuration_error" || dataError?.reason === "configuration") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#FEF2F2] dark:bg-[rgba(127,29,29,0.35)] text-[#B91C1C] dark:text-[#FCA5A5] rounded-none text-[10px] font-semibold uppercase tracking-wider border border-[#FECACA] dark:border-[rgba(239,68,68,0.4)]">
        <Wifi className="w-3 h-3" />
        <span>Lỗi cấu hình</span>
      </div>
    );
  }

  if (dataConfig.mode === "mock") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#FEFCE8] dark:bg-[rgba(113,63,18,0.35)] text-[#854D0E] dark:text-[#FDE047] rounded-none text-[10px] font-semibold uppercase tracking-wider border border-[#FEF08A] dark:border-[rgba(234,179,8,0.4)]">
        <Database className="w-3 h-3" />
        <span>Mock UAT</span>
      </div>
    );
  }

  if (isDataLoading || dataStatus === "loading") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#F5F5F4] dark:bg-[#23201D] text-[#57534E] dark:text-[#D6D3D1] rounded-none text-[10px] font-semibold uppercase tracking-wider border border-[#D6D3D1] dark:border-[#44403C]">
        <Wifi className="w-3 h-3 animate-pulse" />
        <span>Đang kết nối...</span>
      </div>
    );
  }

  if (dataStatus === "unsupported" || dataError?.reason === "unsupported") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#FEFCE8] dark:bg-[rgba(113,63,18,0.35)] text-[#854D0E] dark:text-[#FDE047] rounded-none text-[10px] font-semibold uppercase tracking-wider border border-[#FEF08A] dark:border-[rgba(234,179,8,0.4)]">
        <Wifi className="w-3 h-3" />
        <span>API chưa được hỗ trợ</span>
      </div>
    );
  }

  if (dataStatus === "ready" && !dataError) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#F0FDF4] dark:bg-[rgba(20,83,45,0.35)] text-[#3F6212] dark:text-[#86EFAC] rounded-none text-[10px] font-semibold uppercase tracking-wider border border-[#BBF7D0] dark:border-[rgba(34,197,94,0.4)]">
        <Wifi className="w-3 h-3" />
        <span>Đã kết nối</span>
      </div>
    );
  }

  const isConnectionError =
    dataStatus === "connection_error" || dataError?.reason === "network" || dataError?.reason === "server";
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#FEF2F2] dark:bg-[rgba(127,29,29,0.35)] text-[#B91C1C] dark:text-[#FCA5A5] rounded-none text-[10px] font-semibold uppercase tracking-wider border border-[#FECACA] dark:border-[rgba(239,68,68,0.4)]">
      <Wifi className="w-3 h-3" />
      <span>{isConnectionError ? "Lỗi kết nối" : "Lỗi dữ liệu"}</span>
    </div>
  );
}
