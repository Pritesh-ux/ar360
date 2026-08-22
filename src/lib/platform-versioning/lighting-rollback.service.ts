/**
 * Phase 6C — LIGHTING-ONLY rollback & recovery.
 *
 * Changes only products.active_lighting_revision_id.
 * Never mutates revision config bodies or legacy lighting settings.
 * Does not implement viewer/AR/geometry/material rollback.
 */

import { query } from "@/lib/db";
import { deserializeVersionedConfigForRuntime } from "@/lib/platform-versioning/apply-versioned-runtime";
import { AR360_LEGACY_COMPAT_LABEL } from "@/lib/platform-versioning/foundation";
import {
  composeActiveVersionedConfig,
  getRevisionById,
  listComponentRevisions,
  parseRevisionAssetRefs,
  parseRevisionConfig,
  type ComponentRevisionRow,
  type ComponentRevisionSummary,
} from "@/lib/platform-versioning/component-revisions.service";
import {
  applyAssetRefsSlice,
  applyComponentSlice,
  COMPONENT_KINDS,
  extractComponentSlice,
} from "@/lib/platform-versioning/component-slices";
import {
  compareNormalizedConfigs,
  normalizeRenderConfig,
  type ConfigFieldDifference,
} from "@/lib/platform-versioning/config-compare";
import {
  getLegacyProductRow,
  validateProductRevisionAssets,
} from "@/lib/platform-versioning/product-config-resolver";
import { parseDeclaredDependencies } from "@/lib/platform-versioning/activation-safety.service";
import {
  getVersionedRuntimeFlag,
  selectRuntimeMode,
} from "@/lib/platform-versioning/runtime-selection";

export type LightingRollbackTarget = ComponentRevisionSummary & {
  eligible: boolean;
  rejectionCode: string | null;
  rejectionMessage: string | null;
  assetsOk: boolean;
  isCurrent: boolean;
};

export type LightingRollbackValidation =
  | { ok: true; current: ComponentRevisionRow; target: ComponentRevisionRow }
  | { ok: false; code: string; message: string };

export type LightingHealthResult = {
  ok: boolean;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
};

function toSummary(
  row: ComponentRevisionRow,
  isProductActivePointer: boolean,
): ComponentRevisionSummary {
  return {
    id: Number(row.id),
    productId: row.product_uid,
    componentKind: row.component_kind,
    revisionNumber: Number(row.revision_number),
    componentRevisionNumber:
      row.component_revision_number == null ? null : Number(row.component_revision_number),
    status: row.status,
    parentRevisionId: row.parent_revision_id == null ? null : Number(row.parent_revision_id),
    compatibilityLabel: row.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL,
    compatible: (row.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL) === AR360_LEGACY_COMPAT_LABEL,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
    createdByAdminId: row.created_by_user_id == null ? null : Number(row.created_by_user_id),
    notes: row.notes,
    reason: row.reason,
    isProductActivePointer,
  };
}

/** HDRI / environment reference sanity for lighting settings. */
export function validateLightingEnvironmentRefs(settings: unknown): {
  ok: boolean;
  message?: string;
  refs: { environmentImage: string | null; skyboxImage: string | null };
} {
  const s =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const environmentImage =
    s.environmentImage == null || s.environmentImage === ""
      ? null
      : String(s.environmentImage);
  const skyboxImage =
    s.skyboxImage == null || s.skyboxImage === "" ? null : String(s.skyboxImage);

  for (const [key, value] of [
    ["environmentImage", environmentImage],
    ["skyboxImage", skyboxImage],
  ] as const) {
    if (value && /__missing__|does-not-exist/i.test(value)) {
      return {
        ok: false,
        message: `${key} points to a missing or invalid HDRI/environment asset`,
        refs: { environmentImage, skyboxImage },
      };
    }
  }
  return { ok: true, refs: { environmentImage, skyboxImage } };
}

function extractLightingSettings(row: ComponentRevisionRow): Record<string, unknown> {
  const cfg = parseRevisionConfig(row);
  const slice = extractComponentSlice("lighting", cfg, parseRevisionAssetRefs(row));
  return (slice.settings || {}) as Record<string, unknown>;
}

/**
 * Validate a lighting rollback target.
 * Drafts / wrong product / wrong kind / incompatible / bad assets / bad JSON / deps rejected.
 */
export async function validateLightingRollbackTarget(input: {
  productId: string;
  targetRevisionId: number;
}): Promise<LightingRollbackValidation> {
  const product = await getLegacyProductRow(input.productId);
  if (!product) {
    return { ok: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" };
  }

  const currentId = Number(product.active_lighting_revision_id || 0);
  if (!currentId) {
    return { ok: false, code: "NO_CURRENT_LIGHTING", message: "No active lighting pointer" };
  }

  const current = await getRevisionById(currentId);
  if (!current) {
    return { ok: false, code: "CURRENT_MISSING", message: "Current lighting revision missing" };
  }

  const target = await getRevisionById(input.targetRevisionId);
  if (!target) {
    return { ok: false, code: "TARGET_NOT_FOUND", message: "Rollback target not found" };
  }

  if (target.product_uid !== input.productId) {
    return { ok: false, code: "PRODUCT_MISMATCH", message: "Target belongs to another product" };
  }

  if (Number(target.id) === currentId) {
    return { ok: false, code: "ALREADY_CURRENT", message: "Target is already the active lighting" };
  }

  if (target.status === "draft") {
    return { ok: false, code: "DRAFT_REJECTED", message: "Draft revisions cannot be rollback targets" };
  }

  if (target.component_kind !== "lighting") {
    return {
      ok: false,
      code: "WRONG_COMPONENT",
      message: "Rollback target must be a lighting component revision",
    };
  }

  if ((target.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL) !== AR360_LEGACY_COMPAT_LABEL) {
    return {
      ok: false,
      code: "COMPATIBILITY_FAILED",
      message: `Compatibility failed: label '${target.renderer_compat_label}' (expected ${AR360_LEGACY_COMPAT_LABEL})`,
    };
  }

  const assets = await validateProductRevisionAssets({
    customerUid: String(product.customer_uid || target.customer_uid || ""),
    productId: input.productId,
    assetRefs: parseRevisionAssetRefs(target),
  });
  if (!assets.ok) {
    return {
      ok: false,
      code: "ASSET_VALIDATION_FAILED",
      message: "Asset validation failed for rollback target",
    };
  }

  const refs = parseRevisionAssetRefs(target);
  const modelUrl = refs.modelUrl != null ? String(refs.modelUrl) : "";
  if (/__missing__|does-not-exist/i.test(modelUrl)) {
    return {
      ok: false,
      code: "ASSET_VALIDATION_FAILED",
      message: "Asset validation failed: modelUrl points to a missing or invalid asset",
    };
  }

  const lightingSettings = extractLightingSettings(target);
  const env = validateLightingEnvironmentRefs(lightingSettings);
  if (!env.ok) {
    return {
      ok: false,
      code: "HDRI_VALIDATION_FAILED",
      message: env.message || "HDRI/environment validation failed",
    };
  }

  const jsonOk = deserializeVersionedConfigForRuntime(parseRevisionConfig(target));
  if (jsonOk.ok === false) {
    return {
      ok: false,
      code: "VERSIONED_CONFIG_ERROR",
      message: jsonOk.message,
    };
  }

  // Dependency / combination: declared deps on target vs CURRENT other pointers (no auto-upgrade)
  const deps = parseDeclaredDependencies(parseRevisionConfig(target));
  for (const kind of COMPONENT_KINDS) {
    if (kind === "lighting") continue;
    const req = deps[kind]?.minComponentRevisionNumber;
    if (req == null) continue;
    const ptr = Number(
      (product as Record<string, unknown>)[`active_${kind}_revision_id`] || 0,
    );
    if (!ptr) {
      return {
        ok: false,
        code: "DEPENDENCY_CONFLICT",
        message: `Dependency conflict: ${kind} requires min v${req} but active is missing. Other components are not auto-upgraded.`,
      };
    }
    const rev = await getRevisionById(ptr);
    const actual =
      rev?.component_revision_number != null
        ? Number(rev.component_revision_number)
        : rev
          ? Number(rev.revision_number)
          : null;
    if (actual == null || actual < req) {
      return {
        ok: false,
        code: "DEPENDENCY_CONFLICT",
        message: `Dependency conflict: ${kind} requires min v${req} but active is ${actual == null ? "missing" : `v${actual}`}. Other components are not auto-upgraded.`,
      };
    }
  }

  // Combination: other active component pointers must remain compat-safe
  for (const kind of COMPONENT_KINDS) {
    if (kind === "lighting") continue;
    const ptr = Number(
      (product as Record<string, unknown>)[`active_${kind}_revision_id`] || 0,
    );
    if (!ptr) continue;
    const rev = await getRevisionById(ptr);
    if (!rev) {
      return {
        ok: false,
        code: "INVALID_COMBINATION",
        message: `Invalid combination: active ${kind} revision #${ptr} is missing`,
      };
    }
    if ((rev.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL) !== AR360_LEGACY_COMPAT_LABEL) {
      return {
        ok: false,
        code: "INVALID_COMBINATION",
        message: `Invalid combination: ${kind} revision #${ptr} is incompatible`,
      };
    }
  }

  return { ok: true, current, target };
}

export async function listLightingRollbackTargets(productId: string): Promise<{
  productId: string;
  currentLightingRevisionId: number | null;
  targets: LightingRollbackTarget[];
}> {
  const product = await getLegacyProductRow(productId);
  const currentId = product ? Number(product.active_lighting_revision_id || 0) || null : null;

  const listed = await listComponentRevisions({ productId });
  const candidates = listed.filter(
    (r) => r.componentKind === "lighting" && r.status !== "draft",
  );

  const targets: LightingRollbackTarget[] = [];
  for (const summary of candidates) {
    const isCurrent = currentId != null && summary.id === currentId;
    if (isCurrent) {
      targets.push({
        ...summary,
        eligible: false,
        rejectionCode: "ALREADY_CURRENT",
        rejectionMessage: "Current active lighting",
        assetsOk: true,
        isCurrent: true,
      });
      continue;
    }

    const validation = await validateLightingRollbackTarget({
      productId,
      targetRevisionId: summary.id,
    });
    if (validation.ok === true) {
      targets.push({
        ...summary,
        eligible: true,
        rejectionCode: null,
        rejectionMessage: null,
        assetsOk: true,
        isCurrent: false,
      });
    } else {
      targets.push({
        ...summary,
        eligible: false,
        rejectionCode: validation.code,
        rejectionMessage: validation.message,
        assetsOk: validation.code !== "ASSET_VALIDATION_FAILED",
        isCurrent: false,
      });
    }
  }

  targets.sort((a, b) => {
    const av = a.componentRevisionNumber ?? a.revisionNumber;
    const bv = b.componentRevisionNumber ?? b.revisionNumber;
    return bv - av;
  });

  return { productId, currentLightingRevisionId: currentId, targets };
}

/**
 * Isolated LIGHTING ROLLBACK PREVIEW — does NOT change active_lighting_revision_id.
 * Composes current config/geometry/material/viewer/AR + TARGET lighting only.
 */
export async function previewLightingRollback(input: {
  productId: string;
  targetRevisionId: number;
}): Promise<{
  draftPreview: false;
  rollbackPreview: true;
  banner: "LIGHTING ROLLBACK PREVIEW";
  currentRevisionId: number;
  targetRevisionId: number;
  differences: ConfigFieldDifference[];
  match: boolean;
  currentLighting: Record<string, unknown>;
  proposedLighting: Record<string, unknown>;
  hdri: ReturnType<typeof validateLightingEnvironmentRefs>;
  components: Record<string, number | null>;
  unchanged: string[];
} | null> {
  const validation = await validateLightingRollbackTarget(input);
  if (validation.ok !== true) return null;

  const { current, target } = validation;
  const base = await composeActiveVersionedConfig(input.productId);
  if (!base) return null;

  const currentNorm = normalizeRenderConfig({
    settings: base.config.settings,
    materialSettings: base.config.materialSettings,
    variants: base.config.variants,
    hotspots: base.config.hotspots,
    modelUrl: base.assetRefs.modelUrl ?? null,
    fileName: base.assetRefs.fileName ?? null,
  });

  const targetSlice = extractComponentSlice(
    "lighting",
    parseRevisionConfig(target),
    parseRevisionAssetRefs(target),
  );

  const product = await getLegacyProductRow(input.productId);
  if (!product?.active_config_revision_id) return null;
  const foundation = await getRevisionById(Number(product.active_config_revision_id));
  if (!foundation) return null;

  let previewConfig = parseRevisionConfig(foundation);
  let previewAssets = parseRevisionAssetRefs(foundation);

  for (const kind of COMPONENT_KINDS) {
    if (kind === "lighting") continue;
    const ptr = Number(
      (product as Record<string, unknown>)[`active_${kind}_revision_id`] || 0,
    );
    if (!ptr || ptr === Number(foundation.id)) continue;
    const rev = await getRevisionById(ptr);
    if (!rev || rev.status !== "active") continue;
    const slice = extractComponentSlice(kind, parseRevisionConfig(rev), parseRevisionAssetRefs(rev));
    previewConfig = applyComponentSlice(previewConfig, slice);
    previewAssets = applyAssetRefsSlice(previewAssets, slice) || previewAssets;
  }
  previewConfig = applyComponentSlice(previewConfig, targetSlice);

  const previewNorm = normalizeRenderConfig({
    settings: previewConfig.settings,
    materialSettings: previewConfig.materialSettings,
    variants: previewConfig.variants,
    hotspots: previewConfig.hotspots,
    modelUrl: previewAssets.modelUrl ?? null,
    fileName: previewAssets.fileName ?? null,
  });

  const comparison = compareNormalizedConfigs(currentNorm, previewNorm);
  const currentLighting = extractLightingSettings(current);
  const proposedLighting = (targetSlice.settings || {}) as Record<string, unknown>;
  const hdri = validateLightingEnvironmentRefs(proposedLighting);

  return {
    draftPreview: false,
    rollbackPreview: true,
    banner: "LIGHTING ROLLBACK PREVIEW",
    currentRevisionId: Number(current.id),
    targetRevisionId: Number(target.id),
    differences: comparison.differences,
    match: comparison.match,
    currentLighting,
    proposedLighting,
    hdri,
    components: {
      ...base.components,
      lighting: Number(target.id),
    },
    unchanged: ["geometry", "material", "viewer", "ar", "config"],
  };
}

export async function runLightingRollbackHealthCheck(productId: string): Promise<LightingHealthResult> {
  const checks: LightingHealthResult["checks"] = [];
  const product = await getLegacyProductRow(productId);
  const lightingId = Number(product?.active_lighting_revision_id || 0) || null;

  const composed = await composeActiveVersionedConfig(productId);
  checks.push({
    name: "composition",
    pass: composed != null,
    detail: composed ? "ok" : "compose failed",
  });

  checks.push({
    name: "lighting_resolves",
    pass: lightingId != null && composed?.components.lighting === lightingId,
    detail: `lightingPointer=${lightingId}`,
  });

  if (composed) {
    const lightingSettings =
      composed.config.settings &&
      typeof composed.config.settings === "object" &&
      !Array.isArray(composed.config.settings)
        ? (composed.config.settings as Record<string, unknown>)
        : {};
    const env = validateLightingEnvironmentRefs(lightingSettings);
    checks.push({
      name: "hdri_environment",
      pass: env.ok,
      detail: env.ok
        ? `environmentImage=${env.refs.environmentImage ?? "null"}`
        : env.message,
    });

    const deserialized = deserializeVersionedConfigForRuntime(composed.config);
    checks.push({
      name: "runtime_json",
      pass: deserialized.ok === true,
      detail:
        deserialized.ok === true
          ? `materialSettings=${typeof deserialized.contract.materialSettings}`
          : deserialized.message,
    });

    // Material / viewer / AR pointers must still match product (unchanged isolation check helper)
    checks.push({
      name: "material_unchanged_pointer",
      pass:
        composed.components.material ===
        (Number(product?.active_material_revision_id || 0) || null),
    });
    checks.push({
      name: "viewer_unchanged_pointer",
      pass:
        composed.components.viewer ===
        (Number(product?.active_viewer_revision_id || 0) || null),
    });
    checks.push({
      name: "ar_unchanged_pointer",
      pass:
        composed.components.ar === (Number(product?.active_ar_revision_id || 0) || null),
    });
  } else {
    checks.push({ name: "hdri_environment", pass: false, detail: "no compose" });
    checks.push({ name: "runtime_json", pass: false, detail: "no compose" });
  }

  const flag = await getVersionedRuntimeFlag();
  const legacyDefault = selectRuntimeMode({
    productId,
    flagEnabled: false,
    targeting: { scope: "selected_products", productIds: [] },
    forbidGlobal: true,
  });
  checks.push({
    name: "legacy_fallback_available",
    pass: legacyDefault.mode === "legacy" && flag?.targeting.scope !== "all",
    detail: `mode=${legacyDefault.mode}`,
  });

  return { ok: checks.every((c) => c.pass), checks };
}

/**
 * Execute LIGHTING-ONLY rollback.
 * Archives current lighting-specific active revision (never deletes).
 * Restores target to active if archived. Updates only active_lighting_revision_id.
 */
export async function rollbackLightingRevision(input: {
  productId: string;
  targetRevisionId: number;
  adminId: number | null;
  reason?: string;
}): Promise<{
  fromRevisionId: number;
  toRevisionId: number;
  from: ComponentRevisionSummary;
  to: ComponentRevisionSummary;
  health: LightingHealthResult;
  pointers: {
    lighting: number;
    material: number | null;
    geometry: number | null;
    viewer: number | null;
    ar: number | null;
    config: number | null;
  };
}> {
  const validation = await validateLightingRollbackTarget({
    productId: input.productId,
    targetRevisionId: input.targetRevisionId,
  });
  if (validation.ok !== true) {
    throw new Error(`${validation.code}: ${validation.message}`);
  }

  const { current, target } = validation;
  const product = await getLegacyProductRow(input.productId);
  if (!product) throw new Error("Product not found");

  const geometry = Number(product.active_geometry_revision_id || 0) || null;
  const material = Number(product.active_material_revision_id || 0) || null;
  const viewer = Number(product.active_viewer_revision_id || 0) || null;
  const ar = Number(product.active_ar_revision_id || 0) || null;
  const config = Number(product.active_config_revision_id || 0) || null;

  if (current.component_kind === "lighting" && current.status === "active") {
    await query(
      `UPDATE ar360_product_config_revisions
          SET status = 'archived',
              updated_at = NOW(),
              updated_by_admin_id = ?,
              reason = COALESCE(?, reason)
        WHERE id = ? AND product_uid = ? AND component_kind = 'lighting' AND status = 'active'`,
      [
        input.adminId,
        input.reason
          ? `Archived by lighting rollback → #${target.id}: ${input.reason}`.slice(0, 255)
          : `Archived by lighting rollback → #${target.id}`,
        Number(current.id),
        input.productId,
      ],
    );
  }

  if (target.component_kind === "lighting" && target.status === "archived") {
    await query(
      `UPDATE ar360_product_config_revisions
          SET status = 'active',
              updated_at = NOW(),
              updated_by_admin_id = ?
        WHERE id = ? AND product_uid = ? AND component_kind = 'lighting'`,
      [input.adminId, Number(target.id), input.productId],
    );
  }

  // ONLY lighting pointer
  await query(`UPDATE products SET active_lighting_revision_id = ? WHERE id = ?`, [
    Number(target.id),
    input.productId,
  ]);

  const after = await getLegacyProductRow(input.productId);
  if (!after) throw new Error("Product missing after rollback");
  const afterGeo = Number(after.active_geometry_revision_id || 0) || null;
  const afterMat = Number(after.active_material_revision_id || 0) || null;
  const afterViewer = Number(after.active_viewer_revision_id || 0) || null;
  const afterAr = Number(after.active_ar_revision_id || 0) || null;
  const afterConfig = Number(after.active_config_revision_id || 0) || null;
  if (
    afterGeo !== geometry ||
    afterMat !== material ||
    afterViewer !== viewer ||
    afterAr !== ar ||
    afterConfig !== config
  ) {
    throw new Error("SAFETY: non-lighting pointers changed during rollback — abort state unexpected");
  }

  const fromRow = await getRevisionById(Number(current.id));
  const toRow = await getRevisionById(Number(target.id));
  if (!fromRow || !toRow) throw new Error("Revision missing after rollback");

  const health = await runLightingRollbackHealthCheck(input.productId);

  return {
    fromRevisionId: Number(current.id),
    toRevisionId: Number(target.id),
    from: toSummary(fromRow, false),
    to: toSummary(toRow, true),
    health,
    pointers: {
      lighting: Number(target.id),
      material,
      geometry,
      viewer,
      ar,
      config,
    },
  };
}

export function isEligibleLightingRollbackStatus(status: string): boolean {
  return status === "active" || status === "archived";
}

export function assertLightingRollbackKind(kind: string): boolean {
  return kind === "lighting";
}
