"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LogOut,
  ChevronDown,
  FileText,
  Home,
  LayoutDashboard,
  Menu,
  X,
  FileSearch,
  MessageCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const pathname = usePathname();
  const { currentUser, logout } = useStore();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountTriggerRef = React.useRef<HTMLButtonElement>(null);
  const accountPanelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (userDropdownOpen) accountPanelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [userDropdownOpen]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (userDropdownOpen) accountTriggerRef.current?.focus();
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [userDropdownOpen]);

  if (!currentUser) return null;

  const isStudent = currentUser.role === "student";
  const isAdmin = currentUser.role === "admin";

  const affiliation = currentUser.department || currentUser.major || currentUser.classYear;

  /* ── Navigation items based on role ── */
  const navItems = isStudent
    ? [
        { href: "/student", label: "Dịch vụ sinh viên", icon: Home },
        { href: "/student/assistant", label: "Trợ lý học vụ", icon: MessageCircle },
        { href: "/my-requests", label: "Hồ sơ của tôi", icon: FileText },
      ]
    : isAdmin
    ? [{ href: "/admin", label: "Quản trị tài khoản", icon: LayoutDashboard }]
    : [
        { href: "/dashboard", label: "Hàng chờ hồ sơ", icon: LayoutDashboard },
        { href: "/reviews", label: "Rà soát học phần", icon: FileSearch },
      ];

  return (
    <header className={`sticky top-0 z-40 w-full border-b transition-colors ${isStudent ? "border-[var(--ts-border-subtle)] bg-[var(--ts-bg)]/95 text-[var(--ts-text-primary)] backdrop-blur-sm" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
      <div className={`${isStudent ? "max-w-[1120px]" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4`}>
        {/* ── Left: Brand ── */}
        <Link href={isStudent ? "/student" : isAdmin ? "/admin" : "/dashboard"} className="flex min-h-11 items-center gap-2.5 shrink-0 group">
          <div className={`w-8 h-8 flex items-center justify-center text-white transition-all ${
            isStudent
              ? "rounded-none bg-[#78716C] text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917] group-hover:bg-[#57534E]"
              : "rounded-lg bg-blue-600 shadow-sm group-hover:shadow-md"
          }`}>
            <GraduationCap className="w-4.5 h-4.5" />
          </div>
          <span className={`font-bold text-[15px] tracking-tight ${
            isStudent ? "font-serif text-[17px] text-[var(--ts-text-primary)]" : "text-gray-900 dark:text-white"
          }`}>
            Campus 24/7
          </span>
        </Link>

        {/* ── Center: Navigation (desktop) ── */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/reviews" || item.href === "/student"
                ? pathname.startsWith(item.href) && pathname !== "/student/assistant"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 px-3.5 py-2 text-sm font-medium transition-colors ${
                  isStudent
                    ? isActive
                      ? "rounded-none border-b-2 border-[#78716C] bg-[var(--ts-surface)] text-[var(--ts-text-primary)] font-semibold dark:border-[#A8A29E]"
                      : "rounded-none text-[var(--ts-text-secondary)] hover:bg-[var(--ts-surface)] hover:text-[var(--ts-text-primary)]"
                    : isActive
                      ? "rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                      : "rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Right: Compact utilities ── */}
        <div className="flex items-center gap-2">
          {/* User profile button */}
          <div className="relative" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setUserDropdownOpen(false);
          }}>
            <button
              ref={accountTriggerRef}
              type="button"
              aria-expanded={userDropdownOpen}
              aria-controls="account-panel"
              aria-label={`Tài khoản ${currentUser.name}`}
              onClick={() => { setUserDropdownOpen(!userDropdownOpen); setMobileMenuOpen(false); }}
              className={`relative z-50 flex min-h-11 items-center gap-2 px-2 py-1.5 transition-colors ${
                isStudent
                  ? "rounded-none border border-[var(--ts-border-medium)] hover:bg-[var(--ts-surface)] text-[var(--ts-text-primary)]"
                  : "rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <div
                className={`w-7 h-7 flex items-center justify-center text-[11px] font-bold ${
                  isStudent
                    ? "rounded-none bg-[#78716C] text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]"
                    : "rounded-md bg-blue-600 text-white"
                }`}
              >
                {isStudent ? "SV" : "CB"}
              </div>

              <div className="hidden sm:block text-left">
                <div className={`text-[13px] font-semibold leading-tight ${isStudent ? "text-[var(--ts-text-primary)]" : "text-gray-800 dark:text-gray-200"}`}>
                  {currentUser.name}
                </div>
                <div className={`text-[11px] ${isStudent ? "text-[var(--ts-text-secondary)]" : "text-gray-500 dark:text-gray-400"}`}>
                  {isStudent ? currentUser.mssv || currentUser.id : currentUser.id}
                </div>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div id="account-panel" ref={accountPanelRef} role="region" aria-label="Tùy chọn tài khoản" className={`fixed left-4 right-4 top-[72px] max-h-[calc(100dvh-88px)] overflow-y-auto overscroll-contain z-50 p-2 text-[13px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 ${
                  isStudent
                    ? "rounded-none border border-[var(--ts-border-subtle)] bg-[var(--ts-bg)] text-[var(--ts-text-primary)] shadow-none"
                    : "rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 shadow-lg"
                }`}>
                  {/* Current user */}
                  <div className={`p-3 mb-2 ${
                    isStudent
                      ? "rounded-none border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)]"
                      : "rounded-lg bg-gray-50 dark:bg-gray-800/60"
                  }`}>
                    <div className={`mb-2 text-xs font-medium ${isStudent ? "text-[var(--ts-text-secondary)]" : "text-gray-500 dark:text-gray-400"}`}>Tài khoản đang đăng nhập</div>
                    <div className={`font-semibold break-words ${isStudent ? "font-serif text-[15px] text-[var(--ts-text-primary)]" : "text-gray-900 dark:text-white"}`}>
                      {currentUser.name}
                    </div>
                    <div className={`text-[12px] mt-0.5 break-words ${isStudent ? "text-[var(--ts-text-secondary)]" : "text-gray-500 dark:text-gray-400"}`}>
                      {currentUser.email}
                    </div>
                    <div className={`text-[12px] mt-1 break-words ${isStudent ? "text-[var(--ts-text-primary)]" : "text-gray-600 dark:text-gray-300"}`}>
                      {isStudent ? "Mã sinh viên" : "Mã cán bộ"}: {isStudent ? currentUser.mssv || currentUser.id : currentUser.id}
                    </div>
                    <div className={`text-[12px] mt-0.5 break-words ${isStudent ? "text-[var(--ts-text-secondary)]" : "text-gray-600 dark:text-gray-300"}`}>
                      {isStudent ? "Sinh viên" : "Cán bộ"}{affiliation ? ` · ${affiliation}` : ""}
                    </div>
                  </div>

                  {/* App Settings */}
                  <div className={`flex items-center justify-between px-2 py-2 mb-2 border-b ${isStudent ? "border-[var(--ts-border-subtle)]" : "border-gray-100 dark:border-gray-800"}`}>
                    <ThemeToggle showLabel />
                  </div>

                  {/* Logout */}
                  <div className={`border-t pt-1.5 mt-1 ${isStudent ? "border-[var(--ts-border-subtle)]" : "border-gray-100 dark:border-gray-800"}`}>
                    <Link
                      href="/login"
                      onClick={() => {
                        logout();
                        setUserDropdownOpen(false);
                      }}
                      className={`w-full min-h-11 text-left px-3 py-2 flex items-center gap-2 font-medium transition-colors ${
                        isStudent
                          ? "rounded-none text-red-600 hover:bg-[var(--ts-surface)] dark:text-red-400"
                          : "rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setUserDropdownOpen(false); }}
            className={`lg:hidden flex min-h-11 min-w-11 items-center justify-center p-2 transition-colors ${
              isStudent
                ? "rounded-none border border-[var(--ts-border-medium)] text-[var(--ts-text-secondary)] hover:bg-[var(--ts-surface)]"
                : "rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <nav id="mobile-menu" className={`lg:hidden border-t px-4 py-3 space-y-1 ${
          isStudent
            ? "border-[var(--ts-border-subtle)] bg-[var(--ts-bg)] text-[var(--ts-text-primary)]"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        }`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/reviews" || item.href === "/student"
                ? pathname.startsWith(item.href) && pathname !== "/student/assistant"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-[14px] font-medium min-h-[44px] transition-colors ${
                  isStudent
                    ? isActive
                      ? "rounded-none border-l-2 border-[#78716C] bg-[var(--ts-surface)] font-semibold text-[var(--ts-text-primary)] dark:border-[#A8A29E]"
                      : "rounded-none text-[var(--ts-text-secondary)] hover:bg-[var(--ts-surface)] hover:text-[var(--ts-text-primary)]"
                    : isActive
                      ? "rounded-lg bg-blue-600 text-white"
                      : "rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
