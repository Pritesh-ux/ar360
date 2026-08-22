"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SITE_SESSION_STORAGE_KEY, SITE_VISITOR_COOKIE } from "@/lib/web-analytics/helpers";

const HEARTBEAT_MS = 20_000;

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function writeVisitorCookie(id: string) {
  const maxAge = 60 * 60 * 24 * 365;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SITE_VISITOR_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function ensureVisitorId() {
  let id = readCookie(SITE_VISITOR_COOKIE);
  if (!id || id.length < 8) {
    id = uuid().slice(0, 32);
    writeVisitorCookie(id);
  }
  return id;
}

function ensureSessionId() {
  try {
    let id = sessionStorage.getItem(SITE_SESSION_STORAGE_KEY) || "";
    if (!id) {
      id = `s${uuid().slice(0, 24)}`;
      sessionStorage.setItem(SITE_SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `s${uuid().slice(0, 24)}`;
  }
}

function utmFromLocation() {
  try {
    const u = new URL(window.location.href);
    return {
      utmSource: u.searchParams.get("utm_source") || "",
      utmMedium: u.searchParams.get("utm_medium") || "",
      utmCampaign: u.searchParams.get("utm_campaign") || "",
      utmTerm: u.searchParams.get("utm_term") || "",
      utmContent: u.searchParams.get("utm_content") || "",
    };
  } catch {
    return {};
  }
}

async function postJson(url: string, body: Record<string, unknown>, keepalive = false) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    // Analytics must never break the site.
  }
}

function basePayload(path: string) {
  return {
    visitorId: ensureVisitorId(),
    sessionId: ensureSessionId(),
    path,
    pageTitle: typeof document !== "undefined" ? document.title : "",
    referrer: typeof document !== "undefined" ? document.referrer : "",
    language: typeof navigator !== "undefined" ? navigator.language : "",
    screenWidth: typeof window !== "undefined" ? window.screen?.width || 0 : 0,
    screenHeight: typeof window !== "undefined" ? window.screen?.height || 0 : 0,
    ...utmFromLocation(),
  };
}

export default function WebPresenceTracker() {
  const pathname = usePathname() || "/";
  const pageStartedAt = useRef<number>(Date.now());
  const sessionStarted = useRef(false);
  const lastPath = useRef("");

  useEffect(() => {
    if (pathname.startsWith("/master-admin")) return;

    const pathWithQuery =
      typeof window !== "undefined"
        ? `${pathname}${window.location.search || ""}`
        : pathname;

    const run = async () => {
      const payload = basePayload(pathWithQuery);
      if (!sessionStarted.current) {
        sessionStarted.current = true;
        await postJson("/api/web-analytics/session", payload);
      }

      if (lastPath.current && lastPath.current !== pathWithQuery) {
        const durationSeconds = Math.max(0, Math.round((Date.now() - pageStartedAt.current) / 1000));
        await postJson(
          "/api/web-analytics/session/end",
          { ...basePayload(lastPath.current), durationSeconds, event: "page_leave" },
          true,
        );
      }

      pageStartedAt.current = Date.now();
      lastPath.current = pathWithQuery;
      await postJson("/api/web-analytics/page-view", payload);
    };

    void run();

    const beat = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (pathname.startsWith("/master-admin")) return;
      void postJson("/api/web-analytics/heartbeat", basePayload(lastPath.current || pathWithQuery));
    }, HEARTBEAT_MS);

    const onHide = () => {
      if (!lastPath.current) return;
      const durationSeconds = Math.max(0, Math.round((Date.now() - pageStartedAt.current) / 1000));
      if (document.visibilityState === "hidden") {
        void postJson(
          "/api/web-analytics/session/end",
          {
            ...basePayload(lastPath.current),
            durationSeconds,
            event: "page_leave",
          },
          true,
        );
      }
    };

    const onUnload = () => {
      if (!lastPath.current) return;
      const durationSeconds = Math.max(0, Math.round((Date.now() - pageStartedAt.current) / 1000));
      void postJson(
        "/api/web-analytics/session/end",
        {
          ...basePayload(lastPath.current),
          durationSeconds,
          event: "session_end",
        },
        true,
      );
    };

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onUnload);

    return () => {
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [pathname]);

  return null;
}
