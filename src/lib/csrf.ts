const CSRF_COOKIE = "ar360_csrf";
const CSRF_HEADER = "x-csrf-token";
const TOKEN_LENGTH = 32;
const MAX_AGE_SECONDS = 3600; // 1 hour
const MIN_PRODUCTION_SECRET_LENGTH = 32;

function getSecret(): string {
  // Keep Edge-middleware safe (no Node crypto). Mirror getAuthSecret rules.
  const env = process.env;
  const secret = env["AUTH_SECRET"] || env["SESSION_SECRET"] || "";
  if (env["NODE_ENV"] === "production") {
    if (
      !secret ||
      secret.length < MIN_PRODUCTION_SECRET_LENGTH ||
      secret === "dev-only-change-this-auth-secret" ||
      secret === "dev-only-csrf-fallback"
    ) {
      throw new Error(
        "AUTH_SECRET must be set to a strong 32+ character value in production (CSRF).",
      );
    }
  }
  return secret || "dev-only-change-this-auth-secret";
}

async function hmacSign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bufToBase64url(sig);
}

function bufToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function toBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Generate a signed CSRF token and set it as a cookie value.
 * Returns the token to include in forms / headers.
 */
export async function generateCsrfToken(): Promise<string> {
  const randomBytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(randomBytes);
  let nonce = "";
  for (const b of randomBytes) nonce += String.fromCharCode(b);
  const nonceB64 = btoa(nonce).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signature = await hmacSign(nonceB64);
  return `${nonceB64}.${signature}`;
}

/**
 * Set the CSRF cookie on a Response. Safe to call multiple times.
 */
export function setCsrfCookie(response: Response, token: string, secure = false): void {
  const cookie = [
    `${CSRF_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  response.headers.append("Set-Cookie", cookie);
}

/** True when the cookie value is a valid signed CSRF token for the current AUTH_SECRET. */
export async function isCsrfCookieValid(cookieToken: string | undefined): Promise<boolean> {
  if (!cookieToken) return false;

  const decoded = decodeURIComponent(cookieToken);
  const [nonce, cookieSig] = decoded.split(".");
  if (!nonce || !cookieSig) return false;

  const expectedSig = await hmacSign(nonce);
  return constantTimeEqual(toBytes(cookieSig), toBytes(expectedSig));
}

/**
 * Verify a CSRF token against the cookie value.
 * Returns true if valid, false otherwise.
 */
export async function verifyCsrfToken(
  cookieToken: string | undefined,
  requestToken: string | undefined,
): Promise<boolean> {
  if (!cookieToken || !requestToken) return false;

  const decodedCookie = decodeURIComponent(cookieToken);
  const [nonce, cookieSig] = decodedCookie.split(".");
  const [requestNonce, requestSig] = requestToken.split(".");

  if (!nonce || !cookieSig || !requestNonce || !requestSig) return false;

  // The request token must contain the same nonce as the cookie
  if (!constantTimeEqual(toBytes(nonce), toBytes(requestNonce))) {
    return false;
  }

  // Verify the cookie signature
  const expectedSig = await hmacSign(nonce);
  if (!constantTimeEqual(toBytes(cookieSig), toBytes(expectedSig))) {
    return false;
  }

  // Verify the request signature
  const requestSigExpected = await hmacSign(requestNonce);
  if (!constantTimeEqual(toBytes(requestSig), toBytes(requestSigExpected))) {
    return false;
  }

  return true;
}

/**
 * Extract CSRF token from request (header or form body).
 */
export function extractCsrfFromRequest(request: Request): string | undefined {
  const headerToken = request.headers.get(CSRF_HEADER);
  if (headerToken) return headerToken;

  return undefined;
}

/**
 * Extract CSRF token from cookie.
 */
export function extractCsrfFromCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.split(";").find((c) => c.trim().startsWith(`${CSRF_COOKIE}=`));
  if (!match) return undefined;
  return match.trim().split("=").slice(1).join("=");
}

export { CSRF_COOKIE, CSRF_HEADER };
