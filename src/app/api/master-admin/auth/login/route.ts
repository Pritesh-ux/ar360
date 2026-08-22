import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createMasterAdminSession,
  findMasterAdminByEmail,
  verifyPassword,
  writeLoginLog,
} from "@/lib/auth";
import { logAdminAudit } from "@/lib/permissions/admin-rbac";
import { enforceRateLimitForKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  return forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
}

// requireApiAdmin( - exempt: this is the public admin login route
export async function POST(request: NextRequest) {
  try {
    const loginLimit = await enforceRateLimitForKey(clientIp(request) || "unknown", {
      scope: "auth:admin-login",
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

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { email?: string; password?: string };
      email = String(body.email || "").trim().toLowerCase();
      password = String(body.password || "");
    } else {
      const form = await request.formData();
      email = String(form.get("email") || "").trim().toLowerCase();
      password = String(form.get("password") || "");
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Please enter email and password." }, { status: 400 });
    }

    const user = await findMasterAdminByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      await writeLoginLog({
        actorType: "master_admin",
        actorId: user?.id,
        email,
        status: "failed",
        reason: "invalid_credentials",
      }).catch(() => {});
      return NextResponse.json({ error: "Invalid admin email or password." }, { status: 401 });
    }

    if (user.status !== "Active") {
      return NextResponse.json({ error: "This admin account is disabled." }, { status: 403 });
    }

    if (user.two_factor_enabled) {
      return NextResponse.json(
        { error: "Two-factor login is required. Use the standard login form." },
        { status: 401 },
      );
    }

    const adminUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: "admin" as const,
      status: user.status,
    };

    // Must include exp/iat — live sets ALLOW_LEGACY_ADMIN_SESSIONS=false, so
    // tokens without exp are rejected and look like a failed login.
    const { token, cookieOptions } = await createMasterAdminSession(adminUser);

    await writeLoginLog({
      actorType: "master_admin",
      actorId: user.id,
      email,
      status: "success",
      reason: "password_login_api",
    }).catch(() => {});

    await logAdminAudit({ id: user.id }, "admin.login", "master_admin", String(user.id), { email });

    const response = NextResponse.json({
      ok: true,
      admin: { id: user.id, name: user.name, email: user.email },
      redirectUrl: "/master-admin",
    });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, cookieOptions);
    return response;
  } catch (error) {
    console.error("[master-admin/auth/login]", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
