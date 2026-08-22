import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectRuntimeMode } from "@/lib/platform-versioning/runtime-selection";

describe("AR360 Phase 4 runtime selection", () => {
  it("defaults to LEGACY when flag disabled", () => {
    const result = selectRuntimeMode({
      productId: "PRD_A",
      flagEnabled: false,
      targeting: { scope: "selected_products", productIds: ["PRD_A"] },
    });
    assert.equal(result.mode, "legacy");
    assert.equal(result.reason, "flag_disabled");
  });

  it("pointer-like targeting alone is insufficient when product not listed", () => {
    const result = selectRuntimeMode({
      productId: "PRD_OTHER",
      flagEnabled: true,
      targeting: { scope: "selected_products", productIds: ["PRD_CANARY"] },
    });
    assert.equal(result.mode, "legacy");
    assert.equal(result.reason, "product_not_in_canary");
  });

  it("enables VERSIONED only for canary product id", () => {
    const result = selectRuntimeMode({
      productId: "PRD_CANARY",
      flagEnabled: true,
      targeting: { scope: "selected_products", productIds: ["PRD_CANARY"] },
    });
    assert.equal(result.mode, "versioned");
    assert.equal(result.reason, "canary_selected");
  });

  it("blocks global scope=all in Phase 4", () => {
    const result = selectRuntimeMode({
      productId: "PRD_ANY",
      flagEnabled: true,
      targeting: { scope: "all", productIds: [] },
      forbidGlobal: true,
    });
    assert.equal(result.mode, "legacy");
    assert.equal(result.reason, "global_forbidden_blocked");
  });

  it("other products remain LEGACY when one canary is selected", () => {
    const canary = selectRuntimeMode({
      productId: "PRD_3LRQT9GF",
      flagEnabled: true,
      targeting: { scope: "selected_products", productIds: ["PRD_3LRQT9GF"] },
    });
    const other = selectRuntimeMode({
      productId: "PRD_3XTVLF8X",
      flagEnabled: true,
      targeting: { scope: "selected_products", productIds: ["PRD_3LRQT9GF"] },
    });
    assert.equal(canary.mode, "versioned");
    assert.equal(other.mode, "legacy");
  });
});

describe("AR360 Phase 4 migration 80", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "database/migrations/80_ar360_versioned_runtime_canary.sql"),
    "utf8",
  );

  it("seeds versioned_runtime flag OFF with selected_products scope", () => {
    assert.match(migration, /versioned_runtime/);
    assert.match(migration, /selected_products/);
    assert.match(migration, /globalForbidden/);
    assert.doesNotMatch(migration, /UPDATE\s+products/i);
    assert.doesNotMatch(migration, /product_qr_codes/);
    assert.doesNotMatch(migration, /assertCan|plan-enforcement/i);
  });
});

describe("AR360 Phase 4 public wiring is canary-gated", () => {
  it("public-products imports applyControlledRuntimeToProduct", () => {
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/public-products/[id]/route.ts"),
      "utf8",
    );
    assert.match(route, /applyControlledRuntimeToProduct/);
    assert.match(route, /Phase 4/);
  });
});
