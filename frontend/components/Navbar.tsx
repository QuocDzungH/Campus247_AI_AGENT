"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LogOut,
  ChevronDown,
  FileText,
  MessageSquare,
  LayoutDashboard,
  Shield,
  Check,
  Menu,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "./ThemeToggle";
import { DemoBadge } from "./DemoBadge";
import { DEMO_USERS } from "@/lib/mock-data";

export function Navbar() {
  const pathname = usePathname();
  const { currentUser, login, logout } = useStore();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountGroupTab, setAccountGroupTab] = useState<"all" | "student" | "staff">("all");
  // Default to true: only show menus relevant to the active role
  const [onlyCurrentRoleNav, setOnlyCurrentRoleNav] = useState(true);

  const isStudent = currentUser.role === "student";
  const isOfficer = currentUser.role === "officer";

  // Categorize demo users into Student vs Staff
  const studentUsers = Object.values(DEMO_USERS).filter((u) => u.role === "student");
  const staffUsers = Object.values(DEMO_USERS).filter((u) => u.role === "officer");

  return (
    <header className="sticky top-0 z-40 w-full glass-nav transition-colors border-b border-slate-200/80 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tight text-slate-900 dark:text-white text-base">
                Campus 24/7
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-700/50">
                  AI OPS
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase">
                {isOfficer ? "Phân hệ Quản trị & Thẩm định Hồ sơ Học vụ" : "Cổng Dịch vụ Học vụ & Trợ lý Sinh viên"}
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Main Navigation */}
        <div className="hidden md:flex items-center gap-3">
          {onlyCurrentRoleNav ? (
            /* ========================================================
               1. ROLE-BASED NAVIGATION (CHỈ HIỆN THEO ĐÚNG CHỨC VỤ)
               ======================================================== */
            isStudent ? (
              /* Giao diện dành riêng cho SINH VIÊN */
              <div className="flex items-center gap-1.5 p-1 rounded-2xl border bg-sky-500/10 border-sky-300 dark:border-sky-800 transition-all">
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 select-none">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Cổng Sinh viên</span>
                </div>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

                <Link
                  href="/chat"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    pathname === "/chat"
                      ? "bg-white dark:bg-sky-600 text-sky-700 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Trợ lý AI &amp; Nộp đơn</span>
                </Link>

                <Link
                  href="/my-requests"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    pathname === "/my-requests"
                      ? "bg-white dark:bg-sky-600 text-sky-700 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Hồ sơ &amp; Khiếu nại của tôi</span>
                </Link>
              </div>
            ) : (
              /* Giao diện dành riêng cho CÁN BỘ HỌC VỤ */
              <div className="flex items-center gap-1.5 p-1 rounded-2xl border bg-indigo-500/10 border-indigo-300 dark:border-indigo-800 transition-all">
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 select-none">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Bàn Học vụ &amp; Đào tạo</span>
                </div>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

                <Link
                  href="/dashboard"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    pathname === "/dashboard"
                      ? "bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Hàng chờ Xử lý Hồ sơ (OF001)</span>
                </Link>
              </div>
            )
          ) : (
            /* ========================================================
               2. ALL MODULES VIEW (CHẾ ĐỘ MỞ TẤT CẢ CHO DEMO)
               ======================================================== */
            <div className="flex items-center gap-3">
              {/* Khối Sinh viên */}
              <div className="flex items-center gap-1 p-1 rounded-2xl border bg-sky-500/10 border-sky-300 dark:border-sky-800">
                <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 select-none">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Sinh viên</span>
                </div>
                <Link
                  href="/chat"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    pathname === "/chat"
                      ? "bg-white dark:bg-sky-600 text-sky-700 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Trợ lý AI</span>
                </Link>
                <Link
                  href="/my-requests"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    pathname === "/my-requests"
                      ? "bg-white dark:bg-sky-600 text-sky-700 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Yêu cầu</span>
                </Link>
              </div>

              {/* Khối Cán bộ */}
              <div className="flex items-center gap-1 p-1 rounded-2xl border bg-indigo-500/10 border-indigo-300 dark:border-indigo-800">
                <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 select-none">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Cán bộ</span>
                </div>
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    pathname === "/dashboard"
                      ? "bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Bàn Học vụ (OF001)</span>
                </Link>
              </div>
            </div>
          )}

          {/* Quick Nav-Mode Switcher */}
          <button
            type="button"
            onClick={() => setOnlyCurrentRoleNav(!onlyCurrentRoleNav)}
            title={onlyCurrentRoleNav ? "Đang khóa hiển thị theo đúng vai trò. Bấm để mở tất cả" : "Đang mở toàn bộ menu. Bấm để khóa theo vai trò"}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{onlyCurrentRoleNav ? "Theo vai trò" : "Mở tất cả"}</span>
          </button>
        </div>

        {/* Right: Status Pill, User, Theme */}
        <div className="flex items-center gap-2.5">
          <DemoBadge className="hidden xl:inline-flex" />

          <ThemeToggle />

          {/* User Profile Menu with explicit Student vs Staff grouping */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className={`flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border transition-all ${
                isStudent
                  ? "bg-sky-50/70 dark:bg-sky-950/30 border-sky-300 dark:border-sky-800 hover:bg-sky-100/70"
                  : "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 hover:bg-indigo-100/70"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs ${
                  isStudent
                    ? "bg-gradient-to-tr from-sky-500 to-blue-600"
                    : "bg-gradient-to-tr from-indigo-600 to-purple-600"
                }`}
              >
                {isStudent ? "SV" : "CB"}
              </div>

              <div className="hidden sm:block text-left text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {currentUser.name}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider border ${
                      isStudent
                        ? "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 border-sky-200 dark:border-sky-700"
                        : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700"
                    }`}
                  >
                    {isStudent ? "Sinh viên" : "Cán bộ"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {currentUser.id} {currentUser.major ? `· ${currentUser.major}` : currentUser.title ? `· ${currentUser.title}` : ""}
                </div>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2.5 text-xs animate-in fade-in zoom-in-95">
                  {/* Current Account Details */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 mb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {currentUser.name}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                          isStudent
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                        }`}
                      >
                        {isStudent ? "Sinh viên" : "Cán bộ Học vụ"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {currentUser.email}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1 font-medium">
                      <span>{currentUser.department || currentUser.major || currentUser.classYear}</span>
                    </div>
                  </div>

                  {/* Nav Filter Mode Option in Dropdown */}
                  <div className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 mb-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Hiển thị thanh Navbar</span>
                      <SlidersHorizontal className="w-3 h-3" />
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setOnlyCurrentRoleNav(true)}
                        className={`py-1 px-2 rounded-lg text-center transition-all ${
                          onlyCurrentRoleNav
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        Theo chức vụ
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnlyCurrentRoleNav(false)}
                        className={`py-1 px-2 rounded-lg text-center transition-all ${
                          !onlyCurrentRoleNav
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        Mở tất cả menu
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs for Switcher */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setAccountGroupTab("all")}
                      className={`flex-1 py-1 rounded-lg text-center transition-all ${
                        accountGroupTab === "all"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Tất cả ({studentUsers.length + staffUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountGroupTab("student")}
                      className={`flex-1 py-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                        accountGroupTab === "student"
                          ? "bg-sky-600 text-white shadow-xs"
                          : "text-sky-700 dark:text-sky-400 hover:text-sky-900"
                      }`}
                    >
                      <GraduationCap className="w-3 h-3" />
                      <span>Sinh viên ({studentUsers.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountGroupTab("staff")}
                      className={`flex-1 py-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                        accountGroupTab === "staff"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-indigo-700 dark:text-indigo-400 hover:text-indigo-900"
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      <span>Cán bộ ({staffUsers.length})</span>
                    </button>
                  </div>

                  {/* List 1: KHỐI SINH VIÊN */}
                  {(accountGroupTab === "all" || accountGroupTab === "student") && (
                    <div className="mb-3">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5 border-b border-sky-100 dark:border-sky-950/60 pb-1 mb-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>Tài khoản Sinh viên ({studentUsers.length})</span>
                      </div>
                      <div className="space-y-1">
                        {studentUsers.map((u) => {
                          const isCurrent = currentUser.id === u.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                login(u.id);
                                setUserDropdownOpen(false);
                              }}
                              className={`w-full text-left p-2 rounded-xl flex items-center justify-between gap-2 border transition-all ${
                                isCurrent
                                  ? "bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-100 font-medium"
                                  : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0 text-[10px] font-bold">
                                  SV
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs truncate">{u.name}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {u.id} {u.mssv ? `· MSSV: ${u.mssv}` : ""} · {u.major}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold border bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                  Sinh viên
                                </span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* List 2: KHỐI CÁN BỘ */}
                  {(accountGroupTab === "all" || accountGroupTab === "staff") && (
                    <div className="mb-2">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 border-b border-indigo-100 dark:border-indigo-950/60 pb-1 mb-1">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Tài khoản Cán bộ Học vụ ({staffUsers.length})</span>
                      </div>
                      <div className="space-y-1">
                        {staffUsers.map((u) => {
                          const isCurrent = currentUser.id === u.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                login(u.id);
                                setUserDropdownOpen(false);
                              }}
                              className={`w-full text-left p-2 rounded-xl flex items-center justify-between gap-2 border transition-all ${
                                isCurrent
                                  ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 font-medium"
                                  : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 text-[10px] font-bold">
                                  CB
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs truncate">{u.name}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {u.id} · {u.title} · {u.department}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold border bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                                  Cán bộ
                                </span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Logout */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-2">
                    <Link
                      href="/login"
                      onClick={() => {
                        logout();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất (về màn đăng nhập)</span>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 space-y-3">
          {onlyCurrentRoleNav ? (
            isStudent ? (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Cổng Sinh viên</span>
                </div>
                <Link
                  href="/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === "/chat"
                      ? "bg-sky-600 text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Trợ lý AI &amp; Nộp đơn</span>
                </Link>
                <Link
                  href="/my-requests"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === "/my-requests"
                      ? "bg-sky-600 text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Hồ sơ &amp; Khiếu nại của tôi</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Bàn Học vụ &amp; Đào tạo</span>
                </div>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === "/dashboard"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Bàn Xử lý Hồ sơ (OF001)</span>
                </Link>
              </div>
            )
          ) : (
            <>
              {/* Group 1: Sinh viên */}
              <div className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Cổng Sinh viên</span>
                </div>
                <Link
                  href="/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === "/chat"
                      ? "bg-sky-600 text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Trợ lý AI &amp; Nộp đơn</span>
                </Link>
                <Link
                  href="/my-requests"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === "/my-requests"
                      ? "bg-sky-600 text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Yêu cầu Học vụ đã nộp</span>
                </Link>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-800" />

              {/* Group 2: Cán bộ */}
              <div className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Bàn Học vụ &amp; Đào tạo</span>
                </div>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === "/dashboard"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Bàn Xử lý Học vụ (OF001)</span>
                </Link>
              </div>
            </>
          )}

          {/* Toggle in mobile menu */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Chế độ thanh điều hướng:</span>
            <button
              type="button"
              onClick={() => setOnlyCurrentRoleNav(!onlyCurrentRoleNav)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-blue-600 dark:text-blue-400"
            >
              {onlyCurrentRoleNav ? "Theo chức vụ" : "Hiện tất cả"}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
