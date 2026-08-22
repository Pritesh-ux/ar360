import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  PENDING_2FA_COOKIE,
  createMasterAdminSession,
  createCustomerSession,
  ensureCustomerForUser,
  sessionCookieOptions,
  verifyTwoFactorCode,
} from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolveCustomerPostAuthDestination } from "@/lib/onboarding/post-auth-destination";

function clearPending2faCookie(response: NextResponse) {
  response.cookies.set(PENDING_2FA_COOKIE, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: "auth:verify-2fa", limit: 15, windowSec: 300 });
  if (limited instanceof Response) return limited;

  try {
    const formData = await req.formData();
    const code = String(formData.get("code") || "").replace(/\D/g, "");

    if (code.length !== 6) {
      return NextResponse.json({ success: false, error: "Enter the 6 digit verification code." });
    }

    const user = await verifyTwoFactorCode(code);

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid or expired verification code." });
    }

    if (user.role === "admin") {
      const session = await createMasterAdminSession(user);
      const response = NextResponse.json({
        success: true,
        redirect: "/master-admin",
        user,
      });
      response.cookies.set(ADMIN_SESSION_COOKIE, session.token, session.cookieOptions);
      clearPending2faCookie(response);
      return response;
    }

    const session = await createCustomerSession(user, req);
    const customer = await ensureCustomerForUser(user);
    const redirectTo = await resolveCustomerPostAuthDestination(customer.customer_uid, {
      userStatus: "Active",
      customerStatus: customer.status,
    });

    void import("@/lib/email/customer-lifecycle.service")
      .then(({ sendWelcomeEmail }) => sendWelcomeEmail(customer.customer_uid))
      .catch((error) => console.error("[verify-2fa] welcome email failed", error));

    const response = NextResponse.json({
      success: true,
      redirect: redirectTo,
      user,
    });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, session.token, session.cookieOptions);
    clearPending2faCookie(response);
    return response;
  } catch (error) {
    console.error("VERIFY 2FA ERROR:", error);
    return NextResponse.json({ success: false, error: "Verification failed." }, { status: 500 });
  }
}
