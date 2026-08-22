"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";

/** Non-invasive platform update indicator. Never blocks the dashboard. */
export default function PlatformUpdateBanner() {
  const [banner, setBanner] = useState<{
    show: boolean;
    message: string;
    releaseId: number | null;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/platform-status", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return;
      if (json.banner?.show) {
        setBanner({
          show: true,
          message: String(json.banner.message || "Platform Update Available"),
          releaseId: json.banner.releaseId != null ? Number(json.banner.releaseId) : null,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function dismiss() {
    if (!banner?.releaseId) {
      setBanner(null);
      return;
    }
    await fetch(`/api/account/platform/releases/${banner.releaseId}/view`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: true }),
    }).catch(() => undefined);
    setBanner(null);
  }

  if (!banner?.show) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-[13px]">
      <div className="font-semibold text-[#1E40AF]">{banner.message}</div>
      <div className="flex items-center gap-2">
        <Link
          href={
            banner.releaseId
              ? `/dashboard/platform/releases/${banner.releaseId}`
              : "/dashboard/platform"
          }
          className="rounded-xl bg-white px-3 py-1.5 font-semibold text-[#1E40AF] hover:bg-[#DBEAFE]"
        >
          Review
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded-lg p-1.5 text-[#1E40AF] hover:bg-white"
          onClick={() => void dismiss()}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
