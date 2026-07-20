import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";

/** Numeric hierarchy for upgrade-only rules. Do not compare by price. */
const PLAN_LEVEL_BY_ID: Record<string, number> = {
  trial: 0,
  free: 0,
  starter: 1,
  basic: 1,
  pro: 2,
  professional: 2,
  business: 3,
  enterprise: 4,
  agency: 4,
};

export function getPlanLevel(planId: string | null | undefined): number {
  const mapped = mapLegacyPlanId(String(planId || "trial").trim());
  return PLAN_LEVEL_BY_ID[mapped] ?? 0;
}

export function canUpgradeTo(currentPlanId: string, targetPlanId: string): boolean {
  return getPlanLevel(targetPlanId) > getPlanLevel(currentPlanId);
}

export function isSamePlanLevel(currentPlanId: string, targetPlanId: string): boolean {
  return getPlanLevel(targetPlanId) === getPlanLevel(currentPlanId);
}

export type UpgradeValidationResult =
  | { ok: true }
  | { ok: false; error: string; code: "downgrade" | "same_plan" | "invalid_plan" | "inactive" | "not_public" | "no_payment" };

export function validatePlanUpgrade(input: {
  currentPlanId: string;
  targetPlanId: string;
  targetActive?: boolean;
  targetPublic?: boolean;
  allowsOnlineCheckout?: boolean;
}): UpgradeValidationResult {
  const current = mapLegacyPlanId(input.currentPlanId);
  const target = mapLegacyPlanId(input.targetPlanId);

  if (!target || target === "trial") {
    return { ok: false, error: "Selected plan is not available for upgrade.", code: "invalid_plan" };
  }

  if (input.targetActive === false) {
    return { ok: false, error: "This plan is no longer available.", code: "inactive" };
  }

  if (input.targetPublic === false) {
    return { ok: false, error: "This plan is not available for self-service upgrade.", code: "not_public" };
  }

  if (input.allowsOnlineCheckout === false) {
    return { ok: false, error: "This plan cannot be purchased online. Contact sales.", code: "no_payment" };
  }

  if (isSamePlanLevel(current, target)) {
    return {
      ok: false,
      error: `You are already on the ${target} plan.`,
      code: "same_plan",
    };
  }

  if (!canUpgradeTo(current, target)) {
    return {
      ok: false,
      error: `Downgrades are not supported. Current plan: ${current}, requested: ${target}.`,
      code: "downgrade",
    };
  }

  return { ok: true };
}
