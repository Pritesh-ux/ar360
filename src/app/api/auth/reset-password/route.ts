import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth/password-reset";
import { enforceRateLimitForKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await enforceRateLimitForKey(request.headers.get("x-forwarded-for") || "unknown", {
    scope: "auth:reset-password",
    limit: 10,
    windowSec: 3600,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    token?: string;
    password?: string;
  };

  const result = await resetPasswordWithToken({
    email: String(body.email || ""),
    token: String(body.token || ""),
    password: String(body.password || ""),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: "Password updated. You can log in now." });
}
