"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { DATA_MODE_KEY } from "@/lib/data/config";

export function DataModeSwitcher() {
  const { dataConfig } = useStore();

  if (!dataConfig || !dataConfig.enableModeSwitch) {
    return null;
  }

  const toggleMode = () => {
    const nextMode = dataConfig.mode === "mock" ? "api" : "mock";
    localStorage.setItem(DATA_MODE_KEY, nextMode);
    window.location.reload();
  };

  return (
    <button
      onClick={toggleMode}
      className="text-[10px] px-2 py-1 bg-[#F5F5F4] dark:bg-[#23201D] text-[#57534E] dark:text-[#D6D3D1] rounded-none border border-[#D6D3D1] dark:border-[#44403C] hover:bg-[#EFEDEB] dark:hover:bg-[#292524] transition-colors"
      title="Click để chuyển đổi mode dữ liệu"
    >
      Chuyển sang {dataConfig.mode === "mock" ? "API" : "Mock"}
    </button>
  );
}
