import { query } from "@/lib/db";
import { getPlanById, type BillingPlan } from "@/lib/billing/plans";

export type SubscriptionCheckResult = {
  active: boolean;
  reason: "active" | "expired" | "cancelled" | "inactive" | "missing_plan" | "payment_failed";
  plan: BillingPlan | null;
  expiresAt: string | null;
  daysRemaining: number;
};

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
    [customerUid]
  ).catch((err) => {
    console.error("checkSubscription query error:", err);
    return [];
  });

  const data = rows[0];
  if (!data) {
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
  const billingPlans = await getBillingPlans({ activeOnly: false }).catch(() => []);

  const resolvedPlan = (pid: string) => {
    const dbPlan = billingPlans.find((p) => p.id === mapLegacyPlanId(pid));
    return dbPlan || getPlanById(pid);
  };

  // 2. Check if user/customer is suspended or deleted
  const isSuspended = data.customer_status === "Suspended" || data.user_status === "Suspended" ||
                      data.customer_status === "Deleted" || data.user_status === "Deleted";
  if (isSuspended) {
    return {
      active: false,
      reason: "inactive",
      plan: data.plan_id ? resolvedPlan(data.plan_id) : null,
      expiresAt: null,
      daysRemaining: 0,
    };
  }

  // 3. Resolve plan
  const planId = data.plan_id;
  if (!planId) {
    return {
      active: false,
      reason: "missing_plan",
      plan: null,
      expiresAt: null,
      daysRemaining: 0,
    };
  }
  const plan = resolvedPlan(planId);

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

  // Calculate days remaining
  let daysRemaining = 0;
  if (expiresAtDate) {
    const diffTime = expiresAtDate.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // 5. Determine active status
  // Active only if status is active, trialing, trial, or grace (if grace period has not expired)
  const isStatusActive = status === "active" || status === "trialing" || status === "trial"
    || status === "grace" || status === "past_due";
  const isExpired = expiresAtDate ? now.getTime() > expiresAtDate.getTime() : false;

  if (!isStatusActive) {
    let reason: SubscriptionCheckResult["reason"] = "inactive";
    if (status === "cancelled") reason = "cancelled";
    else if (status === "expired") reason = "expired";
    else if (status === "past_due" || status === "failed" || status === "payment_failed") reason = "payment_failed";

    return {
      active: false,
      reason,
      plan,
      expiresAt,
      daysRemaining,
    };
  }

  if (isExpired) {
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
        // A stale local date is not sufficient to revoke a paid provider subscription.
        return {
          active: true,
          reason: "active",
          plan,
          expiresAt,
          daysRemaining: 0,
        };
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
