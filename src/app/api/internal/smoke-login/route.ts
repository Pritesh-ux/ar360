import { NextResponse } from "next/server";
import {
  createCustomerSession,
  ensureCustomerForUser,
  findUserByEmail,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * CI/staging-only login helper for automated smoke tests.
 * Disabled unless SMOKE_TEST_SECRET is set. Never enable in production.
 */
export async function POST(request: Request) {
  const expectedSecret = process.env.SMOKE_TEST_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    secret?: string;
    email?: string;
    password?: string;
  };

  if (body.secret !== expectedSecret) {
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

  if (user.status !== "Active") {
    return NextResponse.json({ error: "Account not active" }, { status: 403 });
  }

  const customer = await ensureCustomerForUser(user);
  if (customer.status !== "Active") {
    return NextResponse.json({ error: "Customer suspended" }, { status: 403 });
  }

  await createCustomerSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: "user",
    customerUid: customer.customer_uid,
  });

  return NextResponse.json({
    success: true,
    user: { email: user.email, customerUid: customer.customer_uid },
  });
}
