import { NextRequest, NextResponse } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  PENDING_2FA_COOKIE,
  createCustomerSession,
  createTwoFactorCode,
  ensureCustomerForUser,
  findUserByEmail,
  sessionCookieOptions,
  setTwoFactorChallenge,
  verifyPassword,
  writeLoginLog,
} from "@/lib/auth";
import { resolveCustomerPostAuthDestination } from "@/lib/onboarding/post-auth-destination";
import { enforceRateLimitForKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePostLoginNext(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (value.length > 500) return null;
  return value;
}

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

    const loginLimit = await enforceRateLimitForKey(meta.ip || "unknown", {
      scope: "auth:login",
      limit: 10,
      windowSec: 300,
    });
    if (!loginLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a few minutes." },
        { status: 429 },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let email = "";
    let password = "";
    let nextPath: string | null = null;

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { email?: string; password?: string; next?: string };
      email = String(body.email || "").trim().toLowerCase();
      password = String(body.password || "");
      nextPath = safePostLoginNext(body.next);
    } else {
      const form = await request.formData();
      email = String(form.get("email") || "").trim().toLowerCase();
      password = String(form.get("password") || "");
      nextPath = safePostLoginNext(form.get("next"));
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Please enter email and password." }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      await writeLoginLog({
        actorType: "customer",
        actorId: user?.id,
        email,
        status: "failed",
        reason: "invalid_credentials",
        ...meta,
      }).catch(() => {});
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (user.status === "Deleted") {
      await writeLoginLog({
        actorType: "customer",
        actorId: user.id,
        email,
        status: "blocked",
        reason: "user_deleted",
        ...meta,
      }).catch(() => {});
      return NextResponse.json(
        { error: "Your account is not active. Please contact support." },
        { status: 403 },
      );
    }

    // Active + Suspended may sign in (suspended features stay locked in the dashboard).
    if (user.status !== "Active" && user.status !== "Suspended") {
      await writeLoginLog({
        actorType: "customer",
        actorId: user.id,
        email,
        status: "blocked",
        reason: `user_${String(user.status || "unknown").toLowerCase()}`,
        ...meta,
      }).catch(() => {});
      return NextResponse.json(
        { error: "Your account is not active. Please contact support." },
        { status: 403 },
      );
    }

    if (user.two_factor_enabled) {
      const code = createTwoFactorCode();
      const challenge = await setTwoFactorChallenge(
        { id: user.id, name: user.name, email: user.email, role: "user", customerUid: user.customerUid },
        code,
      );
      const { sendTwoFactorCodeEmail } = await import("@/lib/email/two-factor-email");
      const mail = await sendTwoFactorCodeEmail({
        to: user.email,
        name: user.name,
        code,
        purpose: "login",
      }).catch((error) => {
        console.error("[auth/login] 2FA email failed", error);
        return { delivered: false, mode: "skipped" as const };
      });
      if (process.env.NODE_ENV !== "production") {
        console.log(`AR360 customer 2FA code for ${user.email}: ${code}`);
      }
      // Dev helper only — never expose the code in production URLs.
      const devCode =
        process.env.NODE_ENV !== "production" ? `&devCode=${encodeURIComponent(code)}` : "";
      const response = NextResponse.json({
        ok: true,
        redirectUrl: `/verify-2fa?email=${encodeURIComponent(user.email)}${devCode}`,
        twoFactorEmailSent: Boolean(mail.delivered),
      });
      // Must set on response — cookies().set alone is flaky in Route Handlers.
      response.cookies.set(PENDING_2FA_COOKIE, challenge.token, challenge.cookieOptions);
      return response;
    }

    const customer = await ensureCustomerForUser(user);
    if (customer.status === "Deleted") {
      await writeLoginLog({
        actorType: "customer",
        actorId: user.id,
        email,
        status: "blocked",
        reason: `customer_${customer.status.toLowerCase()}`,
        ...meta,
      }).catch(() => {});
      return NextResponse.json(
        { error: "Your account is not active. Please contact support." },
        { status: 403 },
      );
    }

    const session = await createCustomerSession(
      { id: user.id, name: user.name, email: user.email, role: "user", customerUid: customer.customer_uid },
      request,
    );

    await writeLoginLog({
      actorType: "customer",
      actorId: user.id,
      email,
      status: "success",
      reason: "password_login_api",
      ...meta,
    }).catch(() => {});

    // Welcome mail (deduped) — covers first login if signup mail was skipped.
    void import("@/lib/email/customer-lifecycle.service")
      .then(({ sendWelcomeEmail }) => sendWelcomeEmail(customer.customer_uid))
      .catch((error) => console.error("[auth/login] welcome email failed", error));

    const redirectUrl =
      nextPath ||
      (await resolveCustomerPostAuthDestination(customer.customer_uid, {
        userStatus: user.status,
        customerStatus: customer.status,
      }));

    // Attach session cookie on the JSON response (cookies().set alone is flaky in route handlers).
    const response = NextResponse.json({ ok: true, redirectUrl });
    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      session.token,
      session.cookieOptions || sessionCookieOptions(60 * 60 * 24 * 7),
    );
    return response;
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
