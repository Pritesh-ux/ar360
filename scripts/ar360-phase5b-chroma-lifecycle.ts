/**
 * Phase 5B — CHROMA controlled component revision lifecycle scenario.
 * Does NOT enable global canary permanently; disables canary at end.
 * Run: npx tsx scripts/ar360-phase5b-chroma-lifecycle.ts
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import {
  activateComponentRevision,
  archiveComponentRevision,
  composeDraftPreviewConfig,
  createComponentDraftRevision,
  diffComponentRevisions,
  getRevisionById,
  listComponentRevisions,
  parseRevisionConfig,
  updateComponentDraftRevision,
  validateRevisionForActivation,
} from "../src/lib/platform-versioning/component-revisions.service";
import {
  listCanaryProductIds,
  resolveRuntimeModeForProduct,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";
import { getLegacyProductRow } from "../src/lib/platform-versioning/product-config-resolver";
import { applyControlledRuntimeToProduct } from "../src/lib/platform-versioning/apply-versioned-runtime";

loadEnvConfig(process.cwd());

const ID = "PRD_3XTVLF8X";
const OTHER = "PRD_3LRQT9GF";

async function safety() {
  const [counts, qr, subs, product, pointers] = await Promise.all([
    query<{ products: number }>(`SELECT COUNT(*) AS products FROM products`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM product_qr_codes`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM customer_subscriptions`),
    query<{ public_id: string | null; viewer_slug: string | null; settings: unknown; material_settings: unknown }>(
      `SELECT public_id, viewer_slug, settings, material_settings FROM products WHERE id = ?`,
      [ID],
    ),
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
    legacySettings: product[0]?.settings ?? null,
    legacyMaterials: product[0]?.material_settings ?? null,
    pointers: pointers[0] ?? null,
  };
}

async function main() {
  const before = await safety();
  const beforePointers = { ...before.pointers };
  const foundationMaterialId = Number(before.pointers?.active_material_revision_id || 0);
  const foundationConfig = await getRevisionById(foundationMaterialId);
  if (!foundationConfig) throw new Error("Missing foundation material pointer revision");

  // Archive leftover material drafts from prior failed runs (never touch active pointers).
  const existing = await listComponentRevisions({ productId: ID, kind: "material" });
  for (const rev of existing) {
    if (rev.status === "draft" && rev.componentKind === "material") {
      await archiveComponentRevision({ revisionId: rev.id, adminId: 1 });
    }
  }

  // 1-2 create material draft
  const draft = await createComponentDraftRevision({
    productId: ID,
    kind: "material",
    adminId: 1,
    reason: "Phase 5B CHROMA lifecycle test",
    notes: "harmless renderOrder test",
  });
  assert(draft.status === "draft", "draft status");
  assert(
    Number(draft.componentRevisionNumber) >= 2,
    `expected material draft v>=2 got ${draft.componentRevisionNumber}`,
  );

  // 3 change harmless property on draft only
  const parentConfig = parseRevisionConfig(foundationConfig);
  const parentMat0 = (parentConfig.materialSettings as Record<string, Record<string, unknown>>)?.["0"] || {};
  const draftBeforeEdit = await getRevisionById(draft.id);
  const draftConfigBefore = parseRevisionConfig(draftBeforeEdit!);
  const mat0 = {
    ...((draftConfigBefore.materialSettings as Record<string, Record<string, unknown>>)?.["0"] || {}),
    renderOrder: Number(parentMat0.renderOrder || 0) === 1 ? 2 : 1,
  };
  await updateComponentDraftRevision({
    revisionId: draft.id,
    adminId: 1,
    patch: {
      materialSettings: {
        ...((draftConfigBefore.materialSettings as object) || {}),
        "0": mat0,
      },
    },
  });

  // 4 verify v1 / foundation unchanged
  const foundationAfter = await getRevisionById(foundationMaterialId);
  assert(
    JSON.stringify(foundationAfter?.config_json) === JSON.stringify(foundationConfig.config_json),
    "foundation revision body must stay immutable",
  );

  // 5-6 preview draft (isolated)
  const preview = await composeDraftPreviewConfig({ productId: ID, draftRevisionId: draft.id });
  assert(!!preview, "preview composed");
  const previewMat0 = (preview!.config.materialSettings as Record<string, { renderOrder: number }>)["0"];
  assert(previewMat0.renderOrder === mat0.renderOrder, "preview uses draft renderOrder");

  // 7 production pointer still v1 foundation
  const mid = await safety();
  assert(
    Number(mid.pointers?.active_material_revision_id) === foundationMaterialId,
    "preview must not change active_material_revision_id",
  );

  // Diff
  const draftRow = await getRevisionById(draft.id);
  const diff = diffComponentRevisions(foundationConfig, draftRow!);
  assert(diff.match === false, "diff should show change");

  // Enable canary briefly to verify VERSIONED still works with composed config
  await setProductCanaryRuntime({ productId: ID, enabled: true });
  const selection = await resolveRuntimeModeForProduct(ID);
  assert(selection.mode === "versioned", "canary versioned");
  const row = await getLegacyProductRow(ID);
  const applied = await applyControlledRuntimeToProduct({
    id: ID,
    productUid: ID,
    settings: {},
    materialSettings: {},
    variants: [],
    modelUrl: row?.model_url,
  });
  assert(applied.diagnostics.mode === "versioned", "versioned apply ok before activate");

  // 8-9 activate
  const validation = await validateRevisionForActivation({ productId: ID, revisionId: draft.id });
  assert(validation.ok === true, "activation validation");
  const activated = await activateComponentRevision({
    productId: ID,
    revisionId: draft.id,
    adminId: 1,
  });
  assert(activated.activated.status === "active", "activated status");
  assert(activated.activated.id === draft.id, "activated id");

  const afterActivate = await safety();
  assert(
    Number(afterActivate.pointers?.active_material_revision_id) === draft.id,
    "material pointer → v2",
  );
  // 10-13 other pointers unchanged
  assert(
    Number(afterActivate.pointers?.active_geometry_revision_id) ===
      Number(beforePointers?.active_geometry_revision_id),
    "geometry pointer unchanged",
  );
  assert(
    Number(afterActivate.pointers?.active_lighting_revision_id) ===
      Number(beforePointers?.active_lighting_revision_id),
    "lighting pointer unchanged",
  );
  assert(
    Number(afterActivate.pointers?.active_viewer_revision_id) ===
      Number(beforePointers?.active_viewer_revision_id),
    "viewer pointer unchanged",
  );
  assert(
    Number(afterActivate.pointers?.active_ar_revision_id) ===
      Number(beforePointers?.active_ar_revision_id),
    "ar pointer unchanged",
  );
  assert(
    Number(afterActivate.pointers?.active_config_revision_id) ===
      Number(beforePointers?.active_config_revision_id),
    "config pointer unchanged",
  );

  // VERSIONED still works after activation
  const applied2 = await applyControlledRuntimeToProduct({
    id: ID,
    productUid: ID,
    settings: {},
    materialSettings: {},
    variants: [],
    modelUrl: row?.model_url,
  });
  assert(applied2.diagnostics.mode === "versioned", "versioned after activate");
  const runtimeMat = applied2.product.materialSettings as Record<string, { renderOrder: number }>;
  assert(runtimeMat?.["0"]?.renderOrder === mat0.renderOrder, "composed material renderOrder");

  // 14 other products unchanged
  const other = await getLegacyProductRow(OTHER);
  const otherSelection = await resolveRuntimeModeForProduct(OTHER);
  assert(otherSelection.mode === "legacy", "other product remains LEGACY");

  // Active cannot be edited
  let editBlocked = false;
  try {
    await updateComponentDraftRevision({
      revisionId: draft.id,
      adminId: 1,
      patch: { materialSettings: { "0": { renderOrder: 99 } } },
    });
  } catch {
    editBlocked = true;
  }
  assert(editBlocked, "active revision cannot be edited");

  // 15 disable canary
  await setProductCanaryRuntime({ productId: ID, enabled: false });
  for (const id of await listCanaryProductIds()) {
    await setProductCanaryRuntime({ productId: id, enabled: false });
  }
  const finalSelection = await resolveRuntimeModeForProduct(ID);
  assert(finalSelection.mode === "legacy", "default runtime LEGACY after disable");
  assert((await listCanaryProductIds()).length === 0, "canary empty");

  const after = await safety();
  assert(JSON.stringify(after.legacySettings) === JSON.stringify(before.legacySettings), "legacy settings unchanged");
  assert(JSON.stringify(after.legacyMaterials) === JSON.stringify(before.legacyMaterials), "legacy materials unchanged");
  assert(after.products === before.products && after.products === 21, "products count");
  assert(after.qr === before.qr && after.qr === 46, "qr count");
  assert(after.subs === before.subs && after.subs === 6, "subs count");
  assert(after.publicId === before.publicId, "public_id");
  assert(after.viewerSlug === before.viewerSlug, "viewer_slug");

  const revisions = await listComponentRevisions({ productId: ID, kind: "material" });

  console.log(
    JSON.stringify(
      {
        product: "CHROMA",
        productId: ID,
        draftCreated: draft,
        activated: activated.activated,
        previousMaterialPointer: foundationMaterialId,
        pointersAfter: after.pointers,
        otherProductLegacy: otherSelection.mode === "legacy",
        otherProductTitle: other?.title ?? null,
        canary: "DISABLED after test",
        defaultRuntime: finalSelection.mode,
        materialRevisions: revisions.map((r) => ({
          id: r.id,
          kind: r.componentKind,
          v: r.componentRevisionNumber,
          status: r.status,
          activePointer: r.isProductActivePointer,
        })),
        db: {
          products: after.products,
          qr: after.qr,
          subs: after.subs,
          legacyUnchanged: true,
        },
        result: "PASS",
      },
      null,
      2,
    ),
  );
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
