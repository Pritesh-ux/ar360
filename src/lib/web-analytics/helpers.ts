import type { WebPresenceStatus } from "./types";

export const SITE_VISITOR_COOKIE = "ar360_vid";
export const SITE_SESSION_STORAGE_KEY = "ar360_web_session";

export function webAnalyticsLiveSec(): number {
  const n = Number(process.env.WEB_ANALYTICS_LIVE_SEC || 30);
  return Number.isFinite(n) && n >= 5 ? Math.min(n, 300) : 30;
}

export function webAnalyticsIdleSec(): number {
  const live = webAnalyticsLiveSec();
  const n = Number(process.env.WEB_ANALYTICS_IDLE_SEC || 120);
  const idle = Number.isFinite(n) && n > live ? n : Math.max(live + 30, 120);
  return Math.min(idle, 600);
}

export function presenceStatus(lastActivityAt: Date | string | null | undefined, now = new Date()): WebPresenceStatus {
  if (!lastActivityAt) return "offline";
  const ts = lastActivityAt instanceof Date ? lastActivityAt.getTime() : new Date(lastActivityAt).getTime();
  if (!Number.isFinite(ts)) return "offline";
  const ageSec = (now.getTime() - ts) / 1000;
  if (ageSec <= webAnalyticsLiveSec()) return "live";
  if (ageSec <= webAnalyticsIdleSec()) return "idle";
  return "offline";
}

export function visitorLabel(visitorId: string): string {
  const clean = String(visitorId || "").replace(/[^a-zA-Z0-9]/g, "");
  const short = (clean.slice(0, 4) || "0000").toUpperCase();
  return `Visitor #${short}`;
}

/** Strip secrets from paths/URLs; keep pathname only. */
export function sanitizePath(input: unknown, max = 512): string {
  const raw = String(input || "").trim();
  if (!raw) return "/";
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      return (u.pathname || "/").slice(0, max) || "/";
    }
  } catch {
    // fall through
  }
  const pathOnly = raw.split("?")[0].split("#")[0];
  const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return normalized.slice(0, max) || "/";
}

export function sanitizeText(input: unknown, max = 255): string {
  return String(input || "").trim().slice(0, max);
}

export function parseUtm(urlOrPath: string): {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
} {
  const empty = { utmSource: "", utmMedium: "", utmCampaign: "", utmTerm: "", utmContent: "" };
  try {
    const base = urlOrPath.startsWith("http") ? urlOrPath : `https://example.local${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;
    const u = new URL(base);
    return {
      utmSource: sanitizeText(u.searchParams.get("utm_source") || "", 120),
      utmMedium: sanitizeText(u.searchParams.get("utm_medium") || "", 120),
      utmCampaign: sanitizeText(u.searchParams.get("utm_campaign") || "", 160),
      utmTerm: sanitizeText(u.searchParams.get("utm_term") || "", 160),
      utmContent: sanitizeText(u.searchParams.get("utm_content") || "", 160),
    };
  } catch {
    return empty;
  }
}

export function isMasterAdminPath(path: string): boolean {
  return sanitizePath(path).startsWith("/master-admin");
}

const ALLOWED_SITE_EVENTS = new Set([
  "session_start",
  "page_view",
  "page_leave",
  "heartbeat",
  "session_end",
  "login",
  "logout",
  "signup",
  "pricing_view",
  "contact_click",
  "demo_request",
]);

export function allowSiteEvent(name: unknown): string | null {
  const e = String(name || "").trim().toLowerCase();
  return ALLOWED_SITE_EVENTS.has(e) ? e : null;
}

export function todayBounds(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const day = `${y}-${m}-${d}`;
  return { from: `${day} 00:00:00`, to: `${day} 23:59:59`, day };
}
