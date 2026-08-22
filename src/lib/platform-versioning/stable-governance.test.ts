import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stableActivationTouchesProductPointers } from "@/lib/platform-versioning/stable-governance.service";
import { isGeometryBlocked } from "@/lib/platform-versioning/migration-engine.service";

describe("AR360 Phase 10 stable governance", () => {
  it("stable activation never touches product pointers", () => {
    assert.equal(stableActivationTouchesProductPointers(), false);
  });

  it("geometry remains blocked in migration path", () => {
    assert.equal(isGeometryBlocked("geometry"), true);
  });

  it("SQL and service forbid product migration / VERSIONED enable / auto-rollback", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "database/migrations/86_ar360_stable_governance.sql"),
      "utf8",
    );
    assert.match(migration, /ar360_previous_stable_release_id/);
    assert.match(migration, /ar360_stable_request_release_id/);
    assert.doesNotMatch(migration, /UPDATE products|active_.*_revision_id/i);

    const service = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/stable-governance.service.ts"),
      "utf8",
    );
    assert.match(service, /STABLE READINESS/);
    assert.match(service, /confirmation_required/);
    assert.match(service, /autoRollback: false/);
    assert.match(service, /ACTIVE_STABLE_SETTING_KEY/);
    assert.doesNotMatch(service, /SET active_.*_revision_id/);
    assert.doesNotMatch(service, /scope:\s*['"]all['"]/);
    assert.doesNotMatch(service, /enabled\s*=\s*1/);

    const activate = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/master-admin/ar360/releases/[id]/stable-activate/route.ts",
      ),
      "utf8",
    );
    assert.match(activate, /ar360\.release\.stable_activated/);
    assert.match(activate, /ar360\.release\.stable_activation_blocked/);
    assert.match(activate, /confirm/);

    const request = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/master-admin/ar360/releases/[id]/stable-request/route.ts",
      ),
      "utf8",
    );
    assert.match(request, /ar360\.release\.stable_requested/);

    const restore = readFileSync(
      resolve(process.cwd(), "src/app/api/master-admin/ar360/stable/restore-previous/route.ts"),
      "utf8",
    );
    assert.match(restore, /restore_previous/);
    assert.match(restore, /confirm/);
  });
});
