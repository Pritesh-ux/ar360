import type { BillingCycle, PlanId } from "@/lib/billing/plans";
import { SUBSCRIPTION_PATH } from "@/lib/subscription/subscription-paths";

export function getPlanCheckoutPath(planId: PlanId, cycle: BillingCycle = "monthly") {
  if (planId === "trial") return "/signup";
  if (planId === "enterprise") return "/contact?subject=Enterprise%20plan%20inquiry";
  return `/dashboard/billing/checkout?plan=${encodeURIComponent(planId)}&period=${encodeURIComponent(cycle)}`;
}

export function getSubscriptionUpgradePath(cycle: BillingCycle = "monthly") {
  return `${SUBSCRIPTION_PATH}?period=${encodeURIComponent(cycle)}#available-plans`;
}

export function getPlanSignupPath(planId: PlanId, cycle: BillingCycle = "monthly") {
  if (planId === "enterprise") return "/contact?subject=Enterprise%20plan%20inquiry";
  if (planId === "trial") return "/signup";
  const params = new URLSearchParams({ plan: planId, period: cycle });
  return `/signup?${params.toString()}`;
}

export function getPlanCtaLabel(planId: PlanId) {
  if (planId === "trial") return "Start Free Trial";
  if (planId === "enterprise") return "Custom quote";
  return "Choose Plan";
}
