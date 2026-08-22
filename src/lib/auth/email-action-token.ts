import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import {
  clearCustomerSession,
  createCustomerSession,
  findUserByEmail,
  getCurrentUser,
  type CustomerUser,
} from "@/lib/auth";
import { ensureAuthSchema, query } from "@/lib/db";
import { getAuthSecret } from "@/lib/signed-token";
import { absoluteUrl, getAppUrl } from "@/lib/url";

export const EMAIL_ACTION_DEFAULT_TTL_MINUTES = 15;
export const EMAIL_ACTION_PASSWORD_RESET_TTL_MINUTES = 60;
export const EMAIL_ACTION_INVITE_TTL_MINUTES = 60 * 24 * 7;

export type EmailActionKind =
  | "view_dashboard"
  | "view_billing"
  | "view_invoice"
  | "manage_subscription"
  | "password_reset"
  | "email_verification"
  | "team_invite"
  | "client_invite"
  | "custom";

export type EmailActionTokenRow = {
  id: number;
  token_hash: string;
  claims_signature: string;
  user_id: number | null;
  customer_uid: string | null;
  email: string;
  action: EmailActionKind | string;
  destination_path: string;
  single_use: number | boolean;
  expires_unix: number;
  expires_at: Date | string;
  used_at: Date | string | null;
};

export type EmailActionResolveResult =
  | {
      status: "ok";
      token: EmailActionTokenRow;
      destinationPath: string;
      createdSession: boolean;
      sessionCookie?: { token: string; cookieOptions: ReturnType<typeof import("@/lib/auth").sessionCookieOptions> };
    }
  | {
      status: "mismatch";
      token: EmailActionTokenRow;
      current: { email: string; userId: number };
      requested: { email: string; userId: number };
    }
  | {
      status: "invalid";
      reason: "missing" | "expired" | "used" | "signature" | "user";
      message: string;
    };

let ensureSchemaPromise: Promise<void> | null = null;

function shouldSkipRuntimeDdl(): boolean {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
}

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function signClaims(input: {
  userId: number | null;
  email: string;
  action: string;
  destinationPath: string;
  expiresUnix: number;
  singleUse: boolean;
}) {
  const canonical = [
    String(input.userId ?? 0),
    input.email.toLowerCase(),
    input.action,
    input.destinationPath,
    String(input.expiresUnix),
    input.singleUse ? "1" : "0",
  ].join("|");
  return createHmac("sha256", getAuthSecret()).update(canonical).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length || left.length === 0) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function normalizeDestinationPath(raw: string) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "/dashboard";
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const app = new URL(getAppUrl());
      if (url.host.toLowerCase() !== app.host.toLowerCase()) {
        throw new Error("External destinations are not allowed in email actions.");
      }
      return `${url.pathname}${url.search}${url.hash}` || "/dashboard";
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("External")) throw error;
  }
  if (!trimmed.startsWith("/")) return `/${trimmed}`;
  if (trimmed.startsWith("//")) return "/dashboard";
  return trimmed.slice(0, 500);
}

function inferAction(destinationPath: string): EmailActionKind {
  const path = destinationPath.split("?")[0] || "";
  if (path.startsWith("/reset-password")) return "password_reset";
  if (path.includes("invoice")) return "view_invoice";
  if (path.startsWith("/dashboard/billing") || path.startsWith("/dashboard/subscription")) {
    return path.includes("subscription") ? "manage_subscription" : "view_billing";
  }
  if (path.startsWith("/dashboard")) return "view_dashboard";
  if (path.includes("invite")) return "team_invite";
  if (path.includes("verify")) return "email_verification";
  return "custom";
}

function isSensitiveAction(action: string) {
  return (
    action === "password_reset" ||
    action === "email_verification" ||
    action === "team_invite" ||
    action === "client_invite"
  );
}

function defaultSingleUse(action: string) {
  return isSensitiveAction(action);
}

function defaultTtlMinutes(action: string) {
  if (action === "password_reset") return EMAIL_ACTION_PASSWORD_RESET_TTL_MINUTES;
  if (action === "team_invite" || action === "client_invite") return EMAIL_ACTION_INVITE_TTL_MINUTES;
  return EMAIL_ACTION_DEFAULT_TTL_MINUTES;
}

async function hashRequestIp() {
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "";
    if (!ip) return null;
    return createHash("sha256").update(`${getAuthSecret()}:${ip}`).digest("hex");
  } catch {
    return null;
  }
}

async function requestUserAgent() {
  try {
    const h = await headers();
    return (h.get("user-agent") || "").slice(0, 500) || null;
  } catch {
    return null;
  }
}

export async function ensureEmailActionSchema() {
  await ensureAuthSchema();
  if (shouldSkipRuntimeDdl()) return;
  if (ensureSchemaPromise) return ensureSchemaPromise;
  ensureSchemaPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS email_action_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        token_hash CHAR(64) NOT NULL,
        claims_signature CHAR(64) NOT NULL,
        user_id BIGINT UNSIGNED NULL,
        customer_uid VARCHAR(64) NULL,
        email VARCHAR(255) NOT NULL,
        action VARCHAR(64) NOT NULL,
        destination_path VARCHAR(500) NOT NULL,
        single_use TINYINT(1) NOT NULL DEFAULT 1,
        expires_unix INT UNSIGNED NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_email_action_token_hash (token_hash),
        KEY idx_email_action_user (user_id),
        KEY idx_email_action_email (email),
        KEY idx_email_action_expires (expires_at),
        KEY idx_email_action_customer (customer_uid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS email_action_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        token_id BIGINT UNSIGNED NULL,
        token_hash CHAR(64) NULL,
        user_id BIGINT UNSIGNED NULL,
        email VARCHAR(255) NULL,
        action VARCHAR(64) NULL,
        event_type VARCHAR(64) NOT NULL,
        session_user_id BIGINT UNSIGNED NULL,
        session_email VARCHAR(255) NULL,
        detail VARCHAR(1000) NULL,
        ip_hash VARCHAR(64) NULL,
        user_agent VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_email_action_audit_token (token_id),
        KEY idx_email_action_audit_user (user_id),
        KEY idx_email_action_audit_event (event_type, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  })().catch((error) => {
    ensureSchemaPromise = null;
    throw error;
  });
  return ensureSchemaPromise;
}

export async function logEmailActionEvent(input: {
  tokenId?: number | null;
  tokenHash?: string | null;
  userId?: number | null;
  email?: string | null;
  action?: string | null;
  eventType: string;
  sessionUserId?: number | null;
  sessionEmail?: string | null;
  detail?: string | null;
}) {
  try {
    await ensureEmailActionSchema();
    const [ipHash, userAgent] = await Promise.all([hashRequestIp(), requestUserAgent()]);
    await query(
      `INSERT INTO email_action_audit_logs
        (token_id, token_hash, user_id, email, action, event_type, session_user_id, session_email, detail, ip_hash, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tokenId ?? null,
        input.tokenHash ?? null,
        input.userId ?? null,
        input.email ?? null,
        input.action ?? null,
        input.eventType.slice(0, 64),
        input.sessionUserId ?? null,
        input.sessionEmail ?? null,
        input.detail?.slice(0, 1000) ?? null,
        ipHash,
        userAgent,
      ],
    );
  } catch (error) {
    console.warn("[email-action] audit log failed", error);
  }
}

export async function issueEmailActionToken(input: {
  userId?: number | null;
  email: string;
  customerUid?: string | null;
  action?: EmailActionKind | string;
  destinationPath: string;
  ttlMinutes?: number;
  singleUse?: boolean;
}): Promise<{ rawToken: string; url: string; expiresAt: Date; action: string }> {
  await ensureEmailActionSchema();

  const email = input.email.toLowerCase().trim();
  const destinationPath = normalizeDestinationPath(input.destinationPath);
  const action = String(input.action || inferAction(destinationPath)).slice(0, 64);
  const singleUse = input.singleUse ?? defaultSingleUse(action);
  const ttlMinutes = Math.max(1, input.ttlMinutes ?? defaultTtlMinutes(action));
  const expiresUnix = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
  const expiresAt = new Date(expiresUnix * 1000);
  const userId = input.userId == null ? null : Number(input.userId);
  const claimsSignature = signClaims({
    userId,
    email,
    action,
    destinationPath,
    expiresUnix,
    singleUse,
  });
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);

  await query(
    `INSERT INTO email_action_tokens
      (token_hash, claims_signature, user_id, customer_uid, email, action, destination_path, single_use, expires_unix, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tokenHash,
      claimsSignature,
      userId,
      input.customerUid || null,
      email,
      action,
      destinationPath,
      singleUse ? 1 : 0,
      expiresUnix,
      expiresAt,
    ],
  );

  await logEmailActionEvent({
    tokenHash,
    userId,
    email,
    action,
    eventType: "issued",
    detail: destinationPath,
  });

  return {
    rawToken,
    url: absoluteUrl(`/email-action/${encodeURIComponent(rawToken)}`),
    expiresAt,
    action,
  };
}

/** Resolve customer recipient and mint a secure email CTA URL. */
export async function issueCustomerEmailActionUrl(input: {
  customerUid: string;
  destinationPath: string;
  action?: EmailActionKind | string;
  ttlMinutes?: number;
  singleUse?: boolean;
}): Promise<string | null> {
  const rows = await query<{ user_id: number | null; email: string }>(
    `SELECT user_id, email FROM customers
      WHERE customer_uid = ? AND status != 'Deleted' LIMIT 1`,
    [input.customerUid],
  );
  const row = rows[0];
  if (!row?.email || !row.user_id) return null;
  const issued = await issueEmailActionToken({
    userId: Number(row.user_id),
    email: row.email,
    customerUid: input.customerUid,
    destinationPath: input.destinationPath,
    action: input.action,
    ttlMinutes: input.ttlMinutes,
    singleUse: input.singleUse,
  });
  return issued.url;
}

/**
 * Wrap a plain absolute/relative app URL for email CTAs.
 * Falls back to the original URL only when the recipient cannot be resolved.
 */
export async function secureEmailActionUrl(input: {
  customerUid?: string | null;
  userId?: number | null;
  email?: string | null;
  destinationUrlOrPath: string;
  action?: EmailActionKind | string;
  ttlMinutes?: number;
  singleUse?: boolean;
}): Promise<string> {
  const destinationPath = normalizeDestinationPath(input.destinationUrlOrPath);
  try {
    if (input.customerUid) {
      const url = await issueCustomerEmailActionUrl({
        customerUid: input.customerUid,
        destinationPath,
        action: input.action,
        ttlMinutes: input.ttlMinutes,
        singleUse: input.singleUse,
      });
      if (url) return url;
    }
    if (input.userId && input.email) {
      const issued = await issueEmailActionToken({
        userId: input.userId,
        email: input.email,
        customerUid: input.customerUid,
        destinationPath,
        action: input.action,
        ttlMinutes: input.ttlMinutes,
        singleUse: input.singleUse,
      });
      return issued.url;
    }
  } catch (error) {
    console.error("[email-action] failed to issue token; refusing insecure fallback", error);
    // Never fall back to a bare dashboard URL in production emails.
    return absoluteUrl("/login");
  }
  return absoluteUrl("/login");
}

async function loadTokenByRaw(rawToken: string): Promise<EmailActionTokenRow | null> {
  await ensureEmailActionSchema();
  const tokenHash = hashToken(rawToken);
  const rows = await query<EmailActionTokenRow>(
    `SELECT id, token_hash, claims_signature, user_id, customer_uid, email, action,
            destination_path, single_use, expires_unix, expires_at, used_at
       FROM email_action_tokens
      WHERE token_hash = ?
      LIMIT 1`,
    [tokenHash],
  );
  return rows[0] || null;
}

function verifyStoredClaims(row: EmailActionTokenRow) {
  const expected = signClaims({
    userId: row.user_id == null ? null : Number(row.user_id),
    email: String(row.email).toLowerCase(),
    action: String(row.action),
    destinationPath: String(row.destination_path),
    expiresUnix: Number(row.expires_unix),
    singleUse: Boolean(row.single_use),
  });
  return safeEqualHex(expected, String(row.claims_signature));
}

function sessionMatchesToken(
  sessionUser: { id: number; email: string } | null,
  row: EmailActionTokenRow,
) {
  if (!sessionUser) return true;
  if (row.user_id != null) return Number(sessionUser.id) === Number(row.user_id);
  return sessionUser.email.toLowerCase() === String(row.email).toLowerCase();
}

async function markTokenUsed(tokenId: number) {
  await query(`UPDATE email_action_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL`, [tokenId]);
}

async function loadCustomerUser(userId: number): Promise<CustomerUser | null> {
  const rows = await query<{
    id: number;
    name: string;
    email: string;
    status: string;
    customer_uid: string | null;
  }>(
    `SELECT u.id, u.name, u.email, u.status, c.customer_uid
       FROM users u
       LEFT JOIN customers c ON c.user_id = u.id AND c.status != 'Deleted'
      WHERE u.id = ?
      LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row || row.status !== "Active" || !row.customer_uid) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: "user",
    customerUid: row.customer_uid,
  };
}

/**
 * Read-only validation for rendering mismatch / error UI.
 * Does not create sessions or mark tokens used.
 */
export async function inspectEmailActionToken(rawToken: string): Promise<EmailActionResolveResult> {
  const session = await getCurrentUser();
  const sessionUser = session?.role === "user" ? session : null;
  const row = await loadTokenByRaw(rawToken);

  if (!row) {
    return { status: "invalid", reason: "missing", message: "This link is invalid or has already been used." };
  }
  if (!verifyStoredClaims(row)) {
    return { status: "invalid", reason: "signature", message: "This link failed security verification." };
  }
  if (row.used_at && Boolean(row.single_use)) {
    return { status: "invalid", reason: "used", message: "This link has already been used." };
  }
  if (Number(row.expires_unix) * 1000 <= Date.now()) {
    return { status: "invalid", reason: "expired", message: "This link has expired. Request a new email." };
  }
  if (sessionUser && !sessionMatchesToken(sessionUser, row)) {
    return {
      status: "mismatch",
      token: row,
      current: { email: sessionUser.email, userId: sessionUser.id },
      requested: { email: row.email, userId: Number(row.user_id || 0) },
    };
  }
  return {
    status: "ok",
    token: row,
    destinationPath: normalizeDestinationPath(row.destination_path),
    createdSession: false,
  };
}

/**
 * Validate an email-action token and either continue, prompt for switch, or reject.
 * Does not auto-login when another account is already signed in.
 * Call from Route Handlers / Server Actions only when createSessionIfNeeded is true.
 */
export async function resolveEmailActionToken(
  rawToken: string,
  options: { consume?: boolean; createSessionIfNeeded?: boolean } = {},
): Promise<EmailActionResolveResult> {
  const consume = options.consume !== false;
  const createSessionIfNeeded = options.createSessionIfNeeded !== false;
  const session = await getCurrentUser();
  const sessionUser = session?.role === "user" ? session : null;

  const row = await loadTokenByRaw(rawToken);
  if (!row) {
    await logEmailActionEvent({
      eventType: "rejected_missing",
      sessionUserId: sessionUser?.id,
      sessionEmail: sessionUser?.email,
    });
    return { status: "invalid", reason: "missing", message: "This link is invalid or has already been used." };
  }

  if (!verifyStoredClaims(row)) {
    await logEmailActionEvent({
      tokenId: row.id,
      tokenHash: row.token_hash,
      userId: row.user_id,
      email: row.email,
      action: row.action,
      eventType: "rejected_signature",
      sessionUserId: sessionUser?.id,
      sessionEmail: sessionUser?.email,
    });
    return { status: "invalid", reason: "signature", message: "This link failed security verification." };
  }

  if (row.used_at && Boolean(row.single_use)) {
    await logEmailActionEvent({
      tokenId: row.id,
      tokenHash: row.token_hash,
      userId: row.user_id,
      email: row.email,
      action: row.action,
      eventType: "rejected_used",
      sessionUserId: sessionUser?.id,
      sessionEmail: sessionUser?.email,
    });
    return { status: "invalid", reason: "used", message: "This link has already been used." };
  }

  if (Number(row.expires_unix) * 1000 <= Date.now()) {
    await logEmailActionEvent({
      tokenId: row.id,
      tokenHash: row.token_hash,
      userId: row.user_id,
      email: row.email,
      action: row.action,
      eventType: "rejected_expired",
      sessionUserId: sessionUser?.id,
      sessionEmail: sessionUser?.email,
    });
    return { status: "invalid", reason: "expired", message: "This link has expired. Request a new email." };
  }

  if (sessionUser && !sessionMatchesToken(sessionUser, row)) {
    await logEmailActionEvent({
      tokenId: row.id,
      tokenHash: row.token_hash,
      userId: row.user_id,
      email: row.email,
      action: row.action,
      eventType: "mismatch",
      sessionUserId: sessionUser.id,
      sessionEmail: sessionUser.email,
      detail: "Authenticated session does not own this email action",
    });
    return {
      status: "mismatch",
      token: row,
      current: { email: sessionUser.email, userId: sessionUser.id },
      requested: { email: row.email, userId: Number(row.user_id || 0) },
    };
  }

  let owner: CustomerUser | null = null;
  if (row.user_id != null) {
    owner = await loadCustomerUser(Number(row.user_id));
    if (!owner) {
      await logEmailActionEvent({
        tokenId: row.id,
        tokenHash: row.token_hash,
        userId: row.user_id,
        email: row.email,
        action: row.action,
        eventType: "rejected_user",
        sessionUserId: sessionUser?.id,
        sessionEmail: sessionUser?.email,
      });
      return { status: "invalid", reason: "user", message: "The account for this link is unavailable." };
    }
  } else {
    // Invite before signup: resolve by email if they already registered.
    const byEmail = await findUserByEmail(String(row.email).toLowerCase());
    if (byEmail?.status === "Active") {
      owner = await loadCustomerUser(byEmail.id);
    }
  }

  // Password reset must not mint a session — the reset page authenticates via its own token.
  const allowSession = createSessionIfNeeded && row.action !== "password_reset" && Boolean(owner);
  let createdSession = false;
  let sessionCookie: { token: string; cookieOptions: ReturnType<typeof import("@/lib/auth").sessionCookieOptions> } | undefined;
  if (!sessionUser && allowSession && owner) {
    sessionCookie = await createCustomerSession(owner);
    createdSession = true;
  }

  if (consume && Boolean(row.single_use)) {
    await markTokenUsed(row.id);
  } else if (consume && !row.single_use) {
    await query(
      `UPDATE email_action_tokens SET used_at = COALESCE(used_at, NOW()) WHERE id = ?`,
      [row.id],
    );
  }

  // Completing an email_verification link marks the account email verified.
  if (consume && row.action === "email_verification" && owner?.id) {
    await query("UPDATE users SET email_verified = TRUE WHERE id = ?", [owner.id]).catch(() => undefined);
  }

  let destinationPath = normalizeDestinationPath(row.destination_path);
  if (!sessionUser && !owner) {
    // No account yet — send through login, then continue to the invite destination.
    destinationPath = `/login?next=${encodeURIComponent(destinationPath)}`;
  }

  await logEmailActionEvent({
    tokenId: row.id,
    tokenHash: row.token_hash,
    userId: row.user_id,
    email: row.email,
    action: row.action,
    eventType: createdSession ? "authenticated" : "continued",
    sessionUserId: owner?.id ?? sessionUser?.id ?? null,
    sessionEmail: owner?.email ?? sessionUser?.email ?? row.email,
    detail: destinationPath,
  });

  return {
    status: "ok",
    token: row,
    destinationPath,
    createdSession,
    sessionCookie,
  };
}

/** Logout the wrong account, then re-resolve the same email-action token. */
export async function switchAccountForEmailAction(rawToken: string): Promise<EmailActionResolveResult> {
  const preview = await loadTokenByRaw(rawToken);
  const session = await getCurrentUser();
  const sessionUser = session?.role === "user" ? session : null;

  await logEmailActionEvent({
    tokenId: preview?.id,
    tokenHash: preview?.token_hash,
    userId: preview?.user_id,
    email: preview?.email,
    action: preview?.action,
    eventType: "switch_account",
    sessionUserId: sessionUser?.id,
    sessionEmail: sessionUser?.email,
  });

  await clearCustomerSession();
  try {
    const cookieStore = await cookies();
    cookieStore.delete("ar360_impersonation");
  } catch {
    // optional cookie
  }

  return resolveEmailActionToken(rawToken, { consume: true, createSessionIfNeeded: true });
}

/** Secure CTA helper for future client-invite emails. */
export async function buildSecureClientInviteEmailUrl(input: {
  inviteToken: string;
  inviteeEmail: string;
  inviteeUserId?: number | null;
  customerUid?: string | null;
}): Promise<string> {
  const issued = await issueEmailActionToken({
    userId: input.inviteeUserId ?? null,
    email: input.inviteeEmail,
    customerUid: input.customerUid,
    action: "client_invite",
    destinationPath: `/dashboard/clients?invite=${encodeURIComponent(input.inviteToken)}`,
    singleUse: true,
  });
  return issued.url;
}

/** Secure CTA helper for future email-verification messages. */
export async function buildSecureEmailVerificationUrl(input: {
  userId: number;
  email: string;
  verifyToken: string;
}): Promise<string> {
  const issued = await issueEmailActionToken({
    userId: input.userId,
    email: input.email,
    action: "email_verification",
    destinationPath: `/verify-email?token=${encodeURIComponent(input.verifyToken)}`,
    singleUse: true,
  });
  return issued.url;
}
