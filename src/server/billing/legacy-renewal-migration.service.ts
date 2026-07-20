import crypto from "crypto";
import { query } from "@/lib/db";
import { createCustomerNotification } from "@/lib/account/notify.service";
import { sendExpiryEmail } from "@/lib/email/customer-lifecycle.service";
import { getPlatformSettings } from "@/lib/master-admin-settings";
import { createNativeSubscriptionCheckout, type SubscriptionCheckoutClient } from "./native-checkout.service";
import type { PriceVersion } from "./native-subscription.types";
import { syncCustomerPlanMirror } from "./subscription.repository";

const DAY_MS = 86_400_000;
export const RENEWAL_TERMS_VERSION = "legacy-renewal-v1";

export type EnterpriseEvidence = {
  contractId?: string | null;
  contractUid?: string | null;
  signedAt?: string | Date | null;
  approvedQuoteId?: string | null;
};

export function classifyHistoricalEnterprise(evidence: EnterpriseEvidence) {
  const hasContract = Boolean(evidence.contractId || evidence.contractUid);
  return hasContract
    ? { status: "contract_confirmed" as const, reviewRequired: false }
    : { status: "ambiguous_legacy" as const, reviewRequired: true };
}

export function renewalBoundaryState(input: {
  now: Date;
  currentPeriodEnd: Date;
  providerStatus?: string | null;
}) {
  const beforeBoundary = input.now.getTime() < input.currentPeriodEnd.getTime();
  const activated = ["active", "charged"].includes(String(input.providerStatus || "").toLowerCase());
  return {
    preserveLegacyEntitlement: beforeBoundary,
    activateNativeEntitlement: !beforeBoundary && activated,
    expireLegacyEntitlement: !beforeBoundary && !activated,
  };
}

export function shouldSendRenewalInvite(now: Date, currentPeriodEnd: Date) {
  const remaining = currentPeriodEnd.getTime() - now.getTime();
  if (remaining < 0) return false;
  const days = Math.ceil(remaining / DAY_MS);
  return [30, 14, 7, 3, 1, 0].includes(days);
}

export function validateRepeatedConsent(input: {
  existingIdempotencyKey?: string | null;
  requestedIdempotencyKey: string;
}) {
  if (
    input.existingIdempotencyKey &&
    input.existingIdempotencyKey !== input.requestedIdempotencyKey
  ) {
    throw new Error("A renewal mandate invitation is already in progress.");
  }
  return { reused: input.existingIdempotencyKey === input.requestedIdempotencyKey };
}

type LegacyRow = {
  id: number;
  customer_uid: string;
  plan_id: string;
  billing_period: "monthly" | "yearly";
  status: string;
  current_period_end: string | Date;
  term_mode: string;
  renewal_state: string;
  renewal_checkout_session_uid: string | null;
  renewal_provider_subscription_id: string | null;
  renewal_consent_idempotency: string | null;
};

async function addRenewalEvent(input: {
  row: Pick<LegacyRow, "id" | "customer_uid">;
  eventType: string;
  idempotencyKey: string;
  effectiveAt?: Date | null;
  metadata?: unknown;
}) {
  await query(
    `INSERT IGNORE INTO billing_renewal_events
       (event_uid, customer_uid, subscription_id, event_type, idempotency_key, effective_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      `bre_${crypto.randomUUID().replace(/-/g, "")}`,
      input.row.customer_uid,
      input.row.id,
      input.eventType,
      input.idempotencyKey,
      input.effectiveAt || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
}

export async function migrateExistingPaidTerms() {
  // Provider-less active paid rows with an actual paid order are one-time terms.
  // This only labels the row; period, usage counters, limits, invoices and ledgers are untouched.
  await query(
    `UPDATE customer_subscriptions s
     SET s.term_mode = 'legacy_until_renewal',
         s.legacy_migrated_at = COALESCE(s.legacy_migrated_at, NOW()),
         s.legacy_term_end = COALESCE(s.legacy_term_end, s.current_period_end),
         s.renewal_state = IF(s.renewal_state = 'not_applicable', 'eligible', s.renewal_state)
     WHERE s.term_mode = 'canonical'
       AND s.status = 'active'
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end > NOW()
       AND s.provider_subscription_id IS NULL
       AND s.plan_id NOT IN ('trial', 'free')
       AND s.plan_id <> 'enterprise'
       AND EXISTS (
         SELECT 1 FROM billing_orders bo
          WHERE bo.customer_uid = s.customer_uid
            AND bo.status = 'paid'
       )`,
  );

  await query(
    `INSERT IGNORE INTO billing_renewal_events
       (event_uid, customer_uid, subscription_id, event_type, idempotency_key, effective_at, metadata)
     SELECT CONCAT('bre_migrated_', s.id), s.customer_uid, s.id, 'legacy_term_migrated',
            CONCAT('legacy-term-migrated:', s.id), s.current_period_end,
            JSON_OBJECT('preserved_period_end', s.current_period_end, 'plan_id', s.plan_id)
       FROM customer_subscriptions s
      WHERE s.term_mode = 'legacy_until_renewal'`,
  );
  const totals = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM customer_subscriptions WHERE term_mode = 'legacy_until_renewal'",
  );
  return { migratedTotal: Number(totals[0]?.total || 0) };
}

async function getLegacyRow(customerUid: string) {
  const rows = await query<LegacyRow>(
    `SELECT id, customer_uid, plan_id, billing_period, status, current_period_end,
            term_mode, renewal_state, renewal_checkout_session_uid,
            renewal_provider_subscription_id, renewal_consent_idempotency
       FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1`,
    [customerUid],
  );
  return rows[0] || null;
}

export async function consentToLegacyRenewal(input: {
  customerUid: string;
  userId: string;
  customer: { name: string; email: string };
  idempotencyKey: string;
  termsVersion: string;
  client?: SubscriptionCheckoutClient;
  price?: PriceVersion;
  keyId?: string;
}) {
  const row = await getLegacyRow(input.customerUid);
  if (!row || row.term_mode !== "legacy_until_renewal") throw new Error("Legacy renewal is not available.");
  if (input.termsVersion !== RENEWAL_TERMS_VERSION) throw new Error("Current renewal terms must be accepted.");
  if (!row.current_period_end) throw new Error("Legacy term has no renewal boundary.");
  if (row.plan_id === "enterprise" && row.renewal_state !== "admin_approved") {
    throw new Error("Enterprise renewals require contract review.");
  }
  const startAt = new Date(row.current_period_end);
  if (!Number.isFinite(startAt.getTime()) || startAt.getTime() <= Date.now()) {
    throw new Error("Legacy term has already ended.");
  }
  validateRepeatedConsent({
    existingIdempotencyKey: row.renewal_consent_idempotency,
    requestedIdempotencyKey: input.idempotencyKey,
  });

  await query(
    `UPDATE customer_subscriptions
        SET renewal_state = 'consented', renewal_consent_at = COALESCE(renewal_consent_at, NOW()),
            renewal_terms_version = ?, renewal_consent_idempotency = ?, updated_at = NOW()
      WHERE id = ? AND term_mode = 'legacy_until_renewal'
        AND renewal_state IN ('eligible', 'invited', 'consented', 'mandate_pending')`,
    [input.termsVersion, input.idempotencyKey, row.id],
  );

  const checkout = await createNativeSubscriptionCheckout({
    customerUid: row.customer_uid,
    userId: input.userId,
    customer: input.customer,
    planId: row.plan_id,
    period: row.billing_period || "monthly",
    idempotencyKey: input.idempotencyKey,
    startAt,
    purpose: "legacy_renewal",
    client: input.client,
    price: input.price,
    keyId: input.keyId,
  });
  await query(
    `UPDATE customer_subscriptions
        SET renewal_state = 'mandate_pending', renewal_checkout_session_uid = ?,
            renewal_provider_subscription_id = ?, updated_at = NOW()
      WHERE id = ? AND term_mode = 'legacy_until_renewal'`,
    [checkout.checkoutSessionUid, checkout.razorpaySubscriptionId, row.id],
  );
  await addRenewalEvent({
    row,
    eventType: "renewal_consent_recorded",
    idempotencyKey: `renewal-consent:${row.id}:${input.idempotencyKey}`,
    effectiveAt: startAt,
    metadata: { termsVersion: input.termsVersion, providerSubscriptionId: checkout.razorpaySubscriptionId },
  });
  return { ...checkout, startsAt: startAt.toISOString(), legacyAccessUnchanged: true };
}

export async function getLegacyRenewalStatus(customerUid: string) {
  const [row, settings] = await Promise.all([getLegacyRow(customerUid), getPlatformSettings()]);
  if (!row || row.term_mode !== "legacy_until_renewal") return { eligible: false };
  return {
    eligible: true,
    state: row.renewal_state,
    planId: row.plan_id,
    period: row.billing_period,
    currentPeriodEnd: new Date(row.current_period_end).toISOString(),
    termsVersion: RENEWAL_TERMS_VERSION,
    oneTimeFallbackEnabled: settings.legacyOneTimeRenewalsEnabled,
  };
}

export async function runLegacyRenewalScheduler(now = new Date()) {
  const rows = await query<LegacyRow>(
    `SELECT id, customer_uid, plan_id, billing_period, status, current_period_end,
            term_mode, renewal_state, renewal_checkout_session_uid,
            renewal_provider_subscription_id, renewal_consent_idempotency
       FROM customer_subscriptions
      WHERE term_mode = 'legacy_until_renewal'
        AND current_period_end <= DATE_ADD(?, INTERVAL 30 DAY)
        AND renewal_state NOT IN ('activated', 'expired')
      ORDER BY current_period_end ASC LIMIT 500`,
    [now],
  );
  let invited = 0;
  let expired = 0;
  for (const row of rows) {
    const end = new Date(row.current_period_end);
    const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
    if (end.getTime() > now.getTime() && shouldSendRenewalInvite(now, end)) {
      await query(
        `UPDATE customer_subscriptions
            SET renewal_state = IF(renewal_state = 'eligible', 'invited', renewal_state),
                renewal_invited_at = COALESCE(renewal_invited_at, NOW()), updated_at = NOW()
          WHERE id = ? AND renewal_state IN ('eligible', 'invited', 'consented', 'mandate_pending')`,
        [row.id],
      );
      const eventKey = `legacy-renewal:${row.id}:${end.toISOString()}:${days}`;
      await sendExpiryEmail({
        customerUid: row.customer_uid,
        kind: "plan",
        planId: row.plan_id,
        expiresAt: end,
        daysRemaining: days,
        eventKey,
      }).catch(() => undefined);
      await createCustomerNotification({
        customerUid: row.customer_uid,
        category: "subscription",
        title: "Set up renewal before your paid term ends",
        body: `Authorize a recurring mandate. No recurring charge starts before ${end.toLocaleDateString("en-IN")}.`,
        href: "/dashboard/billing?renewal=1",
        dedupeKey: eventKey,
      }).catch(() => undefined);
      await addRenewalEvent({ row, eventType: "renewal_invitation_sent", idempotencyKey: eventKey, effectiveAt: end });
      invited += 1;
    }
    if (end.getTime() <= now.getTime()) {
      await query(
        `UPDATE customer_subscriptions
            SET status = 'expired', renewal_state = 'expired',
                legacy_expired_at = COALESCE(legacy_expired_at, ?), updated_at = NOW()
          WHERE id = ? AND term_mode = 'legacy_until_renewal'
            AND status = 'active' AND current_period_end <= ?`,
        [now, row.id, now],
      );
      if (row.status === "active") {
        await syncCustomerPlanMirror({ customerUid: row.customer_uid, planId: row.plan_id, status: "expired" });
        await addRenewalEvent({
          row,
          eventType: "legacy_term_expired",
          idempotencyKey: `legacy-term-expired:${row.id}:${end.toISOString()}`,
          effectiveAt: end,
          metadata: { mandateCompleted: false },
        });
        expired += 1;
      }
    }
  }
  return { processed: rows.length, invited, expired };
}
