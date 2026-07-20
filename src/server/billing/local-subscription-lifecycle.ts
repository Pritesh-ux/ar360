import { query } from "@/lib/db";
import { getSubscriptionByCustomer, syncCustomerPlanMirror } from "./subscription.repository";
import { SubscriptionLifecycleError, validateLifecycleTransition } from "./provider-subscription.service";

/**
 * Pause / resume for enterprise / manual subscriptions that are not Razorpay-managed.
 * Sets local customer_subscriptions.status only; checkSubscription treats paused as inactive.
 */
export async function mutateLocalSubscriptionLifecycle(
  customerUid: string,
  action: "pause" | "resume",
  actor?: { type: "customer" | "admin"; id?: string | null },
) {
  const current = await getSubscriptionByCustomer(customerUid);
  if (!current) {
    throw new SubscriptionLifecycleError("Subscription not found.", "SUBSCRIPTION_NOT_FOUND", 404);
  }
  if (current.razorpay_subscription_id) {
    throw new SubscriptionLifecycleError(
      "This subscription is managed by Razorpay; use provider lifecycle actions.",
      "PROVIDER_MANAGED",
      409,
    );
  }

  validateLifecycleTransition(String(current.status), action);

  const nextStatus = action === "pause" ? "paused" : "active";
  await query(
    `UPDATE customer_subscriptions
        SET status = ?, cancelled_at = NULL, cancel_at_period_end = 0, updated_at = NOW()
      WHERE customer_uid = ?`,
    [nextStatus, customerUid],
  );
  await syncCustomerPlanMirror({
    customerUid,
    planId: current.plan_id,
    status: nextStatus,
  });

  await query(
    `INSERT INTO billing_history
      (customer_uid, subscription_id, event_type, title, description, meta)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      customerUid,
      current.id,
      action === "pause" ? "subscription_paused" : "subscription_resumed",
      action === "pause" ? "Subscription paused" : "Subscription resumed",
      `Local ${action} by ${actor?.type || "system"}${actor?.id ? `:${actor.id}` : ""}.`,
      JSON.stringify({ source: "local_enterprise", action }),
    ],
  ).catch(() => undefined);

  return getSubscriptionByCustomer(customerUid);
}
