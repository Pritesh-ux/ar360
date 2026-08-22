/**
 * Phase 8 — Client update policy / release eligibility (CHROMA customer).
 * Run: npx tsx scripts/ar360-phase8-client-update-policy.ts
 *
 * Does NOT migrate products. AUTO must not execute.
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import { capturePointerSnapshot } from "../src/lib/platform-versioning/activation-safety.service";
import {
  approveClientTargetRelease,
  getClientUpdateState,
  setClientTargetRelease,
  setClientUpdatePolicy,
  validateTargetReleaseEligibility,
} from "../src/lib/platform-versioning/client-update-policy.service";
import { setProductCanaryRuntime } from "../src/lib/platform-versioning/runtime-selection";

loadEnvConfig(process.cwd());

const PRODUCT_ID = "PRD_3XTVLF8X";
const CUSTOMER_UID = "CUS-169432";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function safety() {
  const [counts, qr, subs, product, flag, stable, phase] = await Promise.all([
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
    query<{ v: string | null }>(
      `SELECT setting_value AS v FROM platform_settings WHERE setting_key = 'ar360_runtime_phase' LIMIT 1`,
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
    phase: String(phase[0]?.v ?? ""),
    pointers: snap,
  };
}

async function main() {
  console.log("=== Phase 8 Client Update Policy — CHROMA customer ===");
  const before = await safety();
  assert(before.products === 21, "products 21");
  assert(before.qr === 46, "QR 46");
  assert(before.subs === 6, "subs 6");
  assert(before.stable === "" || before.stable === "0", "stable empty");
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });

  // Cancel leftover Phase 7 PAUSED plans so policy status is not masked
  await query(
    `UPDATE ar360_migration_plans mp
        INNER JOIN ar360_migration_plan_products mpp ON mpp.plan_id = mp.id
        INNER JOIN products p ON p.id = mpp.product_uid
        SET mp.status = 'CANCELLED', mp.updated_at = NOW()
      WHERE p.customer_uid = ? AND mp.status = 'PAUSED'`,
    [CUSTOMER_UID],
  );

  // Reset prior Phase 8 test residue to default MANUAL (existing clients stay MANUAL)
  const existingPolicy = await query<{ id: number }>(
    `SELECT id FROM ar360_client_update_policies WHERE customer_uid = ? LIMIT 1`,
    [CUSTOMER_UID],
  );
  if (existingPolicy[0]) {
    await query(
      `UPDATE ar360_client_update_policies
          SET update_policy = 'MANUAL',
              target_release_id = NULL,
              approved_by_admin_id = NULL,
              approved_at = NULL,
              status = 'CURRENT',
              updated_at = NOW()
        WHERE customer_uid = ?`,
      [CUSTOMER_UID],
    );
  }

  // 1. Existing client defaults to MANUAL (virtual or persisted)
  let detail = await getClientUpdateState(CUSTOMER_UID);
  assert(!!detail, "client exists");
  assert(detail!.client.updatePolicy === "MANUAL", "default MANUAL");
  console.log("PASS: default MANUAL");

  // 2. MANUAL → APPROVAL_REQUIRED
  await setClientUpdatePolicy({
    customerUid: CUSTOMER_UID,
    policy: "APPROVAL_REQUIRED",
    adminId: 1,
  });
  detail = await getClientUpdateState(CUSTOMER_UID);
  assert(detail!.client.updatePolicy === "APPROVAL_REQUIRED", "policy APPROVAL_REQUIRED");
  console.log("PASS: MANUAL → APPROVAL_REQUIRED");

  // 3. APPROVAL_REQUIRED → AUTO (policy only, not executable)
  await setClientUpdatePolicy({
    customerUid: CUSTOMER_UID,
    policy: "AUTO",
    adminId: 1,
  });
  detail = await getClientUpdateState(CUSTOMER_UID);
  assert(detail!.client.updatePolicy === "AUTO", "policy AUTO");
  assert(detail!.client.autoActive === false, "AUTO not active");
  assert(detail!.client.autoLabel.includes("NOT ACTIVE"), "AUTO label");
  console.log("PASS: APPROVAL_REQUIRED → AUTO (not active)");

  // Restore to APPROVAL_REQUIRED for approval flow
  await setClientUpdatePolicy({
    customerUid: CUSTOMER_UID,
    policy: "APPROVAL_REQUIRED",
    adminId: 1,
  });

  // 5. Draft release rejected
  const draft = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases WHERE status = 'draft' LIMIT 1`,
  );
  assert(!!draft[0], "draft release exists");
  const draftCheck = await validateTargetReleaseEligibility({
    targetReleaseId: Number(draft[0].id),
    currentReleaseId: null,
  });
  assert(draftCheck.ok === false && draftCheck.code === "DRAFT_RELEASE_REJECTED", "draft rejected");
  console.log("PASS: draft release rejected");

  // 6. Archived release rejected (create temp if needed)
  let archivedId: number | null = null;
  const archived = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases WHERE status IN ('archived','retired') LIMIT 1`,
  );
  if (archived[0]) {
    archivedId = Number(archived[0].id);
  } else {
    // Temporarily archive nothing — use validate against a fake by inserting then restoring
    await query(
      `INSERT INTO ar360_platform_releases
        (version, major, minor, patch, channel_code, status, title, release_notes, metadata)
       VALUES ('9.9.9', 9, 9, 9, 'preview', 'archived', 'Phase8 temp', NULL, JSON_OBJECT('phase', 8, 'temp', true))`,
    );
    const created = await query<{ id: number }>(
      `SELECT id FROM ar360_platform_releases WHERE version = '9.9.9' AND channel_code = 'preview' LIMIT 1`,
    );
    archivedId = Number(created[0].id);
  }
  const archCheck = await validateTargetReleaseEligibility({
    targetReleaseId: archivedId!,
    currentReleaseId: null,
  });
  assert(
    archCheck.ok === false && archCheck.code === "ARCHIVED_RELEASE_REJECTED",
    "archived rejected",
  );
  console.log("PASS: archived release rejected");

  // 7. Invalid release rejected
  const invalid = await validateTargetReleaseEligibility({
    targetReleaseId: 999999991,
    currentReleaseId: null,
  });
  assert(invalid.ok === false && invalid.code === "RELEASE_NOT_FOUND", "invalid rejected");
  console.log("PASS: invalid release rejected");

  // 4. Change target release (published 2.0.0)
  const published = await query<{ id: number; version: string }>(
    `SELECT id, version FROM ar360_platform_releases WHERE status = 'published' ORDER BY id ASC LIMIT 1`,
  );
  assert(!!published[0], "published release exists");
  const targetId = Number(published[0].id);
  await setClientTargetRelease({
    customerUid: CUSTOMER_UID,
    targetReleaseId: targetId,
    adminId: 1,
  });
  detail = await getClientUpdateState(CUSTOMER_UID);
  assert(detail!.client.targetReleaseId === targetId, "target set");
  assert(detail!.client.status === "PENDING_APPROVAL", "pending approval");
  console.log("PASS: target release set → PENDING_APPROVAL");

  // 15. Approval
  await approveClientTargetRelease({ customerUid: CUSTOMER_UID, adminId: 1 });
  detail = await getClientUpdateState(CUSTOMER_UID);
  assert(!!detail!.client.approvedAt, "approved_at set");
  assert(detail!.client.status === "UPDATE_AVAILABLE", "update available after approval");
  console.log("PASS: approval granted");

  // 8–14 safety: products / QR / subscriptions / pointers unchanged
  const after = await safety();
  assert(after.products === before.products, "products count");
  assert(after.qr === before.qr, "QR count");
  assert(after.subs === before.subs, "subs count");
  assert(after.publicId === before.publicId, "public_id");
  assert(after.viewerSlug === before.viewerSlug, "viewer_slug");
  assert(after.legacySettings === before.legacySettings, "legacy settings");
  assert(after.legacyMaterials === before.legacyMaterials, "legacy material_settings");
  assert(JSON.stringify(after.pointers) === JSON.stringify(before.pointers), "component pointers");
  assert(after.stable === before.stable, "stable unchanged");
  assert(after.flagEnabled === false || after.targeting, "VERSIONED not global");
  console.log("PASS: DB safety + pointers unchanged");

  // 18–19: no migration plan auto-created for this customer from policy actions
  const autoPlans = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM ar360_migration_plans
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 2 MINUTE)
        AND title LIKE '%AUTO%'`,
  );
  assert(Number(autoPlans[0]?.c || 0) === 0, "no AUTO migration plans");

  // Cleanup: restore MANUAL, clear target, delete temp archived if we created it
  await setClientTargetRelease({
    customerUid: CUSTOMER_UID,
    targetReleaseId: null,
    adminId: 1,
  });
  await setClientUpdatePolicy({
    customerUid: CUSTOMER_UID,
    policy: "MANUAL",
    adminId: 1,
  });
  await query(
    `DELETE FROM ar360_platform_releases WHERE version = '9.9.9' AND channel_code = 'preview' AND JSON_EXTRACT(metadata, '$.temp') = true`,
  );

  const final = await safety();
  assert(final.products === 21 && final.qr === 46 && final.subs === 6, "final counts");
  assert(final.phase === "8" || final.phase === "7" || final.phase !== "", "phase setting present");
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });

  console.log("=== Phase 8 PASS ===");
  console.log(
    JSON.stringify(
      {
        policyRestored: "MANUAL",
        products: final.products,
        qr: final.qr,
        subs: final.subs,
        canary: [],
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
