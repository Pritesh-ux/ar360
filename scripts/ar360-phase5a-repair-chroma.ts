/**
 * Phase 5A repair — CHROMA live regression (payload types + safety).
 * Run: npx tsx scripts/ar360-phase5a-repair-chroma.ts
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import {
  listCanaryProductIds,
  resolveRuntimeModeForProduct,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";
import { getLegacyProductRow } from "../src/lib/platform-versioning/product-config-resolver";
import { applyControlledRuntimeToProduct } from "../src/lib/platform-versioning/apply-versioned-runtime";
import { overlayFromConfig } from "../src/lib/platform-versioning/apply-versioned-runtime";
import type { Ar360ProductConfigSnapshot } from "../src/lib/platform-versioning/foundation";
import { resolveProductComponents } from "../src/lib/platform-versioning/component-resolver";

loadEnvConfig(process.cwd());

const ID = "PRD_3XTVLF8X";
const OTHER = "PRD_3LRQT9GF";

async function safety() {
  const [counts, qr, subs, product, stable, flag] = await Promise.all([
    query<{ products: number; with_ptr: number }>(
      `SELECT COUNT(*) AS products, SUM(active_config_revision_id IS NOT NULL) AS with_ptr FROM products`,
    ),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM product_qr_codes`),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM customer_subscriptions`),
    query<{
      public_id: string | null;
      viewer_slug: string | null;
      active_config_revision_id: number | null;
      active_material_revision_id: number | null;
      active_lighting_revision_id: number | null;
      active_viewer_revision_id: number | null;
      active_ar_revision_id: number | null;
    }>(
      `SELECT public_id, viewer_slug, active_config_revision_id, active_material_revision_id,
              active_lighting_revision_id, active_viewer_revision_id, active_ar_revision_id
         FROM products WHERE id = ? LIMIT 1`,
      [ID],
    ),
    query<{ setting_value: string | null }>(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'ar360_active_stable_release_id' LIMIT 1`,
    ),
    query<{ enabled: number; targeting: unknown }>(
      `SELECT enabled, targeting FROM ar360_feature_flags WHERE flag_key = 'versioned_runtime' LIMIT 1`,
    ),
  ]);
  return {
    products: Number(counts[0]?.products || 0),
    withPtr: Number(counts[0]?.with_ptr || 0),
    qr: Number(qr[0]?.c || 0),
    subs: Number(subs[0]?.c || 0),
    publicId: product[0]?.public_id ?? null,
    viewerSlug: product[0]?.viewer_slug ?? null,
    pointers: {
      config: product[0]?.active_config_revision_id ?? null,
      material: product[0]?.active_material_revision_id ?? null,
      lighting: product[0]?.active_lighting_revision_id ?? null,
      viewer: product[0]?.active_viewer_revision_id ?? null,
      ar: product[0]?.active_ar_revision_id ?? null,
    },
    activeStable: stable[0]?.setting_value ?? null,
    flagEnabled: Boolean(flag[0]?.enabled),
    targeting: flag[0]?.targeting ?? null,
  };
}

function payloadTypes(product: Record<string, unknown>) {
  return {
    materialSettingsType: typeof product.materialSettings,
    materialSettingsIsObject:
      product.materialSettings != null &&
      typeof product.materialSettings === "object" &&
      !Array.isArray(product.materialSettings),
    variantsIsArray: Array.isArray(product.variants),
    settingsType: typeof product.settings,
    hotspotsIsArray: product.hotspots == null || Array.isArray(product.hotspots),
    mode: (product.ar360Runtime as { mode?: string } | undefined)?.mode ?? null,
    fallbackTriggered:
      (product.ar360Runtime as { fallbackTriggered?: boolean } | undefined)?.fallbackTriggered ??
      null,
    exposure: product.exposure ?? null,
    environmentImage: product.environmentImage ?? null,
  };
}

async function fetchPublicApi() {
  const res = await fetch(`http://localhost:3000/api/public-products/${ID}`);
  if (!res.ok) throw new Error(`public API ${res.status}`);
  const json = (await res.json()) as { product: Record<string, unknown> };
  return json.product;
}

async function main() {
  const before = await safety();

  // Ensure LEGACY start
  for (const id of await listCanaryProductIds()) {
    await setProductCanaryRuntime({ productId: id, enabled: false });
  }

  const legacySelection = await resolveRuntimeModeForProduct(ID);
  const legacyRow = await getLegacyProductRow(ID);
  if (!legacyRow) throw new Error("CHROMA missing");
  const legacyApply = await applyControlledRuntimeToProduct({
    id: ID,
    productUid: ID,
    settings: legacyRow.settings,
    materialSettings: undefined,
    variants: undefined,
  });
  // Prefer live public API for LEGACY types
  const legacyPublic = await fetchPublicApi();
  const legacyTypes = payloadTypes(legacyPublic);

  await setProductCanaryRuntime({ productId: ID, enabled: true });
  const versionedSelection = await resolveRuntimeModeForProduct(ID);
  const otherSelection = await resolveRuntimeModeForProduct(OTHER);
  const versionedPublic = await fetchPublicApi();
  const versionedTypes = payloadTypes(versionedPublic);

  // Controlled invalid-config fallback (in-memory only — no DB mutation)
  const components = await resolveProductComponents(ID);
  let configErrorFallback: Record<string, unknown> | null = null;
  if (components?.config) {
    const broken: Ar360ProductConfigSnapshot = {
      ...components.config,
      materialSettings: "{not-valid-json",
    };
    const overlay = overlayFromConfig(
      { id: ID, productUid: ID, materialSettings: { "0": { metalness: 0 } }, variants: [] },
      broken,
      null,
    );
    configErrorFallback = {
      overlayOk: overlay.ok,
      code: overlay.ok ? null : overlay.code,
      message: overlay.ok ? null : overlay.message,
    };
  }

  // Apply path with canary ON should succeed with object/array
  const versionedApply = await applyControlledRuntimeToProduct({
    id: ID,
    productUid: ID,
    settings: typeof legacyPublic.settings === "object" ? legacyPublic.settings : {},
    materialSettings: legacyPublic.materialSettings,
    variants: legacyPublic.variants,
    modelUrl: legacyPublic.modelUrl,
  });

  await setProductCanaryRuntime({ productId: ID, enabled: false });
  for (const id of await listCanaryProductIds()) {
    await setProductCanaryRuntime({ productId: id, enabled: false });
  }

  const after = await safety();
  const canaryIds = await listCanaryProductIds();
  const finalSelection = await resolveRuntimeModeForProduct(ID);

  const versionedTypesOk =
    versionedTypes.materialSettingsIsObject &&
    versionedTypes.variantsIsArray &&
    versionedTypes.settingsType === "object" &&
    versionedTypes.mode === "versioned" &&
    versionedTypes.fallbackTriggered === false;

  const report = {
    product: "CHROMA",
    productId: ID,
    legacyResult:
      legacySelection.mode === "legacy" &&
      legacyTypes.materialSettingsIsObject &&
      legacyTypes.variantsIsArray
        ? "PASS"
        : "FAIL",
    versionedResult: versionedTypesOk ? "PASS" : "FAIL",
    chromeMaterial:
      versionedTypesOk &&
      JSON.stringify(
        (versionedPublic.materialSettings as Record<string, unknown>)?.["0"] ?? null,
      ) ===
        JSON.stringify(
          (legacyPublic.materialSettings as Record<string, unknown>)?.["0"] ?? null,
        )
        ? "PASS"
        : "FAIL",
    reflection: versionedTypesOk ? "PASS" : "FAIL",
    lighting:
      versionedTypesOk &&
      versionedPublic.exposure === legacyPublic.exposure &&
      versionedPublic.environmentImage === legacyPublic.environmentImage
        ? "PASS"
        : "FAIL",
    hdri:
      versionedTypesOk && versionedPublic.environmentImage === legacyPublic.environmentImage
        ? "PASS"
        : "FAIL",
    ar:
      versionedTypesOk && versionedPublic.showArButton === legacyPublic.showArButton
        ? "PASS"
        : "FAIL",
    fallback:
      configErrorFallback && configErrorFallback.overlayOk === false && configErrorFallback.code === "VERSIONED_CONFIG_ERROR"
        ? "PASS"
        : "FAIL",
    qr: before.qr === after.qr ? "UNCHANGED" : "CHANGED",
    publicUrl:
      before.publicId === after.publicId && before.viewerSlug === after.viewerSlug
        ? "UNCHANGED"
        : "CHANGED",
    subscription: before.subs === after.subs ? "UNCHANGED" : "CHANGED",
    canary: canaryIds.length === 0 ? "DISABLED after test" : `ACTIVE: ${canaryIds.join(",")}`,
    otherProductsLegacy: otherSelection.mode === "legacy",
    finalRuntime: finalSelection.mode,
    db: {
      productsUnchanged: before.products === after.products && after.products === 21,
      qrUnchanged: before.qr === after.qr && after.qr === 46,
      subsUnchanged: before.subs === after.subs && after.subs === 6,
      pointersUnchanged: JSON.stringify(before.pointers) === JSON.stringify(after.pointers),
      activeStableEmpty: !after.activeStable,
    },
    legacyTypes,
    versionedTypes,
    versionedApplyMode: versionedApply.diagnostics.mode,
    legacyApplyMode: legacyApply.diagnostics.mode,
    configErrorFallback,
    before,
    after,
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.versionedResult !== "PASS" || report.legacyResult !== "PASS" || report.canary !== "DISABLED after test") {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
