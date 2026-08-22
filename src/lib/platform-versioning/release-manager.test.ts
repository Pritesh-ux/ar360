import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertValidChannel,
  assertValidSemver,
  normalizeReleaseStatus,
  parseSemver,
} from "@/lib/platform-versioning/semver";
import { assertValidFlagKey } from "@/lib/platform-versioning/feature-flags.service";
import { toReleaseDto, type PlatformReleaseRow } from "@/lib/platform-versioning/releases.service";

describe("AR360 Phase 2 semver + channel validation", () => {
  it("accepts valid semver and rejects invalid", () => {
    assert.deepEqual(parseSemver("2.0.0"), { version: "2.0.0", major: 2, minor: 0, patch: 0 });
    assert.equal(parseSemver("2.0"), null);
    assert.equal(parseSemver("v2.0.0"), null);
    assert.equal(parseSemver("2.0.0-beta"), null);
    assert.throws(() => assertValidSemver("abc"), /Invalid semantic version/);
  });

  it("validates channels", () => {
    assert.equal(assertValidChannel("Preview"), "preview");
    assert.equal(assertValidChannel("STABLE"), "stable");
    assert.throws(() => assertValidChannel("canary"), /Invalid channel/);
  });

  it("normalizes retired to archived", () => {
    assert.equal(normalizeReleaseStatus("retired"), "archived");
    assert.equal(normalizeReleaseStatus("published"), "published");
  });
});

describe("AR360 Phase 2 feature flag helpers", () => {
  it("validates flag keys and defaults conceptually OFF", () => {
    assert.equal(assertValidFlagKey("new_material_engine"), "new_material_engine");
    assert.throws(() => assertValidFlagKey("Bad Key"), /Invalid flag key/);
  });
});

describe("AR360 Phase 2 release DTO safety", () => {
  it("marks active stable only when pointer matches", () => {
    const row: PlatformReleaseRow = {
      id: 10,
      version: "2.0.0",
      major: 2,
      minor: 0,
      patch: 0,
      channel_code: "stable",
      status: "published",
      title: "AR360 2.0",
      release_notes: "notes",
      metadata: { activated: false },
      created_by_admin_id: 1,
      created_by_name: "Admin",
      created_at: "2026-01-01",
      published_at: "2026-01-02",
      updated_at: "2026-01-02",
    };
    assert.equal(toReleaseDto(row, null).isActiveStable, false);
    assert.equal(toReleaseDto(row, 10).isActiveStable, true);
    // Phase 10: active stable follows the pointer, not channel_code alone
    assert.equal(toReleaseDto({ ...row, channel_code: "preview" }, 10).isActiveStable, true);
    assert.equal(toReleaseDto({ ...row, channel_code: "preview" }, 99).isActiveStable, false);
  });
});

describe("AR360 Phase 2 migration 79", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "database/migrations/79_ar360_release_manager.sql"),
    "utf8",
  );

  it("adds title/created_by and empty active stable setting", () => {
    assert.match(migration, /ADD COLUMN IF NOT EXISTS title/);
    assert.match(migration, /created_by_admin_id/);
    assert.match(migration, /ar360_active_stable_release_id/);
    assert.match(migration, /SELECT 'ar360_active_stable_release_id', '', 0/);
    assert.doesNotMatch(migration, /UPDATE\s+products/i);
    assert.doesNotMatch(migration, /product_qr_codes/);
    assert.doesNotMatch(migration, /customer_subscriptions/);
    assert.doesNotMatch(migration, /assertCan|plan-enforcement/i);
  });
});

describe("AR360 Phase 2 does not wire viewer paths", () => {
  it("API routes exist under master-admin/ar360 only", () => {
    const publish = readFileSync(
      resolve(process.cwd(), "src/app/api/master-admin/ar360/releases/[id]/publish/route.ts"),
      "utf8",
    );
    assert.match(publish, /confirm/);
    assert.match(publish, /productPointersUnchanged/);
    assert.match(publish, /snapshotProductSafetyCounts/);
    assert.doesNotMatch(publish, /ModelViewer|public-products|product-save/);
  });
});
