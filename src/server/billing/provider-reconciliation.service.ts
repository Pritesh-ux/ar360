import crypto from "crypto";
import { query } from "@/lib/db";
import { getRazorpayClient } from "./razorpay";
import { finalizePaymentInvoice } from "./invoice.service";
import { resolvePlanLimits } from "@/lib/billing/resolve-plan-limits";

type LocalSubscription = {
  id: number;
  customer_uid: string;
  plan_id: string;
  billing_period: "monthly" | "yearly";
  status: string;
  provider_status: string | null;
  provider_subscription_id: string;
  current_period_end: string | null;
};

type ProviderSub = {
  id: string;
  status: string;
  plan_id?: string;
  current_start?: number;
  current_end?: number;
  ended_at?: number;
};

export interface ReconciliationProvider {
  fetchSubscription(id: string): Promise<ProviderSub>;
  listPayments(subscriptionId: string): Promise<Array<{
    id: string; amount: number; currency: string; status: string; captured_at?: number;
  }>>;
  listRefunds(paymentId: string): Promise<Array<{
    id: string; amount: number; currency: string; status: string; created_at?: number;
  }>>;
}

export function razorpayReconciliationProvider(): ReconciliationProvider {
  return {
    async fetchSubscription(id) {
      const client = await getRazorpayClient();
      return client.subscriptions.fetch(id) as Promise<ProviderSub>;
    },
    async listPayments(subscriptionId) {
      const client = await getRazorpayClient();
      const result = await client.payments.all({ subscription_id: subscriptionId } as any) as any;
      return result.items || [];
    },
    async listRefunds(paymentId) {
      const client = await getRazorpayClient();
      const result = await client.payments.fetchMultipleRefund(paymentId) as any;
      return result.items || [];
    },
  };
}

function mysqlDate(unix?: number) {
  return unix ? new Date(unix * 1000).toISOString().slice(0, 19).replace("T", " ") : null;
}

async function issue(sub: LocalSubscription, type: string, summary: string, details: unknown) {
  const providerId = sub.provider_subscription_id;
  await query(
    `INSERT INTO billing_reconciliation_issues
      (issue_uid, issue_type, severity, customer_uid, subscription_id, provider,
       provider_object_type, provider_object_id, local_object_type, local_object_id, summary, details)
     VALUES (?, ?, 'warning', ?, ?, 'razorpay', 'subscription', ?,
       'customer_subscription', ?, ?, ?)
     ON DUPLICATE KEY UPDATE last_seen_at = NOW(), summary = VALUES(summary), details = VALUES(details),
       status = IF(status = 'resolved', 'open', status), resolved_at = NULL`,
    [`bri_${crypto.randomUUID().replace(/-/g, "")}`, type, sub.customer_uid, sub.id,
      providerId, String(sub.id), summary, JSON.stringify(details)],
  );
}

function localStatus(providerStatus: string) {
  if (["active", "authenticated"].includes(providerStatus)) return "active";
  if (providerStatus === "paused") return "paused";
  if (providerStatus === "pending") return "past_due";
  if (providerStatus === "halted") return "halted";
  if (providerStatus === "cancelled") return "cancelled";
  if (providerStatus === "completed") return "completed";
  return null;
}

export async function reconcileSubscription(
  sub: LocalSubscription,
  provider: ReconciliationProvider = razorpayReconciliationProvider(),
) {
  const remote = await provider.fetchSubscription(sub.provider_subscription_id);
  if (!remote?.id || remote.id !== sub.provider_subscription_id || !remote.status) {
    throw new Error("Invalid Razorpay reconciliation response.");
  }
  let repaired = 0;
  const expected = localStatus(remote.status);
  if (expected && (sub.status !== expected || sub.provider_status !== remote.status)) {
    await issue(sub, "subscription_status_mismatch", "Provider/local subscription status mismatch.", {
      local: sub.status, provider: remote.status,
    });
    await query(
      `UPDATE customer_subscriptions SET status = ?, provider_status = ?,
          current_period_start = COALESCE(?, current_period_start),
          current_period_end = COALESCE(?, current_period_end),
          cancelled_at = IF(? IN ('cancelled','completed'), COALESCE(?, NOW()), cancelled_at),
          last_reconciled_at = NOW(), reconciliation_required = 0, updated_at = NOW()
        WHERE id = ?`,
      [expected, remote.status, mysqlDate(remote.current_start), mysqlDate(remote.current_end),
        expected, mysqlDate(remote.ended_at), sub.id],
    );
    await query(
      "UPDATE customers SET plan_id = ?, status = ?, updated_at = NOW() WHERE customer_uid = ?",
      [
        sub.plan_id,
        ["active", "past_due", "trialing", "grace"].includes(expected)
          ? "Active"
          : ["paused", "halted"].includes(expected)
            ? "Suspended"
            : "Active",
        sub.customer_uid,
      ],
    );
    repaired += 1;
  } else {
    await query(
      "UPDATE customer_subscriptions SET provider_status = ?, last_reconciled_at = NOW(), reconciliation_required = 0 WHERE id = ?",
      [remote.status, sub.id],
    );
  }
  if (["cancelled", "completed"].includes(remote.status)) {
    await query(
      `UPDATE billing_scheduled_changes SET status = 'applied', applied_at = NOW()
        WHERE subscription_id = ? AND change_type = 'cancellation' AND status = 'scheduled'`,
      [sub.id],
    );
  }

  const dueChanges = await query<{
    id: number; to_plan_id: string; to_price_version_id: number; provider_plan_id: string;
  }>(
    `SELECT sc.id, sc.to_plan_id, sc.to_price_version_id, pv.provider_plan_id
       FROM billing_scheduled_changes sc
       JOIN billing_plan_price_versions pv ON pv.id = sc.to_price_version_id
      WHERE sc.subscription_id = ? AND sc.status = 'scheduled' AND sc.effective_at <= NOW()`,
    [sub.id],
  );
  for (const change of dueChanges) {
    if (!change.to_plan_id || remote.plan_id !== change.provider_plan_id) {
      await issue(sub, "scheduled_change_mismatch", "Scheduled plan change is due but not effective at provider.", {
        remotePlanId: remote.plan_id, expectedProviderPlanId: change.provider_plan_id,
      });
      continue;
    }
    const limits = await resolvePlanLimits(change.to_plan_id);
    await query(
      `UPDATE customer_subscriptions SET plan_id = ?, price_version_id = ?, provider_plan_id = ?,
          product_limit = ?, storage_limit_mb = ?, bandwidth_limit_mb = ?, updated_at = NOW()
        WHERE id = ?`,
      [change.to_plan_id, change.to_price_version_id, change.provider_plan_id, limits.products,
        limits.storageMb, limits.unlimitedBandwidth ? null : Math.round(Number(limits.bandwidthGb || 0) * 1024),
        sub.id],
    );
    await query(
      "UPDATE customers SET plan_id = ?, updated_at = NOW() WHERE customer_uid = ?",
      [change.to_plan_id, sub.customer_uid],
    );
    await query(
      "UPDATE billing_scheduled_changes SET status = 'applied', applied_at = NOW() WHERE id = ?",
      [change.id],
    );
    repaired += 1;
  }

  const payments = await provider.listPayments(sub.provider_subscription_id);
  for (const payment of payments.filter((item) => item.status === "captured")) {
    const rows = await query<{ id: number; invoice_uid: string | null }>(
      "SELECT id, invoice_uid FROM billing_payments WHERE razorpay_payment_id = ? LIMIT 1",
      [payment.id],
    );
    if (!rows[0]) {
      await issue(sub, "missed_payment_webhook", "Captured provider payment was missing locally.", payment);
      await query(
        `INSERT INTO billing_payments
          (payment_uid, customer_uid, order_uid, razorpay_order_id, razorpay_payment_id,
           amount_paise, currency, status, raw_payload, subscription_id, provider,
           provider_subscription_id, captured_at)
         VALUES (?, ?, ?, '', ?, ?, ?, 'captured', ?, ?, 'razorpay', ?, ?)`,
        [`pay_rzp_${payment.id}`, sub.customer_uid, `subscription:${sub.provider_subscription_id}`,
          payment.id, payment.amount, payment.currency || "INR", JSON.stringify(payment), sub.id,
          sub.provider_subscription_id, mysqlDate(payment.captured_at)],
      );
      repaired += 1;
    }
    const invoice = await query<{ id: number }>(
      "SELECT id FROM billing_invoices WHERE razorpay_payment_id = ? LIMIT 1",
      [payment.id],
    );
    if (!invoice[0]) {
      await issue(sub, "missing_invoice", "Captured provider payment had no local invoice.", payment);
      await finalizePaymentInvoice({
        customerUid: sub.customer_uid,
        planId: sub.plan_id,
        period: sub.billing_period,
        amountPaise: Number(payment.amount),
        razorpayPaymentId: payment.id,
        subscriptionId: sub.id,
        paidAt: mysqlDate(payment.captured_at),
      });
      repaired += 1;
    }
    const refunds = await provider.listRefunds(payment.id).catch(() => []);
    for (const refund of refunds) {
      await query(
        `INSERT INTO billing_refunds
          (refund_uid, customer_uid, billing_payment_id, provider, provider_mode,
           provider_payment_id, provider_refund_id, amount_paise, currency, status, raw_payload, processed_at)
         SELECT ?, ?, bp.id, 'razorpay', COALESCE(bp.provider_mode, 'test'), ?, ?, ?, ?, ?, ?, ?
           FROM billing_payments bp WHERE bp.razorpay_payment_id = ? LIMIT 1
         ON DUPLICATE KEY UPDATE status = VALUES(status), raw_payload = VALUES(raw_payload),
           processed_at = COALESCE(processed_at, VALUES(processed_at))`,
        [`refund_rzp_${refund.id}`, sub.customer_uid, payment.id, refund.id, refund.amount,
          refund.currency || "INR", refund.status === "processed" ? "processed" : "pending",
          JSON.stringify(refund), refund.status === "processed" ? mysqlDate(refund.created_at) : null, payment.id],
      );
    }
  }
  return { repaired };
}

/**
 * One-time (non-mandate) checkouts never show up under a provider subscription,
 * so `reconcileSubscription` cannot see them. Without this pass a captured
 * payment can activate a plan and still leave the customer with no invoice and
 * no "payment successful" notification.
 */
export async function backfillMissingPaymentInvoices(limit = 50) {
  const rows = await query<{
    customer_uid: string;
    order_uid: string | null;
    razorpay_payment_id: string;
    amount_paise: number;
    paid_at: string | null;
    plan_id: string | null;
    billing_period: "monthly" | "yearly" | null;
    subscription_id: number | null;
  }>(
    `SELECT bp.customer_uid,
            bp.order_uid,
            bp.razorpay_payment_id,
            bp.amount_paise,
            COALESCE(bp.captured_at, bp.created_at) AS paid_at,
            COALESCE(o.plan_id, s.plan_id)          AS plan_id,
            COALESCE(o.billing_period, s.billing_period) AS billing_period,
            s.id AS subscription_id
       FROM billing_payments bp
       LEFT JOIN billing_orders o  ON o.order_uid = bp.order_uid
       LEFT JOIN billing_invoices i ON i.razorpay_payment_id = bp.razorpay_payment_id
       LEFT JOIN customer_subscriptions s
              ON s.id = (SELECT id FROM customer_subscriptions
                          WHERE customer_uid = bp.customer_uid
                          ORDER BY id DESC LIMIT 1)
      WHERE bp.status = 'captured'
        AND bp.razorpay_payment_id IS NOT NULL
        AND bp.razorpay_payment_id <> ''
        AND i.id IS NULL
        AND bp.created_at > DATE_SUB(NOW(), INTERVAL 120 DAY)
      ORDER BY bp.created_at DESC
      LIMIT ?`,
    [limit],
  );

  let repaired = 0;
  for (const row of rows) {
    if (!row.plan_id) continue;
    try {
      const invoice = await finalizePaymentInvoice({
        customerUid: row.customer_uid,
        planId: row.plan_id,
        period: row.billing_period === "yearly" ? "yearly" : "monthly",
        amountPaise: Number(row.amount_paise),
        razorpayPaymentId: row.razorpay_payment_id,
        orderUid: row.order_uid,
        subscriptionId: row.subscription_id,
        paidAt: row.paid_at,
      });
      if (!invoice?.invoice_uid) continue;

      const { createCustomerNotification } = await import("@/lib/account/notify.service");
      await createCustomerNotification({
        customerUid: row.customer_uid,
        category: "billing",
        title: "Payment successful",
        body: `Your ${row.plan_id} plan is now active. Invoice ${invoice.invoice_number} is ready.`,
        href: "/dashboard/billing/invoices",
        dedupeKey: `payment-success:${row.razorpay_payment_id}`,
      }).catch(() => undefined);

      repaired += 1;
    } catch (error) {
      console.error("[reconciliation] invoice backfill failed", row.razorpay_payment_id, error);
    }
  }

  return { scanned: rows.length, repaired };
}

export async function runProviderReconciliationBatch(
  limit = 50,
  provider: ReconciliationProvider = razorpayReconciliationProvider(),
) {
  const runUid = `brr_${crypto.randomUUID().replace(/-/g, "")}`;
  await query("INSERT INTO billing_reconciliation_runs (run_uid) VALUES (?)", [runUid]);
  let repaired = 0;
  let issues = 0;
  const subscriptions = await query<LocalSubscription>(
    `SELECT id, customer_uid, plan_id, billing_period, status, provider_status,
            provider_subscription_id, current_period_end
       FROM customer_subscriptions
      WHERE provider = 'razorpay' AND provider_subscription_id IS NOT NULL
        AND (reconciliation_required = 1 OR last_reconciled_at IS NULL
          OR last_reconciled_at < DATE_SUB(NOW(), INTERVAL 6 HOUR)
          OR current_period_end < NOW())
      ORDER BY reconciliation_required DESC, COALESCE(last_reconciled_at, '1970-01-01')
      LIMIT ?`,
    [limit],
  );
  for (const sub of subscriptions) {
    try {
      const result = await reconcileSubscription(sub, provider);
      repaired += result.repaired;
    } catch (error) {
      issues += 1;
      await issue(sub, "provider_reconciliation_failed", "Provider reconciliation failed.", {
        error: error instanceof Error ? error.message : String(error),
      });
      await query("UPDATE customer_subscriptions SET reconciliation_required = 1 WHERE id = ?", [sub.id]);
    }
  }
  let invoiceBackfill = { scanned: 0, repaired: 0 };
  try {
    invoiceBackfill = await backfillMissingPaymentInvoices(limit);
    repaired += invoiceBackfill.repaired;
  } catch (error) {
    issues += 1;
    console.error("[reconciliation] invoice backfill sweep failed", error);
  }

  const scanned = subscriptions.length + invoiceBackfill.scanned;
  await query(
    `UPDATE billing_reconciliation_runs SET status = 'completed', scanned_count = ?,
        repaired_count = ?, issue_count = ?, completed_at = NOW() WHERE run_uid = ?`,
    [scanned, repaired, issues, runUid],
  );
  return { runUid, scanned, repaired, issues };
}

export async function expireStaleCheckoutSessions() {
  const result = await query<{ affectedRows: number }>(
    `UPDATE billing_checkout_sessions SET status = 'expired', updated_at = NOW()
      WHERE status IN ('created','opened') AND expires_at < NOW()`,
  );
  return Number((result as any).affectedRows || 0);
}

/** Native subscriptions are never expired from dates alone; provider reconciliation decides. */
export async function reconcileBeforeNativeExpiry(
  customerUid: string,
  provider?: ReconciliationProvider,
) {
  const rows = await query<LocalSubscription>(
    `SELECT id, customer_uid, plan_id, billing_period, status, provider_status,
            provider_subscription_id, current_period_end
       FROM customer_subscriptions
      WHERE customer_uid = ? AND provider = 'razorpay' AND provider_subscription_id IS NOT NULL LIMIT 1`,
    [customerUid],
  );
  if (!rows[0]) return null;
  return reconcileSubscription(rows[0], provider);
}
