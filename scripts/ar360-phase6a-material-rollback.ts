/**
 * Phase 6A — CHROMA material-only rollback scenario.
 * Run: npx tsx scripts/ar360-phase6a-material-rollback.ts
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import {
  activateComponentRevision,
  createComponentDraftRevision,
  getRevisionById,
  parseRevisionConfig,
  updateComponentDraftRevision,
} from "../src/lib/platform-versioning/component-revisions.service";
import {
  listMaterialRollbackTargets,
  previewMaterialRollback,
  rollbackMaterialRevision,
  validateMaterialRollbackTarget,
} from "../src/lib/platform-versioning/material-rollback.service";
import {
  listCanaryProductIds,
  resolveRuntimeModeForProduct,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";
import { getLegacyProductRow } from "../src/lib/platform-versioning/product-config-resolver";
import { applyControlledRuntimeToProduct } from "../src/lib/platform-versioning/apply-versioned-runtime";
import { composeActiveVersionedConfig } from "../src/lib/platform-versioning/component-revisions.service";

loadEnvConfig(process.cwd());

const ID = "PRD_3XTVLF8X";
const OTHER = "PRD_3LRQT9GF";

async function safety() {
  const [counts, qr, subs, product, pointers, flag] = await Promise.all([
    query<{ products: number }>(`SELECT COUNT(*) AS products FROM products`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM product_qr_codes`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM customer_subscriptions`),
    query<{
      public_id: string | null;
      viewer_slug: string | null;
      settings: unknown;
      material_settings: unknown;
    }>(`SELECT public_id, viewer_slug, settings, material_settings FROM products WHERE id = ?`, [ID]),
    query<{
      active_config_revision_id: number | null;
      active_material_revision_id: number | null;
      active_lighting_revision_id: number | null;
      active_viewer_revision_id: number | null;
      active_ar_revision_id: number | null;
      active_geometry_revision_id: number | null;
    }>(
      `SELECT active_config_revision_id, active_material_revision_id, active_lighting_revision_id,
              active_viewer_revision_id, active_ar_revision_id, active_geometry_revision_id
         FROM products WHERE id = ?`,
      [ID],
    ),
    query<{ enabled: number; targeting: unknown }>(
      `SELECT enabled, targeting FROM ar360_feature_flags WHERE flag_key = 'versioned_runtime' LIMIT 1`,
    ),
  ]);
  return {
    products: Number(counts[0]?.products || 0),
    qr: Number(qr[0]?.c || 0),
    subs: Number(subs[0]?.c || 0),
    publicId: product[0]?.public_id ?? null,
    viewerSlug: product[0]?.viewer_slug ?? null,
    legacySettings: product[0]?.settings ?? null,
    legacyMaterials: product[0]?.material_settings ?? null,
    pointers: pointers[0] ?? null,
    flagEnabled: Boolean(flag[0]?.enabled),
    targeting: flag[0]?.targeting ?? null,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function createAndActivateMaterial(renderOrder: number, note: string) {
  const draft = await createComponentDraftRevision({
    productId: ID,
    kind: "material",
    adminId: 1,
    reason: note,
    notes: note,
  });
  const row = await getRevisionById(draft.id);
  const cfg = parseRevisionConfig(row!);
  const mat0 = {
    ...((cfg.materialSettings as Record<string, Record<string, unknown>>)?.["0"] || {}),
    renderOrder,
  };
  await updateComponentDraftRevision({
    revisionId: draft.id,
    adminId: 1,
    patch: {
      materialSettings: {
        ...((cfg.materialSettings as object) || {}),
        "0": mat0,
      },
    },
  });
  const activated = await activateComponentRevision({
    productId: ID,
    revisionId: draft.id,
    adminId: 1,
  });
  return activated.activated;
}

async function main() {
  const before = await safety();
  const nonMaterialBefore = {
    geometry: Number(before.pointers?.active_geometry_revision_id || 0),
    lighting: Number(before.pointers?.active_lighting_revision_id || 0),
    viewer: Number(before.pointers?.active_viewer_revision_id || 0),
    ar: Number(before.pointers?.active_ar_revision_id || 0),
    config: Number(before.pointers?.active_config_revision_id || 0),
  };

  // Build Material v1→v2→v3 chain with harmless renderOrder only
  const v1 = await createAndActivateMaterial(11, "Phase6A material v1");
  const v2 = await createAndActivateMaterial(22, "Phase6A material v2");
  const v3 = await createAndActivateMaterial(33, "Phase6A material v3");

  const atV3 = await safety();
  assert(Number(atV3.pointers?.active_material_revision_id) === v3.id, "material = v3");
  assert(Number(atV3.pointers?.active_geometry_revision_id) === nonMaterialBefore.geometry, "geometry unchanged");
  assert(Number(atV3.pointers?.active_lighting_revision_id) === nonMaterialBefore.lighting, "lighting unchanged");
  assert(Number(atV3.pointers?.active_viewer_revision_id) === nonMaterialBefore.viewer, "viewer unchanged");
  assert(Number(atV3.pointers?.active_ar_revision_id) === nonMaterialBefore.ar, "ar unchanged");
  assert(Number(atV3.pointers?.active_config_revision_id) === nonMaterialBefore.config, "config unchanged");

  // Snapshot immutable bodies
  const v3Before = await getRevisionById(v3.id);
  const v2Before = await getRevisionById(v2.id);
  const v3Body = JSON.stringify(v3Before?.config_json);
  const v2Body = JSON.stringify(v2Before?.config_json);

  // Preview does not change pointer
  const preview = await previewMaterialRollback({ productId: ID, targetRevisionId: v2.id });
  assert(!!preview, "preview ok");
  assert(preview!.rollbackPreview === true, "rollback preview banner");
  assert(preview!.banner === "ROLLBACK PREVIEW", "banner");
  const mid = await safety();
  assert(Number(mid.pointers?.active_material_revision_id) === v3.id, "preview must not change pointer");

  // Invalid: draft rejected
  const draft = await createComponentDraftRevision({
    productId: ID,
    kind: "material",
    adminId: 1,
    reason: "invalid rollback draft",
  });
  const draftReject = await validateMaterialRollbackTarget({
    productId: ID,
    targetRevisionId: draft.id,
  });
  assert(draftReject.ok === false && draftReject.code === "DRAFT_REJECTED", "draft rejected");

  // Invalid: already current
  const currentReject = await validateMaterialRollbackTarget({
    productId: ID,
    targetRevisionId: v3.id,
  });
  assert(currentReject.ok === false && currentReject.code === "ALREADY_CURRENT", "current rejected");

  // Invalid: wrong product (use other product's revision if any)
  const otherRow = await getLegacyProductRow(OTHER);
  const otherMat = Number(otherRow?.active_material_revision_id || 0);
  if (otherMat > 0) {
    const wrong = await validateMaterialRollbackTarget({
      productId: ID,
      targetRevisionId: otherMat,
    });
    assert(wrong.ok === false && wrong.code === "PRODUCT_MISMATCH", "wrong product rejected");
  }

  // Pointers unchanged after failed validations
  const afterFail = await safety();
  assert(Number(afterFail.pointers?.active_material_revision_id) === v3.id, "still v3 after rejects");

  // Execute rollback v3 → v2
  const result = await rollbackMaterialRevision({
    productId: ID,
    targetRevisionId: v2.id,
    adminId: 1,
    reason: "Phase 6A CHROMA material rollback test",
  });
  assert(result.fromRevisionId === v3.id, "from v3");
  assert(result.toRevisionId === v2.id, "to v2");
  assert(result.pointers.material === v2.id, "pointer material v2");
  assert(result.pointers.geometry === nonMaterialBefore.geometry, "geometry pointer");
  assert(result.pointers.lighting === nonMaterialBefore.lighting, "lighting pointer");
  assert(result.pointers.viewer === nonMaterialBefore.viewer, "viewer pointer");
  assert(result.pointers.ar === nonMaterialBefore.ar, "ar pointer");
  assert(result.pointers.config === nonMaterialBefore.config, "config pointer");

  const after = await safety();
  assert(Number(after.pointers?.active_material_revision_id) === v2.id, "DB material = v2");
  assert(Number(after.pointers?.active_geometry_revision_id) === nonMaterialBefore.geometry, "DB geometry");
  assert(Number(after.pointers?.active_lighting_revision_id) === nonMaterialBefore.lighting, "DB lighting");
  assert(Number(after.pointers?.active_viewer_revision_id) === nonMaterialBefore.viewer, "DB viewer");
  assert(Number(after.pointers?.active_ar_revision_id) === nonMaterialBefore.ar, "DB ar");
  assert(Number(after.pointers?.active_config_revision_id) === nonMaterialBefore.config, "DB config");

  // Historical v3 remains (archived, not deleted)
  const v3After = await getRevisionById(v3.id);
  assert(!!v3After, "v3 still exists");
  assert(v3After!.status === "archived", "v3 archived");
  assert(JSON.stringify(v3After!.config_json) === v3Body, "v3 immutable");
  const v2After = await getRevisionById(v2.id);
  assert(v2After!.status === "active", "v2 active");
  assert(JSON.stringify(v2After!.config_json) === v2Body, "v2 immutable");

  // Mixed-version composition: material v2 + current other components
  const composed = await composeActiveVersionedConfig(ID);
  assert(!!composed, "composed");
  assert(composed!.components.material === v2.id, "composed material id");
  assert(composed!.components.geometry === nonMaterialBefore.geometry || composed!.components.geometry === null || composed!.components.geometry === nonMaterialBefore.geometry, "composed geometry");
  const mat0 = (composed!.config.materialSettings as Record<string, { renderOrder: number }>)?.["0"];
  assert(mat0?.renderOrder === 22, `mixed compose renderOrder expected 22 got ${mat0?.renderOrder}`);

  // VERSIONED canary uses rollback target
  await setProductCanaryRuntime({ productId: ID, enabled: true });
  assert((await resolveRuntimeModeForProduct(ID)).mode === "versioned", "canary on");
  const row = await getLegacyProductRow(ID);
  const applied = await applyControlledRuntimeToProduct({
    id: ID,
    productUid: ID,
    settings: {},
    materialSettings: {},
    variants: [],
    modelUrl: row?.model_url,
  });
  assert(applied.diagnostics.mode === "versioned", "versioned apply");
  assert(typeof applied.product.materialSettings === "object", "materialSettings object (5A)");
  assert(Array.isArray(applied.product.variants), "variants array (5A)");
  const runtimeMat = applied.product.materialSettings as Record<string, { renderOrder: number }>;
  assert(runtimeMat?.["0"]?.renderOrder === 22, "runtime uses rolled-back material");

  // Other product LEGACY
  assert((await resolveRuntimeModeForProduct(OTHER)).mode === "legacy", "other legacy");

  // Disable canary
  await setProductCanaryRuntime({ productId: ID, enabled: false });
  for (const id of await listCanaryProductIds()) {
    await setProductCanaryRuntime({ productId: id, enabled: false });
  }
  assert((await listCanaryProductIds()).length === 0, "canary empty");
  assert((await resolveRuntimeModeForProduct(ID)).mode === "legacy", "default LEGACY");

  const final = await safety();
  assert(JSON.stringify(final.legacySettings) === JSON.stringify(before.legacySettings), "legacy settings");
  assert(JSON.stringify(final.legacyMaterials) === JSON.stringify(before.legacyMaterials), "legacy materials");
  assert(final.products === 21 && final.qr === 46 && final.subs === 6, "counts");
  assert(final.publicId === before.publicId && final.viewerSlug === before.viewerSlug, "identity");

  const targets = await listMaterialRollbackTargets(ID);

  console.log(
    JSON.stringify(
      {
        product: "CHROMA",
        productId: ID,
        chain: { v1: v1.id, v2: v2.id, v3: v3.id },
        rollback: { from: v3.id, to: v2.id },
        pointersAfter: final.pointers,
        mixedComposeRenderOrder: mat0?.renderOrder,
        canary: "DISABLED after test",
        eligibleTargets: targets.targets.filter((t) => t.eligible).map((t) => t.id),
        db: { products: final.products, qr: final.qr, subs: final.subs, legacyUnchanged: true },
        result: "PASS",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
