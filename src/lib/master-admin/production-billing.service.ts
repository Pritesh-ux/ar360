import crypto from "crypto";
import { query } from "@/lib/db";

export async function getPlanProviderControls() {
  return query<any>(`
    SELECT p.id AS planId, p.name, p.sales_channel AS salesChannel,
      v.billing_interval AS billingInterval, v.provider_mode AS providerMode,
      v.version, v.provider_plan_id AS providerPlanId, v.total_paise AS totalPaise,
      v.publish_status AS publishStatus, v.publish_error AS publishError,
      v.last_synced_at AS lastSyncedAt, v.created_at AS publishedAt,
      (SELECT COUNT(*) FROM customer_subscriptions s
        WHERE s.price_version_id = v.id AND s.status IN ('active','authenticated','paused','past_due','halted')) AS subscriberCount
    FROM billing_plans p
    LEFT JOIN billing_plan_price_versions v ON v.plan_id = p.id AND v.retired_at IS NULL
    WHERE p.id IN ('starter','pro','business','enterprise')
    ORDER BY p.sort_order, v.provider_mode, v.billing_interval
  `).catch(() => []);
}

export async function getCustomerProductionBilling(customerUid: string) {
  const [subscription, changes, events, payments, refunds, issues] = await Promise.all([
    query<any>(`SELECT s.*, pv.price_version_uid, pv.provider_plan_id AS mapped_provider_plan_id,
      pv.total_paise, pv.billing_interval AS mapped_interval
      FROM customer_subscriptions s
      LEFT JOIN billing_plan_price_versions pv ON pv.id = s.price_version_id
      WHERE s.customer_uid = ? ORDER BY s.id DESC LIMIT 1`, [customerUid]).catch(() => []),
    query<any>(`SELECT * FROM billing_scheduled_changes WHERE customer_uid = ? ORDER BY created_at DESC LIMIT 20`, [customerUid]).catch(() => []),
    query<any>(`SELECT event_uid, event_type, status, attempt_count, last_error, received_at, processed_at
      FROM billing_webhook_events
      WHERE provider_subscription_id = (SELECT provider_subscription_id FROM customer_subscriptions WHERE customer_uid = ? ORDER BY id DESC LIMIT 1)
      ORDER BY received_at DESC LIMIT 30`, [customerUid]).catch(() => []),
    query<any>(`SELECT payment_uid, provider_payment_id, amount_paise, status, failure_code,
      failure_description, captured_at, created_at, invoice_uid
      FROM billing_payments WHERE customer_uid = ? ORDER BY created_at DESC LIMIT 30`, [customerUid]).catch(() => []),
    query<any>(`SELECT r.*, cn.credit_note_uid, cn.credit_note_number, cn.status AS credit_note_status
      FROM billing_refunds r LEFT JOIN billing_credit_notes cn ON cn.refund_uid = r.refund_uid
      WHERE r.customer_uid = ? ORDER BY r.requested_at DESC LIMIT 30`, [customerUid]).catch(() => []),
    query<any>(`SELECT issue_uid, issue_type, severity, status, summary, last_seen_at
      FROM billing_reconciliation_issues WHERE customer_uid = ? ORDER BY last_seen_at DESC LIMIT 20`, [customerUid]).catch(() => []),
  ]);
  return { subscription: subscription[0] || null, scheduledChanges: changes, webhookEvents: events, payments, refunds, reconciliationIssues: issues };
}

export async function refreshBillingAdminAlerts() {
  const statements: Array<{ type: string; entityType: string; entityId: string; summary: string; details?: unknown }> = [];
  const [backlog, stuck, unmatched, missing, halted, mismatches] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*) total FROM billing_webhook_events
      WHERE status IN ('received','failed') AND dead_lettered_at IS NULL`).catch(() => [{ total: 0 }]),
    query<any>(`SELECT event_uid, event_type, attempt_count FROM billing_webhook_events
      WHERE status IN ('processing','failed') AND received_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
      AND dead_lettered_at IS NULL LIMIT 100`).catch(() => []),
    query<any>(`SELECT event_uid, event_type FROM billing_webhook_events
      WHERE status = 'dead_letter' OR dead_lettered_at IS NOT NULL LIMIT 100`).catch(() => []),
    query<any>(`SELECT s.id, s.customer_uid, s.plan_id FROM customer_subscriptions s
      WHERE s.provider = 'razorpay' AND s.sales_channel = 'self_service'
      AND (s.price_version_id IS NULL OR s.provider_plan_id IS NULL) LIMIT 100`).catch(() => []),
    query<any>(`SELECT id, customer_uid, provider_subscription_id FROM customer_subscriptions
      WHERE status = 'halted' OR provider_status = 'halted' LIMIT 100`).catch(() => []),
    query<any>(`SELECT issue_uid, issue_type, summary FROM billing_reconciliation_issues
      WHERE status IN ('open','investigating') LIMIT 100`).catch(() => []),
  ]);
  if (Number(backlog[0]?.total || 0) > 25) statements.push({
    type: "webhook_backlog", entityType: "webhook_queue", entityId: "razorpay",
    summary: `${Number(backlog[0].total)} Razorpay webhook events are pending.`, details: backlog[0],
  });
  for (const row of stuck) statements.push({ type: "stuck_event", entityType: "webhook_event", entityId: row.event_uid, summary: `Webhook ${row.event_type} is stuck after ${row.attempt_count} attempts.` });
  for (const row of unmatched) statements.push({ type: "unmatched_event", entityType: "webhook_event", entityId: row.event_uid, summary: `Webhook ${row.event_type} could not be matched or processed.` });
  for (const row of missing) statements.push({ type: "missing_mapping", entityType: "subscription", entityId: String(row.id), summary: `${row.customer_uid} has no immutable ${row.plan_id} provider mapping.` });
  for (const row of halted) statements.push({ type: "subscription_halted", entityType: "subscription", entityId: String(row.id), summary: `${row.customer_uid} Razorpay subscription is halted.` });
  for (const row of mismatches) statements.push({ type: "provider_mismatch", entityType: "reconciliation_issue", entityId: row.issue_uid, summary: row.summary });

  for (const item of statements) {
    await query(`INSERT INTO billing_admin_alerts
      (alert_uid, alert_type, severity, entity_type, entity_id, summary, details)
      VALUES (?, ?, IF(? IN ('subscription_halted','stuck_event'),'critical','warning'), ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE last_seen_at=NOW(), summary=VALUES(summary), details=VALUES(details)`,
    [`baa_${crypto.randomUUID().replace(/-/g, "")}`, item.type, item.type, item.entityType, item.entityId, item.summary, JSON.stringify(item.details || null)]);
  }
  return query<any>(`SELECT * FROM billing_admin_alerts WHERE status IN ('open','acknowledged')
    ORDER BY FIELD(severity,'critical','error','warning'), last_seen_at DESC LIMIT 100`).catch(() => []);
}

