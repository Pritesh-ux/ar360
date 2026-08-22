import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { billingInvoiceViewPath, isSubscriptionExemptPath } from "./subscription-paths";

describe("subscription-paths", () => {
  it("allows expired users onto billing and subscription routes only", () => {
    assert.equal(isSubscriptionExemptPath("/dashboard/subscription"), true);
    assert.equal(isSubscriptionExemptPath("/dashboard/subscription?expired=1"), true);
    assert.equal(isSubscriptionExemptPath("/dashboard/billing/checkout"), true);
    assert.equal(isSubscriptionExemptPath("/dashboard/settings"), false);
    assert.equal(isSubscriptionExemptPath("/dashboard/support"), false);
    assert.equal(isSubscriptionExemptPath("/dashboard/onboarding"), false);
    assert.equal(isSubscriptionExemptPath("/dashboard/products"), false);
    assert.equal(isSubscriptionExemptPath("/dashboard"), false);
  });

  it("builds invoice deep-links for email CTAs", () => {
    assert.equal(
      billingInvoiceViewPath("inv_123"),
      "/dashboard/billing?tab=invoices&invoice=inv_123",
    );
  });
});
