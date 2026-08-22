import crypto from "crypto";
import { query } from "@/lib/db";
import { getPlanById } from "@/lib/billing/plans";
import { getPlanLevel } from "@/lib/billing/plan-levels";
import { resolvePlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getRazorpayClient } from "./razorpay";
import { getSubscriptionByCustomer, syncCustomerPlanMirror } from "./subscription.repository";
import type { BillingPeriod, BillingSubscription } from "./subscription.types";
import { deliverBillingLifecycleEvent } from "@/lib/billing/billing-lifecycle-notifications.service";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";

type ProviderSubscription = {
  id: string;
  status: string;
  plan_id?: string;
  current_start?: number;
  current_end?: number;
  ended_at?: number;
  pause_initiated_by?: string;
  cancel_at_cycle_end?: boolean | number;
};

export interface SubscriptionProvider {
  fetch(id: string): Promise<ProviderSubscription>;
  cancel(id: string, atCycleEnd: boolean): Promise<ProviderSubscription>;
  pause(id: string): Promise<ProviderSubscription>;
  resume(id: string): Promise<ProviderSubscription>;
  changePlan(id: string, providerPlanId: string, effective: "now" | "cycle_end"): Promise<ProviderSubscription>;
}

export function razorpaySubscriptionProvider(): SubscriptionProvider {
  return {
    async fetch(id) {
      const client = await getRazorpayClient();
      return client.subscriptions.fetch(id) as Promise<ProviderSubscription>;
    },
    async cancel(id, atCycleEnd) {
      const client = await getRazorpayClient();
      return client.subscriptions.cancel(id, atCycleEnd) as Promise<ProviderSubscription>;
    },
    async pause(id) {
      const client = await getRazorpayClient();
      return client.subscriptions.pause(id, { pause_at: "now" }) as Promise<ProviderSubscription>;
    },
    async resume(id) {
      const client = await getRazorpayClient();
      return client.subscriptions.resume(id, { resume_at: "now" }) as Promise<ProviderSubscription>;
    },
    async changePlan(id, providerPlanId, effective) {
      const client = await getRazorpayClient();
      try {
        return (await client.subscriptions.update(id, {
          plan_id: providerPlanId,
          schedule_change_at: effective === "cycle_end" ? "cycle_end" : "now",
          customer_notify: true,
        })) as ProviderSubscription;
      } catch (error) {
        throw mapRazorpayLifecycleError(error, "PROVIDER_CHANGE_REJECTED");
      }
    },
  };
}

function isRazorpayPlanId(value: string | null | undefined) {
  return /^plan_[A-Za-z0-9]+$/.test(String(value || "").trim());
}

export function isRazorpaySubscriptionId(value: string | null | undefined) {
  return /^sub_[A-Za-z0-9]+$/.test(String(value || "").trim());
}

function mapRazorpayProviderError(error: unknown, action: "cancel" | "pause" | "resume"): SubscriptionLifecycleError {
  const payload = error as {
    statusCode?: number;
    error?: { code?: string; description?: string };
    message?: string;
  };
  const description =
    payload?.error?.description ||
    (error instanceof Error ? error.message : "") ||
    `Razorpay rejected the ${action} request.`;
  const invalidId = /invalid|could not be found|not found/i.test(description);
  if (invalidId) {
    return new SubscriptionLifecycleError(
      "Provider subscription is unavailable. Applying the change locally.",
      "PROVIDER_ID_INVALID",
      409,
    );
  }
  return new SubscriptionLifecycleError(description, `PROVIDER_${action.toUpperCase()}_REJECTED`, 502);
}

function mapRazorpayLifecycleError(error: unknown, fallbackCode: string): SubscriptionLifecycleError {
  const payload = error as {
    statusCode?: number;
    error?: { code?: string; description?: string };
    message?: string;
  };
  const description =
    payload?.error?.description ||
    (error instanceof Error ? error.message : "") ||
    "Razorpay rejected the plan change.";
  const invalidId = /invalid|could not be found|not found/i.test(description);
  if (invalidId) {
    return new SubscriptionLifecycleError(
      "This subscription cannot be upgraded in place. Continue to checkout to switch plans.",
      "CHECKOUT_REQUIRED",
      409,
    );
  }
  return new SubscriptionLifecycleError(description, fallbackCode, payload?.statusCode === 400 ? 400 : 502);
}

export class SubscriptionLifecycleError extends Error {
  constructor(message: string, readonly code: string, readonly status = 409) {
    super(message);
  }
}

export function validateLifecycleTransition(
  status: string,
  action: "cancel" | "pause" | "resume",
  cancelAtPeriodEnd = true,
) {
  if (["cancelled", "completed"].includes(status)) {
    if (action === "resume") {
      throw new SubscriptionLifecycleError(
        "A cancelled or completed subscription requires a new checkout and customer consent.",
        "NEW_CONSENT_REQUIRED",
      );
    }
    throw new SubscriptionLifecycleError("Subscription is already ended.", "SUBSCRIPTION_ENDED");
  }
  if (action === "pause" && !["active", "authenticated", "trialing", "trialling", "trial"].includes(status)) {
    throw new SubscriptionLifecycleError(
      "Only active, authenticated, or trial subscriptions can be paused.",
      "PAUSE_NOT_ALLOWED",
    );
  }
  if (action === "resume" && status !== "paused") {
    throw new SubscriptionLifecycleError("Only paused subscriptions can resume.", "RESUME_NOT_ALLOWED");
  }
  return {
    scheduledCancellation: action === "cancel" && cancelAtPeriodEnd,
    effectiveCancellation: action === "cancel" && !cancelAtPeriodEnd,
  };
}

function requireNative(subscription: BillingSubscription | null) {
  if (!subscription) throw new SubscriptionLifecycleError("Subscription not found.", "SUBSCRIPTION_NOT_FOUND", 404);
  if (!isRazorpaySubscriptionId(subscription.razorpay_subscription_id)) {
    throw new SubscriptionLifecycleError("This subscription is not managed by Razorpay.", "NOT_PROVIDER_MANAGED");
  }
  return subscription;
}

function assertIdentity(expectedId: string, response: ProviderSubscription) {
  if (!response?.id || response.id !== expectedId || !response.status) {
    throw new SubscriptionLifecycleError("Razorpay returned an invalid subscription response.", "INVALID_PROVIDER_RESPONSE", 502);
  }
}

function mysqlDate(unix?: number) {
  return unix ? new Date(unix * 1000).toISOString().slice(0, 19).replace("T", " ") : null;
}

async function audit(input: {
  actorType: "customer" | "admin" | "system" | "reconciler";
  actorId?: string | null;
  action: string;
  subscription: BillingSubscription;
  after: unknown;
  metadata?: unknown;
}) {
  const auditUid = `audit_${crypto.randomUUID().replace(/-/g, "")}`;
  const previous = await query<{ entry_hash: string }>(
    "SELECT entry_hash FROM billing_audit_log ORDER BY id DESC LIMIT 1",
  );
  const previousHash = previous[0]?.entry_hash || null;
  const afterJson = JSON.stringify(input.after ?? null);
  const metadata = JSON.stringify(input.metadata ?? null);
  const entryHash = crypto.createHash("sha256")
    .update(`${previousHash || ""}|${auditUid}|${input.action}|${input.subscription.id}|${afterJson}`)
    .digest("hex");
  await query(
    `INSERT INTO billing_audit_log
      (audit_uid, actor_type, actor_id, action, entity_type, entity_id, customer_uid,
       after_json, metadata, previous_hash, entry_hash)
     VALUES (?, ?, ?, ?, 'customer_subscription', ?, ?, ?, ?, ?, ?)`,
    [auditUid, input.actorType, input.actorId || null, input.action, String(input.subscription.id),
      input.subscription.customer_uid, afterJson, metadata, previousHash, entryHash],
  );
}

export async function mutateProviderSubscription(input: {
  customerUid: string;
  action: "cancel" | "pause" | "resume";
  cancelAtPeriodEnd?: boolean;
  actorType?: "customer" | "admin";
  actorId?: string | null;
  provider?: SubscriptionProvider;
}) {
  const current = requireNative(await getSubscriptionByCustomer(input.customerUid));
  const providerId = current.razorpay_subscription_id!;
  const provider = input.provider || razorpaySubscriptionProvider();
  let result: ProviderSubscription;
  const transition = validateLifecycleTransition(
    current.status,
    input.action,
    input.cancelAtPeriodEnd !== false,
  );

  try {
    if (input.action === "resume") {
      result = await provider.resume(providerId);
      assertIdentity(providerId, result);
      if (!["active", "authenticated", "resumed"].includes(result.status)) {
        throw new SubscriptionLifecycleError("Razorpay did not resume the subscription.", "PROVIDER_RESUME_REJECTED", 502);
      }
    } else if (input.action === "pause") {
      result = await provider.pause(providerId);
      assertIdentity(providerId, result);
      if (result.status !== "paused") {
        throw new SubscriptionLifecycleError("Razorpay did not pause the subscription.", "PROVIDER_PAUSE_REJECTED", 502);
      }
    } else {
      result = await provider.cancel(providerId, input.cancelAtPeriodEnd !== false);
      assertIdentity(providerId, result);
      const scheduled = input.cancelAtPeriodEnd !== false;
      if (scheduled && !["active", "authenticated", "pending", "paused"].includes(result.status)) {
        throw new SubscriptionLifecycleError("Razorpay did not schedule cancellation.", "PROVIDER_CANCEL_REJECTED", 502);
      }
      if (!scheduled && result.status !== "cancelled") {
        throw new SubscriptionLifecycleError("Razorpay did not cancel the subscription.", "PROVIDER_CANCEL_REJECTED", 502);
      }
    }
  } catch (error) {
    if (error instanceof SubscriptionLifecycleError) throw error;
    throw mapRazorpayProviderError(error, input.action);
  }

  const { scheduledCancellation, effectiveCancellation } = transition;
  const localStatus = input.action === "pause" ? "paused"
    : input.action === "resume" ? "active"
      : effectiveCancellation ? "cancelled" : current.status;
  await query(
    `UPDATE customer_subscriptions
        SET status = ?, provider_status = ?, cancel_at_period_end = ?,
            cancelled_at = ?, current_period_start = COALESCE(?, current_period_start),
            current_period_end = COALESCE(?, current_period_end), updated_at = NOW()
      WHERE customer_uid = ? AND provider_subscription_id = ?`,
    [localStatus, result.status, scheduledCancellation ? 1 : 0,
      effectiveCancellation ? mysqlDate(result.ended_at) || new Date() : null,
      mysqlDate(result.current_start), mysqlDate(result.current_end), input.customerUid, providerId],
  );
  await syncCustomerPlanMirror({
    customerUid: input.customerUid,
    planId: current.plan_id,
    status: localStatus,
  });
  if (scheduledCancellation) {
    await query(
      `INSERT INTO billing_scheduled_changes
        (change_uid, customer_uid, subscription_id, provider_subscription_id, change_type,
         from_plan_id, effective_at, status, provider_response)
       VALUES (?, ?, ?, ?, 'cancellation', ?, ?, 'scheduled', ?)`,
      [`bsc_${crypto.randomUUID().replace(/-/g, "")}`, input.customerUid, current.id, providerId,
        current.plan_id, current.current_period_end || new Date(), JSON.stringify(result)],
    );
  }
  await query(
    `INSERT INTO billing_history
       (customer_uid, subscription_id, event_type, title, description, meta)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.customerUid, current.id,
      scheduledCancellation ? "subscription_cancellation_scheduled" : `subscription_${input.action}d`,
      scheduledCancellation ? "Cancellation scheduled" : `Subscription ${input.action}d`,
      scheduledCancellation ? "Access remains active through the paid period." : null,
      JSON.stringify({ providerStatus: result.status, providerSubscriptionId: providerId })],
  );
  await audit({
    actorType: input.actorType || "customer",
    actorId: input.actorId,
    action: scheduledCancellation ? "subscription.cancellation_scheduled" : `subscription.${input.action}d`,
    subscription: current,
    after: result,
  });
  await deliverBillingLifecycleEvent({
    customerUid: input.customerUid,
    type: scheduledCancellation ? "cancellation_scheduled" : `subscription_${input.action}d`,
    eventKey: `${providerId}:${scheduledCancellation ? "cancel-scheduled" : input.action}:${result.status}`,
    title: scheduledCancellation ? "Cancellation scheduled" : `Subscription ${input.action}d`,
    body: scheduledCancellation
      ? `Your access remains active through ${current.current_period_end || "the end of the paid period"}.`
      : `Razorpay confirmed that your subscription was ${input.action}d.`,
  }).catch(() => undefined);
  return getSubscriptionByCustomer(input.customerUid);
}

export async function previewAndSchedulePlanChange(input: {
  customerUid: string;
  targetPlanId: string;
  period: BillingPeriod;
  confirm?: boolean;
  provider?: SubscriptionProvider;
}) {
  const current = await getSubscriptionByCustomer(input.customerUid);
  if (!current) {
    throw new SubscriptionLifecycleError("Subscription not found.", "SUBSCRIPTION_NOT_FOUND", 404);
  }
  if (["cancelled", "completed"].includes(current.status)) {
    throw new SubscriptionLifecycleError(
      "A new checkout is required for an ended subscription.",
      "NEW_CONSENT_REQUIRED",
      409,
    );
  }

  const targetPlanId = mapLegacyPlanId(input.targetPlanId);
  const currentPlanId = mapLegacyPlanId(current.plan_id);
  if (targetPlanId === currentPlanId) {
    throw new SubscriptionLifecycleError("You are already on this plan.", "SAME_PLAN", 400);
  }

  const prices = await query<{
    id: number;
    provider_plan_id: string;
    subtotal_paise: number;
    gst_paise: number;
    total_paise: number;
  }>(
    `SELECT id, provider_plan_id, subtotal_paise, gst_paise, total_paise
       FROM billing_plan_price_versions
      WHERE plan_id = ? AND billing_interval = ? AND provider_mode = ?
        AND retired_at IS NULL LIMIT 1`,
    [targetPlanId, input.period, current.provider_mode || "test"],
  );
  const price = prices[0];

  const catalog = getPlanById(targetPlanId);
  const catalogInr = input.period === "yearly" ? catalog.priceYearlyInr : catalog.priceMonthlyInr;
  const fallbackTotalPaise = catalogInr == null ? null : Math.round(Number(catalogInr) * 100);
  const totalPaise = price ? Number(price.total_paise) : fallbackTotalPaise;
  const subtotalPaise = price
    ? Number(price.subtotal_paise)
    : totalPaise == null
      ? null
      : Math.round(totalPaise / 1.18);
  const gstPaise =
    totalPaise != null && subtotalPaise != null ? Math.max(0, totalPaise - subtotalPaise) : 0;

  const checkoutPath = `/dashboard/billing/checkout?plan=${encodeURIComponent(targetPlanId)}&period=${encodeURIComponent(input.period)}`;
  const amount =
    totalPaise != null && subtotalPaise != null
      ? {
          subtotalPaise,
          gstPaise,
          totalPaise,
          currency: "INR",
          gstInclusive: true,
        }
      : null;

  // Legacy / admin / trial subscriptions without a Razorpay subscription must use checkout.
  // Also force checkout when stored provider IDs are not valid Razorpay IDs (stale/manual rows).
  const nativeReady =
    isRazorpaySubscriptionId(current.razorpay_subscription_id) &&
    Boolean(price?.provider_plan_id) &&
    isRazorpayPlanId(price?.provider_plan_id);

  if (!nativeReady) {
    if (catalogInr == null && targetPlanId === "enterprise") {
      throw new SubscriptionLifecycleError(
        "Enterprise plans require sales assistance.",
        "SALES_ASSISTED",
        400,
      );
    }
    if (!amount) {
      throw new SubscriptionLifecycleError(
        "Target plan price is unavailable. Configure plan prices in Master Admin.",
        "PRICE_UNAVAILABLE",
        400,
      );
    }
    if (input.confirm) {
      throw new SubscriptionLifecycleError(
        "Complete checkout to activate this plan.",
        "CHECKOUT_REQUIRED",
        409,
      );
    }
    return {
      policy: "checkout_required",
      effectiveAt: new Date().toISOString(),
      requiresCheckout: true as const,
      checkoutPath,
      amount,
    };
  }

  if (!price?.provider_plan_id || !isRazorpayPlanId(price.provider_plan_id)) {
    throw new SubscriptionLifecycleError(
      "Target plan is not published to Razorpay yet. Ask Master Admin to sync plan prices.",
      "PRICE_UNAVAILABLE",
      400,
    );
  }

  if (getPlanLevel(targetPlanId) < getPlanLevel(current.plan_id)) {
    throw new SubscriptionLifecycleError(
      `Downgrades are not supported. You are on ${mapLegacyPlanId(current.plan_id)}; choose a higher plan to upgrade.`,
      "DOWNGRADE_NOT_ALLOWED",
      400,
    );
  }
  const effectiveAt = new Date().toISOString();

  const preview = {
    policy: "immediate" as const,
    effectiveAt,
    requiresCheckout: false as const,
    checkoutPath: null as string | null,
    amount: {
      subtotalPaise: Number(price.subtotal_paise),
      gstPaise: Number(price.gst_paise),
      totalPaise: Number(price.total_paise),
      currency: "INR",
      gstInclusive: true,
    },
  };
  if (!input.confirm) return preview;

  const provider = input.provider || razorpaySubscriptionProvider();
  let response: ProviderSubscription;
  try {
    response = await provider.changePlan(
      current.razorpay_subscription_id!,
      price.provider_plan_id,
      "now",
    );
  } catch (error) {
    if (error instanceof SubscriptionLifecycleError && error.code === "CHECKOUT_REQUIRED") {
      if (!input.confirm && amount) {
        return {
          policy: "checkout_required",
          effectiveAt: new Date().toISOString(),
          requiresCheckout: true as const,
          checkoutPath,
          amount,
        };
      }
      throw new SubscriptionLifecycleError(
        "In-place upgrade is unavailable for this subscription. Continue to checkout.",
        "CHECKOUT_REQUIRED",
        409,
      );
    }
    throw error;
  }
  assertIdentity(current.razorpay_subscription_id!, response);
  if (!["active", "authenticated", "pending"].includes(response.status)) {
    throw new SubscriptionLifecycleError("Razorpay rejected the plan change.", "PROVIDER_CHANGE_REJECTED", 502);
  }
  await query(
    `INSERT INTO billing_scheduled_changes
      (change_uid, customer_uid, subscription_id, provider_subscription_id, change_type,
       from_plan_id, to_plan_id, to_price_version_id, effective_at, status, provider_response)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `bsc_${crypto.randomUUID().replace(/-/g, "")}`,
      input.customerUid,
      current.id,
      current.razorpay_subscription_id,
      "upgrade",
      current.plan_id,
      targetPlanId,
      price.id,
      effectiveAt,
      "applied",
      JSON.stringify(response),
    ],
  );
  const limits = await resolvePlanLimits(targetPlanId);
  await query(
    `UPDATE customer_subscriptions SET plan_id = ?, billing_period = ?, price_version_id = ?,
        provider_plan_id = ?, product_limit = ?, storage_limit_mb = ?, bandwidth_limit_mb = ?, updated_at = NOW()
      WHERE customer_uid = ?`,
    [
      targetPlanId,
      input.period,
      price.id,
      price.provider_plan_id,
      limits.products,
      limits.storageMb,
      limits.unlimitedBandwidth ? null : Math.round(Number(limits.bandwidthGb || 0) * 1024),
      input.customerUid,
    ],
  );
  await syncCustomerPlanMirror({ customerUid: input.customerUid, planId: targetPlanId, status: "active" });
  await audit({
    actorType: "customer",
    action: "subscription.upgraded",
    subscription: current,
    after: response,
    metadata: preview,
  });
  await deliverBillingLifecycleEvent({
    customerUid: input.customerUid,
    type: "change_applied",
    eventKey: `${current.razorpay_subscription_id}:${targetPlanId}:${effectiveAt}`,
    title: "Plan change applied",
    body: `Your ${targetPlanId} plan is now active.`,
  }).catch(() => undefined);
  return { ...preview, scheduled: false, providerStatus: response.status };
}
