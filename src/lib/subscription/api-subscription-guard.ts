import { NextResponse } from "next/server";
import { checkSubscription } from "@/lib/subscription/check-subscription";
import { SUBSCRIPTION_PATH } from "@/lib/subscription/subscription-paths";

const REASON_MESSAGE: Record<string, string> = {
  expired: "Your plan has expired. Upgrade to continue using the panel.",
  cancelled: "Your subscription was cancelled. Choose a plan to continue.",
  payment_failed: "Your last payment failed. Update billing to restore access.",
  missing_plan: "No active plan found. Choose a plan to continue.",
  inactive: "Your account does not have an active plan.",
};

export function subscriptionRequiredJson(reason: string) {
  return NextResponse.json(
    {
      error: REASON_MESSAGE[reason] || REASON_MESSAGE.inactive,
      code: "SUBSCRIPTION_INACTIVE",
      upgradeRequired: true,
      trialExpired: reason === "expired",
      upgradeUrl: SUBSCRIPTION_PATH,
    },
    { status: 403 },
  );
}

/**
 * Panel API gate for routes that do not run the plan-permission engine.
 * Returns a 403 response once the trial or paid period has lapsed.
 */
export async function requireActiveSubscriptionApi(customerUid: string) {
  const subscription = await checkSubscription(customerUid);
  if (!subscription.active) {
    return { ok: false as const, response: subscriptionRequiredJson(subscription.reason) };
  }
  return { ok: true as const, subscription };
}
