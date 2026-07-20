import { redirect } from "next/navigation";
import { assertCan } from "@/lib/billing/permissions";
import { getSubscriptionContext } from "@/lib/billing/subscription-engine";
import { checkSubscription, type SubscriptionCheckResult } from "@/lib/subscription/check-subscription";
import { SUBSCRIPTION_EXPIRED_PATH } from "@/lib/subscription/subscription-paths";

/** Redirect expired/inactive customers to the canonical subscription page. */
export async function requireActiveSubscription(
  customerUid: string,
): Promise<SubscriptionCheckResult> {
  const permission = await assertCan(customerUid, "access_dashboard");
  if (!permission.allowed) {
    redirect(SUBSCRIPTION_EXPIRED_PATH);
  }
  return permission.context.subscription;
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
