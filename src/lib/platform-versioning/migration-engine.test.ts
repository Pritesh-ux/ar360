import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertSelectedProductsOnly,
  isGeometryBlocked,
  rollbackAvailabilityForProduct,
} from "@/lib/platform-versioning/migration-engine.service";

describe("AR360 Phase 7 migration engine guards", () => {
  it("blocks geometry migration", () => {
    assert.equal(isGeometryBlocked("geometry"), true);
    assert.equal(isGeometryBlocked("viewer"), false);
    assert.equal(isGeometryBlocked("material"), false);
  });

  it("allows only selected_products rollout mode", () => {
    assert.equal(assertSelectedProductsOnly("selected_products"), true);
    assert.equal(assertSelectedProductsOnly("all"), false);
  });

  it("exposes rollback availability without geometry", () => {
    const avail = rollbackAvailabilityForProduct({ viewer: 1, material: 2 });
    assert.equal(avail.viewer, true);
    assert.equal(avail.material, true);
    assert.equal(avail.geometry, false);
    assert.equal(avail.ar, false);
  });

  it("migration SQL and APIs forbid scope=all and geometry apply", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "database/migrations/83_ar360_product_migration_engine.sql"),
      "utf8",
    );
    assert.match(migration, /ar360_migration_plans/);
    assert.match(migration, /ar360_migration_plan_products/);
    assert.match(migration, /selected_products/);
    assert.doesNotMatch(migration, /scope\s*=\s*['"]all['"]/);

    const service = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/migration-engine.service.ts"),
      "utf8",
    );
    assert.match(service, /GEOMETRY_NOT_SUPPORTED/);
    assert.match(service, /CANARY_SCOPE_ALL_FORBIDDEN/);
    assert.match(service, /MIGRATION PREVIEW/);
    assert.doesNotMatch(service, /SET active_geometry_revision_id/);

    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/master-admin/ar360/migrations/[id]/route.ts"),
      "utf8",
    );
    assert.match(route, /ar360\.migration\./);
  });

  it("does not regress component rollback routes", () => {
    for (const name of ["material", "lighting", "viewer", "ar"] as const) {
      const path = resolve(
        process.cwd(),
        `src/app/api/master-admin/ar360/${name}-rollback/route.ts`,
      );
      assert.match(readFileSync(path, "utf8"), /list|Rollback/i);
    }
  });
});
