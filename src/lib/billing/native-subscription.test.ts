import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  publishRazorpayPlanVersion,
  splitGstInclusive,
  type PlanPublisherClient,
  type PriceVersionStore,
} from "@/server/billing/razorpay-plan.service";
import { isEligibleLegacyRenewal, isNativeSubscriptionEligible } from "@/server/billing/checkout-rollout";
import { assertProviderCheckoutOwnership, mandateState } from "@/server/billing/subscription-callback.service";
import type { PriceVersion } from "@/server/billing/native-subscription.types";

after(async () => {
  const { getPool } = await import("@/lib/db");
  await (await getPool()).end();
});

function memoryStore(): PriceVersionStore & { rows: PriceVersion[] } {
  const rows: PriceVersion[] = [];
  return {
    rows,
    async findActive(planId, interval, mode) {
      return [...rows].reverse().find((row) =>
        row.plan_id === planId && row.billing_interval === interval &&
        row.provider_mode === mode && row.retired_at === null) || null;
    },
    async nextVersion(planId, interval, mode) {
      return rows.filter((row) =>
        row.plan_id === planId && row.billing_interval === interval && row.provider_mode === mode).length + 1;
    },
    async insert(input) {
      const row = { ...input, id: rows.length + 1, retired_at: null };
      rows.push(row);
      return row;
    },
    async retireExcept(planId, interval, mode, keepId) {
      for (const row of rows) {
        if (row.plan_id === planId && row.billing_interval === interval && row.provider_mode === mode && row.id !== keepId) {
          row.retired_at = new Date().toISOString();
        }
      }
    },
  };
}

describe("native Razorpay Plan publishing", () => {
  it("reuses identical prices and versions changed GST-inclusive prices", async () => {
    const store = memoryStore();
    const calls: unknown[] = [];
    const client: PlanPublisherClient = {
      plans: {
        async create(input) {
          calls.push(input);
          return { id: `plan_${calls.length}` };
        },
      },
    };
    const base = { planId: "starter", period: "monthly" as const, mode: "test" as const, planName: "Starter", client, store };
    const first = await publishRazorpayPlanVersion({ ...base, totalPaise: 24900 });
    const reused = await publishRazorpayPlanVersion({ ...base, totalPaise: 24900 });
    const changed = await publishRazorpayPlanVersion({ ...base, totalPaise: 29900 });

    assert.equal(reused.id, first.id);
    assert.equal(changed.version, 2);
    assert.equal(calls.length, 2);
    assert.ok(store.rows[0].retired_at);
    assert.deepEqual(splitGstInclusive(24900), {
      subtotalPaise: 21102, gstPaise: 3798, totalPaise: 24900, gstRate: 18,
    });
  });

  it("never publishes Enterprise", async () => {
    const store = memoryStore();
    const client: PlanPublisherClient = { plans: { async create() { throw new Error("must not call"); } } };
    await assert.rejects(
      publishRazorpayPlanVersion({
        planId: "enterprise", period: "yearly", mode: "live", totalPaise: 100,
        planName: "Enterprise", client, store,
      }),
      /manual/,
    );
  });
});

describe("subscription rollout and callback checks", () => {
  it("uses deterministic server rollout and tightly gates legacy orders", () => {
    const settings = {
      nativeSubscriptionCheckoutEnabled: true,
      nativeSubscriptionRolloutPercent: 100,
      legacyOneTimeRenewalsEnabled: true,
    };
    assert.equal(isNativeSubscriptionEligible("cus_1", settings), true);
    assert.equal(isNativeSubscriptionEligible("cus_1", { ...settings, nativeSubscriptionRolloutPercent: 0 }), false);
    assert.equal(isEligibleLegacyRenewal({
      enabled: true, requestedPlanId: "starter", currentPlanId: "starter", salesChannel: "legacy",
    }), true);
    assert.equal(isEligibleLegacyRenewal({
      enabled: true, requestedPlanId: "pro", currentPlanId: "starter", salesChannel: "legacy",
    }), false);
  });

  it("checks provider ownership, Plan and exact GST-inclusive amount", () => {
    const row = {
      checkout_session_uid: "bcs_1", customer_uid: "cus_1", plan_id: "starter",
      provider_subscription_id: "sub_1", provider_plan_id: "plan_1",
      price_version_uid: "bpv_1", total_paise: 24900, currency: "INR",
    };
    const subscription = {
      id: "sub_1", plan_id: "plan_1", status: "authenticated",
      notes: { customer_uid: "cus_1", checkout_session_uid: "bcs_1", price_version_uid: "bpv_1" },
    };
    const payment = { amount: 24900, currency: "INR", subscription_id: "sub_1" };
    assert.doesNotThrow(() => assertProviderCheckoutOwnership({ row, subscription, payment }));
    assert.throws(() => assertProviderCheckoutOwnership({
      row, subscription, payment: { ...payment, amount: 24899 },
    }), /amount/);
    assert.equal(mandateState("authenticated"), "authorized");
    assert.equal(mandateState("pending"), "pending");
    assert.equal(mandateState("halted"), "failed");
  });
});
