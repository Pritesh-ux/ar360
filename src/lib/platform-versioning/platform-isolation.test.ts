import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizeStructuredReleaseNotes,
  releaseNotesClaimProductMigration,
} from "@/lib/platform-versioning/release-notes";
import {
  platformReleaseMutatesProducts,
  platformReleaseMutatesSubscriptions,
  productComponentVersionsMustMatch,
} from "@/lib/platform-versioning/platform-isolation.service";

describe("AR360 Phase 11 platform isolation", () => {
  it("keeps platform / product / subscription isolated", () => {
    assert.equal(platformReleaseMutatesProducts(), false);
    assert.equal(platformReleaseMutatesSubscriptions(), false);
    assert.equal(productComponentVersionsMustMatch(), false);
  });

  it("normalizes structured release notes without claiming migration", () => {
    const notes = normalizeStructuredReleaseNotes({
      title: "AR360 2.1.0",
      plainReleaseNotes: "SaaS platform improvements",
      releaseNotesJson: {
        summary: "Platform-only release",
        newFeatures: ["Stable governance UI"],
        improvements: ["Compatibility diagnostics"],
        bugFixes: [],
        compatibilityNotes: ["Products unchanged until controlled migration"],
        breakingChanges: [],
        customerImpact: "No automatic product changes",
      },
    });
    assert.equal(notes.title, "AR360 2.1.0");
    assert.equal(notes.newFeatures.length, 1);
    assert.equal(releaseNotesClaimProductMigration(notes), false);
  });

  it("flags unsafe release notes that claim mass product migration", () => {
    const bad = normalizeStructuredReleaseNotes({
      title: "x",
      releaseNotesJson: {
        summary: "All products were migrated to the new engine",
      },
    });
    assert.equal(releaseNotesClaimProductMigration(bad), true);
  });

  it("SQL and services forbid mutation / second migrator / auto update", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "database/migrations/87_ar360_platform_isolation.sql"),
      "utf8",
    );
    assert.match(migration, /release_notes_json/);
    assert.doesNotMatch(migration, /UPDATE products|customer_subscriptions|product_qr/i);

    const service = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/platform-isolation.service.ts"),
      "utf8",
    );
    assert.match(service, /COMPATIBLE/);
    assert.match(service, /Diagnostic only/);
    assert.doesNotMatch(service, /createMigrationPlan|executeMigrationBatch/);
    assert.doesNotMatch(service, /SET active_.*_revision_id/);

    const adminRoute = readFileSync(
      resolve(process.cwd(), "src/app/api/master-admin/ar360/platform-compatibility/route.ts"),
      "utf8",
    );
    assert.match(adminRoute, /ar360\.platform_compatibility\.checked/);

    const customerRoute = readFileSync(
      resolve(process.cwd(), "src/app/api/account/platform-status/route.ts"),
      "utf8",
    );
    assert.match(customerRoute, /ar360\.platform_release\.viewed/);
    assert.doesNotMatch(customerRoute, /Update Products/);
    assert.doesNotMatch(customerRoute, /createMigrationPlan|executeMigrationBatch/);
    assert.match(customerRoute, /migratesProducts:\s*false/);
  });
});
