import { query } from "@/lib/db";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";

export type BillingPeriodRange = {
  periodStart: string;
  periodEnd: string;
  periodKey: string;
  source: "subscription" | "calendar_month";
};

function toUtcIso(date: Date): string {
  return date.toISOString();
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function periodKeyFromDates(start: Date, end: Date): string {
  const s = start.toISOString().slice(0, 10);
  const e = end.toISOString().slice(0, 10);
  return `${s}_${e}`;
}

function calendarMonthFallback(now = new Date()): BillingPeriodRange {
  const start = startOfUtcMonth(now);
  const end = endOfUtcMonth(now);
  return {
    periodStart: toUtcIso(start),
    periodEnd: toUtcIso(end),
    periodKey: periodKeyFromDates(start, end),
    source: "calendar_month",
  };
}

type SubscriptionPeriodRow = {
  current_period_start: Date | string | null;
  current_period_end: Date | string | null;
  billing_period: string | null;
  plan_id: string | null;
};

async function planBandwidthResetsMonthly(planId: string | null): Promise<boolean> {
  if (!planId) return false;
  const mapped = mapLegacyPlanId(planId);
  const rows = await query<{ bandwidth_resets_monthly: 0 | 1 | boolean }>(
    `SELECT bandwidth_resets_monthly
       FROM billing_plans
      WHERE id IN (?, ?)
      ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
      LIMIT 1`,
    [planId, mapped, planId],
  ).catch(() => []);
  return Boolean(rows[0]?.bandwidth_resets_monthly);
}

function subscriptionWindow(startRaw: Date | string, endRaw: Date | string): BillingPeriodRange | null {
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  return {
    periodStart: toUtcIso(start),
    periodEnd: toUtcIso(end),
    periodKey: periodKeyFromDates(start, end),
    source: "subscription",
  };
}

/**
 * Bandwidth metering window.
 * If the plan has `bandwidthResetsMonthly` and billing is yearly, use calendar month.
 * Otherwise use the full subscription period. Storage is never reset here.
 */
export async function getCustomerBillingPeriod(customerUid: string): Promise<BillingPeriodRange> {
  if (!customerUid) return calendarMonthFallback();

  const rows = await query<SubscriptionPeriodRow>(
    `SELECT current_period_start, current_period_end, billing_period, plan_id
       FROM customer_subscriptions
      WHERE customer_uid = ?
      LIMIT 1`,
    [customerUid],
  ).catch(() => []);

  const sub = rows[0];
  if (!sub) return calendarMonthFallback();

  const billingPeriod = String(sub.billing_period || "").toLowerCase();
  const isYearly = billingPeriod === "yearly" || billingPeriod === "annual";
  const resetsMonthly = await planBandwidthResetsMonthly(sub.plan_id);

  if (isYearly && resetsMonthly) {
    return calendarMonthFallback();
  }

  if (sub.current_period_start && sub.current_period_end) {
    const window = subscriptionWindow(sub.current_period_start, sub.current_period_end);
    if (window) return window;
  }

  return calendarMonthFallback();
}

export function getCalendarMonthPeriod(now = new Date()): BillingPeriodRange {
  return calendarMonthFallback(now);
}
