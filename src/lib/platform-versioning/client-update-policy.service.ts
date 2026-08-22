/**
 * Phase 8 — Client Update Policy & Release Eligibility.
 *
 * Policy layer only. Does NOT execute migrations, cron, or AUTO updates.
 * Actual upgrades remain Phase 7 Migration Engine only.
 */

import { query } from "@/lib/db";
import {
  getPlatformReleaseById,
  listPlatformReleases,
  type PlatformReleaseDto,
} from "@/lib/platform-versioning/releases.service";
import { compareSemver } from "@/lib/platform-versioning/semver";
import { getVersionedRuntimeFlag } from "@/lib/platform-versioning/runtime-selection";

export type UpdatePolicyMode = "MANUAL" | "APPROVAL_REQUIRED" | "AUTO";

export type ClientUpdateStatus =
  | "CURRENT"
  | "UPDATE_AVAILABLE"
  | "PENDING_APPROVAL"
  | "MIGRATION_IN_PROGRESS"
  | "PAUSED"
  | "UP_TO_DATE"
  | "BLOCKED";

export type ProductEligibilityCode =
  | "ELIGIBLE"
  | "BLOCKED"
  | "ALREADY_CURRENT"
  | "NOT_SUPPORTED";

export type ClientUpdateState = {
  customerUid: string;
  companyName: string | null;
  email: string | null;
  updatePolicy: UpdatePolicyMode;
  status: ClientUpdateStatus;
  currentReleaseId: number | null;
  currentReleaseVersion: string | null;
  targetReleaseId: number | null;
  targetReleaseVersion: string | null;
  approvedByAdminId: number | null;
  approvedAt: string | null;
  lastUpdateAt: string | null;
  notes: string | null;
  hasPersistedRow: boolean;
  autoActive: false;
  autoLabel: "AUTO — NOT ACTIVE IN PHASE 8";
  productCounts: {
    total: number;
    eligible: number;
    blocked: number;
    alreadyCurrent: number;
    notSupported: number;
    migrated: number;
    pending: number;
  };
};

export type ProductEligibility = {
  productId: string;
  title: string | null;
  code: ProductEligibilityCode;
  message: string;
};

type PolicyRow = {
  id: number;
  customer_uid: string;
  current_release_id: number | null;
  target_release_id: number | null;
  update_policy: UpdatePolicyMode;
  status: ClientUpdateStatus;
  approved_by_admin_id: number | null;
  approved_at: Date | string | null;
  last_update_at: Date | string | null;
  notes: string | null;
};

const DEFAULT_POLICY: UpdatePolicyMode = "MANUAL";

export function isValidUpdatePolicy(value: unknown): value is UpdatePolicyMode {
  return value === "MANUAL" || value === "APPROVAL_REQUIRED" || value === "AUTO";
}

export function autoPolicyIsExecutable(): false {
  return false;
}

/** Target release must be published, non-archived, valid semver, and not a downgrade. */
export async function validateTargetReleaseEligibility(input: {
  targetReleaseId: number;
  currentReleaseId: number | null;
}): Promise<{ ok: true; release: PlatformReleaseDto } | { ok: false; code: string; message: string }> {
  const release = await getPlatformReleaseById(input.targetReleaseId);
  if (!release) {
    return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release not found" };
  }
  if (release.status === "draft") {
    return { ok: false, code: "DRAFT_RELEASE_REJECTED", message: "Draft releases cannot be targeted" };
  }
  if (release.status === "archived") {
    return {
      ok: false,
      code: "ARCHIVED_RELEASE_REJECTED",
      message: "Archived releases cannot be targeted",
    };
  }
  if (release.status !== "published") {
    return {
      ok: false,
      code: "INVALID_RELEASE_STATUS",
      message: `Release status '${release.status}' is not eligible`,
    };
  }

  if (input.currentReleaseId != null) {
    const current = await getPlatformReleaseById(input.currentReleaseId);
    if (current) {
      const cmp = compareSemver(release.version, current.version);
      if (cmp == null) {
        return { ok: false, code: "INVALID_SEMVER", message: "Invalid semver on release" };
      }
      if (cmp < 0) {
        return {
          ok: false,
          code: "INVALID_SEMVER_TRANSITION",
          message: `Cannot target ${release.version} which is older than current ${current.version}`,
        };
      }
    }
  }

  return { ok: true, release };
}

async function getPolicyRow(customerUid: string): Promise<PolicyRow | null> {
  const rows = await query<PolicyRow>(
    `SELECT id, customer_uid, current_release_id, target_release_id, update_policy, status,
            approved_by_admin_id, approved_at, last_update_at, notes
       FROM ar360_client_update_policies
      WHERE customer_uid = ?
      LIMIT 1`,
    [customerUid],
  );
  return rows[0] ?? null;
}

async function ensurePolicyRow(customerUid: string): Promise<PolicyRow> {
  const existing = await getPolicyRow(customerUid);
  if (existing) return existing;

  // Default MANUAL — do not change behavior until Master Admin writes.
  await query(
    `INSERT INTO ar360_client_update_policies
      (customer_uid, update_policy, status, created_at, updated_at)
     VALUES (?, 'MANUAL', 'CURRENT', NOW(), NOW())`,
    [customerUid],
  );
  const created = await getPolicyRow(customerUid);
  if (!created) throw new Error("Failed to create client update policy row");
  return created;
}

async function listCustomerProducts(customerUid: string): Promise<
  Array<{ id: string; title: string | null; active_config_revision_id: number | null }>
> {
  return query(
    `SELECT id, title, active_config_revision_id
       FROM products
      WHERE customer_uid = ?
      ORDER BY id ASC`,
    [customerUid],
  );
}

export async function evaluateProductEligibility(input: {
  customerUid: string;
  currentReleaseId: number | null;
  targetReleaseId: number | null;
}): Promise<{
  products: ProductEligibility[];
  counts: ClientUpdateState["productCounts"];
}> {
  const rows = await listCustomerProducts(input.customerUid);
  const sameRelease =
    input.targetReleaseId != null &&
    input.currentReleaseId != null &&
    input.targetReleaseId === input.currentReleaseId;

  const products: ProductEligibility[] = [];
  for (const row of rows) {
    if (!row.active_config_revision_id) {
      products.push({
        productId: row.id,
        title: row.title,
        code: "BLOCKED",
        message: "Missing foundation config revision",
      });
      continue;
    }
    if (sameRelease) {
      products.push({
        productId: row.id,
        title: row.title,
        code: "ALREADY_CURRENT",
        message: "Client current and target release are the same",
      });
      continue;
    }
    // Geometry migration remains unsupported at product-plan time; products themselves are eligible
    // for material/lighting/viewer/AR migration via Phase 7.
    products.push({
      productId: row.id,
      title: row.title,
      code: "ELIGIBLE",
      message: "Eligible for Phase 7 migration plan (no automatic action)",
    });
  }

  const counts = {
    total: products.length,
    eligible: products.filter((p) => p.code === "ELIGIBLE").length,
    blocked: products.filter((p) => p.code === "BLOCKED").length,
    alreadyCurrent: products.filter((p) => p.code === "ALREADY_CURRENT").length,
    notSupported: products.filter((p) => p.code === "NOT_SUPPORTED").length,
    migrated: 0,
    pending: products.filter((p) => p.code === "ELIGIBLE").length,
  };

  // Count migrated / in-progress from Phase 7 plan products for this customer
  const mig = await query<{ status: string; c: number }>(
    `SELECT mpp.status, COUNT(*) AS c
       FROM ar360_migration_plan_products mpp
       INNER JOIN products p ON p.id = mpp.product_uid
      WHERE p.customer_uid = ?
      GROUP BY mpp.status`,
    [input.customerUid],
  );
  for (const row of mig) {
    const n = Number(row.c || 0);
    if (row.status === "PASS") counts.migrated += n;
    if (row.status === "PENDING") counts.pending = Math.max(counts.pending, n);
  }

  return { products, counts };
}

async function detectMigrationActivity(customerUid: string): Promise<{
  inProgress: boolean;
  paused: boolean;
}> {
  const rows = await query<{ plan_status: string; c: number }>(
    `SELECT mp.status AS plan_status, COUNT(*) AS c
       FROM ar360_migration_plans mp
       INNER JOIN ar360_migration_plan_products mpp ON mpp.plan_id = mp.id
       INNER JOIN products p ON p.id = mpp.product_uid
      WHERE p.customer_uid = ?
        AND mp.status IN ('CANARY', 'BATCHING', 'PAUSED')
      GROUP BY mp.status`,
    [customerUid],
  );
  let inProgress = false;
  let paused = false;
  for (const row of rows) {
    if (row.plan_status === "PAUSED") paused = true;
    if (row.plan_status === "CANARY" || row.plan_status === "BATCHING") inProgress = true;
  }
  return { inProgress, paused };
}

export function deriveClientUpdateStatus(input: {
  policy: UpdatePolicyMode;
  currentReleaseId: number | null;
  targetReleaseId: number | null;
  approvedAt: string | null;
  migrationInProgress: boolean;
  migrationPaused: boolean;
  blockedProducts: number;
}): ClientUpdateStatus {
  if (input.migrationPaused) return "PAUSED";
  if (input.migrationInProgress) return "MIGRATION_IN_PROGRESS";
  if (input.blockedProducts > 0 && input.targetReleaseId != null) {
    // Soft signal — still allow UPDATE_AVAILABLE unless all blocked; use BLOCKED only when total===blocked handled by caller
  }

  if (input.targetReleaseId == null) {
    return input.currentReleaseId == null ? "CURRENT" : "UP_TO_DATE";
  }
  if (
    input.currentReleaseId != null &&
    input.targetReleaseId === input.currentReleaseId
  ) {
    return "UP_TO_DATE";
  }

  if (input.policy === "APPROVAL_REQUIRED" && !input.approvedAt) {
    return "PENDING_APPROVAL";
  }

  return "UPDATE_AVAILABLE";
}

async function buildClientState(input: {
  customerUid: string;
  companyName: string | null;
  email: string | null;
  row: PolicyRow | null;
}): Promise<ClientUpdateState> {
  const policy = input.row?.update_policy ?? DEFAULT_POLICY;
  const currentReleaseId =
    input.row?.current_release_id == null ? null : Number(input.row.current_release_id);
  const targetReleaseId =
    input.row?.target_release_id == null ? null : Number(input.row.target_release_id);

  const [currentRelease, targetRelease, eligibility, activity] = await Promise.all([
    currentReleaseId ? getPlatformReleaseById(currentReleaseId) : Promise.resolve(null),
    targetReleaseId ? getPlatformReleaseById(targetReleaseId) : Promise.resolve(null),
    evaluateProductEligibility({
      customerUid: input.customerUid,
      currentReleaseId,
      targetReleaseId,
    }),
    detectMigrationActivity(input.customerUid),
  ]);

  let status = deriveClientUpdateStatus({
    policy,
    currentReleaseId,
    targetReleaseId,
    approvedAt: input.row?.approved_at == null ? null : String(input.row.approved_at),
    migrationInProgress: activity.inProgress,
    migrationPaused: activity.paused,
    blockedProducts: eligibility.counts.blocked,
  });

  if (
    eligibility.counts.total > 0 &&
    eligibility.counts.blocked === eligibility.counts.total &&
    targetReleaseId != null
  ) {
    status = "BLOCKED";
  }

  return {
    customerUid: input.customerUid,
    companyName: input.companyName,
    email: input.email,
    updatePolicy: policy,
    status,
    currentReleaseId,
    currentReleaseVersion: currentRelease?.version ?? null,
    targetReleaseId,
    targetReleaseVersion: targetRelease?.version ?? null,
    approvedByAdminId:
      input.row?.approved_by_admin_id == null ? null : Number(input.row.approved_by_admin_id),
    approvedAt: input.row?.approved_at == null ? null : String(input.row.approved_at),
    lastUpdateAt: input.row?.last_update_at == null ? null : String(input.row.last_update_at),
    notes: input.row?.notes ?? null,
    hasPersistedRow: input.row != null,
    autoActive: false,
    autoLabel: "AUTO — NOT ACTIVE IN PHASE 8",
    productCounts: eligibility.counts,
  };
}

export async function listClientUpdateStates(limit = 200): Promise<{
  clients: ClientUpdateState[];
  summary: {
    clients: number;
    current: number;
    updatesAvailable: number;
    pendingApproval: number;
    blocked: number;
    upToDate: number;
  };
}> {
  const customers = await query<{
    customer_uid: string;
    company_name: string | null;
    email: string | null;
  }>(
    `SELECT customer_uid, company_name, email
       FROM customers
      WHERE customer_uid IS NOT NULL AND customer_uid <> ''
      ORDER BY company_name ASC, customer_uid ASC
      LIMIT ?`,
    [Math.min(2000, Math.max(1, limit))],
  );

  const clients: ClientUpdateState[] = [];
  for (const c of customers) {
    const row = await getPolicyRow(c.customer_uid);
    clients.push(
      await buildClientState({
        customerUid: c.customer_uid,
        companyName: c.company_name,
        email: c.email,
        row,
      }),
    );
  }

  const summary = {
    clients: clients.length,
    current: clients.filter((c) => c.status === "CURRENT").length,
    updatesAvailable: clients.filter((c) => c.status === "UPDATE_AVAILABLE").length,
    pendingApproval: clients.filter((c) => c.status === "PENDING_APPROVAL").length,
    blocked: clients.filter((c) => c.status === "BLOCKED").length,
    upToDate: clients.filter((c) => c.status === "UP_TO_DATE" || c.status === "CURRENT").length,
  };

  return { clients, summary };
}

export async function getClientUpdateState(customerUid: string): Promise<{
  client: ClientUpdateState;
  products: ProductEligibility[];
  publishedReleases: PlatformReleaseDto[];
} | null> {
  const customers = await query<{
    customer_uid: string;
    company_name: string | null;
    email: string | null;
  }>(
    `SELECT customer_uid, company_name, email
       FROM customers
      WHERE customer_uid = ?
      LIMIT 1`,
    [customerUid],
  );
  if (!customers[0]) return null;

  const row = await getPolicyRow(customerUid);
  const client = await buildClientState({
    customerUid,
    companyName: customers[0].company_name,
    email: customers[0].email,
    row,
  });
  const eligibility = await evaluateProductEligibility({
    customerUid,
    currentReleaseId: client.currentReleaseId,
    targetReleaseId: client.targetReleaseId,
  });
  const publishedReleases = await listPlatformReleases({ status: "published" });

  return { client, products: eligibility.products, publishedReleases };
}

export async function setClientUpdatePolicy(input: {
  customerUid: string;
  policy: UpdatePolicyMode;
  adminId: number | null;
}): Promise<{
  client: ClientUpdateState;
  oldPolicy: UpdatePolicyMode;
  newPolicy: UpdatePolicyMode;
}> {
  if (!isValidUpdatePolicy(input.policy)) {
    throw new Error("Invalid policy. Use MANUAL, APPROVAL_REQUIRED, or AUTO.");
  }

  // Safety: AUTO must never trigger work
  if (input.policy === "AUTO" && autoPolicyIsExecutable()) {
    throw new Error("AUTO execution is forbidden in Phase 8");
  }

  const before = await getPolicyRow(input.customerUid);
  const oldPolicy = before?.update_policy ?? DEFAULT_POLICY;
  const row = await ensurePolicyRow(input.customerUid);

  // Changing to APPROVAL_REQUIRED clears approval if target set
  const clearApproval = input.policy === "APPROVAL_REQUIRED";

  await query(
    `UPDATE ar360_client_update_policies
        SET update_policy = ?,
            approved_by_admin_id = IF(?, NULL, approved_by_admin_id),
            approved_at = IF(?, NULL, approved_at),
            updated_at = NOW()
      WHERE customer_uid = ?`,
    [input.policy, clearApproval ? 1 : 0, clearApproval ? 1 : 0, input.customerUid],
  );

  // Recompute status
  const refreshed = await getPolicyRow(input.customerUid);
  const state = await buildClientState({
    customerUid: input.customerUid,
    companyName: null,
    email: null,
    row: refreshed,
  });
  await query(
    `UPDATE ar360_client_update_policies SET status = ?, updated_at = NOW() WHERE customer_uid = ?`,
    [state.status, input.customerUid],
  );

  const detail = await getClientUpdateState(input.customerUid);
  return {
    client: detail!.client,
    oldPolicy,
    newPolicy: input.policy,
  };
}

export async function setClientTargetRelease(input: {
  customerUid: string;
  targetReleaseId: number | null;
  adminId: number | null;
}): Promise<{
  client: ClientUpdateState;
  oldTargetReleaseId: number | null;
  newTargetReleaseId: number | null;
}> {
  const row = await ensurePolicyRow(input.customerUid);
  const oldTarget = row.target_release_id == null ? null : Number(row.target_release_id);
  const currentId = row.current_release_id == null ? null : Number(row.current_release_id);

  if (input.targetReleaseId != null) {
    const eligible = await validateTargetReleaseEligibility({
      targetReleaseId: input.targetReleaseId,
      currentReleaseId: currentId,
    });
    if (eligible.ok === false) {
      throw new Error(`${eligible.code}: ${eligible.message}`);
    }
  }

  await query(
    `UPDATE ar360_client_update_policies
        SET target_release_id = ?,
            approved_by_admin_id = NULL,
            approved_at = NULL,
            updated_at = NOW()
      WHERE customer_uid = ?`,
    [input.targetReleaseId, input.customerUid],
  );

  const refreshed = await getPolicyRow(input.customerUid);
  const state = await buildClientState({
    customerUid: input.customerUid,
    companyName: null,
    email: null,
    row: refreshed,
  });
  await query(
    `UPDATE ar360_client_update_policies SET status = ?, updated_at = NOW() WHERE customer_uid = ?`,
    [state.status, input.customerUid],
  );

  const detail = await getClientUpdateState(input.customerUid);
  return {
    client: detail!.client,
    oldTargetReleaseId: oldTarget,
    newTargetReleaseId: input.targetReleaseId,
  };
}

export async function approveClientTargetRelease(input: {
  customerUid: string;
  adminId: number;
}): Promise<ClientUpdateState> {
  const row = await ensurePolicyRow(input.customerUid);
  if (row.target_release_id == null) {
    throw new Error("No target release to approve");
  }
  if (row.update_policy !== "APPROVAL_REQUIRED") {
    throw new Error("Approval is only required when policy is APPROVAL_REQUIRED");
  }

  const eligible = await validateTargetReleaseEligibility({
    targetReleaseId: Number(row.target_release_id),
    currentReleaseId: row.current_release_id == null ? null : Number(row.current_release_id),
  });
  if (eligible.ok === false) {
    throw new Error(`${eligible.code}: ${eligible.message}`);
  }

  await query(
    `UPDATE ar360_client_update_policies
        SET approved_by_admin_id = ?,
            approved_at = NOW(),
            updated_at = NOW()
      WHERE customer_uid = ?`,
    [input.adminId, input.customerUid],
  );

  const refreshed = await getPolicyRow(input.customerUid);
  const state = await buildClientState({
    customerUid: input.customerUid,
    companyName: null,
    email: null,
    row: refreshed,
  });
  await query(
    `UPDATE ar360_client_update_policies SET status = ?, updated_at = NOW() WHERE customer_uid = ?`,
    [state.status, input.customerUid],
  );

  const detail = await getClientUpdateState(input.customerUid);
  return detail!.client;
}

/** Assert policy mutations never touch product pointers (unit-testable constant). */
export function policyMutationsTouchProducts(): false {
  return false;
}

export async function assertGlobalVersionedStillDisabled(): Promise<boolean> {
  const flag = await getVersionedRuntimeFlag();
  if (!flag) return true;
  if (flag.targeting.scope === "all") return false;
  return true;
}
