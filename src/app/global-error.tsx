"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/internal/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        source: "global-error",
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-black">Something went wrong</h1>
          <p className="text-sm text-slate-300">Our team has been notified. Please try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-lime-400 px-5 py-3 text-sm font-black text-slate-950"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
