/**
 * Self-service checkout eligibility from DB sales_channel — not hardcoded plan IDs.
 */
import { getBillingPlans, type AdminBillingPlan } from "@/lib/billing/admin-plans";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";

export async function getSelfServicePlans(): Promise<AdminBillingPlan[]> {
  const plans = await getBillingPlans({ activeOnly: true });
  return plans.filter(
    (plan) =>
      plan.salesChannel === "self_service" &&
      plan.priceMonthlyInr != null &&
      Number(plan.priceMonthlyInr) > 0,
  );
}

export async function isSelfServicePlanId(planId: string): Promise<boolean> {
  const mapped = mapLegacyPlanId(planId);
  const plans = await getSelfServicePlans();
  return plans.some((plan) => plan.id === mapped || mapLegacyPlanId(plan.id) === mapped);
}

export async function assertSelfServicePlan(planId: string): Promise<AdminBillingPlan> {
  const mapped = mapLegacyPlanId(planId);
  const plans = await getSelfServicePlans();
  const plan = plans.find((row) => row.id === mapped || mapLegacyPlanId(row.id) === mapped);
  if (!plan) {
    throw new Error("Plan is not available for self-service checkout.");
  }
  return plan;
}
