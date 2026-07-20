import { resolvePlanLimits } from "@/lib/billing/resolve-plan-limits";
import {
  addBillingHistory,
  applySubscriptionChange,
  getSubscriptionByCustomer,
  listBillingHistory,
  listInvoices,
  type SubscriptionWriteInput,
} from "./subscription.repository";
import type { BillingPeriod } from "./subscription.types";
import { sendSubscriptionStateEmail } from "@/lib/email/customer-lifecycle.service";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";
import { mutateProviderSubscription, SubscriptionLifecycleError } from "./provider-subscription.service";
import { mutateLocalSubscriptionLifecycle } from "./local-subscription-lifecycle";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function toMysqlDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function getCustomerSubscription(customerUid: string) {
  return getSubscriptionByCustomer(customerUid);
}

/** Canonical subscription mutation — resolves plan limits from billing_plans. */
export async function applySubscriptionChangeForPlan(
  input: Omit<SubscriptionWriteInput, "productLimit" | "storageLimitMb" | "bandwidthLimitMb"> & {
    historyEvent?: {
      eventType: string;
      title: string;
      description?: string;
      amountPaise?: number;
      meta?: unknown;
    };
  },
) {
  const { historyEvent, ...change } = input;
  const canonicalPlanId = mapLegacyPlanId(change.planId);
  const limits = await resolvePlanLimits(canonicalPlanId);
  const subscription = await applySubscriptionChange({
    ...change,
    planId: canonicalPlanId,
    productLimit: limits.products,
    storageLimitMb: limits.storageMb,
    bandwidthLimitMb: limits.unlimitedBandwidth ? null : Math.round((limits.bandwidthGb ?? 0) * 1024),
    unlimitedStorage: limits.unlimitedStorage,
    unlimitedBandwidth: limits.unlimitedBandwidth,
  });

  if (historyEvent) {
    await addBillingHistory({
      customerUid: change.customerUid,
      subscriptionId: subscription?.id,
      eventType: historyEvent.eventType,
      title: historyEvent.title,
      description: historyEvent.description,
      amountPaise: historyEvent.amountPaise,
      meta: historyEvent.meta,
    });
  }

  return subscription;
}

export async function activatePaidSubscription(input: {
  customerUid: string;
  planId: string;
  period: BillingPeriod;
  amountPaise?: number;
  razorpayPaymentId?: string | null;
  razorpayCustomerId?: string | null;
  resetBandwidth?: boolean;
}) {
  const now = new Date();
  const periodEnd = input.period === "yearly" ? addYears(now, 1) : addMonths(now, 1);

  return applySubscriptionChangeForPlan({
    customerUid: input.customerUid,
    planId: input.planId,
    status: "active",
    billingPeriod: input.period,
    currentPeriodStart: toMysqlDate(now),
    currentPeriodEnd: toMysqlDate(periodEnd),
    trialEndsAt: null,
    graceEndsAt: null,
    provider: "razorpay",
    providerSubscriptionId: input.razorpayPaymentId || null,
    providerCustomerId: input.razorpayCustomerId || null,
    cancelAtPeriodEnd: false,
    resetBandwidth: input.resetBandwidth,
    historyEvent: {
      eventType: "subscription_activated",
      title: "Subscription activated",
      description: `Plan ${mapLegacyPlanId(input.planId)} is now active.`,
      amountPaise: input.amountPaise,
    },
  });
}

export async function startTrialSubscription(customerUid: string) {
  const now = new Date();
  const trialEnd = addDays(now, 1);

  return applySubscriptionChangeForPlan({
    customerUid,
    planId: "trial",
    status: "trialing",
    billingPeriod: "monthly",
    trialStartedAt: toMysqlDate(now),
    trialEndsAt: toMysqlDate(trialEnd),
    currentPeriodStart: toMysqlDate(now),
    currentPeriodEnd: toMysqlDate(trialEnd),
    trialUsed: true,
    cancelAtPeriodEnd: false,
    historyEvent: {
      eventType: "trial_started",
      title: "24-hour trial started",
      description: "Trial access is valid for 24 hours.",
    },
  });
}

export async function markSubscriptionPastDue(customerUid: string) {
  const now = new Date();
  const graceEnd = addDays(now, 3);
  const existing = await getSubscriptionByCustomer(customerUid);
  const planId = existing?.plan_id || "trial";

  return applySubscriptionChangeForPlan({
    customerUid,
    planId,
    status: "grace",
    billingPeriod: (existing?.period as BillingPeriod) || "monthly",
    currentPeriodStart: existing?.current_period_start
      ? toMysqlDate(new Date(existing.current_period_start))
      : null,
    currentPeriodEnd: existing?.current_period_end
      ? toMysqlDate(new Date(existing.current_period_end))
      : null,
    graceEndsAt: toMysqlDate(graceEnd),
    cancelAtPeriodEnd: Boolean(existing?.cancel_at_period_end),
    historyEvent: {
      eventType: "subscription_grace",
      title: "Grace period started",
      description: "Payment is pending. Access is temporarily continued.",
    },
  });
}

export async function cancelCustomerSubscription(
  customerUid: string,
  cancelAtPeriodEnd = true,
  actor?: { type: "customer" | "admin"; id?: string | null },
) {
  const subscription = await mutateProviderSubscription({
    customerUid,
    action: "cancel",
    cancelAtPeriodEnd,
    actorType: actor?.type,
    actorId: actor?.id,
  });
  await sendSubscriptionStateEmail({
    customerUid,
    state: "cancelled",
    planId: subscription?.plan_id,
    effectiveAt: cancelAtPeriodEnd ? subscription?.current_period_end : new Date(),
    eventKey: String(subscription?.updated_at || Date.now()),
  }).catch(() => undefined);
  return subscription;
}

export async function resumeCustomerSubscription(
  customerUid: string,
  actor?: { type: "customer" | "admin"; id?: string | null },
) {
  try {
    const subscription = await mutateProviderSubscription({
      customerUid,
      action: "resume",
      actorType: actor?.type,
      actorId: actor?.id,
    });
    await sendSubscriptionStateEmail({
      customerUid,
      state: "resumed",
      planId: subscription?.plan_id,
      eventKey: String(subscription?.updated_at || Date.now()),
    }).catch(() => undefined);
    return subscription;
  } catch (error) {
    if (error instanceof SubscriptionLifecycleError && error.code === "NOT_PROVIDER_MANAGED") {
      const subscription = await mutateLocalSubscriptionLifecycle(customerUid, "resume", actor);
      await sendSubscriptionStateEmail({
        customerUid,
        state: "resumed",
        planId: subscription?.plan_id,
        eventKey: String(subscription?.updated_at || Date.now()),
      }).catch(() => undefined);
      return subscription;
    }
    throw error;
  }
}

export async function pauseCustomerSubscription(
  customerUid: string,
  actor?: { type: "customer" | "admin"; id?: string | null },
) {
  try {
    return await mutateProviderSubscription({
      customerUid,
      action: "pause",
      actorType: actor?.type,
      actorId: actor?.id,
    });
  } catch (error) {
    if (error instanceof SubscriptionLifecycleError && error.code === "NOT_PROVIDER_MANAGED") {
      return mutateLocalSubscriptionLifecycle(customerUid, "pause", actor);
    }
    throw error;
  }
}

export async function getBillingHistory(customerUid: string) {
  return listBillingHistory(customerUid);
}

export async function getInvoices(customerUid: string) {
  return listInvoices(customerUid);
}
