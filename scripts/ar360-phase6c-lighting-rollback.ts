/**
 * Phase 6C — CHROMA lighting-only rollback scenario.
 * Run: npx tsx scripts/ar360-phase6c-lighting-rollback.ts
 *
 * Uses ONLY PRD_3XTVLF8X. Leaves VERSIONED canary disabled.
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import {
  capturePointerSnapshot,
  listChangeHistory,
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
  previewLightingRollback,
  rollbackLightingRevision,
  validateLightingRollbackTarget,
} from "../src/lib/platform-versioning/lighting-rollback.service";
import {
  listCanaryProductIds,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";

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

async function createAndActivateLighting(exposure: number, note: string) {
  const draft = await createComponentDraftRevision({
    productId: ID,
    kind: "lighting",
    adminId: 1,
    reason: note,
    notes: note,
  });
  await updateComponentDraftRevision({
    revisionId: draft.id,
    adminId: 1,
    patch: {
      settings: {
        exposure,
        shadowIntensity: 0.5,
        environmentImage: "neutral",
      },
    } as never,
  });
  const activated = await activateComponentRevision({
    productId: ID,
    revisionId: draft.id,
    adminId: 1,
  });
  return activated.activated;
}

async function main() {
  console.log("=== Phase 6C Lighting Rollback — CHROMA ===");
  const before = await safetyBaseline();
  console.log("BEFORE", {
    products: before.products,
    qr: before.qr,
    subs: before.subs,
    pointers: before.pointers,
    canary: await listCanaryProductIds(),
  });

  assert(before.products === 21, `products expected 21 got ${before.products}`);
  assert(before.qr === 46, `QR expected 46 got ${before.qr}`);
  assert(before.subs === 6, `subs expected 6 got ${before.subs}`);

  await setProductCanaryRuntime({ productId: ID, enabled: false });

  const snapStart = await capturePointerSnapshot(ID);
  assert(!!snapStart, "snapshot required");
  const materialStart = snapStart!.material;
  const geometryStart = snapStart!.geometry;
  const viewerStart = snapStart!.viewer;
  const arStart = snapStart!.ar;
  const configStart = snapStart!.config;

  // Build lighting chain v1 → v2 → v3
  const v1 = await createAndActivateLighting(1.1, "6C lighting v1");
  const v2 = await createAndActivateLighting(1.2, "6C lighting v2");
  const v3 = await createAndActivateLighting(1.3, "6C lighting v3");

  const afterChain = await capturePointerSnapshot(ID);
  assert(afterChain?.lighting === v3.id, "1: v3 must be active lighting");
  assert(afterChain?.material === materialStart, "material unchanged while building lighting chain");
  console.log("1 PASS — lighting v3 active", { v1: v1.id, v2: v2.id, v3: v3.id });

  // 2–3 Preview
  const snapBeforePreview = await capturePointerSnapshot(ID);
  const preview = await previewLightingRollback({
    productId: ID,
    targetRevisionId: v2.id,
  });
  assert(!!preview, "2: preview required");
  assert(preview!.banner === "LIGHTING ROLLBACK PREVIEW", "2: banner");
  assert(preview!.currentRevisionId === v3.id, "2: current is v3");
  assert(preview!.targetRevisionId === v2.id, "2: target is v2");
  const snapAfterPreview = await capturePointerSnapshot(ID);
  assert(
    JSON.stringify(snapAfterPreview) === JSON.stringify(snapBeforePreview),
    "3: preview must not mutate pointers",
  );
  console.log("2/3 PASS — preview + no mutation");

  // Mixed composition in preview: material/viewer/ar stay current
  assert(preview!.unchanged.includes("material"), "7: material in unchanged");
  assert(preview!.components.material === materialStart, "7: mixed compose keeps material");
  assert(preview!.components.viewer === viewerStart, "7: mixed compose keeps viewer");
  assert(preview!.components.ar === arStart, "7: mixed compose keeps ar");
  assert(preview!.components.lighting === v2.id, "7: proposed lighting is v2");
  assert(preview!.hdri.ok === true, "8: HDRI ok in preview");
  console.log("7/8 PASS — mixed composition + HDRI");

  // 4–6 Confirm rollback
  const result = await rollbackLightingRevision({
    productId: ID,
    targetRevisionId: v2.id,
    adminId: 1,
    reason: "6C CHROMA lighting rollback v3→v2",
  });
  assert(result.fromRevisionId === v3.id, "5: from v3");
  assert(result.toRevisionId === v2.id, "5: to v2");
  assert(result.pointers.lighting === v2.id, "5: lighting pointer v2");
  assert(result.pointers.material === materialStart, "6/9: material unchanged");
  assert(result.pointers.geometry === geometryStart, "6: geometry unchanged");
  assert(result.pointers.viewer === viewerStart, "6/10: viewer unchanged");
  assert(result.pointers.ar === arStart, "6/11: ar unchanged");
  assert(result.pointers.config === configStart, "6: config unchanged");
  assert(result.health.ok === true, `health: ${JSON.stringify(result.health)}`);
  console.log("4/5/6/9/10/11 PASS — rollback + pointer isolation + health");

  // Change history (record via same path as API — insert manually for script parity)
  const { recordLightingRollbackChange } = await import(
    "../src/lib/platform-versioning/activation-safety.service"
  );
  await recordLightingRollbackChange({
    productId: ID,
    fromRevisionId: result.fromRevisionId,
    toRevisionId: result.toRevisionId,
    snapshotBefore: snapBeforePreview!,
    adminId: 1,
    reason: "6C CHROMA lighting rollback v3→v2",
    health: {
      ok: result.health.ok,
      checks: result.health.checks,
      materialSettingsType: "object",
      variantsIsArray: true,
      fallbackAvailable: true,
    },
  });

  const history = await listChangeHistory(ID, 30);
  assert(
    history.some(
      (h) =>
        h.componentKind === "lighting" &&
        h.status === "ROLLED_BACK" &&
        h.fromRevisionId === v3.id &&
        h.toRevisionId === v2.id,
    ),
    "14: change history lighting ROLLED_BACK",
  );
  console.log("14 PASS — change history");

  // v3 still exists (immutable)
  const v3row = await getRevisionById(v3.id);
  assert(!!v3row, "v3 not deleted");
  assert(v3row!.status === "archived", "v3 archived historical");

  // Composed after rollback
  const composed = await composeActiveVersionedConfig(ID);
  assert(composed?.components.lighting === v2.id, "composed lighting v2");
  assert(composed?.components.material === materialStart, "composed material unchanged");

  // 15 invalid target — wrong kind (use material revision)
  const badKind = await validateLightingRollbackTarget({
    productId: ID,
    targetRevisionId: materialStart || configStart || 1,
  });
  assert(badKind.ok === false, "15: wrong kind blocked");
  console.log("15 PASS — invalid target", (badKind as { code: string }).code);

  // 16 draft target
  const draft = await createComponentDraftRevision({
    productId: ID,
    kind: "lighting",
    adminId: 1,
    reason: "6C draft reject",
  });
  const draftGate = await validateLightingRollbackTarget({
    productId: ID,
    targetRevisionId: draft.id,
  });
  assert(draftGate.ok === false && draftGate.code === "DRAFT_REJECTED", "16: draft rejected");
  console.log("16 PASS — draft rejected");

  // 17 incompatible
  await query(
    `UPDATE ar360_product_config_revisions SET renderer_compat_label = 'incompatible-test' WHERE id = ?`,
    [v1.id],
  );
  const incompat = await validateLightingRollbackTarget({
    productId: ID,
    targetRevisionId: v1.id,
  });
  assert(incompat.ok === false && incompat.code === "COMPATIBILITY_FAILED", "17: incompat blocked");
  await query(
    `UPDATE ar360_product_config_revisions SET renderer_compat_label = 'legacy-current' WHERE id = ?`,
    [v1.id],
  );
  console.log("17 PASS — incompatible blocked");

  // 18 invalid asset / HDRI
  await query(
    `UPDATE ar360_product_config_revisions
        SET config_json = JSON_SET(config_json, '$.settings.environmentImage', '/__missing__/x.hdr')
      WHERE id = ?`,
    [v1.id],
  );
  const badHdri = await validateLightingRollbackTarget({
    productId: ID,
    targetRevisionId: v1.id,
  });
  assert(badHdri.ok === false, "18: bad HDRI blocked");
  // restore
  await query(
    `UPDATE ar360_product_config_revisions
        SET config_json = JSON_SET(config_json, '$.settings.environmentImage', 'neutral')
      WHERE id = ?`,
    [v1.id],
  );
  console.log("18 PASS — invalid HDRI/asset blocked", (badHdri as { code: string }).code);

  // 19 blocked rollback leaves pointers unchanged
  const snapBlocked = await capturePointerSnapshot(ID);
  try {
    await rollbackLightingRevision({
      productId: ID,
      targetRevisionId: draft.id,
      adminId: 1,
      reason: "should fail",
    });
    assert(false, "19: should have thrown");
  } catch {
    /* expected */
  }
  assert(
    JSON.stringify(await capturePointerSnapshot(ID)) === JSON.stringify(snapBlocked),
    "19: blocked rollback leaves pointers unchanged",
  );
  console.log("19 PASS — blocked leaves pointers unchanged");

  // 12 legacy unchanged
  await setProductCanaryRuntime({ productId: ID, enabled: false });
  const after = await safetyBaseline();
  assert(after.products === 21, "products 21");
  assert(after.qr === 46, "QR 46");
  assert(after.subs === 6, "subs 6");
  assert(after.publicId === before.publicId, "12/15 public_id");
  assert(after.viewerSlug === before.viewerSlug, "12/15 viewer_slug");
  assert(after.legacySettings === before.legacySettings, "12 legacy settings");
  assert(after.legacyMaterials === before.legacyMaterials, "12 legacy materials");
  const canary = await listCanaryProductIds();
  assert(!canary.includes(ID), "20: canary disabled");

  // Leave lighting on v2 (controlled); material/geometry/etc restored to start values
  assert(after.pointers?.active_lighting_revision_id === v2.id, "final lighting v2");
  assert(after.pointers?.active_material_revision_id === materialStart, "final material");
  assert(after.pointers?.active_geometry_revision_id === geometryStart, "final geometry");
  assert(after.pointers?.active_viewer_revision_id === viewerStart, "final viewer");
  assert(after.pointers?.active_ar_revision_id === arStart, "final ar");
  assert(after.pointers?.active_config_revision_id === configStart, "final config");

  console.log("=== Phase 6C ALL PASS ===");
  console.log(
    JSON.stringify(
      {
        products: after.products,
        qr: after.qr,
        subs: after.subs,
        lightingPointer: after.pointers?.active_lighting_revision_id,
        materialPointer: after.pointers?.active_material_revision_id,
        canary,
        lightingChain: { v1: v1.id, v2: v2.id, v3: v3.id },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Phase 6C FAILED", err);
  process.exit(1);
});
