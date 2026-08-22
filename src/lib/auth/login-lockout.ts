import { getPlatformSettings } from "@/lib/master-admin-settings";
import { query } from "@/lib/db";

export type LoginLockoutPolicy = {
  maxLoginAttempts: number;
  lockMinutes: number;
};

export type LoginLockoutDecision = {
  locked: boolean;
  failedAttempts: number;
  maxLoginAttempts: number;
  lockMinutes: number;
  retryAfterSec: number;
};

/** Pure policy helper for unit tests. */
export function evaluateLoginLockout(
  failedAttemptsInWindow: number,
  policy: LoginLockoutPolicy,
): Omit<LoginLockoutDecision, "failedAttempts"> & { failedAttempts: number } {
  const maxLoginAttempts = Math.max(0, Math.floor(Number(policy.maxLoginAttempts) || 0));
  const lockMinutes = Math.max(1, Math.floor(Number(policy.lockMinutes) || 30));
  const failedAttempts = Math.max(0, Math.floor(failedAttemptsInWindow) || 0);
  const locked = maxLoginAttempts > 0 && failedAttempts >= maxLoginAttempts;
  return {
    locked,
    failedAttempts,
    maxLoginAttempts,
    lockMinutes,
    retryAfterSec: locked ? lockMinutes * 60 : 0,
  };
}

export async function getLoginLockoutPolicy(): Promise<LoginLockoutPolicy> {
  const settings = await getPlatformSettings().catch(() => null);
  return {
    maxLoginAttempts: Number(settings?.maxLoginAttempts ?? 5) || 5,
    lockMinutes: Number(settings?.lockMinutes ?? 30) || 30,
  };
}

/**
 * Account-level lockout based on recent failed logins for this email.
 * Complements IP rate limiting (does not replace it).
 */
export async function checkEmailLoginLockout(input: {
  email: string;
  actorType: "customer" | "master_admin";
}): Promise<LoginLockoutDecision> {
  const email = String(input.email || "").trim().toLowerCase();
  const policy = await getLoginLockoutPolicy();
  if (!email || policy.maxLoginAttempts <= 0) {
    return {
      locked: false,
      failedAttempts: 0,
      maxLoginAttempts: policy.maxLoginAttempts,
      lockMinutes: policy.lockMinutes,
      retryAfterSec: 0,
    };
  }

  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total
       FROM auth_login_logs
      WHERE email = ?
        AND actor_type = ?
        AND status = 'failed'
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [email, input.actorType, policy.lockMinutes],
  ).catch(() => [{ total: 0 }]);

  const failedAttempts = Number(rows[0]?.total || 0);
  return evaluateLoginLockout(failedAttempts, policy);
}
