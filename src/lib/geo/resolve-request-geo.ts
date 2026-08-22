import { extractIp } from "@/server/analytics/analytics.middleware";

export type RequestGeo = {
  country: string;
  region: string;
  city: string;
};

const EMPTY: RequestGeo = { country: "", region: "", city: "" };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 4000;
const LOOKUP_TIMEOUT_MS = 1800;

type CacheEntry = { at: number; geo: RequestGeo };
const ipGeoCache = new Map<string, CacheEntry>();

function sanitize(value: string | null | undefined, max: number): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function isPrivateOrLocalIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (!v || v === "unknown" || v === "::1" || v === "localhost") return true;
  if (v.startsWith("127.") || v.startsWith("10.") || v.startsWith("192.168.") || v.startsWith("169.254.")) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:")) return true;
  // Strip IPv4-mapped IPv6
  if (v.startsWith("::ffff:")) return isPrivateOrLocalIp(v.slice(7));
  return false;
}

function countryDisplayName(iso2: string): string {
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return iso2.trim();
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function normalizeGeo(input: Partial<RequestGeo>): RequestGeo {
  let country = sanitize(input.country, 80);
  if (/^[A-Za-z]{2}$/.test(country)) country = countryDisplayName(country);
  return {
    country,
    region: sanitize(input.region, 120),
    city: sanitize(input.city, 120),
  };
}

function hasUsefulCity(geo: RequestGeo | null | undefined): boolean {
  return Boolean(geo?.city);
}

function mergeGeo(primary: RequestGeo | null, secondary: RequestGeo | null): RequestGeo {
  const a = primary || EMPTY;
  const b = secondary || EMPTY;
  return normalizeGeo({
    country: a.country || b.country,
    region: a.region || b.region,
    city: a.city || b.city,
  });
}

function cacheGet(ip: string): RequestGeo | null {
  const hit = ipGeoCache.get(ip);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    ipGeoCache.delete(ip);
    return null;
  }
  return hit.geo;
}

function cacheSet(ip: string, geo: RequestGeo) {
  if (ipGeoCache.size >= CACHE_MAX) {
    const oldest = ipGeoCache.keys().next().value;
    if (oldest) ipGeoCache.delete(oldest);
  }
  ipGeoCache.set(ip, { at: Date.now(), geo });
}

function geoFromCdnHeaders(request: Request): RequestGeo | null {
  const country = sanitize(
    request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry"),
    80,
  );
  const region = sanitize(
    request.headers.get("x-vercel-ip-country-region") ??
      request.headers.get("cf-region") ??
      request.headers.get("cf-region-code"),
    120,
  );
  const city = sanitize(
    request.headers.get("x-vercel-ip-city") ?? request.headers.get("cf-ipcity"),
    120,
  );
  if (!country && !city && !region) return null;
  return normalizeGeo({ country, region, city });
}

function geoFromOfflineDb(ip: string): RequestGeo | null {
  if (isPrivateOrLocalIp(ip)) return null;
  try {
    // Keep offline DB outside the Next bundle (see serverExternalPackages).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const geoip = require("geoip-lite") as typeof import("geoip-lite");
    const hit = geoip.lookup(ip);
    if (!hit) return null;
    return normalizeGeo({
      country: hit.country || "",
      region: hit.region || "",
      city: hit.city || "",
    });
  } catch {
    return null;
  }
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function geoFromOnlineApis(ip: string): Promise<RequestGeo | null> {
  if (isPrivateOrLocalIp(ip)) return null;

  const cached = cacheGet(ip);
  if (cached) return cached;

  // Prefer HTTPS providers; free tier is enough for session-start enrichment.
  const who = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
  if (who && who.success !== false) {
    const geo = normalizeGeo({
      country: String(who.country || ""),
      region: String(who.region || who.regionName || ""),
      city: String(who.city || ""),
    });
    if (geo.country || geo.city) {
      cacheSet(ip, geo);
      return geo;
    }
  }

  const api = await fetchJson(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
  );
  if (api && api.status === "success") {
    const geo = normalizeGeo({
      country: String(api.country || ""),
      region: String(api.regionName || ""),
      city: String(api.city || ""),
    });
    if (geo.country || geo.city) {
      cacheSet(ip, geo);
      return geo;
    }
  }

  return null;
}

/** Sync path: CDN headers + offline IP DB (may miss city on mobile carrier IPs). */
export function resolveRequestGeo(request: Request): RequestGeo {
  const fromHeaders = geoFromCdnHeaders(request);
  if (hasUsefulCity(fromHeaders)) return fromHeaders!;

  const ip = extractIp(request);
  const fromOffline = geoFromOfflineDb(ip);
  return mergeGeo(fromHeaders, fromOffline);
}

/**
 * Async path: if city is still missing after offline lookup, enrich via online geo APIs.
 * Raw IP is never persisted — only country/region/city labels.
 */
export async function resolveRequestGeoDetailed(request: Request): Promise<RequestGeo> {
  const base = resolveRequestGeo(request);
  if (hasUsefulCity(base)) return base;

  const ip = extractIp(request);
  const online = await geoFromOnlineApis(ip);
  return mergeGeo(base, online);
}
