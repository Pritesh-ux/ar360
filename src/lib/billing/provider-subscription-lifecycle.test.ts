import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SubscriptionLifecycleError,
  validateLifecycleTransition,
  type SubscriptionProvider,
} from "@/server/billing/provider-subscription.service";

function mockProvider(): SubscriptionProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async fetch(id) { calls.push(`fetch:${id}`); return { id, status: "active" }; },
    async cancel(id, atCycleEnd) {
      calls.push(`cancel:${id}:${atCycleEnd}`);
      return { id, status: atCycleEnd ? "active" : "cancelled" };
    },
    async pause(id) { calls.push(`pause:${id}`); return { id, status: "paused" }; },
    async resume(id) { calls.push(`resume:${id}`); return { id, status: "active" }; },
    async changePlan(id, planId, effective) {
      calls.push(`change:${id}:${planId}:${effective}`);
      return { id, status: "active", plan_id: planId };
    },
  };
}

describe("provider subscription lifecycle policy", () => {
  it("distinguishes scheduled and effective cancellation", () => {
    assert.deepEqual(validateLifecycleTransition("active", "cancel", true), {
      scheduledCancellation: true,
      effectiveCancellation: false,
    });
    assert.deepEqual(validateLifecycleTransition("active", "cancel", false), {
      scheduledCancellation: false,
      effectiveCancellation: true,
    });
  });

  it("requires new consent after cancellation or completion", () => {
    for (const status of ["cancelled", "completed"]) {
      assert.throws(
        () => validateLifecycleTransition(status, "resume"),
        (error) => error instanceof SubscriptionLifecycleError && error.code === "NEW_CONSENT_REQUIRED",
      );
    }
  });

  it("only allows provider resume from paused", async () => {
    assert.throws(() => validateLifecycleTransition("active", "resume"), /Only paused/);
    const provider = mockProvider();
    const result = await provider.resume("sub_1");
    assert.equal(result.status, "active");
    assert.deepEqual(provider.calls, ["resume:sub_1"]);
  });
});
