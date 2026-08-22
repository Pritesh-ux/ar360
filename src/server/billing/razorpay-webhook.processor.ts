import crypto from "crypto";
import os from "os";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool, query } from "@/lib/db";
import { parseRazorpayBillingEvent, shouldApplyProviderEvent } from "./razorpay-webhook.types";

const MAX_ATTEMPTS = 10;
const LEASE_SECONDS = 90;

type InboxRow = RowDataPacket & {
  id: number;
  event_uid: string;
  event_type: string;
  dedupe_key: string;
  provider_mode: "test" | "live" | null;
  payload: string | Record<string, unknown>;
  event_created_at: number | null;
  lock_token: string | null;
  attempt_count: number;
  status: string;
};

type OwnershipRow = RowDataPacket & {
  customer_uid: string;
  subscription_id: number | null;
  plan_id: string;
  billing_interval: "monthly" | "yearly";
  provider_mode: "test" | "live";
  provider_subscription_id: string | null;
  checkout_session_uid: string | null;
  price_version_id: number | null;
  price_version_uid: string | null;
  provider_plan_id: string | null;
  subtotal_paise: number | null;
  gst_paise: number | null;
  total_paise: number | null;
  gst_rate: number | null;
  currency: string | null;
  current_event_timestamp: number | null;
  current_plan_id: string | null;
  buyer_gstin: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_address: string | null;
  supply_state_code: string | null;
  place_of_supply: string | null;
};

function token(prefix: string) {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

function mysqlDate(unixSeconds?: number | null) {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString().slice(0, 19).replace("T", " ");
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

function retryDelay(attempt: number) {
  return Math.min(3600, 5 * (2 ** Math.min(attempt, 9)));
}

async function rows<T extends RowDataPacket>(
  connection: PoolConnection,
  sql: string,
  values: any[] = [],
): Promise<T[]> {
  const [result] = await connection.execute(sql, values);
  return result as T[];
}

async function resolveOwnership(
  connection: PoolConnection,
  providerSubscriptionId: string | null,
  providerPaymentId: string | null,
): Promise<OwnershipRow | null> {
  if (providerSubscriptionId) {
    const matches = await rows<OwnershipRow>(
      connection,
      `SELECT COALESCE(cs.customer_uid, bc.customer_uid) AS customer_uid, cs.id AS subscription_id,
              COALESCE(cs.plan_id, bc.plan_id) AS plan_id,
              COALESCE(cs.billing_period, bc.billing_interval) AS billing_interval,
              COALESCE(cs.provider_mode, bc.provider_mode) AS provider_mode,
              COALESCE(cs.provider_subscription_id, bc.provider_subscription_id) AS provider_subscription_id,
              COALESCE(cs.checkout_session_uid, bc.checkout_session_uid) AS checkout_session_uid,
              COALESCE(cs.price_version_id, bc.price_version_id) AS price_version_id,
              pv.price_version_uid, pv.provider_plan_id, pv.subtotal_paise, pv.gst_paise,
              pv.total_paise, pv.gst_rate, pv.currency,
              cs.provider_event_created_at AS current_event_timestamp, cs.plan_id AS current_plan_id,
              prof.gstin AS buyer_gstin,
              COALESCE(prof.billing_name, prof.company_name) AS buyer_name,
              prof.billing_email AS buyer_email,
              CONCAT_WS(', ', prof.address_line1, prof.address_line2, prof.city, prof.state, prof.postal_code, prof.country) AS buyer_address,
              NULL AS supply_state_code, prof.state AS place_of_supply
         FROM billing_checkout_sessions bc
         LEFT JOIN customer_subscriptions cs
           ON cs.customer_uid = bc.customer_uid
         JOIN billing_plan_price_versions pv ON pv.id = bc.price_version_id
         LEFT JOIN billing_profiles prof ON prof.customer_uid = bc.customer_uid
        WHERE bc.provider_subscription_id = ?
        LIMIT 1 FOR UPDATE`,
      [providerSubscriptionId],
    );
    if (matches[0]) return matches[0];
  }

  if (providerPaymentId) {
    const matches = await rows<OwnershipRow>(
      connection,
      `SELECT bp.customer_uid, cs.id AS subscription_id, cs.plan_id,
              cs.billing_period AS billing_interval, bp.provider_mode,
              COALESCE(bp.provider_subscription_id, cs.provider_subscription_id) AS provider_subscription_id,
              bp.checkout_session_uid, bp.price_version_id,
              pv.price_version_uid, pv.provider_plan_id, pv.subtotal_paise, pv.gst_paise,
              pv.total_paise, pv.gst_rate, pv.currency,
              GREATEST(COALESCE(bp.provider_event_created_at, 0), COALESCE(cs.provider_event_created_at, 0))
                AS current_event_timestamp,
              cs.plan_id AS current_plan_id,
              prof.gstin AS buyer_gstin,
              COALESCE(prof.billing_name, prof.company_name) AS buyer_name,
              prof.billing_email AS buyer_email,
              CONCAT_WS(', ', prof.address_line1, prof.address_line2, prof.city, prof.state, prof.postal_code, prof.country) AS buyer_address,
              NULL AS supply_state_code, prof.state AS place_of_supply
         FROM billing_payments bp
         JOIN customer_subscriptions cs ON cs.customer_uid = bp.customer_uid
         LEFT JOIN billing_plan_price_versions pv ON pv.id = COALESCE(bp.price_version_id, cs.price_version_id)
         LEFT JOIN billing_profiles prof ON prof.customer_uid = bp.customer_uid
        WHERE bp.razorpay_payment_id = ?
        LIMIT 1 FOR UPDATE`,
      [providerPaymentId],
    );
    if (matches[0]) return matches[0];
  }
  return null;
}

function subscriptionState(type: string) {
  switch (type) {
    case "subscription.authenticated": return { status: null, mandate: "authorized" };
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
    case "payment.captured": return { status: "active", mandate: "authorized" };
    case "subscription.pending": return { status: "past_due", mandate: "pending" };
    case "subscription.halted": return { status: "halted", mandate: "failed" };
    case "payment.failed": return { status: "past_due", mandate: "failed" };
    case "subscription.paused": return { status: "paused", mandate: "authorized" };
    case "subscription.cancelled": return { status: "cancelled", mandate: "revoked" };
    case "subscription.completed": return { status: "completed", mandate: "revoked" };
    default: return null;
  }
}

async function appendAudit(
  connection: PoolConnection,
  input: { eventUid: string; customerUid: string; action: string; entityId: string; after: unknown },
) {
  const previous = await rows<RowDataPacket & { entry_hash: string }>(
    connection,
    "SELECT entry_hash FROM billing_audit_log ORDER BY id DESC LIMIT 1 FOR UPDATE",
  );
  const previousHash = previous[0]?.entry_hash || null;
  const entryHash = crypto.createHash("sha256")
    .update(`${previousHash || ""}|${input.eventUid}|${input.action}|${input.entityId}|${json(input.after)}`)
    .digest("hex");
  await connection.execute(
    `INSERT IGNORE INTO billing_audit_log
       (audit_uid, actor_type, actor_id, action, entity_type, entity_id, customer_uid,
        idempotency_key, after_json, previous_hash, entry_hash)
     VALUES (?, 'webhook', 'razorpay', ?, 'billing_webhook_event', ?, ?, ?, ?, ?, ?)`,
    [`audit_${input.eventUid}`, input.action, input.entityId, input.customerUid,
      input.eventUid, json(input.after), previousHash, entryHash],
  );
}

async function enqueueNotifications(
  connection: PoolConnection,
  customerUid: string,
  eventUid: string,
  type: string,
  planId: string,
) {
  const payload = { customerUid, type, planId, href: "/dashboard/billing", eventKey: eventUid };
  for (const channel of ["in_app", "email"] as const) {
    await connection.execute(
      `INSERT IGNORE INTO billing_notification_outbox
         (outbox_uid, customer_uid, channel, notification_type, dedupe_key, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`out_${crypto.createHash("sha256").update(`${channel}:${eventUid}`).digest("hex").slice(0, 32)}`,
        customerUid, channel, type, `${channel}:${eventUid}`, json(payload)],
    );
  }
}

async function upsertCapturedPaymentAndInvoice(
  connection: PoolConnection,
  event: NonNullable<ReturnType<typeof parseRazorpayBillingEvent>>,
  owner: OwnershipRow,
  eventUid: string,
) {
  const payment = event.payment;
  if (!payment?.id) return;
  const amount = Number(payment.amount || 0);
  if (owner.total_paise != null && amount !== Number(owner.total_paise)) {
    throw new Error(`Provider payment amount mismatch: expected ${owner.total_paise}, received ${amount}.`);
  }
  if (owner.currency && payment.currency && payment.currency !== owner.currency) {
    throw new Error("Provider payment currency mismatch.");
  }

  const paymentUid = `pay_rzp_${payment.id}`;
  await connection.execute(
    `INSERT INTO billing_payments
       (payment_uid, customer_uid, order_uid, razorpay_order_id, razorpay_payment_id,
        amount_paise, currency, status, raw_payload, subscription_id, provider, provider_mode,
        provider_subscription_id, checkout_session_uid, price_version_id, fee_paise, tax_paise,
        captured_at, provider_event_created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'captured', ?, ?, 'razorpay', ?, ?, ?, ?, 0, 0, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = IF(VALUES(provider_event_created_at) >= COALESCE(provider_event_created_at, 0), 'captured', status),
       raw_payload = IF(VALUES(provider_event_created_at) >= COALESCE(provider_event_created_at, 0), VALUES(raw_payload), raw_payload),
       provider = 'razorpay', provider_mode = COALESCE(provider_mode, VALUES(provider_mode)),
       provider_subscription_id = COALESCE(provider_subscription_id, VALUES(provider_subscription_id)),
       checkout_session_uid = COALESCE(checkout_session_uid, VALUES(checkout_session_uid)),
       price_version_id = COALESCE(price_version_id, VALUES(price_version_id)),
       provider_event_created_at = GREATEST(COALESCE(provider_event_created_at, 0), VALUES(provider_event_created_at)),
       captured_at = COALESCE(captured_at, VALUES(captured_at)), updated_at = NOW()`,
    [paymentUid, owner.customer_uid, `subscription:${owner.provider_subscription_id}`,
      payment.order_id || "", payment.id, amount, payment.currency || "INR", json(payment),
      owner.subscription_id, owner.provider_mode, owner.provider_subscription_id,
      owner.checkout_session_uid, owner.price_version_id,
      mysqlDate(payment.captured_at || event.occurredAt), event.occurredAt],
  );

  const { resolveInvoiceSellerProfile } = await import("@/lib/billing/invoice-seller");
  const seller = await resolveInvoiceSellerProfile();
  const existingInvoiceRows = await rows<RowDataPacket & { invoice_uid: string; invoice_number: string | null }>(
    connection,
    `SELECT invoice_uid, invoice_number FROM billing_invoices
      WHERE razorpay_payment_id = ?
      ORDER BY
        CASE
          WHEN invoice_number LIKE 'AR360/%' THEN 0
          WHEN invoice_uid REGEXP '^INV_' THEN 1
          ELSE 2
        END,
        created_at DESC
      LIMIT 1`,
    [payment.id],
  );
  const existingInvoice = existingInvoiceRows[0];
  if (existingInvoice && (String(existingInvoice.invoice_number || "").startsWith("AR360/") || String(existingInvoice.invoice_uid).startsWith("INV_"))) {
    await connection.execute(
      `UPDATE billing_payments
          SET invoice_uid = ?
        WHERE razorpay_payment_id = ?
          AND (invoice_uid IS NULL OR invoice_uid = '' OR invoice_uid LIKE 'inv_rzp_%')`,
      [existingInvoice.invoice_uid, payment.id],
    );
    await connection.execute(
      `INSERT IGNORE INTO billing_history
         (customer_uid, subscription_id, event_type, title, description, amount_paise, meta, dedupe_key)
       VALUES (?, ?, 'payment_captured', 'Payment successful', ?, ?, ?, ?)`,
      [owner.customer_uid, owner.subscription_id, `${owner.plan_id} recurring payment captured.`,
        amount, json({ paymentId: payment.id, invoiceUid: existingInvoice.invoice_uid }), `webhook:${eventUid}:payment`],
    );
    return;
  }

  const invoiceUid = existingInvoice?.invoice_uid
    || `INV_${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const invoiceNumber = existingInvoice?.invoice_number
    || await (await import("@/server/billing/invoice.repository")).nextInvoiceNumber();
  const { computeInclusiveGstBreakdown } = await import("@/server/billing/invoice.service");
  const gst = computeInclusiveGstBreakdown(amount, owner.place_of_supply, seller.state);
  const snapshot = {
    priceVersionUid: owner.price_version_uid,
    providerPlanId: owner.provider_plan_id,
    subtotalPaise: gst.subtotalPaise,
    gstPaise: gst.taxPaise,
    totalPaise: gst.totalPaise,
    gstRate: Number(owner.gst_rate ?? 18),
    gstInclusive: true,
    currency: payment.currency || owner.currency || "INR",
    sellerGstin: seller.gstin || null,
    buyerGstin: owner.buyer_gstin,
    buyerName: owner.buyer_name,
    buyerEmail: owner.buyer_email,
    buyerAddress: owner.buyer_address,
    placeOfSupply: owner.place_of_supply,
    entitlements: null as unknown,
  };
  try {
    const { resolvePlanEntitlements } = await import("@/server/billing/invoice.service");
    snapshot.entitlements = await resolvePlanEntitlements(owner.plan_id);
  } catch {
    snapshot.entitlements = null;
  }
  await connection.execute(
    `INSERT INTO billing_invoices
       (invoice_uid, invoice_number, customer_uid, subscription_id, plan_id, period,
        amount_paise, subtotal_paise, tax_paise, cgst_paise, sgst_paise, igst_paise, total_paise,
        gst_rate, currency, status, razorpay_payment_id, paid_at, checkout_session_uid,
        price_version_id, provider_invoice_id, provider_subscription_id, provider_mode,
        price_snapshot, provider_event_created_at, seller_gstin, buyer_gstin, buyer_name,
        buyer_email, buyer_address, supply_state_code, place_of_supply)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       price_snapshot = COALESCE(price_snapshot, VALUES(price_snapshot)),
       price_version_id = COALESCE(price_version_id, VALUES(price_version_id)),
       checkout_session_uid = COALESCE(checkout_session_uid, VALUES(checkout_session_uid)),
       provider_subscription_id = COALESCE(provider_subscription_id, VALUES(provider_subscription_id)),
       provider_mode = COALESCE(provider_mode, VALUES(provider_mode)),
       tax_paise = COALESCE(tax_paise, VALUES(tax_paise)),
       cgst_paise = COALESCE(cgst_paise, VALUES(cgst_paise)),
       sgst_paise = COALESCE(sgst_paise, VALUES(sgst_paise)),
       igst_paise = COALESCE(igst_paise, VALUES(igst_paise)),
       subtotal_paise = COALESCE(subtotal_paise, VALUES(subtotal_paise)),
       total_paise = COALESCE(total_paise, VALUES(total_paise)),
       provider_event_created_at = GREATEST(COALESCE(provider_event_created_at, 0), VALUES(provider_event_created_at))`,
    [invoiceUid, invoiceNumber, owner.customer_uid, owner.subscription_id, owner.plan_id,
      owner.billing_interval, gst.subtotalPaise, gst.subtotalPaise, gst.taxPaise,
      gst.cgstPaise, gst.sgstPaise, gst.igstPaise, gst.totalPaise, Number(owner.gst_rate ?? 18),
      payment.currency || "INR", payment.id, mysqlDate(payment.captured_at || event.occurredAt),
      owner.checkout_session_uid, owner.price_version_id, payment.invoice_id || null,
      owner.provider_subscription_id, owner.provider_mode, json(snapshot), event.occurredAt,
      seller.gstin || null, owner.buyer_gstin, owner.buyer_name,
      owner.buyer_email, owner.buyer_address, owner.supply_state_code, owner.place_of_supply],
  );
  await connection.execute(
    `UPDATE billing_payments
        SET invoice_uid = ?
      WHERE razorpay_payment_id = ?
        AND (invoice_uid IS NULL OR invoice_uid = '' OR invoice_uid LIKE 'inv_rzp_%')`,
    [invoiceUid, payment.id],
  );
  await connection.execute(
    `INSERT IGNORE INTO billing_history
       (customer_uid, subscription_id, event_type, title, description, amount_paise, meta, dedupe_key)
     VALUES (?, ?, 'payment_captured', 'Payment successful', ?, ?, ?, ?)`,
    [owner.customer_uid, owner.subscription_id, `${owner.plan_id} recurring payment captured.`,
      amount, json({ paymentId: payment.id, invoiceUid }), `webhook:${eventUid}:payment`],
  );
}

async function applyEvent(connection: PoolConnection, inbox: InboxRow) {
  const payload = typeof inbox.payload === "string" ? JSON.parse(inbox.payload) : inbox.payload;
  const event = parseRazorpayBillingEvent(payload);
  if (!event) return;
  const owner = await resolveOwnership(connection, event.providerSubscriptionId, event.providerPaymentId);
  if (!owner) throw new Error("Provider object ownership is not available yet.");

  const state = subscriptionState(event.type);
  if (state && shouldApplyProviderEvent(
    owner.current_event_timestamp == null ? null : Number(owner.current_event_timestamp),
    event.occurredAt,
  )) {
    const subscription = event.subscription;
    const grace = state.status === "past_due"
      ? mysqlDate(event.occurredAt + 7 * 86400)
      : null;
    await connection.execute(
      `INSERT INTO customer_subscriptions
         (customer_uid, plan_id, status, billing_period, current_period_start, current_period_end,
          provider, provider_subscription_id, provider_customer_id, grace_ends_at,
          price_version_id, checkout_session_uid, provider_plan_id, provider_mode, sales_channel,
          provider_status, mandate_status, provider_event_created_at,
          product_limit, storage_limit_mb, bandwidth_limit_mb)
       SELECT ?, ?, ?, ?, ?, ?, 'razorpay', ?, ?, ?, ?, ?, ?, ?, 'self_service', ?, ?, ?,
              bp.products, ROUND(bp.storage_gb * 1024), ROUND(bp.bandwidth_gb * 1024)
         FROM billing_plans bp WHERE bp.id = ?
       ON DUPLICATE KEY UPDATE
         status = CASE
           WHEN term_mode = 'legacy_until_renewal' AND legacy_term_end > NOW() THEN status
           WHEN VALUES(status) = 'pending' THEN status
           ELSE VALUES(status)
         END,
         billing_period = VALUES(billing_period),
         current_period_start = CASE
           WHEN term_mode = 'legacy_until_renewal' AND legacy_term_end > NOW()
             THEN current_period_start
           ELSE COALESCE(VALUES(current_period_start), current_period_start)
         END,
         current_period_end = CASE
           WHEN term_mode = 'legacy_until_renewal' AND legacy_term_end > NOW()
             THEN current_period_end
           ELSE COALESCE(VALUES(current_period_end), current_period_end)
         END,
         provider_subscription_id = VALUES(provider_subscription_id),
         provider_customer_id = COALESCE(VALUES(provider_customer_id), provider_customer_id),
         grace_ends_at = VALUES(grace_ends_at), price_version_id = VALUES(price_version_id),
         checkout_session_uid = VALUES(checkout_session_uid), provider_plan_id = VALUES(provider_plan_id),
         provider_mode = VALUES(provider_mode), provider_status = VALUES(provider_status),
         mandate_status = VALUES(mandate_status), provider_event_created_at = VALUES(provider_event_created_at),
         renewal_state = CASE
           WHEN VALUES(status) = 'active' AND legacy_term_end <= NOW() THEN 'activated'
           WHEN VALUES(mandate_status) = 'authorized' THEN 'mandate_authorized'
           WHEN VALUES(mandate_status) = 'pending' THEN 'mandate_pending'
           ELSE renewal_state
         END,
         term_mode = CASE
           WHEN term_mode = 'legacy_until_renewal'
             AND VALUES(status) = 'active' AND legacy_term_end <= NOW() THEN 'canonical'
           ELSE term_mode
         END,
         updated_at = NOW()`,
      [owner.customer_uid, owner.plan_id, state.status || "pending", owner.billing_interval,
        mysqlDate(subscription?.current_start), mysqlDate(subscription?.current_end),
        event.providerSubscriptionId, subscription?.customer_id || null, grace,
        owner.price_version_id, owner.checkout_session_uid, owner.provider_plan_id, owner.provider_mode,
        subscription?.status || event.type.split(".")[1], state.mandate, event.occurredAt, owner.plan_id],
    );
    // During grace the paid plan is retained; only its access status changes.
    await connection.execute(
      `UPDATE customers c
       JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
       SET c.plan_id = ?, c.status = CASE
             WHEN s.term_mode = 'legacy_until_renewal' AND s.current_period_end > NOW() THEN 'Active'
             WHEN ? IN ('active', 'past_due', 'trialing', 'grace') THEN 'Active'
             WHEN ? IN ('paused', 'halted') THEN 'Suspended'
             ELSE 'Active'
           END,
           c.updated_at = NOW()
       WHERE c.customer_uid = ?`,
      [owner.plan_id, state.status || "pending", state.status || "pending", owner.customer_uid],
    );
    if (state.status === "active") {
      await connection.execute(
        `UPDATE customer_subscriptions SET renewal_attempt_count = 0, next_retry_at = NULL,
            halted_at = NULL, grace_ends_at = NULL WHERE customer_uid = ?`,
        [owner.customer_uid],
      );
    } else if (state.status === "past_due") {
      await connection.execute(
        `UPDATE customer_subscriptions SET renewal_attempt_count = renewal_attempt_count + 1,
            next_retry_at = DATE_ADD(NOW(), INTERVAL LEAST(72, POW(2, LEAST(renewal_attempt_count, 6))) HOUR)
          WHERE customer_uid = ?`,
        [owner.customer_uid],
      );
    } else if (state.status === "halted") {
      await connection.execute(
        `UPDATE customer_subscriptions SET halted_at = COALESCE(halted_at, NOW()),
            next_retry_at = NULL WHERE customer_uid = ?`,
        [owner.customer_uid],
      );
    }
  }

  if (event.type === "payment.captured" || event.type === "subscription.charged") {
    await upsertCapturedPaymentAndInvoice(connection, event, owner, inbox.event_uid);
  } else if (event.type === "payment.failed" && event.payment?.id) {
    await connection.execute(
      `INSERT INTO billing_payments
         (payment_uid, customer_uid, order_uid, razorpay_order_id, razorpay_payment_id,
          amount_paise, currency, status, raw_payload, subscription_id, provider, provider_mode,
          provider_subscription_id, checkout_session_uid, price_version_id,
          failure_code, failure_description, provider_event_created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?, 'razorpay', ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = IF(status <> 'captured' AND VALUES(provider_event_created_at) >= COALESCE(provider_event_created_at, 0), 'failed', status),
         failure_code = VALUES(failure_code), failure_description = VALUES(failure_description),
         provider_event_created_at = GREATEST(COALESCE(provider_event_created_at, 0), VALUES(provider_event_created_at)),
         updated_at = NOW()`,
      [`pay_rzp_${event.payment.id}`, owner.customer_uid, `subscription:${owner.provider_subscription_id}`,
        event.payment.order_id || "", event.payment.id, Number(event.payment.amount || owner.total_paise || 0),
        event.payment.currency || "INR", json(event.payment), owner.subscription_id, owner.provider_mode,
        owner.provider_subscription_id, owner.checkout_session_uid, owner.price_version_id,
        event.payment.error_code || null, event.payment.error_description || null, event.occurredAt],
    );
    await connection.execute(
      `UPDATE customer_subscriptions SET status = 'past_due',
          grace_ends_at = COALESCE(grace_ends_at, FROM_UNIXTIME(? + 604800)),
          renewal_attempt_count = renewal_attempt_count + 1,
          next_retry_at = DATE_ADD(NOW(), INTERVAL LEAST(72, POW(2, LEAST(renewal_attempt_count, 6))) HOUR),
          provider_event_created_at = GREATEST(COALESCE(provider_event_created_at, 0), ?)
        WHERE customer_uid = ? AND ? >= COALESCE(provider_event_created_at, 0)`,
      [event.occurredAt, event.occurredAt, owner.customer_uid, event.occurredAt],
    );
    await connection.execute(
      "UPDATE customers SET plan_id = ?, status = 'Active', updated_at = NOW() WHERE customer_uid = ?",
      [owner.plan_id, owner.customer_uid],
    );
  } else if (event.type.startsWith("refund.") && event.refund?.id && event.providerPaymentId) {
    const refundStatus = event.type === "refund.processed" ? "processed"
      : event.type === "refund.failed" ? "failed" : "created";
    await connection.execute(
      `INSERT INTO billing_refunds
         (refund_uid, customer_uid, billing_payment_id, provider, provider_mode,
          provider_payment_id, provider_refund_id, amount_paise, currency, status,
          failure_code, raw_payload, processed_at, provider_event_created_at)
       SELECT ?, ?, bp.id, 'razorpay', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM billing_payments bp WHERE bp.razorpay_payment_id = ? LIMIT 1
       ON DUPLICATE KEY UPDATE
         status = IF(VALUES(provider_event_created_at) >= COALESCE(provider_event_created_at, 0), VALUES(status), status),
         failure_code = IF(VALUES(provider_event_created_at) >= COALESCE(provider_event_created_at, 0), VALUES(failure_code), failure_code),
         raw_payload = IF(VALUES(provider_event_created_at) >= COALESCE(provider_event_created_at, 0), VALUES(raw_payload), raw_payload),
         processed_at = COALESCE(processed_at, VALUES(processed_at)),
         provider_event_created_at = GREATEST(COALESCE(provider_event_created_at, 0), VALUES(provider_event_created_at))`,
      [`refund_rzp_${event.refund.id}`, owner.customer_uid, owner.provider_mode,
        event.providerPaymentId, event.refund.id, Number(event.refund.amount || 0),
        event.refund.currency || "INR", refundStatus, event.refund.error_code || null,
        json(event.refund), refundStatus === "processed" ? mysqlDate(event.occurredAt) : null,
        event.occurredAt, event.providerPaymentId],
    );
  }

  await connection.execute(
    `INSERT IGNORE INTO billing_history
       (customer_uid, subscription_id, event_type, title, description, amount_paise, meta, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [owner.customer_uid, owner.subscription_id, event.type.replace(".", "_"),
      `Razorpay ${event.type}`, `Recurring billing event ${event.type}.`,
      Number(event.payment?.amount || event.refund?.amount || 0) || null,
      json({ eventUid: inbox.event_uid, occurredAt: event.occurredAt }),
      `webhook:${inbox.event_uid}:event`],
  );
  await enqueueNotifications(connection, owner.customer_uid, inbox.event_uid, event.type, owner.plan_id);
  await appendAudit(connection, {
    eventUid: inbox.event_uid, customerUid: owner.customer_uid,
    action: event.type, entityId: event.providerSubscriptionId || event.providerPaymentId || event.providerRefundId || inbox.event_uid,
    after: event,
  });
}

export async function claimRazorpayWebhook(workerId: string): Promise<InboxRow | null> {
  const pool = await getPool();
  const connection = await pool.getConnection();
  const lockToken = token(workerId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "worker");
  try {
    await connection.beginTransaction();
    const candidates = await rows<InboxRow>(
      connection,
      `SELECT * FROM billing_webhook_events
        WHERE (
            status IN ('received','retry')
            OR (status = 'processing' AND locked_until IS NOT NULL AND locked_until < NOW())
          )
          AND available_at <= NOW()
          AND (locked_until IS NULL OR locked_until < NOW())
        ORDER BY received_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`,
    );
    const candidate = candidates[0];
    if (!candidate) {
      await connection.commit();
      return null;
    }
    await connection.execute(
      `UPDATE billing_webhook_events
          SET status = 'processing', lock_token = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? SECOND),
              processing_started_at = NOW(),
              attempt_count = CASE
                WHEN status = 'processing' THEN attempt_count
                ELSE attempt_count + 1
              END
        WHERE id = ?`,
      [lockToken, LEASE_SECONDS, candidate.id],
    );
    await connection.commit();
    return { ...candidate, lock_token: lockToken, attempt_count: Number(candidate.attempt_count) + (candidate.status === "processing" ? 0 : 1) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function processClaimedRazorpayWebhook(inbox: InboxRow) {
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const locked = await rows<InboxRow>(
      connection,
      "SELECT * FROM billing_webhook_events WHERE id = ? AND lock_token = ? FOR UPDATE",
      [inbox.id, inbox.lock_token],
    );
    if (!locked[0] || locked[0].status !== "processing") {
      await connection.rollback();
      return { skipped: true };
    }

    const payload = typeof locked[0].payload === "string"
      ? JSON.parse(locked[0].payload)
      : locked[0].payload;
    const parsed = parseRazorpayBillingEvent(payload);
    if (parsed?.type === "payment.captured" && parsed.payment?.id) {
      const { applyEnterpriseInstallmentCapture } = await import(
        "@/lib/enterprise-sales/razorpay-installment-capture"
      );
      const enterprise = await applyEnterpriseInstallmentCapture({
        paymentId: parsed.payment.id,
        amountPaise: parsed.payment.amount,
        currency: parsed.payment.currency,
        notes: (parsed.payment.notes as Record<string, unknown> | null) || null,
        paymentLinkId: String((parsed.payment as { payment_link_id?: string }).payment_link_id || "") || null,
        capturedAt: mysqlDate(parsed.payment.captured_at || parsed.occurredAt),
        paymentMethod: "razorpay",
      });
      if (enterprise.handled) {
        await connection.execute(
          `UPDATE billing_webhook_events SET status = 'processed', processed_at = NOW(),
              locked_until = NULL, lock_token = NULL, last_error = NULL, error_message = NULL
            WHERE id = ? AND lock_token = ?`,
          [inbox.id, inbox.lock_token],
        );
        await connection.commit();
        return { processed: true, enterpriseInstallment: true };
      }
    }

    // One-time Razorpay Orders (legacy / self-serve checkout) live in billing_orders,
    // not billing_checkout_sessions. Activate via the same finalize path as verify-payment.
    if (
      parsed?.type === "payment.captured" &&
      parsed.payment?.id &&
      parsed.payment.order_id
    ) {
      const nativeOwner = await resolveOwnership(
        connection,
        parsed.providerSubscriptionId,
        parsed.providerPaymentId,
      );
      if (!nativeOwner) {
        const legacyOrders = await rows<
          RowDataPacket & {
            order_uid: string;
            customer_uid: string;
            plan_id: string;
            billing_period: string;
            amount_paise: number;
            status: string;
          }
        >(
          connection,
          `SELECT order_uid, customer_uid, plan_id, billing_period, amount_paise, status
             FROM billing_orders
            WHERE razorpay_order_id = ?
            LIMIT 1 FOR UPDATE`,
          [parsed.payment.order_id],
        );
        const legacy = legacyOrders[0];
        if (legacy) {
          const expectedPaise = Number(legacy.amount_paise);
          const receivedPaise = Number(parsed.payment.amount || 0);
          if (!Number.isFinite(expectedPaise) || expectedPaise <= 0 || expectedPaise !== receivedPaise) {
            throw new Error(
              `Legacy order amount mismatch: expected ${expectedPaise}, received ${receivedPaise}.`,
            );
          }
          const payCurrency = String(parsed.payment.currency || "INR").toUpperCase();
          if (payCurrency !== "INR") {
            throw new Error(`Legacy order currency mismatch: ${payCurrency}`);
          }

          await connection.commit();
          if (legacy.status !== "paid") {
            const { finalizeSuccessfulPayment } = await import(
              "@/server/billing/payment-finalize.service"
            );
            await finalizeSuccessfulPayment({
              customerUid: legacy.customer_uid,
              orderUid: legacy.order_uid,
              planId: legacy.plan_id,
              period: legacy.billing_period === "yearly" ? "yearly" : "monthly",
              amountPaise: expectedPaise,
              razorpayOrderId: String(parsed.payment.order_id),
              razorpayPaymentId: String(parsed.payment.id),
              rawPayload: typeof locked[0].payload === "string"
                ? JSON.parse(locked[0].payload)
                : locked[0].payload,
            });
          }
          // Crash between finalize and this mark is recovered by expired
          // processing lease reclaim in claimRazorpayWebhook.
          await query(
            `UPDATE billing_webhook_events SET status = 'processed', processed_at = NOW(),
                locked_until = NULL, lock_token = NULL, last_error = NULL, error_message = NULL
              WHERE id = ? AND lock_token = ?`,
            [inbox.id, inbox.lock_token],
          );
          return { processed: true, legacyOrder: true };
        }
      }
    }

    await applyEvent(connection, locked[0]);
    await connection.execute(
      `UPDATE billing_webhook_events SET status = 'processed', processed_at = NOW(),
          locked_until = NULL, lock_token = NULL, last_error = NULL, error_message = NULL
        WHERE id = ? AND lock_token = ?`,
      [inbox.id, inbox.lock_token],
    );
    await connection.commit();
    return { processed: true };
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    const dead = inbox.attempt_count >= MAX_ATTEMPTS;
    await connection.execute(
      `UPDATE billing_webhook_events SET status = ?, available_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
          locked_until = NULL, lock_token = NULL, last_error = ?, error_message = ?,
          dead_lettered_at = IF(?, NOW(), NULL)
        WHERE id = ? AND lock_token = ?`,
      [dead ? "dead" : "retry", retryDelay(inbox.attempt_count), message.slice(0, 2000),
        message.slice(0, 500), dead ? 1 : 0, inbox.id, inbox.lock_token],
    );
    return { processed: false, dead, error: message };
  } finally {
    connection.release();
  }
}

export function defaultRazorpayWebhookWorkerId() {
  return `${os.hostname()}-${process.pid}`;
}

export async function runRazorpayWebhookBatch(workerId: string, limit = 25) {
  let claimed = 0;
  let processed = 0;
  let failed = 0;
  for (let i = 0; i < limit; i += 1) {
    const event = await claimRazorpayWebhook(workerId);
    if (!event) break;
    claimed += 1;
    const result = await processClaimedRazorpayWebhook(event);
    if ("processed" in result && result.processed) processed += 1;
    else failed += 1;
  }
  return { claimed, processed, failed };
}

export async function runRazorpayWebhookWorker(signal?: AbortSignal) {
  const workerId = process.env.RAZORPAY_WEBHOOK_WORKER_ID?.trim() || defaultRazorpayWebhookWorkerId();
  while (!signal?.aborted) {
    const result = await runRazorpayWebhookBatch(workerId);
    if (result.claimed === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
