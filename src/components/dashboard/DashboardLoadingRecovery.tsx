"use client";

import { useEffect } from "react";

/**
 * If a soft-nav / RSC race leaves the dashboard on loading.tsx forever,
 * force a full document reload once (manual refresh workaround, automated).
 */
export default function DashboardLoadingRecovery({ timeoutMs = 8000 }: { timeoutMs?: number }) {
  useEffect(() => {
    const key = "ar360_dashboard_loading_recovery";
    const timer = window.setTimeout(() => {
      try {
        const last = Number(sessionStorage.getItem(key) || "0");
        const now = Date.now();
        // Avoid reload loops — at most once per 30s.
        if (now - last < 30_000) return;
        sessionStorage.setItem(key, String(now));
      } catch {
        // sessionStorage unavailable — still attempt one reload.
      }
      window.location.reload();
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [timeoutMs]);

  return null;
}
