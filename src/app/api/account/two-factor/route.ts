import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimitForKey, getClientIp } from "@/lib/rate-limit";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import {
  confirmEnableTwoFactor,
  disableTwoFactor,
  getTwoFactorStatus,
  requestEnableTwoFactor,
} from "@/lib/account/two-factor.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const enabled = await getTwoFactorStatus(user.id);
  return NextResponse.json({ success: true, enabled });
}

export async function POST(request: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const ip = getClientIp(request);
  const limit = await enforceRateLimitForKey(`${user.id}:${ip}`, { scope: "auth:2fa-settings", limit: 10, windowSec: 300 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later.", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await request.json();
  const action = String(body.action || "enable_request");

  if (action === "enable_request") {
    const result = await requestEnableTwoFactor({
      userId: user.id,
      customerUid: user.customerUid,
      email: user.email,
      name: user.name,
      password: String(body.password || ""),
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (action === "enable_confirm") {
    const result = await confirmEnableTwoFactor({
      userId: user.id,
      customerUid: user.customerUid,
      code: String(body.code || ""),
    });
    if ("error" in result) return NextResponse.json({ error: result.error, code: "TWO_FACTOR_INVALID" }, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const body = await request.json().catch(() => ({}));
  const result = await disableTwoFactor({
    userId: user.id,
    customerUid: user.customerUid,
    password: String(body.password || ""),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
