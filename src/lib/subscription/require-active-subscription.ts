import { redirect } from "next/navigation";
import { assertCan, type PermissionAction } from "@/lib/billing/permissions";
import { getSubscriptionContext } from "@/lib/billing/subscription-engine";
import { checkSubscription, type SubscriptionCheckResult } from "@/lib/subscription/check-subscription";
import { SUBSCRIPTION_EXPIRED_PATH } from "@/lib/subscription/subscription-paths";

/**
 * Soft panel gate. Expired customers may browse; mutations use assertCan separately.
 * Admin-suspended accounts are handled in layout via resolveAccountAccessLock.
 */
export async function requireActiveSubscription(
  customerUid: string,
): Promise<SubscriptionCheckResult> {
  const permission = await assertCan(customerUid, "access_dashboard");
  if (!permission.allowed) {
    redirect(SUBSCRIPTION_EXPIRED_PATH);
  }
  return permission.context.subscription;
}

/**
 * Page-level plan feature gate.
 * Inactive subscription → soft lock (page still opens; APIs block mutations).
 * Feature OFF on plan → upgrade/subscription page (Master Admin toggle).
 */
export async function requirePlanPermission(
  customerUid: string,
  action: PermissionAction,
) {
  const permission = await assertCan(customerUid, action);
  if (permission.allowed === false) {
    if (permission.code === "SUBSCRIPTION_INACTIVE") {
      return permission.context;
    }
    const upgradeUrl = permission.upgradeRequired
      ? `/dashboard/subscription?expired=1&upgrade=1&feature=${encodeURIComponent(action)}`
      : SUBSCRIPTION_EXPIRED_PATH;
    redirect(upgradeUrl);
  }
  return permission.context;
}

/** Page/API helper: load full subscription engine context (active customers only). */
export async function requireSubscriptionContext(customerUid: string) {
  const permission = await assertCan(customerUid, "access_dashboard");
  if (!permission.allowed) {
    redirect(SUBSCRIPTION_EXPIRED_PATH);
  }
  return permission.context;
}

export async function loadSubscriptionContext(customerUid: string) {
  return getSubscriptionContext(customerUid);
}

export { checkSubscription };
