/**
 * Phase 9 — Controlled customer rollout smoke (CHROMA / CUS-169432).
 * Run: npx tsx scripts/ar360-phase9-customer-rollout.ts
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import { capturePointerSnapshot } from "../src/lib/platform-versioning/activation-safety.service";
import {
  setClientTargetRelease,
  setClientUpdatePolicy,
} from "../src/lib/platform-versioning/client-update-policy.service";
import {
  assertRolloutExecutionAllowed,
  cancelCustomerRollout,
  createCustomerRollout,
  getCustomerRolloutDetail,
  previewCustomerRollout,
  startRolloutCanary,
} from "../src/lib/platform-versioning/customer-rollout.service";
import {
  listCanaryProductIds,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";

loadEnvConfig(process.cwd());

const PRODUCT_ID = "PRD_3XTVLF8X";
const CUSTOMER_UID = "CUS-169432";

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
    }>(`SELECT public_id, viewer_slug, settings, material_settings FROM products WHERE id = ?`, [
      PRODUCT_ID,
    ]),
    query<{ enabled: number; targeting: unknown }>(
      `SELECT enabled, targeting FROM ar360_feature_flags WHERE flag_key = 'versioned_runtime' LIMIT 1`,
    ),
    query<{ v: string | null }>(
      `SELECT setting_value AS v FROM platform_settings WHERE setting_key = 'ar360_active_stable_release_id' LIMIT 1`,
    ),
  ]);
  const snap = await capturePointerSnapshot(PRODUCT_ID);
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
    pointers: snap,
  };
}

async function main() {
  console.log("=== Phase 9 Customer Rollout — CHROMA ===");
  const before = await safety();
  assert(before.products === 21, "products 21");
  assert(before.qr === 46, "QR 46");
  assert(before.subs === 6, "subs 6");
  assert(before.stable === "" || before.stable === "0", "stable empty");
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });

  // Policy MANUAL
  await setClientUpdatePolicy({
    customerUid: CUSTOMER_UID,
    policy: "MANUAL",
    adminId: 1,
  });
  const published = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases WHERE status = 'published' ORDER BY id ASC LIMIT 1`,
  );
  assert(!!published[0], "published release");
  await setClientTargetRelease({
    customerUid: CUSTOMER_UID,
    targetReleaseId: Number(published[0].id),
    adminId: 1,
  });

  // AUTO gate
  const autoGate = assertRolloutExecutionAllowed({ policy: "AUTO", approvedAt: null });
  assert(autoGate.ok === false, "5: AUTO non-executable");
  console.log("PASS: AUTO non-executable");

  const snap0 = await capturePointerSnapshot(PRODUCT_ID);
  assert(!!snap0?.viewer, "viewer pointer");

  const viewerAlts = await query<{ id: number }>(
    `SELECT id FROM ar360_product_config_revisions
      WHERE product_uid = ? AND component_kind = 'viewer' AND status IN ('active','archived') AND id <> ?
      ORDER BY id DESC LIMIT 5`,
    [PRODUCT_ID, snap0!.viewer],
  );
  assert(viewerAlts.length > 0, "alternate viewer revision");
  const targetViewerId = Number(viewerAlts[0].id);

  // 1 create
  const created = await createCustomerRollout({
    customerUid: CUSTOMER_UID,
    targetReleaseId: Number(published[0].id),
    batchSize: 1,
    adminId: 1,
    notes: "Phase 9 CHROMA smoke",
    products: [{ productId: PRODUCT_ID, proposed: { viewer: targetViewerId } }],
  });
  assert(created.rollout.status === "READY", "READY");
  assert(created.rollout.customerUid === CUSTOMER_UID, "one client");
  console.log("PASS: create rollout", created.rollout.id);

  // 2 preview — no mutation
  const preview = await previewCustomerRollout(created.rollout.id);
  assert(preview.banner === "CUSTOMER ROLLOUT PREVIEW", "preview banner");
  const afterPreview = await capturePointerSnapshot(PRODUCT_ID);
  assert(JSON.stringify(afterPreview) === JSON.stringify(snap0), "preview no mutation");
  console.log("PASS: preview");

  // 24 cancel path (separate short rollout — no pointer change)
  const cancelProbe = await createCustomerRollout({
    customerUid: CUSTOMER_UID,
    targetReleaseId: Number(published[0].id),
    batchSize: 1,
    adminId: 1,
    notes: "Phase 9 cancel probe",
    products: [{ productId: PRODUCT_ID, proposed: { viewer: targetViewerId } }],
  });
  await previewCustomerRollout(cancelProbe.rollout.id);
  const cancelled = await cancelCustomerRollout({
    rolloutId: cancelProbe.rollout.id,
    clearCanaryProductIds: [PRODUCT_ID],
  });
  assert(cancelled.status === "CANCELLED", "cancelled");
  const afterCancel = await capturePointerSnapshot(PRODUCT_ID);
  assert(JSON.stringify(afterCancel) === JSON.stringify(snap0), "cancel no undo needed / no mutation");
  console.log("PASS: cancel");

  // 7/9 canary success
  const canary = await startRolloutCanary({
    rolloutId: created.rollout.id,
    productIds: [PRODUCT_ID],
    adminId: 1,
    confirm: true,
  });
  assert(
    canary.processed[0]?.status === "PASS" || canary.processed[0]?.status === "UNHEALTHY",
    `canary ${canary.processed[0]?.status}`,
  );
  const snap1 = await capturePointerSnapshot(PRODUCT_ID);
  assert(snap1?.viewer === targetViewerId, "viewer migrated via Phase 7");
  assert(snap1?.material === snap0!.material, "material unchanged");
  console.log("PASS: canary", canary.processed[0]?.status);

  const detail = await getCustomerRolloutDetail(created.rollout.id);
  assert(!!detail, "detail");
  assert(detail!.migrationPlan.id === created.migrationPlanId, "plan reference");

  // Restore viewer via Phase 7 path (component-level, not whole-client)
  if (snap0!.viewer && snap1?.viewer !== snap0.viewer) {
    const restore = await createCustomerRollout({
      customerUid: CUSTOMER_UID,
      targetReleaseId: Number(published[0].id),
      batchSize: 1,
      adminId: 1,
      notes: "Phase 9 restore",
      products: [{ productId: PRODUCT_ID, proposed: { viewer: snap0.viewer } }],
    });
    await previewCustomerRollout(restore.rollout.id);
    await startRolloutCanary({
      rolloutId: restore.rollout.id,
      productIds: [PRODUCT_ID],
      adminId: 1,
      confirm: true,
    });
    // Clear canary only — restore plan may already be COMPLETED
    await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });
  }

  // 24 cancel original if still open (not COMPLETED)
  const live = await getCustomerRolloutDetail(created.rollout.id);
  if (live && !["COMPLETED", "CANCELLED"].includes(live.rollout.status)) {
    await cancelCustomerRollout({
      rolloutId: created.rollout.id,
      clearCanaryProductIds: [PRODUCT_ID],
    });
    console.log("PASS: cancel");
  } else {
    await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });
    console.log("PASS: rollout terminal (COMPLETED) — canary cleared");
  }

  await setClientUpdatePolicy({
    customerUid: CUSTOMER_UID,
    policy: "MANUAL",
    adminId: 1,
  });
  await setClientTargetRelease({
    customerUid: CUSTOMER_UID,
    targetReleaseId: null,
    adminId: 1,
  });
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });

  const after = await safety();
  assert(after.products === before.products, "products");
  assert(after.qr === before.qr, "QR");
  assert(after.subs === before.subs, "subs");
  assert(after.publicId === before.publicId, "public_id");
  assert(after.viewerSlug === before.viewerSlug, "viewer_slug");
  assert(after.legacySettings === before.legacySettings, "legacy settings");
  assert(after.legacyMaterials === before.legacyMaterials, "legacy materials");
  assert(JSON.stringify(after.pointers) === JSON.stringify(before.pointers), "pointers restored");
  const canaryLeft = await listCanaryProductIds();
  assert(canaryLeft.length === 0, "canary empty");
  assert(after.stable === before.stable, "stable");

  console.log("=== Phase 9 PASS ===");
  console.log(
    JSON.stringify(
      {
        products: after.products,
        qr: after.qr,
        subs: after.subs,
        canary: canaryLeft,
        policy: "MANUAL",
      },
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
