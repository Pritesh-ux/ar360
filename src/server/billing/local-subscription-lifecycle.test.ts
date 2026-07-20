import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateLifecycleTransition } from "@/server/billing/provider-subscription.service";

describe("local enterprise pause gating", () => {
  it("allows pause from active and resume from paused", () => {
    assert.doesNotThrow(() => validateLifecycleTransition("active", "pause"));
    assert.doesNotThrow(() => validateLifecycleTransition("paused", "resume"));
    assert.throws(() => validateLifecycleTransition("paused", "pause"), /Only active/);
    assert.throws(() => validateLifecycleTransition("active", "resume"), /Only paused/);
  });
});
