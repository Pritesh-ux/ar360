/**
 * Phase 12 — Customer Platform Update Center smoke (CHROMA).
 * Run: npx tsx scripts/ar360-phase12-platform-update-center.ts
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import { capturePointerSnapshot } from "../src/lib/platform-versioning/activation-safety.service";
import {
  getCustomerOwnedRolloutPreview,
  getCustomerReleaseDetail,
  getCustomerUpdateCenter,
  listCustomerVisibleReleases,
  markPlatformReleaseViewed,
  platformUpdateCenterIsReadOnly,
} from "../src/lib/platform-versioning/customer-platform-update.service";
import { getActiveStableReleaseId } from "../src/lib/platform-versioning/releases.service";
import { setProductCanaryRuntime } from "../src/lib/platform-versioning/runtime-selection";

loadEnvConfig(process.cwd());

const PRODUCT_ID = "PRD_3XTVLF8X";
const CUSTOMER_UID = "CUS-169432";
const TEMP_VERSION = "12.9.9-phase12-temp";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function safety() {
  const [counts, qr, subs, product, flag, stable] = await Promise.all([
    query<{ products: number }>(`SELECT COUNT(*) AS products FROM products`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM product_qr_codes`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM customer_subscriptions`),
    query<{
      public_id: string | null;
      viewer_slug: string | null;
      settings: unknown;
      material_settings: unknown;
      active_config_revision_id: number | null;
      active_material_revision_id: number | null;
      active_lighting_revision_id: number | null;
      active_viewer_revision_id: number | null;
      active_ar_revision_id: number | null;
      active_geometry_revision_id: number | null;
    }>(
      `SELECT public_id, viewer_slug, settings, material_settings,
              active_config_revision_id, active_material_revision_id, active_lighting_revision_id,
              active_viewer_revision_id, active_ar_revision_id, active_geometry_revision_id
         FROM products WHERE id = ?`,
      [PRODUCT_ID],
    ),
    query<{ enabled: number; targeting: unknown }>(
      `SELECT enabled, targeting FROM ar360_feature_flags WHERE flag_key = 'versioned_runtime' LIMIT 1`,
    ),
    query<{ v: string | null }>(
      `SELECT setting_value AS v FROM platform_settings WHERE setting_key = 'ar360_active_stable_release_id' LIMIT 1`,
    ),
  ]);
  const p = product[0];
  return {
    products: Number(counts[0]?.products || 0),
    qr: Number(qr[0]?.c || 0),
    subs: Number(subs[0]?.c || 0),
    publicId: p?.public_id ?? null,
    viewerSlug: p?.viewer_slug ?? null,
    legacySettings: JSON.stringify(p?.settings ?? null),
    legacyMaterials: JSON.stringify(p?.material_settings ?? null),
    pointers: {
      config: p?.active_config_revision_id ?? null,
      material: p?.active_material_revision_id ?? null,
      lighting: p?.active_lighting_revision_id ?? null,
      viewer: p?.active_viewer_revision_id ?? null,
      ar: p?.active_ar_revision_id ?? null,
      geometry: p?.active_geometry_revision_id ?? null,
    },
    snap: await capturePointerSnapshot(PRODUCT_ID),
    flagEnabled: Boolean(flag[0]?.enabled),
    targeting: JSON.stringify(flag[0]?.targeting ?? null),
    stable: String(stable[0]?.v ?? ""),
  };
}

async function ensureViewsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ar360_customer_platform_release_views (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      customer_uid VARCHAR(40) NOT NULL,
      release_id BIGINT UNSIGNED NOT NULL,
      viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      dismissed_at DATETIME NULL,
      product_update_reviewed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ar360_cust_release_view (customer_uid, release_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(
    `INSERT INTO platform_settings (setting_key, setting_value, is_secret)
     SELECT 'ar360_runtime_phase', '12', 0 FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase')`,
  );
  await query(`UPDATE platform_settings SET setting_value = '12' WHERE setting_key = 'ar360_runtime_phase'`);
}

async function cleanupTemp() {
  await query(`DELETE FROM ar360_customer_platform_release_views WHERE release_id IN (
    SELECT id FROM (SELECT id FROM ar360_platform_releases WHERE version = ?) t
  )`, [TEMP_VERSION]).catch(() => undefined);
  await query(`DELETE FROM ar360_platform_releases WHERE version = ?`, [TEMP_VERSION]);
}

async function main() {
  console.log("=== Phase 12 Platform Update Center ===");
  assert(platformUpdateCenterIsReadOnly() === true, "read-only");
  await ensureViewsTable();
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });
  await cleanupTemp();

  const before = await safety();
  assert(before.products === 21, "products 21");
  assert(before.qr === 46, "QR 46");
  assert(before.subs === 6, "subs 6");

  // Scenario C: draft not customer-visible
  await query(
    `INSERT INTO ar360_platform_releases
      (version, major, minor, patch, channel_code, status, title, release_notes, metadata)
     VALUES (?, 12, 9, 9, 'preview', 'draft', 'Phase12 draft', 'hidden', JSON_OBJECT('temp', true))`,
    [TEMP_VERSION],
  );
  const draftRows = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases WHERE version = ? LIMIT 1`,
    [TEMP_VERSION],
  );
  const draftId = Number(draftRows[0].id);
  const visibleDraft = await listCustomerVisibleReleases(CUSTOMER_UID);
  assert(!visibleDraft.some((r) => r.id === draftId), "draft not visible");

  // Scenario D: archived not visible
  await query(
    `UPDATE ar360_platform_releases SET status = 'archived' WHERE id = ?`,
    [draftId],
  );
  const visibleArchived = await listCustomerVisibleReleases(CUSTOMER_UID);
  assert(!visibleArchived.some((r) => r.id === draftId), "archived not visible");
  await cleanupTemp();

  const center = await getCustomerUpdateCenter(CUSTOMER_UID);
  console.log("status", center.status, {
    current: center.currentVersion,
    latest: center.latestStableVersion,
  });
  assert(
    ["CURRENT", "UPDATE_AVAILABLE", "COMPATIBILITY_REVIEW"].includes(center.status),
    "status enum",
  );
  assert(center.autoExecutable === false, "auto not executable");

  const activeId = await getActiveStableReleaseId();
  // Prefer any published release for view/detail if stable empty
  const published = (await listCustomerVisibleReleases(CUSTOMER_UID))[0];
  const reviewId = activeId || published?.id || null;

  if (reviewId) {
    const state = await markPlatformReleaseViewed({
      customerUid: CUSTOMER_UID,
      releaseId: reviewId,
    });
    assert(state === "VIEWED" || state === "DISMISSED", "viewed");

    const detail = await getCustomerReleaseDetail({
      customerUid: CUSTOMER_UID,
      releaseId: reviewId,
    });
    assert(detail != null, "detail");
    assert(detail!.note.includes("Review only"), "review only note");
  } else {
    console.log("No published releases — Scenario A CURRENT path");
  }

  // Scenario H: cross-customer rollout denied
  const foreign = await query<{ id: number }>(
    `SELECT id FROM ar360_customer_rollouts WHERE customer_uid <> ? LIMIT 1`,
    [CUSTOMER_UID],
  );
  if (foreign[0]) {
    const denied = await getCustomerOwnedRolloutPreview({
      customerUid: CUSTOMER_UID,
      rolloutId: Number(foreign[0].id),
    });
    assert(denied === null, "cross-customer rollout denied");
  }

  const after = await safety();
  assert(after.products === before.products, "products unchanged");
  assert(after.qr === before.qr, "QR unchanged");
  assert(after.subs === before.subs, "subs unchanged");
  assert(after.publicId === before.publicId, "public_id");
  assert(after.viewerSlug === before.viewerSlug, "viewer_slug");
  assert(after.legacySettings === before.legacySettings, "settings");
  assert(after.legacyMaterials === before.legacyMaterials, "material_settings");
  assert(JSON.stringify(after.pointers) === JSON.stringify(before.pointers), "pointers");
  assert(JSON.stringify(after.snap) === JSON.stringify(before.snap), "snap");
  assert(after.flagEnabled === before.flagEnabled, "flag");
  assert(after.targeting === before.targeting, "targeting");
  assert(after.stable === before.stable, "stable pointer");

  console.log("Phase 12 CHROMA regression: PASS (no mutations)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
