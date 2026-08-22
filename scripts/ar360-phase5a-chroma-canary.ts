/**
 * Phase 5A — CHROMA controlled canary validation.
 * Commands: precheck | baseline | enable | compare | fallback | disable | full
 */
import fs from "fs/promises";
import path from "path";
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import { getProductFolder } from "../src/lib/localCustomerStorage";
import {
  listCanaryProductIds,
  resolveRuntimeModeForProduct,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";
import {
  resolveProductComponents,
  validateVersionedRuntimeReady,
} from "../src/lib/platform-versioning/component-resolver";
import {
  buildProductShadowReport,
  getLegacyProductRow,
} from "../src/lib/platform-versioning/product-config-resolver";
import { applyControlledRuntimeToProduct } from "../src/lib/platform-versioning/apply-versioned-runtime";
import {
  compareNormalizedConfigs,
  normalizeRenderConfig,
} from "../src/lib/platform-versioning/config-compare";
import { buildLegacyConfigSnapshot, buildLegacyAssetRefs } from "../src/lib/platform-versioning/foundation";

loadEnvConfig(process.cwd());

const ID = "PRD_3XTVLF8X";

function parseMaybe(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

async function safetySnapshot() {
  const [counts, qr, subs, product, stable, flag, pointers] = await Promise.all([
    query<{ products: number; with_ptr: number }>(
      `SELECT COUNT(*) AS products, SUM(active_config_revision_id IS NOT NULL) AS with_ptr FROM products`,
    ),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM product_qr_codes`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM customer_subscriptions`),
    query<{ public_id: string | null; viewer_slug: string | null; title: string | null; model_url: string | null }>(
      `SELECT public_id, viewer_slug, title, model_url FROM products WHERE id = ? LIMIT 1`,
      [ID],
    ),
    query<{ setting_value: string | null }>(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'ar360_active_stable_release_id' LIMIT 1`,
    ),
    query<{ enabled: number; targeting: unknown }>(
      `SELECT enabled, targeting FROM ar360_feature_flags WHERE flag_key = 'versioned_runtime' LIMIT 1`,
    ),
    query<{
      active_config_revision_id: number | null;
      active_material_revision_id: number | null;
      active_lighting_revision_id: number | null;
      active_viewer_revision_id: number | null;
      active_ar_revision_id: number | null;
    }>(
      `SELECT active_config_revision_id, active_material_revision_id, active_lighting_revision_id,
              active_viewer_revision_id, active_ar_revision_id
         FROM products WHERE id = ? LIMIT 1`,
      [ID],
    ),
  ]);
  return {
    products: Number(counts[0]?.products || 0),
    withPtr: Number(counts[0]?.with_ptr || 0),
    qr: Number(qr[0]?.c || 0),
    subs: Number(subs[0]?.c || 0),
    publicId: product[0]?.public_id ?? null,
    viewerSlug: product[0]?.viewer_slug ?? null,
    title: product[0]?.title ?? null,
    modelUrl: product[0]?.model_url ?? null,
    activeStable: stable[0]?.setting_value ?? null,
    flagEnabled: Boolean(flag[0]?.enabled),
    targeting: flag[0]?.targeting ?? null,
    pointers: pointers[0] ?? null,
  };
}

async function productPayload() {
  const row = await getLegacyProductRow(ID);
  if (!row) throw new Error("CHROMA missing");
  const settings = asRecord(parseMaybe(row.settings));
  return {
    id: ID,
    productUid: ID,
    title: row.title,
    settings,
    materialSettings: parseMaybe(row.material_settings),
    variants: parseMaybe(row.variants),
    hotspots: parseMaybe(row.hotspots),
    modelUrl: row.model_url,
    fileName: row.file_name,
    exposure: settings.exposure,
    environmentImage: settings.environmentImage,
    useSkybox: settings.useSkybox,
    shadowIntensity: settings.shadowIntensity,
    shadowSoftness: settings.shadowSoftness,
    cameraOrbit: settings.cameraOrbit,
    cameraTarget: settings.cameraTarget,
    fov: settings.fov,
    backgroundColor: settings.backgroundColor,
    showArButton: settings.showArButton,
  };
}

function extractCompareSlice(product: Record<string, unknown>) {
  const settings = asRecord(product.settings);
  const mats = asRecord(product.materialSettings);
  const mat0 = mats["0"] || Object.values(mats)[0] || null;
  return {
    material0: mat0,
    lighting: {
      exposure: product.exposure ?? settings.exposure ?? null,
      environmentImage: product.environmentImage ?? settings.environmentImage ?? null,
      environmentRotation: settings.environmentRotation ?? null,
      environmentTint: settings.environmentTint ?? null,
      environmentSaturation: settings.environmentSaturation ?? null,
      useSkybox: product.useSkybox ?? settings.useSkybox ?? null,
      shadowIntensity: product.shadowIntensity ?? settings.shadowIntensity ?? null,
      shadowSoftness: product.shadowSoftness ?? settings.shadowSoftness ?? null,
    },
    viewer: {
      cameraOrbit: product.cameraOrbit ?? settings.cameraOrbit ?? null,
      cameraTarget: product.cameraTarget ?? settings.cameraTarget ?? null,
      fov: product.fov ?? settings.fov ?? null,
      backgroundColor: product.backgroundColor ?? settings.backgroundColor ?? null,
      initialZoom: settings.initialZoom ?? null,
      autoRotate: settings.autoRotate ?? null,
    },
    ar: {
      showArButton: product.showArButton ?? settings.showArButton ?? null,
      arModelUrl: settings.arModelUrl ?? null,
      usdzUrl: settings.usdzUrl ?? null,
    },
    modelUrl: product.modelUrl ?? null,
  };
}

async function precheck() {
  const selection = await resolveRuntimeModeForProduct(ID);
  const components = await resolveProductComponents(ID);
  const ready = await validateVersionedRuntimeReady(ID);
  const shadow = await buildProductShadowReport(ID);
  const canaryIds = await listCanaryProductIds();
  const safety = await safetySnapshot();
  const row = await getLegacyProductRow(ID);
  return {
    step: "precheck",
    runtime: selection.mode,
    runtimeReason: selection.reason,
    canaryIds,
    pointersExist: Boolean(
      row?.active_config_revision_id &&
        row?.active_material_revision_id &&
        row?.active_lighting_revision_id &&
        row?.active_viewer_revision_id &&
        row?.active_ar_revision_id,
    ),
    compatibilityPass: components?.compatibility.pass ?? false,
    assetsOk: shadow?.assets?.ok ?? false,
    shadowMatch: shadow?.comparison?.match ?? null,
    shadowDiffs: shadow?.comparison?.differences?.length ?? null,
    readyOk: ready.ok,
    safety,
  };
}

async function baselineLegacy() {
  const selection = await resolveRuntimeModeForProduct(ID);
  if (selection.mode !== "legacy") {
    throw new Error(`Expected LEGACY before baseline, got ${selection.mode}`);
  }
  const payload = await productPayload();
  const applied = await applyControlledRuntimeToProduct(payload);
  const row = await getLegacyProductRow(ID);
  if (!row) throw new Error("missing");
  const legacySnap = {
    config: buildLegacyConfigSnapshot(row),
    assetRefs: buildLegacyAssetRefs(row),
  };
  return {
    step: "baseline",
    diagnostics: applied.diagnostics,
    slice: extractCompareSlice(applied.product),
    normalized: normalizeRenderConfig(legacySnap),
    safety: await safetySnapshot(),
  };
}

async function enable() {
  const before = await safetySnapshot();
  await setProductCanaryRuntime({ productId: ID, enabled: true });
  const selection = await resolveRuntimeModeForProduct(ID);
  const other = await resolveRuntimeModeForProduct("PRD_3LRQT9GF");
  return {
    step: "enable",
    selection,
    otherRemainsLegacy: other.mode === "legacy",
    canaryIds: await listCanaryProductIds(),
    before,
    after: await safetySnapshot(),
  };
}

async function compareVersioned() {
  const selection = await resolveRuntimeModeForProduct(ID);
  if (selection.mode !== "versioned") {
    throw new Error(`Expected VERSIONED for compare, got ${selection.mode}`);
  }
  const payload = await productPayload();
  const applied = await applyControlledRuntimeToProduct(payload);
  const row = await getLegacyProductRow(ID);
  if (!row) throw new Error("missing");
  const legacyNorm = normalizeRenderConfig({
    config: buildLegacyConfigSnapshot(row),
    assetRefs: buildLegacyAssetRefs(row),
  });
  const versionedNorm = normalizeRenderConfig({
    config: {
      ...buildLegacyConfigSnapshot(row),
      settings: applied.product.settings,
      materialSettings: applied.product.materialSettings,
      variants: applied.product.variants,
      hotspots: applied.product.hotspots,
    },
    assetRefs: {
      ...buildLegacyAssetRefs(row),
      modelUrl: (applied.product.modelUrl as string) || row.model_url,
      fileName: (applied.product.fileName as string) || row.file_name,
    },
  });
  const comparison = compareNormalizedConfigs(legacyNorm, versionedNorm);
  return {
    step: "compare",
    diagnostics: applied.diagnostics,
    slice: extractCompareSlice(applied.product),
    comparison: {
      match: comparison.match,
      differences: comparison.differences,
    },
    ar360Runtime: applied.product.ar360Runtime ?? null,
  };
}

async function fallbackTest() {
  // Controlled diagnostic: temporarily hide required model.glb (filesystem only),
  // then restore. Does not mutate MySQL product/revision/QR/subscription rows.
  const row = await getLegacyProductRow(ID);
  if (!row?.customer_uid) throw new Error("customer_uid missing");
  const folder = getProductFolder(row.customer_uid, ID);
  const glb = path.join(folder, "model.glb");
  const bak = path.join(folder, "model.glb.__phase5a_fallback_bak");

  const selection = await resolveRuntimeModeForProduct(ID);
  if (selection.mode !== "versioned") {
    throw new Error("Canary must be enabled for fallback test");
  }

  await fs.rename(glb, bak);
  let result: Record<string, unknown>;
  try {
    const ready = await validateVersionedRuntimeReady(ID);
    const applied = await applyControlledRuntimeToProduct(await productPayload());
    result = {
      readyOk: ready.ok,
      readyCode: ready.code,
      diagnostics: applied.diagnostics,
      productStillHasModelUrl: Boolean(applied.product.modelUrl),
      materialStillPresent: Boolean(applied.product.materialSettings),
      servedLegacy: applied.diagnostics.mode === "legacy",
      fallbackTriggered: applied.diagnostics.fallbackTriggered,
    };
  } finally {
    await fs.rename(bak, glb);
  }

  // Confirm restore + versioned works again
  const restoredReady = await validateVersionedRuntimeReady(ID);
  const restored = await applyControlledRuntimeToProduct(await productPayload());
  return {
    step: "fallback",
    duringFailure: result,
    afterRestore: {
      readyOk: restoredReady.ok,
      diagnostics: restored.diagnostics,
    },
    safety: await safetySnapshot(),
  };
}

async function disable() {
  const before = await safetySnapshot();
  await setProductCanaryRuntime({ productId: ID, enabled: false });
  for (const id of await listCanaryProductIds()) {
    await setProductCanaryRuntime({ productId: id, enabled: false });
  }
  return {
    step: "disable",
    selection: await resolveRuntimeModeForProduct(ID),
    canaryIds: await listCanaryProductIds(),
    before,
    after: await safetySnapshot(),
  };
}

async function full() {
  const beforeAll = await safetySnapshot();
  const pc = await precheck();
  // Ensure legacy start
  if (pc.runtime !== "legacy") {
    await setProductCanaryRuntime({ productId: ID, enabled: false });
  }
  const legacy = await baselineLegacy();
  const en = await enable();
  const ver = await compareVersioned();
  const fb = await fallbackTest();
  const dis = await disable();
  const afterAll = await safetySnapshot();

  const configMatch = ver.comparison.match === true && (ver.comparison.differences?.length || 0) === 0;
  const versionedOk =
    ver.diagnostics.mode === "versioned" &&
    ver.diagnostics.fallbackTriggered === false &&
    configMatch;
  const fallbackOk =
    Boolean((fb.duringFailure as any)?.fallbackTriggered) &&
    Boolean((fb.duringFailure as any)?.servedLegacy) &&
    (fb.afterRestore as any)?.diagnostics?.mode === "versioned";

  return {
    report: {
      product: "CHROMA",
      productId: ID,
      legacyResult: legacy.diagnostics.mode === "legacy" ? "PASS" : "FAIL",
      versionedResult: versionedOk ? "PASS" : "FAIL",
      chromeMaterial: configMatch ? "PASS" : "FAIL",
      reflection: configMatch ? "PASS" : "FAIL",
      lighting: configMatch ? "PASS" : "FAIL",
      hdri: configMatch ? "PASS" : "FAIL",
      ar: configMatch ? "PASS" : "FAIL",
      fallback: fallbackOk ? "PASS" : "FAIL",
      qr: beforeAll.qr === afterAll.qr ? "UNCHANGED" : `CHANGED ${beforeAll.qr}->${afterAll.qr}`,
      publicUrl:
        beforeAll.publicId === afterAll.publicId && beforeAll.viewerSlug === afterAll.viewerSlug
          ? "UNCHANGED"
          : "CHANGED",
      subscription: beforeAll.subs === afterAll.subs ? "UNCHANGED" : "CHANGED",
      canary: dis.canaryIds.length === 0 ? "DISABLED after test" : `STILL ACTIVE: ${dis.canaryIds}`,
      productsCountUnchanged: beforeAll.products === afterAll.products,
      pointersUnchanged: JSON.stringify(beforeAll.pointers) === JSON.stringify(afterAll.pointers),
      activeStableStillEmpty: !afterAll.activeStable,
      differences: ver.comparison.differences,
      publicViewerPath: `/viewer/${ID}`,
      modelUrl: beforeAll.modelUrl,
    },
    details: { pc, legacy, en, ver, fb, dis, beforeAll, afterAll },
  };
}

async function main() {
  const cmd = process.argv[2] || "precheck";
  const map: Record<string, () => Promise<unknown>> = {
    precheck,
    baseline: baselineLegacy,
    enable,
    compare: compareVersioned,
    fallback: fallbackTest,
    disable,
    full,
  };
  const fn = map[cmd];
  if (!fn) throw new Error(`Unknown command ${cmd}`);
  console.log(JSON.stringify(await fn(), null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
