import { assertSelfServicePlan } from "@/lib/billing/self-service-plans";
import { getPlanBySlug } from "@/lib/billing/plan-service";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";
import { assertRazorpayCheckoutReady } from "@/lib/billing/razorpay-config";
import { getRazorpayClient, uid } from "./razorpay";
import type { BillingPeriod, ProviderMode } from "./subscription.types";
import type { PriceVersion } from "./native-subscription.types";
import { query } from "@/lib/db";

export type PlanPublisherClient = {
  plans: {
    create(input: {
      period: BillingPeriod;
      interval: number;
      item: { name: string; amount: number; currency: "INR"; description: string };
      notes: Record<string, string | number>;
    }): Promise<{ id: string }>;
  };
};

export type PriceVersionStore = {
  findActive(planId: string, interval: BillingPeriod, mode: ProviderMode): Promise<PriceVersion | null>;
  nextVersion(planId: string, interval: BillingPeriod, mode: ProviderMode): Promise<number>;
  insert(input: Omit<PriceVersion, "id" | "retired_at">): Promise<PriceVersion>;
  retireExcept(planId: string, interval: BillingPeriod, mode: ProviderMode, keepId: number): Promise<void>;
};

const dbStore: PriceVersionStore = {
  async findActive(planId, interval, mode) {
    const rows = await query<PriceVersion>(
      `SELECT * FROM billing_plan_price_versions
       WHERE plan_id = ? AND billing_interval = ? AND provider_mode = ? AND retired_at IS NULL
       ORDER BY version DESC LIMIT 1`,
      [planId, interval, mode],
    );
    return rows[0] || null;
  },
  async nextVersion(planId, interval, mode) {
    const rows = await query<{ next_version: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM billing_plan_price_versions WHERE plan_id = ? AND billing_interval = ? AND provider_mode = ?`,
      [planId, interval, mode],
    );
    return Number(rows[0]?.next_version || 1);
  },
  async insert(input) {
    await query(
      `INSERT INTO billing_plan_price_versions
       (price_version_uid, plan_id, billing_interval, provider_mode, version, currency,
        subtotal_paise, gst_rate, gst_paise, total_paise, gst_inclusive, provider, provider_plan_id,
        publish_status, last_synced_at)
       VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, 1, 'razorpay', ?, 'published', NOW())`,
      [
        input.price_version_uid, input.plan_id, input.billing_interval, input.provider_mode,
        input.version, input.subtotal_paise, input.gst_rate, input.gst_paise,
        input.total_paise, input.provider_plan_id,
      ],
    );
    const row = await this.findActive(input.plan_id, input.billing_interval, input.provider_mode);
    if (!row) throw new Error("Published price version could not be loaded.");
    return row;
  },
  async retireExcept(planId, interval, mode, keepId) {
    await query(
      `UPDATE billing_plan_price_versions SET retired_at = NOW()
       WHERE plan_id = ? AND billing_interval = ? AND provider_mode = ?
         AND id <> ? AND retired_at IS NULL`,
      [planId, interval, mode, keepId],
    );
  },
};

export function splitGstInclusive(totalPaise: number, gstRate = 18) {
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) throw new Error("Plan amount must be positive paise.");
  const subtotalPaise = Math.round(totalPaise / (1 + gstRate / 100));
  return { subtotalPaise, gstPaise: totalPaise - subtotalPaise, totalPaise, gstRate };
}

export async function publishRazorpayPlanVersion(input: {
  planId: string;
  period: BillingPeriod;
  mode: ProviderMode;
  totalPaise: number;
  planName: string;
  client: PlanPublisherClient;
  store?: PriceVersionStore;
}) {
  const planId = mapLegacyPlanId(input.planId);
  if (planId === "enterprise") throw new Error("Enterprise is manual and cannot be published to Razorpay.");
  await assertSelfServicePlan(planId);

  const store = input.store || dbStore;
  const amounts = splitGstInclusive(input.totalPaise);
  const active = await store.findActive(planId, input.period, input.mode);
  if (active?.provider_plan_id && Number(active.total_paise) === input.totalPaise) return active;

  const version = await store.nextVersion(planId, input.period, input.mode);
  const priceVersionUid = uid("bpv");
  const providerPlan = await input.client.plans.create({
    period: input.period,
    interval: 1,
    item: {
      name: `${input.planName} (${input.period}) v${version}`,
      amount: input.totalPaise,
      currency: "INR",
      description: `GST-inclusive AR360 ${input.period} subscription`,
    },
    notes: { price_version_uid: priceVersionUid, plan_id: planId, provider_mode: input.mode },
  });

  const created = await store.insert({
    price_version_uid: priceVersionUid,
    plan_id: planId,
    billing_interval: input.period,
    provider_mode: input.mode,
    version,
    currency: "INR",
    subtotal_paise: amounts.subtotalPaise,
    gst_rate: amounts.gstRate,
    gst_paise: amounts.gstPaise,
    total_paise: amounts.totalPaise,
    gst_inclusive: 1,
    provider_plan_id: providerPlan.id,
  });
  await store.retireExcept(planId, input.period, input.mode, created.id);
  return created;
}

export async function ensurePublishedRazorpayPlan(planId: string, period: BillingPeriod) {
  const canonical = mapLegacyPlanId(planId);
  const plan = await getPlanBySlug(canonical);
  if (!plan || plan.salesChannel === "manual" || canonical === "enterprise") {
    throw new Error("Plan is not available for self-service subscription checkout.");
  }
  const inr = period === "yearly" ? plan.priceYearlyInr : plan.priceMonthlyInr;
  if (inr == null || inr <= 0) throw new Error("Invalid paid plan.");
  const config = await assertRazorpayCheckoutReady();
  if (config.mode !== "test" && config.mode !== "live") throw new Error("Razorpay key mode is invalid.");
  const client = await getRazorpayClient();
  return publishRazorpayPlanVersion({
    planId: canonical,
    period,
    mode: config.mode,
    totalPaise: Math.round(inr * 100),
    planName: plan.name,
    client,
  });
}

/** Publish both immutable cadences after an admin price change when native checkout is enabled. */
export async function syncConfiguredRazorpayPlanPrices(plan: {
  id: string;
  salesChannel?: string;
  priceMonthlyInr?: number | null;
  priceYearlyInr?: number | null;
}) {
  if (plan.id === "enterprise" || plan.salesChannel === "manual") return [];
  const published: PriceVersion[] = [];
  if (Number(plan.priceMonthlyInr) > 0) published.push(await ensurePublishedRazorpayPlan(plan.id, "monthly"));
  if (Number(plan.priceYearlyInr) > 0) published.push(await ensurePublishedRazorpayPlan(plan.id, "yearly"));
  return published;
}
