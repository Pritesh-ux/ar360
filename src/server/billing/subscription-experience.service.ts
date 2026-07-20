import { query } from "@/lib/db";
import { getPlanById } from "@/lib/billing/plans";
import { getSubscriptionByCustomer } from "./subscription.repository";

type ScheduledChangeRow = {
  change_uid: string;
  change_type: "upgrade" | "downgrade" | "cancellation";
  from_plan_id: string;
  to_plan_id: string | null;
  effective_at: string;
  status: "scheduled" | "applied" | "cancelled" | "failed";
  failure_reason: string | null;
};

type PaymentAttemptRow = {
  payment_uid: string;
  status: string;
  amount_paise: number;
  currency: string;
  failure_code: string | null;
  failure_description: string | null;
  created_at: string;
};

type PriceRow = {
  subtotal_paise: number;
  gst_paise: number;
  total_paise: number;
  gst_rate: number;
  currency: string;
};

export async function getSubscriptionExperience(customerUid: string) {
  const subscription = await getSubscriptionByCustomer(customerUid);
  if (!subscription) return null;

  const [changes, attempts, prices] = await Promise.all([
    query<ScheduledChangeRow>(
      `SELECT change_uid, change_type, from_plan_id, to_plan_id, effective_at, status, failure_reason
         FROM billing_scheduled_changes
        WHERE customer_uid = ?
        ORDER BY FIELD(status, 'scheduled', 'failed', 'applied', 'cancelled'), created_at DESC
        LIMIT 5`,
      [customerUid],
    ),
    query<PaymentAttemptRow>(
      `SELECT payment_uid, status, amount_paise, currency, failure_code, failure_description, created_at
         FROM billing_payments
        WHERE customer_uid = ? AND provider_subscription_id = ?
        ORDER BY created_at DESC
        LIMIT 6`,
      [customerUid, subscription.razorpay_subscription_id || ""],
    ),
    subscription.price_version_id
      ? query<PriceRow>(
          `SELECT subtotal_paise, gst_paise, total_paise, gst_rate, currency
             FROM billing_plan_price_versions WHERE id = ? LIMIT 1`,
          [subscription.price_version_id],
        )
      : Promise.resolve([]),
  ]);

  const fallbackPlan = getPlanById(subscription.plan_id);
  const fallbackTotal =
    subscription.period === "yearly" ? fallbackPlan.priceYearlyInr : fallbackPlan.priceMonthlyInr;
  const totalPaise = Number(prices[0]?.total_paise ?? (fallbackTotal == null ? 0 : fallbackTotal * 100));
  const subtotalPaise = Number(prices[0]?.subtotal_paise ?? Math.round(totalPaise / 1.18));

  return {
    subscription: {
      ...subscription,
      renewal_attempt_count: Number((subscription as typeof subscription & { renewal_attempt_count?: number }).renewal_attempt_count || 0),
      next_retry_at: (subscription as typeof subscription & { next_retry_at?: string | null }).next_retry_at || null,
      halted_at: (subscription as typeof subscription & { halted_at?: string | null }).halted_at || null,
      mandate_status: (subscription as typeof subscription & { mandate_status?: string | null }).mandate_status || null,
    },
    scheduledChange: changes.find((change) => change.status === "scheduled") || null,
    recentChanges: changes,
    attempts,
    nextDebit:
      totalPaise > 0 && subscription.current_period_end && !["cancelled", "completed", "expired"].includes(subscription.status)
        ? {
            dueAt: subscription.current_period_end,
            subtotalPaise,
            gstPaise: Number(prices[0]?.gst_paise ?? totalPaise - subtotalPaise),
            totalPaise,
            gstRate: Number(prices[0]?.gst_rate ?? 18),
            currency: prices[0]?.currency || "INR",
            gstInclusive: true,
          }
        : null,
    manualEnterprise:
      subscription.plan_id === "enterprise" &&
      (subscription.sales_channel === "manual" || subscription.classification_status === "contract_confirmed"),
  };
}
