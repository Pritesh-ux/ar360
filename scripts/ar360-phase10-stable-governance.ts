/**
 * Phase 10 — Stable governance smoke.
 * Run: npx tsx scripts/ar360-phase10-stable-governance.ts
 *
 * Activates then restores previous (empty) so local state stays safe.
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import { capturePointerSnapshot } from "../src/lib/platform-versioning/activation-safety.service";
import {
  activateStableRelease,
  getPreviousStableReleaseId,
  requestStableActivation,
  restorePreviousStable,
  runStableReadinessCheck,
} from "../src/lib/platform-versioning/stable-governance.service";
import { getActiveStableReleaseId } from "../src/lib/platform-versioning/releases.service";
import {
  listCanaryProductIds,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";

loadEnvConfig(process.cwd());

const PRODUCT_ID = "PRD_3XTVLF8X";

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
  const snap = await capturePointerSnapshot(PRODUCT_ID);
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
    snap,
    flagEnabled: Boolean(flag[0]?.enabled),
    targeting: JSON.stringify(flag[0]?.targeting ?? null),
    stable: String(stable[0]?.v ?? ""),
    policies: Number(policies[0]?.c || 0),
    plans: Number(plans[0]?.c || 0),
    rollouts: Number(rollouts[0]?.c || 0),
  };
}

async function main() {
  console.log("=== Phase 10 Stable Governance ===");
  const before = await safety();
  assert(before.products === 21, "products 21");
  assert(before.qr === 46, "QR 46");
  assert(before.subs === 6, "subs 6");
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });

  const published = await query<{ id: number; version: string }>(
    `SELECT id, version FROM ar360_platform_releases WHERE status = 'published' ORDER BY id ASC LIMIT 1`,
  );
  assert(!!published[0], "published release");
  const releaseId = Number(published[0].id);
  console.log("Using published", published[0].version, releaseId);

  // 1 readiness
  const ready = await runStableReadinessCheck(releaseId);
  assert(ready.banner === "STABLE READINESS", "banner");
  assert(ready.overall === "READY" || ready.overall === "WARN", `overall ${ready.overall}`);
  console.log("PASS: readiness", ready.overall);

  // 3 draft rejection
  const draft = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases WHERE status = 'draft' LIMIT 1`,
  );
  if (draft[0]) {
    const d = await runStableReadinessCheck(Number(draft[0].id));
    assert(d.overall === "BLOCKED", "draft blocked");
    console.log("PASS: draft rejected");
  }

  // 4 archived rejection
  let archivedId: number | null = null;
  const archived = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases WHERE status IN ('archived','retired') LIMIT 1`,
  );
  if (archived[0]) {
    archivedId = Number(archived[0].id);
  } else {
    await query(
      `INSERT INTO ar360_platform_releases
        (version, major, minor, patch, channel_code, status, title, metadata)
       VALUES ('8.8.8', 8, 8, 8, 'preview', 'archived', 'Phase10 temp', JSON_OBJECT('phase', 10, 'temp', true))`,
    );
    const created = await query<{ id: number }>(
      `SELECT id FROM ar360_platform_releases WHERE version='8.8.8' AND channel_code='preview' LIMIT 1`,
    );
    archivedId = Number(created[0].id);
  }
  const a = await runStableReadinessCheck(archivedId!);
  assert(a.overall === "BLOCKED", "archived blocked");
  console.log("PASS: archived rejected");

  // 5 activation without confirm
  let rejected = false;
  try {
    await activateStableRelease({ releaseId, adminId: 1, confirm: false });
  } catch (e) {
    rejected = String(e).includes("confirmation_required");
  }
  assert(rejected, "confirm required");
  console.log("PASS: confirm required");

  // request + activate
  await requestStableActivation({ releaseId, adminId: 1 });
  const activated = await activateStableRelease({
    releaseId,
    adminId: 1,
    confirm: true,
  });
  assert(activated.productPointersUnchanged === true, "pointers flag");
  assert((await getActiveStableReleaseId()) === releaseId, "stable pointer set");
  assert(activated.previousStableReleaseId == null || typeof activated.previousStableReleaseId === "number", "previous captured");
  console.log("PASS: activated", published[0].version, "health", activated.health.status);
  assert(activated.health.autoRollback === false, "no auto rollback");

  const mid = await safety();
  assert(JSON.stringify(mid.pointers) === JSON.stringify(before.pointers), "pointers unchanged");
  assert(mid.publicId === before.publicId, "public_id");
  assert(mid.viewerSlug === before.viewerSlug, "viewer_slug");
  assert(mid.legacySettings === before.legacySettings, "legacy settings");
  assert(mid.legacyMaterials === before.legacyMaterials, "legacy materials");
  assert(mid.targeting === before.targeting, "feature flag targeting");
  assert(mid.flagEnabled === before.flagEnabled, "feature flag enabled");
  assert(mid.policies === before.policies, "policies count");
  assert(mid.plans === before.plans, "plans count");
  assert(mid.rollouts === before.rollouts, "rollouts count");
  console.log("PASS: customer/product safety during activation");

  // 16 restore previous (empty)
  const restored = await restorePreviousStable({ adminId: 1, confirm: true });
  assert(restored.productPointersUnchanged === true, "restore no product touch");
  const afterPointer = await getActiveStableReleaseId();
  assert(afterPointer == null, "stable empty again");
  console.log("PASS: restore previous", restored.restoredReleaseId);

  await query(
    `DELETE FROM ar360_platform_releases WHERE version = '8.8.8' AND channel_code = 'preview' AND JSON_EXTRACT(metadata, '$.temp') = true`,
  );
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });

  const after = await safety();
  assert(after.products === 21 && after.qr === 46 && after.subs === 6, "counts");
  assert(JSON.stringify(after.pointers) === JSON.stringify(before.pointers), "pointers final");
  assert(after.stable === "" || after.stable === "0", "stable empty");
  const canary = await listCanaryProductIds();
  assert(canary.length === 0, "canary empty");

  void getPreviousStableReleaseId;

  console.log("=== Phase 10 PASS ===");
  console.log(JSON.stringify({ products: 21, qr: 46, subs: 6, stable: after.stable, canary }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
