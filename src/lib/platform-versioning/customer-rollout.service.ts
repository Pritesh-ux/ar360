/**
 * Phase 9 — Controlled Customer Rollout.
 *
 * Thin orchestration over Phase 7 Migration Engine + Phase 8 Client Update Policy.
 * Does NOT reimplement migration. Does NOT execute AUTO. Does NOT enable global VERSIONED.
 */

import { query } from "@/lib/db";
import {
  autoPolicyIsExecutable,
  getClientUpdateState,
  type UpdatePolicyMode,
} from "@/lib/platform-versioning/client-update-policy.service";
import {
  cancelMigrationPlan,
  createMigrationPlan,
  executeMigrationBatch,
  getMigrationPlanSummary,
  isGeometryBlocked,
  pauseMigrationPlan,
  previewMigrationPlan,
  resumeMigrationPlan,
  rollbackAvailabilityForProduct,
  type ComponentTargetMap,
  type MigrationPlanStatus,
  type MigrationProductStatus,
} from "@/lib/platform-versioning/migration-engine.service";
import { getPlatformReleaseById } from "@/lib/platform-versioning/releases.service";
import {
  listCanaryProductIds,
  setProductCanaryRuntime,
} from "@/lib/platform-versioning/runtime-selection";

export type CustomerRolloutStatus =
  | "READY"
  | "PREVIEW"
  | "CANARY"
  | "BATCHING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** Display-oriented product status (Phase 7 statuses + CANARY label when in canary wave). */
export type RolloutProductDisplayStatus =
  | "PENDING"
  | "BLOCKED"
  | "CANARY"
  | "PASS"
  | "UNHEALTHY"
  | "SKIPPED";

export type CustomerRollout = {
  id: number;
  customerUid: string;
  migrationPlanId: number;
  currentReleaseId: number | null;
  targetReleaseId: number;
  updatePolicySnapshot: UpdatePolicyMode;
  status: CustomerRolloutStatus;
  productIds: string[];
  createdByAdminId: number | null;
  lastActivityAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type RolloutRow = {
  id: number;
  customer_uid: string;
  migration_plan_id: number;
  current_release_id: number | null;
  target_release_id: number;
  update_policy_snapshot: UpdatePolicyMode;
  status: CustomerRolloutStatus;
  product_ids_json: unknown;
  created_by_admin_id: number | null;
  last_activity_at: Date | string | null;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
};

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRollout(row: RolloutRow): CustomerRollout {
  return {
    id: Number(row.id),
    customerUid: row.customer_uid,
    migrationPlanId: Number(row.migration_plan_id),
    currentReleaseId: row.current_release_id == null ? null : Number(row.current_release_id),
    targetReleaseId: Number(row.target_release_id),
    updatePolicySnapshot: row.update_policy_snapshot,
    status: row.status,
    productIds: parseJsonArray(row.product_ids_json),
    createdByAdminId:
      row.created_by_admin_id == null ? null : Number(row.created_by_admin_id),
    lastActivityAt: row.last_activity_at == null ? null : String(row.last_activity_at),
    notes: row.notes,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  };
}

export function mapPlanStatusToRollout(status: MigrationPlanStatus): CustomerRolloutStatus {
  switch (status) {
    case "DRAFT":
      return "READY";
    case "PREVIEW":
      return "PREVIEW";
    case "CANARY":
      return "CANARY";
    case "BATCHING":
      return "BATCHING";
    case "PAUSED":
      return "PAUSED";
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "READY";
  }
}

export function displayProductStatus(input: {
  planStatus: MigrationPlanStatus;
  productStatus: MigrationProductStatus;
  inCanaryWave: boolean;
}): RolloutProductDisplayStatus {
  if (input.productStatus === "PENDING" && input.inCanaryWave && input.planStatus === "CANARY") {
    return "CANARY";
  }
  return input.productStatus as RolloutProductDisplayStatus;
}

export function autoRolloutIsExecutable(): false {
  return false;
}

export function assertRolloutScopeSelectedOnly(scope: string): boolean {
  return scope === "one_client_selected_products";
}

/** Gate canary/batch execution against Phase 8 policy. */
export function assertRolloutExecutionAllowed(input: {
  policy: UpdatePolicyMode;
  approvedAt: string | null;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.policy === "AUTO") {
    if (autoPolicyIsExecutable() || autoRolloutIsExecutable()) {
      return {
        ok: false,
        code: "AUTO_EXECUTABLE_FORBIDDEN",
        message: "AUTO must never execute in Phase 9",
      };
    }
    return {
      ok: false,
      code: "AUTO_NOT_EXECUTABLE",
      message: "AUTO policy is stored only and is NOT executable. Use MANUAL or APPROVAL_REQUIRED.",
    };
  }
  if (input.policy === "APPROVAL_REQUIRED" && !input.approvedAt) {
    return {
      ok: false,
      code: "APPROVAL_REQUIRED",
      message: "Target release must be approved before starting canary or batch.",
    };
  }
  // MANUAL: explicit Master Admin action is the gate (caller must be authenticated manage).
  return { ok: true };
}

async function getRolloutRow(id: number): Promise<RolloutRow | null> {
  const rows = await query<RolloutRow>(
    `SELECT * FROM ar360_customer_rollouts WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

async function syncRolloutStatusFromPlan(rolloutId: number): Promise<CustomerRollout> {
  const row = await getRolloutRow(rolloutId);
  if (!row) throw new Error("Rollout not found");
  const summary = await getMigrationPlanSummary(Number(row.migration_plan_id));
  if (!summary) throw new Error("Linked migration plan missing");

  let status = mapPlanStatusToRollout(summary.plan.status);
  if (summary.counts.unhealthy > 0 && summary.plan.status === "PAUSED") {
    status = "PAUSED";
  }

  await query(
    `UPDATE ar360_customer_rollouts
        SET status = ?, last_activity_at = NOW(), updated_at = NOW()
      WHERE id = ?`,
    [status, rolloutId],
  );

  await syncClientPolicyFromRollout(mapRollout({ ...row, status }));

  const refreshed = await getRolloutRow(rolloutId);
  return mapRollout(refreshed!);
}

async function syncClientPolicyFromRollout(rollout: CustomerRollout): Promise<void> {
  const summary = await getMigrationPlanSummary(rollout.migrationPlanId);
  if (!summary) return;

  let clientStatus = "MIGRATION_IN_PROGRESS";
  if (rollout.status === "PAUSED") clientStatus = "PAUSED";
  if (rollout.status === "CANCELLED") clientStatus = "UPDATE_AVAILABLE";
  if (rollout.status === "FAILED") clientStatus = "BLOCKED";
  if (rollout.status === "READY" || rollout.status === "PREVIEW") {
    clientStatus = "MIGRATION_IN_PROGRESS";
  }

  if (rollout.status === "COMPLETED") {
    const pendingEligible = summary.counts.pending;
    const unhealthy = summary.counts.unhealthy;
    if (pendingEligible === 0 && unhealthy === 0) {
      clientStatus = "UP_TO_DATE";
      await query(
        `UPDATE ar360_client_update_policies
            SET current_release_id = COALESCE(?, current_release_id),
                status = ?,
                last_update_at = NOW(),
                updated_at = NOW()
          WHERE customer_uid = ?`,
        [rollout.targetReleaseId, clientStatus, rollout.customerUid],
      );
      // Ensure row exists without overwriting policy
      const existing = await query<{ id: number }>(
        `SELECT id FROM ar360_client_update_policies WHERE customer_uid = ? LIMIT 1`,
        [rollout.customerUid],
      );
      if (!existing[0]) {
        await query(
          `INSERT INTO ar360_client_update_policies
            (customer_uid, update_policy, status, current_release_id, target_release_id, last_update_at, created_at, updated_at)
           VALUES (?, 'MANUAL', ?, ?, ?, NOW(), NOW(), NOW())`,
          [rollout.customerUid, clientStatus, rollout.targetReleaseId, rollout.targetReleaseId],
        );
      }
      return;
    }
    clientStatus = "MIGRATION_IN_PROGRESS";
  }

  if (rollout.status === "CANARY" || rollout.status === "BATCHING") {
    clientStatus = "MIGRATION_IN_PROGRESS";
  }

  const updated = await query(
    `UPDATE ar360_client_update_policies
        SET status = ?, updated_at = NOW()
      WHERE customer_uid = ?`,
    [clientStatus, rollout.customerUid],
  );
  void updated;
  const existing = await query<{ id: number }>(
    `SELECT id FROM ar360_client_update_policies WHERE customer_uid = ? LIMIT 1`,
    [rollout.customerUid],
  );
  if (!existing[0]) {
    await query(
      `INSERT INTO ar360_client_update_policies
        (customer_uid, update_policy, status, target_release_id, created_at, updated_at)
       VALUES (?, 'MANUAL', ?, ?, NOW(), NOW())`,
      [rollout.customerUid, clientStatus, rollout.targetReleaseId],
    );
  }
}

export async function createCustomerRollout(input: {
  customerUid: string;
  targetReleaseId?: number | null;
  batchSize?: number;
  notes?: string;
  adminId: number | null;
  /** Explicit selected products only — never all customer products implicitly. */
  products: Array<{
    productId: string;
    proposed: ComponentTargetMap;
  }>;
  scope?: string;
}): Promise<{ rollout: CustomerRollout; migrationPlanId: number }> {
  if (!assertRolloutScopeSelectedOnly(input.scope || "one_client_selected_products")) {
    throw new Error("ROLLOUT_SCOPE_FORBIDDEN: only one_client_selected_products allowed");
  }
  if (!input.products.length) {
    throw new Error("At least one explicitly selected product is required");
  }
  for (const p of input.products) {
    for (const k of Object.keys(p.proposed)) {
      if (isGeometryBlocked(k)) {
        throw new Error("GEOMETRY_NOT_SUPPORTED: geometry migration is blocked");
      }
    }
  }

  const clientDetail = await getClientUpdateState(input.customerUid);
  if (!clientDetail) throw new Error("Client not found");

  const targetReleaseId =
    input.targetReleaseId != null
      ? Number(input.targetReleaseId)
      : clientDetail.client.targetReleaseId;
  if (!targetReleaseId) {
    throw new Error("Target release is required (set on client policy or pass targetReleaseId)");
  }

  const release = await getPlatformReleaseById(targetReleaseId);
  if (!release) throw new Error("Target release not found");
  if (release.status !== "published") {
    throw new Error(`Target release must be published (got ${release.status})`);
  }

  // Verify all products belong to this client
  for (const p of input.products) {
    const rows = await query<{ customer_uid: string | null }>(
      `SELECT customer_uid FROM products WHERE id = ? LIMIT 1`,
      [p.productId],
    );
    if (!rows[0]) throw new Error(`Product not found: ${p.productId}`);
    if (String(rows[0].customer_uid || "") !== input.customerUid) {
      throw new Error(`Product ${p.productId} does not belong to client ${input.customerUid}`);
    }
  }

  const policy = clientDetail.client.updatePolicy;
  if (policy === "AUTO" && autoRolloutIsExecutable()) {
    throw new Error("AUTO_EXECUTABLE_FORBIDDEN");
  }

  const title = `Customer rollout ${input.customerUid} → ${release.version}`;
  const plan = await createMigrationPlan({
    title: title.slice(0, 200),
    releaseId: targetReleaseId,
    batchSize: input.batchSize ?? 5,
    notes: input.notes,
    adminId: input.adminId,
    products: input.products,
  });

  const productIds = input.products.map((p) => p.productId);
  await query(
    `INSERT INTO ar360_customer_rollouts
      (customer_uid, migration_plan_id, current_release_id, target_release_id,
       update_policy_snapshot, status, product_ids_json, created_by_admin_id,
       last_activity_at, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'READY', ?, ?, NOW(), ?, NOW(), NOW())`,
    [
      input.customerUid,
      plan.id,
      clientDetail.client.currentReleaseId,
      targetReleaseId,
      policy,
      JSON.stringify(productIds),
      input.adminId,
      input.notes?.slice(0, 512) ?? null,
    ],
  );

  const created = await query<RolloutRow>(
    `SELECT * FROM ar360_customer_rollouts ORDER BY id DESC LIMIT 1`,
  );
  const rollout = mapRollout(created[0]!);
  await syncClientPolicyFromRollout(rollout);
  return { rollout, migrationPlanId: plan.id };
}

export async function listCustomerRollouts(limit = 100): Promise<
  Array<
    CustomerRollout & {
      companyName: string | null;
      currentReleaseVersion: string | null;
      targetReleaseVersion: string | null;
      progress: {
        total: number;
        pending: number;
        pass: number;
        blocked: number;
        unhealthy: number;
        skipped: number;
      };
    }
  >
> {
  const rows = await query<RolloutRow>(
    `SELECT * FROM ar360_customer_rollouts ORDER BY id DESC LIMIT ?`,
    [Math.min(500, Math.max(1, limit))],
  );

  const out = [];
  for (const row of rows) {
    const rollout = mapRollout(row);
    const [cust, currentRel, targetRel, summary] = await Promise.all([
      query<{ company_name: string | null }>(
        `SELECT company_name FROM customers WHERE customer_uid = ? LIMIT 1`,
        [rollout.customerUid],
      ),
      rollout.currentReleaseId
        ? getPlatformReleaseById(rollout.currentReleaseId)
        : Promise.resolve(null),
      getPlatformReleaseById(rollout.targetReleaseId),
      getMigrationPlanSummary(rollout.migrationPlanId),
    ]);
    out.push({
      ...rollout,
      companyName: cust[0]?.company_name ?? null,
      currentReleaseVersion: currentRel?.version ?? null,
      targetReleaseVersion: targetRel?.version ?? null,
      progress: summary
        ? {
            total: summary.counts.total,
            pending: summary.counts.pending,
            pass: summary.counts.pass,
            blocked: summary.counts.blocked,
            unhealthy: summary.counts.unhealthy,
            skipped: summary.counts.skipped,
          }
        : { total: 0, pending: 0, pass: 0, blocked: 0, unhealthy: 0, skipped: 0 },
    });
  }
  return out;
}

export async function getCustomerRolloutDetail(rolloutId: number) {
  const row = await getRolloutRow(rolloutId);
  if (!row) return null;
  const rollout = mapRollout(row);
  const [clientDetail, currentRel, targetRel, summary] = await Promise.all([
    getClientUpdateState(rollout.customerUid),
    rollout.currentReleaseId
      ? getPlatformReleaseById(rollout.currentReleaseId)
      : Promise.resolve(null),
    getPlatformReleaseById(rollout.targetReleaseId),
    getMigrationPlanSummary(rollout.migrationPlanId),
  ]);
  if (!summary) return null;

  const canaryIds = await listCanaryProductIds();
  const canarySet = new Set(canaryIds);

  return {
    rollout: {
      ...rollout,
      currentReleaseVersion: currentRel?.version ?? null,
      targetReleaseVersion: targetRel?.version ?? null,
      companyName: clientDetail?.client.companyName ?? null,
      email: clientDetail?.client.email ?? null,
      livePolicy: clientDetail?.client.updatePolicy ?? rollout.updatePolicySnapshot,
      approvedAt: clientDetail?.client.approvedAt ?? null,
      upToDateLabel:
        rollout.status === "COMPLETED" && summary.counts.blocked > 0
          ? ("UP_TO_DATE_FOR_ELIGIBLE_PRODUCTS" as const)
          : rollout.status === "COMPLETED"
            ? ("UP_TO_DATE" as const)
            : null,
    },
    migrationPlan: summary.plan,
    progress: {
      eligible: summary.counts.total - summary.counts.blocked,
      migrated: summary.counts.pass,
      pending: summary.counts.pending,
      blocked: summary.counts.blocked,
      unhealthy: summary.counts.unhealthy,
      skipped: summary.counts.skipped,
      total: summary.counts.total,
    },
    products: summary.products.map((p) => ({
      ...p,
      displayStatus: displayProductStatus({
        planStatus: summary.plan.status,
        productStatus: p.status,
        inCanaryWave: canarySet.has(p.productId) || summary.plan.status === "CANARY",
      }),
      rollbackAvailable: rollbackAvailabilityForProduct(p.applied),
    })),
    autoNote: "AUTO — NOT ACTIVE IN PHASE 9. No Auto Rollout control.",
  };
}

export async function previewCustomerRollout(rolloutId: number) {
  const row = await getRolloutRow(rolloutId);
  if (!row) throw new Error("Rollout not found");
  const preview = await previewMigrationPlan(Number(row.migration_plan_id));
  await query(
    `UPDATE ar360_customer_rollouts
        SET status = 'PREVIEW', last_activity_at = NOW(), updated_at = NOW()
      WHERE id = ? AND status IN ('READY', 'PREVIEW')`,
    [rolloutId],
  );
  const rollout = await syncRolloutStatusFromPlan(rolloutId);
  return {
    banner: "CUSTOMER ROLLOUT PREVIEW" as const,
    migrationBanner: preview.banner,
    rollout,
    migrationPlanId: Number(row.migration_plan_id),
    products: preview.products,
    note: "Preview does not mutate products, QR, subscriptions, or pointers.",
  };
}

async function assertExecutionGate(rollout: CustomerRollout) {
  const client = await getClientUpdateState(rollout.customerUid);
  const policy = client?.client.updatePolicy ?? rollout.updatePolicySnapshot;
  const approvedAt = client?.client.approvedAt ?? null;
  const gate = assertRolloutExecutionAllowed({ policy, approvedAt });
  if (gate.ok === false) {
    throw new Error(`${gate.code}: ${gate.message}`);
  }
}

export async function startRolloutCanary(input: {
  rolloutId: number;
  productIds: string[];
  adminId: number | null;
  confirm: boolean;
}) {
  if (!input.confirm) throw new Error("confirmation_required");
  if (!input.productIds.length) {
    throw new Error("Select at least one product for canary");
  }

  const row = await getRolloutRow(input.rolloutId);
  if (!row) throw new Error("Rollout not found");
  const rollout = mapRollout(row);
  if (rollout.status === "CANCELLED" || rollout.status === "COMPLETED") {
    throw new Error(`Rollout is ${rollout.status}`);
  }
  await assertExecutionGate(rollout);

  // Place only selected products into VERSIONED canary targeting (not global)
  for (const productId of input.productIds) {
    if (!rollout.productIds.includes(productId)) {
      throw new Error(`Product ${productId} is not part of this rollout`);
    }
    await setProductCanaryRuntime({ productId, enabled: true });
  }

  const result = await executeMigrationBatch({
    planId: rollout.migrationPlanId,
    adminId: input.adminId,
    canaryProductIds: input.productIds,
    confirm: true,
  });

  const synced = await syncRolloutStatusFromPlan(input.rolloutId);
  return { rollout: synced, ...result };
}

export async function startRolloutBatch(input: {
  rolloutId: number;
  adminId: number | null;
  confirm: boolean;
}) {
  if (!input.confirm) throw new Error("confirmation_required");
  const row = await getRolloutRow(input.rolloutId);
  if (!row) throw new Error("Rollout not found");
  const rollout = mapRollout(row);
  if (rollout.status === "CANCELLED" || rollout.status === "COMPLETED") {
    throw new Error(`Rollout is ${rollout.status}`);
  }
  await assertExecutionGate(rollout);

  const result = await executeMigrationBatch({
    planId: rollout.migrationPlanId,
    adminId: input.adminId,
    confirm: true,
  });

  const synced = await syncRolloutStatusFromPlan(input.rolloutId);
  return { rollout: synced, ...result };
}

export async function pauseCustomerRollout(rolloutId: number, reason?: string) {
  const row = await getRolloutRow(rolloutId);
  if (!row) throw new Error("Rollout not found");
  await pauseMigrationPlan(Number(row.migration_plan_id), reason || "Paused by Master Admin");
  return syncRolloutStatusFromPlan(rolloutId);
}

export async function resumeCustomerRollout(rolloutId: number) {
  const row = await getRolloutRow(rolloutId);
  if (!row) throw new Error("Rollout not found");
  const rollout = mapRollout(row);
  await assertExecutionGate(rollout);
  await resumeMigrationPlan(Number(row.migration_plan_id));
  return syncRolloutStatusFromPlan(rolloutId);
}

export async function cancelCustomerRollout(input: {
  rolloutId: number;
  clearCanaryProductIds?: string[];
}) {
  const row = await getRolloutRow(input.rolloutId);
  if (!row) throw new Error("Rollout not found");
  const rollout = mapRollout(row);

  if (rollout.status !== "COMPLETED" && rollout.status !== "CANCELLED") {
    await cancelMigrationPlan(Number(row.migration_plan_id));
  }

  for (const productId of input.clearCanaryProductIds || parseJsonArray(row.product_ids_json)) {
    try {
      await setProductCanaryRuntime({ productId, enabled: false });
    } catch {
      // Flag may be missing in some envs — ignore
    }
  }

  if (rollout.status === "COMPLETED") {
    // Still clear canary; leave COMPLETED intact (PASS products not undone).
    await query(
      `UPDATE ar360_customer_rollouts SET last_activity_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [input.rolloutId],
    );
    const refreshed = await getRolloutRow(input.rolloutId);
    return mapRollout(refreshed!);
  }

  return syncRolloutStatusFromPlan(input.rolloutId);
}

/** Safety: customer rollout must never invent a second migrator. */
export function customerRolloutUsesMigrationEngineOnly(): true {
  return true;
}
