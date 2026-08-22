import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Reject webhook / outbound callback URLs that could hit internal networks (SSRF).
 * HTTPS required in production; http://localhost allowed in development only.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

function isPrivateOrReservedIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");

  if (v === "::1" || v === "0.0.0.0") return true;

  if (isIP(v) === 4) {
    const parts = v.split(".").map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  if (isIP(v) === 6) {
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // ULA
    if (v.startsWith("fe80")) return true; // link-local
    if (v === "::" || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.")) return true;
    return false;
  }

  return true;
}

export type SafeUrlResult = { ok: true; href: string } | { ok: false; error: string };

export async function assertSafeOutboundUrl(rawUrl: string): Promise<SafeUrlResult> {
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
  } else {
    return { ok: false, error: "Webhook URL must use HTTPS." };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "Webhook URL must not include credentials." };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, error: "Webhook URL host is not allowed." };
  }

  if (hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".localhost")) {
    return { ok: false, error: "Webhook URL host is not allowed." };
  }

  // Literal IP in hostname
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { ok: false, error: "Webhook URL must not target a private or reserved address." };
    }
    return { ok: true, href: parsed.href };
  }

  let addresses: string[] = [];
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
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
