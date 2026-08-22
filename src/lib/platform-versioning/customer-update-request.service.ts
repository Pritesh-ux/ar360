/**
 * Phase 13 — Customer Approval + Update Execution Gateway.
 *
 * Request/approval layer only. Product pointer changes happen exclusively via
 * existing Phase 9 Customer Rollout → Phase 7 Migration Engine.
 * AUTO remains non-executable. No cron / background workers / scope=all.
 */

import { query } from "@/lib/db";
import {
  autoPolicyIsExecutable,
  getClientUpdateState,
  validateTargetReleaseEligibility,
  type UpdatePolicyMode,
} from "@/lib/platform-versioning/client-update-policy.service";
import {
  createCustomerRollout,
  getCustomerRolloutDetail,
  type CustomerRollout,
} from "@/lib/platform-versioning/customer-rollout.service";
import {
  capturePointerSnapshot,
  type PointerSnapshot,
} from "@/lib/platform-versioning/activation-safety.service";
import {
  validateProductMigration,
  type ComponentTargetMap,
  type MigratableKind,
} from "@/lib/platform-versioning/migration-engine.service";
import {
  evaluateProductCompatibility,
  type CompatibilityCode,
} from "@/lib/platform-versioning/platform-isolation.service";
import {
  getPlatformReleaseById,
  type PlatformReleaseDto,
} from "@/lib/platform-versioning/releases.service";
import { getRevisionById } from "@/lib/platform-versioning/component-revisions.service";

export type CustomerUpdateRequestStatus =
  | "DRAFT"
  | "REQUESTED"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "ROLLOUT_READY"
  | "ROLLOUT_RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "STALE";

export type ProductUpdateEligibilityCode =
  | "ELIGIBLE"
  | "ALREADY_CURRENT"
  | "BLOCKED"
  | "NOT_SUPPORTED"
  | "COMPATIBILITY_REVIEW";

export type ProductUpdateReviewRow = {
  productId: string;
  title: string | null;
  eligibility: ProductUpdateEligibilityCode;
  message: string;
  compatibility: CompatibilityCode;
  current: PointerSnapshot;
  proposed: ComponentTargetMap;
  currentLabels: Record<string, string>;
  proposedLabels: Record<string, string>;
  changedComponents: MigratableKind[];
  unchangedComponents: MigratableKind[];
};

export type PreviewSnapshot = {
  releaseId: number;
  releaseVersion: string;
  releaseStatus: string;
  capturedAt: string;
  products: Array<{
    productId: string;
    eligibility: ProductUpdateEligibilityCode;
    compatibility: CompatibilityCode;
    current: PointerSnapshot;
    proposed: ComponentTargetMap;
    validationOk: boolean;
    validationCode: string | null;
    validationMessage: string | null;
  }>;
};

export type CustomerUpdateRequest = {
  id: number;
  customerUid: string;
  releaseId: number;
  status: CustomerUpdateRequestStatus;
  updatePolicySnapshot: UpdatePolicyMode;
  approvalRequired: boolean;
  requestedByUserId: number | null;
  requestedAt: string | null;
  approvedByAdminId: number | null;
  approvedAt: string | null;
  rejectedByAdminId: number | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  cancelledAt: string | null;
  staleAt: string | null;
  staleReason: string | null;
  productSelection: string[];
  previewSnapshot: PreviewSnapshot;
  rolloutId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
};

const MIGRATABLE: MigratableKind[] = ["config", "material", "lighting", "viewer", "ar"];

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

function mapRequest(row: Record<string, unknown>): CustomerUpdateRequest {
  return {
    id: Number(row.id),
    customerUid: String(row.customer_uid),
    releaseId: Number(row.release_id),
    status: String(row.status) as CustomerUpdateRequestStatus,
    updatePolicySnapshot: String(row.update_policy_snapshot || "MANUAL") as UpdatePolicyMode,
    approvalRequired: Boolean(Number(row.approval_required || 0)),
    requestedByUserId:
      row.requested_by_user_id == null ? null : Number(row.requested_by_user_id),
    requestedAt: row.requested_at ? String(row.requested_at) : null,
    approvedByAdminId:
      row.approved_by_admin_id == null ? null : Number(row.approved_by_admin_id),
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    rejectedByAdminId:
      row.rejected_by_admin_id == null ? null : Number(row.rejected_by_admin_id),
    rejectedAt: row.rejected_at ? String(row.rejected_at) : null,
    rejectReason: row.reject_reason ? String(row.reject_reason) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    staleAt: row.stale_at ? String(row.stale_at) : null,
    staleReason: row.stale_reason ? String(row.stale_reason) : null,
    productSelection: parseJson<string[]>(row.product_selection_json, []),
    previewSnapshot: parseJson<PreviewSnapshot>(row.preview_snapshot_json, {
      releaseId: 0,
      releaseVersion: "",
      releaseStatus: "",
      capturedAt: "",
      products: [],
    }),
    rolloutId: row.rollout_id == null ? null : Number(row.rollout_id),
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export function autoExecutionIsDisabled(): true {
  return true;
}

export function customerApprovalMutatesPointers(): false {
  return false;
}

async function labelRevision(revisionId: number | null): Promise<string> {
  if (revisionId == null) return "—";
  const row = await getRevisionById(revisionId);
  if (!row) return `#${revisionId}`;
  const n =
    row.component_revision_number != null
      ? Number(row.component_revision_number)
      : Number(row.revision_number);
  return `v${n}`;
}

/**
 * Resolve proposed component targets for a product + platform release.
 * Prefer revisions tagged with platform_release_id = releaseId (active/archived).
 * Fallback: newer ACTIVE revisions than the current pointer (same product).
 * Geometry is never proposed.
 */
export async function resolveProposedTargetsForProduct(input: {
  productId: string;
  releaseId: number;
}): Promise<ComponentTargetMap> {
  const current = await capturePointerSnapshot(input.productId);
  if (!current) return {};

  const tagged = await query<{
    id: number;
    component_kind: string;
    component_revision_number: number | null;
    revision_number: number;
    status: string;
  }>(
    `SELECT id, component_kind, component_revision_number, revision_number, status
       FROM ar360_product_config_revisions
      WHERE product_uid = ?
        AND platform_release_id = ?
        AND status IN ('active', 'archived')
        AND component_kind IN ('config','material','lighting','viewer','ar')
      ORDER BY COALESCE(component_revision_number, revision_number) DESC, id DESC`,
    [input.productId, input.releaseId],
  );

  const proposed: ComponentTargetMap = {};
  const seen = new Set<string>();
  for (const row of tagged) {
    const kind = row.component_kind as MigratableKind;
    if (seen.has(kind)) continue;
    seen.add(kind);
    const currentId = current[kind];
    if (currentId != null && Number(row.id) === Number(currentId)) continue;
    proposed[kind] = Number(row.id);
  }

  if (Object.keys(proposed).length > 0) return proposed;

  // Fallback: newest ACTIVE revision per kind that differs from current pointer
  for (const kind of MIGRATABLE) {
    const rows = await query<{ id: number }>(
      `SELECT id FROM ar360_product_config_revisions
        WHERE product_uid = ?
          AND component_kind = ?
          AND status = 'active'
        ORDER BY COALESCE(component_revision_number, revision_number) DESC, id DESC
        LIMIT 1`,
      [input.productId, kind],
    );
    const id = rows[0] ? Number(rows[0].id) : null;
    if (id == null) continue;
    const currentId = current[kind];
    if (currentId != null && id === Number(currentId)) continue;
    proposed[kind] = id;
  }

  return proposed;
}

async function buildProductReviewRow(input: {
  productId: string;
  title: string | null;
  release: PlatformReleaseDto;
}): Promise<ProductUpdateReviewRow> {
  const current = (await capturePointerSnapshot(input.productId)) || {
    config: null,
    geometry: null,
    material: null,
    lighting: null,
    viewer: null,
    ar: null,
  };
  const compatibilityRow = await evaluateProductCompatibility({
    productId: input.productId,
    platformRelease: input.release,
  });
  const proposed = await resolveProposedTargetsForProduct({
    productId: input.productId,
    releaseId: input.release.id,
  });

  const changedComponents = Object.keys(proposed) as MigratableKind[];
  const unchangedComponents = MIGRATABLE.filter((k) => proposed[k] == null);

  const currentLabels: Record<string, string> = {};
  const proposedLabels: Record<string, string> = {};
  for (const kind of MIGRATABLE) {
    currentLabels[kind] = await labelRevision(current[kind]);
    proposedLabels[kind] =
      proposed[kind] != null
        ? await labelRevision(proposed[kind]!)
        : currentLabels[kind];
  }

  let eligibility: ProductUpdateEligibilityCode = "ALREADY_CURRENT";
  let message = "No product configuration changes available for this release";

  if (!current.config) {
    eligibility = "BLOCKED";
    message = "Missing foundation config revision";
  } else if (compatibilityRow.compatibility === "BLOCKED") {
    eligibility = "BLOCKED";
    message = compatibilityRow.reason || "Compatibility blocked";
  } else if (changedComponents.length === 0) {
    if (compatibilityRow.compatibility === "WARNING") {
      eligibility = "COMPATIBILITY_REVIEW";
      message = compatibilityRow.reason || "Compatibility review required";
    } else {
      eligibility = "ALREADY_CURRENT";
      message = "Product configuration is already current for available targets";
    }
  } else if (compatibilityRow.compatibility === "WARNING") {
    eligibility = "COMPATIBILITY_REVIEW";
    message = "Proposed changes need compatibility review before selection";
  } else {
    const validation = await validateProductMigration({
      productId: input.productId,
      proposed,
    });
    if (validation.ok === false) {
      if (validation.code === "GEOMETRY_NOT_SUPPORTED") {
        eligibility = "NOT_SUPPORTED";
      } else if (validation.code === "ALREADY_CURRENT") {
        eligibility = "ALREADY_CURRENT";
      } else {
        eligibility = "BLOCKED";
      }
      message = validation.message;
    } else {
      eligibility = "ELIGIBLE";
      message = `Eligible to update ${changedComponents.join(", ")}`;
    }
  }

  return {
    productId: input.productId,
    title: input.title,
    eligibility,
    message,
    compatibility: compatibilityRow.compatibility,
    current,
    proposed,
    currentLabels,
    proposedLabels,
    changedComponents,
    unchangedComponents,
  };
}

export async function getReleaseUpdateReview(input: {
  customerUid: string;
  releaseId: number;
}): Promise<{
  release: { id: number; version: string; title: string; status: string };
  updatePolicy: UpdatePolicyMode;
  approvalRequired: boolean;
  autoExecutable: false;
  products: ProductUpdateReviewRow[];
  note: string;
} | null> {
  const release = await getPlatformReleaseById(input.releaseId);
  if (!release || release.status !== "published") return null;

  const client = await getClientUpdateState(input.customerUid);
  const eligibility = await validateTargetReleaseEligibility({
    targetReleaseId: release.id,
    currentReleaseId: client?.client.currentReleaseId ?? null,
  });
  if (eligibility.ok === false) {
    return {
      release: {
        id: release.id,
        version: release.version,
        title: release.title,
        status: release.status,
      },
      updatePolicy: client?.client.updatePolicy ?? "MANUAL",
      approvalRequired: (client?.client.updatePolicy ?? "MANUAL") === "APPROVAL_REQUIRED",
      autoExecutable: false,
      products: [],
      note: eligibility.message,
    };
  }

  const products = await query<{ id: string; title: string | null }>(
    `SELECT id, title FROM products WHERE customer_uid = ? ORDER BY id ASC`,
    [input.customerUid],
  );

  const rows: ProductUpdateReviewRow[] = [];
  for (const p of products) {
    rows.push(
      await buildProductReviewRow({
        productId: p.id,
        title: p.title,
        release,
      }),
    );
  }

  const policy = client?.client.updatePolicy ?? "MANUAL";
  return {
    release: {
      id: release.id,
      version: release.version,
      title: release.title,
      status: release.status,
    },
    updatePolicy: policy,
    approvalRequired: policy === "APPROVAL_REQUIRED",
    autoExecutable: false,
    products: rows,
    note: "Preview only. Requesting an update does not change product configuration. Execution uses the existing controlled rollout process.",
  };
}

async function buildPreviewSnapshot(input: {
  customerUid: string;
  release: PlatformReleaseDto;
  productIds: string[];
}): Promise<PreviewSnapshot> {
  const products = [];
  for (const productId of input.productIds) {
    const owned = await query<{ id: string }>(
      `SELECT id FROM products WHERE id = ? AND customer_uid = ? LIMIT 1`,
      [productId, input.customerUid],
    );
    if (!owned[0]) {
      throw Object.assign(new Error(`Product not found: ${productId}`), {
        code: "PRODUCT_NOT_FOUND",
      });
    }
    const row = await buildProductReviewRow({
      productId,
      title: null,
      release: input.release,
    });
    let validationOk = false;
    let validationCode: string | null = null;
    let validationMessage: string | null = null;
    if (row.eligibility === "ELIGIBLE" && Object.keys(row.proposed).length > 0) {
      const v = await validateProductMigration({
        productId,
        proposed: row.proposed,
      });
      validationOk = v.ok;
      if (v.ok === false) {
        validationCode = v.code;
        validationMessage = v.message;
      }
    } else {
      validationCode = row.eligibility;
      validationMessage = row.message;
    }
    products.push({
      productId,
      eligibility: row.eligibility,
      compatibility: row.compatibility,
      current: row.current,
      proposed: row.proposed,
      validationOk,
      validationCode,
      validationMessage,
    });
  }

  return {
    releaseId: input.release.id,
    releaseVersion: input.release.version,
    releaseStatus: input.release.status,
    capturedAt: new Date().toISOString(),
    products,
  };
}

export async function getCustomerUpdateRequest(
  requestId: number,
): Promise<CustomerUpdateRequest | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM ar360_customer_update_requests WHERE id = ? LIMIT 1`,
    [requestId],
  );
  return rows[0] ? mapRequest(rows[0]) : null;
}

export async function getCustomerOwnedUpdateRequest(input: {
  customerUid: string;
  requestId: number;
}): Promise<CustomerUpdateRequest | null> {
  const req = await getCustomerUpdateRequest(input.requestId);
  if (!req || req.customerUid !== input.customerUid) return null;
  return req;
}

/**
 * Recompute live proposed targets and compare to stored snapshot.
 * Returns UPDATE_APPROVAL_STALE when meaning would change.
 */
export async function assertRequestSnapshotFresh(
  req: CustomerUpdateRequest,
): Promise<{ ok: true } | { ok: false; code: "UPDATE_APPROVAL_STALE"; message: string }> {
  const release = await getPlatformReleaseById(req.releaseId);
  if (!release) {
    return { ok: false, code: "UPDATE_APPROVAL_STALE", message: "Release no longer exists" };
  }
  if (release.status === "draft" || release.status === "archived" || release.status !== "published") {
    return {
      ok: false,
      code: "UPDATE_APPROVAL_STALE",
      message: `Release is ${release.status}`,
    };
  }
  if (release.version !== req.previewSnapshot.releaseVersion) {
    return {
      ok: false,
      code: "UPDATE_APPROVAL_STALE",
      message: "Release version changed since approval",
    };
  }

  for (const snap of req.previewSnapshot.products) {
    if (!req.productSelection.includes(snap.productId)) continue;
    const owned = await query<{ id: string }>(
      `SELECT id FROM products WHERE id = ? AND customer_uid = ? LIMIT 1`,
      [snap.productId, req.customerUid],
    );
    if (!owned[0]) {
      return {
        ok: false,
        code: "UPDATE_APPROVAL_STALE",
        message: `Product ${snap.productId} no longer belongs to customer`,
      };
    }

    const liveCurrent = await capturePointerSnapshot(snap.productId);
    if (JSON.stringify(liveCurrent) !== JSON.stringify(snap.current)) {
      return {
        ok: false,
        code: "UPDATE_APPROVAL_STALE",
        message: `Current pointers changed for ${snap.productId}`,
      };
    }

    const liveProposed = await resolveProposedTargetsForProduct({
      productId: snap.productId,
      releaseId: req.releaseId,
    });
    if (JSON.stringify(liveProposed) !== JSON.stringify(snap.proposed)) {
      return {
        ok: false,
        code: "UPDATE_APPROVAL_STALE",
        message: `Target revisions changed for ${snap.productId}`,
      };
    }

    const compat = await evaluateProductCompatibility({
      productId: snap.productId,
      platformRelease: release,
    });
    if (compat.compatibility !== snap.compatibility) {
      return {
        ok: false,
        code: "UPDATE_APPROVAL_STALE",
        message: `Compatibility changed for ${snap.productId}`,
      };
    }

    if (Object.keys(snap.proposed).length === 0) {
      return {
        ok: false,
        code: "UPDATE_APPROVAL_STALE",
        message: `No proposed targets for ${snap.productId}`,
      };
    }

    const validation = await validateProductMigration({
      productId: snap.productId,
      proposed: snap.proposed,
    });
    if (validation.ok === false) {
      return {
        ok: false,
        code: "UPDATE_APPROVAL_STALE",
        message: validation.message,
      };
    }
  }

  return { ok: true };
}

async function markRequestStale(requestId: number, reason: string) {
  await query(
    `UPDATE ar360_customer_update_requests
        SET status = 'STALE', stale_at = NOW(), stale_reason = ?, updated_at = NOW()
      WHERE id = ?`,
    [reason.slice(0, 255), requestId],
  );
}

export async function createCustomerUpdateRequest(input: {
  customerUid: string;
  releaseId: number;
  productIds: string[];
  requestedByUserId: number | null;
  notes?: string;
}): Promise<CustomerUpdateRequest> {
  if (autoPolicyIsExecutable()) {
    throw Object.assign(new Error("AUTO_EXECUTION_DISABLED"), {
      code: "AUTO_EXECUTION_DISABLED",
    });
  }

  const client = await getClientUpdateState(input.customerUid);
  const policy = client?.client.updatePolicy ?? "MANUAL";
  if (policy === "AUTO") {
    throw Object.assign(new Error("AUTO_EXECUTION_DISABLED"), {
      code: "AUTO_EXECUTION_DISABLED",
    });
  }

  if (!input.productIds.length) {
    throw Object.assign(new Error("Empty product selection"), {
      code: "EMPTY_SELECTION",
    });
  }

  const release = await getPlatformReleaseById(input.releaseId);
  if (!release) {
    throw Object.assign(new Error("Release not found"), { code: "RELEASE_NOT_FOUND" });
  }
  if (release.status === "draft") {
    throw Object.assign(new Error("Draft releases cannot be requested"), {
      code: "DRAFT_RELEASE_REJECTED",
    });
  }
  if (release.status === "archived") {
    throw Object.assign(new Error("Archived releases cannot be requested"), {
      code: "ARCHIVED_RELEASE_REJECTED",
    });
  }
  if (release.status !== "published") {
    throw Object.assign(new Error("Release is not published"), {
      code: "INVALID_RELEASE_STATUS",
    });
  }

  const eligibility = await validateTargetReleaseEligibility({
    targetReleaseId: release.id,
    currentReleaseId: client?.client.currentReleaseId ?? null,
  });
  if (eligibility.ok === false) {
    throw Object.assign(new Error(eligibility.message), { code: eligibility.code });
  }

  // Deduplicate / ownership
  const uniqueIds = [...new Set(input.productIds.map(String))];
  for (const productId of uniqueIds) {
    const owned = await query<{ id: string }>(
      `SELECT id FROM products WHERE id = ? AND customer_uid = ? LIMIT 1`,
      [productId, input.customerUid],
    );
    if (!owned[0]) {
      throw Object.assign(new Error(`Unauthorized product: ${productId}`), {
        code: "CROSS_CUSTOMER_PRODUCT",
      });
    }
  }

  const snapshot = await buildPreviewSnapshot({
    customerUid: input.customerUid,
    release,
    productIds: uniqueIds,
  });

  for (const p of snapshot.products) {
    if (p.eligibility !== "ELIGIBLE" || !p.validationOk) {
      throw Object.assign(
        new Error(
          `Product ${p.productId} is not eligible (${p.eligibility}${
            p.validationCode ? `/${p.validationCode}` : ""
          })`,
        ),
        { code: "PRODUCT_NOT_ELIGIBLE" },
      );
    }
  }

  const approvalRequired = policy === "APPROVAL_REQUIRED";
  const status: CustomerUpdateRequestStatus = approvalRequired
    ? "AWAITING_APPROVAL"
    : "REQUESTED";

  await query(
    `INSERT INTO ar360_customer_update_requests
      (customer_uid, release_id, status, update_policy_snapshot, approval_required,
       requested_by_user_id, requested_at, product_selection_json, preview_snapshot_json,
       notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, NOW(), NOW())`,
    [
      input.customerUid,
      release.id,
      status,
      policy,
      approvalRequired ? 1 : 0,
      input.requestedByUserId,
      JSON.stringify(uniqueIds),
      JSON.stringify(snapshot),
      input.notes?.slice(0, 512) ?? null,
    ],
  );

  const created = await query<Record<string, unknown>>(
    `SELECT * FROM ar360_customer_update_requests
      WHERE customer_uid = ?
      ORDER BY id DESC LIMIT 1`,
    [input.customerUid],
  );
  return mapRequest(created[0]!);
}

export async function cancelCustomerUpdateRequest(input: {
  customerUid: string;
  requestId: number;
}): Promise<CustomerUpdateRequest> {
  const req = await getCustomerOwnedUpdateRequest(input);
  if (!req) {
    throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });
  }
  if (
    !["DRAFT", "REQUESTED", "AWAITING_APPROVAL", "APPROVED", "STALE"].includes(req.status)
  ) {
    throw Object.assign(new Error(`Cannot cancel request in status ${req.status}`), {
      code: "INVALID_STATUS",
    });
  }
  await query(
    `UPDATE ar360_customer_update_requests
        SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
      WHERE id = ? AND customer_uid = ?`,
    [input.requestId, input.customerUid],
  );
  return (await getCustomerUpdateRequest(input.requestId))!;
}

export async function listCustomerUpdateRequestsForCustomer(
  customerUid: string,
  limit = 50,
): Promise<CustomerUpdateRequest[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM ar360_customer_update_requests
      WHERE customer_uid = ?
      ORDER BY id DESC
      LIMIT ?`,
    [customerUid, Math.min(200, Math.max(1, limit))],
  );
  return rows.map(mapRequest);
}

export async function listAllCustomerUpdateRequests(limit = 100): Promise<
  Array<
    CustomerUpdateRequest & {
      companyName: string | null;
      releaseVersion: string | null;
    }
  >
> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM ar360_customer_update_requests ORDER BY id DESC LIMIT ?`,
    [Math.min(500, Math.max(1, limit))],
  );
  const out = [];
  for (const row of rows) {
    const req = mapRequest(row);
    const [cust, rel] = await Promise.all([
      query<{ company_name: string | null }>(
        `SELECT company_name FROM customers WHERE customer_uid = ? LIMIT 1`,
        [req.customerUid],
      ),
      getPlatformReleaseById(req.releaseId),
    ]);
    out.push({
      ...req,
      companyName: cust[0]?.company_name ?? null,
      releaseVersion: rel?.version ?? null,
    });
  }
  return out;
}

export async function approveCustomerUpdateRequest(input: {
  requestId: number;
  adminId: number;
}): Promise<CustomerUpdateRequest> {
  if (autoPolicyIsExecutable()) {
    throw Object.assign(new Error("AUTO_EXECUTION_DISABLED"), {
      code: "AUTO_EXECUTION_DISABLED",
    });
  }

  const req = await getCustomerUpdateRequest(input.requestId);
  if (!req) throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });

  if (req.updatePolicySnapshot === "AUTO") {
    throw Object.assign(new Error("AUTO_EXECUTION_DISABLED"), {
      code: "AUTO_EXECUTION_DISABLED",
    });
  }

  if (!["REQUESTED", "AWAITING_APPROVAL"].includes(req.status)) {
    throw Object.assign(new Error(`Cannot approve status ${req.status}`), {
      code: "INVALID_STATUS",
    });
  }

  const fresh = await assertRequestSnapshotFresh(req);
  if (fresh.ok === false) {
    await markRequestStale(req.id, fresh.message);
    throw Object.assign(new Error(fresh.message), { code: fresh.code });
  }

  // Never trust client eligibility — re-check selected products
  for (const productId of req.productSelection) {
    const owned = await query<{ id: string }>(
      `SELECT id FROM products WHERE id = ? AND customer_uid = ? LIMIT 1`,
      [productId, req.customerUid],
    );
    if (!owned[0]) {
      throw Object.assign(new Error(`Product ${productId} unauthorized`), {
        code: "CROSS_CUSTOMER_PRODUCT",
      });
    }
  }

  await query(
    `UPDATE ar360_customer_update_requests
        SET status = 'APPROVED', approved_by_admin_id = ?, approved_at = NOW(), updated_at = NOW()
      WHERE id = ?`,
    [input.adminId, input.requestId],
  );
  return (await getCustomerUpdateRequest(input.requestId))!;
}

export async function rejectCustomerUpdateRequest(input: {
  requestId: number;
  adminId: number;
  reason?: string;
}): Promise<CustomerUpdateRequest> {
  const req = await getCustomerUpdateRequest(input.requestId);
  if (!req) throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });
  if (!["REQUESTED", "AWAITING_APPROVAL", "APPROVED"].includes(req.status)) {
    throw Object.assign(new Error(`Cannot reject status ${req.status}`), {
      code: "INVALID_STATUS",
    });
  }
  await query(
    `UPDATE ar360_customer_update_requests
        SET status = 'REJECTED', rejected_by_admin_id = ?, rejected_at = NOW(),
            reject_reason = ?, updated_at = NOW()
      WHERE id = ?`,
    [input.adminId, input.reason?.slice(0, 512) ?? null, input.requestId],
  );
  return (await getCustomerUpdateRequest(input.requestId))!;
}

/**
 * Create existing Phase 9 Customer Rollout from an approved/requested request.
 * Does NOT mutate product pointers — Phase 9/7 do that only on explicit canary/batch.
 */
export async function prepareRolloutFromCustomerUpdateRequest(input: {
  requestId: number;
  adminId: number;
  batchSize?: number;
  notes?: string;
}): Promise<{ request: CustomerUpdateRequest; rollout: CustomerRollout }> {
  if (autoPolicyIsExecutable()) {
    throw Object.assign(new Error("AUTO_EXECUTION_DISABLED"), {
      code: "AUTO_EXECUTION_DISABLED",
    });
  }

  const req = await getCustomerUpdateRequest(input.requestId);
  if (!req) throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });

  if (req.updatePolicySnapshot === "AUTO") {
    throw Object.assign(new Error("AUTO_EXECUTION_DISABLED"), {
      code: "AUTO_EXECUTION_DISABLED",
    });
  }

  const allowed =
    req.updatePolicySnapshot === "APPROVAL_REQUIRED"
      ? ["APPROVED"]
      : ["REQUESTED", "APPROVED"];
  if (!allowed.includes(req.status)) {
    throw Object.assign(
      new Error(
        req.updatePolicySnapshot === "APPROVAL_REQUIRED"
          ? "Approval required before preparing rollout"
          : `Cannot prepare rollout from status ${req.status}`,
      ),
      { code: "INVALID_STATUS" },
    );
  }

  if (req.rolloutId) {
    throw Object.assign(new Error("Rollout already prepared for this request"), {
      code: "ROLLOUT_EXISTS",
    });
  }

  const fresh = await assertRequestSnapshotFresh(req);
  if (fresh.ok === false) {
    await markRequestStale(req.id, fresh.message);
    throw Object.assign(new Error(fresh.message), { code: fresh.code });
  }

  const products = req.previewSnapshot.products
    .filter((p) => req.productSelection.includes(p.productId))
    .map((p) => ({
      productId: p.productId,
      proposed: p.proposed,
    }));

  if (!products.length) {
    throw Object.assign(new Error("No products to roll out"), { code: "EMPTY_SELECTION" });
  }

  const { rollout } = await createCustomerRollout({
    customerUid: req.customerUid,
    targetReleaseId: req.releaseId,
    batchSize: input.batchSize ?? 1,
    notes:
      input.notes ||
      `From customer update request #${req.id} (Phase 13 gateway)`,
    adminId: input.adminId,
    products,
    scope: "one_client_selected_products",
  });

  await query(
    `UPDATE ar360_customer_update_requests
        SET status = 'ROLLOUT_READY', rollout_id = ?,
            approved_by_admin_id = COALESCE(approved_by_admin_id, ?),
            approved_at = COALESCE(approved_at, NOW()),
            updated_at = NOW()
      WHERE id = ?`,
    [rollout.id, input.adminId, input.requestId],
  );

  return {
    request: (await getCustomerUpdateRequest(input.requestId))!,
    rollout,
  };
}

/** Sync request status from linked Phase 9 rollout (read mapping only). */
export async function syncRequestStatusFromRollout(
  requestId: number,
): Promise<CustomerUpdateRequest | null> {
  const req = await getCustomerUpdateRequest(requestId);
  if (!req?.rolloutId) return req;
  const detail = await getCustomerRolloutDetail(req.rolloutId);
  if (!detail) return req;

  let next: CustomerUpdateRequestStatus = req.status;
  switch (detail.rollout.status) {
    case "READY":
    case "PREVIEW":
      next = "ROLLOUT_READY";
      break;
    case "CANARY":
    case "BATCHING":
      next = "ROLLOUT_RUNNING";
      break;
    case "PAUSED":
      next = "PAUSED";
      break;
    case "COMPLETED":
      next = "COMPLETED";
      break;
    case "CANCELLED":
    case "FAILED":
      next = "CANCELLED";
      break;
    default:
      break;
  }

  if (next !== req.status) {
    await query(
      `UPDATE ar360_customer_update_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
      [next, requestId],
    );
  }
  return getCustomerUpdateRequest(requestId);
}
