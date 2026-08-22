/**
 * Phase 11 — Platform isolation / compatibility smoke.
 * Run: npx tsx scripts/ar360-phase11-platform-isolation.ts
 *
 * Creates diagnostic 2.1.0 release notes, runs compatibility for CHROMA,
 * verifies nothing mutated, removes temp release.
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import { capturePointerSnapshot } from "../src/lib/platform-versioning/activation-safety.service";
import {
  evaluateProductCompatibility,
  listPlatformCompatibilityReport,
  platformReleaseMutatesProducts,
} from "../src/lib/platform-versioning/platform-isolation.service";
import {
  getActiveStableReleaseId,
  getPlatformReleaseById,
} from "../src/lib/platform-versioning/releases.service";
import { setProductCanaryRuntime } from "../src/lib/platform-versioning/runtime-selection";

loadEnvConfig(process.cwd());

const PRODUCT_ID = "PRD_3XTVLF8X";
const CUSTOMER_UID = "CUS-169432";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function safety() {
  const [counts, qr, subs, product, flag, stable, policies, plans, rollouts] = await Promise.all([
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
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM ar360_client_update_policies`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM ar360_migration_plans`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM ar360_customer_rollouts`),
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
    policies: Number(policies[0]?.c || 0),
    plans: Number(plans[0]?.c || 0),
    rollouts: Number(rollouts[0]?.c || 0),
  };
}

async function main() {
  console.log("=== Phase 11 Platform Isolation ===");
  assert(platformReleaseMutatesProducts() === false, "isolation constant");
  const before = await safety();
  assert(before.products === 21, "products 21");
  assert(before.qr === 46, "QR 46");
  assert(before.subs === 6, "subs 6");
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });

  // Ensure 2.0.0 has structured notes (platform-only language)
  const v200 = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases WHERE version = '2.0.0' LIMIT 1`,
  );
  assert(!!v200[0], "2.0.0 exists");
  await query(
    `UPDATE ar360_platform_releases
        SET release_notes_json = ?
      WHERE id = ?`,
    [
      JSON.stringify({
        title: "AR360 2.0.0",
        summary: "SaaS platform release (diagnostic baseline)",
        newFeatures: ["Release manager"],
        improvements: ["Activation safety"],
        bugFixes: [],
        compatibilityNotes: ["Products remain on current revisions"],
        breakingChanges: [],
        customerImpact: "No automatic product changes",
      }),
      Number(v200[0].id),
    ],
  );

  // Platform 2.0.0 → 2.1.0 (create published diagnostic release)
  await query(
    `INSERT INTO ar360_platform_releases
      (version, major, minor, patch, channel_code, status, title, release_notes, release_notes_json, metadata, published_at)
     SELECT '2.1.0', 2, 1, 0, 'preview', 'published', 'AR360 2.1.0', 'Platform isolation phase',
            ?, JSON_OBJECT('phase', 11, 'temp', true, 'migratesProducts', false), NOW()
       FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM ar360_platform_releases WHERE version = '2.1.0' AND channel_code = 'preview'
      )`,
    [
      JSON.stringify({
        title: "AR360 2.1.0",
        summary: "Platform / customer / product isolation diagnostics",
        newFeatures: ["Platform compatibility report"],
        improvements: ["Structured release notes"],
        bugFixes: [],
        compatibilityNotes: ["Independent component revisions are expected"],
        breakingChanges: [],
        customerImpact: "Informational only — no product migration",
      }),
    ],
  );

  const v210 = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases WHERE version = '2.1.0' AND channel_code = 'preview' LIMIT 1`,
  );
  assert(!!v210[0], "2.1.0 created");
  const releaseId = Number(v210[0].id);

  const release = await getPlatformReleaseById(releaseId);
  assert(!!release, "release dto");

  const row = await evaluateProductCompatibility({
    productId: PRODUCT_ID,
    platformRelease: release,
  });
  assert(!!row, "row");
  assert(
    row.compatibility === "COMPATIBLE" || row.compatibility === "WARNING",
    `compat ${row.compatibility}`,
  );
  console.log("PASS: CHROMA compatibility", row.compatibility, row.material.label, row.viewer.label);

  const report = await listPlatformCompatibilityReport({
    releaseId,
    customerUid: CUSTOMER_UID,
    limit: 50,
  });
  assert(report.isolation.platformReleaseMutatesProducts === false, "isolation");
  assert(report.rows.length >= 1, "customer products");
  console.log("PASS: customer compatibility report", report.rows.length);

  // Stable pointer must remain unchanged (smoke does not activate)
  const active = await getActiveStableReleaseId();
  const beforeStableId =
    before.stable === "" || before.stable === "0" ? null : Number(before.stable);
  assert(active === beforeStableId, "stable not forced");

  const after = await safety();
  assert(after.products === before.products, "products");
  assert(after.qr === before.qr, "QR");
  assert(after.subs === before.subs, "subs");
  assert(after.publicId === before.publicId, "public_id");
  assert(after.viewerSlug === before.viewerSlug, "viewer_slug");
  assert(after.legacySettings === before.legacySettings, "legacy settings");
  assert(after.legacyMaterials === before.legacyMaterials, "legacy materials");
  assert(JSON.stringify(after.pointers) === JSON.stringify(before.pointers), "pointers");
  assert(after.targeting === before.targeting, "flags targeting");
  assert(after.flagEnabled === before.flagEnabled, "flags enabled");
  assert(after.policies === before.policies, "policies");
  assert(after.plans === before.plans, "plans");
  assert(after.rollouts === before.rollouts, "rollouts");
  assert(after.stable === before.stable, "stable pointer unchanged");
  console.log("PASS: database safety");

  // Cleanup temp 2.1.0
  await query(
    `DELETE FROM ar360_platform_releases
      WHERE version = '2.1.0' AND channel_code = 'preview'
        AND JSON_EXTRACT(metadata, '$.temp') = true`,
  );
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });

  console.log("=== Phase 11 PASS ===");
  console.log(
    JSON.stringify(
      { products: after.products, qr: after.qr, subs: after.subs, stable: after.stable },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
