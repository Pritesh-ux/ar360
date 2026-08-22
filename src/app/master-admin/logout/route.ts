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

export async function GET(request: Request) {
  await clearAdminSession().catch(() => {});

  const response = loginRedirect(request);
  const cleared = {
    ...sessionCookieOptions(0),
    maxAge: 0,
    expires: new Date(0),
  };
  // Attach Set-Cookie on the redirect response so browsers reliably drop the domain cookie.
  response.cookies.set(ADMIN_SESSION_COOKIE, "", cleared);
  response.cookies.set("ar360_pending_2fa", "", cleared);
  return response;
}
