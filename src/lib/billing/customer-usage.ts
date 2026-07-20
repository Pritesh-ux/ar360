import { query } from "@/lib/db";
import { getCustomerBillingPeriod } from "@/lib/billing/billing-period";
import { getPlanLevel } from "@/lib/billing/plan-levels";
import { getPlanBySlug } from "@/lib/billing/plan-service";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";
import { resolvePlanLimits } from "@/lib/billing/resolve-plan-limits";
import {
  isExceeded,
  normalizePlanLimit,
  percentUsed,
  remainingFromLimit,
  usageThresholdState,
  type UsageThresholdState,
} from "@/lib/billing/limit-normalization";
import {
  PRODUCT_USAGE_COUNT_SQL,
  PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS,
  QR_USAGE_COUNT_SQL,
  SHARE_LINK_USAGE_COUNT_SQL,
  STORAGE_USAGE_SUM_SQL,
  STORAGE_USAGE_SUM_SQL_LEGACY,
} from "@/lib/billing/product-usage";
import { getBandwidthUsedBytesInPeriod } from "@/lib/billing/bandwidth";
import { checkSubscription } from "@/lib/subscription/check-subscription";

export type UsageMetric = {
  used: number;
  limit: number | null;
  remaining: number | null;
  exceeded: boolean;
  percentUsed: number | null;
  threshold: UsageThresholdState;
};

export type CustomerUsage = {
  customerId: string;
  plan: {
    id: string;
    name: string;
    slug: string;
    level: number;
  };
  subscription: {
    status: string;
    active: boolean;
    billingPeriod: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  products: UsageMetric;
  storage: {
    usedBytes: number;
    limitBytes: number | null;
    remainingBytes: number | null;
    percentUsed: number | null;
    exceeded: boolean;
    threshold: UsageThresholdState;
  };
  bandwidth: {
    usedBytes: number;
    limitBytes: number | null;
    remainingBytes: number | null;
    percentUsed: number | null;
    periodStart: string | null;
    periodEnd: string | null;
    exceeded: boolean;
    threshold: UsageThresholdState;
  };
  qrCodes: UsageMetric;
  shareLinks: UsageMetric;
};

type SubscriptionRow = {
  plan_id: string | null;
  status: string | null;
  billing_period: string | null;
  current_period_start: Date | string | null;
  current_period_end: Date | string | null;
  cancel_at_period_end: 0 | 1 | boolean;
};

async function safeCount(sql: string, values: (string | number)[]) {
  try {
    const rows = await query<{ total: number }>(sql, values);
    return Number(rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

async function safeSumBytes(sql: string, values: (string | number)[]) {
  try {
    const rows = await query<{ total: string | number | null }>(sql, values);
    return Number(rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

async function countBillableProducts(customerUid: string) {
  try {
    const rows = await query<{ total: number }>(PRODUCT_USAGE_COUNT_SQL, [customerUid]);
    return Number(rows[0]?.total || 0);
  } catch {
    try {
      const rows = await query<{ total: number }>(PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS, [customerUid]);
      return Number(rows[0]?.total || 0);
    } catch {
      return safeCount(
        "SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL",
        [customerUid],
      );
    }
  }
}

async function sumStorageBytes(customerUid: string) {
  try {
    const rows = await query<{ total: string | number | null }>(STORAGE_USAGE_SUM_SQL, [customerUid]);
    return Number(rows[0]?.total || 0);
  } catch {
    return safeSumBytes(STORAGE_USAGE_SUM_SQL_LEGACY, [customerUid]);
  }
}

function buildUsageMetric(used: number, limit: number | null): UsageMetric {
  return {
    used,
    limit,
    remaining: remainingFromLimit(limit, used),
    exceeded: isExceeded(used, limit),
    percentUsed: percentUsed(used, limit),
    threshold: usageThresholdState(used, limit),
  };
}

function buildBytesMetric(usedBytes: number, limitBytes: number | null) {
  return {
    usedBytes,
    limitBytes,
    remainingBytes: limitBytes == null ? null : Math.max(0, limitBytes - usedBytes),
    percentUsed: percentUsed(usedBytes, limitBytes),
    exceeded: isExceeded(usedBytes, limitBytes),
    threshold: usageThresholdState(usedBytes, limitBytes),
  };
}

function dateToIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  try {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  } catch {
    return null;
  }
}

/** Canonical customer usage snapshot — single source for dashboard, subscription, admin. */
export async function getCustomerUsage(customerUid: string): Promise<CustomerUsage> {
  const [subscriptionRows, subCheck, billingPeriod] = await Promise.all([
    query<SubscriptionRow>(
      `SELECT plan_id, status, billing_period, current_period_start, current_period_end, cancel_at_period_end
         FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1`,
      [customerUid],
    ).catch(() => []),
    checkSubscription(customerUid),
    getCustomerBillingPeriod(customerUid),
  ]);

  const subscription = subscriptionRows[0];
  const rawPlanId = subscription?.plan_id || subCheck.plan?.id || "trial";
  const planSlug = mapLegacyPlanId(rawPlanId);

  const [limits, canonicalPlan, products, storageBytes, bandwidthBytes, qrCodes, shareLinks] =
    await Promise.all([
      resolvePlanLimits(rawPlanId),
      getPlanBySlug(planSlug),
      countBillableProducts(customerUid),
      sumStorageBytes(customerUid),
      getBandwidthUsedBytesInPeriod(customerUid, billingPeriod.periodKey),
      safeCount(QR_USAGE_COUNT_SQL, [customerUid]),
      safeCount(SHARE_LINK_USAGE_COUNT_SQL, [customerUid]),
    ]);

  const productLimit = normalizePlanLimit(limits.products);
  const storageLimitBytes =
    limits.unlimitedStorage || limits.storageMb == null
      ? null
      : Math.round(Number(limits.storageMb) * 1024 * 1024);
  const bandwidthLimitBytes =
    limits.unlimitedBandwidth || limits.bandwidthGb == null
      ? null
      : Math.round(Number(limits.bandwidthGb) * 1024 * 1024 * 1024);
  const qrLimit = normalizePlanLimit(limits.qrCodes ?? null);
  const shareLinkLimit = normalizePlanLimit(limits.shareLinks ?? null);

  const subscriptionStatus = String(subscription?.status || subCheck.reason || "trialing").toLowerCase();

  return {
    customerId: customerUid,
    plan: {
      id: limits.planId,
      name: canonicalPlan?.name || limits.name || planSlug,
      slug: String(limits.planId),
      level: limits.isEnterpriseCustom ? getPlanLevel("enterprise") : getPlanLevel(planSlug),
    },
    subscription: {
      status: subscriptionStatus,
      active: subCheck.active,
      billingPeriod: subscription?.billing_period || null,
      periodStart: dateToIso(subscription?.current_period_start) || billingPeriod.periodStart,
      periodEnd: dateToIso(subscription?.current_period_end) || billingPeriod.periodEnd,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    },
    products: buildUsageMetric(products, productLimit),
    storage: buildBytesMetric(storageBytes, storageLimitBytes),
    bandwidth: {
      ...buildBytesMetric(bandwidthBytes, bandwidthLimitBytes),
      periodStart: billingPeriod.periodStart,
      periodEnd: billingPeriod.periodEnd,
    },
    qrCodes: buildUsageMetric(qrCodes, qrLimit),
    shareLinks: buildUsageMetric(shareLinks, shareLinkLimit),
  };
}
