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
          <h1 className="font-serif text-2xl font-normal text-[#1C1917] dark:text-[#FAFAF9]">Quản trị tài khoản</h1>
          <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">
            Tài khoản quản trị không xử lý hồ sơ học vụ. Cấp mật khẩu, import sinh viên và ingest tài liệu bằng CLI
            campus247-admin trên máy chủ.
          </p>
        </header>
        <section className="rounded-none border border-[#E7E5E4] bg-[#F5F5F4] p-6 dark:border-[#292524] dark:bg-[#1C1917]">
          <h2 className="font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">Đổi mật khẩu</h2>
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <label className="block text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
              Mật khẩu hiện tại
              <input
                type="password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                className="mt-1 w-full rounded-none border border-[#E7E5E4] bg-[#FAFAF9] px-3 py-2 text-sm text-[#1C1917] focus:border-[#78716C] focus:outline-none dark:border-[#292524] dark:bg-[#141210] dark:text-[#FAFAF9] dark:focus:border-[#A8A29E]"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="block text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
              Mật khẩu mới (tối thiểu 10 ký tự)
              <input
                type="password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                className="mt-1 w-full rounded-none border border-[#E7E5E4] bg-[#FAFAF9] px-3 py-2 text-sm text-[#1C1917] focus:border-[#78716C] focus:outline-none dark:border-[#292524] dark:bg-[#141210] dark:text-[#FAFAF9] dark:focus:border-[#A8A29E]"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
            {error && <p className="text-sm text-[#B91C1C] dark:text-[#EF4444]">{error}</p>}
            {message && <p className="text-sm text-[#3F6212] dark:text-[#84CC16]">{message}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-none bg-[#78716C] px-5 py-2.5 text-sm font-medium text-[#FAFAF9] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:text-[#1C1917] dark:hover:bg-[#D6D3D1] disabled:opacity-60 transition-colors"
            >
              Lưu mật khẩu
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
