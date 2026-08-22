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
import {
  formatTrialDurationLabel,
  mapLegacyPlanId,
  normalizeTrialHours,
} from "@/lib/billing/plan-enforcement";
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
    // One-time Razorpay Orders use pay_ ids — never store those as provider_subscription_id
    // (that column is reserved for recurring sub_… subscriptions).
    provider: "razorpay",
    providerSubscriptionId: null,
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
  const limits = await resolvePlanLimits("trial");
  const trialHours = normalizeTrialHours(limits.trialHours);
  const trialEnd = new Date(now.getTime() + trialHours * 60 * 60 * 1000);
  const durationLabel = formatTrialDurationLabel(trialHours);

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
      title: `${durationLabel} trial started`,
      description: `Trial access is valid for ${durationLabel} (Master Admin trial plan settings).`,
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

function canFallbackToLocalLifecycle(error: unknown) {
  // PROVIDER_ID_INVALID must NOT fall back locally — that leaves Razorpay charging while
  // we mark the customer cancelled. Only truly non-provider rows may use local lifecycle.
  return error instanceof SubscriptionLifecycleError && error.code === "NOT_PROVIDER_MANAGED";
}

export async function cancelCustomerSubscription(
  customerUid: string,
  cancelAtPeriodEnd = true,
  actor?: { type: "customer" | "admin"; id?: string | null },
) {
  try {
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
  } catch (error) {
    if (canFallbackToLocalLifecycle(error)) {
      const subscription = await mutateLocalSubscriptionLifecycle(customerUid, "cancel", actor, {
        cancelAtPeriodEnd,
        forceLocal: true,
      });
      await sendSubscriptionStateEmail({
        customerUid,
        state: "cancelled",
        planId: subscription?.plan_id,
        effectiveAt: cancelAtPeriodEnd
          ? subscription?.current_period_end || subscription?.trial_ends_at
          : new Date(),
        eventKey: String(subscription?.updated_at || Date.now()),
      }).catch(() => undefined);
      return subscription;
    }
    throw error;
  }
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
    if (canFallbackToLocalLifecycle(error)) {
      const subscription = await mutateLocalSubscriptionLifecycle(customerUid, "resume", actor, {
        forceLocal: true,
      });
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
    if (canFallbackToLocalLifecycle(error)) {
      return mutateLocalSubscriptionLifecycle(customerUid, "pause", actor, { forceLocal: true });
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
