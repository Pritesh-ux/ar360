import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  clearAdminSession,
  sessionCookieOptions,
} from "@/lib/auth";
import { getCleanOrigin } from "@/lib/url";

function loginRedirect(request: Request) {
  const origin = getCleanOrigin(request);
  return NextResponse.redirect(new URL("/master-admin/login", origin));
}

function attachClearedAdminCookies(response: NextResponse) {
  const cleared = {
    ...sessionCookieOptions(0),
    maxAge: 0,
    expires: new Date(0),
  };
  response.cookies.set(ADMIN_SESSION_COOKIE, "", cleared);
  response.cookies.set("ar360_pending_2fa", "", cleared);
  return response;
}

/**
 * Logout mutation — POST only (CSRF-protected by middleware).
 * Prefer this over GET to avoid cross-site logout CSRF via top-level navigation.
 */
export async function POST(request: Request) {
  await clearAdminSession().catch(() => {});
  const response = loginRedirect(request);
  return attachClearedAdminCookies(response);
}

/**
 * GET is intentionally non-mutating: redirect to login without clearing the session.
 * Use POST /master-admin/logout to sign out.
 */
export async function GET(request: Request) {
  return loginRedirect(request);
}
