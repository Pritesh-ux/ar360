import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPaise, resolveCustomerSubscriptionState } from "./subscription-presentation";

describe("customer subscription presentation", () => {
  it("prioritizes manual enterprise and scheduled cancellation", () => {
    assert.equal(resolveCustomerSubscriptionState({ status: "active", manualEnterprise: true }), "manual_enterprise");
    assert.equal(resolveCustomerSubscriptionState({ status: "active", cancelAtPeriodEnd: true }), "cancellation_scheduled");
  });

  it("covers provider authorization and renewal recovery states", () => {
    assert.equal(resolveCustomerSubscriptionState({ status: "pending", mandateStatus: "pending" }), "authorization_pending");
    assert.equal(resolveCustomerSubscriptionState({ status: "active", mandateStatus: "failed" }), "authorization_failed");
    assert.equal(resolveCustomerSubscriptionState({ status: "active", mandateStatus: "pending" }), "active");
    assert.equal(resolveCustomerSubscriptionState({ status: "past_due" }), "renewal_retry");
    assert.equal(resolveCustomerSubscriptionState({ status: "halted" }), "halted");
  });

  it("covers paused, trial, active, and terminal states", () => {
    assert.equal(resolveCustomerSubscriptionState({ status: "paused" }), "paused");
    assert.equal(resolveCustomerSubscriptionState({ status: "trialing" }), "trial");
    assert.equal(resolveCustomerSubscriptionState({ status: "active", mandateStatus: "authorized" }), "active");
    assert.equal(resolveCustomerSubscriptionState({ status: "completed" }), "ended");
  });

  it("formats paise as GST-inclusive INR display values", () => {
    assert.match(formatPaise(117900), /1,179/);
  });
});
