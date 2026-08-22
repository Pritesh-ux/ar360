import { query } from "@/lib/db";
import { getPlanById, type BillingPlan } from "@/lib/billing/plans";

export type SubscriptionCheckResult = {
  active: boolean;
  reason: "active" | "expired" | "cancelled" | "inactive" | "missing_plan" | "payment_failed";
  plan: BillingPlan | null;
  expiresAt: string | null;
  daysRemaining: number;
};

/** How long a provider subscription stays usable while reconciliation keeps failing. */
const RECONCILIATION_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Layout + addon checks call checkSubscription many times in parallel.
 * Collapse identical in-flight lookups and keep a short TTL so Fast Refresh /
 * dashboard remounts do not exhaust the MySQL pool queue.
 */
const SUB_CHECK_TTL_MS = process.env.NODE_ENV === "development" ? 5_000 : 2_000;

const globalSubCache = globalThis as typeof globalThis & {
  __ar360SubscriptionCheckCache?: Map<
    string,
    { expiresAt: number; promise: Promise<SubscriptionCheckResult> }
  >;
};

function getSubscriptionCheckCache() {
  if (!globalSubCache.__ar360SubscriptionCheckCache) {
    globalSubCache.__ar360SubscriptionCheckCache = new Map();
  }
  return globalSubCache.__ar360SubscriptionCheckCache;
}

/**
 * Local testing escape hatch. Off by default so `npm run dev` reproduces the
 * production lock; set ALLOW_INACTIVE_SUBSCRIPTION=true to bypass it.
 */
function subscriptionBypassEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    String(process.env.ALLOW_INACTIVE_SUBSCRIPTION || "").toLowerCase() === "true"
  );
}

export async function checkSubscription(
  customerUid: string,
  providerReconciled = false,
): Promise<SubscriptionCheckResult> {
  if (!customerUid) {
    return {
      active: false,
      reason: "missing_plan",
      plan: null,
      expiresAt: null,
      daysRemaining: 0,
    };
  }

  const cacheKey = `${customerUid}:${providerReconciled ? 1 : 0}`;
  const cache = getSubscriptionCheckCache();
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return hit.promise;
  }

  const promise = checkSubscriptionUncached(customerUid, providerReconciled);
  cache.set(cacheKey, { expiresAt: now + SUB_CHECK_TTL_MS, promise });
  promise.catch(() => {
    const current = cache.get(cacheKey);
    if (current?.promise === promise) cache.delete(cacheKey);
  });
  return promise;
}

async function checkSubscriptionUncached(
  customerUid: string,
  providerReconciled = false,
): Promise<SubscriptionCheckResult> {
  // 1. Fetch customer, user, and subscription details from MySQL
  const rows = await query<any>(
    `SELECT 
      c.status AS customer_status,
      u.status AS user_status,
      s.plan_id,
      s.status AS sub_status,
      s.current_period_end,
      s.trial_ends_at,
      s.grace_ends_at
      ,s.provider
     FROM customers c
     LEFT JOIN users u ON u.id = c.user_id
     LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
     WHERE c.customer_uid = ?
     LIMIT 1`,
    [customerUid],
  ).catch((err) => {
    console.error("checkSubscription query error:", err);
    return [];
  });

  const data = rows[0];
  if (!data) {
    if (subscriptionBypassEnabled()) {
      return {
        active: true,
        reason: "active",
        plan: getPlanById("trial"),
        expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        daysRemaining: 30,
      };
    }
    return {
      active: false,
      reason: "missing_plan",
      plan: null,
      expiresAt: null,
      daysRemaining: 0,
    };
  }

  const { getBillingPlans } = await import("@/lib/billing/admin-plans");
  const { mapLegacyPlanId } = await import("@/lib/billing/plan-enforcement");
  const { resolvePlanLimits } = await import("@/lib/billing/resolve-plan-limits");
  const billingPlans = await getBillingPlans({ activeOnly: false }).catch(() => []);

  const resolvedPlan = async (pid: string) => {
    const mapped = mapLegacyPlanId(pid);
    const dbPlan = billingPlans.find((p) => p.id === mapped || mapLegacyPlanId(p.id) === mapped);
    if (dbPlan) return dbPlan;
    if (String(pid).toLowerCase().startsWith("ecp_")) {
      const limits = await resolvePlanLimits(pid).catch(() => null);
      const base = getPlanById("enterprise");
      return {
        ...base,
        id: "enterprise" as const,
        name: limits?.name || "ENTERPRISE",
        tagline: limits?.name ? `Custom plan · ${limits.name}` : base.tagline,
      };
    }
    return getPlanById(pid);
  };

  // 2. Check if user/customer is suspended or deleted
  const isSuspended =
    data.customer_status === "Suspended" ||
    data.user_status === "Suspended" ||
    data.customer_status === "Deleted" ||
    data.user_status === "Deleted";
  if (isSuspended) {
    return {
      active: false,
      reason: "inactive",
      plan: data.plan_id ? await resolvedPlan(data.plan_id) : null,
      expiresAt: null,
      daysRemaining: 0,
    };
  }

  // 3. Resolve plan
  const planId = data.plan_id;
  if (!planId) {
    if (subscriptionBypassEnabled()) {
      return {
        active: true,
        reason: "active",
        plan: getPlanById("trial"),
        expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        daysRemaining: 30,
      };
    }
    return {
      active: false,
      reason: "missing_plan",
      plan: null,
      expiresAt: null,
      daysRemaining: 0,
    };
  }
  const plan = await resolvedPlan(planId);

  // 4. Resolve expiry time
  const status = data.sub_status ? String(data.sub_status).toLowerCase().trim() : "";
  let expiresAtDate: Date | null = null;
  if (status === "trialing" || status === "trial") {
    expiresAtDate = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
  } else if (status === "grace" || status === "past_due") {
    expiresAtDate = data.grace_ends_at ? new Date(data.grace_ends_at) : null;
  } else {
    expiresAtDate = data.current_period_end ? new Date(data.current_period_end) : null;
  }

  const now = new Date();
  const expiresAt = expiresAtDate ? expiresAtDate.toISOString() : null;

  let daysRemaining = 0;
  if (expiresAtDate) {
    const diffTime = expiresAtDate.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // 5. Determine active status
  const isStatusActive =
    status === "active" ||
    status === "trialing" ||
    status === "trial" ||
    status === "grace" ||
    status === "past_due";
  const isExpired = expiresAtDate ? now.getTime() > expiresAtDate.getTime() : false;

  if (!isStatusActive) {
    if (subscriptionBypassEnabled()) {
      return {
        active: true,
        reason: "active",
        plan,
        expiresAt,
        daysRemaining: daysRemaining || 30,
      };
    }
    let reason: SubscriptionCheckResult["reason"] = "inactive";
    if (status === "cancelled") reason = "cancelled";
    else if (status === "expired") reason = "expired";
    else if (status === "past_due" || status === "failed" || status === "payment_failed") {
      reason = "payment_failed";
    }

    return {
      active: false,
      reason,
      plan,
      expiresAt,
      daysRemaining,
    };
  }

  if (isExpired) {
    if (subscriptionBypassEnabled()) {
      return {
        active: true,
        reason: "active",
        plan,
        expiresAt,
        daysRemaining: 30,
      };
    }
    if (data.provider === "razorpay" && !providerReconciled) {
      try {
        const { reconcileBeforeNativeExpiry } = await import(
          "@/server/billing/provider-reconciliation.service"
        );
        await reconcileBeforeNativeExpiry(customerUid);
        return checkSubscription(customerUid, true);
      } catch (error) {
        console.error("Native subscription expiry reconciliation failed:", error);
        await query(
          "UPDATE customer_subscriptions SET reconciliation_required = 1 WHERE customer_uid = ?",
          [customerUid],
        ).catch(() => undefined);
        const msSinceExpiry = expiresAtDate ? now.getTime() - expiresAtDate.getTime() : 0;
        if (msSinceExpiry <= RECONCILIATION_GRACE_MS) {
          return {
            active: true,
            reason: "active",
            plan,
            expiresAt,
            daysRemaining: 0,
          };
        }
      }
    }
    return {
      active: false,
      reason: "expired",
      plan,
      expiresAt,
      daysRemaining: 0,
    };
  }

  return {
    active: true,
    reason: "active",
    plan,
    expiresAt,
    daysRemaining,
  };
}
