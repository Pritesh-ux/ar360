import { query } from "@/lib/db";
import { createCustomerNotification } from "@/lib/account/notify.service";
import { sendExpiryEmail } from "@/lib/email/customer-lifecycle.service";
import {
  deliverBillingLifecycleEvent,
  processBillingNotificationOutbox,
} from "@/lib/billing/billing-lifecycle-notifications.service";
import { formatPaise } from "@/lib/billing/subscription-presentation";
import {
  addBillingHistory,
  syncCustomerPlanMirror,
} from "@/server/billing/subscription.repository";

type ExpiryCandidate = {
  id: number;
  customer_uid: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | Date | null;
  current_period_end: string | Date | null;
  grace_ends_at: string | Date | null;
  total_paise: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function resolveExpiry(row: ExpiryCandidate) {
  if (row.status === "trialing" && row.trial_ends_at) {
    return { kind: "trial" as const, expiresAt: new Date(row.trial_ends_at) };
  }
  if ((row.status === "grace" || row.status === "past_due") && row.grace_ends_at) {
    return { kind: "plan" as const, expiresAt: new Date(row.grace_ends_at) };
  }
  if (row.current_period_end) {
    return { kind: "plan" as const, expiresAt: new Date(row.current_period_end) };
  }
  return null;
}

export async function runCustomerLifecycleNotifications(now = new Date()) {
  const candidates = await query<ExpiryCandidate>(
    `SELECT s.id, s.customer_uid, s.plan_id, s.status, s.trial_ends_at, s.current_period_end,
            s.grace_ends_at, pv.total_paise
       FROM customer_subscriptions s
       LEFT JOIN billing_plan_price_versions pv ON pv.id = s.price_version_id
      WHERE s.status IN ('trialing', 'active', 'grace', 'past_due')
        AND (
          (s.status = 'trialing' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at <= DATE_ADD(?, INTERVAL 14 DAY))
          OR (s.status = 'active' AND s.current_period_end IS NOT NULL AND s.current_period_end <= DATE_ADD(?, INTERVAL 14 DAY))
          OR (s.status IN ('grace', 'past_due') AND s.grace_ends_at IS NOT NULL AND s.grace_ends_at <= DATE_ADD(?, INTERVAL 14 DAY))
        )
      ORDER BY COALESCE(s.trial_ends_at, s.grace_ends_at, s.current_period_end) ASC
      LIMIT 500`,
    [now, now, now],
  );

  let reminded = 0;
  let expired = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const expiry = resolveExpiry(candidate);
    if (!expiry || Number.isNaN(expiry.expiresAt.getTime())) {
      skipped += 1;
      continue;
    }

    const remainingMs = expiry.expiresAt.getTime() - now.getTime();
    const daysRemaining = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / DAY_MS);
    const reminderDays = expiry.kind === "trial" ? [1, 0] : [14, 7, 3, 1, 0];
    if (!reminderDays.includes(daysRemaining)) {
      skipped += 1;
      continue;
    }

    const expiryKey = expiry.expiresAt.toISOString();
    if (candidate.status === "active" && daysRemaining > 0) {
      await deliverBillingLifecycleEvent({
        customerUid: candidate.customer_uid,
        type: "upcoming_debit",
        eventKey: `upcoming-debit:${expiryKey}:${daysRemaining}`,
        title: "Upcoming AR360 debit",
        body: `${formatPaise(candidate.total_paise)} (GST inclusive) is scheduled in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`,
      }).catch(() => undefined);
      reminded += 1;
      continue;
    }

    const email = await sendExpiryEmail({
      customerUid: candidate.customer_uid,
      kind: expiry.kind,
      planId: candidate.plan_id,
      expiresAt: expiry.expiresAt,
      daysRemaining,
      eventKey: expiryKey,
    });

    const isExpired = remainingMs <= 0;
    await createCustomerNotification({
      customerUid: candidate.customer_uid,
      category: "subscription",
      title: isExpired
        ? `Your ${expiry.kind === "trial" ? "trial" : "plan"} has expired`
        : `${expiry.kind === "trial" ? "Trial" : "Plan"} expiry reminder`,
      body: isExpired
        ? "Choose or renew a plan to restore your AR360 access."
        : `Your access expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`,
      href: "/dashboard/billing",
      dedupeKey: `${expiry.kind}-expiry:${expiryKey}:${daysRemaining}`,
    }).catch(() => undefined);

    if (!email.skipped) reminded += 1;

    if (isExpired) {
      await query(
        `UPDATE customer_subscriptions SET status = 'expired', updated_at = NOW()
          WHERE id = ? AND status IN ('trialing', 'active', 'grace', 'past_due')`,
        [candidate.id],
      );
      await syncCustomerPlanMirror({
        customerUid: candidate.customer_uid,
        planId: candidate.plan_id,
        status: "expired",
      });
      await addBillingHistory({
        customerUid: candidate.customer_uid,
        subscriptionId: candidate.id,
        eventType: expiry.kind === "trial" ? "trial_expired" : "subscription_expired",
        title: expiry.kind === "trial" ? "Trial expired" : "Subscription expired",
        description: `Access expired on ${expiry.expiresAt.toISOString()}.`,
      });
      expired += 1;
    }
  }

  const outbox = await processBillingNotificationOutbox();
  const { runEnterpriseInstallmentReminders, runEnterpriseRenewalReminders } = await import(
    "@/lib/enterprise-sales/installment-reminders"
  );
  const installmentReminders = await runEnterpriseInstallmentReminders(now).catch(() => ({ reminded: 0, scanned: 0 }));
  const renewalReminders = await runEnterpriseRenewalReminders(now).catch(() => ({ reminded: 0, scanned: 0 }));
  return {
    processed: candidates.length,
    reminded,
    expired,
    skipped,
    outbox,
    installmentReminders,
    renewalReminders,
    ranAt: now.toISOString(),
  };
}
