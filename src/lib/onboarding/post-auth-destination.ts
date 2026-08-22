import { checkSubscription } from "@/lib/subscription/check-subscription";
import { getCustomerOnboarding, isOnboardingComplete } from "@/lib/onboarding/onboarding.service";
import { DASHBOARD_PATH, ONBOARDING_PATH } from "@/lib/onboarding/onboarding-paths";
import {
  ACCOUNT_SUSPENDED_PATH,
  resolveAccountAccessLock,
} from "@/lib/account/account-access";

export type PostAuthDestinationOptions = {
  plan?: string;
  period?: string;
  customerStatus?: string;
  userStatus?: string;
};

const EXPIRED_PATH = "/dashboard/subscription?expired=1";

export { isOnboardingExemptPath, ONBOARDING_EXEMPT_PREFIXES } from "@/lib/onboarding/onboarding-paths";

/** Canonical post-auth redirect for customer sessions. */
export async function resolveCustomerPostAuthDestination(
  customerUid: string,
  options: PostAuthDestinationOptions = {},
): Promise<string> {
  const userStatus = String(options.userStatus || "Active");
  const customerStatus = String(options.customerStatus || "Active");

  if (userStatus === "Deleted" || customerStatus === "Deleted") {
    return "/login?error=account_suspended";
  }

  const lock = await resolveAccountAccessLock(customerUid);
  if (lock === "suspended") {
    return ACCOUNT_SUSPENDED_PATH;
  }

  if (options.plan && options.plan !== "trial" && options.plan !== "enterprise") {
    const period = options.period || "monthly";
    return `/dashboard/billing/checkout?plan=${encodeURIComponent(options.plan)}&period=${encodeURIComponent(period)}`;
  }

  const onboarding = await getCustomerOnboarding(customerUid);
  if (!onboarding) {
    // Ensure a row exists so new/edge accounts are not treated as "complete".
    const { initializeCustomerOnboarding } = await import("@/lib/onboarding/onboarding.service");
    await initializeCustomerOnboarding(customerUid, "login");
    const created = await getCustomerOnboarding(customerUid);
    if (!isOnboardingComplete(created)) {
      return ONBOARDING_PATH;
    }
  } else if (!isOnboardingComplete(onboarding)) {
    return ONBOARDING_PATH;
  }

  const sub = await checkSubscription(customerUid);
  if (!sub.active) {
    return EXPIRED_PATH;
  }

  return DASHBOARD_PATH;
}
