import { NextResponse } from "next/server";
import { createSession, ensureCustomerForUser, verifyTwoFactorCode } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolveCustomerPostAuthDestination } from "@/lib/onboarding/post-auth-destination";

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

    await createSession(user);

    if (user.role === "admin") {
      return NextResponse.json({
        success: true,
        redirect: "/master-admin",
        user,
      });
    }

    const customer = await ensureCustomerForUser(user);
    const redirectTo = await resolveCustomerPostAuthDestination(customer.customer_uid, {
      userStatus: "Active",
      customerStatus: customer.status,
    });

    return NextResponse.json({
      success: true,
      redirect: redirectTo,
      user,
    });
  } catch (error) {
    console.error("VERIFY 2FA ERROR:", error);
    return NextResponse.json({ success: false, error: "Verification failed." }, { status: 500 });
  }
}
