import { type NextRequest } from "next/server";

const PRODUCTION_APP_URL = "https://ar360studio.com";

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]"
  );
}

function looksLikeLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackHost(new URL(value).hostname);
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]/i.test(value);
  }
}

function normalizeConfiguredAppUrl(raw: string): string {
  let url = raw.trim().replace(/\/$/, "");
  if (!url) return PRODUCTION_APP_URL;

  // Production emails/CTA links must never point at a developer machine.
  if (looksLikeLoopbackUrl(url) && process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_URL;
  }

  if (url.includes("ar360studio.com")) {
    url = url.replace(/:3000(?=\/|$)/, "").replace(/:3000$/, "");
    url = url.replace(/^http:/i, "https:");
  }

  return url.replace(/\/$/, "");
}

/**
 * Returns the configured base application URL from environment variables.
 * Defaults to the production URL. Rejects localhost in production so
 * lifecycle emails never ship `http://localhost:3000/...` CTAs.
 */
export function getAppUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    PRODUCTION_APP_URL;
  return normalizeConfiguredAppUrl(raw);
}

/**
 * Constructs a fully qualified absolute URL using the production base URL.
 */
export function absoluteUrl(path: string): string {
  const base = getAppUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Sanitizes an origin string, ensuring it conforms to production requirements:
 * 1. Force HTTPS on ar360studio.com.
 * 2. Strip port :3000 from ar360studio.com in all contexts.
 * 3. Never expose localhost/127.0.0.1/0.0.0.0 in a production environment.
 */
export function sanitizeOrigin(origin: string): string {
  if (!origin) return getAppUrl();

  let clean = origin.trim().replace(/\/$/, "");

  // Strip :3000 and force HTTPS if it points to the production domain
  if (clean.includes("ar360studio.com")) {
    clean = clean.replace(/:3000$/, "").replace(/:3000(?=\/|$)/, "");
    clean = clean.replace(/^http:/i, "https:");
  }

  // In production, prevent leak of internal loopback addresses
  const isProd =
    process.env.NODE_ENV === "production" ||
    (process.env.NEXT_PUBLIC_APP_URL &&
      process.env.NEXT_PUBLIC_APP_URL.includes("ar360studio.com")) ||
    (process.env.APP_URL && process.env.APP_URL.includes("ar360studio.com"));

  if (isProd) {
    if (looksLikeLoopbackUrl(clean)) {
      if (
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1")
      ) {
        return clean;
      }
      return PRODUCTION_APP_URL;
    }
  }

  return clean;
}

/**
 * Extracts and sanitizes the request origin from Request, NextRequest, Headers, or window.
 */
export function getCleanOrigin(source?: Request | NextRequest | Headers | null): string {
  if (typeof window !== "undefined") {
    return sanitizeOrigin(window.location.origin);
  }

  const defaultUrl = getAppUrl();
  if (!source) return sanitizeOrigin(defaultUrl);

  let rawOrigin = "";

  if (source instanceof Headers) {
    const proto = source.get("x-forwarded-proto") || "https";
    const host = source.get("x-forwarded-host") || source.get("host");
    if (host) {
      rawOrigin = `${proto}://${host}`;
    }
  } else if ("headers" in source && typeof source.headers?.get === "function") {
    const proto = source.headers.get("x-forwarded-proto") || "https";
    const host = source.headers.get("x-forwarded-host") || source.headers.get("host");
    if (host) {
      rawOrigin = `${proto}://${host}`;
    }
  } else if ("nextUrl" in source && source.nextUrl?.origin) {
    rawOrigin = source.nextUrl.origin;
  }

  return sanitizeOrigin(rawOrigin || defaultUrl);
}

/**
 * Sanitizes any URL string to prevent port 3000 leaks and local IP leaks in production.
 */
export function sanitizeUrl(urlStr: string): string {
  if (!urlStr) return "";
  try {
    const url = new URL(urlStr);
    const sanitizedHost = sanitizeOrigin(url.origin);
    const path = url.pathname + url.search + url.hash;
    return sanitizedHost.endsWith("/") || path.startsWith("/")
      ? `${sanitizedHost}${path}`
      : `${sanitizedHost}/${path}`;
  } catch {
    // If it's a relative URL or cannot be parsed, return as is
    return urlStr;
  }
}
