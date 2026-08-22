/**
 * Phase 5B — immutable component revision lifecycle.
 * Draft / active / archived. Never mutates historical revision bodies.
 * Activation updates only the selected product component pointer.
 */

import { query } from "@/lib/db";
import {
  AR360_LEGACY_COMPAT_LABEL,
  type Ar360AssetRefsSnapshot,
  type Ar360ProductConfigSnapshot,
} from "@/lib/platform-versioning/foundation";
import {
  getLegacyProductRow,
  validateProductRevisionAssets,
} from "@/lib/platform-versioning/product-config-resolver";
import {
  applyAssetRefsSlice,
  applyComponentSlice,
  assertDraftPatchAllowed,
  buildComponentRevisionConfig,
  COMPONENT_KINDS,
  extractComponentSlice,
  type ComponentConfigSlice,
  type ComponentKind,
} from "@/lib/platform-versioning/component-slices";
import {
  compareNormalizedConfigs,
  normalizeRenderConfig,
  type ConfigFieldDifference,
} from "@/lib/platform-versioning/config-compare";
import { parseRuntimeJsonObject } from "@/lib/platform-versioning/runtime-json";

export type RevisionStatus = "draft" | "active" | "archived";

export type ComponentRevisionRow = {
  id: number;
  product_uid: string;
  customer_uid: string;
  revision_number: number;
  component_kind: "config" | ComponentKind;
  component_revision_number: number | null;
  config_json: unknown;
  asset_refs_json: unknown;
  renderer_compat_label: string;
  source: string;
  status: RevisionStatus;
  parent_revision_id: number | null;
  reason: string | null;
  notes: string | null;
  created_by_user_id: number | null;
  updated_by_admin_id: number | null;
  created_at: Date | string;
  updated_at: Date | string | null;
};

export type ComponentRevisionSummary = {
  id: number;
  productId: string;
  componentKind: "config" | ComponentKind;
  revisionNumber: number;
  componentRevisionNumber: number | null;
  status: RevisionStatus;
  parentRevisionId: number | null;
  compatibilityLabel: string;
  compatible: boolean;
  createdAt: string;
  updatedAt: string | null;
  createdByAdminId: number | null;
  notes: string | null;
  reason: string | null;
  isProductActivePointer: boolean;
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

function pointerColumn(kind: ComponentKind): string {
  return `active_${kind}_revision_id`;
}

export async function getRevisionById(revisionId: number): Promise<ComponentRevisionRow | null> {
  const rows = await query<ComponentRevisionRow>(
    `SELECT id, product_uid, customer_uid, revision_number, component_kind, component_revision_number,
            config_json, asset_refs_json, renderer_compat_label, source, status, parent_revision_id,
            reason, notes, created_by_user_id, updated_by_admin_id, created_at, updated_at
       FROM ar360_product_config_revisions
      WHERE id = ?
      LIMIT 1`,
    [revisionId],
  );
  return rows[0] ?? null;
}

export function parseRevisionConfig(row: ComponentRevisionRow): Ar360ProductConfigSnapshot {
  return parseJson<Ar360ProductConfigSnapshot>(row.config_json, {
    schemaVersion: 1,
    source: "manual",
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
}

export function parseRevisionAssetRefs(row: ComponentRevisionRow): Ar360AssetRefsSnapshot {
  return parseJson<Ar360AssetRefsSnapshot>(row.asset_refs_json, { files: [] });
}

export async function listComponentRevisions(input: {
  productId: string;
  kind?: ComponentKind;
}): Promise<ComponentRevisionSummary[]> {
  const product = await getLegacyProductRow(input.productId);
  if (!product) return [];

  const params: import("@/lib/db").QueryValue[] = [input.productId];
  let kindClause = `AND component_kind IN ('config','geometry','material','lighting','viewer','ar')`;
  if (input.kind) {
    kindClause = `AND (component_kind = ? OR component_kind = 'config')`;
    params.push(input.kind);
  }

  const rows = await query<ComponentRevisionRow>(
    `SELECT id, product_uid, customer_uid, revision_number, component_kind, component_revision_number,
            config_json, asset_refs_json, renderer_compat_label, source, status, parent_revision_id,
            reason, notes, created_by_user_id, updated_by_admin_id, created_at, updated_at
       FROM ar360_product_config_revisions
      WHERE product_uid = ?
        ${kindClause}
      ORDER BY component_kind ASC, COALESCE(component_revision_number, revision_number) DESC, id DESC`,
    params,
  );

  const activePointers = new Set<number>();
  for (const kind of COMPONENT_KINDS) {
    const id = Number((product as Record<string, unknown>)[pointerColumn(kind)] || 0);
    if (id > 0) activePointers.add(id);
  }
  if (product.active_config_revision_id) {
    activePointers.add(Number(product.active_config_revision_id));
  }

  return rows.map((row) => ({
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
    isProductActivePointer: activePointers.has(Number(row.id)),
  }));
}

async function nextGlobalRevisionNumber(productId: string): Promise<number> {
  const rows = await query<{ m: number | null }>(
    `SELECT MAX(revision_number) AS m FROM ar360_product_config_revisions WHERE product_uid = ?`,
    [productId],
  );
  return Number(rows[0]?.m || 0) + 1;
}

async function nextComponentRevisionNumber(productId: string, kind: ComponentKind): Promise<number> {
  const rows = await query<{ m: number | null }>(
    `SELECT MAX(component_revision_number) AS m
       FROM ar360_product_config_revisions
      WHERE product_uid = ? AND component_kind = ?`,
    [productId, kind],
  );
  const maxSpecific = rows[0]?.m;
  if (maxSpecific != null && Number(maxSpecific) > 0) {
    return Number(maxSpecific) + 1;
  }
  // Foundation config acts as component v1 when no kind-specific revisions exist.
  return 2;
}

async function resolveActiveSourceRevision(
  productId: string,
  kind: ComponentKind,
): Promise<ComponentRevisionRow> {
  const product = await getLegacyProductRow(productId);
  if (!product) throw new Error("Product not found");

  const pointerId = Number((product as Record<string, unknown>)[pointerColumn(kind)] || 0);
  if (pointerId > 0) {
    const row = await getRevisionById(pointerId);
    if (row) return row;
  }

  const configId = Number(product.active_config_revision_id || 0);
  if (configId > 0) {
    const row = await getRevisionById(configId);
    if (row) return row;
  }

  throw new Error(`No active ${kind} revision source for product ${productId}`);
}

/**
 * Create a DRAFT component revision by cloning the currently active component source.
 * Does not change product pointers or legacy MySQL product columns.
 */
export async function createComponentDraftRevision(input: {
  productId: string;
  kind: ComponentKind;
  adminId: number | null;
  reason?: string;
  notes?: string;
}): Promise<ComponentRevisionSummary> {
  const product = await getLegacyProductRow(input.productId);
  if (!product) throw new Error("Product not found");

  const source = await resolveActiveSourceRevision(input.productId, input.kind);
  const sourceConfig = parseRevisionConfig(source);
  const sourceAssets = parseRevisionAssetRefs(source);
  const slice = extractComponentSlice(input.kind, sourceConfig, sourceAssets);
  const componentRev = await nextComponentRevisionNumber(input.productId, input.kind);
  const globalRev = await nextGlobalRevisionNumber(input.productId);
  const config = buildComponentRevisionConfig(
    input.kind,
    slice,
    {
      id: String(product.id),
      publicId: product.public_id ?? null,
      viewerSlug: product.viewer_slug ?? null,
      status: product.status ?? null,
      title: product.title ?? null,
      editVersion:
        product.version == null || !Number.isFinite(Number(product.version))
          ? null
          : Number(product.version),
    },
    componentRev,
  );

  // Asset refs: reference only (geometry clones refs; others keep source refs for validation).
  const assetRefs: Ar360AssetRefsSnapshot =
    input.kind === "geometry"
      ? {
          modelUrl: sourceAssets.modelUrl ?? null,
          fileName: sourceAssets.fileName ?? null,
          productFolder: sourceAssets.productFolder ?? null,
          thumbnailUrl: sourceAssets.thumbnailUrl ?? null,
          qrUrl: sourceAssets.qrUrl ?? null,
          posterRef: sourceAssets.posterRef ?? null,
          files: sourceAssets.files ?? [],
          note: "Phase 5B geometry draft — asset references only, no binary copy.",
        }
      : {
          modelUrl: sourceAssets.modelUrl ?? null,
          fileName: sourceAssets.fileName ?? null,
          files: sourceAssets.files ?? [],
          note: "Referenced from parent revision; binaries not duplicated.",
        };

  await query(
    `INSERT INTO ar360_product_config_revisions
      (product_uid, customer_uid, revision_number, component_kind, component_revision_number,
       config_json, asset_refs_json, material_revision_id, lighting_revision_id, viewer_revision_id,
       ar_revision_id, geometry_revision_id, renderer_compat_label, source, status, parent_revision_id,
       reason, notes, created_by_user_id, updated_by_admin_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, 'manual', 'draft', ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      input.productId,
      product.customer_uid || "",
      globalRev,
      input.kind,
      componentRev,
      JSON.stringify(config),
      JSON.stringify(assetRefs),
      AR360_LEGACY_COMPAT_LABEL,
      Number(source.id),
      input.reason || `Draft ${input.kind} v${componentRev} cloned from revision ${source.id}`,
      input.notes || null,
      input.adminId,
      input.adminId,
    ],
  );

  const found = await query<{ id: number }>(
    `SELECT id FROM ar360_product_config_revisions
      WHERE product_uid = ? AND component_kind = ? AND component_revision_number = ?
      ORDER BY id DESC LIMIT 1`,
    [input.productId, input.kind, componentRev],
  );
  const newId = Number(found[0]?.id || 0);
  if (!newId) throw new Error("Failed to create draft revision");

  const created = await getRevisionById(newId);
  if (!created) throw new Error("Draft revision not found after insert");

  return {
    id: Number(created.id),
    productId: created.product_uid,
    componentKind: created.component_kind,
    revisionNumber: Number(created.revision_number),
    componentRevisionNumber: Number(created.component_revision_number),
    status: created.status,
    parentRevisionId: created.parent_revision_id == null ? null : Number(created.parent_revision_id),
    compatibilityLabel: created.renderer_compat_label,
    compatible: created.renderer_compat_label === AR360_LEGACY_COMPAT_LABEL,
    createdAt: String(created.created_at),
    updatedAt: created.updated_at == null ? null : String(created.updated_at),
    createdByAdminId: created.created_by_user_id == null ? null : Number(created.created_by_user_id),
    notes: created.notes,
    reason: created.reason,
    isProductActivePointer: false,
  };
}

/**
 * Edit a DRAFT only. Historical/active revisions are immutable.
 */
export async function updateComponentDraftRevision(input: {
  revisionId: number;
  adminId: number | null;
  patch: Record<string, unknown>;
}): Promise<ComponentRevisionSummary> {
  const row = await getRevisionById(input.revisionId);
  if (!row) throw new Error("Revision not found");
  if (row.status !== "draft") {
    throw new Error("Only draft revisions can be edited");
  }
  if (row.component_kind === "config") {
    throw new Error("Foundation config revisions cannot be edited");
  }

  const kind = row.component_kind as ComponentKind;
  const allowed = assertDraftPatchAllowed(kind, input.patch);
  if (allowed.ok === false) throw new Error(allowed.message);

  const currentConfig = parseRevisionConfig(row);
  const currentAssets = parseRevisionAssetRefs(row);
  let nextSlice = extractComponentSlice(kind, currentConfig, currentAssets);

  if (kind === "material") {
    let materialSettings = nextSlice.materialSettings;
    if (input.patch.materialSettings != null) {
      const parsed = parseRuntimeJsonObject(input.patch.materialSettings, "materialSettings");
      if (parsed.ok === false) throw new Error(parsed.message);
      materialSettings = parsed.value;
    }
    nextSlice = {
      ...nextSlice,
      materialSettings,
      variants: Array.isArray(input.patch.variants) ? input.patch.variants : nextSlice.variants,
      settings:
        input.patch.settings != null
          ? { ...(nextSlice.settings || {}), ...(input.patch.settings as Record<string, unknown>) }
          : nextSlice.settings,
    };
  } else if (kind === "geometry") {
    nextSlice = {
      ...nextSlice,
      assetRefs: {
        ...(nextSlice.assetRefs || {}),
        ...((input.patch.assetRefs as Record<string, unknown>) || {}),
      },
    };
  } else {
    nextSlice = {
      ...nextSlice,
      settings: {
        ...(nextSlice.settings || {}),
        ...((input.patch.settings as Record<string, unknown>) || {}),
      },
    };
  }

  const nextConfig = buildComponentRevisionConfig(
    kind,
    nextSlice,
    currentConfig.productIdentity,
    Number(row.component_revision_number || row.revision_number),
  );
  const nextAssets =
    kind === "geometry"
      ? applyAssetRefsSlice(currentAssets, nextSlice) || currentAssets
      : currentAssets;

  await query(
    `UPDATE ar360_product_config_revisions
        SET config_json = ?,
            asset_refs_json = ?,
            updated_at = NOW(),
            updated_by_admin_id = ?
      WHERE id = ? AND status = 'draft'`,
    [JSON.stringify(nextConfig), JSON.stringify(nextAssets), input.adminId, input.revisionId],
  );

  const updated = await getRevisionById(input.revisionId);
  if (!updated) throw new Error("Revision missing after update");
  return (await listComponentRevisions({ productId: updated.product_uid, kind }))[0] || {
    id: Number(updated.id),
    productId: updated.product_uid,
    componentKind: updated.component_kind,
    revisionNumber: Number(updated.revision_number),
    componentRevisionNumber:
      updated.component_revision_number == null ? null : Number(updated.component_revision_number),
    status: updated.status,
    parentRevisionId: updated.parent_revision_id == null ? null : Number(updated.parent_revision_id),
    compatibilityLabel: updated.renderer_compat_label,
    compatible: updated.renderer_compat_label === AR360_LEGACY_COMPAT_LABEL,
    createdAt: String(updated.created_at),
    updatedAt: updated.updated_at == null ? null : String(updated.updated_at),
    createdByAdminId: updated.created_by_user_id == null ? null : Number(updated.created_by_user_id),
    notes: updated.notes,
    reason: updated.reason,
    isProductActivePointer: false,
  };
}

export function diffComponentRevisions(
  left: ComponentRevisionRow,
  right: ComponentRevisionRow,
): { match: boolean; differences: ConfigFieldDifference[] } {
  const leftConfig = parseRevisionConfig(left);
  const rightConfig = parseRevisionConfig(right);
  const leftAssets = parseRevisionAssetRefs(left);
  const rightAssets = parseRevisionAssetRefs(right);
  const a = normalizeRenderConfig({
    settings: leftConfig.settings,
    materialSettings: leftConfig.materialSettings,
    variants: leftConfig.variants,
    hotspots: leftConfig.hotspots,
    modelUrl: leftAssets.modelUrl ?? null,
    fileName: leftAssets.fileName ?? null,
  });
  const b = normalizeRenderConfig({
    settings: rightConfig.settings,
    materialSettings: rightConfig.materialSettings,
    variants: rightConfig.variants,
    hotspots: rightConfig.hotspots,
    modelUrl: rightAssets.modelUrl ?? null,
    fileName: rightAssets.fileName ?? null,
  });
  return compareNormalizedConfigs(a, b);
}

export async function validateRevisionForActivation(input: {
  productId: string;
  revisionId: number;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const row = await getRevisionById(input.revisionId);
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Revision not found" };
  if (row.product_uid !== input.productId) {
    return { ok: false, code: "PRODUCT_MISMATCH", message: "Revision does not belong to product" };
  }
  if (row.status !== "draft") {
    return { ok: false, code: "NOT_DRAFT", message: "Only draft revisions can be activated" };
  }
  if (row.component_kind === "config") {
    return { ok: false, code: "INVALID_KIND", message: "Cannot activate foundation config as component" };
  }
  if ((row.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL) !== AR360_LEGACY_COMPAT_LABEL) {
    return {
      ok: false,
      code: "COMPATIBILITY_FAILED",
      message: `Compatibility failed: label '${row.renderer_compat_label}' (expected ${AR360_LEGACY_COMPAT_LABEL})`,
    };
  }

  const product = await getLegacyProductRow(input.productId);
  const assets = await validateProductRevisionAssets({
    customerUid: String(product?.customer_uid || row.customer_uid || ""),
    productId: input.productId,
    assetRefs: parseRevisionAssetRefs(row),
  });
  if (!assets.ok) {
    return { ok: false, code: "ASSET_VALIDATION_FAILED", message: "Required assets missing or invalid" };
  }

  return { ok: true };
}

/**
 * Activate a draft for ONE component on ONE product.
 * Does not change other component pointers or legacy product config columns.
 */
export async function activateComponentRevision(input: {
  productId: string;
  revisionId: number;
  adminId: number | null;
}): Promise<{
  activated: ComponentRevisionSummary;
  previousPointerId: number | null;
  pointerColumn: string;
}> {
  const ready = await validateRevisionForActivation({
    productId: input.productId,
    revisionId: input.revisionId,
  });
  if (ready.ok !== true) {
    throw new Error(`${ready.code}: ${ready.message}`);
  }

  const row = await getRevisionById(input.revisionId);
  if (!row) throw new Error("Revision not found");
  const kind = row.component_kind as ComponentKind;
  const column = pointerColumn(kind);

  const product = await getLegacyProductRow(input.productId);
  if (!product) throw new Error("Product not found");
  const previousPointerId = Number((product as Record<string, unknown>)[column] || 0) || null;

  // Archive previous kind-specific active revision (never archive foundation config).
  if (previousPointerId) {
    await query(
      `UPDATE ar360_product_config_revisions
          SET status = 'archived', updated_at = NOW(), updated_by_admin_id = ?
        WHERE id = ?
          AND product_uid = ?
          AND component_kind = ?
          AND status = 'active'`,
      [input.adminId, previousPointerId, input.productId, kind],
    );
  }

  await query(
    `UPDATE ar360_product_config_revisions
        SET status = 'active', updated_at = NOW(), updated_by_admin_id = ?
      WHERE id = ? AND product_uid = ? AND status = 'draft'`,
    [input.adminId, input.revisionId, input.productId],
  );

  await query(`UPDATE products SET \`${column}\` = ? WHERE id = ?`, [
    input.revisionId,
    input.productId,
  ]);

  const activatedRow = await getRevisionById(input.revisionId);
  if (!activatedRow) throw new Error("Activated revision missing");

  return {
    activated: {
      id: Number(activatedRow.id),
      productId: activatedRow.product_uid,
      componentKind: activatedRow.component_kind,
      revisionNumber: Number(activatedRow.revision_number),
      componentRevisionNumber:
        activatedRow.component_revision_number == null
          ? null
          : Number(activatedRow.component_revision_number),
      status: activatedRow.status,
      parentRevisionId:
        activatedRow.parent_revision_id == null ? null : Number(activatedRow.parent_revision_id),
      compatibilityLabel: activatedRow.renderer_compat_label,
      compatible: activatedRow.renderer_compat_label === AR360_LEGACY_COMPAT_LABEL,
      createdAt: String(activatedRow.created_at),
      updatedAt: activatedRow.updated_at == null ? null : String(activatedRow.updated_at),
      createdByAdminId:
        activatedRow.created_by_user_id == null ? null : Number(activatedRow.created_by_user_id),
      notes: activatedRow.notes,
      reason: activatedRow.reason,
      isProductActivePointer: true,
    },
    previousPointerId,
    pointerColumn: column,
  };
}

export async function archiveComponentRevision(input: {
  revisionId: number;
  adminId: number | null;
}): Promise<void> {
  const row = await getRevisionById(input.revisionId);
  if (!row) throw new Error("Revision not found");
  if (row.status === "active") {
    const product = await getLegacyProductRow(row.product_uid);
    if (product) {
      for (const kind of COMPONENT_KINDS) {
        const ptr = Number((product as Record<string, unknown>)[pointerColumn(kind)] || 0);
        if (ptr === Number(row.id)) {
          throw new Error("Cannot archive a revision that is an active product pointer");
        }
      }
    }
  }
  await query(
    `UPDATE ar360_product_config_revisions
        SET status = 'archived', updated_at = NOW(), updated_by_admin_id = ?
      WHERE id = ?`,
    [input.adminId, input.revisionId],
  );
}

/**
 * Compose full config from foundation + per-component active pointers.
 * Used by VERSIONED runtime. Drafts are never composed.
 */
export async function composeActiveVersionedConfig(productId: string): Promise<{
  config: Ar360ProductConfigSnapshot;
  assetRefs: Ar360AssetRefsSnapshot;
  components: Record<ComponentKind, number | null>;
} | null> {
  const product = await getLegacyProductRow(productId);
  if (!product?.active_config_revision_id) return null;

  const foundation = await getRevisionById(Number(product.active_config_revision_id));
  if (!foundation) return null;

  let config = parseRevisionConfig(foundation);
  let assetRefs = parseRevisionAssetRefs(foundation);
  const components: Record<ComponentKind, number | null> = {
    geometry: null,
    material: null,
    lighting: null,
    viewer: null,
    ar: null,
  };

  for (const kind of COMPONENT_KINDS) {
    const ptr = Number((product as Record<string, unknown>)[pointerColumn(kind)] || 0);
    components[kind] = ptr > 0 ? ptr : null;
    if (!ptr || ptr === Number(foundation.id)) continue;

    const rev = await getRevisionById(ptr);
    if (!rev || rev.status !== "active") continue;

    const slice = extractComponentSlice(kind, parseRevisionConfig(rev), parseRevisionAssetRefs(rev));
    config = applyComponentSlice(config, slice);
    assetRefs = applyAssetRefsSlice(assetRefs, slice) || assetRefs;
  }

  return { config, assetRefs, components };
}

/**
 * Preview a DRAFT in isolation — does not change product pointers.
 */
export async function composeDraftPreviewConfig(input: {
  productId: string;
  draftRevisionId: number;
}): Promise<{
  config: Ar360ProductConfigSnapshot;
  assetRefs: Ar360AssetRefsSnapshot;
  draft: ComponentRevisionRow;
  kind: ComponentKind;
} | null> {
  const draft = await getRevisionById(input.draftRevisionId);
  if (!draft || draft.product_uid !== input.productId) return null;
  if (draft.status !== "draft") return null;
  if (draft.component_kind === "config") return null;

  const composed = await composeActiveVersionedConfig(input.productId);
  if (!composed) return null;

  const kind = draft.component_kind as ComponentKind;
  const slice = extractComponentSlice(kind, parseRevisionConfig(draft), parseRevisionAssetRefs(draft));
  return {
    config: applyComponentSlice(composed.config, slice),
    assetRefs: applyAssetRefsSlice(composed.assetRefs, slice) || composed.assetRefs,
    draft,
    kind,
  };
}

export function sliceToDiffableConfig(
  kind: ComponentKind,
  slice: ComponentConfigSlice,
  identity: Ar360ProductConfigSnapshot["productIdentity"],
): { config: Ar360ProductConfigSnapshot; assetRefs: Ar360AssetRefsSnapshot } {
  return {
    config: buildComponentRevisionConfig(kind, slice, identity, 0),
    assetRefs: {
      files: slice.assetRefs?.files ?? [],
      modelUrl: slice.assetRefs?.modelUrl ?? null,
      fileName: slice.assetRefs?.fileName ?? null,
    },
  };
}
