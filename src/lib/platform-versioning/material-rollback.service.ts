/**
 * Phase 6A — MATERIAL-ONLY rollback & recovery.
 *
 * Changes only products.active_material_revision_id.
 * Never mutates revision config bodies or legacy material_settings.
 * Does not implement lighting/viewer/AR/geometry rollback.
 */

import { query } from "@/lib/db";
import { AR360_LEGACY_COMPAT_LABEL } from "@/lib/platform-versioning/foundation";
import {
  composeActiveVersionedConfig,
  diffComponentRevisions,
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

export type MaterialRollbackTarget = ComponentRevisionSummary & {
  eligible: boolean;
  rejectionCode: string | null;
  rejectionMessage: string | null;
  assetsOk: boolean;
  isCurrent: boolean;
};

export type MaterialRollbackValidation =
  | { ok: true; current: ComponentRevisionRow; target: ComponentRevisionRow }
  | { ok: false; code: string; message: string };

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

/**
 * Validate a rollback target. Drafts / wrong product / incompatible / bad assets rejected.
 */
export async function validateMaterialRollbackTarget(input: {
  productId: string;
  targetRevisionId: number;
}): Promise<MaterialRollbackValidation> {
  const product = await getLegacyProductRow(input.productId);
  if (!product) {
    return { ok: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" };
  }

  const currentId = Number(product.active_material_revision_id || 0);
  if (!currentId) {
    return { ok: false, code: "NO_CURRENT_MATERIAL", message: "No active material pointer" };
  }

  const current = await getRevisionById(currentId);
  if (!current) {
    return { ok: false, code: "CURRENT_MISSING", message: "Current material revision missing" };
  }

  const target = await getRevisionById(input.targetRevisionId);
  if (!target) {
    return { ok: false, code: "TARGET_NOT_FOUND", message: "Rollback target not found" };
  }

  if (target.product_uid !== input.productId) {
    return { ok: false, code: "PRODUCT_MISMATCH", message: "Target belongs to another product" };
  }

  if (Number(target.id) === currentId) {
    return { ok: false, code: "ALREADY_CURRENT", message: "Target is already the active material" };
  }

  if (target.status === "draft") {
    return { ok: false, code: "DRAFT_REJECTED", message: "Draft revisions cannot be rollback targets" };
  }

  // Material-only: allow material component revisions, or foundation config used as material source.
  if (target.component_kind !== "material" && target.component_kind !== "config") {
    return {
      ok: false,
      code: "WRONG_COMPONENT",
      message: "Rollback target must be a material (or foundation config) revision",
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

  return { ok: true, current, target };
}

/**
 * List material rollback candidates with eligibility flags.
 */
export async function listMaterialRollbackTargets(
  productId: string,
): Promise<{
  productId: string;
  currentMaterialRevisionId: number | null;
  targets: MaterialRollbackTarget[];
}> {
  const product = await getLegacyProductRow(productId);
  const currentId = product ? Number(product.active_material_revision_id || 0) || null : null;

  const listed = await listComponentRevisions({ productId });
  const candidates = listed.filter(
    (r) =>
      (r.componentKind === "material" || r.componentKind === "config") &&
      r.status !== "draft",
  );

  const targets: MaterialRollbackTarget[] = [];
  for (const summary of candidates) {
    const isCurrent = currentId != null && summary.id === currentId;
    if (isCurrent) {
      targets.push({
        ...summary,
        eligible: false,
        rejectionCode: "ALREADY_CURRENT",
        rejectionMessage: "Current active material",
        assetsOk: true,
        isCurrent: true,
      });
      continue;
    }

    const validation = await validateMaterialRollbackTarget({
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

  return { productId, currentMaterialRevisionId: currentId, targets };
}

/**
 * Isolated rollback preview — does NOT change active_material_revision_id.
 * Composes current geometry/lighting/viewer/AR/config with TARGET material only.
 */
export async function previewMaterialRollback(input: {
  productId: string;
  targetRevisionId: number;
}): Promise<{
  draftPreview: false;
  rollbackPreview: true;
  banner: "ROLLBACK PREVIEW";
  currentRevisionId: number;
  targetRevisionId: number;
  differences: ConfigFieldDifference[];
  match: boolean;
  composedMaterial0: unknown;
  currentMaterial0: unknown;
  components: Record<string, number | null>;
} | null> {
  const validation = await validateMaterialRollbackTarget(input);
  if (validation.ok !== true) return null;

  const { current, target } = validation;
  const base = await composeActiveVersionedConfig(input.productId);
  if (!base) return null;

  // Current composed config (includes current material)
  const currentNorm = normalizeRenderConfig({
    settings: base.config.settings,
    materialSettings: base.config.materialSettings,
    variants: base.config.variants,
    hotspots: base.config.hotspots,
    modelUrl: base.assetRefs.modelUrl ?? null,
    fileName: base.assetRefs.fileName ?? null,
  });

  // Preview: same composition but material slice from target
  const targetSlice = extractComponentSlice(
    "material",
    parseRevisionConfig(target),
    parseRevisionAssetRefs(target),
  );
  // Start from foundation+non-material components: rebuild without current material overlay
  const product = await getLegacyProductRow(input.productId);
  if (!product?.active_config_revision_id) return null;
  const foundation = await getRevisionById(Number(product.active_config_revision_id));
  if (!foundation) return null;

  let previewConfig = parseRevisionConfig(foundation);
  let previewAssets = parseRevisionAssetRefs(foundation);

  for (const kind of COMPONENT_KINDS) {
    if (kind === "material") continue;
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
  const mats = previewConfig.materialSettings as Record<string, unknown> | null;
  const curMats = base.config.materialSettings as Record<string, unknown> | null;

  return {
    draftPreview: false,
    rollbackPreview: true,
    banner: "ROLLBACK PREVIEW",
    currentRevisionId: Number(current.id),
    targetRevisionId: Number(target.id),
    differences: comparison.differences,
    match: comparison.match,
    composedMaterial0: mats?.["0"] ?? null,
    currentMaterial0: curMats?.["0"] ?? null,
    components: {
      ...base.components,
      material: Number(target.id),
    },
  };
}

/**
 * Execute MATERIAL-ONLY rollback.
 * Archives current material-specific active revision (never deletes).
 * Restores target to active if archived. Updates only active_material_revision_id.
 */
export async function rollbackMaterialRevision(input: {
  productId: string;
  targetRevisionId: number;
  adminId: number | null;
  reason?: string;
}): Promise<{
  fromRevisionId: number;
  toRevisionId: number;
  from: ComponentRevisionSummary;
  to: ComponentRevisionSummary;
  pointers: {
    material: number;
    geometry: number | null;
    lighting: number | null;
    viewer: number | null;
    ar: number | null;
    config: number | null;
  };
}> {
  const validation = await validateMaterialRollbackTarget({
    productId: input.productId,
    targetRevisionId: input.targetRevisionId,
  });
  if (validation.ok !== true) {
    throw new Error(`${validation.code}: ${validation.message}`);
  }

  const { current, target } = validation;
  const product = await getLegacyProductRow(input.productId);
  if (!product) throw new Error("Product not found");

  // Snapshot other pointers for return (must remain unchanged)
  const geometry = Number(product.active_geometry_revision_id || 0) || null;
  const lighting = Number(product.active_lighting_revision_id || 0) || null;
  const viewer = Number(product.active_viewer_revision_id || 0) || null;
  const ar = Number(product.active_ar_revision_id || 0) || null;
  const config = Number(product.active_config_revision_id || 0) || null;

  // Archive current if it is a material-kind active revision (never archive foundation config).
  if (current.component_kind === "material" && current.status === "active") {
    await query(
      `UPDATE ar360_product_config_revisions
          SET status = 'archived',
              updated_at = NOW(),
              updated_by_admin_id = ?,
              reason = COALESCE(?, reason)
        WHERE id = ? AND product_uid = ? AND component_kind = 'material' AND status = 'active'`,
      [
        input.adminId,
        input.reason
          ? `Archived by material rollback → #${target.id}: ${input.reason}`.slice(0, 255)
          : `Archived by material rollback → #${target.id}`,
        Number(current.id),
        input.productId,
      ],
    );
  }

  // Restore target to active if it was archived (config foundation already active — skip)
  if (target.component_kind === "material" && target.status === "archived") {
    await query(
      `UPDATE ar360_product_config_revisions
          SET status = 'active',
              updated_at = NOW(),
              updated_by_admin_id = ?
        WHERE id = ? AND product_uid = ? AND component_kind = 'material'`,
      [input.adminId, Number(target.id), input.productId],
    );
  }

  // ONLY material pointer
  await query(`UPDATE products SET active_material_revision_id = ? WHERE id = ?`, [
    Number(target.id),
    input.productId,
  ]);

  // Verify other pointers untouched
  const after = await getLegacyProductRow(input.productId);
  if (!after) throw new Error("Product missing after rollback");
  const afterGeo = Number(after.active_geometry_revision_id || 0) || null;
  const afterLight = Number(after.active_lighting_revision_id || 0) || null;
  const afterViewer = Number(after.active_viewer_revision_id || 0) || null;
  const afterAr = Number(after.active_ar_revision_id || 0) || null;
  const afterConfig = Number(after.active_config_revision_id || 0) || null;
  if (
    afterGeo !== geometry ||
    afterLight !== lighting ||
    afterViewer !== viewer ||
    afterAr !== ar ||
    afterConfig !== config
  ) {
    throw new Error("SAFETY: non-material pointers changed during rollback — abort state unexpected");
  }

  const fromRow = await getRevisionById(Number(current.id));
  const toRow = await getRevisionById(Number(target.id));
  if (!fromRow || !toRow) throw new Error("Revision missing after rollback");

  return {
    fromRevisionId: Number(current.id),
    toRevisionId: Number(target.id),
    from: toSummary(fromRow, false),
    to: toSummary(toRow, true),
    pointers: {
      material: Number(target.id),
      geometry,
      lighting,
      viewer,
      ar,
      config,
    },
  };
}

/** Pure helper for unit tests: reject draft / wrong kind without DB. */
export function isEligibleMaterialRollbackStatus(status: string): boolean {
  return status === "active" || status === "archived";
}

export function assertMaterialRollbackKind(kind: string): boolean {
  return kind === "material" || kind === "config";
}

export { diffComponentRevisions };
