"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRightLeft, LogOut } from "lucide-react";

export default function EmailActionMismatchCard(props: {
  token: string;
  currentEmail: string;
  requestedEmail: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"switch" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchAccount() {
    setBusy("switch");
    setError(null);
    try {
      const response = await fetch("/api/auth/email-action/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        redirectTo?: string;
        error?: string;
        needsLogin?: boolean;
        loginUrl?: string;
      };
      if (data.needsLogin && data.loginUrl) {
        window.location.href = data.loginUrl;
        return;
      }
      if (!response.ok || !data.ok || !data.redirectTo) {
        setError(data.error || "Could not switch accounts.");
        setBusy(null);
        return;
      }
      window.location.href = data.redirectTo;
    } catch {
      setError("Could not switch accounts. Try again.");
      setBusy(null);
    }
  }

  function cancel() {
    setBusy("cancel");
    router.push("/dashboard");
  }

  return (
    <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
        <AlertTriangle size={28} />
      </div>
      <h1 className="mt-5 text-center text-2xl font-black tracking-tight text-slate-950">
        This link belongs to another account
      </h1>
      <p className="mt-3 text-center text-sm font-medium leading-relaxed text-slate-500">
        For security, we will not open the requested page while a different account is signed in.
      </p>

      <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Current account</p>
          <p className="mt-1 break-all font-semibold text-slate-900">{props.currentEmail}</p>
        </div>
        <div className="border-t border-slate-200 pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Requested account</p>
          <p className="mt-1 break-all font-semibold text-slate-900">{props.requestedEmail}</p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void switchAccount()}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#111827] px-5 text-sm font-bold text-white transition hover:bg-black disabled:opacity-60"
        >
          <ArrowRightLeft size={16} />
          {busy === "switch" ? "Switching…" : "Switch Account"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={cancel}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <LogOut size={16} />
          Cancel
        </button>
      </div>
    </div>
  );
}
