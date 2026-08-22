/**
 * Shared pointer-only rollback core for Phase 6D (viewer / AR).
 * Does not implement geometry rollback. Never mutates legacy product columns.
 */

import { query } from "@/lib/db";
import { deserializeVersionedConfigForRuntime } from "@/lib/platform-versioning/apply-versioned-runtime";
import { parseDeclaredDependencies } from "@/lib/platform-versioning/activation-safety.service";
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
  type ComponentKind,
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
import {
  getVersionedRuntimeFlag,
  selectRuntimeMode,
} from "@/lib/platform-versioning/runtime-selection";

export type PointerRollbackKind = "viewer" | "ar";

export type PointerRollbackTarget = ComponentRevisionSummary & {
  eligible: boolean;
  rejectionCode: string | null;
  rejectionMessage: string | null;
  assetsOk: boolean;
  isCurrent: boolean;
};

export type PointerRollbackValidation =
  | { ok: true; current: ComponentRevisionRow; target: ComponentRevisionRow }
  | { ok: false; code: string; message: string };

export type PointerHealthResult = {
  ok: boolean;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
};

const KIND_META: Record<
  PointerRollbackKind,
  {
    column: string;
    banner: "VIEWER ROLLBACK PREVIEW" | "AR ROLLBACK PREVIEW";
    validationCode: "VIEWER_VALIDATION_FAILED" | "AR_VALIDATION_FAILED";
    urlKeys: string[];
    unchanged: string[];
  }
> = {
  viewer: {
    column: "active_viewer_revision_id",
    banner: "VIEWER ROLLBACK PREVIEW",
    validationCode: "VIEWER_VALIDATION_FAILED",
    urlKeys: [], // viewer slice has no URL asset fields; poison strings still checked
    unchanged: ["geometry", "material", "lighting", "ar", "config"],
  },
  ar: {
    column: "active_ar_revision_id",
    banner: "AR ROLLBACK PREVIEW",
    validationCode: "AR_VALIDATION_FAILED",
    urlKeys: ["arModelUrl", "usdzUrl"],
    unchanged: ["geometry", "material", "lighting", "viewer", "config"],
  },
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

function extractKindSettings(
  kind: PointerRollbackKind,
  row: ComponentRevisionRow,
): Record<string, unknown> {
  const slice = extractComponentSlice(kind, parseRevisionConfig(row), parseRevisionAssetRefs(row));
  return (slice.settings || {}) as Record<string, unknown>;
}

/** Validate viewer/AR slice settings against existing schema fields only. */
export function validateKindSpecificSettings(
  kind: PointerRollbackKind,
  settings: unknown,
): { ok: true } | { ok: false; code: string; message: string } {
  const meta = KIND_META[kind];
  const s =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};

  for (const [key, value] of Object.entries(s)) {
    if (value == null) continue;
    if (typeof value === "string" && /__missing__|does-not-exist/i.test(value)) {
      return {
        ok: false,
        code: meta.validationCode,
        message: `${kind} setting '${key}' points to a missing or invalid asset/reference`,
      };
    }
  }

  for (const urlKey of meta.urlKeys) {
    const value = s[urlKey];
    if (value == null || value === "") continue;
    if (typeof value !== "string") {
      return {
        ok: false,
        code: meta.validationCode,
        message: `${kind} setting '${urlKey}' must be a string URL when set`,
      };
    }
    if (/__missing__|does-not-exist/i.test(value)) {
      return {
        ok: false,
        code: meta.validationCode,
        message: `${kind} setting '${urlKey}' points to a missing or invalid asset`,
      };
    }
  }

  return { ok: true };
}

export async function validatePointerRollbackTarget(input: {
  kind: PointerRollbackKind;
  productId: string;
  targetRevisionId: number;
}): Promise<PointerRollbackValidation> {
  const { kind } = input;
  const meta = KIND_META[kind];
  const product = await getLegacyProductRow(input.productId);
  if (!product) {
    return { ok: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" };
  }

  const currentId = Number((product as Record<string, unknown>)[meta.column] || 0);
  if (!currentId) {
    return {
      ok: false,
      code: `NO_CURRENT_${kind.toUpperCase()}`,
      message: `No active ${kind} pointer`,
    };
  }

  const current = await getRevisionById(currentId);
  if (!current) {
    return { ok: false, code: "CURRENT_MISSING", message: `Current ${kind} revision missing` };
  }

  const target = await getRevisionById(input.targetRevisionId);
  if (!target) {
    return { ok: false, code: "TARGET_NOT_FOUND", message: "Rollback target not found" };
  }

  if (target.product_uid !== input.productId) {
    return { ok: false, code: "PRODUCT_MISMATCH", message: "Target belongs to another product" };
  }

  if (Number(target.id) === currentId) {
    return {
      ok: false,
      code: "ALREADY_CURRENT",
      message: `Target is already the active ${kind}`,
    };
  }

  if (target.status === "draft") {
    return { ok: false, code: "DRAFT_REJECTED", message: "Draft revisions cannot be rollback targets" };
  }

  if (target.component_kind !== kind) {
    return {
      ok: false,
      code: "WRONG_COMPONENT",
      message: `Rollback target must be a ${kind} component revision`,
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

  const kindSettings = extractKindSettings(kind, target);
  const specific = validateKindSpecificSettings(kind, kindSettings);
  if (specific.ok === false) return specific;

  const jsonOk = deserializeVersionedConfigForRuntime(parseRevisionConfig(target));
  if (jsonOk.ok === false) {
    return {
      ok: false,
      code: "VERSIONED_CONFIG_ERROR",
      message: jsonOk.message,
    };
  }

  const deps = parseDeclaredDependencies(parseRevisionConfig(target));
  for (const other of COMPONENT_KINDS) {
    if (other === kind) continue;
    const req = deps[other]?.minComponentRevisionNumber;
    if (req == null) continue;
    const ptr = Number(
      (product as Record<string, unknown>)[`active_${other}_revision_id`] || 0,
    );
    if (!ptr) {
      return {
        ok: false,
        code: "DEPENDENCY_CONFLICT",
        message: `Dependency conflict: ${other} requires min v${req} but active is missing. Other components are not auto-upgraded.`,
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
        message: `Dependency conflict: ${other} requires min v${req} but active is ${actual == null ? "missing" : `v${actual}`}. Other components are not auto-upgraded.`,
      };
    }
  }

  for (const other of COMPONENT_KINDS) {
    if (other === kind) continue;
    const ptr = Number(
      (product as Record<string, unknown>)[`active_${other}_revision_id`] || 0,
    );
    if (!ptr) continue;
    const rev = await getRevisionById(ptr);
    if (!rev) {
      return {
        ok: false,
        code: "INVALID_COMBINATION",
        message: `Invalid combination: active ${other} revision #${ptr} is missing`,
      };
    }
    if ((rev.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL) !== AR360_LEGACY_COMPAT_LABEL) {
      return {
        ok: false,
        code: "INVALID_COMBINATION",
        message: `Invalid combination: ${other} revision #${ptr} is incompatible`,
      };
    }
  }

  return { ok: true, current, target };
}

export async function listPointerRollbackTargets(
  kind: PointerRollbackKind,
  productId: string,
): Promise<{
  productId: string;
  currentRevisionId: number | null;
  targets: PointerRollbackTarget[];
}> {
  const meta = KIND_META[kind];
  const product = await getLegacyProductRow(productId);
  const currentId = product
    ? Number((product as Record<string, unknown>)[meta.column] || 0) || null
    : null;

  const listed = await listComponentRevisions({ productId });
  const candidates = listed.filter((r) => r.componentKind === kind && r.status !== "draft");

  const targets: PointerRollbackTarget[] = [];
  for (const summary of candidates) {
    const isCurrent = currentId != null && summary.id === currentId;
    if (isCurrent) {
      targets.push({
        ...summary,
        eligible: false,
        rejectionCode: "ALREADY_CURRENT",
        rejectionMessage: `Current active ${kind}`,
        assetsOk: true,
        isCurrent: true,
      });
      continue;
    }

    const validation = await validatePointerRollbackTarget({
      kind,
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

  return { productId, currentRevisionId: currentId, targets };
}

export async function previewPointerRollback(input: {
  kind: PointerRollbackKind;
  productId: string;
  targetRevisionId: number;
}): Promise<{
  draftPreview: false;
  rollbackPreview: true;
  banner: "VIEWER ROLLBACK PREVIEW" | "AR ROLLBACK PREVIEW";
  kind: PointerRollbackKind;
  currentRevisionId: number;
  targetRevisionId: number;
  differences: ConfigFieldDifference[];
  match: boolean;
  currentSettings: Record<string, unknown>;
  proposedSettings: Record<string, unknown>;
  components: Record<string, number | null>;
  unchanged: string[];
} | null> {
  const { kind } = input;
  const meta = KIND_META[kind];
  const validation = await validatePointerRollbackTarget(input);
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
    kind,
    parseRevisionConfig(target),
    parseRevisionAssetRefs(target),
  );

  const product = await getLegacyProductRow(input.productId);
  if (!product?.active_config_revision_id) return null;
  const foundation = await getRevisionById(Number(product.active_config_revision_id));
  if (!foundation) return null;

  let previewConfig = parseRevisionConfig(foundation);
  let previewAssets = parseRevisionAssetRefs(foundation);

  for (const other of COMPONENT_KINDS) {
    if (other === kind) continue;
    const ptr = Number(
      (product as Record<string, unknown>)[`active_${other}_revision_id`] || 0,
    );
    if (!ptr || ptr === Number(foundation.id)) continue;
    const rev = await getRevisionById(ptr);
    if (!rev || rev.status !== "active") continue;
    const slice = extractComponentSlice(other, parseRevisionConfig(rev), parseRevisionAssetRefs(rev));
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

  return {
    draftPreview: false,
    rollbackPreview: true,
    banner: meta.banner,
    kind,
    currentRevisionId: Number(current.id),
    targetRevisionId: Number(target.id),
    differences: comparison.differences,
    match: comparison.match,
    currentSettings: extractKindSettings(kind, current),
    proposedSettings: (targetSlice.settings || {}) as Record<string, unknown>,
    components: {
      ...base.components,
      [kind]: Number(target.id),
    },
    unchanged: meta.unchanged,
  };
}

export async function runPointerRollbackHealthCheck(
  kind: PointerRollbackKind,
  productId: string,
): Promise<PointerHealthResult> {
  const meta = KIND_META[kind];
  const checks: PointerHealthResult["checks"] = [];
  const product = await getLegacyProductRow(productId);
  const pointerId =
    Number((product as Record<string, unknown> | undefined)?.[meta.column] || 0) || null;

  const composed = await composeActiveVersionedConfig(productId);
  checks.push({
    name: "composition",
    pass: composed != null,
    detail: composed ? "ok" : "compose failed",
  });

  checks.push({
    name: `${kind}_resolves`,
    pass: pointerId != null && composed?.components[kind] === pointerId,
    detail: `${kind}Pointer=${pointerId}`,
  });

  if (composed) {
    const settings =
      composed.config.settings &&
      typeof composed.config.settings === "object" &&
      !Array.isArray(composed.config.settings)
        ? (composed.config.settings as Record<string, unknown>)
        : {};
    const specific = validateKindSpecificSettings(kind, settings);
    checks.push({
      name: `${kind}_config`,
      pass: specific.ok === true,
      detail: specific.ok === true ? "ok" : specific.message,
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

    const peers: ComponentKind[] =
      kind === "viewer"
        ? ["material", "lighting", "ar"]
        : ["material", "lighting", "viewer"];
    for (const peer of peers) {
      const expected =
        Number((product as Record<string, unknown>)[`active_${peer}_revision_id`] || 0) || null;
      checks.push({
        name: `${peer}_unchanged_pointer`,
        pass: composed.components[peer] === expected,
      });
    }
  } else {
    checks.push({ name: `${kind}_config`, pass: false, detail: "no compose" });
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

export async function rollbackPointerRevision(input: {
  kind: PointerRollbackKind;
  productId: string;
  targetRevisionId: number;
  adminId: number | null;
  reason?: string;
}): Promise<{
  fromRevisionId: number;
  toRevisionId: number;
  from: ComponentRevisionSummary;
  to: ComponentRevisionSummary;
  health: PointerHealthResult;
  pointers: {
    viewer: number | null;
    ar: number | null;
    material: number | null;
    lighting: number | null;
    geometry: number | null;
    config: number | null;
  };
}> {
  const { kind } = input;
  const meta = KIND_META[kind];
  const validation = await validatePointerRollbackTarget({
    kind,
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
  const lighting = Number(product.active_lighting_revision_id || 0) || null;
  const viewer = Number(product.active_viewer_revision_id || 0) || null;
  const ar = Number(product.active_ar_revision_id || 0) || null;
  const config = Number(product.active_config_revision_id || 0) || null;

  if (current.component_kind === kind && current.status === "active") {
    await query(
      `UPDATE ar360_product_config_revisions
          SET status = 'archived',
              updated_at = NOW(),
              updated_by_admin_id = ?,
              reason = COALESCE(?, reason)
        WHERE id = ? AND product_uid = ? AND component_kind = ? AND status = 'active'`,
      [
        input.adminId,
        input.reason
          ? `Archived by ${kind} rollback → #${target.id}: ${input.reason}`.slice(0, 255)
          : `Archived by ${kind} rollback → #${target.id}`,
        Number(current.id),
        input.productId,
        kind,
      ],
    );
  }

  if (target.component_kind === kind && target.status === "archived") {
    await query(
      `UPDATE ar360_product_config_revisions
          SET status = 'active',
              updated_at = NOW(),
              updated_by_admin_id = ?
        WHERE id = ? AND product_uid = ? AND component_kind = ?`,
      [input.adminId, Number(target.id), input.productId, kind],
    );
  }

  await query(`UPDATE products SET ${meta.column} = ? WHERE id = ?`, [
    Number(target.id),
    input.productId,
  ]);

  const after = await getLegacyProductRow(input.productId);
  if (!after) throw new Error("Product missing after rollback");

  const afterGeo = Number(after.active_geometry_revision_id || 0) || null;
  const afterMat = Number(after.active_material_revision_id || 0) || null;
  const afterLight = Number(after.active_lighting_revision_id || 0) || null;
  const afterViewer = Number(after.active_viewer_revision_id || 0) || null;
  const afterAr = Number(after.active_ar_revision_id || 0) || null;
  const afterConfig = Number(after.active_config_revision_id || 0) || null;

  if (kind === "viewer") {
    if (
      afterGeo !== geometry ||
      afterMat !== material ||
      afterLight !== lighting ||
      afterAr !== ar ||
      afterConfig !== config
    ) {
      throw new Error("SAFETY: non-viewer pointers changed during rollback — abort state unexpected");
    }
  } else {
    if (
      afterGeo !== geometry ||
      afterMat !== material ||
      afterLight !== lighting ||
      afterViewer !== viewer ||
      afterConfig !== config
    ) {
      throw new Error("SAFETY: non-ar pointers changed during rollback — abort state unexpected");
    }
  }

  const fromRow = await getRevisionById(Number(current.id));
  const toRow = await getRevisionById(Number(target.id));
  if (!fromRow || !toRow) throw new Error("Revision missing after rollback");

  const health = await runPointerRollbackHealthCheck(kind, input.productId);

  return {
    fromRevisionId: Number(current.id),
    toRevisionId: Number(target.id),
    from: toSummary(fromRow, false),
    to: toSummary(toRow, true),
    health,
    pointers: {
      viewer: kind === "viewer" ? Number(target.id) : afterViewer,
      ar: kind === "ar" ? Number(target.id) : afterAr,
      material,
      lighting,
      geometry,
      config,
    },
  };
}

export function isEligiblePointerRollbackStatus(status: string): boolean {
  return status === "active" || status === "archived";
}

export function assertPointerRollbackKind(
  kind: PointerRollbackKind,
  value: string,
): boolean {
  return value === kind;
}
