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
  Inbox,
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
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/queue", label: "Hàng chờ", icon: Inbox },
        { href: "/reviews", label: "Hồ sơ/Reviews", icon: FileSearch },
      ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--ts-border-subtle)] bg-[var(--ts-bg)]/95 text-[var(--ts-text-primary)] backdrop-blur-sm transition-colors">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* ── Left: Brand ── */}
        <Link href={isStudent ? "/student" : isAdmin ? "/admin" : "/dashboard"} className="flex min-h-11 items-center gap-2.5 shrink-0 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#78716C] text-[#FAFAF9] transition-all group-hover:bg-[#57534E] dark:bg-[#A8A29E] dark:text-[#1C1917]">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          <span className="font-serif text-[17px] font-bold tracking-tight text-[var(--ts-text-primary)] select-none">
            Campus 24/7
          </span>
        </Link>

        {/* ── Center: Navigation (desktop) ── */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/reviews" || item.href === "/student" || item.href === "/queue"
                ? pathname.startsWith(item.href) && pathname !== "/student/assistant"
                : pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "rounded-sm border-b-2 border-[#78716C] bg-[var(--ts-surface)] font-semibold text-[var(--ts-text-primary)] dark:border-[#A8A29E]"
                    : "rounded-sm text-[var(--ts-text-secondary)] hover:bg-[var(--ts-surface)] hover:text-[var(--ts-text-primary)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Right: Compact utilities ── */}
        <div className="flex items-center gap-2 shrink-0">
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
              className="relative z-50 flex min-h-11 items-center gap-2 rounded-sm border border-[var(--ts-border-medium)] px-2.5 py-1.5 text-[var(--ts-text-primary)] transition-colors hover:bg-[var(--ts-surface)]"
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#78716C] text-[11px] font-bold text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]"
              >
                {isStudent ? "SV" : isAdmin ? "AD" : "CB"}
              </div>

              <div className="hidden sm:block text-left">
                <div className="text-[13px] font-semibold leading-tight text-[var(--ts-text-primary)]">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-[var(--ts-text-secondary)]">
                  {isStudent ? currentUser.mssv || currentUser.id : currentUser.id}
                </div>
              </div>

              <ChevronDown className="h-3.5 w-3.5 text-[var(--ts-text-tertiary)]" />
            </button>

            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div id="account-panel" ref={accountPanelRef} role="region" aria-label="Tùy chọn tài khoản" className="fixed left-4 right-4 top-[72px] z-50 max-h-[calc(100dvh-88px)] overflow-y-auto overscroll-contain rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-bg)] p-2 text-[13px] text-[var(--ts-text-primary)] shadow-sm sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
                  {/* Current user */}
                  <div className="mb-2 rounded-sm border border-[var(--ts-border-subtle)] bg-[var(--ts-surface)] p-3">
                    <div className="mb-2 text-xs font-medium text-[var(--ts-text-secondary)]">Tài khoản đang đăng nhập</div>
                    <div className="break-words font-serif text-[15px] font-semibold text-[var(--ts-text-primary)]">
                      {currentUser.name}
                    </div>
                    <div className="mt-0.5 break-words text-[12px] text-[var(--ts-text-secondary)]">
                      {currentUser.email}
                    </div>
                    <div className="mt-1 break-words text-[12px] text-[var(--ts-text-primary)]">
                      {isStudent ? "Mã sinh viên" : isAdmin ? "Mã quản trị" : "Mã cán bộ"}: {isStudent ? currentUser.mssv || currentUser.id : currentUser.id}
                    </div>
                    <div className="mt-0.5 break-words text-[12px] text-[var(--ts-text-secondary)]">
                      {isStudent ? "Sinh viên" : isAdmin ? "Quản trị viên" : "Cán bộ"}{affiliation ? ` · ${affiliation}` : ""}
                    </div>
                  </div>

                  {/* App Settings */}
                  <div className="mb-2 flex items-center justify-between border-b border-[var(--ts-border-subtle)] px-2 py-2">
                    <ThemeToggle showLabel />
                  </div>

                  {/* Logout */}
                  <div className="mt-1 border-t border-[var(--ts-border-subtle)] pt-1.5">
                    <Link
                      href="/login"
                      onClick={() => {
                        logout();
                        setUserDropdownOpen(false);
                      }}
                      className="flex min-h-11 w-full items-center gap-2 rounded-sm px-3 py-2 text-left font-medium text-red-600 transition-colors hover:bg-[var(--ts-surface)] dark:text-red-400"
                    >
                      <LogOut className="h-4 w-4" />
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
            className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-[var(--ts-border-medium)] p-2 text-[var(--ts-text-secondary)] transition-colors hover:bg-[var(--ts-surface)] lg:hidden"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <nav id="mobile-menu" className="space-y-1 border-t border-[var(--ts-border-subtle)] bg-[var(--ts-bg)] px-4 py-3 text-[var(--ts-text-primary)] lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/reviews" || item.href === "/student" || item.href === "/queue"
                ? pathname.startsWith(item.href) && pathname !== "/student/assistant"
                : pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex min-h-[44px] items-center gap-2.5 px-3 py-2.5 text-[14px] font-medium transition-colors ${
                  isActive
                    ? "rounded-none border-l-2 border-[#78716C] bg-[var(--ts-surface)] font-semibold text-[var(--ts-text-primary)] dark:border-[#A8A29E]"
                    : "rounded-none text-[var(--ts-text-secondary)] hover:bg-[var(--ts-surface)] hover:text-[var(--ts-text-primary)]"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
