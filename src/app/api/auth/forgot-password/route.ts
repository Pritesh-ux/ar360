import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { enforceRateLimitForKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await enforceRateLimitForKey(request.headers.get("x-forwarded-for") || "unknown", {
    scope: "auth:forgot-password",
    limit: 5,
    windowSec: 3600,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email || "").trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const result = await requestPasswordReset(email);

  return NextResponse.json({
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
    devResetUrl: result.devResetUrl,
  });
}
