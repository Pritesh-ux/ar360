import { NextResponse } from "next/server";
import { requireApiUser, verifyPassword, hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { enforceRateLimitForKey, getClientIp } from "@/lib/rate-limit";
import { writeCustomerActivity } from "@/lib/account/activity.service";
import { createCustomerNotification } from "@/lib/account/notify.service";
import { revokeAllOtherSessions } from "@/lib/account/sessions.service";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character.";
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in again.", code: "UNAUTHENTICATED" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const limit = await enforceRateLimitForKey(`${user.id}:${ip}`, {
      scope: "auth:change-password",
      limit: 5,
      windowSec: 900,
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later.", code: "RATE_LIMITED" }, { status: 429 });
    }

    const { currentPassword, newPassword, confirmNewPassword } = await req.json();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (newPassword !== confirmNewPassword) {
      return NextResponse.json({ error: "New passwords do not match." }, { status: 400 });
    }

    if (newPassword === currentPassword) {
      return NextResponse.json({ error: "New password cannot be the same as current password." }, { status: 400 });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    // Retrieve the user's password hash from the database
    const rows = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
      [user.id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 400 });
    }

    const isMatch = verifyPassword(currentPassword, rows[0].password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: "Current password is incorrect.", code: "CURRENT_PASSWORD_INVALID" }, { status: 400 });
    }

    const newHash = hashPassword(newPassword);
    await query("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?", [newHash, user.id]);

    if (user.customerUid) {
      await revokeAllOtherSessions({
        userId: user.id,
        customerUid: user.customerUid,
        keepSessionUid: user.sessionUid,
      });
      await writeCustomerActivity({
        customerUid: user.customerUid,
        userId: user.id,
        eventType: "password_changed",
        title: "Password changed",
        detail: "Your account password was updated.",
      });
      await createCustomerNotification({
        customerUid: user.customerUid,
        userId: user.id,
        category: "security",
        title: "Password changed",
        body: "Your password was changed successfully. Other devices were signed out.",
        href: "/dashboard/settings?tab=security",
        dedupeKey: `password-changed:${user.id}:${Date.now()}`,
      });
    }

    return NextResponse.json({ success: true, message: "Your password has been updated." });
  } catch (error) {
    console.error("[change-password]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
