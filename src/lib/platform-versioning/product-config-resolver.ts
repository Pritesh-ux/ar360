/**
 * Phase 3 — versioned product configuration resolver (shadow mode).
 *
 * Resolves active revisions for diagnostics only.
 * Does NOT change production rendering (legacy MySQL+disk path remains authoritative).
 */

import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { getProductFolder } from "@/lib/localCustomerStorage";
import {
  buildLegacyAssetRefs,
  buildLegacyConfigSnapshot,
  type Ar360AssetRefsSnapshot,
  type Ar360ProductConfigSnapshot,
  type LegacyProductRowForRevision,
} from "@/lib/platform-versioning/foundation";
import {
  compareNormalizedConfigs,
  normalizeRenderConfig,
  summarizeDifferencesByCategory,
  type ConfigComparisonResult,
  type NormalizedRenderConfig,
} from "@/lib/platform-versioning/config-compare";

export type RenderingSource = "legacy_runtime";

export type ResolvedProductConfig = {
  productId: string;
  customerUid: string;
  revisionId: number | null;
  revisionNumber: number | null;
  hasActiveRevision: boolean;
  rendererCompatibility: string;
  materialRevisionId: number | null;
  lightingRevisionId: number | null;
  viewerRevisionId: number | null;
  arRevisionId: number | null;
  geometryRevisionId: number | null;
  config: Ar360ProductConfigSnapshot | null;
  assetRefs: Ar360AssetRefsSnapshot | null;
  source: "versioned_revision" | "legacy_fallback";
  renderingSource: RenderingSource;
  shadowMode: true;
};

export type AssetValidationItem = {
  role: string;
  path: string;
  required: boolean;
  exists: boolean;
  sizeBytes: number | null;
  note?: string;
};

export type AssetValidationResult = {
  ok: boolean;
  items: AssetValidationItem[];
};

export type ProductShadowReport = {
  productId: string;
  title: string | null;
  customerUid: string;
  publicId: string | null;
  viewerSlug: string | null;
  resolved: ResolvedProductConfig;
  legacyNormalized: NormalizedRenderConfig;
  versionedNormalized: NormalizedRenderConfig | null;
  comparison: ConfigComparisonResult | null;
  categoryCounts: ReturnType<typeof summarizeDifferencesByCategory> | null;
  assets: AssetValidationResult;
  renderingSource: RenderingSource;
  note: string;
};

type ProductRow = LegacyProductRowForRevision & {
  active_config_revision_id?: number | null;
  active_material_revision_id?: number | null;
  active_lighting_revision_id?: number | null;
  active_viewer_revision_id?: number | null;
  active_ar_revision_id?: number | null;
  active_geometry_revision_id?: number | null;
};

type RevisionRow = {
  id: number;
  product_uid: string;
  customer_uid: string;
  revision_number: number;
  config_json: unknown;
  asset_refs_json: unknown;
  material_revision_id: number | null;
  lighting_revision_id: number | null;
  viewer_revision_id: number | null;
  ar_revision_id: number | null;
  geometry_revision_id: number | null;
  renderer_compat_label: string;
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export async function getLegacyProductRow(productId: string): Promise<ProductRow | null> {
  const rows = await query<ProductRow>(
    `SELECT id, customer_uid, title, status, public_id, viewer_slug, version,
            settings, material_settings, variants, hotspots,
            model_url, file_name, product_folder, thumbnail_url, qr_url, poster,
            active_config_revision_id, active_material_revision_id,
            active_lighting_revision_id, active_viewer_revision_id,
            active_ar_revision_id, active_geometry_revision_id
       FROM products
      WHERE id = ?
      LIMIT 1`,
    [productId],
  );
  return rows[0] ?? null;
}

export async function getActiveProductRevision(
  productId: string,
): Promise<RevisionRow | null> {
  const product = await getLegacyProductRow(productId);
  if (!product?.active_config_revision_id) return null;

  const rows = await query<RevisionRow>(
    `SELECT id, product_uid, customer_uid, revision_number, config_json, asset_refs_json,
            material_revision_id, lighting_revision_id, viewer_revision_id,
            ar_revision_id, geometry_revision_id, renderer_compat_label
       FROM ar360_product_config_revisions
      WHERE id = ? AND product_uid = ?
      LIMIT 1`,
    [Number(product.active_config_revision_id), productId],
  );
  return rows[0] ?? null;
}

export function getLegacyProductConfig(product: LegacyProductRowForRevision): {
  config: Ar360ProductConfigSnapshot;
  assetRefs: Ar360AssetRefsSnapshot;
} {
  return {
    config: buildLegacyConfigSnapshot(product),
    assetRefs: buildLegacyAssetRefs(product),
  };
}

function revisionToSnapshot(row: RevisionRow): {
  config: Ar360ProductConfigSnapshot;
  assetRefs: Ar360AssetRefsSnapshot;
} {
  const config = parseJson<Ar360ProductConfigSnapshot>(row.config_json, {
    schemaVersion: 1,
    source: "legacy_backfill",
    productIdentity: {
      id: row.product_uid,
      publicId: null,
      viewerSlug: null,
      status: null,
      title: null,
      editVersion: null,
    },
    settings: {},
    materialSettings: {},
    variants: [],
    hotspots: [],
    components: {
      material: { alignedToRevision: row.revision_number },
      lighting: { alignedToRevision: row.revision_number },
      viewer: { alignedToRevision: row.revision_number },
      ar: { alignedToRevision: row.revision_number },
      geometry: { alignedToRevision: row.revision_number },
    },
  });
  const assetRefs = parseJson<Ar360AssetRefsSnapshot>(row.asset_refs_json, {
    files: [],
  });
  return { config, assetRefs };
}

/**
 * Resolve versioned config when a pointer exists; otherwise legacy fallback.
 * Always reports renderingSource = legacy_runtime (Phase 3 shadow mode).
 */
export async function resolveProductConfig(productId: string): Promise<ResolvedProductConfig | null> {
  const product = await getLegacyProductRow(productId);
  if (!product) return null;

  const customerUid = String(product.customer_uid || "");
  const revision = await getActiveProductRevision(productId);

  if (!revision) {
    const legacy = getLegacyProductConfig(product);
    return {
      productId,
      customerUid,
      revisionId: null,
      revisionNumber: null,
      hasActiveRevision: false,
      rendererCompatibility: "legacy-current",
      materialRevisionId: null,
      lightingRevisionId: null,
      viewerRevisionId: null,
      arRevisionId: null,
      geometryRevisionId: null,
      config: legacy.config,
      assetRefs: legacy.assetRefs,
      source: "legacy_fallback",
      renderingSource: "legacy_runtime",
      shadowMode: true,
    };
  }

  const { config, assetRefs } = revisionToSnapshot(revision);
  return {
    productId,
    customerUid,
    revisionId: Number(revision.id),
    revisionNumber: Number(revision.revision_number),
    hasActiveRevision: true,
    rendererCompatibility: revision.renderer_compat_label || "legacy-current",
    materialRevisionId: revision.material_revision_id,
    lightingRevisionId: revision.lighting_revision_id,
    viewerRevisionId: revision.viewer_revision_id,
    arRevisionId: revision.ar_revision_id,
    geometryRevisionId: revision.geometry_revision_id,
    config,
    assetRefs,
    source: "versioned_revision",
    renderingSource: "legacy_runtime",
    shadowMode: true,
  };
}

export function compareProductConfigs(
  legacyProduct: LegacyProductRowForRevision,
  versioned: {
    config: Ar360ProductConfigSnapshot;
    assetRefs: Ar360AssetRefsSnapshot | null;
  },
): {
  legacyNormalized: NormalizedRenderConfig;
  versionedNormalized: NormalizedRenderConfig;
  comparison: ConfigComparisonResult;
  categoryCounts: ReturnType<typeof summarizeDifferencesByCategory>;
} {
  const legacyBuilt = getLegacyProductConfig(legacyProduct);
  const legacyNormalized = normalizeRenderConfig({
    settings: legacyBuilt.config.settings,
    materialSettings: legacyBuilt.config.materialSettings,
    variants: legacyBuilt.config.variants,
    hotspots: legacyBuilt.config.hotspots,
    modelUrl: legacyBuilt.assetRefs.modelUrl ?? null,
    fileName: legacyBuilt.assetRefs.fileName ?? null,
  });

  const versionedNormalized = normalizeRenderConfig({
    settings: versioned.config.settings,
    materialSettings: versioned.config.materialSettings,
    variants: versioned.config.variants,
    hotspots: versioned.config.hotspots,
    modelUrl: versioned.assetRefs?.modelUrl ?? null,
    fileName: versioned.assetRefs?.fileName ?? null,
  });

  const comparison = compareNormalizedConfigs(legacyNormalized, versionedNormalized);
  return {
    legacyNormalized,
    versionedNormalized,
    comparison,
    categoryCounts: summarizeDifferencesByCategory(comparison.differences),
  };
}

export async function validateProductRevisionAssets(input: {
  customerUid: string;
  productId: string;
  assetRefs: Ar360AssetRefsSnapshot | null;
}): Promise<AssetValidationResult> {
  const folder = input.customerUid
    ? getProductFolder(input.customerUid, input.productId)
    : null;

  const checks: Array<{ role: string; name: string; required: boolean }> = [
    { role: "model", name: "model.glb", required: true },
    { role: "modelArLite", name: "model.ar.glb", required: false },
    { role: "usdz", name: "model.usdz", required: false },
    { role: "poster", name: "poster.png", required: false },
    { role: "thumbnail", name: "thumbnail.png", required: false },
  ];

  const items: AssetValidationItem[] = [];

  for (const check of checks) {
    if (!folder) {
      items.push({
        role: check.role,
        path: check.name,
        required: check.required,
        exists: false,
        sizeBytes: null,
        note: "Missing customer_uid; cannot resolve disk folder.",
      });
      continue;
    }

    const filePath = path.join(folder, check.name);
    try {
      const st = await fs.stat(filePath);
      items.push({
        role: check.role,
        path: check.name,
        required: check.required,
        exists: st.isFile(),
        sizeBytes: st.isFile() ? st.size : null,
      });
    } catch {
      items.push({
        role: check.role,
        path: check.name,
        required: check.required,
        exists: false,
        sizeBytes: null,
      });
    }
  }

  // Optional: validate modelUrl hint is non-empty when present in refs.
  if (input.assetRefs?.modelUrl) {
    items.push({
      role: "modelUrlRef",
      path: String(input.assetRefs.modelUrl).slice(0, 240),
      required: false,
      exists: true,
      sizeBytes: null,
      note: "URL reference only (not fetched).",
    });
  }

  const ok = items.every((item) => !item.required || item.exists);
  return { ok, items };
}

export async function buildProductShadowReport(productId: string): Promise<ProductShadowReport | null> {
  const product = await getLegacyProductRow(productId);
  if (!product) return null;

  const resolved = await resolveProductConfig(productId);
  if (!resolved) return null;

  let comparison: ConfigComparisonResult | null = null;
  let categoryCounts: ReturnType<typeof summarizeDifferencesByCategory> | null = null;
  let versionedNormalized: NormalizedRenderConfig | null = null;
  let legacyNormalized: NormalizedRenderConfig;

  const legacyBuilt = getLegacyProductConfig(product);
  legacyNormalized = normalizeRenderConfig({
    settings: legacyBuilt.config.settings,
    materialSettings: legacyBuilt.config.materialSettings,
    variants: legacyBuilt.config.variants,
    hotspots: legacyBuilt.config.hotspots,
    modelUrl: legacyBuilt.assetRefs.modelUrl ?? null,
    fileName: legacyBuilt.assetRefs.fileName ?? null,
  });

  if (resolved.hasActiveRevision && resolved.config) {
    const compared = compareProductConfigs(product, {
      config: resolved.config,
      assetRefs: resolved.assetRefs,
    });
    comparison = compared.comparison;
    categoryCounts = compared.categoryCounts;
    versionedNormalized = compared.versionedNormalized;
    legacyNormalized = compared.legacyNormalized;
  }

  const assets = await validateProductRevisionAssets({
    customerUid: resolved.customerUid,
    productId,
    assetRefs: resolved.assetRefs,
  });

  return {
    productId,
    title: product.title ?? null,
    customerUid: resolved.customerUid,
    publicId: product.public_id ?? null,
    viewerSlug: product.viewer_slug ?? null,
    resolved,
    legacyNormalized,
    versionedNormalized,
    comparison,
    categoryCounts,
    assets,
    renderingSource: "legacy_runtime",
    note: "Versioned configuration is currently in shadow mode. Production rendering still uses the legacy runtime.",
  };
}

export async function listProductsForShadowScan(limit = 500): Promise<
  Array<{ id: string; title: string | null; customer_uid: string | null }>
> {
  return query(
    `SELECT id, title, customer_uid
       FROM products
      ORDER BY id ASC
      LIMIT ?`,
    [Math.max(1, Math.min(5000, limit))],
  );
}

export type ShadowScanSummary = {
  productsChecked: number;
  matches: number;
  mismatches: number;
  failures: number;
  noRevision: number;
  mismatchProductIds: string[];
  failureProductIds: Array<{ productId: string; error: string }>;
  pointerCountsBefore: number;
  pointerCountsAfter: number;
  pointersUnchanged: boolean;
};

/** Read-only scan — never writes products/revisions. */
export async function runShadowScanAllProducts(limit = 500): Promise<{
  summary: ShadowScanSummary;
  reports: ProductShadowReport[];
}> {
  const before = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM products WHERE active_config_revision_id IS NOT NULL`,
  );
  const pointerCountsBefore = Number(before[0]?.c || 0);

  const products = await listProductsForShadowScan(limit);
  const reports: ProductShadowReport[] = [];
  const summary: ShadowScanSummary = {
    productsChecked: 0,
    matches: 0,
    mismatches: 0,
    failures: 0,
    noRevision: 0,
    mismatchProductIds: [],
    failureProductIds: [],
    pointerCountsBefore,
    pointerCountsAfter: 0,
    pointersUnchanged: true,
  };

  for (const product of products) {
    summary.productsChecked += 1;
    try {
      const report = await buildProductShadowReport(product.id);
      if (!report) {
        summary.failures += 1;
        summary.failureProductIds.push({ productId: product.id, error: "not_found" });
        continue;
      }
      reports.push(report);
      if (!report.resolved.hasActiveRevision) {
        summary.noRevision += 1;
        continue;
      }
      if (!report.comparison) {
        summary.failures += 1;
        summary.failureProductIds.push({ productId: product.id, error: "missing_comparison" });
        continue;
      }
      if (report.comparison.match) summary.matches += 1;
      else {
        summary.mismatches += 1;
        summary.mismatchProductIds.push(product.id);
      }
    } catch (error) {
      summary.failures += 1;
      summary.failureProductIds.push({
        productId: product.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const after = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM products WHERE active_config_revision_id IS NOT NULL`,
  );
  summary.pointerCountsAfter = Number(after[0]?.c || 0);
  summary.pointersUnchanged = summary.pointerCountsBefore === summary.pointerCountsAfter;

  return { summary, reports };
}
