/**
 * Phase 6B — CHROMA controlled update safety validation.
 * Run: npx tsx scripts/ar360-phase6b-change-guard.ts
 *
 * Uses ONLY PRD_3XTVLF8X (CHROMA). Leaves VERSIONED canary disabled.
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import {
  activateWithSafety,
  buildActivationPreview,
  capturePointerSnapshot,
  listChangeHistory,
  runActivationGate,
  runPostActivationHealthCheck,
} from "../src/lib/platform-versioning/activation-safety.service";
import {
  createComponentDraftRevision,
  getRevisionById,
  parseRevisionConfig,
  updateComponentDraftRevision,
} from "../src/lib/platform-versioning/component-revisions.service";
import { rollbackMaterialRevision } from "../src/lib/platform-versioning/material-rollback.service";
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
    legacySettings: JSON.stringify(product[0]?.settings ?? null),
    legacyMaterials: JSON.stringify(product[0]?.material_settings ?? null),
    pointers: pointers[0] ?? null,
    flagEnabled: Boolean(flag[0]?.enabled),
    targeting: flag[0]?.targeting ?? null,
  };
}

async function makeMaterialDraft(opts: {
  renderOrder: number;
  note: string;
  dependencies?: Record<string, { minComponentRevisionNumber: number }>;
  badJson?: boolean;
  badAsset?: boolean;
}) {
  const draft = await createComponentDraftRevision({
    productId: ID,
    kind: "material",
    adminId: 1,
    reason: opts.note,
    notes: opts.note,
  });
  const row = await getRevisionById(draft.id);
  const cfg = parseRevisionConfig(row!);
  const mat0 = {
    ...((cfg.materialSettings as Record<string, Record<string, unknown>>)?.["0"] || {}),
    renderOrder: opts.renderOrder,
  };

  const patch: Record<string, unknown> = {
    materialSettings: {
      ...((cfg.materialSettings as object) || {}),
      "0": mat0,
    },
  };
  if (!opts.badJson) {
    await updateComponentDraftRevision({
      revisionId: draft.id,
      adminId: 1,
      patch: patch as never,
    });
  } else {
    await query(
      `UPDATE ar360_product_config_revisions
          SET config_json = JSON_SET(config_json, '$.materialSettings', 42)
        WHERE id = ?`,
      [draft.id],
    );
  }
  if (opts.dependencies) {
    const latest = await getRevisionById(draft.id);
    const full = parseRevisionConfig(latest!);
    await query(`UPDATE ar360_product_config_revisions SET config_json = ? WHERE id = ?`, [
      JSON.stringify({ ...full, dependencies: opts.dependencies }),
      draft.id,
    ]);
  }
  if (opts.badAsset) {
    await query(
      `UPDATE ar360_product_config_revisions
          SET asset_refs_json = JSON_SET(
            COALESCE(asset_refs_json, '{}'),
            '$.modelUrl',
            '/__missing__/does-not-exist.glb'
          )
        WHERE id = ?`,
      [draft.id],
    );
  }
  return draft;
}

async function main() {
  console.log("=== Phase 6B Change Guard — CHROMA ===");
  const before = await safetyBaseline();
  console.log("BEFORE", {
    products: before.products,
    qr: before.qr,
    subs: before.subs,
    publicId: before.publicId,
    viewerSlug: before.viewerSlug,
    pointers: before.pointers,
    canary: await listCanaryProductIds(),
  });

  assert(before.products === 21, `products expected 21 got ${before.products}`);
  assert(before.qr === 46, `QR expected 46 got ${before.qr}`);
  assert(before.subs === 6, `subs expected 6 got ${before.subs}`);

  // Ensure canary off for CHROMA during guards
  await setProductCanaryRuntime({ productId: ID, enabled: false });

  const snap0 = await capturePointerSnapshot(ID);
  assert(!!snap0, "snapshot required");
  const materialBefore = snap0!.material;

  // E — Preview does not mutate pointers
  const draftPreview = await makeMaterialDraft({
    renderOrder: 9601,
    note: "6B preview guard",
  });
  const preview = await buildActivationPreview({
    productId: ID,
    revisionId: draftPreview.id,
  });
  assert(preview.ok === true, `preview should pass: ${JSON.stringify(preview)}`);
  const snapAfterPreview = await capturePointerSnapshot(ID);
  assert(
    JSON.stringify(snapAfterPreview) === JSON.stringify(snap0),
    "E: preview must not mutate pointers",
  );
  console.log("E PASS — preview no mutation");

  // C — Incompatible dependency blocked
  const depDraft = await makeMaterialDraft({
    renderOrder: 9602,
    note: "6B dep conflict",
    dependencies: { viewer: { minComponentRevisionNumber: 9999 } },
  });
  const depGate = await runActivationGate({ productId: ID, revisionId: depDraft.id });
  assert(depGate.ok === false, "C: dependency conflict should block");
  assert(
    depGate.ok === false && depGate.code === "DEPENDENCY_CONFLICT",
    `C: expected DEPENDENCY_CONFLICT got ${(depGate as { code?: string }).code}`,
  );
  const blocked = await activateWithSafety({
    productId: ID,
    revisionId: depDraft.id,
    adminId: 1,
    reason: "6B dep block test",
  });
  assert(blocked.ok === false, "C: activateWithSafety must block");
  assert(
    JSON.stringify(await capturePointerSnapshot(ID)) === JSON.stringify(snap0),
    "C: blocked activation must not change pointers",
  );
  console.log("C PASS — dependency conflict blocked");

  // D — Invalid runtime JSON blocked
  const badJsonDraft = await makeMaterialDraft({
    renderOrder: 9603,
    note: "6B bad json",
    badJson: true,
  });
  const jsonGate = await runActivationGate({ productId: ID, revisionId: badJsonDraft.id });
  assert(jsonGate.ok === false, "D: invalid JSON should block");
  console.log("D PASS — invalid runtime JSON blocked", (jsonGate as { code: string }).code);

  // B — Invalid asset blocked (best-effort; may pass if validator treats remote differently)
  const badAssetDraft = await makeMaterialDraft({
    renderOrder: 9604,
    note: "6B bad asset",
    badAsset: true,
  });
  const assetGate = await runActivationGate({ productId: ID, revisionId: badAssetDraft.id });
  assert(assetGate.ok === false, "B: invalid asset should block");
  console.log("B PASS — invalid asset blocked", (assetGate as { code: string }).code);

  // A + F + G — Valid activation
  const validDraft = await makeMaterialDraft({
    renderOrder: 9700,
    note: "6B valid activation",
  });
  const gateOk = await runActivationGate({ productId: ID, revisionId: validDraft.id });
  assert(gateOk.ok === true, `A: gate should pass: ${JSON.stringify(gateOk)}`);

  const activated = await activateWithSafety({
    productId: ID,
    revisionId: validDraft.id,
    adminId: 1,
    reason: "6B valid activation",
  });
  assert(activated.ok === true, `A: activation failed ${JSON.stringify(activated)}`);
  assert(activated.ok === true && activated.status === "ACTIVE", "A: status ACTIVE");
  assert(activated.ok === true && activated.health.ok === true, "G: health PASS");

  const afterAct = await capturePointerSnapshot(ID);
  assert(afterAct?.material === validDraft.id, "F: only material pointer should change to new draft");
  assert(afterAct?.geometry === snap0!.geometry, "J: geometry unchanged");
  assert(afterAct?.lighting === snap0!.lighting, "J: lighting unchanged");
  assert(afterAct?.viewer === snap0!.viewer, "J: viewer unchanged");
  assert(afterAct?.ar === snap0!.ar, "J: ar unchanged");
  assert(afterAct?.config === snap0!.config, "J: config unchanged");
  console.log("A/F/G/J PASS — valid activation + health + other pointers intact");

  // H — Simulated unhealthy
  const unhealthyDraft = await makeMaterialDraft({
    renderOrder: 9800,
    note: "6B force unhealthy",
  });
  const unhealthy = await activateWithSafety({
    productId: ID,
    revisionId: unhealthyDraft.id,
    adminId: 1,
    reason: "6B simulated unhealthy",
    forceUnhealthy: true,
  });
  assert(unhealthy.ok === true, "H: activation still succeeds");
  assert(unhealthy.ok === true && unhealthy.status === "UNHEALTHY", "H: status UNHEALTHY");
  assert(unhealthy.ok === true && unhealthy.health.ok === false, "H: health fail");
  // No auto-rollback — pointer stays on unhealthy revision
  const afterUnhealthy = await capturePointerSnapshot(ID);
  assert(
    afterUnhealthy?.material === unhealthyDraft.id,
    "H: no automatic rollback — pointer remains on activated revision",
  );
  console.log("H PASS — UNHEALTHY with rollback action available (manual)");

  // I — Material rollback only
  const rollbackTarget = materialBefore || validDraft.id;
  const rb = await rollbackMaterialRevision({
    productId: ID,
    targetRevisionId: rollbackTarget,
    adminId: 1,
    reason: "6B recovery after unhealthy test",
  });
  assert(rb.toRevisionId === rollbackTarget, "I: rolled back to prior material");
  const afterRb = await capturePointerSnapshot(ID);
  assert(afterRb?.geometry === snap0!.geometry, "I/J: geometry still unchanged after rollback");
  console.log("I PASS — material rollback restored pointer");

  // Health after rollback
  const health = await runPostActivationHealthCheck(ID);
  assert(health.ok === true, `post-rollback health: ${JSON.stringify(health)}`);

  // K/L — legacy + identity unchanged; canary disabled
  await setProductCanaryRuntime({ productId: ID, enabled: false });
  const after = await safetyBaseline();
  assert(after.products === 21, "products still 21");
  assert(after.qr === 46, "QR still 46");
  assert(after.subs === 6, "subs still 6");
  assert(after.publicId === before.publicId, "K/L public_id unchanged");
  assert(after.viewerSlug === before.viewerSlug, "K/L viewer_slug unchanged");
  assert(after.legacySettings === before.legacySettings, "K legacy settings unchanged");
  assert(after.legacyMaterials === before.legacyMaterials, "K legacy material_settings unchanged");
  const canary = await listCanaryProductIds();
  assert(!canary.includes(ID), "canary disabled for CHROMA after tests");

  const history = await listChangeHistory(ID, 20);
  assert(history.some((h) => h.status === "ACTIVE"), "history has ACTIVE");
  assert(history.some((h) => h.status === "BLOCKED"), "history has BLOCKED");
  assert(history.some((h) => h.status === "UNHEALTHY"), "history has UNHEALTHY");
  console.log("History sample:", history.slice(0, 5).map((h) => `${h.componentKind} ${h.status}`));

  console.log("=== Phase 6B ALL PASS ===");
  console.log(
    JSON.stringify(
      {
        products: after.products,
        qr: after.qr,
        subs: after.subs,
        materialPointer: after.pointers?.active_material_revision_id,
        canary,
        historyCount: history.length,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Phase 6B FAILED", err);
  process.exit(1);
});
