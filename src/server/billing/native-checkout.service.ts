import { query } from "@/lib/db";
import { getRazorpayKeys } from "@/lib/master-admin-settings";
import { getRazorpayClient, uid } from "./razorpay";
import { ensurePublishedRazorpayPlan } from "./razorpay-plan.service";
import type { CheckoutSession, NativeCheckoutResult, PriceVersion } from "./native-subscription.types";

type RazorpaySubscription = {
  id: string;
  plan_id: string;
  status: string;
  notes?: Record<string, string | number>;
};

export type SubscriptionCheckoutClient = {
  subscriptions: {
    create(input: {
      plan_id: string;
      total_count: number;
      quantity: number;
      customer_notify: 0 | 1;
      expire_by: number;
      start_at?: number;
      notes: Record<string, string | number>;
    }): Promise<RazorpaySubscription>;
    fetch(id: string): Promise<RazorpaySubscription>;
  };
};

function mysqlDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function cadence(period: "monthly" | "yearly") {
  return period === "monthly" ? "Renews every month" : "Renews every year";
}

export function validateIdempotencyKey(value: string) {
  const key = value.trim();
  if (!/^[A-Za-z0-9:_-]{16,191}$/.test(key)) {
    throw new Error("A valid checkout idempotency key is required.");
  }
  return key;
}

export function buildProviderSubscriptionInput(input: {
  price: PriceVersion;
  period: "monthly" | "yearly";
  customerUid: string;
  sessionUid: string;
  expiresAt: Date;
  startAt?: Date;
  purpose?: "new_subscription" | "legacy_renewal";
}) {
  return {
    plan_id: input.price.provider_plan_id!,
    total_count: input.period === "monthly" ? 120 : 10,
    quantity: 1,
    customer_notify: 0 as const,
    expire_by: Math.floor(input.expiresAt.getTime() / 1000),
    ...(input.startAt ? { start_at: Math.floor(input.startAt.getTime() / 1000) } : {}),
    notes: {
      customer_uid: input.customerUid,
      checkout_session_uid: input.sessionUid,
      price_version_uid: input.price.price_version_uid,
      plan_id: input.price.plan_id,
      provider_mode: input.price.provider_mode,
      purpose: input.purpose || "new_subscription",
      ...(input.startAt ? { legacy_term_end: input.startAt.toISOString() } : {}),
    },
  };
}

async function findSession(customerUid: string, idempotencyKey: string) {
  const rows = await query<CheckoutSession>(
    `SELECT checkout_session_uid, customer_uid, user_id, plan_id, price_version_id,
            billing_interval, provider_mode, provider_subscription_id, status,
            idempotency_key, expires_at, start_at, checkout_purpose
       FROM billing_checkout_sessions
      WHERE customer_uid = ? AND idempotency_key = ? LIMIT 1`,
    [customerUid, idempotencyKey],
  );
  return rows[0] || null;
}

async function markFailed(sessionUid: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Razorpay subscription creation failed.";
  await query(
    `UPDATE billing_checkout_sessions
        SET status = 'failed', failure_code = 'provider_create_failed', failure_message = ?
      WHERE checkout_session_uid = ? AND provider_subscription_id IS NULL`,
    [message.slice(0, 2000), sessionUid],
  ).catch(() => undefined);
}

function response(input: {
  session: CheckoutSession;
  price: PriceVersion;
  keyId: string;
  customer: { name: string; email: string };
  reused: boolean;
}): NativeCheckoutResult {
  return {
    flow: "subscription",
    checkoutSessionUid: input.session.checkout_session_uid,
    razorpaySubscriptionId: input.session.provider_subscription_id!,
    keyId: input.keyId,
    amount: Number(input.price.total_paise),
    subtotal: Number(input.price.subtotal_paise),
    gst: Number(input.price.gst_paise),
    gstRate: Number(input.price.gst_rate),
    gstInclusive: true,
    currency: "INR",
    planId: input.price.plan_id,
    period: input.price.billing_interval,
    cadence: cadence(input.price.billing_interval),
    cancellationTerms: "Cancel any time; cancellation takes effect at the end of the paid billing period.",
    customer: input.customer,
    reused: input.reused,
  };
}

export async function createNativeSubscriptionCheckout(input: {
  customerUid: string;
  userId: string;
  customer: { name: string; email: string };
  planId: string;
  period: "monthly" | "yearly";
  idempotencyKey: string;
  startAt?: Date;
  purpose?: "new_subscription" | "legacy_renewal";
  client?: SubscriptionCheckoutClient;
  price?: PriceVersion;
  keyId?: string;
}) {
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const price = input.price || await ensurePublishedRazorpayPlan(input.planId, input.period);
  if (!price.provider_plan_id) throw new Error("Razorpay Plan is not published.");

  const keys = input.keyId ? { keyId: input.keyId } : await getRazorpayKeys();
  if (!keys.keyId) throw new Error("Razorpay key ID missing.");
  const client = input.client || await getRazorpayClient() as unknown as SubscriptionCheckoutClient;

  const existing = await findSession(input.customerUid, idempotencyKey);
  if (existing) {
    if (
      existing.plan_id !== input.planId ||
      existing.billing_interval !== input.period ||
      Number(existing.price_version_id) !== Number(price.id) ||
      (existing.checkout_purpose || "new_subscription") !== (input.purpose || "new_subscription") ||
      (input.startAt && new Date(existing.start_at || 0).getTime() !== input.startAt.getTime())
    ) {
      throw new Error("Idempotency key was already used for a different checkout.");
    }
    if (existing.provider_subscription_id && new Date(existing.expires_at).getTime() > Date.now()) {
      const provider = await client.subscriptions.fetch(existing.provider_subscription_id);
      if (provider.plan_id !== price.provider_plan_id || ["cancelled", "completed", "expired"].includes(provider.status)) {
        throw new Error("Existing Razorpay subscription is not reusable.");
      }
      return response({ session: existing, price, keyId: keys.keyId, customer: input.customer, reused: true });
    }
    throw new Error("Checkout session is still being prepared or is no longer reusable.");
  }

  const sessionUid = uid("bcs");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  if (input.startAt && input.startAt.getTime() <= Date.now()) {
    throw new Error("A scheduled subscription must start in the future.");
  }
  await query(
    `INSERT INTO billing_checkout_sessions
     (checkout_session_uid, customer_uid, user_id, plan_id, price_version_id, billing_interval,
      provider_mode, status, idempotency_key, expires_at, start_at, checkout_purpose, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?, ?, ?)`,
    [
      sessionUid, input.customerUid, input.userId, input.planId, price.id, input.period,
      price.provider_mode, idempotencyKey, mysqlDate(expiresAt),
      input.startAt ? mysqlDate(input.startAt) : null, input.purpose || "new_subscription",
      JSON.stringify({ source: "checkout_js", gst_inclusive: true, purpose: input.purpose || "new_subscription" }),
    ],
  );

  try {
    const provider = await client.subscriptions.create(buildProviderSubscriptionInput({
      price,
      period: input.period,
      customerUid: input.customerUid,
      sessionUid,
      expiresAt,
      startAt: input.startAt,
      purpose: input.purpose,
    }));

    await query(
      `UPDATE billing_checkout_sessions
          SET provider_subscription_id = ?, updated_at = NOW()
        WHERE checkout_session_uid = ? AND provider_subscription_id IS NULL AND status = 'created'`,
      [provider.id, sessionUid],
    );

    const persisted = await findSession(input.customerUid, idempotencyKey);
    if (!persisted?.provider_subscription_id) throw new Error("Provider subscription was not persisted.");
    return response({ session: persisted, price, keyId: keys.keyId, customer: input.customer, reused: false });
  } catch (error) {
    await markFailed(sessionUid, error);
    throw error;
  }
}
