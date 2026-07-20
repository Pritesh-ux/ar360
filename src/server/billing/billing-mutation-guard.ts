import { NextResponse } from "next/server";
import { enforceRateLimitForKey, getClientIp } from "@/lib/rate-limit";

export function rejectCrossOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  let expected: string;
  try {
    expected = new URL(request.url).origin;
  } catch {
    return null;
  }

  if (origin === expected) return null;

  // Local dev: localhost ↔ 127.0.0.1 are the same app.
  try {
    const originUrl = new URL(origin);
    const expectedUrl = new URL(expected);
    const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
    if (
      loopback.has(originUrl.hostname) &&
      loopback.has(expectedUrl.hostname) &&
      originUrl.port === expectedUrl.port
    ) {
      return null;
    }
  } catch {
    // fall through
  }

  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "same-site") return null;

  return NextResponse.json({ error: "Cross-origin billing mutation rejected." }, { status: 403 });
}

export async function guardBillingMutation(request: Request, actorKey: string) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const result = await enforceRateLimitForKey(`${actorKey}:${getClientIp(request)}`, {
    scope: "billing:subscription-mutation",
    limit: 10,
    windowSec: 60,
  });
  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many billing changes. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
    );
  }
  return null;
}
