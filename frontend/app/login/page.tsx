"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  HelpCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { useStore } from "@/lib/store";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";

// Set to false when the real authentication flow is ready for release.
const DEMO_ACCOUNTS_ENABLED = true;
const DEMO_ACCOUNTS = [
  { label: "Sinh viên", identifier: "SV001", password: "demo1234" },
  { label: "Cán bộ", identifier: "OF001", password: "demo1234" },
] as const;

function LoginForm() {
  const router = useRouter();

  const { login } = useStore();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [demoAccountsOpen, setDemoAccountsOpen] = useState(false);
  const closeHelpDialog = React.useCallback(() => setHelpDialogOpen(false), []);

  const handleFillDemo = (identifierValue: string, passwordValue: string) => {
    setIdentifier(identifierValue);
    setPassword(passwordValue);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = identifier.trim().toLowerCase();
    if (!trimmed) {
      setError("Vui lòng nhập tài khoản.");
      return;
    }
    if (!password) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }

    setLoading(true);

    try {
      // Find matching user
      let matchedUserId = "";
      if (trimmed.includes("an.nv") || trimmed === "sv001" || trimmed === "20210018") {
        matchedUserId = "SV001";
      } else if (trimmed.includes("ha.tt") || trimmed === "of001") {
        matchedUserId = "OF001";
      } else if (trimmed.includes("tram.lb") || trimmed === "sv024" || trimmed === "20240019") {
        matchedUserId = "SV024";
      } else {
        setLoading(false);
        setError("Không tìm thấy tài khoản. Kiểm tra thông tin hoặc chọn tài khoản mẫu bên dưới.");
        return;
      }

      if (password !== "demo1234") {
        setLoading(false);
        setError("Tài khoản hoặc mật khẩu không chính xác.");
        return;
      }

      const success = await login(matchedUserId, rememberMe);
      setLoading(false);

      if (success) {
        if (matchedUserId === "OF001") {
          router.push("/dashboard");
        } else {
          router.push("/student");
        }
      } else {
        setError("Tài khoản hoặc mật khẩu không chính xác.");
      }
    } catch {
      setLoading(false);
      setError("Có lỗi xảy ra, vui lòng thử lại.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
          Đăng nhập hệ thống
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Đăng nhập tài khoản
        </h2>
      </div>

      {error && (
        <div id="login-error" role="alert" aria-live="assertive" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Tài khoản
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "login-error" : undefined}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email hoặc mã tài khoản"
              className="w-full pl-9 pr-3 py-2.5 min-h-[44px] text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "login-error" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-10 py-2.5 min-h-[44px] text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
            />
            <button
              type="button"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Ghi nhớ tài khoản</span>
          </label>

        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập</span>
            </>
          )}
        </button>
      </form>

      {DEMO_ACCOUNTS_ENABLED && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/50">
          <button
            type="button"
            aria-expanded={demoAccountsOpen}
            onClick={() => setDemoAccountsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left text-xs font-semibold text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
          >
            <span>{demoAccountsOpen ? "Ẩn tài khoản mẫu" : "Tài khoản mẫu"}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${demoAccountsOpen ? "rotate-180" : ""}`} />
          </button>

          {demoAccountsOpen && (
            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Chọn một tài khoản để điền sẵn thông tin đăng nhập.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.identifier}
                    type="button"
                    onClick={() => handleFillDemo(account.identifier, account.password)}
                    className="flex min-h-[58px] flex-col items-start justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
                  >
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Dùng tài khoản {account.label.toLowerCase()}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Điền sẵn thông tin đăng nhập
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="pt-2 text-center border-t border-slate-200 dark:border-slate-800/80">
        <button
          type="button"
          onClick={() => setHelpDialogOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Cần trợ giúp đăng nhập?</span>
        </button>
      </div>

      {/* Help Dialog Modal */}
      {helpDialogOpen && (
        <AccessibleDialog
          open={helpDialogOpen}
          onClose={closeHelpDialog}
          labelledBy="help-dialog-title"
          className="w-full max-w-md"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div id="help-dialog-title" className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <span>Trợ giúp đăng nhập</span>
              </div>
              <button
                type="button"
                onClick={closeHelpDialog}
                aria-label="Đóng trợ giúp đăng nhập"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <p>Hãy sử dụng email trường hoặc mã số được cấp để đăng nhập.</p>
              <p>Nếu thông tin đăng nhập không hoạt động, hãy liên hệ Phòng Đào tạo hoặc bộ phận hỗ trợ của trường.</p>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={closeHelpDialog}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
