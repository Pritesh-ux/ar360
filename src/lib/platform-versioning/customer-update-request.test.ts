import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  autoExecutionIsDisabled,
  customerApprovalMutatesPointers,
} from "@/lib/platform-versioning/customer-update-request.service";

describe("AR360 Phase 13 customer update request gateway", () => {
  it("approval gateway does not mutate pointers and AUTO stays disabled", () => {
    assert.equal(customerApprovalMutatesPointers(), false);
    assert.equal(autoExecutionIsDisabled(), true);
  });

  it("SQL is additive request table only", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "database/migrations/89_ar360_customer_update_requests.sql"),
      "utf8",
    );
    assert.match(migration, /ar360_customer_update_requests/);
    assert.match(migration, /preview_snapshot_json/);
    assert.match(migration, /product_selection_json/);
    assert.doesNotMatch(migration, /UPDATE products|customer_subscriptions|product_qr/i);
  });

  it("service uses Phase 9 createCustomerRollout and never executes batches", () => {
    const service = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/customer-update-request.service.ts"),
      "utf8",
    );
    assert.match(service, /createCustomerRollout/);
    assert.match(service, /UPDATE_APPROVAL_STALE/);
    assert.match(service, /AUTO_EXECUTION_DISABLED/);
    assert.match(service, /assertRequestSnapshotFresh/);
    assert.doesNotMatch(service, /executeMigrationBatch|startRolloutCanary|startRolloutBatch/);
    assert.doesNotMatch(service, /SET active_.*_revision_id/);
  });

  it("customer and admin APIs enforce scope and audits", () => {
    const create = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/account/platform/releases/[id]/update-requests/route.ts",
      ),
      "utf8",
    );
    assert.match(create, /requireScopedApiUser/);
    assert.match(create, /ar360\.customer_update\.requested/);
    assert.doesNotMatch(create, /customerUid.*body\.customerUid|body\.customer_uid/);

    const approve = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/master-admin/ar360/customer-update-requests/[id]/approve/route.ts",
      ),
      "utf8",
    );
    assert.match(approve, /ar360\.customer_update\.approved/);
    assert.match(approve, /migratesProducts:\s*false/);

    const prepare = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/master-admin/ar360/customer-update-requests/[id]/prepare-rollout/route.ts",
      ),
      "utf8",
    );
    assert.match(prepare, /prepareRolloutFromCustomerUpdateRequest/);
    assert.match(prepare, /ar360\.customer_update\.rollout_ready/);
    assert.doesNotMatch(prepare, /executeMigrationBatch/);
  });

  it("UI separates request confirmation from automatic update", () => {
    const page = readFileSync(
      resolve(
        process.cwd(),
        "src/app/dashboard/(gated)/platform/releases/[id]/update-review/page.tsx",
      ),
      "utf8",
    );
    assert.match(page, /I reviewed the proposed product updates/);
    assert.match(page, /Request Product Update|Submit for Approval/);
    assert.doesNotMatch(page, /Update Everything Automatically/);
  });
});
