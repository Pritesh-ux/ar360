import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertRolloutExecutionAllowed,
  assertRolloutScopeSelectedOnly,
  autoRolloutIsExecutable,
  customerRolloutUsesMigrationEngineOnly,
  displayProductStatus,
  mapPlanStatusToRollout,
} from "@/lib/platform-versioning/customer-rollout.service";
import { autoPolicyIsExecutable } from "@/lib/platform-versioning/client-update-policy.service";

describe("AR360 Phase 9 customer rollout", () => {
  it("reuses migration engine only", () => {
    assert.equal(customerRolloutUsesMigrationEngineOnly(), true);
  });

  it("forbids scope=all / multi-client", () => {
    assert.equal(assertRolloutScopeSelectedOnly("one_client_selected_products"), true);
    assert.equal(assertRolloutScopeSelectedOnly("all"), false);
    assert.equal(assertRolloutScopeSelectedOnly("all_customers"), false);
  });

  it("AUTO remains non-executable", () => {
    assert.equal(autoRolloutIsExecutable(), false);
    assert.equal(autoPolicyIsExecutable(), false);
    const gate = assertRolloutExecutionAllowed({ policy: "AUTO", approvedAt: null });
    assert.equal(gate.ok, false);
    if (gate.ok === false) assert.equal(gate.code, "AUTO_NOT_EXECUTABLE");
  });

  it("APPROVAL_REQUIRED blocks without approval", () => {
    const denied = assertRolloutExecutionAllowed({
      policy: "APPROVAL_REQUIRED",
      approvedAt: null,
    });
    assert.equal(denied.ok, false);
    const ok = assertRolloutExecutionAllowed({
      policy: "APPROVAL_REQUIRED",
      approvedAt: "2026-01-01",
    });
    assert.equal(ok.ok, true);
  });

  it("MANUAL allows explicit start", () => {
    assert.equal(assertRolloutExecutionAllowed({ policy: "MANUAL", approvedAt: null }).ok, true);
  });

  it("maps plan statuses to rollout statuses", () => {
    assert.equal(mapPlanStatusToRollout("DRAFT"), "READY");
    assert.equal(mapPlanStatusToRollout("PREVIEW"), "PREVIEW");
    assert.equal(mapPlanStatusToRollout("CANARY"), "CANARY");
    assert.equal(mapPlanStatusToRollout("COMPLETED"), "COMPLETED");
  });

  it("display status can surface CANARY for pending wave products", () => {
    assert.equal(
      displayProductStatus({
        planStatus: "CANARY",
        productStatus: "PENDING",
        inCanaryWave: true,
      }),
      "CANARY",
    );
    assert.equal(
      displayProductStatus({
        planStatus: "BATCHING",
        productStatus: "PASS",
        inCanaryWave: false,
      }),
      "PASS",
    );
  });

  it("SQL and service forbid auto/cron/global/geometry and wrap Phase 7", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "database/migrations/85_ar360_customer_rollout.sql"),
      "utf8",
    );
    assert.match(migration, /ar360_customer_rollouts/);
    assert.doesNotMatch(migration, /CREATE EVENT|cron|BACKGROUND/i);

    const service = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/customer-rollout.service.ts"),
      "utf8",
    );
    assert.match(service, /createMigrationPlan/);
    assert.match(service, /executeMigrationBatch/);
    assert.match(service, /previewMigrationPlan/);
    assert.match(service, /AUTO_NOT_EXECUTABLE/);
    assert.doesNotMatch(service, /SET active_.*_revision_id/);
    assert.doesNotMatch(service, /scope:\s*['"]all['"]/);

    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/master-admin/ar360/customer-rollouts/[id]/route.ts"),
      "utf8",
    );
    assert.match(route, /ar360\.customer_rollout\.created|ar360\.customer_rollout\.previewed/);
    assert.match(route, /ar360\.customer_rollout\.canary_started/);
    assert.match(route, /ar360\.customer_rollout\.batch_started/);
    assert.match(route, /ar360\.customer_rollout\.paused/);
    assert.match(route, /ar360\.customer_rollout\.resumed/);
    assert.match(route, /ar360\.customer_rollout\.cancelled/);
  });

  it("migration engine exposes pause and cancel without whole-client undo", () => {
    const engine = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/migration-engine.service.ts"),
      "utf8",
    );
    assert.match(engine, /export async function pauseMigrationPlan/);
    assert.match(engine, /export async function cancelMigrationPlan/);
    assert.match(engine, /SKIPPED/);
  });
});
