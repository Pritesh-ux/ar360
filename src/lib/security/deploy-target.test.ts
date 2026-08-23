import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertProductionRuntimeTarget,
  assertStagingRuntimeTarget,
  getPublicDeployTargetLabel,
  isStagingRuntime,
} from "@/lib/security/deploy-target";

describe("deploy-target runtime validation", () => {
  it("3. missing deploy target is not staging", () => {
    assert.equal(isStagingRuntime({}), false);
    assert.equal(getPublicDeployTargetLabel({}), "other");
  });

  it("5. staging target recognized correctly", () => {
    assert.equal(isStagingRuntime({ AR360_DEPLOY_TARGET: "staging" }), true);
    assert.equal(getPublicDeployTargetLabel({ AR360_DEPLOY_TARGET: "staging" }), "staging");
  });

  it("4. invalid deploy target fails staging assertion", () => {
    assert.throws(() => assertStagingRuntimeTarget({ AR360_DEPLOY_TARGET: "production" }));
    assert.throws(() => assertStagingRuntimeTarget({}));
  });

  it("28. production assertion unchanged", () => {
    assert.doesNotThrow(() => assertProductionRuntimeTarget({ AR360_DEPLOY_TARGET: "production" }));
    assert.throws(() => assertProductionRuntimeTarget({ AR360_DEPLOY_TARGET: "staging" }));
  });
});
