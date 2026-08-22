/**
 * Phase 7 — controlled Product Migration / Upgrade Engine.
 *
 * Selected products only. No scope=all. No geometry migration.
 * No automatic VERSIONED global enable. No automatic rollback.
 */

import { query } from "@/lib/db";
import {
  capturePointerSnapshot,
  parseDeclaredDependencies,
  runPostActivationHealthCheck,
  recordComponentRollbackChange,
  type HealthCheckResult,
  type PointerSnapshot,
} from "@/lib/platform-versioning/activation-safety.service";
import { AR360_LEGACY_COMPAT_LABEL } from "@/lib/platform-versioning/foundation";
import {
  composeActiveVersionedConfig,
  getRevisionById,
  parseRevisionAssetRefs,
  parseRevisionConfig,
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
import { getPlatformReleaseById } from "@/lib/platform-versioning/releases.service";
import {
  getVersionedRuntimeFlag,
  selectRuntimeMode,
} from "@/lib/platform-versioning/runtime-selection";

export type MigrationPlanStatus =
  | "DRAFT"
  | "PREVIEW"
  | "CANARY"
  | "BATCHING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type MigrationProductStatus = "PENDING" | "BLOCKED" | "PASS" | "UNHEALTHY" | "SKIPPED";

export type MigratableKind = ComponentKind | "config";

export type ComponentTargetMap = Partial<Record<MigratableKind, number>>;

export type MigrationPlan = {
  id: number;
  releaseId: number | null;
  title: string;
  status: MigrationPlanStatus;
  rolloutMode: "selected_products";
  batchSize: number;
  components: MigratableKind[];
  notes: string | null;
  createdByAdminId: number | null;
  pausedReason: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type MigrationProductRow = {
  id: number;
  planId: number;
  productId: string;
  customerUid: string;
  sortOrder: number;
  status: MigrationProductStatus;
  snapshotBefore: PointerSnapshot | null;
  proposed: ComponentTargetMap;
  applied: ComponentTargetMap | null;
  validationCode: string | null;
  validationMessage: string | null;
  health: HealthCheckResult | null;
  errorMessage: string | null;
  batchIndex: number | null;
  processedAt: string | null;
};

const SUPPORTED_KINDS: MigratableKind[] = ["config", "material", "lighting", "viewer", "ar"];

function pointerColumn(kind: MigratableKind): string {
  return `active_${kind}_revision_id`;
}

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

function mapPlan(row: Record<string, unknown>): MigrationPlan {
  return {
    id: Number(row.id),
    releaseId: row.release_id == null ? null : Number(row.release_id),
    title: String(row.title || ""),
    status: String(row.status) as MigrationPlanStatus,
    rolloutMode: "selected_products",
    batchSize: Number(row.batch_size || 10),
    components: parseJson<MigratableKind[]>(row.components_json, []),
    notes: row.notes == null ? null : String(row.notes),
    createdByAdminId: row.created_by_admin_id == null ? null : Number(row.created_by_admin_id),
    pausedReason: row.paused_reason == null ? null : String(row.paused_reason),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  };
}

function mapProduct(row: Record<string, unknown>): MigrationProductRow {
  return {
    id: Number(row.id),
    planId: Number(row.plan_id),
    productId: String(row.product_uid),
    customerUid: String(row.customer_uid || ""),
    sortOrder: Number(row.sort_order || 0),
    status: String(row.status) as MigrationProductStatus,
    snapshotBefore: row.snapshot_before_json
      ? parseJson<PointerSnapshot>(row.snapshot_before_json, {
          config: null,
          geometry: null,
          material: null,
          lighting: null,
          viewer: null,
          ar: null,
        })
      : null,
    proposed: parseJson<ComponentTargetMap>(row.proposed_json, {}),
    applied: row.applied_json ? parseJson<ComponentTargetMap>(row.applied_json, {}) : null,
    validationCode: row.validation_code == null ? null : String(row.validation_code),
    validationMessage: row.validation_message == null ? null : String(row.validation_message),
    health: row.health_json ? parseJson<HealthCheckResult>(row.health_json, {
      ok: false,
      checks: [],
      materialSettingsType: "undefined",
      variantsIsArray: false,
      fallbackAvailable: false,
    }) : null,
    errorMessage: row.error_message == null ? null : String(row.error_message),
    batchIndex: row.batch_index == null ? null : Number(row.batch_index),
    processedAt: row.processed_at == null ? null : String(row.processed_at),
  };
}

export function isGeometryBlocked(kind: string): boolean {
  return kind === "geometry";
}

export function assertSelectedProductsOnly(scope: string): boolean {
  return scope === "selected_products";
}

/** Validate a single component target for migration (not draft activation). */
export async function validateMigrationComponentTarget(input: {
  productId: string;
  kind: MigratableKind;
  targetRevisionId: number;
  proposedSnapshot: PointerSnapshot;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (isGeometryBlocked(input.kind)) {
    return {
      ok: false,
      code: "GEOMETRY_NOT_SUPPORTED",
      message: "Geometry migration is NOT_SUPPORTED / BLOCKED in Phase 7",
    };
  }

  if (!SUPPORTED_KINDS.includes(input.kind)) {
    return { ok: false, code: "UNSUPPORTED_COMPONENT", message: `Unsupported component '${input.kind}'` };
  }

  const product = await getLegacyProductRow(input.productId);
  if (!product) {
    return { ok: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" };
  }

  const target = await getRevisionById(input.targetRevisionId);
  if (!target) {
    return { ok: false, code: "REVISION_NOT_FOUND", message: "Target revision not found" };
  }
  if (target.product_uid !== input.productId) {
    return { ok: false, code: "PRODUCT_MISMATCH", message: "Revision does not belong to product" };
  }

  if (input.kind === "config") {
    if (target.component_kind !== "config") {
      return {
        ok: false,
        code: "WRONG_COMPONENT",
        message: "Config migration requires a foundation config revision",
      };
    }
  } else if (target.component_kind !== input.kind) {
    return {
      ok: false,
      code: "WRONG_COMPONENT",
      message: `Expected component_kind '${input.kind}', got '${target.component_kind}'`,
    };
  }

  if (target.status === "draft") {
    return { ok: false, code: "DRAFT_REJECTED", message: "Draft revisions cannot be migration targets" };
  }

  const currentId =
    Number((product as Record<string, unknown>)[pointerColumn(input.kind)] || 0) || null;
  if (currentId != null && Number(target.id) === currentId) {
    return { ok: false, code: "ALREADY_CURRENT", message: "Target revision is already active for this component" };
  }

  if ((target.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL) !== AR360_LEGACY_COMPAT_LABEL) {
    return {
      ok: false,
      code: "COMPATIBILITY_FAILED",
      message: `Compatibility failed: label '${target.renderer_compat_label}'`,
    };
  }

  const assets = await validateProductRevisionAssets({
    customerUid: String(product.customer_uid || target.customer_uid || ""),
    productId: input.productId,
    assetRefs: parseRevisionAssetRefs(target),
  });
  if (!assets.ok) {
    return { ok: false, code: "ASSET_VALIDATION_FAILED", message: "Asset validation failed" };
  }

  const refs = parseRevisionAssetRefs(target);
  if (refs.modelUrl && /__missing__|does-not-exist/i.test(String(refs.modelUrl))) {
    return { ok: false, code: "ASSET_VALIDATION_FAILED", message: "modelUrl points to missing asset" };
  }

  // Full runtime JSON contract required for material/config bodies.
  // Viewer/lighting/AR slices do not own materialSettings — avoid blocking on unrelated body pollution.
  if (input.kind === "material" || input.kind === "config") {
    const jsonOk = deserializeVersionedConfigForRuntime(parseRevisionConfig(target));
    if (jsonOk.ok === false) {
      return { ok: false, code: "VERSIONED_CONFIG_ERROR", message: jsonOk.message };
    }
  } else {
    const cfg = parseRevisionConfig(target);
    if (cfg.settings != null && typeof cfg.settings === "string") {
      try {
        JSON.parse(cfg.settings);
      } catch {
        return {
          ok: false,
          code: "VERSIONED_CONFIG_ERROR",
          message: "settings: expected object or JSON object string",
        };
      }
    }
  }

  const deps = parseDeclaredDependencies(parseRevisionConfig(target));
  for (const kind of COMPONENT_KINDS) {
    const req = deps[kind]?.minComponentRevisionNumber;
    if (req == null) continue;
    const fromSnap = input.proposedSnapshot[kind];
    const fromProduct = Number(
      (product as Record<string, unknown>)[`active_${kind}_revision_id`] || 0,
    );
    const pointerId = fromSnap ?? (fromProduct > 0 ? fromProduct : null);
    if (!pointerId) {
      return {
        ok: false,
        code: "DEPENDENCY_CONFLICT",
        message: `Dependency conflict: ${kind} requires min v${req} but is missing`,
      };
    }
    const rev = await getRevisionById(pointerId);
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
        message: `Dependency conflict: ${kind} requires min v${req} but active is ${actual == null ? "missing" : `v${actual}`}`,
      };
    }
  }

  return { ok: true };
}

async function buildProposedSnapshot(
  current: PointerSnapshot,
  proposed: ComponentTargetMap,
): Promise<PointerSnapshot> {
  return {
    config: proposed.config ?? current.config,
    geometry: proposed.geometry ?? current.geometry,
    material: proposed.material ?? current.material,
    lighting: proposed.lighting ?? current.lighting,
    viewer: proposed.viewer ?? current.viewer,
    ar: proposed.ar ?? current.ar,
  };
}

export async function validateProductMigration(input: {
  productId: string;
  proposed: ComponentTargetMap;
}): Promise<{ ok: true; snapshot: PointerSnapshot; proposedSnapshot: PointerSnapshot } | { ok: false; code: string; message: string }> {
  const canaryFlag = await getVersionedRuntimeFlag();
  if (canaryFlag?.targeting.scope === "all") {
    return {
      ok: false,
      code: "CANARY_SCOPE_ALL_FORBIDDEN",
      message: "Global VERSIONED scope=all is forbidden during migration",
    };
  }

  const product = await getLegacyProductRow(input.productId);
  if (!product) {
    return { ok: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" };
  }

  const snapshot = await capturePointerSnapshot(input.productId);
  if (!snapshot) {
    return { ok: false, code: "SNAPSHOT_FAILED", message: "Unable to capture pointer snapshot" };
  }

  if (Object.keys(input.proposed).length === 0) {
    return { ok: false, code: "NO_TARGETS", message: "No component targets specified" };
  }

  if (input.proposed.geometry != null) {
    return {
      ok: false,
      code: "GEOMETRY_NOT_SUPPORTED",
      message: "Geometry migration is NOT_SUPPORTED / BLOCKED in Phase 7",
    };
  }

  const proposedSnapshot = await buildProposedSnapshot(snapshot, input.proposed);

  for (const [kind, revisionId] of Object.entries(input.proposed) as Array<[MigratableKind, number]>) {
    if (revisionId == null) continue;
    const result = await validateMigrationComponentTarget({
      productId: input.productId,
      kind,
      targetRevisionId: Number(revisionId),
      proposedSnapshot,
    });
    if (result.ok === false) return result;
  }

  // Composed runtime must succeed with current active pointers at least
  const composed = await composeActiveVersionedConfig(input.productId);
  if (!composed) {
    return { ok: false, code: "COMPOSE_FAILED", message: "Unable to compose current versioned config" };
  }

  return { ok: true, snapshot, proposedSnapshot };
}

export async function createMigrationPlan(input: {
  title: string;
  releaseId?: number | null;
  batchSize?: number;
  notes?: string;
  adminId: number | null;
  products: Array<{
    productId: string;
    proposed: ComponentTargetMap;
  }>;
}): Promise<MigrationPlan> {
  if (!assertSelectedProductsOnly("selected_products")) {
    throw new Error("CANARY_SCOPE_ALL_FORBIDDEN: only selected_products allowed");
  }
  if (!input.products.length) {
    throw new Error("At least one product is required");
  }

  if (input.releaseId) {
    const release = await getPlatformReleaseById(input.releaseId);
    if (!release) throw new Error("Release not found");
  }

  const components = new Set<MigratableKind>();
  for (const p of input.products) {
    for (const k of Object.keys(p.proposed) as MigratableKind[]) {
      if (isGeometryBlocked(k)) {
        throw new Error("GEOMETRY_NOT_SUPPORTED: geometry migration is blocked");
      }
      components.add(k);
    }
  }

  const batchSize = Math.min(100, Math.max(1, Number(input.batchSize || 10)));

  await query(
    `INSERT INTO ar360_migration_plans
      (release_id, title, status, rollout_mode, batch_size, components_json, notes, created_by_admin_id, created_at, updated_at)
     VALUES (?, ?, 'DRAFT', 'selected_products', ?, ?, ?, ?, NOW(), NOW())`,
    [
      input.releaseId ?? null,
      input.title.slice(0, 200),
      batchSize,
      JSON.stringify([...components]),
      input.notes?.slice(0, 512) ?? null,
      input.adminId,
    ],
  );

  const planRows = await query<{ id: number }>(
    `SELECT id FROM ar360_migration_plans ORDER BY id DESC LIMIT 1`,
  );
  const planId = Number(planRows[0]?.id);
  if (!planId) throw new Error("Failed to create migration plan");

  let sort = 0;
  for (const p of input.products) {
    const product = await getLegacyProductRow(p.productId);
    if (!product) throw new Error(`Product not found: ${p.productId}`);
    await query(
      `INSERT INTO ar360_migration_plan_products
        (plan_id, product_uid, customer_uid, sort_order, status, proposed_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?, NOW(), NOW())`,
      [
        planId,
        p.productId,
        String(product.customer_uid || ""),
        sort++,
        JSON.stringify(p.proposed),
      ],
    );
  }

  const plan = await getMigrationPlan(planId);
  if (!plan) throw new Error("Plan missing after create");
  return plan;
}

export async function getMigrationPlan(planId: number): Promise<MigrationPlan | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM ar360_migration_plans WHERE id = ? LIMIT 1`,
    [planId],
  );
  return rows[0] ? mapPlan(rows[0]) : null;
}

export async function listMigrationPlans(limit = 50): Promise<MigrationPlan[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM ar360_migration_plans ORDER BY id DESC LIMIT ?`,
    [Math.min(200, Math.max(1, limit))],
  );
  return rows.map(mapPlan);
}

export async function listMigrationProducts(planId: number): Promise<MigrationProductRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM ar360_migration_plan_products WHERE plan_id = ? ORDER BY sort_order ASC, id ASC`,
    [planId],
  );
  return rows.map(mapProduct);
}

export async function getMigrationPlanSummary(planId: number) {
  const plan = await getMigrationPlan(planId);
  if (!plan) return null;
  const products = await listMigrationProducts(planId);
  const counts = {
    total: products.length,
    pending: products.filter((p) => p.status === "PENDING").length,
    pass: products.filter((p) => p.status === "PASS").length,
    unhealthy: products.filter((p) => p.status === "UNHEALTHY").length,
    blocked: products.filter((p) => p.status === "BLOCKED").length,
    skipped: products.filter((p) => p.status === "SKIPPED").length,
  };
  return { plan, products, counts, paused: plan.status === "PAUSED" };
}

export async function previewMigrationPlan(planId: number): Promise<{
  banner: "MIGRATION PREVIEW";
  plan: MigrationPlan;
  products: Array<{
    productId: string;
    current: PointerSnapshot;
    proposed: PointerSnapshot;
    changes: Array<{ component: MigratableKind; from: number | null; to: number }>;
    validation: { ok: true } | { ok: false; code: string; message: string };
  }>;
}> {
  const plan = await getMigrationPlan(planId);
  if (!plan) throw new Error("Plan not found");
  const rows = await listMigrationProducts(planId);
  const products = [];

  for (const row of rows) {
    const current = await capturePointerSnapshot(row.productId);
    if (!current) {
      products.push({
        productId: row.productId,
        current: {
          config: null,
          geometry: null,
          material: null,
          lighting: null,
          viewer: null,
          ar: null,
        },
        proposed: {
          config: null,
          geometry: null,
          material: null,
          lighting: null,
          viewer: null,
          ar: null,
        },
        changes: [],
        validation: { ok: false as const, code: "PRODUCT_NOT_FOUND", message: "Product not found" },
      });
      continue;
    }

    const before = JSON.stringify(current);
    const validation = await validateProductMigration({
      productId: row.productId,
      proposed: row.proposed,
    });
    const after = await capturePointerSnapshot(row.productId);
    if (JSON.stringify(after) !== before) {
      throw new Error("PREVIEW_MUTATION_DETECTED: preview mutated product pointers");
    }

    const proposedSnapshot =
      validation.ok === true
        ? validation.proposedSnapshot
        : await buildProposedSnapshot(current, row.proposed);

    const changes: Array<{ component: MigratableKind; from: number | null; to: number }> = [];
    for (const [kind, toId] of Object.entries(row.proposed) as Array<[MigratableKind, number]>) {
      changes.push({
        component: kind,
        from: current[kind === "config" ? "config" : kind],
        to: Number(toId),
      });
    }

    products.push({
      productId: row.productId,
      current,
      proposed: proposedSnapshot,
      changes,
      validation:
        validation.ok === true
          ? { ok: true as const }
          : { ok: false as const, code: validation.code, message: validation.message },
    });
  }

  await query(
    `UPDATE ar360_migration_plans SET status = IF(status = 'DRAFT', 'PREVIEW', status), updated_at = NOW() WHERE id = ?`,
    [planId],
  );

  const refreshed = await getMigrationPlan(planId);
  return {
    banner: "MIGRATION PREVIEW",
    plan: refreshed!,
    products,
  };
}

async function applyPointerChange(input: {
  productId: string;
  kind: MigratableKind;
  targetRevisionId: number;
  adminId: number | null;
  reason: string;
}): Promise<void> {
  const column = pointerColumn(input.kind);
  const product = await getLegacyProductRow(input.productId);
  if (!product) throw new Error("Product not found");
  const previousId = Number((product as Record<string, unknown>)[column] || 0) || null;

  // Snapshot other pointers for safety
  const snap = await capturePointerSnapshot(input.productId);
  if (!snap) throw new Error("Snapshot failed");

  if (previousId && input.kind !== "config") {
    const prev = await getRevisionById(previousId);
    if (prev && prev.component_kind === input.kind && prev.status === "active") {
      await query(
        `UPDATE ar360_product_config_revisions
            SET status = 'archived', updated_at = NOW(), updated_by_admin_id = ?, reason = COALESCE(?, reason)
          WHERE id = ? AND product_uid = ? AND component_kind = ? AND status = 'active'`,
        [input.adminId, input.reason.slice(0, 255), previousId, input.productId, input.kind],
      );
    }
  }

  const target = await getRevisionById(input.targetRevisionId);
  if (target && input.kind !== "config" && target.component_kind === input.kind && target.status === "archived") {
    await query(
      `UPDATE ar360_product_config_revisions
          SET status = 'active', updated_at = NOW(), updated_by_admin_id = ?
        WHERE id = ? AND product_uid = ? AND component_kind = ?`,
      [input.adminId, input.targetRevisionId, input.productId, input.kind],
    );
  }

  await query(`UPDATE products SET ${column} = ? WHERE id = ?`, [
    input.targetRevisionId,
    input.productId,
  ]);

  const after = await capturePointerSnapshot(input.productId);
  if (!after) throw new Error("Missing product after pointer update");

  for (const kind of ["config", "geometry", "material", "lighting", "viewer", "ar"] as const) {
    if (kind === input.kind) continue;
    if (after[kind] !== snap[kind]) {
      throw new Error(`SAFETY: unexpected pointer change for ${kind} during ${input.kind} migration`);
    }
  }
}

async function migrateOneProduct(input: {
  plan: MigrationPlan;
  row: MigrationProductRow;
  adminId: number | null;
  batchIndex: number;
}): Promise<MigrationProductStatus> {
  const validation = await validateProductMigration({
    productId: input.row.productId,
    proposed: input.row.proposed,
  });

  if (validation.ok === false) {
    await query(
      `UPDATE ar360_migration_plan_products
          SET status = 'BLOCKED',
              validation_code = ?,
              validation_message = ?,
              error_message = ?,
              batch_index = ?,
              processed_at = NOW(),
              updated_at = NOW()
        WHERE id = ?`,
      [
        validation.code,
        validation.message.slice(0, 512),
        validation.message.slice(0, 512),
        input.batchIndex,
        input.row.id,
      ],
    );
    return "BLOCKED";
  }

  const snapshot = validation.snapshot;
  await query(
    `UPDATE ar360_migration_plan_products
        SET snapshot_before_json = ?, updated_at = NOW()
      WHERE id = ?`,
    [JSON.stringify(snapshot), input.row.id],
  );

  const applied: ComponentTargetMap = {};
  try {
    for (const [kind, revisionId] of Object.entries(input.row.proposed) as Array<[MigratableKind, number]>) {
      await applyPointerChange({
        productId: input.row.productId,
        kind,
        targetRevisionId: Number(revisionId),
        adminId: input.adminId,
        reason: `Migration plan #${input.plan.id}: ${input.plan.title}`,
      });
      applied[kind] = Number(revisionId);

      // Change history — reuse existing table (ROLLED_BACK not used; ACTIVE for upgrade apply)
      if (kind !== "config") {
        await recordComponentRollbackChange({
          productId: input.row.productId,
          kind,
          fromRevisionId: snapshot[kind],
          toRevisionId: Number(revisionId),
          snapshotBefore: snapshot,
          adminId: input.adminId,
          reason: `Migration plan #${input.plan.id} (${input.plan.title})`,
          status: "ACTIVE",
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Migration apply failed";
    await query(
      `UPDATE ar360_migration_plan_products
          SET status = 'BLOCKED',
              applied_json = ?,
              error_message = ?,
              validation_code = 'APPLY_FAILED',
              validation_message = ?,
              batch_index = ?,
              processed_at = NOW(),
              updated_at = NOW()
        WHERE id = ?`,
      [
        JSON.stringify(applied),
        message.slice(0, 512),
        message.slice(0, 512),
        input.batchIndex,
        input.row.id,
      ],
    );
    return "BLOCKED";
  }

  const health = await runPostActivationHealthCheck(input.row.productId);
  const status: MigrationProductStatus = health.ok ? "PASS" : "UNHEALTHY";

  await query(
    `UPDATE ar360_migration_plan_products
        SET status = ?,
            applied_json = ?,
            health_json = ?,
            batch_index = ?,
            processed_at = NOW(),
            updated_at = NOW()
      WHERE id = ?`,
    [status, JSON.stringify(applied), JSON.stringify(health), input.batchIndex, input.row.id],
  );

  return status;
}

export async function executeMigrationBatch(input: {
  planId: number;
  adminId: number | null;
  /** Canary: only process these product IDs (must be in plan). */
  canaryProductIds?: string[];
  confirm: boolean;
}): Promise<{
  plan: MigrationPlan;
  processed: Array<{ productId: string; status: MigrationProductStatus }>;
  paused: boolean;
  pausedReason: string | null;
}> {
  if (!input.confirm) throw new Error("confirmation_required");

  const plan = await getMigrationPlan(input.planId);
  if (!plan) throw new Error("Plan not found");
  if (plan.rolloutMode !== "selected_products") {
    throw new Error("CANARY_SCOPE_ALL_FORBIDDEN");
  }
  if (plan.status === "COMPLETED" || plan.status === "CANCELLED") {
    throw new Error(`Plan is ${plan.status}`);
  }

  const flag = await getVersionedRuntimeFlag();
  if (flag?.targeting.scope === "all") {
    throw new Error("CANARY_SCOPE_ALL_FORBIDDEN: disable scope=all before migrating");
  }
  // Defense: selection still blocks all
  const probe = selectRuntimeMode({
    productId: "__probe__",
    flagEnabled: true,
    targeting: { scope: "all", productIds: [] },
    forbidGlobal: true,
  });
  if (probe.reason !== "global_forbidden_blocked") {
    throw new Error("CANARY_GUARD_FAILED");
  }

  const all = await listMigrationProducts(input.planId);
  let pending = all.filter((p) => p.status === "PENDING");

  if (input.canaryProductIds?.length) {
    const set = new Set(input.canaryProductIds);
    pending = pending.filter((p) => set.has(p.productId));
    await query(
      `UPDATE ar360_migration_plans SET status = 'CANARY', updated_at = NOW() WHERE id = ?`,
      [input.planId],
    );
  } else {
    await query(
      `UPDATE ar360_migration_plans SET status = 'BATCHING', paused_reason = NULL, updated_at = NOW() WHERE id = ?`,
      [input.planId],
    );
  }

  const batch = pending.slice(0, plan.batchSize);
  const batchIndex =
    Math.max(0, ...all.map((p) => p.batchIndex ?? 0)) + (batch.length ? 1 : 0);

  const processed: Array<{ productId: string; status: MigrationProductStatus }> = [];
  let pause = false;
  let pausedReason: string | null = null;

  for (const row of batch) {
    const refreshedPlan = (await getMigrationPlan(input.planId))!;
    const status = await migrateOneProduct({
      plan: refreshedPlan,
      row,
      adminId: input.adminId,
      batchIndex,
    });
    processed.push({ productId: row.productId, status });
    if (status === "UNHEALTHY" || status === "BLOCKED") {
      pause = true;
      pausedReason = `Paused after ${row.productId} → ${status}. Resume explicitly to continue.`;
      break;
    }
  }

  if (pause) {
    await query(
      `UPDATE ar360_migration_plans SET status = 'PAUSED', paused_reason = ?, updated_at = NOW() WHERE id = ?`,
      [pausedReason, input.planId],
    );
  } else {
    const remaining = (await listMigrationProducts(input.planId)).filter(
      (p) => p.status === "PENDING",
    );
    if (remaining.length === 0) {
      await query(
        `UPDATE ar360_migration_plans SET status = 'COMPLETED', paused_reason = NULL, updated_at = NOW() WHERE id = ?`,
        [input.planId],
      );
    } else if (input.canaryProductIds?.length) {
      await query(
        `UPDATE ar360_migration_plans SET status = 'CANARY', updated_at = NOW() WHERE id = ?`,
        [input.planId],
      );
    } else {
      await query(
        `UPDATE ar360_migration_plans SET status = 'BATCHING', updated_at = NOW() WHERE id = ?`,
        [input.planId],
      );
    }
  }

  const updated = await getMigrationPlan(input.planId);
  return {
    plan: updated!,
    processed,
    paused: pause,
    pausedReason,
  };
}

export async function resumeMigrationPlan(planId: number): Promise<MigrationPlan> {
  const plan = await getMigrationPlan(planId);
  if (!plan) throw new Error("Plan not found");
  if (plan.status !== "PAUSED") throw new Error("Plan is not PAUSED");
  await query(
    `UPDATE ar360_migration_plans SET status = 'BATCHING', paused_reason = NULL, updated_at = NOW() WHERE id = ?`,
    [planId],
  );
  return (await getMigrationPlan(planId))!;
}

/** Explicit pause — does not rollback successful products. */
export async function pauseMigrationPlan(
  planId: number,
  reason = "Paused by Master Admin",
): Promise<MigrationPlan> {
  const plan = await getMigrationPlan(planId);
  if (!plan) throw new Error("Plan not found");
  if (plan.status === "COMPLETED" || plan.status === "CANCELLED") {
    throw new Error(`Plan is ${plan.status}`);
  }
  await query(
    `UPDATE ar360_migration_plans SET status = 'PAUSED', paused_reason = ?, updated_at = NOW() WHERE id = ?`,
    [reason.slice(0, 512), planId],
  );
  return (await getMigrationPlan(planId))!;
}

/** Cancel remaining work — does not undo PASS products. */
export async function cancelMigrationPlan(planId: number): Promise<MigrationPlan> {
  const plan = await getMigrationPlan(planId);
  if (!plan) throw new Error("Plan not found");
  if (plan.status === "COMPLETED") {
    throw new Error("Completed plans cannot be cancelled");
  }
  await query(
    `UPDATE ar360_migration_plans SET status = 'CANCELLED', paused_reason = NULL, updated_at = NOW() WHERE id = ?`,
    [planId],
  );
  await query(
    `UPDATE ar360_migration_plan_products
        SET status = 'SKIPPED', updated_at = NOW()
      WHERE plan_id = ? AND status = 'PENDING'`,
    [planId],
  );
  return (await getMigrationPlan(planId))!;
}

export function rollbackAvailabilityForProduct(applied: ComponentTargetMap | null): {
  material: boolean;
  lighting: boolean;
  viewer: boolean;
  ar: boolean;
  geometry: false;
} {
  return {
    material: applied?.material != null,
    lighting: applied?.lighting != null,
    viewer: applied?.viewer != null,
    ar: applied?.ar != null,
    geometry: false,
  };
}
