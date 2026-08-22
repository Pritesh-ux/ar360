/**
 * Phase 4 — component revision resolution + compatibility checks.
 */

import {
  getLegacyProductConfig,
  getLegacyProductRow,
  resolveProductConfig,
  validateProductRevisionAssets,
} from "@/lib/platform-versioning/product-config-resolver";
import type { Ar360AssetRefsSnapshot, Ar360ProductConfigSnapshot } from "@/lib/platform-versioning/foundation";

export type ComponentKind = "geometry" | "material" | "lighting" | "viewer" | "ar";

export type ComponentResolution = {
  kind: ComponentKind;
  revisionId: number | null;
  revisionNumber: number | null;
  source: "legacy" | "versioned";
  compatibilityLabel: string;
  compatible: boolean;
};

export type ProductComponentsResolution = {
  productId: string;
  geometry: ComponentResolution;
  material: ComponentResolution;
  lighting: ComponentResolution;
  viewer: ComponentResolution;
  ar: ComponentResolution;
  config: Ar360ProductConfigSnapshot | null;
  assetRefs: Ar360AssetRefsSnapshot | null;
  source: "legacy" | "versioned";
  compatibility: {
    pass: boolean;
    failures: Array<{ component: ComponentKind; reason: string }>;
  };
};

export type CompatibilityFailureCode =
  | "VERSIONED_COMPATIBILITY_ERROR"
  | "VERSIONED_CONFIG_ERROR"
  | "VERSIONED_ASSET_ERROR"
  | "VERSIONED_MATERIAL_ERROR"
  | "VERSIONED_LIGHTING_ERROR"
  | "VERSIONED_VIEWER_ERROR"
  | "VERSIONED_AR_ERROR"
  | "VERSIONED_GEOMETRY_ERROR";

const LEGACY_COMPAT = "legacy-current";

function componentFromPointer(input: {
  kind: ComponentKind;
  revisionId: number | null;
  revisionNumber: number | null;
  compatLabel: string;
}): ComponentResolution {
  const hasPointer = input.revisionId != null && Number(input.revisionId) > 0;
  return {
    kind: input.kind,
    revisionId: hasPointer ? Number(input.revisionId) : null,
    revisionNumber: hasPointer ? input.revisionNumber : null,
    source: hasPointer ? "versioned" : "legacy",
    compatibilityLabel: input.compatLabel || LEGACY_COMPAT,
    // Phase 4: only legacy-current is considered safe for versioned apply.
    compatible: !hasPointer || (input.compatLabel || LEGACY_COMPAT) === LEGACY_COMPAT,
  };
}

/**
 * Resolve per-component pointers. Does not select runtime mode.
 * Composes config from foundation + active component revisions (drafts excluded).
 */
export async function resolveProductComponents(
  productId: string,
): Promise<ProductComponentsResolution | null> {
  const product = await getLegacyProductRow(productId);
  if (!product) return null;

  const { composeActiveVersionedConfig, getRevisionById } = await import(
    "@/lib/platform-versioning/component-revisions.service"
  );

  const composed = await composeActiveVersionedConfig(productId);
  const resolved = await resolveProductConfig(productId);
  if (!resolved && !composed) return null;

  const config = composed?.config ?? resolved?.config ?? null;
  const assetRefs = composed?.assetRefs ?? resolved?.assetRefs ?? null;

  async function resolveOne(kind: ComponentKind): Promise<ComponentResolution> {
    const pointerKey =
      kind === "geometry"
        ? "active_geometry_revision_id"
        : kind === "material"
          ? "active_material_revision_id"
          : kind === "lighting"
            ? "active_lighting_revision_id"
            : kind === "viewer"
              ? "active_viewer_revision_id"
              : "active_ar_revision_id";
    const pointerId = Number((product as Record<string, unknown>)[pointerKey] || 0);
    const fallbackId =
      kind === "geometry"
        ? resolved?.geometryRevisionId
        : kind === "material"
          ? resolved?.materialRevisionId
          : kind === "lighting"
            ? resolved?.lightingRevisionId
            : kind === "viewer"
              ? resolved?.viewerRevisionId
              : resolved?.arRevisionId;
    const revisionId = pointerId > 0 ? pointerId : fallbackId != null ? Number(fallbackId) : null;
    let revisionNumber: number | null = null;
    let compatLabel = LEGACY_COMPAT;
    if (revisionId) {
      const row = await getRevisionById(revisionId);
      if (row) {
        revisionNumber =
          row.component_revision_number != null
            ? Number(row.component_revision_number)
            : Number(row.revision_number);
        compatLabel = row.renderer_compat_label || LEGACY_COMPAT;
      }
    }
    return componentFromPointer({
      kind,
      revisionId,
      revisionNumber,
      compatLabel,
    });
  }

  const [geometry, material, lighting, viewer, ar] = await Promise.all([
    resolveOne("geometry"),
    resolveOne("material"),
    resolveOne("lighting"),
    resolveOne("viewer"),
    resolveOne("ar"),
  ]);

  const failures: Array<{ component: ComponentKind; reason: string }> = [];
  for (const c of [geometry, material, lighting, viewer, ar]) {
    if (c.source === "versioned" && !c.compatible) {
      failures.push({
        component: c.kind,
        reason: `Incompatible label '${c.compatibilityLabel}' (expected ${LEGACY_COMPAT})`,
      });
    }
  }

  return {
    productId,
    geometry,
    material,
    lighting,
    viewer,
    ar,
    config,
    assetRefs,
    source: config ? "versioned" : "legacy",
    compatibility: {
      pass: failures.length === 0,
      failures,
    },
  };
}

export async function validateVersionedRuntimeReady(productId: string): Promise<{
  ok: boolean;
  code: CompatibilityFailureCode | null;
  message: string;
  components: ProductComponentsResolution | null;
}> {
  const components = await resolveProductComponents(productId);
  if (!components) {
    return {
      ok: false,
      code: "VERSIONED_COMPATIBILITY_ERROR",
      message: "Product not found for versioned runtime.",
      components: null,
    };
  }

  if (!components.compatibility.pass) {
    return {
      ok: false,
      code: "VERSIONED_COMPATIBILITY_ERROR",
      message: components.compatibility.failures.map((f) => `${f.component}: ${f.reason}`).join("; "),
      components,
    };
  }

  if (!components.config) {
    return {
      ok: false,
      code: "VERSIONED_COMPATIBILITY_ERROR",
      message: "Missing versioned configuration snapshot.",
      components,
    };
  }

  const product = await getLegacyProductRow(productId);
  const assets = await validateProductRevisionAssets({
    customerUid: String(product?.customer_uid || ""),
    productId,
    assetRefs: components.assetRefs,
  });
  if (!assets.ok) {
    return {
      ok: false,
      code: "VERSIONED_ASSET_ERROR",
      message: "Required versioned assets missing.",
      components,
    };
  }

  return { ok: true, code: null, message: "ok", components };
}

/** Build a legacy components view for diagnostics when versioned apply is not used. */
export async function resolveLegacyComponentsView(productId: string) {
  const product = await getLegacyProductRow(productId);
  if (!product) return null;
  const legacy = getLegacyProductConfig(product);
  return {
    productId,
    source: "legacy" as const,
    config: legacy.config,
    assetRefs: legacy.assetRefs,
  };
}
