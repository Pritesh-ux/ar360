import crypto from "crypto";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email/send-email";
import { issueEmailActionToken } from "@/lib/auth/email-action-token";

export async function ensurePhoneVerifiedColumn() {
  try {
    await query(
      `ALTER TABLE customers
         ADD COLUMN phone_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER phone`,
    );
  } catch {
    // column exists
  }
  try {
    await query(
      `ALTER TABLE customers
         ADD COLUMN phone_verify_code VARCHAR(12) NULL,
         ADD COLUMN phone_verify_expires_at DATETIME NULL`,
    );
  } catch {
    // columns exist
  }
}

export async function getAccountVerificationState(userId: number, customerUid: string) {
  await ensurePhoneVerifiedColumn();
  const users = await query<{ email: string; email_verified: number | boolean; two_factor_enabled: number | boolean }>(
    "SELECT email, email_verified, two_factor_enabled FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  const customers = await query<{ phone: string | null; phone_verified: number | boolean }>(
    "SELECT phone, phone_verified FROM customers WHERE customer_uid = ? LIMIT 1",
    [customerUid],
  );
  const user = users[0];
  const customer = customers[0];
  return {
    email: user?.email || "",
    emailVerified: Boolean(user?.email_verified),
    phone: customer?.phone || "",
    phoneVerified: Boolean(customer?.phone_verified),
    twoFactorEnabled: Boolean(user?.two_factor_enabled),
  };
}

export async function sendEmailVerificationLink(input: {
  userId: number;
  email: string;
}) {
  const issued = await issueEmailActionToken({
    userId: input.userId,
    email: input.email,
    action: "email_verification",
    destinationPath: "/dashboard/settings?tab=profile&verified=email",
    singleUse: true,
  });

  await sendEmail({
    to: input.email,
    subject: "Verify your AR360 Studio email",
    html: `
      <p>Hi,</p>
      <p>Confirm your email for AR360 Studio by opening this secure link:</p>
      <p><a href="${issued.url}">Verify email address</a></p>
      <p>This link expires soon and can be used once.</p>
    `,
    text: `Verify your AR360 Studio email: ${issued.url}`,
  });

  return { sent: true as const, expiresAt: issued.expiresAt.toISOString() };
}

export async function sendPhoneVerificationCode(input: {
  userId: number;
  customerUid: string;
  email: string;
  phone: string;
}) {
  await ensurePhoneVerifiedColumn();
  const phone = String(input.phone || "").trim();
  if (phone.length < 8) throw new Error("Save a valid phone number first.");

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const expiresMysql = expiresAt.toISOString().slice(0, 19).replace("T", " ");

  await query(
    `UPDATE customers
        SET phone = ?, phone_verified = 0, phone_verify_code = ?, phone_verify_expires_at = ?
      WHERE customer_uid = ?`,
    [phone, code, expiresMysql, input.customerUid],
  );

  await sendEmail({
    to: input.email,
    subject: "AR360 phone verification code",
    html: `
      <p>Your phone verification code for <strong>${phone}</strong> is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p>
      <p>This code expires in 15 minutes.</p>
    `,
    text: `Phone verification code for ${phone}: ${code}`,
  });

  return { sent: true as const, expiresAt: expiresAt.toISOString() };
}

export async function confirmPhoneVerificationCode(input: {
  customerUid: string;
  code: string;
}) {
  await ensurePhoneVerifiedColumn();
  const code = String(input.code || "").trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code from your email.");

  const rows = await query<{ phone_verify_code: string | null; phone_verify_expires_at: string | null }>(
    `SELECT phone_verify_code, phone_verify_expires_at
       FROM customers WHERE customer_uid = ? LIMIT 1`,
    [input.customerUid],
  );
  const row = rows[0];
  if (!row?.phone_verify_code) throw new Error("No verification code pending. Request a new code.");
  if (String(row.phone_verify_code) !== code) throw new Error("Incorrect verification code.");
  if (row.phone_verify_expires_at && new Date(row.phone_verify_expires_at).getTime() < Date.now()) {
    throw new Error("Code expired. Request a new one.");
  }

  await query(
    `UPDATE customers
        SET phone_verified = 1, phone_verify_code = NULL, phone_verify_expires_at = NULL
      WHERE customer_uid = ?`,
    [input.customerUid],
  );
  return { verified: true as const };
}
