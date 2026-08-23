import { NextRequest, NextResponse } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  createCustomerSession,
  sessionCookieOptions,
  writeLoginLog,
} from "@/lib/auth";
import { OnboardingErrorCode } from "@/lib/onboarding/onboarding-errors";
import { resolveCustomerPostAuthDestination } from "@/lib/onboarding/post-auth-destination";
import { registerCustomerAccount } from "@/lib/onboarding/signup.service";
import { enforceRateLimitForKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  return forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
}

export async function POST(request: NextRequest) {
  try {
    const meta = {
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent") || "",
    };

    const signupLimit = await enforceRateLimitForKey(meta.ip || "unknown", {
      scope: "auth:signup",
      limit: 5,
      windowSec: 3600,
    });
    if (!signupLimit.allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts from this network. Please try again later." },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      companyName?: string;
      password?: string;
      confirmPassword?: string;
      phone?: string;
      website?: string;
      plan?: string;
      period?: string;
    };

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const companyName = String(body.companyName || "").trim();
    const plan = String(body.plan || "").trim();
    const period = String(body.period || "monthly").trim() || "monthly";

    const signup = await registerCustomerAccount({
      name,
      email,
      password: String(body.password || ""),
      confirmPassword: String(body.confirmPassword || ""),
      companyName,
      phone: String(body.phone || "").trim() || undefined,
      website: String(body.website || "").trim() || undefined,
    });

    if (signup.ok === false) {
      if (signup.code === OnboardingErrorCode.STAGING_SIGNUP_DISABLED) {
        await writeLoginLog({
          actorType: "customer",
          email,
          status: "failed",
          reason: "staging_signup_blocked",
          ...meta,
        }).catch(() => {});
        return NextResponse.json(
          { error: signup.message, code: OnboardingErrorCode.STAGING_SIGNUP_DISABLED },
          { status: 403 },
        );
      }
      if (signup.code === OnboardingErrorCode.EMAIL_ALREADY_EXISTS) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in instead." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: signup.message }, { status: 400 });
    }

    const session = await createCustomerSession(
      {
        id: signup.user.id,
        name: signup.user.name,
        email: signup.user.email,
        role: "user",
        customerUid: signup.user.customerUid,
      },
      request,
    );

    await writeLoginLog({
      actorType: "customer",
      actorId: signup.user.id,
      email: signup.user.email,
      status: "success",
      reason: "signup_api",
      ...meta,
    }).catch(() => {});

    const redirectUrl = await resolveCustomerPostAuthDestination(signup.user.customerUid, {
      plan: plan || undefined,
      period,
      userStatus: "Active",
      customerStatus: "Active",
    });

    const response = NextResponse.json({ ok: true, redirectUrl });
    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      session.token,
      session.cookieOptions || sessionCookieOptions(60 * 60 * 24 * 7),
    );
    return response;
  } catch (error) {
    console.error("[auth/signup]", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
