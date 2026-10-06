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
import { isConnectionError } from "@/lib/data/api/g2-flow";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { API_DEMO_ACCOUNTS, OPERATIONAL_ACCOUNTS, resolveApiDemoUserId } from "@/lib/data/api/demo-accounts";

// Set to false when the real authentication flow is ready for release.
const DEMO_ACCOUNTS_ENABLED = true;
const MOCK_DEMO_ACCOUNTS = [
  { label: "Sinh viên", identifier: "SV001", password: "demo1234" },
  { label: "Cán bộ", identifier: "OF001", password: "demo1234" },
] as const;

function resolveMockDemoUserId(identifier: string): string | null {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes("an.nv") || trimmed === "sv001" || trimmed === "20210018") return "SV001";
  if (trimmed.includes("ha.tt") || trimmed === "of001") return "OF001";
  if (trimmed.includes("tram.lb") || trimmed === "sv024" || trimmed === "20240019") return "SV024";
  return null;
}

function LoginForm() {
  const router = useRouter();

  const { login, dataConfig, dataStatus } = useStore();
  const isApiMode = dataConfig?.mode === "api";
  const [apiDemoAuthEnabled, setApiDemoAuthEnabled] = useState(false);
  const demoAuthEnabled = isApiMode ? apiDemoAuthEnabled : true;
  const demoAccounts = isApiMode ? API_DEMO_ACCOUNTS : MOCK_DEMO_ACCOUNTS;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [demoAccountsOpen, setDemoAccountsOpen] = useState(false);
  const closeHelpDialog = React.useCallback(() => setHelpDialogOpen(false), []);

  React.useEffect(() => {
    if (!isApiMode || !dataConfig?.apiBaseUrl) {
      return;
    }
    const controller = new AbortController();
    fetch(`${dataConfig.apiBaseUrl}/api/v1/status`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        setApiDemoAuthEnabled(Boolean(payload && payload.demo_auth_enabled));
      })
      .catch(() => setApiDemoAuthEnabled(false));
    return () => controller.abort();
  }, [isApiMode, dataConfig?.apiBaseUrl]);

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
      let user = null;
      if (isApiMode && (!demoAuthEnabled || password !== "demo1234" || !resolveApiDemoUserId(identifier))) {
        user = await login(identifier.trim(), rememberMe, password);
      } else {
        const matchedUserId = isApiMode ? resolveApiDemoUserId(identifier) : resolveMockDemoUserId(identifier);
        if (!matchedUserId) {
          setLoading(false);
          setError("Không tìm thấy tài khoản. Kiểm tra thông tin hoặc chọn tài khoản mẫu bên dưới.");
          return;
        }
        if (password !== "demo1234" && password !== "Campus247-An18") {
          setLoading(false);
          setError("Tài khoản hoặc mật khẩu không chính xác.");
          return;
        }
        user = await login(matchedUserId, rememberMe);
      }
      setLoading(false);

      if (user) {
        if (user.role === "officer") {
          router.push("/dashboard");
        } else if (user.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/student");
        }
      } else if (dataStatus === "connection_error") {
        setError("Không kết nối được máy chủ. Hãy thử lại.");
      } else {
        setError("Tài khoản hoặc mật khẩu không chính xác.");
      }
    } catch (failure) {
      setLoading(false);
      setError(
        isConnectionError(failure)
          ? "Không kết nối được máy chủ. Hãy thử lại."
          : "Có lỗi xảy ra, vui lòng thử lại."
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78716C] dark:text-[#A8A29E]">
          Đăng nhập hệ thống
        </p>
        <h2 className="font-serif text-2xl font-normal tracking-tight text-[#1C1917] dark:text-[#FAFAF9]">
          Đăng nhập tài khoản
        </h2>
      </div>

      {error && (
        <div id="login-error" role="alert" aria-live="assertive" className="p-3 rounded-none bg-[#FEF2F2] dark:bg-[rgba(127,29,29,0.35)] border border-[#FECACA] dark:border-[rgba(239,68,68,0.4)] flex items-start gap-2 text-xs text-[#B91C1C] dark:text-[#FCA5A5]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="mb-1 block text-xs font-semibold text-[#57534E] dark:text-[#D6D3D1]">
            Tài khoản
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#A8A29E] absolute left-3 top-3.5" />
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "login-error" : undefined}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="MSSV, email hoặc tên đăng nhập"
              className="w-full pl-9 pr-3 py-2.5 min-h-[44px] text-xs rounded-none bg-white dark:bg-[#141210] border border-[#D6D3D1] dark:border-[#44403C] focus:outline-none focus:ring-2 focus:ring-[#78716C] focus:border-[#78716C] text-[#1C1917] dark:text-[#FAFAF9] transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-[#57534E] dark:text-[#D6D3D1] mb-1">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#A8A29E] absolute left-3 top-3.5" />
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
              className="w-full pl-9 pr-10 py-2.5 min-h-[44px] text-xs rounded-none bg-white dark:bg-[#141210] border border-[#D6D3D1] dark:border-[#44403C] focus:outline-none focus:ring-2 focus:ring-[#78716C] focus:border-[#78716C] text-[#1C1917] dark:text-[#FAFAF9] transition-all"
            />
            <button
              type="button"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3.5 text-[#A8A29E] hover:text-[#57534E] dark:hover:text-[#FAFAF9]"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-[#57534E] dark:text-[#D6D3D1]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded-none border-[#D6D3D1] text-[#78716C] focus:ring-[#78716C]"
            />
            <span>Ghi nhớ tài khoản</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 min-h-[44px] rounded-none bg-[#78716C] hover:bg-[#57534E] disabled:opacity-50 text-[#FAFAF9] text-xs font-semibold shadow-none flex items-center justify-center gap-2 transition-all"
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

      {isApiMode && (
        <section className="rounded-none border border-[#D6D3D1] bg-[#F5F5F4] p-3 dark:border-[#44403C] dark:bg-[#1C1917]">
          <p className="text-[11px] leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">
            Tài khoản vận hành (đăng nhập mật khẩu, hồ sơ điền sẵn khi tạo đơn).
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OPERATIONAL_ACCOUNTS.map((account) => (
              <button
                key={account.identifier}
                type="button"
                onClick={() => handleFillDemo(account.identifier, account.password)}
                className="flex min-h-[58px] flex-col items-start justify-center rounded-none border border-[#D6D3D1] bg-white px-3 py-2 text-left transition-colors hover:border-[#78716C] hover:bg-[#EFEDEB] dark:border-[#44403C] dark:bg-[#141210] dark:hover:border-[#A8A29E] dark:hover:bg-[#23201D]"
              >
                <span className="text-xs font-semibold text-[#1C1917] dark:text-[#FAFAF9]">
                  Dùng tài khoản {account.label.toLowerCase()}
                </span>
                <span className="text-[11px] font-mono text-[#78716C] dark:text-[#A8A29E]">
                  {account.identifier}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="rounded-none border border-[#D6D3D1] bg-[#F5F5F4] p-3 dark:border-[#44403C] dark:bg-[#1C1917]">
        <p className="text-[11px] leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">
          Tài khoản vận hành (đăng nhập mật khẩu, hồ sơ điền sẵn khi tạo đơn).
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OPERATIONAL_ACCOUNTS.map((account) => (
            <button
              key={account.identifier}
              type="button"
              onClick={() => handleFillDemo(account.identifier, account.password)}
              className="flex min-h-[58px] flex-col items-start justify-center rounded-none border border-[#D6D3D1] bg-white px-3 py-2 text-left transition-colors hover:border-[#78716C] hover:bg-[#EFEDEB] dark:border-[#44403C] dark:bg-[#141210] dark:hover:border-[#A8A29E] dark:hover:bg-[#23201D]"
            >
              <span className="text-xs font-semibold text-[#1C1917] dark:text-[#FAFAF9]">
                Dùng tài khoản {account.label.toLowerCase()}
              </span>
              <span className="text-[11px] font-mono text-[#78716C] dark:text-[#A8A29E]">
                {account.identifier}
              </span>
            </button>
          ))}
        </div>
      </section>

      {DEMO_ACCOUNTS_ENABLED && (!isApiMode || demoAuthEnabled) && (
        <section className="rounded-none border border-[#D6D3D1] bg-[#F5F5F4] p-3 dark:border-[#44403C] dark:bg-[#1C1917]">
          <button
            type="button"
            aria-expanded={demoAccountsOpen}
            onClick={() => setDemoAccountsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left text-xs font-semibold text-[#57534E] transition-colors hover:text-[#1C1917] dark:text-[#D6D3D1] dark:hover:text-[#FAFAF9]"
          >
            <span>{demoAccountsOpen ? "Ẩn tài khoản demo" : "Tài khoản demo"}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${demoAccountsOpen ? "rotate-180" : ""}`} />
          </button>

          {demoAccountsOpen && (
            <div className="mt-3 space-y-2 border-t border-[#E7E5E4] pt-3 dark:border-[#292524]">
              <p className="text-[11px] leading-relaxed text-[#78716C] dark:text-[#A8A29E]">
                Chỉ dùng cho E2E / demo-login. Chọn một tài khoản để điền sẵn.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.identifier}
                    type="button"
                    onClick={() => handleFillDemo(account.identifier, account.password)}
                    className="flex min-h-[58px] flex-col items-start justify-center rounded-none border border-[#D6D3D1] bg-white px-3 py-2 text-left transition-colors hover:border-[#78716C] hover:bg-[#EFEDEB] dark:border-[#44403C] dark:bg-[#141210] dark:hover:border-[#A8A29E] dark:hover:bg-[#23201D]"
                  >
                    <span className="text-xs font-semibold text-[#1C1917] dark:text-[#FAFAF9]">
                      Dùng tài khoản {account.label.toLowerCase()}
                    </span>
                    <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                      Điền sẵn thông tin đăng nhập
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="pt-2 text-center border-t border-[#E7E5E4] dark:border-[#292524]">
        <button
          type="button"
          onClick={() => setHelpDialogOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-[#57534E] hover:text-[#1C1917] dark:text-[#D6D3D1] dark:hover:text-[#FAFAF9] transition-colors"
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
            className="w-full max-w-md rounded-none bg-[#FAFAF9] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] p-6 shadow-none space-y-4"
          >
            <div className="flex items-center justify-between">
              <div id="help-dialog-title" className="flex items-center gap-2 font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">
                <HelpCircle className="w-4 h-4 text-[#78716C]" />
                <span>Trợ giúp đăng nhập</span>
              </div>
              <button
                type="button"
                onClick={closeHelpDialog}
                aria-label="Đóng trợ giúp đăng nhập"
                className="p-1 rounded-none text-[#78716C] hover:text-[#1C1917] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">
              <p>Hãy sử dụng email trường hoặc mã số được cấp để đăng nhập.</p>
              <p>Nếu thông tin đăng nhập không hoạt động, hãy liên hệ Phòng Đào tạo hoặc bộ phận hỗ trợ của trường.</p>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={closeHelpDialog}
                className="px-4 py-2 rounded-none bg-[#78716C] hover:bg-[#57534E] text-[#FAFAF9] text-xs font-semibold"
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
