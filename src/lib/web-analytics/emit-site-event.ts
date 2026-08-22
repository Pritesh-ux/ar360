"use client";

import { SITE_SESSION_STORAGE_KEY, SITE_VISITOR_COOKIE } from "@/lib/web-analytics/helpers";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Light-touch business event for site analytics (login/signup).
 * Silent no-op if tracker cookies missing or request fails.
 */
export function emitSiteBusinessEvent(eventType: "login" | "signup"): void {
  try {
    if (typeof window === "undefined") return;
    const visitorId = readCookie(SITE_VISITOR_COOKIE);
    const sessionId = sessionStorage.getItem(SITE_SESSION_STORAGE_KEY);
    if (!visitorId || !sessionId) return;

    void fetch("/api/web-analytics/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId,
        sessionId,
        path: window.location.pathname || "/",
        pageTitle: document.title || "",
        event: eventType,
      }),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}
