"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  LogOut,
  ChevronDown,
  FileText,
  MessageSquare,
  LayoutDashboard,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "./ThemeToggle";
import { DemoBadge } from "./DemoBadge";
import { DEMO_USERS } from "@/lib/mock-data";

export function Navbar() {
  const { currentUser, login, logout } = useStore();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isStudent = currentUser.role === "student";
  const isOfficer = currentUser.role === "officer";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B0F17]/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 dark:bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
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
                {isOfficer ? "Hệ thống Quản trị & Thẩm định" : "Cổng Dịch vụ Học vụ Trực tuyến"}
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Main Navigation & Role Switch */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-900/70 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <Link
            href="/chat"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isStudent
                ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            onClick={() => {
              if (!isStudent) login("SV001");
            }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Cổng Sinh viên (SV001)</span>
          </Link>

          <Link
            href="/my-requests"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Yêu cầu của tôi</span>
          </Link>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-800 mx-1" />

          <Link
            href="/dashboard"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isOfficer
                ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            onClick={() => {
              if (!isOfficer) login("OF001");
            }}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Bàn làm việc Cán bộ (OF001)</span>
          </Link>
        </div>

        {/* Right: Status Pill, User, Theme */}
        <div className="flex items-center gap-2.5">
          {/* AI Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Engine 24/7 Sẵn sàng</span>
          </div>

          <DemoBadge className="hidden sm:inline-flex" />

          <ThemeToggle />

          {/* User Profile Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {currentUser.role === "student" ? "SV" : "CB"}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {currentUser.id} {currentUser.major ? `· ${currentUser.major}` : ""}
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
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 text-xs">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {currentUser.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {currentUser.email}
                    </div>
                    <div className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                      {currentUser.role === "student" ? "Sinh viên chính quy" : "Cán bộ quản trị học vụ"}
                    </div>
                  </div>

                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Chuyển tài khoản demo
                    </div>
                    {Object.values(DEMO_USERS).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          login(u.id);
                          setUserDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                          currentUser.id === u.id
                            ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-[10px] text-slate-500">{u.id} · {u.role === "student" ? "Sinh viên" : "Cán bộ"}</div>
                        </div>
                        {currentUser.id === u.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                    <Link
                      href="/login"
                      onClick={() => {
                        logout();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất (về màn đăng nhập)</span>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
