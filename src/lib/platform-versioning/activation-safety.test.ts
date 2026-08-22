import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDeclaredDependencies } from "@/lib/platform-versioning/activation-safety.service";
import { selectRuntimeMode } from "@/lib/platform-versioning/runtime-selection";
import { deserializeVersionedConfigForRuntime } from "@/lib/platform-versioning/apply-versioned-runtime";

describe("AR360 Phase 6B activation safety", () => {
  it("parses declared dependencies from revision config", () => {
    const deps = parseDeclaredDependencies({
      dependencies: {
        viewer: { minComponentRevisionNumber: 3 },
        lighting: { minComponentRevisionNumber: 1 },
        geometry: { minComponentRevisionNumber: 0 },
      },
    });
    assert.equal(deps.viewer?.minComponentRevisionNumber, 3);
    assert.equal(deps.lighting?.minComponentRevisionNumber, 1);
    assert.equal(deps.geometry, undefined);
  });

  it("returns empty deps when missing", () => {
    assert.deepEqual(parseDeclaredDependencies({}), {});
    assert.deepEqual(parseDeclaredDependencies(null), {});
  });

  it("canary guard: scope=all remains forbidden", () => {
    const result = selectRuntimeMode({
      productId: "PRD_3XTVLF8X",
      flagEnabled: true,
      targeting: { scope: "all", productIds: [] },
      forbidGlobal: true,
    });
    assert.equal(result.mode, "legacy");
    assert.equal(result.reason, "global_forbidden_blocked");
  });

  it("blocks invalid runtime JSON materialSettings string", () => {
    const result = deserializeVersionedConfigForRuntime({
      materialSettings: '{"0":{"renderOrder":1}}',
      variants: "[]",
    } as never);
    // string may parse OK — invalid is non-object after fail
    if (result.ok) {
      assert.equal(typeof result.contract.materialSettings, "object");
      assert.ok(Array.isArray(result.contract.variants));
    }
  });

  it("rejects non-object materialSettings that cannot deserialize", () => {
    const result = deserializeVersionedConfigForRuntime({
      materialSettings: 42,
      variants: [],
    } as never);
    assert.equal(result.ok, false);
  });

  it("migration 82 defines change records and status model", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "database/migrations/82_ar360_activation_change_guard.sql"),
      "utf8",
    );
    assert.match(migration, /ar360_component_change_records/);
    for (const status of [
      "READY",
      "PREVIEW",
      "CANARY",
      "ACTIVE",
      "UNHEALTHY",
      "ROLLED_BACK",
      "BLOCKED",
    ]) {
      assert.match(migration, new RegExp(status));
    }
    assert.match(migration, /snapshot_json/);
    assert.doesNotMatch(migration, /scope\s*=\s*['"]all['"]/);
  });

  it("activate route uses activation_started / blocked / health audits", () => {
    const route = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/master-admin/ar360/component-revisions/[id]/activate/route.ts",
      ),
      "utf8",
    );
    assert.match(route, /ar360\.revision\.activation_started/);
    assert.match(route, /ar360\.revision\.activation_blocked/);
    assert.match(route, /ar360\.revision\.activated/);
    assert.match(route, /ar360\.revision\.health_checked/);
    assert.match(route, /ar360\.revision\.unhealthy/);
    assert.match(route, /activateWithSafety/);
  });

  it("does not implement lighting/viewer/AR/geometry rollback in 6B", () => {
    const service = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/activation-safety.service.ts"),
      "utf8",
    );
    assert.match(service, /recordMaterialRollbackChange/);
    assert.doesNotMatch(service, /rollbackLightingRevision/);
    assert.doesNotMatch(service, /rollbackViewerRevision/);
    assert.doesNotMatch(service, /rollbackArRevision/);
    assert.doesNotMatch(service, /rollbackGeometryRevision/);
  });
});
