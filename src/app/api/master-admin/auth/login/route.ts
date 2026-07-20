import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  encodeSigned,
  findMasterAdminByEmail,
  verifyPassword,
  writeLoginLog,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function cookieOptions() {
  const secure =
    process.env["AUTH_COOKIE_SECURE"] === "true"
      ? true
      : process.env["AUTH_COOKIE_SECURE"] === "false"
        ? false
        : false;

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE,
    expires: new Date(Date.now() + SESSION_MAX_AGE * 1000),
  };
}

export async function POST(request: NextRequest) {
  try {
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

    const token = encodeSigned({
      id: user.id,
      name: user.name,
      email: user.email,
      role: "admin",
    });

    await writeLoginLog({
      actorType: "master_admin",
      actorId: user.id,
      email,
      status: "success",
      reason: "password_login_api",
    }).catch(() => {});

    const response = NextResponse.json({
      ok: true,
      admin: { id: user.id, name: user.name, email: user.email },
      redirectUrl: "/master-admin",
    });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, cookieOptions());
    return response;
  } catch (error) {
    console.error("[master-admin/auth/login]", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
