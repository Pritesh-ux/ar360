"use client";

import Link from "next/link";

export default function EnterpriseDashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-[22px] border border-red-200 bg-white px-6 py-14 text-center">
      <h1 className="text-xl font-bold text-[#171717]">Enterprise dashboard unavailable</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#737373]">
        We could not load your contract details. Try again or contact support if this continues.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="h-10 rounded-2xl bg-[#84D400] px-5 text-sm font-bold text-[#172000]"
        >
          Try again
        </button>
        <Link
          href="/dashboard/support"
          className="inline-flex h-10 items-center rounded-2xl border border-[#E4E4E4] px-5 text-sm font-semibold"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
