import { checkSubscription } from "@/lib/subscription/check-subscription";
import { getCustomerOnboarding, isOnboardingComplete } from "@/lib/onboarding/onboarding.service";
import { DASHBOARD_PATH, ONBOARDING_PATH } from "@/lib/onboarding/onboarding-paths";

export type PostAuthDestinationOptions = {
  plan?: string;
  period?: string;
  customerStatus?: string;
  userStatus?: string;
};

const SUSPENDED_PATH = "/login?error=account_suspended";
const EXPIRED_PATH = "/dashboard/subscription?expired=1";

export { isOnboardingExemptPath, ONBOARDING_EXEMPT_PREFIXES } from "@/lib/onboarding/onboarding-paths";

/** Canonical post-auth redirect for customer sessions. */
export async function resolveCustomerPostAuthDestination(
  customerUid: string,
  options: PostAuthDestinationOptions = {},
): Promise<string> {
  const userStatus = String(options.userStatus || "Active");
  const customerStatus = String(options.customerStatus || "Active");

  if (userStatus === "Suspended" || userStatus === "Deleted" || customerStatus === "Suspended" || customerStatus === "Deleted") {
    return SUSPENDED_PATH;
  }

  if (options.plan && options.plan !== "trial" && options.plan !== "enterprise") {
    const period = options.period || "monthly";
    return `/dashboard/billing/checkout?plan=${encodeURIComponent(options.plan)}&period=${encodeURIComponent(period)}`;
  }

  const onboarding = await getCustomerOnboarding(customerUid);
  if (!isOnboardingComplete(onboarding)) {
    return ONBOARDING_PATH;
  }

  const sub = await checkSubscription(customerUid);
  if (!sub.active) {
    return EXPIRED_PATH;
  }

  return DASHBOARD_PATH;
}
