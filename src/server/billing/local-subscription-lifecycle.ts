import { query } from "@/lib/db";
import { getSubscriptionByCustomer, syncCustomerPlanMirror } from "./subscription.repository";
import {
  isRazorpaySubscriptionId,
  SubscriptionLifecycleError,
  validateLifecycleTransition,
} from "./provider-subscription.service";

/**
 * Pause / resume / cancel for trial, enterprise, manual, or broken-provider subscriptions.
 * Updates local customer_subscriptions only; checkSubscription treats paused/cancelled as inactive.
 */
export async function mutateLocalSubscriptionLifecycle(
  customerUid: string,
  action: "pause" | "resume" | "cancel",
  actor?: { type: "customer" | "admin"; id?: string | null },
  options?: { cancelAtPeriodEnd?: boolean; forceLocal?: boolean },
) {
  const current = await getSubscriptionByCustomer(customerUid);
  if (!current) {
    throw new SubscriptionLifecycleError("Subscription not found.", "SUBSCRIPTION_NOT_FOUND", 404);
  }
  const providerManaged =
    isRazorpaySubscriptionId(current.razorpay_subscription_id) && options?.forceLocal !== true;
  if (providerManaged) {
    throw new SubscriptionLifecycleError(
      "This subscription is managed by Razorpay; use provider lifecycle actions.",
      "PROVIDER_MANAGED",
      409,
    );
  }

  const cancelAtPeriodEnd = options?.cancelAtPeriodEnd !== false;
  validateLifecycleTransition(String(current.status), action, cancelAtPeriodEnd);

  if (action === "cancel") {
    if (cancelAtPeriodEnd) {
      await query(
        `UPDATE customer_subscriptions
            SET cancel_at_period_end = 1, updated_at = NOW()
          WHERE customer_uid = ?`,
        [customerUid],
      );
      await query(
        `INSERT INTO billing_history
          (customer_uid, subscription_id, event_type, title, description, meta)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          customerUid,
          current.id,
          "subscription_cancellation_scheduled",
          "Cancellation scheduled",
          `Local cancel scheduled by ${actor?.type || "system"}${actor?.id ? `:${actor.id}` : ""}. Access remains through the current period.`,
          JSON.stringify({ source: "local", action: "cancel", cancelAtPeriodEnd: true, forceLocal: Boolean(options?.forceLocal) }),
        ],
      ).catch(() => undefined);
      return getSubscriptionByCustomer(customerUid);
    }

    await query(
      `UPDATE customer_subscriptions
          SET status = 'cancelled', cancel_at_period_end = 0, cancelled_at = NOW(), updated_at = NOW()
        WHERE customer_uid = ?`,
      [customerUid],
    );
    await syncCustomerPlanMirror({
      customerUid,
      planId: current.plan_id,
      status: "cancelled",
    });
    await query(
      `INSERT INTO billing_history
        (customer_uid, subscription_id, event_type, title, description, meta)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        customerUid,
        current.id,
        "subscription_cancelled",
        "Subscription cancelled",
        `Local cancel by ${actor?.type || "system"}${actor?.id ? `:${actor.id}` : ""}.`,
        JSON.stringify({ source: "local", action: "cancel", cancelAtPeriodEnd: false }),
      ],
    ).catch(() => undefined);
    return getSubscriptionByCustomer(customerUid);
  }

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
      JSON.stringify({ source: "local", action, forceLocal: Boolean(options?.forceLocal) }),
    ],
  ).catch(() => undefined);

  return getSubscriptionByCustomer(customerUid);
}
