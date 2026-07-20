import { createHmac, timingSafeEqual } from "crypto";

const MIN_PRODUCTION_SECRET_LENGTH = 32;

let cachedSecret: string | null = null;

/**
 * Read AUTH_SECRET at runtime via bracket access so Next.js does not
 * inline a build-time value that can disagree with the running process env.
 */
export function getAuthSecret() {
  if (cachedSecret !== null) return cachedSecret;

  const env = process.env;
  const secret = env["AUTH_SECRET"] || env["SESSION_SECRET"] || "";

  if (env["NODE_ENV"] === "production") {
    if (!secret || secret.length < MIN_PRODUCTION_SECRET_LENGTH || secret === "dev-only-change-this-auth-secret") {
      throw new Error("AUTH_SECRET must be set to a strong 32+ character value in production.");
    }
  }

  cachedSecret = secret || "dev-only-change-this-auth-secret";
  return cachedSecret;
}

export function encodeSigned(payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function decodeSigned<T>(token?: string): T | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function hasSignedTokenShape(value?: string) {
  if (!value) return false;
  const parts = value.split(".");
  return parts.length === 2 && parts[0].length > 10 && parts[1].length > 10;
}
