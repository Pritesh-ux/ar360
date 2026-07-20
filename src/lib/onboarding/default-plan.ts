import { getPlanBySlug } from "@/lib/billing/plan-service";

/** Resolve the default signup plan from billing_plans (trial). */
export async function resolveDefaultSignupPlan() {
  const trial = await getPlanBySlug("trial");
  if (trial?.isActive !== false) return trial;

  const free = await getPlanBySlug("free");
  if (free?.isActive !== false) return free;

  return null;
}
