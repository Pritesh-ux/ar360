import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  autoUpdateIsExecutable,
  platformUpdateCenterIsReadOnly,
} from "@/lib/platform-versioning/customer-platform-update.service";
import { compareSemver } from "@/lib/platform-versioning/semver";

describe("AR360 Phase 12 customer platform update center", () => {
  it("is read-only and AUTO is never executable", () => {
    assert.equal(platformUpdateCenterIsReadOnly(), true);
    assert.equal(autoUpdateIsExecutable(), false);
  });

  it("detects update available via semver without treating drafts as newer", () => {
    assert.equal(compareSemver("2.1.0", "2.0.0"), 1);
    assert.equal(compareSemver("2.0.0", "2.0.0"), 0);
    assert.equal(compareSemver("1.9.0", "2.0.0"), -1);
  });

  it("SQL only adds view-state table and does not touch products/billing/QR", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "database/migrations/88_ar360_customer_platform_update_center.sql"),
      "utf8",
    );
    assert.match(migration, /ar360_customer_platform_release_views/);
    assert.match(migration, /UNIQUE KEY uq_ar360_cust_release_view/);
    assert.doesNotMatch(migration, /UPDATE products|customer_subscriptions|product_qr/i);
    assert.doesNotMatch(migration, /FORCE UPDATE|MIGRATE ALL|AUTO ROLLOUT/i);
  });

  it("customer update service never executes migration or AUTO", () => {
    const service = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/customer-platform-update.service.ts"),
      "utf8",
    );
    assert.match(service, /UPDATE_AVAILABLE/);
    assert.match(service, /COMPATIBILITY_REVIEW/);
    assert.match(service, /PRODUCT REVIEW AVAILABLE|ROLLOUT_AVAILABLE/);
    assert.doesNotMatch(service, /executeMigrationBatch|executeCanary|createMigrationPlan\(/);
    assert.match(service, /autoPolicyIsExecutable/);
  });

  it("customer APIs are scoped and do not mutate products", () => {
    const status = readFileSync(
      resolve(process.cwd(), "src/app/api/account/platform-status/route.ts"),
      "utf8",
    );
    assert.match(status, /requireScopedApiUser/);
    assert.match(status, /ar360\.platform_release\.viewed/);
    assert.doesNotMatch(status, /executeMigrationBatch|createMigrationPlan/);

    const release = readFileSync(
      resolve(process.cwd(), "src/app/api/account/platform/releases/[id]/route.ts"),
      "utf8",
    );
    assert.match(release, /ar360\.product_update\.reviewed/);
    assert.match(release, /requireScopedApiUser/);
    assert.doesNotMatch(release, /executeMigrationBatch/);

    const admin = readFileSync(
      resolve(process.cwd(), "src/app/api/master-admin/ar360/platform-updates/route.ts"),
      "utf8",
    );
    assert.match(admin, /No FORCE UPDATE/);
    assert.match(admin, /No .*MIGRATE ALL/);
    assert.doesNotMatch(admin, /executeMigrationBatch/);
  });

  it("UI separates Platform Update from Product Update", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/app/dashboard/(gated)/platform/page.tsx"),
      "utf8",
    );
    assert.match(page, /Platform updates are separate from product/);
    assert.match(page, /Review Update/);
    assert.match(page, /Your Products/);
    assert.doesNotMatch(page, /Migrate All|Force Update/);
  });
});
