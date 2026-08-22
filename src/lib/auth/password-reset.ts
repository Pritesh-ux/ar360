import { createHash, randomBytes } from "crypto";
import { findUserByEmail, hashPassword } from "@/lib/auth";
import { issueEmailActionToken } from "@/lib/auth/email-action-token";
import { ensureAuthSchema, query } from "@/lib/db";
import { resolveEmailDeliveryConfig } from "@/lib/email/delivery-config";
import { sendEmail } from "@/lib/email/send-email";
import { enterpriseActivationEmail } from "@/lib/email/templates/enterprise-activation";
import { passwordResetEmail } from "@/lib/email/templates/password-reset";

const RESET_TTL_MINUTES = 60;
let ensurePasswordResetSchemaPromise: Promise<void> | null = null;

function shouldSkipRuntimeDdl(): boolean {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function assertEmailDeliveryReady() {
  if (process.env.NODE_ENV !== "production") return;
  const delivery = await resolveEmailDeliveryConfig();
  if (delivery.provider === "disabled") {
    const reason =
      delivery.reason === "disabled"
        ? "Email notifications are disabled in Master Admin settings."
        : "SMTP/Resend is not configured. Set SMTP in Master Admin → Settings (or .env) and send a test email.";
    throw new Error(reason);
  }
}

async function createResetToken(userId: number, email: string) {
  await query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
    [userId],
  );
  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO password_reset_tokens (user_id, email, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, email, hashResetToken(token), RESET_TTL_MINUTES],
  );
  const destinationPath = `/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  // Email only carries the opaque email-action URL — never a bare dashboard/reset deep link.
  const issued = await issueEmailActionToken({
    userId,
    email,
    action: "password_reset",
    destinationPath,
    ttlMinutes: RESET_TTL_MINUTES,
    singleUse: true,
  });
  return issued.url;
}

export async function ensurePasswordResetSchema() {
  await ensureAuthSchema();
  if (shouldSkipRuntimeDdl()) return;
  if (ensurePasswordResetSchemaPromise) return ensurePasswordResetSchemaPromise;
  ensurePasswordResetSchemaPromise = query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      email VARCHAR(255) NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_password_reset_token_hash (token_hash),
      INDEX idx_password_reset_user (user_id),
      INDEX idx_password_reset_email (email),
      INDEX idx_password_reset_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).then(() => undefined).catch((error) => {
    ensurePasswordResetSchemaPromise = null;
    throw error;
  });
  return ensurePasswordResetSchemaPromise;
}

/** Always resolves without leaking whether the email exists. */
export async function requestPasswordReset(email: string) {
  await ensurePasswordResetSchema();
  await assertEmailDeliveryReady();

  const normalized = email.toLowerCase().trim();
  if (!normalized) return { ok: true as const };

  const user = await findUserByEmail(normalized);
  if (!user || user.status !== "Active") {
    return { ok: true as const };
  }

  const resetUrl = await createResetToken(user.id, normalized);
  const emailContent = passwordResetEmail({ resetUrl, ttlMinutes: RESET_TTL_MINUTES });

  try {
    const delivery = await sendEmail({
      to: normalized,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      template: "password-reset",
    });
    if (!delivery.delivered) {
      console.error(
        `[password-reset] Email not delivered for ${normalized} (mode=${delivery.mode}). Check SMTP/Resend settings.`,
      );
    }
  } catch (error) {
    // Do not fail the HTTP response after the account lookup — that would leak account existence.
    console.error("[password-reset] send failed:", error);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[password-reset] Dev reset link for ${normalized}: ${resetUrl}`);
  }

  return { ok: true as const, devResetUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined };
}

export async function issueEnterpriseActivationPasswordSetup(input: {
  userId: number;
  email: string;
  contactName: string;
  companyName: string;
}) {
  await ensurePasswordResetSchema();
  const normalized = input.email.toLowerCase().trim();
  const resetUrl = await createResetToken(input.userId, normalized);
  const content = enterpriseActivationEmail({
    contactName: input.contactName,
    companyName: input.companyName,
    setupUrl: resetUrl,
    ttlMinutes: RESET_TTL_MINUTES,
  });
  const delivery = await sendEmail({
    to: normalized,
    subject: content.subject,
    text: content.text,
    html: content.html,
    template: "enterprise-activation",
  });
  if (process.env.NODE_ENV !== "production") {
    console.log(`[enterprise-activation] Dev setup link for ${normalized}: ${resetUrl}`);
  }
  return {
    ...delivery,
    devSetupUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined,
  };
}

/** Admin-triggered password reset for a customer account (audited separately by caller). */
export async function requestPasswordResetForCustomerUid(customerUid: string) {
  await ensurePasswordResetSchema();
  const rows = await query<{ email: string; status: string; user_status: string }>(
    `SELECT c.email, c.status, u.status AS user_status
       FROM customers c
       JOIN users u ON u.id = c.user_id
      WHERE c.customer_uid = ?
      LIMIT 1`,
    [customerUid],
  );
  const row = rows[0];
  if (!row?.email) {
    return { ok: false as const, error: "Customer user account not found." };
  }
  if (row.status === "Deleted" || row.user_status === "Deleted") {
    return { ok: false as const, error: "Cannot reset password for a deleted account." };
  }

  const normalized = row.email.toLowerCase().trim();
  const user = await findUserByEmail(normalized);
  if (!user) {
    return { ok: false as const, error: "Linked login user not found." };
  }

  const resetUrl = await createResetToken(user.id, normalized);
  const emailContent = passwordResetEmail({ resetUrl, ttlMinutes: RESET_TTL_MINUTES });
  const delivery = await sendEmail({
    to: normalized,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    template: "admin-password-reset",
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`[password-reset] Admin-triggered reset for ${normalized}: ${resetUrl}`);
  }

  return {
    ok: true as const,
    email: normalized,
    delivered: delivery.delivered,
    mode: delivery.mode,
    devResetUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined,
  };
}

export async function resetPasswordWithToken(input: { email: string; token: string; password: string }) {
  await ensurePasswordResetSchema();

  const normalized = input.email.toLowerCase().trim();
  const token = input.token.trim();
  const password = input.password;

  if (!normalized || !token || password.length < 8) {
    return { ok: false as const, error: "Invalid reset request." };
  }

  const tokenHash = hashResetToken(token);
  const rows = await query<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE email = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [normalized, tokenHash],
  );

  const row = rows[0];
  if (!row) {
    return { ok: false as const, error: "Reset link is invalid or expired." };
  }

  const passwordHash = hashPassword(password);
  const markUsed = await query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL",
    [row.id],
  );
  if (Number((markUsed as unknown as { affectedRows?: number }).affectedRows || 0) !== 1) {
    return { ok: false as const, error: "Reset link is invalid or expired." };
  }

  await query("UPDATE users SET password_hash = ? WHERE id = ? AND email = ?", [
    passwordHash,
    row.user_id,
    normalized,
  ]);

  try {
    const { bumpSessionVersion } = await import("@/lib/account/sessions.service");
    await bumpSessionVersion(row.user_id);
  } catch {
    // best-effort
  }
  await query("UPDATE customer_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [
    row.user_id,
  ]).catch(() => {});

  return { ok: true as const };
}
