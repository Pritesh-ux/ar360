import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMaterialRollbackKind,
  isEligibleMaterialRollbackStatus,
} from "@/lib/platform-versioning/material-rollback.service";

describe("AR360 Phase 6A material rollback guards", () => {
  it("rejects draft status for eligibility", () => {
    assert.equal(isEligibleMaterialRollbackStatus("draft"), false);
    assert.equal(isEligibleMaterialRollbackStatus("active"), true);
    assert.equal(isEligibleMaterialRollbackStatus("archived"), true);
  });

  it("allows only material or foundation config kinds", () => {
    assert.equal(assertMaterialRollbackKind("material"), true);
    assert.equal(assertMaterialRollbackKind("config"), true);
    assert.equal(assertMaterialRollbackKind("lighting"), false);
    assert.equal(assertMaterialRollbackKind("viewer"), false);
    assert.equal(assertMaterialRollbackKind("ar"), false);
    assert.equal(assertMaterialRollbackKind("geometry"), false);
  });
});
