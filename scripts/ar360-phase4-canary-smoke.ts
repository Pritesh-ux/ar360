/**
 * Phase 4 canary smoke — enable/disable PRD_3LRQT9GF, verify others stay LEGACY.
 * Run: npx tsx scripts/ar360-phase4-canary-smoke.ts
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";
import {
  listCanaryProductIds,
  resolveRuntimeModeForProduct,
  setProductCanaryRuntime,
} from "../src/lib/platform-versioning/runtime-selection";
import { applyControlledRuntimeToProduct } from "../src/lib/platform-versioning/apply-versioned-runtime";
import {
  buildProductShadowReport,
  getLegacyProductRow,
} from "../src/lib/platform-versioning/product-config-resolver";

loadEnvConfig(process.cwd());

const CANARY = "PRD_3LRQT9GF";
const CHROME = "PRD_3XTVLF8X";
const OTHER = "PRD_58DRXSX8";

async function main() {
  const beforePointers = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM products WHERE active_config_revision_id IS NOT NULL",
  );
  const beforeQr = await query<{ c: number }>("SELECT COUNT(*) AS c FROM product_qr_codes");
  const beforeSubs = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM customer_subscriptions",
  );
  const beforePublic = await query<{ public_id: string | null; viewer_slug: string | null }>(
    "SELECT public_id, viewer_slug FROM products WHERE id = ? LIMIT 1",
    [CANARY],
  );

  const chromeReport = await buildProductShadowReport(CHROME);

  await setProductCanaryRuntime({ productId: CANARY, enabled: true });
  const canaryMode = await resolveRuntimeModeForProduct(CANARY);
  const otherMode = await resolveRuntimeModeForProduct(OTHER);
  const ids = await listCanaryProductIds();

  const canaryRow = await getLegacyProductRow(CANARY);
  const applied = await applyControlledRuntimeToProduct({
    id: CANARY,
    productUid: CANARY,
    settings: canaryRow?.settings as unknown,
    materialSettings: canaryRow?.material_settings as unknown,
    variants: canaryRow?.variants as unknown,
    hotspots: canaryRow?.hotspots as unknown,
    modelUrl: canaryRow?.model_url,
  });

  await setProductCanaryRuntime({ productId: CANARY, enabled: false });
  const afterDisable = await resolveRuntimeModeForProduct(CANARY);
  const idsAfter = await listCanaryProductIds();

  const afterPointers = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM products WHERE active_config_revision_id IS NOT NULL",
  );
  const afterQr = await query<{ c: number }>("SELECT COUNT(*) AS c FROM product_qr_codes");
  const afterSubs = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM customer_subscriptions",
  );
  const afterPublic = await query<{ public_id: string | null; viewer_slug: string | null }>(
    "SELECT public_id, viewer_slug FROM products WHERE id = ? LIMIT 1",
    [CANARY],
  );
  const activeStable = await query<{ setting_value: string | null }>(
    "SELECT setting_value FROM platform_settings WHERE setting_key = 'ar360_active_stable_release_id' LIMIT 1",
  );

  console.log(
    JSON.stringify(
      {
        chrome: {
          title: chromeReport?.title,
          shadowMatch: chromeReport?.comparison?.match ?? null,
          differences: chromeReport?.comparison?.differences?.length ?? 0,
        },
        canaryEnable: {
          mode: canaryMode.mode,
          reason: canaryMode.reason,
          ids,
        },
        otherRemainsLegacy: otherMode.mode === "legacy",
        appliedDiagnostics: applied.diagnostics,
        afterDisable: { mode: afterDisable.mode, idsAfter },
        safety: {
          pointers: [Number(beforePointers[0]?.c || 0), Number(afterPointers[0]?.c || 0)],
          qr: [Number(beforeQr[0]?.c || 0), Number(afterQr[0]?.c || 0)],
          subs: [Number(beforeSubs[0]?.c || 0), Number(afterSubs[0]?.c || 0)],
          publicIdUnchanged: beforePublic[0]?.public_id === afterPublic[0]?.public_id,
          viewerSlugUnchanged: beforePublic[0]?.viewer_slug === afterPublic[0]?.viewer_slug,
        },
        activeStable: activeStable[0]?.setting_value ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
