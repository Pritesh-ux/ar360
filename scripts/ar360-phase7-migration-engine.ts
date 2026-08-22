/**
 * Phase 7 — CHROMA controlled migration smoke.
 * Run: npx tsx scripts/ar360-phase7-migration-engine.ts
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import {
  capturePointerSnapshot,
  listChangeHistory,
} from "../src/lib/platform-versioning/activation-safety.service";
import {
  createMigrationPlan,
  executeMigrationBatch,
  previewMigrationPlan,
  validateProductMigration,
} from "../src/lib/platform-versioning/migration-engine.service";
import {
  listCanaryProductIds,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";

loadEnvConfig(process.cwd());

const ID = "PRD_3XTVLF8X";

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
    }>(`SELECT public_id, viewer_slug, settings, material_settings FROM products WHERE id = ?`, [ID]),
    query<{ enabled: number; targeting: unknown }>(
      `SELECT enabled, targeting FROM ar360_feature_flags WHERE flag_key = 'versioned_runtime' LIMIT 1`,
    ),
    query<{ v: string | null }>(
      `SELECT setting_value AS v FROM platform_settings WHERE setting_key = 'ar360_active_stable_release_id' LIMIT 1`,
    ),
  ]);
  return {
    products: Number(counts[0]?.products || 0),
    qr: Number(qr[0]?.c || 0),
    subs: Number(subs[0]?.c || 0),
    publicId: product[0]?.public_id ?? null,
    viewerSlug: product[0]?.viewer_slug ?? null,
    legacySettings: JSON.stringify(product[0]?.settings ?? null),
    legacyMaterials: JSON.stringify(product[0]?.material_settings ?? null),
    flagEnabled: Boolean(flag[0]?.enabled),
    targeting: flag[0]?.targeting ?? null,
    stable: String(stable[0]?.v ?? ""),
  };
}

async function main() {
  console.log("=== Phase 7 Migration Engine — CHROMA ===");
  const before = await safety();
  assert(before.products === 21, "products 21");
  assert(before.qr === 46, "QR 46");
  assert(before.subs === 6, "subs 6");
  assert(before.stable === "" || before.stable === "0", "stable empty");
  await setProductCanaryRuntime({ productId: ID, enabled: false });

  const snap0 = await capturePointerSnapshot(ID);
  assert(!!snap0?.viewer, "viewer pointer required for test");

  // Find an alternate archived/active viewer revision that is not current
  const viewerAlts = await query<{ id: number }>(
    `SELECT id FROM ar360_product_config_revisions
      WHERE product_uid = ? AND component_kind = 'viewer' AND status IN ('active','archived') AND id <> ?
      ORDER BY id DESC LIMIT 5`,
    [ID, snap0!.viewer],
  );
  assert(viewerAlts.length > 0, "need alternate viewer revision for migration target");
  const targetViewerId = Number(viewerAlts[0].id);

  // 5 invalid: geometry
  const geo = await validateProductMigration({
    productId: ID,
    proposed: { geometry: 1 },
  });
  assert(geo.ok === false && geo.code === "GEOMETRY_NOT_SUPPORTED", "geometry blocked");

  // 6 wrong component
  const wrong = await validateProductMigration({
    productId: ID,
    proposed: { material: targetViewerId },
  });
  assert(wrong.ok === false && wrong.code === "WRONG_COMPONENT", "wrong component");

  // 1 create plan
  const plan = await createMigrationPlan({
    title: "Phase 7 CHROMA viewer controlled migration",
    batchSize: 1,
    adminId: 1,
    notes: "CHROMA only",
    products: [{ productId: ID, proposed: { viewer: targetViewerId } }],
  });
  assert(plan.status === "DRAFT", "draft plan");
  assert(plan.rolloutMode === "selected_products", "selected only");
  console.log("1 PASS — plan created", plan.id);

  // 3 preview
  const preview = await previewMigrationPlan(plan.id);
  assert(preview.banner === "MIGRATION PREVIEW", "preview banner");
  assert(preview.products[0]?.productId === ID, "preview product");
  const snapAfterPreview = await capturePointerSnapshot(ID);
  assert(JSON.stringify(snapAfterPreview) === JSON.stringify(snap0), "3: preview no mutation");
  console.log("3 PASS — preview");

  // 4 valid canary migration
  const canary = await executeMigrationBatch({
    planId: plan.id,
    adminId: 1,
    canaryProductIds: [ID],
    confirm: true,
  });
  assert(canary.processed[0]?.productId === ID, "canary product");
  assert(
    canary.processed[0]?.status === "PASS" || canary.processed[0]?.status === "UNHEALTHY",
    `canary status ${canary.processed[0]?.status}`,
  );
  const snap1 = await capturePointerSnapshot(ID);
  assert(snap1?.viewer === targetViewerId, "viewer pointer migrated");
  assert(snap1?.material === snap0!.material, "material unchanged");
  assert(snap1?.lighting === snap0!.lighting, "lighting unchanged");
  assert(snap1?.ar === snap0!.ar, "ar unchanged");
  assert(snap1?.geometry === snap0!.geometry, "geometry unchanged");
  assert(snap1?.config === snap0!.config, "config unchanged");
  console.log("4/11 PASS — canary migration", canary.processed[0]?.status);

  const history = await listChangeHistory(ID, 20);
  assert(
    history.some((h) => h.componentKind === "viewer" && String(h.reason || "").includes("Migration plan")),
    "15: change history",
  );

  // Restore viewer pointer to original via another plan (controlled)
  if (snap0!.viewer && snap1?.viewer !== snap0.viewer) {
    const restore = await createMigrationPlan({
      title: "Phase 7 CHROMA viewer restore",
      batchSize: 1,
      adminId: 1,
      products: [{ productId: ID, proposed: { viewer: snap0.viewer } }],
    });
    await executeMigrationBatch({
      planId: restore.id,
      adminId: 1,
      canaryProductIds: [ID],
      confirm: true,
    });
  }

  await setProductCanaryRuntime({ productId: ID, enabled: false });
  const after = await safety();
  assert(after.products === 21 && after.qr === 46 && after.subs === 6, "counts");
  assert(after.publicId === before.publicId && after.viewerSlug === before.viewerSlug, "ids");
  assert(after.legacySettings === before.legacySettings, "legacy settings");
  assert(after.legacyMaterials === before.legacyMaterials, "legacy materials");
  assert(after.stable === "" || after.stable === "0", "stable still empty");
  assert(!(await listCanaryProductIds()).includes(ID), "canary off");
  const final = await capturePointerSnapshot(ID);
  assert(final?.viewer === snap0!.viewer, "viewer restored");

  console.log("=== Phase 7 ALL PASS ===");
  console.log(
    JSON.stringify(
      {
        planId: plan.id,
        migratedTemporarilyTo: targetViewerId,
        restoredViewer: final?.viewer,
        canary: await listCanaryProductIds(),
        products: after.products,
        qr: after.qr,
        subs: after.subs,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Phase 7 FAILED", err);
  process.exit(1);
});
