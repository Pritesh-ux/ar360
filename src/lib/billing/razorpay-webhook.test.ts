import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  RAZORPAY_BILLING_EVENTS,
  parseRazorpayBillingEvent,
  shouldApplyProviderEvent,
} from "@/server/billing/razorpay-webhook.types";
import { matchRazorpayWebhookSignature } from "@/server/billing/razorpay";

function fixture(type: (typeof RAZORPAY_BILLING_EVENTS)[number], createdAt = 1_720_000_000) {
  const payload: Record<string, unknown> = {
    event: type,
    created_at: createdAt,
    payload: {},
  };
  const entities = payload.payload as Record<string, unknown>;
  if (type.startsWith("subscription.")) {
    entities.subscription = {
      entity: {
        id: "sub_fixture_1",
        entity: "subscription",
        plan_id: "plan_fixture_1",
        customer_id: "cust_fixture_1",
        status: type.split(".")[1],
        current_start: createdAt,
        current_end: createdAt + 2_592_000,
        created_at: createdAt,
      },
    };
    if (type === "subscription.charged") {
      entities.payment = {
        entity: {
          id: "pay_fixture_1",
          entity: "payment",
          subscription_id: "sub_fixture_1",
          amount: 24900,
          currency: "INR",
          status: "captured",
          created_at: createdAt,
        },
      };
    }
  } else if (type.startsWith("payment.")) {
    entities.payment = {
      entity: {
        id: "pay_fixture_1",
        entity: "payment",
        subscription_id: "sub_fixture_1",
        amount: 24900,
        currency: "INR",
        status: type.split(".")[1],
        created_at: createdAt,
      },
    };
  } else {
    entities.refund = {
      entity: {
        id: "rfnd_fixture_1",
        entity: "refund",
        payment_id: "pay_fixture_1",
        amount: 24900,
        currency: "INR",
        status: type.split(".")[1],
        created_at: createdAt,
      },
    };
  }
  return payload;
}

describe("Razorpay webhook event parsing", () => {
  for (const type of RAZORPAY_BILLING_EVENTS) {
    it(`parses Razorpay-shaped ${type}`, () => {
      const parsed = parseRazorpayBillingEvent(fixture(type));
      assert.equal(parsed?.type, type);
      assert.equal(parsed?.occurredAt, 1_720_000_000);
      if (type.startsWith("subscription.")) assert.equal(parsed?.providerSubscriptionId, "sub_fixture_1");
      if (type.startsWith("refund.")) assert.equal(parsed?.providerRefundId, "rfnd_fixture_1");
    });
  }

  it("ignores unrelated events without interpreting notes as ownership", () => {
    assert.equal(parseRazorpayBillingEvent({
      event: "order.paid",
      created_at: 1_720_000_000,
      payload: { order: { entity: { notes: { customer_uid: "untrusted" } } } },
    }), null);
  });

  it("rejects stale events but permits exact duplicate timestamps for idempotent upserts", () => {
    assert.equal(shouldApplyProviderEvent(200, 199), false);
    assert.equal(shouldApplyProviderEvent(200, 200), true);
    assert.equal(shouldApplyProviderEvent(200, 201), true);
  });
});

describe("Razorpay webhook signature isolation", () => {
  it("verifies with webhook secret (not API key secret)", () => {
    const body = JSON.stringify(fixture("payment.captured"));
    const valid = createHmac("sha256", "dedicated-secret").update(body).digest("hex");
    const apiSecretSignature = createHmac("sha256", "api-secret").update(body).digest("hex");
    assert.equal(matchRazorpayWebhookSignature(body, valid, "dedicated-secret"), true);
    assert.equal(matchRazorpayWebhookSignature(body, apiSecretSignature, "dedicated-secret"), false);
  });
});

export { fixture as razorpayWebhookFixture };
