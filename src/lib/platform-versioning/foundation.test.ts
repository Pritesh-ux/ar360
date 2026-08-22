import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  AR360_FOUNDATION_RELEASE_VERSION,
  AR360_LEGACY_COMPAT_LABEL,
  buildLegacyAssetRefs,
  buildLegacyConfigSnapshot,
  decideLegacyRevisionBackfill,
  identityFieldsUnchanged,
  listFoundationChannelCodes,
  listFoundationFeatureFlagKeys,
} from "@/lib/platform-versioning/foundation";
import { summarizeBackfillDecisions } from "@/lib/platform-versioning/legacy-backfill";

const migrationPath = resolve(
  process.cwd(),
  "database/migrations/78_ar360_versioning_foundation.sql",
);
const migration = readFileSync(migrationPath, "utf8");

describe("AR360 Phase 1 versioning foundation migration 78", () => {
  it("uses migration number 78 and does not collide with 61", () => {
    assert.match(migrationPath, /78_ar360_versioning_foundation\.sql$/);
    assert.doesNotMatch(migration, /61_/);
  });

  it("creates required foundation tables", () => {
    for (const table of [
      "ar360_release_channels",
      "ar360_platform_releases",
      "ar360_feature_flags",
      "ar360_product_config_revisions",
    ]) {
      assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
  });

  it("seeds preview/beta/stable and keeps stable as default customer-facing", () => {
    assert.match(migration, /'stable'/);
    assert.match(migration, /'beta'/);
    assert.match(migration, /'preview'/);
    assert.match(migration, /is_customer_facing/);
    assert.match(migration, /is_default/);
  });

  it("seeds draft 1.0.0 and does not publish/activate a release", () => {
    assert.match(migration, /'1\.0\.0'/);
    assert.match(migration, /'draft'/);
    assert.doesNotMatch(
      migration,
      /UPDATE\s+ar360_platform_releases\s+SET\s+status\s*=\s*'published'/i,
    );
  });

  it("seeds feature flags disabled and does not touch plan enforcement tables", () => {
    for (const key of listFoundationFeatureFlagKeys()) {
      assert.match(migration, new RegExp(`'${key}'`));
    }
    assert.match(migration, /enabled TINYINT\(1\) NOT NULL DEFAULT 0/);
    assert.doesNotMatch(migration, /assertCan|plan-enforcement|customer_subscriptions|billing_plans/i);
  });

  it("adds active revision pointers without changing public identity columns", () => {
    assert.match(migration, /active_config_revision_id/);
    assert.match(migration, /active_material_revision_id/);
    assert.match(migration, /active_lighting_revision_id/);
    assert.match(migration, /active_viewer_revision_id/);
    assert.match(migration, /active_ar_revision_id/);
    assert.match(migration, /active_geometry_revision_id/);
    assert.doesNotMatch(migration, /UPDATE\s+products\s+SET\s+public_id/i);
    assert.doesNotMatch(migration, /UPDATE\s+products\s+SET\s+viewer_slug/i);
    assert.doesNotMatch(migration, /UPDATE\s+products\s+SET\s+material_settings/i);
    assert.doesNotMatch(migration, /UPDATE\s+products\s+SET\s+settings/i);
    assert.doesNotMatch(migration, /product_qr_codes/);
  });

  it("backfills revision_1 idempotently via unique key and NOT EXISTS", () => {
    assert.match(migration, /uq_ar360_pcr_product_revision/);
    assert.match(migration, /revision_number/);
    assert.match(migration, /NOT EXISTS/);
    assert.match(migration, /legacy_backfill/);
    assert.match(migration, /legacy-current/);
  });

  it("does not duplicate GLB binaries in SQL", () => {
    assert.doesNotMatch(migration, /LOAD_FILE\s*\(/i);
    assert.doesNotMatch(migration, /COPY\s+.*model\.glb/i);
    assert.match(migration, /referenced, not copied/i);
  });

  it("does not leave enterprise product_versions as the new system of record", () => {
    assert.doesNotMatch(migration, /ALTER TABLE product_versions/i);
    assert.doesNotMatch(migration, /INSERT INTO product_versions/i);
  });

  it("uses idempotent ADD COLUMN IF NOT EXISTS for product pointers", () => {
    assert.match(migration, /ADD COLUMN IF NOT EXISTS active_config_revision_id/);
    assert.match(migration, /ADD INDEX IF NOT EXISTS idx_products_active_config_rev/);
  });
});

describe("AR360 Phase 1 foundation helpers", () => {
  const sampleProduct = {
    id: "PRD_TEST1",
    customer_uid: "CUS-1",
    title: "Chrome Rack",
    status: "published",
    public_id: "pub_abc",
    viewer_slug: "chrome-rack",
    version: 4,
    settings: { exposure: 0.9, environmentImage: "neutral" },
    material_settings: { "0": { baseColor: "#c0c0c0", metalness: 1, roughness: 0.15 } },
    variants: [],
    hotspots: [],
    model_url: "/Storage/Customers/CUS-1/Products/PRD_TEST1/model.glb",
    file_name: "model.glb",
    product_folder: "/Storage/Customers/CUS-1/Products/PRD_TEST1",
    thumbnail_url: "/Storage/Customers/CUS-1/Products/PRD_TEST1/thumbnail.png",
    qr_url: "/Storage/Customers/CUS-1/Products/PRD_TEST1/qr.png",
    poster: "data:image/png;base64,AAAA",
  };

  it("builds revision_1 config that preserves identity and visual config", () => {
    const snap = buildLegacyConfigSnapshot(sampleProduct);
    assert.equal(snap.schemaVersion, 1);
    assert.equal(snap.source, "legacy_backfill");
    assert.equal(snap.productIdentity.publicId, "pub_abc");
    assert.equal(snap.productIdentity.viewerSlug, "chrome-rack");
    assert.deepEqual(snap.settings, sampleProduct.settings);
    assert.deepEqual(snap.materialSettings, sampleProduct.material_settings);
    assert.equal(snap.components.material.alignedToRevision, 1);
    assert.equal(AR360_LEGACY_COMPAT_LABEL, "legacy-current");
    assert.equal(AR360_FOUNDATION_RELEASE_VERSION, "1.0.0");
  });

  it("builds asset refs without embedding poster data URLs or GLB bytes", () => {
    const refs = buildLegacyAssetRefs(sampleProduct);
    assert.equal(refs.modelUrl, sampleProduct.model_url);
    assert.equal(refs.qrUrl, sampleProduct.qr_url);
    assert.equal(refs.posterRef, null);
    assert.ok(refs.files.some((f) => f.hint === "model.glb"));
    assert.equal(JSON.stringify(refs).includes("data:image"), false);
  });

  it("backfill decision is idempotent", () => {
    assert.equal(
      decideLegacyRevisionBackfill({
        productUid: "PRD_TEST1",
        hasRevision1: true,
        hasActiveConfigPointer: false,
      }).action,
      "skip",
    );
    assert.equal(
      decideLegacyRevisionBackfill({
        productUid: "PRD_TEST1",
        hasRevision1: false,
        hasActiveConfigPointer: true,
      }).action,
      "skip",
    );
    assert.equal(
      decideLegacyRevisionBackfill({
        productUid: "PRD_TEST1",
        hasRevision1: false,
        hasActiveConfigPointer: false,
      }).action,
      "insert",
    );

    const summary = summarizeBackfillDecisions([
      { productUid: "A", hasRevision1: true, hasActiveConfigPointer: false },
      { productUid: "B", hasRevision1: false, hasActiveConfigPointer: false },
      { productUid: "C", hasRevision1: false, hasActiveConfigPointer: true },
    ]);
    assert.equal(summary.productsConsidered, 3);
    assert.equal(summary.wouldInsert, 1);
    assert.equal(summary.skipped, 2);
  });

  it("detects unchanged public identity fields", () => {
    assert.equal(
      identityFieldsUnchanged(
        { public_id: "a", viewer_slug: "b", qr_url: "c" },
        { public_id: "a", viewer_slug: "b", qr_url: "c" },
      ),
      true,
    );
    assert.equal(
      identityFieldsUnchanged(
        { public_id: "a", viewer_slug: "b", qr_url: "c" },
        { public_id: "a", viewer_slug: "changed", qr_url: "c" },
      ),
      false,
    );
  });

  it("lists foundation channels and flags", () => {
    assert.deepEqual(listFoundationChannelCodes(), ["stable", "beta", "preview"]);
    assert.ok(listFoundationFeatureFlagKeys().includes("new_material_engine"));
  });
});
