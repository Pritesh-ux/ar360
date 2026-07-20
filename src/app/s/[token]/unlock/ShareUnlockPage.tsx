"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";

export default function ShareUnlockPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = String(params.token || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const next = new URL(`/s/${encodeURIComponent(token)}`, window.location.origin);
      next.searchParams.set("p", password);
      if (searchParams.get("redirect")) next.searchParams.set("redirect", searchParams.get("redirect")!);
      router.replace(next.toString());
    } catch {
      setError("Unable to unlock link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--ar-surface-soft)] p-6">
      <form
        onSubmit={unlock}
        className="w-full max-w-md rounded-2xl border border-[var(--ar-border)] bg-white p-8 shadow-[var(--ar-shadow-sm)]"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--ar-primary-soft)] text-[var(--ar-text)]">
          <Lock size={24} />
        </div>
        <h1 className="mt-4 text-center text-xl font-black text-[var(--ar-text)]">Password protected link</h1>
        <p className="mt-2 text-center text-sm font-medium text-[var(--ar-text-muted)]">
          Enter the password to open this shared 3D experience.
        </p>
        <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-[var(--ar-text-muted)]">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-[var(--ar-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--ar-primary-border)]"
            autoFocus
          />
        </label>
        {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
        <UserButton type="submit" loading={loading} className="mt-5 w-full">
          Unlock viewer
        </UserButton>
      </form>
    </main>
  );
}
