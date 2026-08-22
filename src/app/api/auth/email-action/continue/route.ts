import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/auth";
import { resolveEmailActionToken } from "@/lib/auth/email-action-token";
import { getCleanOrigin } from "@/lib/url";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, {
    scope: "auth:email-action",
    limit: 30,
    windowSec: 60,
  });
  if (limited instanceof Response) return limited;

  const token = String(request.nextUrl.searchParams.get("token") || "").trim();
  const origin = getCleanOrigin(request);

  if (!token) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const result = await resolveEmailActionToken(token, {
    consume: true,
    createSessionIfNeeded: true,
  });

  if (result.status === "mismatch") {
    return NextResponse.redirect(new URL(`/email-action/${encodeURIComponent(token)}`, origin));
  }

  if (result.status === "invalid") {
    return NextResponse.redirect(
      new URL(`/email-action/${encodeURIComponent(token)}?error=${encodeURIComponent(result.reason)}`, origin),
    );
  }

  const destination = new URL(result.destinationPath, origin);
  if (destination.origin !== new URL(origin).origin) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  const response = NextResponse.redirect(destination);
  if (result.sessionCookie?.token) {
    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      result.sessionCookie.token,
      result.sessionCookie.cookieOptions,
    );
  }
  return response;
}
