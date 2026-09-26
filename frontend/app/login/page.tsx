"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  HelpCircle,
  X,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { useStore } from "@/lib/store";
import { DEMO_USERS } from "@/lib/mock-data";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");

  const { login } = useStore();

  const [identifier, setIdentifier] = useState(() => {
    if (roleParam === "officer") return "ha.tt@campus.edu.vn";
    if (roleParam === "student") return "an.nv@campus.edu.vn";
    return "";
  });
  const [password, setPassword] = useState(() => {
    if (roleParam === "officer" || roleParam === "student") return "demo1234";
    return "";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  const handleFillDemo = (userId: string) => {
    setError(null);
    const user = DEMO_USERS[userId];
    if (user) {
      setIdentifier(user.email);
      setPassword("demo1234");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = identifier.trim().toLowerCase();
    if (!trimmed) {
      setError("Vui lòng nhập tài khoản email hoặc MSSV/Mã cán bộ.");
      return;
    }
    if (!password) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      // Find matching user
      let matchedUserId = "";
      if (trimmed.includes("an.nv") || trimmed === "sv001" || trimmed === "20210018") {
        matchedUserId = "SV001";
      } else if (trimmed.includes("ha.tt") || trimmed === "of001") {
        matchedUserId = "OF001";
      } else if (trimmed.includes("tram.lb") || trimmed === "sv024" || trimmed === "20240019") {
        matchedUserId = "SV024";
      } else {
        // Fallback or demo match
        matchedUserId = trimmed.startsWith("of") ? "OF001" : "SV001";
      }

      const success = login(matchedUserId);
      setLoading(false);

      if (success) {
        if (matchedUserId === "OF001") {
          router.push("/dashboard");
        } else {
          router.push("/chat");
        }
      } else {
        setError("Tài khoản hoặc mật khẩu không chính xác.");
      }
    }, 400);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 mb-2">
          <KeyRound className="w-3 h-3" />
          <span>Đăng Nhập Cổng Học Vụ</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Xác Thực Danh Tính
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Đăng nhập một lần (SSO) với tài khoản nội bộ trường.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Demo Pre-fill Pills */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
          Điền tài khoản demo (Bấm Đăng nhập sau khi chọn):
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => handleFillDemo("SV001")}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
          >
            SV001 (Sinh viên)
          </button>
          <button
            type="button"
            onClick={() => handleFillDemo("OF001")}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
          >
            OF001 (Cán bộ)
          </button>
          <button
            type="button"
            onClick={() => handleFillDemo("SV024")}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors"
          >
            SV024 (SV khác)
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Email hoặc Mã số (MSSV / Mã Cán bộ)
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="an.nv@campus.edu.vn hoặc SV001"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white backdrop-blur-sm transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-10 py-2 text-xs rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white backdrop-blur-sm transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Ghi nhớ tài khoản</span>
          </label>

          <button
            type="button"
            onClick={() => setHelpDialogOpen(true)}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Quên mật khẩu?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Đăng Nhập</span>
            </>
          )}
        </button>
      </form>

      <div className="pt-2 text-center border-t border-slate-200 dark:border-slate-800/80">
        <button
          type="button"
          onClick={() => setHelpDialogOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Hướng dẫn đăng nhập demo & trợ giúp</span>
        </button>
      </div>

      {/* Help Dialog Modal */}
      {helpDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>Thông Tin Tài Khoản Thử Nghiệm</span>
              </div>
              <button
                type="button"
                onClick={() => setHelpDialogOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="font-semibold text-blue-600 dark:text-blue-400">1. Cổng Sinh Viên (SV001)</div>
                <div className="text-[11px] mt-0.5">Email: <code className="font-mono text-slate-800 dark:text-slate-200">an.nv@campus.edu.vn</code> hoặc <code className="font-mono">SV001</code></div>
                <div className="text-[11px]">Đích đến: <code className="font-mono text-emerald-600 dark:text-emerald-400">/chat</code></div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="font-semibold text-indigo-600 dark:text-indigo-400">2. Bàn Làm Việc Cán Bộ (OF001)</div>
                <div className="text-[11px] mt-0.5">Email: <code className="font-mono text-slate-800 dark:text-slate-200">ha.tt@campus.edu.vn</code> hoặc <code className="font-mono">OF001</code></div>
                <div className="text-[11px]">Đích đến: <code className="font-mono text-emerald-600 dark:text-emerald-400">/dashboard</code></div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="font-semibold text-slate-700 dark:text-slate-300">3. Sinh Viên Thứ Hai (SV024)</div>
                <div className="text-[11px] mt-0.5">Email: <code className="font-mono text-slate-800 dark:text-slate-200">tram.lb@campus.edu.vn</code> hoặc <code className="font-mono">SV024</code></div>
                <div className="text-[11px]">Dùng kiểm tra tính cô lập hồ sơ giữa các sinh viên.</div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setHelpDialogOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Đang tải...</div>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
