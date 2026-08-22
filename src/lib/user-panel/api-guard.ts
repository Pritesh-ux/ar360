import { NextResponse } from "next/server";
import { requireApiUser, type CustomerUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  clientCustomerScopeIsValid,
  getSessionCustomerUid,
} from "@/lib/customerIsolation";

export type ScopedCustomerUser = CustomerUser & { customerUid: string };

export async function requireScopedApiUser(options?: {
  allowSuspended?: boolean;
}): Promise<ScopedCustomerUser | null> {
  const user = await requireApiUser(options);
  if (!user) return null;

  const customerUid = getSessionCustomerUid(user);
  if (!customerUid) return null;

  const rows = await query<{ user_status: string; customer_status: string }>(
    `SELECT u.status AS user_status, c.status AS customer_status
     FROM users u
     INNER JOIN customers c ON c.user_id = u.id
     WHERE u.id = ? AND c.customer_uid = ?
     LIMIT 1`,
    [user.id, customerUid],
  );
  const row = rows[0];
  if (!row || row.user_status === "Deleted" || row.customer_status === "Deleted") {
    return null;
  }

  const suspended =
    row.user_status === "Suspended" || row.customer_status === "Suspended";
  if (suspended && !options?.allowSuspended) {
    return null;
  }
  if (!suspended && row.user_status !== "Active") {
    return null;
  }

  return { ...user, customerUid, status: user.status ?? "Active" };
}

export function rejectScopedApiUser(message = "Login required.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function rejectForbiddenScope(message = "Access denied.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function rejectSuspendedAccount() {
  return NextResponse.json(
    { error: "Your account is suspended. Contact support to restore access." },
    { status: 403 },
  );
}

/** Reject when client sends a customerUid that does not match the session. */
export function assertClientCustomerScope(user: CustomerUser, clientCustomerUid?: string | null) {
  if (!clientCustomerScopeIsValid(user, clientCustomerUid)) {
    return rejectForbiddenScope("Customer scope mismatch.");
  }
  return null;
}
