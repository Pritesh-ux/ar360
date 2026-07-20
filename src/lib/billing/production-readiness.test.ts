import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateLiveBillingReadiness } from "./production-readiness";

const ready = {
  mode: "live" as const,
  nativeCheckoutEnabled: true,
  rolloutPercent: 100,
  allowlist: "",
  killSwitch: false,
  keyId: "rzp_live_example",
  hasKeySecret: true,
  hasWebhookSecret: true,
  hasEncryptionKey: true,
  requiredMappings: ["starter:monthly", "starter:yearly"],
  liveMappings: ["starter:monthly", "starter:yearly"],
};

describe("production billing readiness", () => {
  it("does not require provider setup while live rollout is disabled", () => {
    const result = evaluateLiveBillingReadiness({
      ...ready,
      nativeCheckoutEnabled: false,
      keyId: "",
      hasKeySecret: false,
      hasWebhookSecret: false,
      hasEncryptionKey: false,
      liveMappings: [],
    });
    assert.equal(result.required, false);
    assert.equal(result.ok, true);
  });

  it("accepts a complete live rollout configuration", () => {
    const result = evaluateLiveBillingReadiness(ready);
    assert.equal(result.required, true);
    assert.equal(result.ok, true);
  });

  it("rejects live rollout without mappings, webhook secret, or encryption key", () => {
    const result = evaluateLiveBillingReadiness({
      ...ready,
      hasWebhookSecret: false,
      hasEncryptionKey: false,
      liveMappings: ["starter:monthly"],
    });
    assert.equal(result.ok, false);
    assert.equal(result.checks.webhookSecret.ok, false);
    assert.equal(result.checks.encryptionKey.ok, false);
    assert.equal(result.checks.livePlanMappings.ok, false);
    assert.match(result.checks.livePlanMappings.detail, /starter:yearly/);
  });

  it("rejects test credentials for live rollout", () => {
    const result = evaluateLiveBillingReadiness({ ...ready, keyId: "rzp_test_example" });
    assert.equal(result.ok, false);
    assert.equal(result.checks.liveKey.ok, false);
  });
});
