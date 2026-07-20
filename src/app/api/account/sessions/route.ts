import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import {
  listCustomerSessions,
  revokeAllOtherSessions,
  revokeCustomerSession,
} from "@/lib/account/sessions.service";
import { encodeSigned, sessionCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CUSTOMER_SESSION_COOKIE = "ar360_customer_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const sessions = await listCustomerSessions({
    userId: user.id,
    customerUid: user.customerUid,
    currentSessionUid: user.sessionUid,
  });

  return NextResponse.json({ success: true, sessions });
}

export async function DELETE(request: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "revoke");

  if (action === "revoke_all_other") {
    const newVersion = await revokeAllOtherSessions({
      userId: user.id,
      customerUid: user.customerUid,
      keepSessionUid: user.sessionUid,
    });

    const cookieStore = await cookies();
    cookieStore.set(
      CUSTOMER_SESSION_COOKIE,
      encodeSigned({ ...user, role: "user", sessionVersion: newVersion }),
      sessionCookieOptions(SESSION_MAX_AGE),
    );

    return NextResponse.json({ success: true, message: "All other devices were logged out." });
  }

  const sessionUid = String(body.sessionUid || "");
  if (!sessionUid) {
    return NextResponse.json({ error: "Session id required.", code: "SESSION_NOT_FOUND" }, { status: 400 });
  }

  const revoked = await revokeCustomerSession({
    userId: user.id,
    customerUid: user.customerUid,
    sessionUid,
  });

  if (!revoked) {
    return NextResponse.json({ error: "Session not found.", code: "SESSION_NOT_FOUND" }, { status: 404 });
  }

  if (sessionUid === user.sessionUid) {
    const cookieStore = await cookies();
    cookieStore.delete(CUSTOMER_SESSION_COOKIE);
    return NextResponse.json({ success: true, loggedOut: true });
  }

  return NextResponse.json({ success: true });
}
