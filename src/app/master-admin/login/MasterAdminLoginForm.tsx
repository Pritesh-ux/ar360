"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CSRF_HEADER_NAME, ensureBrowserCsrfToken } from "@/lib/csrf-client";

export default function MasterAdminLoginForm({
  initialError,
  initialEmail,
}: {
  initialError?: string;
  initialEmail?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState(initialError || "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const csrf = await ensureBrowserCsrfToken();
      const headers = new Headers();
      if (csrf) headers.set(CSRF_HEADER_NAME, csrf);

      const response = await fetch("/api/master-admin/auth/login", {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectUrl?: string;
      };

      if (!response.ok) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }

      // Full navigation so the new session cookie is used on the next document request.
      window.location.href = data.redirectUrl || "/master-admin";
    } catch {
      setError("Login failed. Please try again.");
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <>
      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="ma-email" className="mb-1.5 block text-[13px] font-semibold text-slate-600">Email</label>
          <input
            id="ma-email"
            name="email"
            type="email"
            placeholder="admin@ar360.in"
            required
            autoComplete="username"
            defaultValue={initialEmail || ""}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <div>
          <label htmlFor="ma-password" className="mb-1.5 block text-[13px] font-semibold text-slate-600">Password</label>
          <input
            id="ma-password"
            name="password"
            type="password"
            placeholder="Enter password"
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--color-primary)] py-3 font-black text-[var(--color-text)] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Login as Admin"}
        </button>
      </form>

      <Link href="/login" className="mt-6 block text-sm font-bold text-slate-500">
        Customer login
      </Link>
    </>
  );
}
