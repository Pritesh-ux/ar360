import { query } from "@/lib/db";
import { createTwoFactorCode, setTwoFactorChallenge, verifyPassword } from "@/lib/auth";
import { writeCustomerActivity } from "@/lib/account/activity.service";
import { createCustomerNotification } from "@/lib/account/notify.service";
import { bumpSessionVersion } from "@/lib/account/sessions.service";

export async function getTwoFactorStatus(userId: number) {
  const rows = await query<{ two_factor_enabled: 0 | 1 | boolean }>(
    "SELECT two_factor_enabled FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  return Boolean(rows[0]?.two_factor_enabled);
}

export async function requestEnableTwoFactor(input: {
  userId: number;
  customerUid: string;
  email: string;
  name: string;
  password: string;
}) {
  const rows = await query<{ password_hash: string; two_factor_enabled: 0 | 1 | boolean }>(
    "SELECT password_hash, two_factor_enabled FROM users WHERE id = ? LIMIT 1",
    [input.userId],
  );
  const user = rows[0];
  if (!user) return { error: "User not found." as const };
  if (Boolean(user.two_factor_enabled)) return { error: "Two-factor authentication is already enabled." as const };
  if (!verifyPassword(input.password, user.password_hash)) {
    return { error: "Password is incorrect." as const };
  }

  const code = createTwoFactorCode();
  await setTwoFactorChallenge(
    { id: input.userId, name: input.name, email: input.email, role: "user" },
    code,
  );

  // In production, email service sends code; dev logs only
  if (process.env.NODE_ENV !== "production") {
    console.info(`[2FA enable] code for ${input.email}: ${code}`);
  }

  return { success: true as const, message: "Verification code sent. Enter it to enable 2FA." };
}

export async function confirmEnableTwoFactor(input: {
  userId: number;
  customerUid: string;
  code: string;
}) {
  const { verifyTwoFactorCode } = await import("@/lib/auth");
  const verified = await verifyTwoFactorCode(input.code);
  if (!verified || verified.id !== input.userId) {
    return { error: "Invalid or expired verification code." as const };
  }

  await query(
    "UPDATE users SET two_factor_enabled = TRUE, two_factor_code_hash = NULL, two_factor_expires_at = NULL WHERE id = ?",
    [input.userId],
  );

  await writeCustomerActivity({
    customerUid: input.customerUid,
    userId: input.userId,
    eventType: "2fa_enabled",
    title: "Two-factor authentication enabled",
    detail: "2FA was enabled on your account.",
  });

  await createCustomerNotification({
    customerUid: input.customerUid,
    userId: input.userId,
    category: "security",
    title: "2FA enabled",
    body: "Two-factor authentication is now active on your account.",
    href: "/dashboard/settings?tab=security",
    dedupeKey: `2fa-enabled:${input.userId}`,
  });

  return { success: true as const };
}

export async function disableTwoFactor(input: {
  userId: number;
  customerUid: string;
  password: string;
}) {
  const rows = await query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    [input.userId],
  );
  if (!rows[0] || !verifyPassword(input.password, rows[0].password_hash)) {
    return { error: "Password is incorrect." as const };
  }

  await query(
    "UPDATE users SET two_factor_enabled = FALSE, two_factor_code_hash = NULL, two_factor_expires_at = NULL WHERE id = ?",
    [input.userId],
  );

  await bumpSessionVersion(input.userId);

  await writeCustomerActivity({
    customerUid: input.customerUid,
    userId: input.userId,
    eventType: "2fa_disabled",
    title: "Two-factor authentication disabled",
    detail: "2FA was disabled on your account.",
  });

  await createCustomerNotification({
    customerUid: input.customerUid,
    userId: input.userId,
    category: "security",
    title: "2FA disabled",
    body: "Two-factor authentication was disabled. If this wasn't you, change your password immediately.",
    href: "/dashboard/settings?tab=security",
    dedupeKey: `2fa-disabled:${input.userId}:${Date.now()}`,
  });

  return { success: true as const };
}
