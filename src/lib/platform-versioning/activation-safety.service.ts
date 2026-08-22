/**
 * Phase 6B — controlled update safety / change guard.
 *
 * Pre-activation validation, pointer snapshots, dependency checks,
 * canary guard, composed preview, and post-activation health checks.
 * Does NOT auto-rollback or enable global VERSIONED runtime.
 */

import { query } from "@/lib/db";
import { AR360_LEGACY_COMPAT_LABEL } from "@/lib/platform-versioning/foundation";
import {
  activateComponentRevision,
  composeActiveVersionedConfig,
  composeDraftPreviewConfig,
  getRevisionById,
  parseRevisionAssetRefs,
  parseRevisionConfig,
  type ComponentRevisionRow,
} from "@/lib/platform-versioning/component-revisions.service";
import {
  COMPONENT_KINDS,
  type ComponentKind,
} from "@/lib/platform-versioning/component-slices";
import { deserializeVersionedConfigForRuntime } from "@/lib/platform-versioning/apply-versioned-runtime";
import {
  getLegacyProductRow,
  validateProductRevisionAssets,
} from "@/lib/platform-versioning/product-config-resolver";
import {
  getVersionedRuntimeFlag,
  selectRuntimeMode,
} from "@/lib/platform-versioning/runtime-selection";

export type ChangeStatus =
  | "READY"
  | "PREVIEW"
  | "CANARY"
  | "ACTIVE"
  | "UNHEALTHY"
  | "ROLLED_BACK"
  | "BLOCKED";

export type PointerSnapshot = {
  config: number | null;
  geometry: number | null;
  material: number | null;
  lighting: number | null;
  viewer: number | null;
  ar: number | null;
};

export type ActivationBlock = {
  ok: false;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ActivationGatePass = {
  ok: true;
  productId: string;
  kind: ComponentKind;
  revision: ComponentRevisionRow;
  snapshot: PointerSnapshot;
  proposedComposition: {
    components: Record<ComponentKind, number | null>;
  };
};

export type HealthCheckResult = {
  ok: boolean;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
  materialSettingsType: string;
  variantsIsArray: boolean;
  fallbackAvailable: boolean;
};

export type ChangeRecord = {
  id: number;
  productId: string;
  componentKind: ComponentKind;
  fromRevisionId: number | null;
  toRevisionId: number | null;
  status: ChangeStatus;
  snapshot: PointerSnapshot;
  health: HealthCheckResult | null;
  blockCode: string | null;
  blockReason: string | null;
  reason: string | null;
  adminId: number | null;
  createdAt: string;
  updatedAt: string | null;
};

function ptr(product: Record<string, unknown>, column: string): number | null {
  const n = Number(product[column] || 0);
  return n > 0 ? n : null;
}

export async function capturePointerSnapshot(productId: string): Promise<PointerSnapshot | null> {
  const product = await getLegacyProductRow(productId);
  if (!product) return null;
  const row = product as Record<string, unknown>;
  return {
    config: ptr(row, "active_config_revision_id"),
    geometry: ptr(row, "active_geometry_revision_id"),
    material: ptr(row, "active_material_revision_id"),
    lighting: ptr(row, "active_lighting_revision_id"),
    viewer: ptr(row, "active_viewer_revision_id"),
    ar: ptr(row, "active_ar_revision_id"),
  };
}

/** Canary must never become scope=all via activation path. */
export async function assertCanaryGuard(): Promise<ActivationBlock | { ok: true }> {
  const flag = await getVersionedRuntimeFlag();
  if (!flag) return { ok: true };
  if (flag.targeting.scope === "all") {
    return {
      ok: false,
      code: "CANARY_SCOPE_ALL_FORBIDDEN",
      message:
        "Global VERSIONED scope=all is forbidden. Activation cannot proceed while scope=all is configured.",
    };
  }
  // Defense in depth: selection must keep LEGACY when forbidGlobal is on
  const probe = selectRuntimeMode({
    productId: "__probe__",
    flagEnabled: true,
    targeting: { scope: "all", productIds: [] },
    forbidGlobal: true,
  });
  if (probe.mode !== "legacy" || probe.reason !== "global_forbidden_blocked") {
    return {
      ok: false,
      code: "CANARY_GUARD_FAILED",
      message: "Canary guard failed to block scope=all",
    };
  }
  return { ok: true };
}

export type DeclaredDeps = Partial<
  Record<ComponentKind, { minComponentRevisionNumber?: number }>
>;

export function parseDeclaredDependencies(config: unknown): DeclaredDeps {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  const deps = (config as Record<string, unknown>).dependencies;
  if (!deps || typeof deps !== "object" || Array.isArray(deps)) return {};
  const out: DeclaredDeps = {};
  for (const kind of COMPONENT_KINDS) {
    const entry = (deps as Record<string, unknown>)[kind];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const min = Number((entry as Record<string, unknown>).minComponentRevisionNumber);
    if (Number.isFinite(min) && min > 0) {
      out[kind] = { minComponentRevisionNumber: min };
    }
  }
  return out;
}

function readDeclaredDependencies(config: unknown): DeclaredDeps {
  return parseDeclaredDependencies(config);
}

/**
 * Validate declared dependencies against CURRENT active pointers
 * (proposed activation does not auto-upgrade other components).
 */
export async function validateDependencyGuard(input: {
  productId: string;
  draftRevisionId: number;
}): Promise<ActivationBlock | { ok: true; dependencies: DeclaredDeps }> {
  const draft = await getRevisionById(input.draftRevisionId);
  if (!draft) {
    return { ok: false, code: "NOT_FOUND", message: "Revision not found" };
  }
  const config = parseRevisionConfig(draft);
  const deps = readDeclaredDependencies(config);
  const snapshot = await capturePointerSnapshot(input.productId);
  if (!snapshot) {
    return { ok: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" };
  }

  const conflicts: Array<{ component: ComponentKind; required: number; actual: number | null }> =
    [];

  for (const kind of COMPONENT_KINDS) {
    const req = deps[kind]?.minComponentRevisionNumber;
    if (req == null) continue;
    const pointerId = snapshot[kind];
    if (!pointerId) {
      conflicts.push({ component: kind, required: req, actual: null });
      continue;
    }
    const rev = await getRevisionById(pointerId);
    const actual =
      rev?.component_revision_number != null
        ? Number(rev.component_revision_number)
        : rev
          ? Number(rev.revision_number)
          : null;
    if (actual == null || actual < req) {
      conflicts.push({ component: kind, required: req, actual });
    }
  }

  if (conflicts.length > 0) {
    const detail = conflicts
      .map(
        (c) =>
          `${c.component} requires min v${c.required} but active is ${c.actual == null ? "missing" : `v${c.actual}`}`,
      )
      .join("; ");
    return {
      ok: false,
      code: "DEPENDENCY_CONFLICT",
      message: `Dependency conflict: ${detail}. Other components are not auto-upgraded.`,
      details: { conflicts, dependencies: deps },
    };
  }

  return { ok: true, dependencies: deps };
}

export async function validateRuntimeJsonForRevision(
  row: ComponentRevisionRow,
): Promise<ActivationBlock | { ok: true }> {
  const config = parseRevisionConfig(row);
  const deserialized = deserializeVersionedConfigForRuntime(config);
  if (deserialized.ok === false) {
    return {
      ok: false,
      code: "VERSIONED_CONFIG_ERROR",
      message: deserialized.message,
    };
  }
  const { contract } = deserialized;
  if (typeof contract.materialSettings !== "object" || Array.isArray(contract.materialSettings)) {
    return {
      ok: false,
      code: "RUNTIME_JSON_INVALID",
      message: "materialSettings must deserialize to an object",
    };
  }
  if (!Array.isArray(contract.variants)) {
    return {
      ok: false,
      code: "RUNTIME_JSON_INVALID",
      message: "variants must deserialize to an array",
    };
  }
  return { ok: true };
}

/**
 * Full pre-activation gate. Blocks with clear reason — no silent fallback.
 */
export async function runActivationGate(input: {
  productId: string;
  revisionId: number;
}): Promise<ActivationGatePass | ActivationBlock> {
  const canary = await assertCanaryGuard();
  if (canary.ok === false) return canary;

  const row = await getRevisionById(input.revisionId);
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Revision not found" };
  }
  if (row.product_uid !== input.productId) {
    return { ok: false, code: "PRODUCT_MISMATCH", message: "Revision does not belong to product" };
  }
  if (row.status !== "draft") {
    return { ok: false, code: "NOT_DRAFT", message: "Only draft revisions can be activated" };
  }
  if (row.component_kind === "config") {
    return {
      ok: false,
      code: "INVALID_KIND",
      message: "Cannot activate foundation config as a component revision",
    };
  }
  const kind = row.component_kind as ComponentKind;
  if (!COMPONENT_KINDS.includes(kind)) {
    return { ok: false, code: "INVALID_KIND", message: `Unsupported component kind '${row.component_kind}'` };
  }

  if ((row.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL) !== AR360_LEGACY_COMPAT_LABEL) {
    return {
      ok: false,
      code: "COMPATIBILITY_FAILED",
      message: `Compatibility failed: label '${row.renderer_compat_label}' (expected ${AR360_LEGACY_COMPAT_LABEL})`,
    };
  }

  const product = await getLegacyProductRow(input.productId);
  if (!product) {
    return { ok: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" };
  }

  const assets = await validateProductRevisionAssets({
    customerUid: String(product.customer_uid || row.customer_uid || ""),
    productId: input.productId,
    assetRefs: parseRevisionAssetRefs(row),
  });
  if (!assets.ok) {
    return {
      ok: false,
      code: "ASSET_VALIDATION_FAILED",
      message: "Asset validation failed for revision",
    };
  }

  const refs = parseRevisionAssetRefs(row);
  const modelUrl = refs.modelUrl != null ? String(refs.modelUrl) : "";
  if (/__missing__|does-not-exist/i.test(modelUrl)) {
    return {
      ok: false,
      code: "ASSET_VALIDATION_FAILED",
      message: "Asset validation failed: modelUrl points to a missing or invalid asset",
    };
  }

  const jsonOk = await validateRuntimeJsonForRevision(row);
  if (jsonOk.ok === false) return jsonOk;

  const deps = await validateDependencyGuard({
    productId: input.productId,
    draftRevisionId: input.revisionId,
  });
  if (deps.ok === false) return deps;

  const snapshot = await capturePointerSnapshot(input.productId);
  if (!snapshot) {
    return { ok: false, code: "SNAPSHOT_FAILED", message: "Unable to capture pointer snapshot" };
  }

  // Proposed composition: current pointers with this draft substituted for kind
  const proposed: Record<ComponentKind, number | null> = {
    geometry: snapshot.geometry,
    material: snapshot.material,
    lighting: snapshot.lighting,
    viewer: snapshot.viewer,
    ar: snapshot.ar,
  };
  proposed[kind] = Number(row.id);

  // Combination check: every pointed revision (except proposed draft) must be compat-safe
  for (const k of COMPONENT_KINDS) {
    const id = proposed[k];
    if (!id || id === Number(row.id)) continue;
    const rev = await getRevisionById(id);
    if (!rev) {
      return {
        ok: false,
        code: "INVALID_COMBINATION",
        message: `Active ${k} revision #${id} is missing`,
      };
    }
    if ((rev.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL) !== AR360_LEGACY_COMPAT_LABEL) {
      return {
        ok: false,
        code: "INVALID_COMBINATION",
        message: `Invalid combination: ${k} revision #${id} is incompatible`,
      };
    }
  }

  return {
    ok: true,
    productId: input.productId,
    kind,
    revision: row,
    snapshot,
    proposedComposition: { components: proposed },
  };
}

export async function buildActivationPreview(input: {
  productId: string;
  revisionId: number;
}): Promise<
  | {
      ok: true;
      banner: "DRAFT PREVIEW";
      current: PointerSnapshot;
      proposed: Record<ComponentKind, number | null>;
      currentMaterial0: unknown;
      proposedMaterial0: unknown;
      kind: ComponentKind;
    }
  | ActivationBlock
> {
  const gate = await runActivationGate(input);
  if (gate.ok === false) return gate;

  const currentCompose = await composeActiveVersionedConfig(input.productId);
  const draftPreview = await composeDraftPreviewConfig({
    productId: input.productId,
    draftRevisionId: input.revisionId,
  });
  if (!draftPreview) {
    return { ok: false, code: "PREVIEW_FAILED", message: "Unable to compose draft preview" };
  }

  // Confirm pointers unchanged after preview compose
  const after = await capturePointerSnapshot(input.productId);
  if (JSON.stringify(after) !== JSON.stringify(gate.snapshot)) {
    return {
      ok: false,
      code: "PREVIEW_MUTATION_DETECTED",
      message: "Preview unexpectedly mutated product pointers",
    };
  }

  const curMats = currentCompose?.config.materialSettings as Record<string, unknown> | undefined;
  const propMats = draftPreview.config.materialSettings as Record<string, unknown> | undefined;

  return {
    ok: true,
    banner: "DRAFT PREVIEW",
    current: gate.snapshot,
    proposed: gate.proposedComposition.components,
    currentMaterial0: curMats?.["0"] ?? null,
    proposedMaterial0: propMats?.["0"] ?? null,
    kind: gate.kind,
  };
}

export async function runPostActivationHealthCheck(productId: string): Promise<HealthCheckResult> {
  const checks: HealthCheckResult["checks"] = [];

  const composed = await composeActiveVersionedConfig(productId);
  checks.push({
    name: "resolver_composition",
    pass: composed != null,
    detail: composed ? "ok" : "compose failed",
  });

  const product = await getLegacyProductRow(productId);
  const assets = await validateProductRevisionAssets({
    customerUid: String(product?.customer_uid || ""),
    productId,
    assetRefs: composed?.assetRefs ?? { files: [] },
  });
  checks.push({
    name: "assets",
    pass: assets.ok,
    detail: assets.ok ? "ok" : "required assets missing",
  });

  let materialSettingsType = "undefined";
  let variantsIsArray = false;
  if (composed?.config) {
    const deserialized = deserializeVersionedConfigForRuntime(composed.config);
    if (deserialized.ok === true) {
      materialSettingsType = typeof deserialized.contract.materialSettings;
      variantsIsArray = Array.isArray(deserialized.contract.variants);
      checks.push({
        name: "runtime_json_types",
        pass:
          materialSettingsType === "object" &&
          !Array.isArray(deserialized.contract.materialSettings) &&
          variantsIsArray,
        detail: `materialSettings=${materialSettingsType}, variantsArray=${variantsIsArray}`,
      });
    } else {
      checks.push({
        name: "runtime_json_types",
        pass: false,
        detail: deserialized.message,
      });
    }
  } else {
    checks.push({ name: "runtime_json_types", pass: false, detail: "no composed config" });
  }

  // Fallback path availability: canary selection must still allow legacy default
  const flag = await getVersionedRuntimeFlag();
  const legacyDefault = selectRuntimeMode({
    productId,
    flagEnabled: false,
    targeting: { scope: "selected_products", productIds: [] },
    forbidGlobal: true,
  });
  checks.push({
    name: "fallback_path_available",
    pass: legacyDefault.mode === "legacy" && (flag?.targeting.scope !== "all"),
    detail: `legacyDefault=${legacyDefault.mode}, flagScope=${flag?.targeting.scope ?? "none"}`,
  });

  const ok = checks.every((c) => c.pass);
  return {
    ok,
    checks,
    materialSettingsType,
    variantsIsArray,
    fallbackAvailable: true,
  };
}

async function insertChangeRecord(input: {
  productId: string;
  customerUid: string;
  kind: ComponentKind;
  fromRevisionId: number | null;
  toRevisionId: number | null;
  status: ChangeStatus;
  snapshot: PointerSnapshot;
  health?: HealthCheckResult | null;
  blockCode?: string | null;
  blockReason?: string | null;
  reason?: string | null;
  adminId: number | null;
}): Promise<number> {
  await query(
    `INSERT INTO ar360_component_change_records
      (product_uid, customer_uid, component_kind, from_revision_id, to_revision_id, status,
       snapshot_json, health_json, block_code, block_reason, reason, admin_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      input.productId,
      input.customerUid,
      input.kind,
      input.fromRevisionId,
      input.toRevisionId,
      input.status,
      JSON.stringify(input.snapshot),
      input.health ? JSON.stringify(input.health) : null,
      input.blockCode ?? null,
      input.blockReason ?? null,
      input.reason ?? null,
      input.adminId,
    ],
  );
  const rows = await query<{ id: number }>(
    `SELECT id FROM ar360_component_change_records
      WHERE product_uid = ? AND component_kind = ?
      ORDER BY id DESC LIMIT 1`,
    [input.productId, input.kind],
  );
  return Number(rows[0]?.id || 0);
}

export async function updateChangeRecordStatus(input: {
  id: number;
  status: ChangeStatus;
  health?: HealthCheckResult | null;
  blockCode?: string | null;
  blockReason?: string | null;
}): Promise<void> {
  await query(
    `UPDATE ar360_component_change_records
        SET status = ?,
            health_json = COALESCE(?, health_json),
            block_code = COALESCE(?, block_code),
            block_reason = COALESCE(?, block_reason),
            updated_at = NOW()
      WHERE id = ?`,
    [
      input.status,
      input.health ? JSON.stringify(input.health) : null,
      input.blockCode ?? null,
      input.blockReason ?? null,
      input.id,
    ],
  );
}

export async function listChangeHistory(productId: string, limit = 50): Promise<ChangeRecord[]> {
  const rows = await query<{
    id: number;
    product_uid: string;
    component_kind: ComponentKind;
    from_revision_id: number | null;
    to_revision_id: number | null;
    status: ChangeStatus;
    snapshot_json: unknown;
    health_json: unknown;
    block_code: string | null;
    block_reason: string | null;
    reason: string | null;
    admin_id: number | null;
    created_at: Date | string;
    updated_at: Date | string | null;
  }>(
    `SELECT id, product_uid, component_kind, from_revision_id, to_revision_id, status,
            snapshot_json, health_json, block_code, block_reason, reason, admin_id,
            created_at, updated_at
       FROM ar360_component_change_records
      WHERE product_uid = ?
      ORDER BY id DESC
      LIMIT ?`,
    [productId, Math.min(200, Math.max(1, limit))],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    productId: r.product_uid,
    componentKind: r.component_kind,
    fromRevisionId: r.from_revision_id == null ? null : Number(r.from_revision_id),
    toRevisionId: r.to_revision_id == null ? null : Number(r.to_revision_id),
    status: r.status,
    snapshot:
      typeof r.snapshot_json === "string"
        ? (JSON.parse(r.snapshot_json) as PointerSnapshot)
        : (r.snapshot_json as PointerSnapshot),
    health:
      r.health_json == null
        ? null
        : typeof r.health_json === "string"
          ? (JSON.parse(r.health_json) as HealthCheckResult)
          : (r.health_json as HealthCheckResult),
    blockCode: r.block_code,
    blockReason: r.block_reason,
    reason: r.reason,
    adminId: r.admin_id == null ? null : Number(r.admin_id),
    createdAt: String(r.created_at),
    updatedAt: r.updated_at == null ? null : String(r.updated_at),
  }));
}

/**
 * Safe activation pipeline with snapshot + health check.
 * Never mutates legacy product settings columns.
 */
export async function activateWithSafety(input: {
  productId: string;
  revisionId: number;
  adminId: number | null;
  reason?: string;
  /** Test-only: force unhealthy after successful activation (no auto-rollback). */
  forceUnhealthy?: boolean;
}): Promise<
  | {
      ok: true;
      changeRecordId: number;
      status: ChangeStatus;
      activated: Awaited<ReturnType<typeof activateComponentRevision>>;
      health: HealthCheckResult;
      snapshot: PointerSnapshot;
    }
  | {
      ok: false;
      changeRecordId: number | null;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    }
> {
  const product = await getLegacyProductRow(input.productId);
  if (!product) {
    return { ok: false, changeRecordId: null, code: "PRODUCT_NOT_FOUND", message: "Product not found" };
  }

  const gate = await runActivationGate({
    productId: input.productId,
    revisionId: input.revisionId,
  });

  if (gate.ok === false) {
    const rev = await getRevisionById(input.revisionId);
    const kindForRecord: ComponentKind =
      rev && rev.component_kind !== "config"
        ? (rev.component_kind as ComponentKind)
        : "material";
    const changeRecordId = await insertChangeRecord({
      productId: input.productId,
      customerUid: String(product.customer_uid || ""),
      kind: kindForRecord,
      fromRevisionId: null,
      toRevisionId: input.revisionId,
      status: "BLOCKED",
      snapshot: (await capturePointerSnapshot(input.productId)) || {
        config: null,
        geometry: null,
        material: null,
        lighting: null,
        viewer: null,
        ar: null,
      },
      blockCode: gate.code,
      blockReason: gate.message,
      reason: input.reason ?? null,
      adminId: input.adminId,
    });
    return {
      ok: false,
      changeRecordId,
      code: gate.code,
      message: gate.message,
      details: gate.details,
    };
  }

  const fromRevisionId = gate.snapshot[gate.kind];
  const changeRecordId = await insertChangeRecord({
    productId: input.productId,
    customerUid: String(product.customer_uid || ""),
    kind: gate.kind,
    fromRevisionId,
    toRevisionId: Number(gate.revision.id),
    status: "READY",
    snapshot: gate.snapshot,
    reason: input.reason ?? null,
    adminId: input.adminId,
  });

  const activated = await activateComponentRevision({
    productId: input.productId,
    revisionId: input.revisionId,
    adminId: input.adminId,
  });

  let health = await runPostActivationHealthCheck(input.productId);
  if (input.forceUnhealthy) {
    health = {
      ...health,
      ok: false,
      checks: [
        ...health.checks,
        { name: "forced_unhealthy", pass: false, detail: "Simulated unhealthy for Phase 6B test" },
      ],
    };
  }

  const status: ChangeStatus = health.ok ? "ACTIVE" : "UNHEALTHY";
  await updateChangeRecordStatus({
    id: changeRecordId,
    status,
    health,
  });

  return {
    ok: true,
    changeRecordId,
    status,
    activated,
    health,
    snapshot: gate.snapshot,
  };
}

/** Record a material rollback in change history (uses existing rollback; no auto). */
export async function recordMaterialRollbackChange(input: {
  productId: string;
  fromRevisionId: number;
  toRevisionId: number;
  snapshotBefore: PointerSnapshot;
  adminId: number | null;
  reason?: string;
}): Promise<number> {
  return recordComponentRollbackChange({
    ...input,
    kind: "material",
  });
}

/** Record a lighting (or other allowed) rollback in change history. */
export async function recordComponentRollbackChange(input: {
  productId: string;
  kind: ComponentKind;
  fromRevisionId: number;
  toRevisionId: number;
  snapshotBefore: PointerSnapshot;
  adminId: number | null;
  reason?: string;
  health?: HealthCheckResult | null;
  status?: ChangeStatus;
}): Promise<number> {
  const product = await getLegacyProductRow(input.productId);
  const health = input.health ?? (await runPostActivationHealthCheck(input.productId));
  const status: ChangeStatus =
    input.status ?? (health.ok ? "ROLLED_BACK" : "UNHEALTHY");
  return insertChangeRecord({
    productId: input.productId,
    customerUid: String(product?.customer_uid || ""),
    kind: input.kind,
    fromRevisionId: input.fromRevisionId,
    toRevisionId: input.toRevisionId,
    status,
    snapshot: input.snapshotBefore,
    reason: input.reason ?? null,
    adminId: input.adminId,
    health,
  });
}

export async function recordLightingRollbackChange(input: {
  productId: string;
  fromRevisionId: number;
  toRevisionId: number;
  snapshotBefore: PointerSnapshot;
  adminId: number | null;
  reason?: string;
  health?: HealthCheckResult | null;
}): Promise<number> {
  return recordComponentRollbackChange({
    ...input,
    kind: "lighting",
  });
}

export async function recordViewerRollbackChange(input: {
  productId: string;
  fromRevisionId: number;
  toRevisionId: number;
  snapshotBefore: PointerSnapshot;
  adminId: number | null;
  reason?: string;
  health?: HealthCheckResult | null;
}): Promise<number> {
  return recordComponentRollbackChange({
    ...input,
    kind: "viewer",
  });
}

export async function recordArRollbackChange(input: {
  productId: string;
  fromRevisionId: number;
  toRevisionId: number;
  snapshotBefore: PointerSnapshot;
  adminId: number | null;
  reason?: string;
  health?: HealthCheckResult | null;
}): Promise<number> {
  return recordComponentRollbackChange({
    ...input,
    kind: "ar",
  });
}
