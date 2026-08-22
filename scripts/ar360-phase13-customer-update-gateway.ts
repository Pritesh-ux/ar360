/**
 * Phase 13 — Customer approval gateway smoke (CHROMA).
 * Run: npx tsx scripts/ar360-phase13-customer-update-gateway.ts
 *
 * Creates a temporary release-tagged viewer target, runs request → approve →
 * prepare Phase 9 rollout, then cancels rollout and restores all state.
 * Does NOT run canary/batch.
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import { capturePointerSnapshot } from "../src/lib/platform-versioning/activation-safety.service";
import { cancelCustomerRollout } from "../src/lib/platform-versioning/customer-rollout.service";
import {
  approveCustomerUpdateRequest,
  createCustomerUpdateRequest,
  customerApprovalMutatesPointers,
  getReleaseUpdateReview,
  prepareRolloutFromCustomerUpdateRequest,
} from "../src/lib/platform-versioning/customer-update-request.service";
import { setProductCanaryRuntime } from "../src/lib/platform-versioning/runtime-selection";

loadEnvConfig(process.cwd());

const PRODUCT_ID = "PRD_3XTVLF8X";
const CUSTOMER_UID = "CUS-169432";
const RELEASE_ID = 2; // published 2.0.0
const TEMP_VIEWER_TARGET = 59; // archived viewer v12 — safe migration target candidate

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

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ar360_customer_update_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      customer_uid VARCHAR(40) NOT NULL,
      release_id BIGINT UNSIGNED NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      update_policy_snapshot VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
      approval_required TINYINT(1) NOT NULL DEFAULT 0,
      requested_by_user_id INT UNSIGNED NULL,
      requested_at DATETIME NULL,
      approved_by_admin_id INT UNSIGNED NULL,
      approved_at DATETIME NULL,
      rejected_by_admin_id INT UNSIGNED NULL,
      rejected_at DATETIME NULL,
      reject_reason VARCHAR(512) NULL,
      cancelled_at DATETIME NULL,
      stale_at DATETIME NULL,
      stale_reason VARCHAR(255) NULL,
      product_selection_json JSON NOT NULL,
      preview_snapshot_json JSON NOT NULL,
      rollout_id BIGINT UNSIGNED NULL,
      notes VARCHAR(512) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`UPDATE platform_settings SET setting_value = '13' WHERE setting_key = 'ar360_runtime_phase'`);
}

async function main() {
  console.log("=== Phase 13 Customer Update Gateway ===");
  assert(customerApprovalMutatesPointers() === false, "no pointer mutation constant");
  await ensureTable();
  await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });

  const before = await safety();
  assert(before.products === 21, "products 21");
  assert(before.qr === 46, "QR 46");
  assert(before.subs === 6, "subs 6");

  // Tag archived viewer v12 to published release so CHROMA becomes ELIGIBLE (diagnostic only)
  const priorTag = await query<{ platform_release_id: number | null }>(
    `SELECT platform_release_id FROM ar360_product_config_revisions WHERE id = ?`,
    [TEMP_VIEWER_TARGET],
  );
  await query(
    `UPDATE ar360_product_config_revisions SET platform_release_id = ? WHERE id = ?`,
    [RELEASE_ID, TEMP_VIEWER_TARGET],
  );

  let requestId: number | null = null;
  let rolloutId: number | null = null;
  let migrationPlanId: number | null = null;

  try {
    // Empty selection rejected
    let emptyFailed = false;
    try {
      await createCustomerUpdateRequest({
        customerUid: CUSTOMER_UID,
        releaseId: RELEASE_ID,
        productIds: [],
        requestedByUserId: null,
      });
    } catch (e) {
      emptyFailed = (e as { code?: string }).code === "EMPTY_SELECTION";
    }
    assert(emptyFailed, "empty selection rejected");

    // Draft release rejected
    let draftFailed = false;
    try {
      await createCustomerUpdateRequest({
        customerUid: CUSTOMER_UID,
        releaseId: 1,
        productIds: [PRODUCT_ID],
        requestedByUserId: null,
      });
    } catch (e) {
      draftFailed = (e as { code?: string })?.code === "DRAFT_RELEASE_REJECTED";
    }
    assert(draftFailed, "draft rejected");

    // Cross-customer product rejected
    const other = await query<{ id: string }>(
      `SELECT id FROM products WHERE customer_uid <> ? LIMIT 1`,
      [CUSTOMER_UID],
    );
    if (other[0]) {
      let crossFailed = false;
      try {
        await createCustomerUpdateRequest({
          customerUid: CUSTOMER_UID,
          releaseId: RELEASE_ID,
          productIds: [other[0].id],
          requestedByUserId: null,
        });
      } catch (e) {
        crossFailed = (e as { code?: string })?.code === "CROSS_CUSTOMER_PRODUCT";
      }
      assert(crossFailed, "cross-customer rejected");
    }

    const review = await getReleaseUpdateReview({
      customerUid: CUSTOMER_UID,
      releaseId: RELEASE_ID,
    });
    assert(!!review, "review");
    const chroma = review!.products.find((p) => p.productId === PRODUCT_ID);
    assert(!!chroma, "chroma row");
    assert(chroma!.eligibility === "ELIGIBLE", `chroma eligible got ${chroma!.eligibility}`);
    assert(chroma!.proposed.viewer === TEMP_VIEWER_TARGET, "proposed viewer target");

    // Preview / request must not mutate pointers
    const mid = await safety();
    assert(JSON.stringify(mid.pointers) === JSON.stringify(before.pointers), "pointers after review");

    const request = await createCustomerUpdateRequest({
      customerUid: CUSTOMER_UID,
      releaseId: RELEASE_ID,
      productIds: [PRODUCT_ID],
      requestedByUserId: null,
      notes: "phase13 smoke",
    });
    requestId = request.id;
    assert(["REQUESTED", "AWAITING_APPROVAL"].includes(request.status), "requested status");

    const afterRequest = await safety();
    assert(
      JSON.stringify(afterRequest.pointers) === JSON.stringify(before.pointers),
      "pointers after request",
    );

    const approved = await approveCustomerUpdateRequest({
      requestId: request.id,
      adminId: 1,
    });
    assert(approved.status === "APPROVED", "approved");

    const afterApprove = await safety();
    assert(
      JSON.stringify(afterApprove.pointers) === JSON.stringify(before.pointers),
      "pointers after approve",
    );

    const prepared = await prepareRolloutFromCustomerUpdateRequest({
      requestId: request.id,
      adminId: 1,
      batchSize: 1,
      notes: "phase13 smoke prepare",
    });
    assert(prepared.request.status === "ROLLOUT_READY", "rollout ready");
    assert(!!prepared.rollout.id, "rollout id");
    rolloutId = prepared.rollout.id;
    migrationPlanId = prepared.rollout.migrationPlanId;

    // DO NOT run canary/batch — pointers must still match
    const afterPrepare = await safety();
    assert(
      JSON.stringify(afterPrepare.pointers) === JSON.stringify(before.pointers),
      "pointers after prepare",
    );
    assert(afterPrepare.qr === before.qr, "qr");
    assert(afterPrepare.subs === before.subs, "subs");
    assert(afterPrepare.publicId === before.publicId, "public_id");
    assert(afterPrepare.viewerSlug === before.viewerSlug, "viewer_slug");

    console.log("Phase 13 gateway path OK (request→approve→Phase9 prepare, no execution)");
  } finally {
    if (rolloutId) {
      await cancelCustomerRollout({ rolloutId, adminId: 1 }).catch(() => undefined);
    }
    if (requestId) {
      await query(`DELETE FROM ar360_customer_update_requests WHERE id = ?`, [requestId]);
    }
    if (migrationPlanId) {
      await query(`DELETE FROM ar360_migration_plan_products WHERE plan_id = ?`, [
        migrationPlanId,
      ]).catch(() => undefined);
      await query(`DELETE FROM ar360_migration_plans WHERE id = ?`, [migrationPlanId]).catch(
        () => undefined,
      );
    }
    if (rolloutId) {
      await query(`DELETE FROM ar360_customer_rollouts WHERE id = ?`, [rolloutId]).catch(
        () => undefined,
      );
    }
    await query(
      `UPDATE ar360_product_config_revisions SET platform_release_id = ? WHERE id = ?`,
      [priorTag[0]?.platform_release_id ?? null, TEMP_VIEWER_TARGET],
    );
    await setProductCanaryRuntime({ productId: PRODUCT_ID, enabled: false });
  }

  const after = await safety();
  assert(after.products === before.products, "products");
  assert(after.qr === before.qr, "QR");
  assert(after.subs === before.subs, "subs");
  assert(after.publicId === before.publicId, "public_id");
  assert(after.viewerSlug === before.viewerSlug, "viewer_slug");
  assert(after.legacySettings === before.legacySettings, "settings");
  assert(after.legacyMaterials === before.legacyMaterials, "material_settings");
  assert(JSON.stringify(after.pointers) === JSON.stringify(before.pointers), "pointers");
  assert(JSON.stringify(after.snap) === JSON.stringify(before.snap), "snap");
  assert(after.flagEnabled === before.flagEnabled, "flag");
  assert(after.targeting === before.targeting, "targeting");
  assert(after.stable === before.stable, "stable");

  console.log("Phase 13 CHROMA regression: PASS (restored, no mutations)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
