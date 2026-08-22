/**
 * Phase 6D — CHROMA viewer-only + AR-only rollback.
 * Run: npx tsx scripts/ar360-phase6d-viewer-ar-rollback.ts
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import {
  capturePointerSnapshot,
  listChangeHistory,
  recordArRollbackChange,
  recordViewerRollbackChange,
} from "../src/lib/platform-versioning/activation-safety.service";
import {
  activateComponentRevision,
  composeActiveVersionedConfig,
  createComponentDraftRevision,
  getRevisionById,
  parseRevisionConfig,
  updateComponentDraftRevision,
} from "../src/lib/platform-versioning/component-revisions.service";
import {
  previewArRollback,
  rollbackArRevision,
  validateArRollbackTarget,
} from "../src/lib/platform-versioning/ar-rollback.service";
import {
  previewViewerRollback,
  rollbackViewerRevision,
  validateViewerRollbackTarget,
} from "../src/lib/platform-versioning/viewer-rollback.service";
import {
  listCanaryProductIds,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";
import { AR360_LEGACY_COMPAT_LABEL } from "../src/lib/platform-versioning/foundation";

loadEnvConfig(process.cwd());

const ID = "PRD_3XTVLF8X";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function safetyBaseline() {
  const [counts, qr, subs, product, pointers] = await Promise.all([
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
  ]);
  return {
    products: Number(counts[0]?.products || 0),
    qr: Number(qr[0]?.c || 0),
    subs: Number(subs[0]?.c || 0),
    publicId: product[0]?.public_id ?? null,
    viewerSlug: product[0]?.viewer_slug ?? null,
    legacySettings: JSON.stringify(product[0]?.settings ?? null),
    legacyMaterials: JSON.stringify(product[0]?.material_settings ?? null),
    pointers: pointers[0] ?? null,
  };
}

async function createAndActivate(
  kind: "viewer" | "ar",
  patch: Record<string, unknown>,
  note: string,
) {
  const draft = await createComponentDraftRevision({
    productId: ID,
    kind,
    adminId: 1,
    reason: note,
    notes: note,
  });
  await updateComponentDraftRevision({
    revisionId: draft.id,
    adminId: 1,
    patch: { settings: patch } as never,
  });
  const activated = await activateComponentRevision({
    productId: ID,
    revisionId: draft.id,
    adminId: 1,
  });
  return activated.activated;
}

async function runFailureSuite(
  kind: "viewer" | "ar",
  validate: typeof validateViewerRollbackTarget,
  currentPeerId: number,
  historicalId: number,
) {
  const snap = await capturePointerSnapshot(ID);

  const wrong = await validate({ productId: ID, targetRevisionId: currentPeerId });
  assert(wrong.ok === false, `${kind}: wrong kind blocked`);

  const draft = await createComponentDraftRevision({
    productId: ID,
    kind,
    adminId: 1,
    reason: `6D ${kind} draft reject`,
  });
  const draftGate = await validate({ productId: ID, targetRevisionId: draft.id });
  assert(draftGate.ok === false && draftGate.code === "DRAFT_REJECTED", `${kind}: draft`);

  const currentId =
    kind === "viewer" ? snap!.viewer! : snap!.ar!;
  const currentGate = await validate({ productId: ID, targetRevisionId: currentId });
  assert(currentGate.ok === false && currentGate.code === "ALREADY_CURRENT", `${kind}: current`);

  await query(
    `UPDATE ar360_product_config_revisions SET renderer_compat_label = 'incompatible-test' WHERE id = ?`,
    [historicalId],
  );
  const incompat = await validate({ productId: ID, targetRevisionId: historicalId });
  assert(incompat.ok === false && incompat.code === "COMPATIBILITY_FAILED", `${kind}: incompat`);
  await query(
    `UPDATE ar360_product_config_revisions SET renderer_compat_label = ? WHERE id = ?`,
    [AR360_LEGACY_COMPAT_LABEL, historicalId],
  );

  if (kind === "viewer") {
    await query(
      `UPDATE ar360_product_config_revisions
          SET config_json = JSON_SET(config_json, '$.settings.backgroundColor', '/__missing__/x.png')
        WHERE id = ?`,
      [historicalId],
    );
  } else {
    await query(
      `UPDATE ar360_product_config_revisions
          SET config_json = JSON_SET(config_json, '$.settings.arModelUrl', '/__missing__/x.glb')
        WHERE id = ?`,
      [historicalId],
    );
  }
  const badAsset = await validate({ productId: ID, targetRevisionId: historicalId });
  assert(badAsset.ok === false, `${kind}: invalid asset/config`);
  if (kind === "viewer") {
    assert(
      badAsset.ok === false && badAsset.code === "VIEWER_VALIDATION_FAILED",
      `${kind}: VIEWER_VALIDATION_FAILED`,
    );
    await query(
      `UPDATE ar360_product_config_revisions
          SET config_json = JSON_SET(config_json, '$.settings.backgroundColor', '#ffffff')
        WHERE id = ?`,
      [historicalId],
    );
  } else {
    assert(
      badAsset.ok === false && badAsset.code === "AR_VALIDATION_FAILED",
      `${kind}: AR_VALIDATION_FAILED`,
    );
    await query(
      `UPDATE ar360_product_config_revisions
          SET config_json = JSON_REMOVE(config_json, '$.settings.arModelUrl')
        WHERE id = ?`,
      [historicalId],
    );
  }

  await query(
    `UPDATE ar360_product_config_revisions
        SET config_json = JSON_SET(config_json, '$.materialSettings', 42)
      WHERE id = ?`,
    [historicalId],
  );
  const badJson = await validate({ productId: ID, targetRevisionId: historicalId });
  assert(badJson.ok === false, `${kind}: invalid JSON`);

  const afterBadJson = await getRevisionById(historicalId);
  assert(!!afterBadJson, "revision after bad json");
  const restoredCfg = {
    ...parseRevisionConfig(afterBadJson!),
    materialSettings: {},
  } as Record<string, unknown>;
  await query(`UPDATE ar360_product_config_revisions SET config_json = ? WHERE id = ?`, [
    JSON.stringify(restoredCfg),
    historicalId,
  ]);

  const depCfg = {
    ...parseRevisionConfig((await getRevisionById(historicalId))!),
    dependencies: { geometry: { minComponentRevisionNumber: 9999 } },
  };
  await query(`UPDATE ar360_product_config_revisions SET config_json = ? WHERE id = ?`, [
    JSON.stringify(depCfg),
    historicalId,
  ]);
  const dep = await validate({ productId: ID, targetRevisionId: historicalId });
  assert(dep.ok === false && dep.code === "DEPENDENCY_CONFLICT", `${kind}: dependency`);

  const cleared = {
    ...parseRevisionConfig((await getRevisionById(historicalId))!),
  } as Record<string, unknown>;
  delete cleared.dependencies;
  await query(`UPDATE ar360_product_config_revisions SET config_json = ? WHERE id = ?`, [
    JSON.stringify(cleared),
    historicalId,
  ]);

  assert(
    JSON.stringify(await capturePointerSnapshot(ID)) === JSON.stringify(snap),
    `${kind}: failure suite left pointers unchanged`,
  );
}

async function main() {
  console.log("=== Phase 6D Viewer + AR Rollback — CHROMA ===");
  const before = await safetyBaseline();
  assert(before.products === 21, "products 21");
  assert(before.qr === 46, "QR 46");
  assert(before.subs === 6, "subs 6");
  await setProductCanaryRuntime({ productId: ID, enabled: false });

  const start = await capturePointerSnapshot(ID);
  assert(!!start, "snapshot");
  const materialStart = start!.material;
  const lightingStart = start!.lighting;
  const geometryStart = start!.geometry;
  const configStart = start!.config;
  const arStartBeforeViewer = start!.ar;

  // --- Viewer chain ---
  const vv1 = await createAndActivate(
    "viewer",
    { cameraOrbit: "0deg 75deg 100%", autoRotate: false },
    "6D viewer v1",
  );
  const vv2 = await createAndActivate(
    "viewer",
    { cameraOrbit: "10deg 70deg 105%", autoRotate: true },
    "6D viewer v2",
  );
  const vv3 = await createAndActivate(
    "viewer",
    { cameraOrbit: "20deg 65deg 110%", fov: "45deg" },
    "6D viewer v3",
  );
  assert((await capturePointerSnapshot(ID))?.viewer === vv3.id, "viewer v3 active");

  const snapBeforeViewerPreview = await capturePointerSnapshot(ID);
  const vPreview = await previewViewerRollback({ productId: ID, targetRevisionId: vv2.id });
  assert(!!vPreview && vPreview.banner === "VIEWER ROLLBACK PREVIEW", "viewer preview banner");
  assert(
    JSON.stringify(await capturePointerSnapshot(ID)) === JSON.stringify(snapBeforeViewerPreview),
    "viewer preview no mutation",
  );
  assert(vPreview!.components.material === materialStart, "viewer mixed: material");
  assert(vPreview!.components.lighting === lightingStart, "viewer mixed: lighting");
  assert(vPreview!.components.ar === arStartBeforeViewer || vPreview!.components.ar === start!.ar, "viewer mixed: ar");
  assert(vPreview!.components.viewer === vv2.id, "viewer proposed v2");

  const vResult = await rollbackViewerRevision({
    productId: ID,
    targetRevisionId: vv2.id,
    adminId: 1,
    reason: "6D viewer v3→v2",
  });
  assert(vResult.fromRevisionId === vv3.id && vResult.toRevisionId === vv2.id, "viewer rollback ids");
  assert(vResult.pointers.viewer === vv2.id, "viewer pointer");
  assert(vResult.pointers.material === materialStart, "viewer: material unchanged");
  assert(vResult.pointers.lighting === lightingStart, "viewer: lighting unchanged");
  assert(vResult.pointers.geometry === geometryStart, "viewer: geometry unchanged");
  assert(vResult.pointers.config === configStart, "viewer: config unchanged");
  assert(vResult.pointers.ar === arStartBeforeViewer, "viewer: AR unchanged");
  assert(vResult.health.ok, `viewer health ${JSON.stringify(vResult.health)}`);

  await recordViewerRollbackChange({
    productId: ID,
    fromRevisionId: vResult.fromRevisionId,
    toRevisionId: vResult.toRevisionId,
    snapshotBefore: snapBeforeViewerPreview!,
    adminId: 1,
    reason: "6D viewer v3→v2",
    health: {
      ok: true,
      checks: vResult.health.checks,
      materialSettingsType: "object",
      variantsIsArray: true,
      fallbackAvailable: true,
    },
  });

  await runFailureSuite("viewer", validateViewerRollbackTarget, materialStart || 36, vv1.id);
  console.log("VIEWER PASS");

  // --- AR chain (viewer stays on vv2) ---
  const afterViewer = await capturePointerSnapshot(ID);
  const viewerPinned = afterViewer!.viewer;
  const arV1 = await createAndActivate(
    "ar",
    { showArButton: true, arPlacement: "floor" },
    "6D ar v1",
  );
  const arV2 = await createAndActivate(
    "ar",
    { showArButton: true, arPlacement: "wall", realScale: true },
    "6D ar v2",
  );
  const arV3 = await createAndActivate(
    "ar",
    { showArButton: false, arPlacement: "floor" },
    "6D ar v3",
  );
  assert((await capturePointerSnapshot(ID))?.ar === arV3.id, "ar v3 active");
  assert((await capturePointerSnapshot(ID))?.viewer === viewerPinned, "viewer unchanged during AR chain");

  const snapBeforeArPreview = await capturePointerSnapshot(ID);
  const aPreview = await previewArRollback({ productId: ID, targetRevisionId: arV2.id });
  assert(!!aPreview && aPreview.banner === "AR ROLLBACK PREVIEW", "ar preview banner");
  assert(
    JSON.stringify(await capturePointerSnapshot(ID)) === JSON.stringify(snapBeforeArPreview),
    "ar preview no mutation",
  );
  assert(aPreview!.components.viewer === viewerPinned, "ar mixed: viewer current");
  assert(aPreview!.components.material === materialStart, "ar mixed: material");
  assert(aPreview!.components.ar === arV2.id, "ar proposed v2");

  const aResult = await rollbackArRevision({
    productId: ID,
    targetRevisionId: arV2.id,
    adminId: 1,
    reason: "6D ar v3→v2",
  });
  assert(aResult.fromRevisionId === arV3.id && aResult.toRevisionId === arV2.id, "ar rollback ids");
  assert(aResult.pointers.ar === arV2.id, "ar pointer");
  assert(aResult.pointers.viewer === viewerPinned, "ar: viewer unchanged");
  assert(aResult.pointers.material === materialStart, "ar: material unchanged");
  assert(aResult.pointers.lighting === lightingStart, "ar: lighting unchanged");
  assert(aResult.pointers.geometry === geometryStart, "ar: geometry unchanged");
  assert(aResult.pointers.config === configStart, "ar: config unchanged");
  assert(aResult.health.ok, `ar health ${JSON.stringify(aResult.health)}`);

  await recordArRollbackChange({
    productId: ID,
    fromRevisionId: aResult.fromRevisionId,
    toRevisionId: aResult.toRevisionId,
    snapshotBefore: snapBeforeArPreview!,
    adminId: 1,
    reason: "6D ar v3→v2",
    health: {
      ok: true,
      checks: aResult.health.checks,
      materialSettingsType: "object",
      variantsIsArray: true,
      fallbackAvailable: true,
    },
  });

  await runFailureSuite("ar", validateArRollbackTarget, viewerPinned || vv2.id, arV1.id);

  // blocked rollback leaves pointers
  const snapBlocked = await capturePointerSnapshot(ID);
  try {
    await rollbackArRevision({
      productId: ID,
      targetRevisionId: (
        await createComponentDraftRevision({
          productId: ID,
          kind: "ar",
          adminId: 1,
          reason: "block",
        })
      ).id,
      adminId: 1,
    });
    assert(false, "should throw");
  } catch {
    /* expected */
  }
  assert(
    JSON.stringify(await capturePointerSnapshot(ID)) === JSON.stringify(snapBlocked),
    "blocked ar rollback unchanged",
  );

  const composed = await composeActiveVersionedConfig(ID);
  assert(composed?.components.viewer === viewerPinned, "composed viewer");
  assert(composed?.components.ar === arV2.id, "composed ar");

  const history = await listChangeHistory(ID, 40);
  assert(
    history.some((h) => h.componentKind === "viewer" && h.status === "ROLLED_BACK"),
    "history viewer",
  );
  assert(
    history.some((h) => h.componentKind === "ar" && h.status === "ROLLED_BACK"),
    "history ar",
  );
  assert(!!(await getRevisionById(vv3.id)), "viewer v3 retained");
  assert(!!(await getRevisionById(arV3.id)), "ar v3 retained");

  await setProductCanaryRuntime({ productId: ID, enabled: false });
  const after = await safetyBaseline();
  assert(after.products === 21 && after.qr === 46 && after.subs === 6, "counts");
  assert(after.publicId === before.publicId && after.viewerSlug === before.viewerSlug, "ids");
  assert(after.legacySettings === before.legacySettings, "legacy settings");
  assert(after.legacyMaterials === before.legacyMaterials, "legacy materials");
  assert(!(await listCanaryProductIds()).includes(ID), "canary off");

  console.log("=== Phase 6D ALL PASS ===");
  console.log(
    JSON.stringify(
      {
        viewer: { v1: vv1.id, v2: vv2.id, v3: vv3.id, active: viewerPinned },
        ar: { v1: arV1.id, v2: arV2.id, v3: arV3.id, active: arV2.id },
        material: materialStart,
        lighting: lightingStart,
        canary: await listCanaryProductIds(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Phase 6D FAILED", err);
  process.exit(1);
});
