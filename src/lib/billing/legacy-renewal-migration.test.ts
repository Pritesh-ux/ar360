import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  classifyHistoricalEnterprise,
  renewalBoundaryState,
  shouldSendRenewalInvite,
  validateRepeatedConsent,
} from "@/server/billing/legacy-renewal-migration.service";
import { buildProviderSubscriptionInput } from "@/server/billing/native-checkout.service";

describe("existing-customer renewal migration", () => {
  const end = new Date("2026-08-01T00:00:00.000Z");

  it("preserves legacy entitlement before the exact boundary", () => {
    const before = renewalBoundaryState({
      now: new Date(end.getTime() - 1),
      currentPeriodEnd: end,
      providerStatus: "authenticated",
    });
    assert.equal(before.preserveLegacyEntitlement, true);
    assert.equal(before.activateNativeEntitlement, false);

    const atBoundary = renewalBoundaryState({
      now: end,
      currentPeriodEnd: end,
      providerStatus: "active",
    });
    assert.equal(atBoundary.preserveLegacyEntitlement, false);
    assert.equal(atBoundary.activateNativeEntitlement, true);
  });

  it("schedules Razorpay at the preserved period end", () => {
    const request = buildProviderSubscriptionInput({
      price: {
        id: 1,
        price_version_uid: "bpv_1",
        plan_id: "starter",
        billing_interval: "monthly",
        provider_mode: "test",
        version: 1,
        currency: "INR",
        subtotal_paise: 21102,
        gst_rate: 18,
        gst_paise: 3798,
        total_paise: 24900,
        gst_inclusive: 1,
        provider_plan_id: "plan_1",
        retired_at: null,
      },
      period: "monthly",
      customerUid: "cus_1",
      sessionUid: "bcs_1",
      expiresAt: new Date("2026-07-18T00:00:00Z"),
      startAt: end,
      purpose: "legacy_renewal",
    });
    assert.equal(request.start_at, Math.floor(end.getTime() / 1000));
    assert.equal(request.notes.legacy_term_end, end.toISOString());
    assert.equal(request.notes.purpose, "legacy_renewal");
  });

  it("expires a missed mandate without activating or extending access", () => {
    const missed = renewalBoundaryState({
      now: end,
      currentPeriodEnd: end,
      providerStatus: "pending",
    });
    assert.deepEqual(missed, {
      preserveLegacyEntitlement: false,
      activateNativeEntitlement: false,
      expireLegacyEntitlement: true,
    });
  });

  it("uses deterministic invitation boundaries", () => {
    assert.equal(shouldSendRenewalInvite(new Date("2026-07-25T00:00:00Z"), end), true);
    assert.equal(shouldSendRenewalInvite(new Date("2026-07-26T00:00:00Z"), end), false);
    assert.equal(shouldSendRenewalInvite(new Date(end.getTime() + 1), end), false);
  });

  it("reuses the same consent and rejects a second competing consent", () => {
    assert.deepEqual(validateRepeatedConsent({
      existingIdempotencyKey: "renewal:customer:boundary",
      requestedIdempotencyKey: "renewal:customer:boundary",
    }), { reused: true });
    assert.throws(() => validateRepeatedConsent({
      existingIdempotencyKey: "renewal:customer:boundary",
      requestedIdempotencyKey: "renewal:customer:other",
    }), /already in progress/);
  });

  it("requires enterprise contract evidence and queues ambiguity", () => {
    assert.deepEqual(classifyHistoricalEnterprise({ contractUid: "ect_1" }), {
      status: "contract_confirmed",
      reviewRequired: false,
    });
    assert.deepEqual(classifyHistoricalEnterprise({ approvedQuoteId: "quote_only" }), {
      status: "ambiguous_legacy",
      reviewRequired: true,
    });
  });

  it("keeps the legacy ledger and migrates additively", async () => {
    const sql = await readFile(
      new URL("../../../database/migrations/44_existing_customer_renewal_migration.sql", import.meta.url),
      "utf8",
    );
    const service = await readFile(
      new URL("../../../src/server/billing/legacy-renewal-migration.service.ts", import.meta.url),
      "utf8",
    );
    assert.match(service, /legacy_until_renewal/);
    assert.match(sql, /start_at DATETIME NULL/);
    assert.match(sql, /auto_convert_to_business', FALSE/);
    assert.doesNotMatch(sql, /UPDATE\s+billing_orders/i);
    assert.doesNotMatch(sql, /DELETE\s+FROM\s+billing_orders/i);
  });
});
