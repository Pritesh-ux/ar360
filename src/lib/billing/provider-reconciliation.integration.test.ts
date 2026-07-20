import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { getPool, query } from "@/lib/db";
import {
  reconcileSubscription,
  type ReconciliationProvider,
} from "@/server/billing/provider-reconciliation.service";

const enabled = process.env.BILLING_DB_INTEGRATION === "1";

after(async () => {
  if (enabled) await (await getPool()).end();
});

describe("provider reconciliation DB integration", { skip: !enabled }, () => {
  it("repairs provider/local mismatch while preserving the paid plan", async () => {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const customerUid = `test_recon_${suffix}`;
    const providerId = `sub_test_${suffix}`;
    const provider: ReconciliationProvider = {
      async fetchSubscription(id) {
        return { id, status: "paused", current_end: Math.floor(Date.now() / 1000) + 3600 };
      },
      async listPayments() { return []; },
      async listRefunds() { return []; },
    };
    try {
      await query(
        `INSERT INTO customer_subscriptions
          (customer_uid, plan_id, status, billing_period, provider, provider_subscription_id,
           provider_mode, provider_status, product_limit, storage_limit_mb, bandwidth_limit_mb)
         VALUES (?, 'starter', 'active', 'monthly', 'razorpay', ?, 'test', 'active', 5, 512, 5120)`,
        [customerUid, providerId],
      );
      const rows = await query<any>(
        `SELECT id, customer_uid, plan_id, billing_period, status, provider_status,
                provider_subscription_id, current_period_end
           FROM customer_subscriptions WHERE customer_uid = ?`,
        [customerUid],
      );
      const result = await reconcileSubscription(rows[0], provider);
      assert.equal(result.repaired, 1);
      const repaired = await query<{ status: string; plan_id: string }>(
        "SELECT status, plan_id FROM customer_subscriptions WHERE customer_uid = ?",
        [customerUid],
      );
      assert.deepEqual(repaired[0], { status: "paused", plan_id: "starter" });
    } finally {
      await query("DELETE FROM billing_reconciliation_issues WHERE customer_uid = ?", [customerUid]);
      await query("DELETE FROM customer_subscriptions WHERE customer_uid = ?", [customerUid]);
    }
  });
});
