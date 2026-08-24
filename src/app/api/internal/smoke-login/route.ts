import { NextResponse } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  createCustomerSession,
  ensureCustomerForUser,
  findUserByEmail,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

function secretsEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * CI/staging-only login helper for automated smoke tests.
 * Hard-disabled in production. Also requires SMOKE_TEST_SECRET + ALLOW_SMOKE_LOGIN=true.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (process.env.ALLOW_SMOKE_LOGIN !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const expectedSecret = process.env.SMOKE_TEST_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    secret?: string;
    email?: string;
    password?: string;
  };

  if (!body.secret || !secretsEqual(String(body.secret), expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = String(body.email || process.env.SEED_CUSTOMER_EMAIL || "").toLowerCase().trim();
  const password = String(body.password || process.env.SEED_CUSTOMER_PASSWORD || "");

  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { evaluateCustomerLoginPolicy } = await import("@/lib/security/staging-policy");
  const loginPolicy = evaluateCustomerLoginPolicy({ email });
  if (loginPolicy.allowed === false) {
    return NextResponse.json(
      { error: loginPolicy.message, code: loginPolicy.code },
      { status: 403 },
    );
  }

  if (user.status === "Deleted" || (user.status !== "Active" && user.status !== "Suspended")) {
    return NextResponse.json({ error: "Account not active" }, { status: 403 });
  }

  const customer = await ensureCustomerForUser(user);
  if (customer.status === "Deleted") {
    return NextResponse.json({ error: "Customer deleted" }, { status: 403 });
  }

  const session = await createCustomerSession(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: "user",
      customerUid: customer.customer_uid,
    },
    request,
  );

  const response = NextResponse.json({
    success: true,
    user: { email: user.email, customerUid: customer.customer_uid },
  });
  response.cookies.set(
    CUSTOMER_SESSION_COOKIE,
    session.token,
    session.cookieOptions || sessionCookieOptions(60 * 60 * 24 * 7),
  );
  return response;
}
