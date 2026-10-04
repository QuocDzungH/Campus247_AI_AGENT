"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { useStore } from "@/lib/store";

export default function AdminPage() {
  const { currentUser, changePassword } = useStore();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!currentUser) return <DataAccessState />;
  if (currentUser.role !== "admin") return <DataAccessState requiredRole="admin" />;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setMessage("Đã đổi mật khẩu. Các phiên khác đã bị thu hồi.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không đổi được mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar />
      <main className="mx-auto max-w-2xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quản trị tài khoản</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tài khoản quản trị không xử lý hồ sơ học vụ. Cấp mật khẩu, import sinh viên và ingest tài liệu bằng CLI
            campus247-admin trên máy chủ.
          </p>
        </header>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">Đổi mật khẩu</h2>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <label className="block text-xs">
              Mật khẩu hiện tại
              <input
                type="password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="block text-xs">
              Mật khẩu mới (tối thiểu 10 ký tự)
              <input
                type="password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {message && <p className="text-sm text-emerald-600">{message}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Lưu mật khẩu
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
