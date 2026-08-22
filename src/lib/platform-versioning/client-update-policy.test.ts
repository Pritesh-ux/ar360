import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  autoPolicyIsExecutable,
  deriveClientUpdateStatus,
  isValidUpdatePolicy,
  policyMutationsTouchProducts,
} from "@/lib/platform-versioning/client-update-policy.service";
import { compareSemver } from "@/lib/platform-versioning/semver";

describe("AR360 Phase 8 client update policy", () => {
  it("defaults and validates policy modes", () => {
    assert.equal(isValidUpdatePolicy("MANUAL"), true);
    assert.equal(isValidUpdatePolicy("APPROVAL_REQUIRED"), true);
    assert.equal(isValidUpdatePolicy("AUTO"), true);
    assert.equal(isValidUpdatePolicy("cron"), false);
  });

  it("AUTO is never executable in Phase 8", () => {
    assert.equal(autoPolicyIsExecutable(), false);
  });

  it("policy mutations do not touch products", () => {
    assert.equal(policyMutationsTouchProducts(), false);
  });

  it("derives PENDING_APPROVAL when approval required and missing", () => {
    assert.equal(
      deriveClientUpdateStatus({
        policy: "APPROVAL_REQUIRED",
        currentReleaseId: 1,
        targetReleaseId: 2,
        approvedAt: null,
        migrationInProgress: false,
        migrationPaused: false,
        blockedProducts: 0,
      }),
      "PENDING_APPROVAL",
    );
  });

  it("derives UPDATE_AVAILABLE when approved or MANUAL", () => {
    assert.equal(
      deriveClientUpdateStatus({
        policy: "MANUAL",
        currentReleaseId: 1,
        targetReleaseId: 2,
        approvedAt: null,
        migrationInProgress: false,
        migrationPaused: false,
        blockedProducts: 0,
      }),
      "UPDATE_AVAILABLE",
    );
    assert.equal(
      deriveClientUpdateStatus({
        policy: "APPROVAL_REQUIRED",
        currentReleaseId: 1,
        targetReleaseId: 2,
        approvedAt: "2026-01-01",
        migrationInProgress: false,
        migrationPaused: false,
        blockedProducts: 0,
      }),
      "UPDATE_AVAILABLE",
    );
  });

  it("compares semver for release transitions", () => {
    assert.equal(compareSemver("2.0.0", "1.0.0"), 1);
    assert.equal(compareSemver("1.0.0", "2.0.0"), -1);
    assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
    assert.equal(compareSemver("bad", "1.0.0"), null);
  });

  it("SQL and service forbid auto migration / cron / product mutation", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "database/migrations/84_ar360_client_update_policy.sql"),
      "utf8",
    );
    assert.match(migration, /ar360_client_update_policies/);
    assert.match(migration, /MANUAL/);
    assert.match(migration, /APPROVAL_REQUIRED/);
    assert.match(migration, /AUTO/);
    assert.doesNotMatch(migration, /CREATE EVENT|cron|BACKGROUND/i);

    const service = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/client-update-policy.service.ts"),
      "utf8",
    );
    assert.match(service, /AUTO — NOT ACTIVE IN PHASE 8/);
    assert.match(service, /DRAFT_RELEASE_REJECTED/);
    assert.match(service, /ARCHIVED_RELEASE_REJECTED/);
    assert.doesNotMatch(service, /SET active_.*_revision_id/);
    assert.doesNotMatch(service, /createMigrationPlan/);

    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/master-admin/ar360/client-updates/[customerUid]/route.ts"),
      "utf8",
    );
    assert.match(route, /ar360\.client_update_policy\.changed/);
    assert.match(route, /ar360\.client_release\.targeted/);
    assert.match(route, /ar360\.client_release\.approval_granted/);
  });
});
