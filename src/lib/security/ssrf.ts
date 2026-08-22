import { lookup as dnsLookup } from "dns/promises";
import { isIP } from "net";

/**
 * Reject outbound URLs that could hit internal networks (SSRF).
 * Used by webhooks, processors, and QR logo remote loads.
 * HTTPS required in production; http allowed in development only.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "metadata",
  "instance-data",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

/** Max image bytes accepted for QR logo remote fetch / data URLs. */
export const SAFE_IMAGE_MAX_BYTES = 1_500_000;

const DEFAULT_FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_REDIRECTS = 3;

export const SAFE_IMAGE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export type DnsLookupFn = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

export type FetchFn = typeof fetch;

/**
 * True for loopback, RFC1918, link-local, CGNAT, ULA, and other non-public targets.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "").replace(/^::ffff:/, "");

  if (v === "::1" || v === "::" || v === "0.0.0.0") return true;

  if (isIP(v) === 4) {
    const parts = v.split(".").map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  if (isIP(v) === 6) {
    if (v === "::1") return true;
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // ULA fc00::/7
    if (/^fe[89ab]/i.test(v)) return true; // link-local fe80::/10
    if (v.startsWith("ff")) return true; // multicast
    return false;
  }

  return true;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    return true;
  }
  if (host.endsWith(".metadata.google.internal")) return true;
  return false;
}

export type SafeUrlResult = { ok: true; href: string } | { ok: false; error: string };

export type AssertSafeOutboundUrlOptions = {
  /** Injected for tests (DNS rebinding / private resolution). */
  lookupFn?: DnsLookupFn;
};

export async function assertSafeOutboundUrl(
  rawUrl: string,
  options?: AssertSafeOutboundUrlOptions,
): Promise<SafeUrlResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  const isProd = process.env.NODE_ENV === "production";
  if (parsed.protocol === "https:") {
    // ok
  } else if (parsed.protocol === "http:" && !isProd) {
    // local/dev only
  } else if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return { ok: false, error: "Webhook URL must use HTTPS." };
  } else {
    return { ok: false, error: "URL scheme is not allowed." };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "Webhook URL must not include credentials." };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isBlockedHostname(hostname)) {
    return { ok: false, error: "Webhook URL host is not allowed." };
  }

  // Literal IP in hostname
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { ok: false, error: "Webhook URL must not target a private or reserved address." };
    }
    return { ok: true, href: parsed.href };
  }

  const lookupFn = options?.lookupFn ?? (dnsLookup as DnsLookupFn);
  let addresses: string[] = [];
  try {
    const records = await lookupFn(hostname, { all: true, verbatim: true });
    addresses = records.map((r) => r.address);
  } catch {
    return { ok: false, error: "Webhook URL host could not be resolved." };
  }

  if (!addresses.length) {
    return { ok: false, error: "Webhook URL host could not be resolved." };
  }

  for (const addr of addresses) {
    if (isPrivateOrReservedIp(addr)) {
      return { ok: false, error: "Webhook URL must not resolve to a private or reserved address." };
    }
  }

  return { ok: true, href: parsed.href };
}

function normalizeContentType(value: string | null): string {
  if (!value) return "";
  return value.split(";")[0]!.trim().toLowerCase();
}

export function isAllowedImageContentType(contentType: string | null): boolean {
  return SAFE_IMAGE_CONTENT_TYPES.has(normalizeContentType(contentType));
}

/** Magic-byte sniff for QR logo images (fail closed when type header is missing/wrong). */
export function bufferLooksLikeAllowedImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // GIF
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return true;
  // WEBP (RIFF....WEBP)
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  return false;
}

export type FetchSafeImageOptions = {
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  lookupFn?: DnsLookupFn;
  fetchFn?: FetchFn;
};

export type FetchSafeImageResult =
  | { ok: true; buffer: Buffer; contentType: string; finalUrl: string }
  | { ok: false; error: string };

/**
 * Fetch an image URL with SSRF controls: scheme, host/DNS, private IP,
 * manual redirects (re-validated each hop), timeout, and size cap.
 */
export async function fetchSafeOutboundImage(
  rawUrl: string,
  options?: FetchSafeImageOptions,
): Promise<FetchSafeImageResult> {
  const maxBytes = options?.maxBytes ?? SAFE_IMAGE_MAX_BYTES;
  const maxRedirects = options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const fetchFn = options?.fetchFn ?? fetch;

  let current = rawUrl.trim();
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const safe = await assertSafeOutboundUrl(current, { lookupFn: options?.lookupFn });
    if (safe.ok === false) {
      return { ok: false, error: "Logo URL is not allowed." };
    }

    let response: Response;
    try {
      response = await fetchFn(safe.href, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "image/png,image/jpeg,image/webp,image/gif" },
      });
    } catch {
      return { ok: false, error: "Logo could not be loaded." };
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, error: "Logo could not be loaded." };
      let next: URL;
      try {
        next = new URL(location, safe.href);
      } catch {
        return { ok: false, error: "Logo could not be loaded." };
      }
      current = next.href;
      continue;
    }

    if (!response.ok) {
      return { ok: false, error: "Logo could not be loaded." };
    }

    const contentType = normalizeContentType(response.headers.get("content-type"));
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return { ok: false, error: "Logo image is too large." };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback when body stream is unavailable
      const ab = await response.arrayBuffer();
      if (ab.byteLength > maxBytes) {
        return { ok: false, error: "Logo image is too large." };
      }
      const buffer = Buffer.from(ab);
      if (!isAllowedImageContentType(contentType) && !bufferLooksLikeAllowedImage(buffer)) {
        return { ok: false, error: "Unsupported logo image type." };
      }
      if (!bufferLooksLikeAllowedImage(buffer)) {
        return { ok: false, error: "Unsupported logo image type." };
      }
      return { ok: true, buffer, contentType: contentType || "application/octet-stream", finalUrl: safe.href };
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        return { ok: false, error: "Logo image is too large." };
      }
      chunks.push(Buffer.from(value));
    }
    const buffer = Buffer.concat(chunks);
    if (!bufferLooksLikeAllowedImage(buffer)) {
      return { ok: false, error: "Unsupported logo image type." };
    }
    if (contentType && !isAllowedImageContentType(contentType) && !bufferLooksLikeAllowedImage(buffer)) {
      return { ok: false, error: "Unsupported logo image type." };
    }
    return {
      ok: true,
      buffer,
      contentType: contentType || "application/octet-stream",
      finalUrl: safe.href,
    };
  }

  return { ok: false, error: "Logo could not be loaded." };
}
