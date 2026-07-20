import { query } from "@/lib/db";
import { getRazorpayClient, verifyRazorpaySubscriptionSignature } from "./razorpay";

type VerificationRow = {
  checkout_session_uid: string;
  customer_uid: string;
  plan_id: string;
  provider_subscription_id: string;
  provider_plan_id: string;
  price_version_uid: string;
  total_paise: number;
  currency: string;
};

type VerificationClient = {
  subscriptions: {
    fetch(id: string): Promise<{
      id: string;
      plan_id: string;
      status: string;
      notes?: Record<string, string | number>;
    }>;
  };
  payments: {
    fetch(id: string): Promise<{
      id: string;
      amount: number | string;
      currency: string;
      subscription_id?: string;
      status?: string;
    }>;
  };
};

export function assertProviderCheckoutOwnership(input: {
  row: VerificationRow;
  subscription: {
    id: string;
    plan_id: string;
    status: string;
    notes?: Record<string, string | number>;
  };
  payment: { amount: number | string; currency: string; subscription_id?: string };
}) {
  const { row, subscription, payment } = input;
  if (subscription.id !== row.provider_subscription_id || payment.subscription_id !== subscription.id) {
    throw new Error("Provider subscription ownership mismatch.");
  }
  if (subscription.plan_id !== row.provider_plan_id) throw new Error("Provider Plan mismatch.");
  if (String(subscription.notes?.customer_uid || "") !== row.customer_uid) {
    throw new Error("Provider customer ownership mismatch.");
  }
  if (String(subscription.notes?.checkout_session_uid || "") !== row.checkout_session_uid) {
    throw new Error("Provider checkout ownership mismatch.");
  }
  if (String(subscription.notes?.price_version_uid || "") !== row.price_version_uid) {
    throw new Error("Provider price version mismatch.");
  }
  if (Number(payment.amount) !== Number(row.total_paise) || payment.currency !== row.currency) {
    throw new Error("Provider payment amount mismatch.");
  }
}

export function mandateState(status: string): "authorized" | "pending" | "failed" {
  if (status === "authenticated" || status === "active") return "authorized";
  if (status === "created" || status === "pending") return "pending";
  return "failed";
}

export async function verifyNativeSubscriptionCallback(input: {
  customerUid: string;
  checkoutSessionUid: string;
  subscriptionId: string;
  paymentId: string;
  signature: string;
  client?: VerificationClient;
  verifySignature?: typeof verifyRazorpaySubscriptionSignature;
}) {
  const valid = await (input.verifySignature || verifyRazorpaySubscriptionSignature)({
    paymentId: input.paymentId,
    subscriptionId: input.subscriptionId,
    signature: input.signature,
  });
  if (!valid) throw new Error("Invalid subscription checkout signature.");

  const rows = await query<VerificationRow>(
    `SELECT s.checkout_session_uid, s.customer_uid, s.plan_id, s.provider_subscription_id,
            p.provider_plan_id, p.price_version_uid, p.total_paise, p.currency
       FROM billing_checkout_sessions s
       JOIN billing_plan_price_versions p ON p.id = s.price_version_id
      WHERE s.checkout_session_uid = ? AND s.customer_uid = ?
        AND s.provider_subscription_id = ? LIMIT 1`,
    [input.checkoutSessionUid, input.customerUid, input.subscriptionId],
  );
  const row = rows[0];
  if (!row) throw new Error("Checkout session not found.");

  const client = input.client || await getRazorpayClient() as unknown as VerificationClient;
  const [subscription, payment] = await Promise.all([
    client.subscriptions.fetch(input.subscriptionId),
    client.payments.fetch(input.paymentId),
  ]);
  assertProviderCheckoutOwnership({ row, subscription, payment });

  const state = mandateState(subscription.status);
  await query(
    `UPDATE billing_checkout_sessions
        SET status = ?, completed_at = IF(? = 'completed', NOW(), completed_at),
            updated_at = NOW()
      WHERE checkout_session_uid = ?`,
    [
      state === "authorized" ? "completed" : state === "failed" ? "failed" : "opened",
      state === "authorized" ? "completed" : "opened",
      input.checkoutSessionUid,
    ],
  );
  await query(
    `UPDATE customer_subscriptions
        SET renewal_state = CASE
              WHEN ? = 'authorized' THEN 'mandate_authorized'
              WHEN ? = 'failed' THEN 'mandate_failed'
              ELSE 'mandate_pending'
            END,
            updated_at = NOW()
      WHERE customer_uid = ? AND term_mode = 'legacy_until_renewal'
        AND renewal_checkout_session_uid = ?`,
    [state, state, input.customerUid, input.checkoutSessionUid],
  );

  // Entitlements are intentionally webhook-owned; browser callbacks only authenticate the mandate.
  return { success: true, mandateState: state, subscriptionStatus: subscription.status };
}
