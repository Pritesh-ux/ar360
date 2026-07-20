/**
 * Central subscription context — status + plan limits + usage + days remaining.
 * All dashboards and permission checks should read from here.
 */
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getUsageSnapshot, type UsageEngineSnapshot } from "@/lib/billing/usage-engine";
import type { PlanLimits } from "@/lib/billing/plan-enforcement";
import { checkSubscription, type SubscriptionCheckResult } from "@/lib/subscription/check-subscription";
import { query } from "@/lib/db";

export type SubscriptionContext = {
  customerUid: string;
  subscription: SubscriptionCheckResult;
  planId: string;
  limits: PlanLimits;
  usage: UsageEngineSnapshot;
  daysRemaining: number;
  renewAt: string | null;
  expiresAt: string | null;
  billingPeriod: string | null;
  cancelAtPeriodEnd: boolean;
  isEnterpriseCustom: boolean;
};

type SubRow = {
  plan_id: string | null;
  billing_period: string | null;
  current_period_end: Date | string | null;
  trial_ends_at: Date | string | null;
  grace_ends_at: Date | string | null;
  cancel_at_period_end: 0 | 1 | boolean | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  try {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  } catch {
    return null;
  }
}

export async function getSubscriptionContext(customerUid: string): Promise<SubscriptionContext> {
  const [subscription, limits, usage, rows] = await Promise.all([
    checkSubscription(customerUid),
    resolveCustomerPlanLimits(customerUid),
    getUsageSnapshot(customerUid),
    query<SubRow>(
      `SELECT plan_id, billing_period, current_period_end, trial_ends_at, grace_ends_at, cancel_at_period_end
         FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1`,
      [customerUid],
    ).catch(() => []),
  ]);

  const row = rows[0];
  const planId = String(row?.plan_id || limits.planId || subscription.plan?.id || "trial");
  const expiresAt =
    toIso(subscription.expiresAt) ||
    toIso(row?.grace_ends_at) ||
    toIso(row?.current_period_end) ||
    toIso(row?.trial_ends_at);
  const renewAt = toIso(row?.current_period_end);

  return {
    customerUid,
    subscription,
    planId,
    limits,
    usage,
    daysRemaining: subscription.daysRemaining,
    renewAt,
    expiresAt,
    billingPeriod: row?.billing_period || null,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    isEnterpriseCustom: Boolean(limits.isEnterpriseCustom),
  };
}
