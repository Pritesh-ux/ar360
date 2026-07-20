"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ProductionError({
  title = "Something went wrong",
  message = "The page could not be loaded. Please try again.",
  reset,
}: {
  title?: string;
  message?: string;
  reset?: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7fafc] p-6 text-slate-950">
      <div className="max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-50 text-amber-500">
          <AlertTriangle size={34} />
        </div>
        <h1 className="mt-5 text-3xl font-black">{title}</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">{message}</p>
        <div className="mt-6 flex justify-center gap-3">
          {reset && (
            <button
              onClick={reset}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#00B2CA] px-5 text-sm font-black text-white"
            >
              <RefreshCw size={16} /> Retry
            </button>
          )}
          <Link href="/dashboard" className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-100 px-5 text-sm font-black text-slate-900">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
