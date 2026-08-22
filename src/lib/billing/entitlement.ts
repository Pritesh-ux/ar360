import { query } from "@/lib/db";
import { getBillingPlans } from "@/lib/billing/admin-plans";
import { getCustomerBandwidthUsedGb } from "@/lib/billing/bandwidth";
import { checkSubscription } from "@/lib/subscription/check-subscription";
import { resolvePlanLimits } from "@/lib/billing/resolve-plan-limits";
import {
  PRODUCT_USAGE_COUNT_SQL,
  QR_USAGE_COUNT_SQL,
  SHARE_LINK_USAGE_COUNT_SQL,
} from "@/lib/billing/product-usage";
import {
  checkUploadEntitlement,
  checkViewerEntitlement,
  checkEmbedEntitlement,
  checkArEntitlement,
  checkQrEntitlement,
  checkShareEntitlement,
  checkEnterpriseModelEntitlement,
  formatTrialDurationLabel,
  mapLegacyPlanId,
  normalizeTrialHours,
  type EntitlementResult,
  type PlanLimits,
  type UsageSnapshot,
} from "@/lib/billing/plan-enforcement";

export type BillingAction =
  | "upload"
  | "create_product"
  | "upload_product"
  | "edit"
  | "save"
  | "publish"
  | "save_publish"
  | "poster"
  | "share"
  | "embed"
  | "qr"
  | "viewer"
  | "ar";

export type BillingEntitlementSnapshot = {
  customerUid: string;
  plan: PlanLimits & {
    priceMonthlyInr?: number | null;
    priceYearlyInr?: number | null;
    features?: string[];
  };
  usage: UsageSnapshot & {
    bandwidthUsedMb: number;
    storageUsedGb: number;
    bandwidthUsedGb: number;
  };
  entitlement: EntitlementResult;
  action: BillingAction;
};

type SubscriptionRow = {
  plan_id: string | null;
  status: string | null;
  trial_started_at: Date | string | null;
  trial_ends_at: Date | string | null;
  current_period_start: Date | string | null;
  current_period_end: Date | string | null;
  grace_ends_at?: Date | string | null;
};

type CountRow = { total: number };
type SumRow = { total: string | number | null };

function dateToIso(value: Date | string | null | undefined) {
  if (!value) return null;
  try {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  } catch {
    return null;
  }
}

async function safeCount(sql: string, values: (string | number)[]) {
  try {
    const rows = await query<CountRow>(sql, values);
    return Number(rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

async function safeSumMb(sql: string, values: any[]) {
  try {
    const rows = await query<SumRow>(sql, values);
    return Number(rows[0]?.total || 0) / 1024 / 1024;
  } catch {
    return 0;
  }
}

async function getSubscription(customerUid: string) {
  const rows = await query<SubscriptionRow>(
    `SELECT plan_id, status, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_ends_at
       FROM customer_subscriptions
      WHERE customer_uid = ?
      LIMIT 1`,
    [customerUid],
  ).catch(() => []);

  return rows[0] || null;
}

async function ensureTrialIfMissing(customerUid: string) {
  const current = await getSubscription(customerUid);
  if (current) return current;

  try {
    const { startTrialSubscription } = await import("@/server/billing/subscription.service");
    await startTrialSubscription(customerUid);
  } catch {
    // Fallback when subscription service / tables are unavailable.
    try {
      const limits = await resolvePlanLimits("trial");
      const hours = normalizeTrialHours(limits.trialHours);
      const products = limits.products ?? 10;
      const storageMb = limits.storageMb ?? 100;
      const bandwidthMb = limits.unlimitedBandwidth
        ? null
        : Math.round((limits.bandwidthGb ?? 1) * 1024);
      await query(
        `INSERT INTO customer_subscriptions
         (customer_uid, plan_id, status, trial_started_at, trial_ends_at, current_period_start, current_period_end, trial_used, product_limit, storage_limit_mb, bandwidth_limit_mb)
         VALUES (?, 'trial', 'trialing', NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR), NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR), 1, ?, ?, ?)`,
        [customerUid, hours, hours, products, storageMb, bandwidthMb],
      );
    } catch {
      // If table does not exist yet, fallback logic below still keeps UI safe.
    }
  }

  return getSubscription(customerUid);
}

export async function getBillingEntitlement(input: {
  customerUid: string;
  action?: BillingAction | string | null;
}): Promise<BillingEntitlementSnapshot> {
  const action = (input.action || "upload") as BillingAction;
  const subscription = await ensureTrialIfMissing(input.customerUid);
  const rawPlanId = subscription?.plan_id || "trial";
  const planId = mapLegacyPlanId(rawPlanId);
  const [basePlan, billingPlans] = await Promise.all([
    resolvePlanLimits(rawPlanId),
    getBillingPlans({ activeOnly: false }).catch(() => []),
  ]);
  const adminPlan =
    billingPlans.find((plan) => plan.id === rawPlanId) ||
    billingPlans.find((plan) => plan.id === planId) ||
    (rawPlanId.toLowerCase().startsWith("ecp_")
      ? billingPlans.find((plan) => plan.id.toLowerCase() === rawPlanId.toLowerCase())
      : undefined);
  const plan: BillingEntitlementSnapshot["plan"] = {
    ...basePlan,
    priceMonthlyInr: adminPlan?.priceMonthlyInr ?? null,
    priceYearlyInr: adminPlan?.priceYearlyInr ?? null,
    features: adminPlan?.features,
  };

  const [productsUsed, modelsUsed, arExperiencesUsed, qrCodesUsed, shareLinksUsed] = await Promise.all([
    safeCount(PRODUCT_USAGE_COUNT_SQL, [input.customerUid]).catch(() =>
      safeCount("SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL", [
        input.customerUid,
      ]),
    ),
    safeCount(
      `SELECT COUNT(*) AS total FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND (COALESCE(model_url, '') <> '' OR LOWER(COALESCE(file_name, '')) LIKE '%.glb')`,
      [input.customerUid],
    ),
    safeCount(
      `SELECT COUNT(*) AS total FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND LOWER(COALESCE(status, '')) IN ('published', 'active')`,
      [input.customerUid],
    ),
    safeCount(QR_USAGE_COUNT_SQL, [input.customerUid]),
    safeCount(SHARE_LINK_USAGE_COUNT_SQL, [input.customerUid]),
  ]);

  const storageUsedMb = await safeSumMb(
    "SELECT COALESCE(SUM(size_bytes), 0) AS total FROM product_assets WHERE customer_uid = ?",
    [input.customerUid],
  );

  const bandwidthUsedGb = await getCustomerBandwidthUsedGb(input.customerUid);
  const bandwidthUsedMb = Number((bandwidthUsedGb * 1024).toFixed(4));

  const usage = {
    productsUsed,
    modelsUsed,
    arExperiencesUsed,
    qrCodesUsed,
    shareLinksUsed,
    storageUsedMb,
    storageUsedGb: Number((storageUsedMb / 1024).toFixed(3)),
    bandwidthUsedMb,
    bandwidthUsedGb,
    trialStartedAt: dateToIso(subscription?.trial_started_at),
    trialEndsAt: dateToIso(subscription?.trial_ends_at),
    currentPeriodEnd: dateToIso(subscription?.current_period_end),
    subscriptionStatus: subscription?.status || "trialing",
  };

  let entitlement: EntitlementResult;
  if (action === "embed") {
    entitlement = checkEmbedEntitlement(plan, usage);
  } else if (action === "ar") {
    entitlement = checkArEntitlement(plan, usage);
  } else if (action === "qr") {
    entitlement = checkQrEntitlement(plan, usage);
  } else if (action === "share") {
    entitlement = checkShareEntitlement(plan, usage);
  } else if (["viewer"].includes(action)) {
    entitlement = checkViewerEntitlement(plan, usage);
  } else {
    const isExistingProductAction = [
      "edit",
      "save",
      "publish",
      "save_publish",
      "poster",
      "share",
      "embed",
      "qr",
      "viewer",
      "ar",
    ].includes(action);
    entitlement = checkUploadEntitlement(plan, usage, isExistingProductAction);
  }

  if (
    entitlement.allowed &&
    plan.isEnterpriseCustom &&
    ["upload", "create_product", "upload_product"].includes(action)
  ) {
    entitlement = checkEnterpriseModelEntitlement(plan, modelsUsed);
  }

  const sub = await checkSubscription(input.customerUid);

  if (!sub.active) {
    if (sub.reason === "expired" && (plan.planId === "trial" || plan.planId === "free")) {
      entitlement = {
        allowed: false,
        reason: action === "viewer" || action === "ar"
          ? "This trial viewer has expired. Upgrade to reactivate the public viewer."
          : `Your ${formatTrialDurationLabel(plan.trialHours)} trial has expired. Upgrade to continue uploading or editing products.`,
        upgradeRequired: true,
        trialExpired: true,
        limitType: "trial",
      };
    } else {
      entitlement = {
        allowed: false,
        reason: "Your plan is not active. Please upgrade or contact support to continue.",
        upgradeRequired: true,
        limitType: "status",
      };
    }
  }

  return {
    customerUid: input.customerUid,
    plan,
    usage,
    entitlement,
    action,
  };
}

export function entitlementToResponse(entitlement: EntitlementResult) {
  return {
    allowed: entitlement.allowed,
    reason: entitlement.reason || null,
    upgradeRequired: Boolean(entitlement.upgradeRequired),
    trialExpired: Boolean(entitlement.trialExpired),
    limitType: entitlement.limitType || null,
  };
}
