import { getBillingPlans, type AdminBillingPlan } from "@/lib/billing/admin-plans";
import { mapLegacyPlanId, type PlanLimits } from "@/lib/billing/plan-enforcement";
import { resolvePlanLimits } from "@/lib/billing/resolve-plan-limits";
import {
  canUpgradeTo,
  getPlanLevel,
  validatePlanUpgrade,
  type UpgradeValidationResult,
} from "@/lib/billing/plan-levels";

export type CanonicalPlan = AdminBillingPlan & {
  slug: string;
  level: number;
};

function toCanonicalPlan(plan: AdminBillingPlan): CanonicalPlan {
  const slug = mapLegacyPlanId(plan.id);
  return { ...plan, slug, level: getPlanLevel(slug) };
}

/** Active public plans from billing_plans (DB). Static catalog is fallback inside admin-plans only. */
export async function getActivePublicPlans(): Promise<CanonicalPlan[]> {
  const plans = await getBillingPlans({ activeOnly: true });
  return plans
    .filter((plan) => plan.id !== "trial")
    .map(toCanonicalPlan)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.level - b.level);
}

function pickCanonicalBillingPlan(plans: AdminBillingPlan[], canonicalId: string): AdminBillingPlan | null {
  if (!plans.length) return null;
  return plans.reduce<AdminBillingPlan>((best, plan) => {
    const prefer =
      (plan.id === canonicalId && best.id !== canonicalId) ||
      (plan.isActive && !best.isActive) ||
      (plan.id === canonicalId && best.id === canonicalId && plan.sortOrder < best.sortOrder);
    return prefer ? plan : best;
  }, plans[0]);
}

export async function getPlanBySlug(slug: string): Promise<CanonicalPlan | null> {
  const mapped = mapLegacyPlanId(slug);
  const plans = await getBillingPlans({ activeOnly: false });
  const matches = plans.filter((item) => mapLegacyPlanId(item.id) === mapped);
  const plan = pickCanonicalBillingPlan(matches, mapped);
  return plan ? toCanonicalPlan(plan) : null;
}

export async function getPlanLimitsForCustomer(planId: string): Promise<PlanLimits> {
  return resolvePlanLimits(planId);
}

export function getUpgradeablePlans(currentPlanId: string, plans: CanonicalPlan[]): CanonicalPlan[] {
  const current = mapLegacyPlanId(currentPlanId);
  return plans.filter((plan) => canUpgradeTo(current, plan.slug));
}

export function validateUpgrade(input: {
  currentPlanId: string;
  targetPlanId: string;
  targetPlan?: CanonicalPlan | null;
}): UpgradeValidationResult {
  const target = input.targetPlan;
  const allowsOnlineCheckout = target
    ? target.id !== "enterprise" && (target.priceMonthlyInr != null || target.priceYearlyInr != null)
    : input.targetPlanId !== "enterprise";

  return validatePlanUpgrade({
    currentPlanId: input.currentPlanId,
    targetPlanId: input.targetPlanId,
    targetActive: target?.isActive ?? true,
    targetPublic: target ? target.id !== "trial" : true,
    allowsOnlineCheckout,
  });
}

export { getPlanLevel, canUpgradeTo, validatePlanUpgrade };
