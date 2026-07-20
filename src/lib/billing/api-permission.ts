import { NextResponse } from "next/server";
import { assertCan, type AssertCanResult, type PermissionAction } from "@/lib/billing/permissions";

export function permissionDeniedJson(result: Extract<AssertCanResult, { allowed: false }>) {
  return NextResponse.json(
    {
      error: result.message,
      code: result.code,
      upgradeRequired: result.upgradeRequired,
      trialExpired: Boolean(result.trialExpired),
      limitType: result.limitType || null,
    },
    { status: 403 },
  );
}

/** Run assertCan and return a 403 JSON response when denied. */
export async function enforcePermission(
  customerUid: string,
  action: PermissionAction,
  options?: Parameters<typeof assertCan>[2],
) {
  const result = await assertCan(customerUid, action, options);
  if (result.allowed === false) {
    return { ok: false as const, response: permissionDeniedJson(result), result };
  }
  return { ok: true as const, context: result.context, result };
}
