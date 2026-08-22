import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerStatusFromSubscription } from "@/server/billing/subscription.repository";

describe("customerStatusFromSubscription soft-lock", () => {
  it("keeps expired and cancelled customers Active for upgrade", () => {
    assert.equal(customerStatusFromSubscription("expired"), "Active");
    assert.equal(customerStatusFromSubscription("cancelled"), "Active");
    assert.equal(customerStatusFromSubscription("canceled"), "Active");
    assert.equal(customerStatusFromSubscription("completed"), "Active");
  });

  it("keeps billing-active states Active", () => {
    assert.equal(customerStatusFromSubscription("active"), "Active");
    assert.equal(customerStatusFromSubscription("trialing"), "Active");
    assert.equal(customerStatusFromSubscription("trial"), "Active");
    assert.equal(customerStatusFromSubscription("grace"), "Active");
    assert.equal(customerStatusFromSubscription("past_due"), "Active");
  });

  it("reserves Suspended for pause/halt", () => {
    assert.equal(customerStatusFromSubscription("paused"), "Suspended");
    assert.equal(customerStatusFromSubscription("halted"), "Suspended");
  });
});
