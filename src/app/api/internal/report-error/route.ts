import { NextResponse } from "next/server";
import { captureException } from "@/lib/monitoring";
import { getAnyCurrentUser } from "@/lib/auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const MAX_MESSAGE = 500;
const MAX_STACK = 2_000;
const MAX_DIGEST = 120;
const MAX_SOURCE = 80;

function secretsEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function hasInternalReporterAuth(request: Request): boolean {
  const provided =
    request.headers.get("x-ar360-internal-key")?.trim() ||
    request.headers.get("x-ar360-worker-secret")?.trim() ||
    "";
  if (!provided) return false;
  const expected =
    process.env.AR360_INTERNAL_KEY?.trim() ||
    process.env.WORKER_SECRET?.trim() ||
    "";
  if (!expected || expected.length < 16) return false;
  return secretsEqual(provided, expected);
}

function sanitizeText(value: unknown, max: number): string {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .slice(0, max);
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, {
    scope: "internal:report-error",
    limit: 20,
    windowSec: 60,
  });
  if (limited instanceof Response) return limited;
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many error reports." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 8_000) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const sessionUser = await getAnyCurrentUser().catch(() => null);
  const internalOk = hasInternalReporterAuth(request);
  // Unauthenticated browser reports are allowed only with tight rate limits + truncation
  // (global-error.tsx). Prefer session or internal key when available.
  if (!sessionUser && !internalOk) {
    // Still accept but more tightly rate-limited by IP already above.
    // Reject empty/abusive bodies without a message.
  }

  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    digest?: string;
    stack?: string;
    source?: string;
  };

  const message = sanitizeText(body.message, MAX_MESSAGE);
  if (!message) {
    return NextResponse.json({ error: "message required." }, { status: 400 });
  }

  const error = new Error(message);
  const stack = sanitizeText(body.stack, MAX_STACK);
  if (stack) error.stack = stack;

  await captureException(error, {
    digest: sanitizeText(body.digest, MAX_DIGEST) || undefined,
    source: sanitizeText(body.source || "client", MAX_SOURCE),
    ip: getClientIp(request),
    authenticated: Boolean(sessionUser),
  });

  return NextResponse.json({ success: true });
}
