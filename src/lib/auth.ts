import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import { ensureAuthSchema, query } from "./db";
import { decodeSigned, encodeSigned, getAuthSecret } from "./signed-token";

export { encodeSigned } from "./signed-token";

export type CustomerUser = {
  id: number;
  userUid?: string | null;
  name: string;
  email: string;
  role: "user";
  customerUid?: string;
  status?: "Active" | "Suspended" | "Deleted";
  sessionUid?: string;
  sessionVersion?: number;
};

export type MasterAdminUser = {
  id: number;
  adminUid?: string | null;
  name: string;
  email: string;
  role: "admin";
  status?: "Active" | "Disabled";
  roleCode?: import("./permissions/admin-permissions").AdminRoleCode;
  permissions?: import("./permissions/admin-permissions").AdminPermission[];
};

export type AuthUser = CustomerUser | MasterAdminUser;

type CustomerUserRow = CustomerUser & {
  password_hash: string;
  status: "Active" | "Suspended" | "Deleted";
  two_factor_enabled: 0 | 1 | boolean;
};

type MasterAdminRow = MasterAdminUser & {
  password_hash: string;
  status: "Active" | "Disabled";
  two_factor_enabled: 0 | 1 | boolean;
};

const CUSTOMER_SESSION_COOKIE = "ar360_customer_session";
export const ADMIN_SESSION_COOKIE = "ar360_master_admin_session";
const IMPERSONATION_COOKIE = "ar360_impersonation";
const PENDING_2FA_COOKIE = "ar360_pending_2fa";
/** Set by middleware from the httpOnly cookie. Never trust client-supplied values. */
export const ADMIN_TOKEN_HEADER = "x-ar360-admin-token";
/** Legacy id header — still accepted if present after verified decode elsewhere. */
export const ADMIN_ID_HEADER = "x-ar360-admin-id";

export type ImpersonationContext = {
  adminId: number;
  adminEmail: string;
  adminName: string;
  customerUid: string;
  customerName: string;
  startedAt: string;
};
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const TWO_FACTOR_MAX_AGE = 60 * 10;

let cachedSecureCookie: boolean | null = null;

function shouldUseSecureCookie() {
  if (cachedSecureCookie !== null) return cachedSecureCookie;

  // Explicit override wins. Default to false for local http://localhost.
  if (process.env["AUTH_COOKIE_SECURE"] === "true") {
    cachedSecureCookie = true;
    return true;
  }
  if (process.env["AUTH_COOKIE_SECURE"] === "false") {
    cachedSecureCookie = false;
    return false;
  }

  cachedSecureCookie =
    process.env["NODE_ENV"] === "production" &&
    (process.env["VERCEL"] === "1" || process.env["AUTH_HTTPS"] === "true");
  return cachedSecureCookie;
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie(),
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    path: "/",
  };
}

function getSecret() {
  return getAuthSecret();
}

/** Collect cookie values from Cookie header + cookies() API; prefer a value that verifies. */
async function readSignedAuthToken(cookieName: string): Promise<string | undefined> {
  const candidates: string[] = [];

  const push = (value?: string | null) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || candidates.includes(trimmed)) return;
    candidates.push(trimmed);
  };

  try {
    const headerList = await headers();
    const raw = headerList.get("cookie") || "";
    for (const segment of raw.split(";")) {
      const idx = segment.indexOf("=");
      if (idx < 0) continue;
      const key = segment.slice(0, idx).trim();
      if (key !== cookieName) continue;
      let val = segment.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      push(val);
      try {
        push(decodeURIComponent(val));
      } catch {
        // ignore malformed encoding
      }
    }
  } catch {
    // ignore header parse failures
  }

  try {
    const cookieStore = await cookies();
    push(cookieStore.get(cookieName)?.value);
  } catch {
    // ignore cookies() failures in some route contexts
  }

  for (const token of candidates) {
    if (decodeSigned(token)) return token;
  }

  return candidates[0];
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashCode(code: string) {
  return createHmac("sha256", getSecret()).update(code).digest("hex");
}

export function createTwoFactorCode() {
  return String(randomInt(100000, 1000000));
}

function createCustomerUid() {
  return `CUS-${randomInt(100000, 999999)}`;
}

function createUserUid() {
  return `USR-${randomBytes(10).toString("hex").toUpperCase()}`;
}

function hashIp(ip?: string | null) {
  if (!ip) return "";
  return createHmac("sha256", getSecret()).update(ip).digest("hex").slice(0, 64);
}

export async function writeLoginLog(input: {
  actorType: "customer" | "master_admin";
  actorId?: number | null;
  email: string;
  status: "success" | "failed" | "blocked";
  reason?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await ensureAuthSchema();
  await query(
    `INSERT INTO auth_login_logs (actor_type, actor_id, email, status, reason, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.actorType,
      input.actorId ?? null,
      input.email.toLowerCase(),
      input.status,
      input.reason ?? "",
      hashIp(input.ip),
      (input.userAgent ?? "").slice(0, 255),
    ],
  );
}

export async function findUserByEmail(email: string) {
  await ensureAuthSchema();
  const normalizedEmail = email.toLowerCase();
  const rows = await query<CustomerUserRow>(
    `SELECT u.id, u.user_uid AS userUid, u.name, u.email, 'user' AS role, u.password_hash, u.status, u.two_factor_enabled, c.customer_uid AS customerUid
     FROM users u
     LEFT JOIN customers c ON c.user_id = u.id
     WHERE u.email = ? LIMIT 1`,
    [normalizedEmail],
  );
  return rows[0] || null;
}

export async function findMasterAdminByEmail(email: string) {
  await ensureAuthSchema();
  const normalizedEmail = email.toLowerCase();
  const rows = await query<MasterAdminRow>(
    "SELECT id, admin_uid AS adminUid, name, email, 'admin' AS role, password_hash, status, two_factor_enabled FROM master_admins WHERE email = ? LIMIT 1",
    [normalizedEmail],
  );
  return rows[0] || null;
}

export async function ensureCustomerForUser(user: { id: number; name: string; email: string }) {
  await ensureAuthSchema();
  const { ensureBillingPlanSchema } = await import("@/lib/billing/admin-plans");
  await ensureBillingPlanSchema();

  const existing = await query<{
    id: number;
    user_id: number;
    customer_uid: string;
    contact_name: string;
    email: string;
    plan_id: string;
    status: string;
  }>("SELECT id, user_id, customer_uid, contact_name, email, plan_id, status FROM customers WHERE user_id = ? LIMIT 1", [user.id]);

  if (existing[0]) return existing[0];

  let customerUid = createCustomerUid();
  for (let i = 0; i < 5; i += 1) {
    const taken = await query<{ total: number }>("SELECT COUNT(*) AS total FROM customers WHERE customer_uid = ?", [customerUid]);
    if (!Number(taken[0]?.total || 0)) break;
    customerUid = createCustomerUid();
  }

  await query(
    `INSERT INTO customers (user_id, customer_uid, contact_name, email, plan_id, status)
     VALUES (?, ?, ?, ?, 'trial', 'Active')`,
    [user.id, customerUid, user.name, user.email],
  );

  const { startTrialSubscription } = await import("@/server/billing/subscription.service");
  await startTrialSubscription(customerUid);

  const [customer] = await query<{
    id: number;
    user_id: number;
    customer_uid: string;
    contact_name: string;
    email: string;
    plan_id: string;
    status: string;
  }>("SELECT id, user_id, customer_uid, contact_name, email, plan_id, status FROM customers WHERE user_id = ? LIMIT 1", [user.id]);

  return customer;
}

export async function createUser({ name, email, password }: { name: string; email: string; password: string }) {
  await ensureAuthSchema();
  const normalizedEmail = email.toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) return null;

  let userUid = createUserUid();
  for (let i = 0; i < 5; i += 1) {
    const taken = await query<{ total: number }>("SELECT COUNT(*) AS total FROM users WHERE user_uid = ?", [userUid]);
    if (!Number(taken[0]?.total || 0)) break;
    userUid = createUserUid();
  }

  await query(
    `INSERT INTO users (user_uid, name, email, password_hash, role, status, email_verified, two_factor_enabled)
     VALUES (?, ?, ?, ?, 'user', 'Active', FALSE, FALSE)`,
    [userUid, name, normalizedEmail, hashPassword(password)],
  );

  const user = await findUserByEmail(normalizedEmail);
  if (!user) return null;
  const customer = await ensureCustomerForUser(user);
  return { ...user, customerUid: customer.customer_uid } satisfies CustomerUserRow;
}

export async function setTwoFactorChallenge(userOrId: AuthUser | string, code: string) {
  await ensureAuthSchema();
  const userId = typeof userOrId === "string" ? userOrId : userOrId.id;
  const role = typeof userOrId === "string" ? "user" : userOrId.role;
  const table = role === "admin" ? "master_admins" : "users";

  await query(
    `UPDATE ${table} SET two_factor_code_hash = ?, two_factor_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE), two_factor_attempts = 0 WHERE id = ?`,
    [hashCode(code), userId],
  );

  const cookieStore = await cookies();
  cookieStore.set(PENDING_2FA_COOKIE, encodeSigned({ userId, role, codeHash: hashCode(code) }), sessionCookieOptions(TWO_FACTOR_MAX_AGE));
}

export async function verifyTwoFactorCode(code: string) {
  await ensureAuthSchema();
  const cookieStore = await cookies();
  const pending = decodeSigned<{ userId: number; role: "user" | "admin"; codeHash?: string }>(cookieStore.get(PENDING_2FA_COOKIE)?.value);
  if (!pending?.userId) return null;

  const table = pending.role === "admin" ? "master_admins" : "users";
  const rows = await query<{
    id: number;
    name: string;
    email: string;
    status: "Active" | "Suspended" | "Deleted" | "Disabled";
    two_factor_code_hash: string | null;
    expired: 0 | 1;
    two_factor_attempts: number;
  }>(
    `SELECT id, name, email, status, two_factor_code_hash, two_factor_attempts, two_factor_expires_at < NOW() AS expired FROM ${table} WHERE id = ? LIMIT 1`,
    [pending.userId],
  );

  const user = rows[0];
  if (!user || !user.two_factor_code_hash || user.expired || user.two_factor_attempts >= 5) return null;
  if (pending.role === "admin" && user.status !== "Active") return null;
  if (pending.role === "user" && user.status !== "Active") return null;
  if (user.two_factor_code_hash !== hashCode(code)) {
    await query(`UPDATE ${table} SET two_factor_attempts = two_factor_attempts + 1 WHERE id = ?`, [pending.userId]);
    return null;
  }

  await query(`UPDATE ${table} SET two_factor_code_hash = NULL, two_factor_expires_at = NULL, two_factor_attempts = 0 WHERE id = ?`, [pending.userId]);
  cookieStore.delete(PENDING_2FA_COOKIE);

  if (pending.role === "admin") return { id: user.id, name: user.name, email: user.email, role: "admin" } satisfies MasterAdminUser;

  const customer = await ensureCustomerForUser({ id: user.id, name: user.name, email: user.email });
  return { id: user.id, name: user.name, email: user.email, role: "user", customerUid: customer.customer_uid } satisfies CustomerUser;
}

export async function createSession(user: AuthUser) {
  if (user.role === "admin") return createMasterAdminSession(user);
  return createCustomerSession(user);
}

export async function createCustomerSession(user: CustomerUser, request?: Request) {
  const customer = await ensureCustomerForUser(user);
  if (customer.status !== "Active") {
    throw new Error("Customer account is not active.");
  }

  const { createCustomerSessionRecord, getUserSessionVersion } = await import("@/lib/account/sessions.service");
  const { ensureSessionVersionColumn } = await import("@/lib/account/schema");
  await ensureSessionVersionColumn();

  let sessionRequest = request;
  if (!sessionRequest) {
    const h = await headers();
    sessionRequest = new Request("http://localhost", {
      headers: {
        "user-agent": h.get("user-agent") || "",
        "x-forwarded-for": h.get("x-forwarded-for") || "",
        "x-real-ip": h.get("x-real-ip") || "",
        "cf-ipcountry": h.get("cf-ipcountry") || "",
      },
    });
  }

  const sessionUid = await createCustomerSessionRecord({
    userId: user.id,
    customerUid: customer.customer_uid,
    request: sessionRequest,
  });
  const sessionVersion = await getUserSessionVersion(user.id);

  const cookieStore = await cookies();
  cookieStore.set(
    CUSTOMER_SESSION_COOKIE,
    encodeSigned({
      ...user,
      role: "user",
      customerUid: customer.customer_uid,
      sessionUid,
      sessionVersion,
    }),
    sessionCookieOptions(SESSION_MAX_AGE),
  );
  await query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);

  const { writeCustomerActivity } = await import("@/lib/account/activity.service");
  const { createCustomerNotification } = await import("@/lib/account/notify.service");
  await writeCustomerActivity({
    customerUid: customer.customer_uid,
    userId: user.id,
    eventType: "login",
    title: "Signed in",
    detail: "New login to your account.",
  }).catch(() => {});
  await createCustomerNotification({
    customerUid: customer.customer_uid,
    userId: user.id,
    category: "security",
    title: "New login detected",
    body: "A new sign-in to your AR360 account was detected.",
    href: "/dashboard/settings?tab=security",
    dedupeKey: `login:${sessionUid}`,
  }).catch(() => {});
}

export async function createMasterAdminSession(user: MasterAdminUser) {
  const rows = await query<{ status: "Active" | "Disabled" }>("SELECT status FROM master_admins WHERE id = ? LIMIT 1", [user.id]);
  if (rows[0]?.status !== "Active") {
    throw new Error("Master admin account is disabled.");
  }
  const cookieStore = await cookies();
  // Keep the signed payload small and stable — only identity fields.
  const token = encodeSigned({
    id: user.id,
    name: user.name,
    email: user.email,
    role: "admin" as const,
  });
  cookieStore.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE));
  await query("UPDATE master_admins SET last_login_at = NOW() WHERE id = ?", [user.id]);
}

export async function clearCustomerSession() {
  const cookieStore = await cookies();
  const cleared = { path: "/", maxAge: 0 };
  cookieStore.set(CUSTOMER_SESSION_COOKIE, "", cleared);
  cookieStore.set(IMPERSONATION_COOKIE, "", cleared);
  cookieStore.set(PENDING_2FA_COOKIE, "", cleared);
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  const cleared = { path: "/", maxAge: 0 };
  cookieStore.set(ADMIN_SESSION_COOKIE, "", cleared);
  cookieStore.set(PENDING_2FA_COOKIE, "", cleared);
}

/** Clears customer + master-admin cookies. Prefer the scoped helpers when logging out one side only. */
export async function clearSession() {
  await clearCustomerSession();
  await clearAdminSession();
}

export async function startCustomerImpersonation(admin: MasterAdminUser, customerUid: string) {
  await ensureAuthSchema();

  const rows = await query<{
    user_id: number;
    customer_uid: string;
    contact_name: string;
    email: string;
    status: string;
    user_status: "Active" | "Suspended" | "Deleted";
    user_name: string;
    session_version: number;
  }>(
    `SELECT c.user_id, c.customer_uid, c.contact_name, c.email, c.status,
            u.status AS user_status, u.name AS user_name, u.session_version
     FROM customers c
     JOIN users u ON u.id = c.user_id
     WHERE c.customer_uid = ? LIMIT 1`,
    [customerUid],
  );

  const row = rows[0];
  if (!row) throw new Error("Customer not found.");
  if (row.status === "Deleted" || row.user_status === "Deleted") {
    throw new Error("Cannot impersonate a deleted account.");
  }

  const { createCustomerSessionRecord } = await import("@/lib/account/sessions.service");
  const sessionUid = await createCustomerSessionRecord({
    userId: row.user_id,
    customerUid: row.customer_uid,
  });

  const customerUser: CustomerUser = {
    id: row.user_id,
    name: row.user_name,
    email: row.email,
    role: "user",
    customerUid: row.customer_uid,
    status: "Active",
    sessionUid,
    sessionVersion: row.session_version,
  };

  const cookieStore = await cookies();
  cookieStore.set(
    CUSTOMER_SESSION_COOKIE,
    encodeSigned({
      ...customerUser,
      role: "user",
      customerUid: row.customer_uid,
      sessionUid,
      sessionVersion: row.session_version,
    }),
    sessionCookieOptions(SESSION_MAX_AGE),
  );

  const context: ImpersonationContext = {
    adminId: admin.id,
    adminEmail: admin.email,
    adminName: admin.name,
    customerUid: row.customer_uid,
    customerName: row.contact_name,
    startedAt: new Date().toISOString(),
  };
  cookieStore.set(IMPERSONATION_COOKIE, encodeSigned(context), sessionCookieOptions(SESSION_MAX_AGE));

  return customerUser;
}

export async function stopCustomerImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
  cookieStore.delete(IMPERSONATION_COOKIE);
}

export async function getImpersonationContext() {
  const cookieStore = await cookies();
  return decodeSigned<ImpersonationContext>(cookieStore.get(IMPERSONATION_COOKIE)?.value);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  const session = decodeSigned<CustomerUser>(rawCookie);
  if (!session?.id) {
    if (rawCookie) {
      try {
        cookieStore.delete(CUSTOMER_SESSION_COOKIE);
      } catch {
        // Ignored: read-only render
      }
    }
    return null;
  }

  const { ensureSessionVersionColumn } = await import("@/lib/account/schema");
  await ensureSessionVersionColumn();

  const rows = await query<{
    id: number;
    userUid: string | null;
    name: string;
    email: string;
    status: "Active" | "Suspended" | "Deleted";
    session_version: number;
    customerUid: string | null;
    customerStatus: "Active" | "Suspended" | "Deleted" | null;
  }>(
    `SELECT u.id, u.user_uid AS userUid, u.name, u.email, u.status, u.session_version,
            c.customer_uid AS customerUid, c.status AS customerStatus
     FROM users u
     LEFT JOIN customers c ON c.user_id = u.id
     WHERE u.id = ? LIMIT 1`,
    [session.id],
  );

  const user = rows[0];
  const impersonation = decodeSigned<ImpersonationContext>(cookieStore.get(IMPERSONATION_COOKIE)?.value);
  const isAdminImpersonating = Boolean(
    impersonation?.customerUid &&
      (impersonation.customerUid === user?.customerUid || impersonation.customerUid === session.customerUid),
  );

  // Normal logins block suspended accounts; admin impersonation may open them for support.
  if (
    !user
    || user.status === "Deleted"
    || user.customerStatus === "Deleted"
    || ((!isAdminImpersonating) && (user.status !== "Active" || user.customerStatus === "Suspended"))
  ) {
    try {
      cookieStore.delete(CUSTOMER_SESSION_COOKIE);
    } catch {
      // Ignored: request is read-only (Server Component render)
    }
    return null;
  }

  const { isSessionValid, touchCustomerSession } = await import("@/lib/account/sessions.service");
  const valid = await isSessionValid({
    userId: user.id,
    sessionUid: session.sessionUid,
    sessionVersion: session.sessionVersion ?? user.session_version,
  });
  if (!valid) {
    try {
      cookieStore.delete(CUSTOMER_SESSION_COOKIE);
    } catch {
      // Ignored
    }
    return null;
  }

  if (session.sessionUid) {
    await touchCustomerSession(session.sessionUid).catch(() => {});
  }

  return {
    id: user.id,
    userUid: user.userUid,
    name: user.name,
    email: user.email,
    role: "user" as const,
    customerUid: user.customerUid ?? session.customerUid,
    status: user.status,
    sessionUid: session.sessionUid,
    sessionVersion: session.sessionVersion ?? user.session_version,
  } satisfies CustomerUser;
}

export async function getCurrentMasterAdmin(options?: { token?: string }) {
  let sessionId: number | null = null;

  // 1) Explicit token from route handler request.cookies
  const preferred = options?.token?.trim();
  if (preferred) {
    const session = decodeSigned<MasterAdminUser>(preferred);
    if (session?.id) sessionId = session.id;
  }

  // 2) Middleware-forwarded httpOnly cookie token (and legacy admin id header)
  if (sessionId == null) {
    try {
      const headerList = await headers();
      const forwarded = headerList.get(ADMIN_TOKEN_HEADER);
      if (forwarded) {
        const session = decodeSigned<MasterAdminUser>(forwarded);
        if (session?.id) sessionId = session.id;
      }
      if (sessionId == null) {
        const fromProxyId = headerList.get(ADMIN_ID_HEADER);
        if (fromProxyId) {
          const parsed = Number(fromProxyId);
          if (Number.isFinite(parsed) && parsed > 0) sessionId = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  // 3) Fallback: cookies() / raw Cookie header
  if (sessionId == null) {
    const token = await readSignedAuthToken(ADMIN_SESSION_COOKIE);
    const session = decodeSigned<MasterAdminUser>(token);
    if (!session?.id) return null;
    sessionId = session.id;
  }

  const rows = await query<{
    id: number;
    adminUid: string | null;
    name: string;
    email: string;
    status: "Active" | "Disabled";
    roleCode: string | null;
  }>(
    `SELECT ma.id, ma.admin_uid AS adminUid, ma.name, ma.email, ma.status, ar.code AS roleCode
     FROM master_admins ma
     LEFT JOIN admin_roles ar ON ar.id = ma.role_id
     WHERE ma.id = ? LIMIT 1`,
    [sessionId],
  );

  const admin = rows[0];
  if (!admin || admin.status !== "Active") {
    return null;
  }

  return {
    id: admin.id,
    adminUid: admin.adminUid,
    name: admin.name,
    email: admin.email,
    role: "admin" as const,
    status: admin.status,
    roleCode: (admin.roleCode as MasterAdminUser["roleCode"]) ?? undefined,
  } satisfies MasterAdminUser;
}

export async function getAnyCurrentUser() {
  return (await getCurrentMasterAdmin()) || (await getCurrentUser());
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user?.customerUid) return null;
  return user;
}

export async function requireApiAdmin(options?: { token?: string }) {
  const admin = await getCurrentMasterAdmin(options);
  if (!admin) return null;
  return admin;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentMasterAdmin();
  if (!user) redirect("/master-admin/login");
  return user;
}
