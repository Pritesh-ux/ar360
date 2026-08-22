import { query } from "@/lib/db";

/** Primary landing for admin-suspended accounts — support tickets only. */
export const ACCOUNT_SUSPENDED_PATH = "/dashboard/support";

/** Suspended accounts may only open support (logout is outside dashboard). */
export const ACCOUNT_SUSPENDED_EXEMPT_PREFIXES = [
  "/dashboard/support",
  "/dashboard/account-suspended",
] as const;

export function isAccountSuspendedExemptPath(pathname: string) {
  const path = String(pathname || "").split("?")[0] || "";
  return ACCOUNT_SUSPENDED_EXEMPT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export type AccountAccessLock = "none" | "suspended";

/**
 * Master Admin suspend locks the panel to Support only.
 * Billing/subscription expiry stays on `customers.status = Active` + subscription engine.
 */
export async function resolveAccountAccessLock(
  customerUid: string,
): Promise<AccountAccessLock> {
  const uid = String(customerUid || "").trim();
  if (!uid) return "none";

  const rows = await query<{
    customer_status: string | null;
    user_status: string | null;
  }>(
    `SELECT c.status AS customer_status, u.status AS user_status
     FROM customers c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.customer_uid = ?
     LIMIT 1`,
    [uid],
  ).catch(() => []);

  const row = rows[0];
  if (!row) return "none";

  const customerStatus = String(row.customer_status || "");
  const userStatus = String(row.user_status || "");

  if (
    customerStatus === "Deleted" ||
    userStatus === "Deleted" ||
    customerStatus === "Suspended" ||
    userStatus === "Suspended"
  ) {
    return "suspended";
  }

  return "none";
}
