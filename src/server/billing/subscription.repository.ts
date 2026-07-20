import { query } from "@/lib/db";
import type { BillingHistoryEvent, BillingInvoice, BillingPeriod, BillingSubscription, SubscriptionStatus } from "./subscription.types";

export type SubscriptionWriteInput = {
  customerUid: string;
  planId: string;
  status: string;
  billingPeriod?: BillingPeriod | string | null;
  trialStartedAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  currentPeriodStart?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
  provider?: string | null;
  providerSubscriptionId?: string | null;
  providerCustomerId?: string | null;
  graceEndsAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  trialUsed?: boolean | null;
  productLimit: number | null;
  storageLimitMb: number | null;
  bandwidthLimitMb: number | null;
  resetBandwidth?: boolean;
  unlimitedStorage?: number | boolean;
  unlimitedBandwidth?: number | boolean;
};

function toMysqlDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

export function normalizeSubscriptionStatus(status: string): string {
  const normalized = String(status || "trialing").toLowerCase().trim();
  if (normalized === "trial") return "trialing";
  return normalized;
}

function customerStatusFromSubscription(status: string): "Active" | "Suspended" {
  const normalized = normalizeSubscriptionStatus(status);
  return normalized === "active" || normalized === "trialing" || normalized === "grace" || normalized === "past_due"
    ? "Active"
    : "Suspended";
}

/** Mirror customers.plan_id — never update customers.plan_id outside this helper. */
export async function syncCustomerPlanMirror(input: {
  customerUid: string;
  planId: string;
  status: string;
  resetBandwidth?: boolean;
}) {
  const customerStatus = customerStatusFromSubscription(input.status);
  const resetBandwidth = input.resetBandwidth ? ", bandwidth_used_mb = 0" : "";

  await query(
    `UPDATE customers
        SET plan_id = ?,
            status = ?,
            updated_at = NOW()
            ${resetBandwidth}
      WHERE customer_uid = ?`,
    [input.planId, customerStatus, input.customerUid],
  );
}

/** Canonical subscription write — updates customer_subscriptions first. */
export async function applySubscriptionChange(input: SubscriptionWriteInput) {
  const status = normalizeSubscriptionStatus(input.status);

  await query(
    `INSERT INTO customer_subscriptions (
       customer_uid, plan_id, status, billing_period,
       trial_started_at, trial_ends_at,
       current_period_start, current_period_end,
       cancel_at_period_end, provider, provider_subscription_id, provider_customer_id,
       grace_ends_at, cancelled_at, trial_used,
       product_limit, storage_limit_mb, bandwidth_limit_mb,
       unlimited_storage, unlimited_bandwidth
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       plan_id = VALUES(plan_id),
       status = VALUES(status),
       billing_period = COALESCE(VALUES(billing_period), billing_period),
       trial_started_at = VALUES(trial_started_at),
       trial_ends_at = VALUES(trial_ends_at),
       current_period_start = VALUES(current_period_start),
       current_period_end = VALUES(current_period_end),
       cancel_at_period_end = VALUES(cancel_at_period_end),
       provider = COALESCE(VALUES(provider), provider),
       provider_subscription_id = COALESCE(VALUES(provider_subscription_id), provider_subscription_id),
       provider_customer_id = COALESCE(VALUES(provider_customer_id), provider_customer_id),
       grace_ends_at = VALUES(grace_ends_at),
       cancelled_at = VALUES(cancelled_at),
       trial_used = COALESCE(VALUES(trial_used), trial_used),
       product_limit = VALUES(product_limit),
       storage_limit_mb = VALUES(storage_limit_mb),
       bandwidth_limit_mb = VALUES(bandwidth_limit_mb),
       unlimited_storage = VALUES(unlimited_storage),
       unlimited_bandwidth = VALUES(unlimited_bandwidth),
       updated_at = NOW()`,
    [
      input.customerUid,
      input.planId,
      status,
      input.billingPeriod || null,
      toMysqlDate(input.trialStartedAt),
      toMysqlDate(input.trialEndsAt),
      toMysqlDate(input.currentPeriodStart),
      toMysqlDate(input.currentPeriodEnd),
      input.cancelAtPeriodEnd ? 1 : 0,
      input.provider || null,
      input.providerSubscriptionId || null,
      input.providerCustomerId || null,
      toMysqlDate(input.graceEndsAt),
      toMysqlDate(input.cancelledAt),
      input.trialUsed == null ? 0 : input.trialUsed ? 1 : 0,
      input.productLimit,
      input.storageLimitMb,
      input.bandwidthLimitMb,
      input.unlimitedStorage ? 1 : 0,
      input.unlimitedBandwidth ? 1 : 0,
    ],
  );

  await syncCustomerPlanMirror({
    customerUid: input.customerUid,
    planId: input.planId,
    status,
    resetBandwidth: input.resetBandwidth,
  });

  return getSubscriptionByCustomer(input.customerUid);
}

export async function getSubscriptionByCustomer(customerUid: string) {
  const rows = await query<BillingSubscription>(
    `SELECT id, customer_uid, plan_id, billing_period AS period, status,
            provider_subscription_id AS razorpay_subscription_id,
            provider_customer_id AS razorpay_customer_id,
            provider_plan_id, provider_mode, provider_status, mandate_status,
            price_version_id, checkout_session_uid,
            sales_channel, classification_status,
            term_mode, renewal_state, renewal_invited_at, renewal_consent_at,
            renewal_checkout_session_uid, renewal_provider_subscription_id,
            current_period_start, current_period_end, trial_ends_at,
            grace_ends_at, renewal_attempt_count, next_retry_at, halted_at,
            cancelled_at, cancel_at_period_end, unlimited_storage, unlimited_bandwidth, created_at, updated_at
     FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1`,
    [customerUid],
  );
  return rows[0] || null;
}

export async function upsertSubscription(input: {
  customerUid: string;
  planId: string;
  period: BillingPeriod;
  status: SubscriptionStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  graceEndsAt?: string | null;
  razorpaySubscriptionId?: string | null;
  razorpayCustomerId?: string | null;
  productLimit?: number;
  storageLimitMb?: number;
  bandwidthLimitMb?: number;
}) {
  return applySubscriptionChange({
    customerUid: input.customerUid,
    planId: input.planId,
    status: input.status,
    billingPeriod: input.period,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
    trialEndsAt: input.trialEndsAt,
    graceEndsAt: input.graceEndsAt,
    provider: "razorpay",
    providerSubscriptionId: input.razorpaySubscriptionId || null,
    providerCustomerId: input.razorpayCustomerId || null,
    cancelAtPeriodEnd: false,
    productLimit: input.productLimit ?? 0,
    storageLimitMb: input.storageLimitMb ?? 0,
    bandwidthLimitMb: input.bandwidthLimitMb ?? 0,
  });
}

export async function cancelSubscription(customerUid: string, cancelAtPeriodEnd = true) {
  const current = await getSubscriptionByCustomer(customerUid);
  const planId = current?.plan_id || "trial";

  if (cancelAtPeriodEnd) {
    await query(
      `UPDATE customer_subscriptions
       SET status = 'active', cancel_at_period_end = 1, cancelled_at = NOW(), updated_at = NOW()
       WHERE customer_uid = ?`,
      [customerUid],
    );
    await syncCustomerPlanMirror({ customerUid, planId, status: "active" });
  } else {
    await query(
      `UPDATE customer_subscriptions
       SET status = 'cancelled', cancel_at_period_end = 0, cancelled_at = NOW(), updated_at = NOW()
       WHERE customer_uid = ?`,
      [customerUid],
    );
    await syncCustomerPlanMirror({ customerUid, planId, status: "cancelled" });
  }

  return getSubscriptionByCustomer(customerUid);
}

export async function resumeSubscription(customerUid: string) {
  const current = await getSubscriptionByCustomer(customerUid);
  const planId = current?.plan_id || "basic";

  await query(
    `UPDATE customer_subscriptions
     SET status = 'active', cancel_at_period_end = 0, cancelled_at = NULL, updated_at = NOW()
     WHERE customer_uid = ?`,
    [customerUid],
  );
  await syncCustomerPlanMirror({ customerUid, planId, status: "active" });
  return getSubscriptionByCustomer(customerUid);
}

export async function addBillingHistory(input: {
  customerUid: string;
  subscriptionId?: number | null;
  eventType: string;
  title: string;
  description?: string | null;
  amountPaise?: number | null;
  meta?: unknown;
}) {
  await query(
    `INSERT INTO billing_history
      (customer_uid, subscription_id, event_type, title, description, amount_paise, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.customerUid,
      input.subscriptionId || null,
      input.eventType,
      input.title,
      input.description || null,
      input.amountPaise || null,
      input.meta ? JSON.stringify(input.meta) : null,
    ],
  );
}

export async function listBillingHistory(customerUid: string, limit = 50) {
  return query<BillingHistoryEvent>(
    `SELECT * FROM billing_history WHERE customer_uid = ? ORDER BY created_at DESC LIMIT ?`,
    [customerUid, limit],
  );
}

export async function listInvoices(customerUid: string, limit = 50) {
  return query<BillingInvoice>(
    `SELECT * FROM billing_invoices WHERE customer_uid = ? ORDER BY created_at DESC LIMIT ?`,
    [customerUid, limit],
  );
}
