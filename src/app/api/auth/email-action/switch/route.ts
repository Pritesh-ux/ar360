import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/auth";
import { switchAccountForEmailAction } from "@/lib/auth/email-action-token";
import { absoluteUrl } from "@/lib/url";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, {
    scope: "auth:email-action-switch",
    limit: 10,
    windowSec: 60,
  });
  if (limited instanceof Response) return limited;

  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  const result = await switchAccountForEmailAction(token);

  if (result.status === "invalid") {
    return NextResponse.json({ error: result.message, reason: result.reason }, { status: 400 });
  }

  if (result.status === "mismatch") {
    // Still mismatched somehow — send to login with return URL.
    return NextResponse.json({
      ok: false,
      needsLogin: true,
      loginUrl: absoluteUrl(`/login?next=${encodeURIComponent(`/email-action/${token}`)}`),
      error: "Sign in to the requested account to continue.",
    });
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo: result.destinationPath,
  });
  if (result.sessionCookie?.token) {
    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      result.sessionCookie.token,
      result.sessionCookie.cookieOptions,
    );
  }
  return response;
}
