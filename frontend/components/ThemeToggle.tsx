"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useStore } from "@/lib/store";

export function ThemeToggle({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { theme, toggleTheme } = useStore();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex min-h-11 min-w-11 items-center gap-2 rounded-none border border-[var(--ts-border-medium,theme(colors.slate.200))] p-2 text-[var(--ts-text-secondary,theme(colors.slate.600))] transition-colors hover:bg-[var(--ts-surface,theme(colors.slate.100))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ts-focus-ring,#78716C)] focus-visible:ring-offset-2 ${showLabel ? "w-full justify-start px-3 text-sm" : "justify-center"} ${className}`}
      title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 text-[#78716C] dark:text-[#D6D3D1] transition-transform hover:-rotate-12" aria-hidden="true" />
      )}
      {showLabel && <span>{theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}</span>}
    </button>
  );
}
