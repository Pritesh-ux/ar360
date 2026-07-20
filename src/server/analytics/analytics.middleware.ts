import type { BrowserName, DeviceType, OSName } from "./analytics.types";
import { createHash } from "crypto";

// ─── IP hashing ───────────────────────────────────────────────────────────────

export function hashIp(ip: string): string {
  // One-way SHA-256 hash — never store raw IP
  return createHash("sha256").update(ip + (process.env.AUTH_SECRET ?? "ar360")).digest("hex").slice(0, 32);
}

export function extractIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// ─── User-Agent parsing ───────────────────────────────────────────────────────

export function parseDevice(ua: string): DeviceType {
  const u = ua.toLowerCase();
  if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(u)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(u)) return "mobile";
  if (/windows|macintosh|linux|cros/i.test(u)) return "desktop";
  return "unknown";
}

export function parseBrowser(ua: string): BrowserName {
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Firefox/i.test(ua)) return "Firefox";
  // Chrome must come before Safari
  if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  return "unknown";
}

export function parseOS(ua: string): OSName {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "unknown";
}

// ─── Referrer classification ──────────────────────────────────────────────────

const SOCIAL_DOMAINS = ["facebook", "twitter", "instagram", "tiktok", "linkedin", "pinterest", "youtube", "snapchat", "reddit", "whatsapp"];

export function classifyReferrer(referrer: string, url: string): string {
  if (!referrer || referrer === "") {
    // Check if URL has UTM source
    try {
      const u = new URL(url);
      const utmSource = u.searchParams.get("utm_source");
      if (utmSource) return utmSource.toLowerCase();
      const ref = u.searchParams.get("ref");
      if (ref === "qr") return "qr";
    } catch {
      // ignore
    }
    return "direct";
  }

  try {
    const refHost = new URL(referrer).hostname.toLowerCase();
    if (SOCIAL_DOMAINS.some((s) => refHost.includes(s))) return "social";
    if (refHost.includes("google") || refHost.includes("bing") || refHost.includes("yahoo")) return "search";
    return refHost;
  } catch {
    return "direct";
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildDateRange(from?: string, to?: string): { fromDate: string; toDate: string } {
  const now = new Date();
  const toDate = to ?? toDateString(now);
  const fromDate = from ?? toDateString(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
  return { fromDate, toDate };
}
