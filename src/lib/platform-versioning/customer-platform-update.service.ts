/**
 * Phase 12 — Customer-facing Platform Update Center.
 *
 * Read-only viewing/review. Product changes only via existing Phase 9 rollouts
 * (Master Admin executes). AUTO remains non-executable.
 */

import { query } from "@/lib/db";
import {
  listPlatformCompatibilityReport,
  type CompatibilityCode,
  type ProductCompatibilityRow,
} from "@/lib/platform-versioning/platform-isolation.service";
import {
  normalizeStructuredReleaseNotes,
  type StructuredReleaseNotes,
} from "@/lib/platform-versioning/release-notes";
import {
  getActiveStableReleaseId,
  getPlatformReleaseById,
  listPlatformReleases,
  type PlatformReleaseDto,
} from "@/lib/platform-versioning/releases.service";
import { compareSemver } from "@/lib/platform-versioning/semver";
import { getMigrationPlanSummary } from "@/lib/platform-versioning/migration-engine.service";
import {
  autoPolicyIsExecutable,
  getClientUpdateState,
} from "@/lib/platform-versioning/client-update-policy.service";

export type CustomerUpdateCenterStatus =
  | "CURRENT"
  | "UPDATE_AVAILABLE"
  | "COMPATIBILITY_REVIEW";

export type ProductMigrationHint = "NOT_REQUIRED" | "REVIEW_REQUIRED" | "ROLLOUT_AVAILABLE";

export type CustomerReleaseViewState = "UNSEEN" | "VIEWED" | "DISMISSED";

function customerFacingRelease(release: PlatformReleaseDto): boolean {
  return release.status === "published";
}

async function getStructuredNotes(release: PlatformReleaseDto): Promise<StructuredReleaseNotes> {
  const rows = await query<{ release_notes_json: unknown }>(
    `SELECT release_notes_json FROM ar360_platform_releases WHERE id = ? LIMIT 1`,
    [release.id],
  ).catch(() => [] as Array<{ release_notes_json: unknown }>);
  return normalizeStructuredReleaseNotes({
    title: release.title,
    plainReleaseNotes: release.releaseNotes,
    releaseNotesJson: rows[0]?.release_notes_json ?? null,
    metadata: release.metadata,
  });
}

export async function getViewState(
  customerUid: string,
  releaseId: number,
): Promise<{
  state: CustomerReleaseViewState;
  viewedAt: string | null;
  dismissedAt: string | null;
  productUpdateReviewedAt: string | null;
}> {
  const rows = await query<{
    viewed_at: Date | string | null;
    dismissed_at: Date | string | null;
    product_update_reviewed_at: Date | string | null;
  }>(
    `SELECT viewed_at, dismissed_at, product_update_reviewed_at
       FROM ar360_customer_platform_release_views
      WHERE customer_uid = ? AND release_id = ?
      LIMIT 1`,
    [customerUid, releaseId],
  );
  const row = rows[0];
  if (!row) {
    return {
      state: "UNSEEN",
      viewedAt: null,
      dismissedAt: null,
      productUpdateReviewedAt: null,
    };
  }
  if (row.dismissed_at) {
    return {
      state: "DISMISSED",
      viewedAt: row.viewed_at ? String(row.viewed_at) : null,
      dismissedAt: String(row.dismissed_at),
      productUpdateReviewedAt: row.product_update_reviewed_at
        ? String(row.product_update_reviewed_at)
        : null,
    };
  }
  return {
    state: "VIEWED",
    viewedAt: row.viewed_at ? String(row.viewed_at) : null,
    dismissedAt: null,
    productUpdateReviewedAt: row.product_update_reviewed_at
      ? String(row.product_update_reviewed_at)
      : null,
  };
}

export async function markPlatformReleaseViewed(input: {
  customerUid: string;
  releaseId: number;
}): Promise<CustomerReleaseViewState> {
  const release = await getPlatformReleaseById(input.releaseId);
  if (!release || !customerFacingRelease(release)) {
    throw new Error("Release not found or not available");
  }
  await query(
    `INSERT INTO ar360_customer_platform_release_views
      (customer_uid, release_id, viewed_at, created_at, updated_at)
     VALUES (?, ?, NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       viewed_at = COALESCE(viewed_at, NOW()),
       updated_at = NOW()`,
    [input.customerUid, input.releaseId],
  );
  return (await getViewState(input.customerUid, input.releaseId)).state;
}

export async function dismissPlatformReleaseBanner(input: {
  customerUid: string;
  releaseId: number;
}): Promise<void> {
  const release = await getPlatformReleaseById(input.releaseId);
  if (!release || !customerFacingRelease(release)) {
    throw new Error("Release not found or not available");
  }
  await query(
    `INSERT INTO ar360_customer_platform_release_views
      (customer_uid, release_id, viewed_at, dismissed_at, created_at, updated_at)
     VALUES (?, ?, NOW(), NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       viewed_at = COALESCE(viewed_at, NOW()),
       dismissed_at = NOW(),
       updated_at = NOW()`,
    [input.customerUid, input.releaseId],
  );
}

export async function markProductUpdateReviewed(input: {
  customerUid: string;
  releaseId: number;
}): Promise<void> {
  const release = await getPlatformReleaseById(input.releaseId);
  if (!release || !customerFacingRelease(release)) {
    throw new Error("Release not found or not available");
  }
  // Ownership: only this customer's products are considered later by callers
  await query(
    `INSERT INTO ar360_customer_platform_release_views
      (customer_uid, release_id, viewed_at, product_update_reviewed_at, created_at, updated_at)
     VALUES (?, ?, NOW(), NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       viewed_at = COALESCE(viewed_at, NOW()),
       product_update_reviewed_at = NOW(),
       updated_at = NOW()`,
    [input.customerUid, input.releaseId],
  );
}

/** List customer-visible published releases (no drafts/archived). */
export async function listCustomerVisibleReleases(customerUid: string): Promise<
  Array<{
    id: number;
    version: string;
    title: string;
    publishedAt: string | null;
    isLatestStable: boolean;
    isCurrentForCustomer: boolean;
    viewState: CustomerReleaseViewState;
  }>
> {
  const [published, activeId, client] = await Promise.all([
    listPlatformReleases({ status: "published" }),
    getActiveStableReleaseId(),
    getClientUpdateState(customerUid),
  ]);

  const currentId = client?.client.currentReleaseId ?? null;
  const out = [];
  for (const r of published) {
    if (!customerFacingRelease(r)) continue;
    const view = await getViewState(customerUid, r.id);
    out.push({
      id: r.id,
      version: r.version,
      title: r.title,
      publishedAt: r.publishedAt,
      isLatestStable: activeId != null && r.id === activeId,
      isCurrentForCustomer: currentId != null && r.id === currentId,
      viewState: view.state,
    });
  }
  return out;
}

async function listOpenRolloutsForCustomer(customerUid: string, releaseId?: number | null) {
  const params: Array<string | number> = [customerUid];
  let releaseClause = "";
  if (releaseId != null) {
    releaseClause = " AND r.target_release_id = ?";
    params.push(releaseId);
  }
  return query<{
    id: number;
    status: string;
    target_release_id: number;
    migration_plan_id: number;
  }>(
    `SELECT id, status, target_release_id, migration_plan_id
       FROM ar360_customer_rollouts r
      WHERE customer_uid = ?
        AND status IN ('READY', 'PREVIEW', 'CANARY', 'BATCHING', 'PAUSED')
        ${releaseClause}
      ORDER BY id DESC
      LIMIT 20`,
    params,
  );
}

function productMigrationHint(
  compatibility: CompatibilityCode,
  hasOpenRollout: boolean,
): ProductMigrationHint {
  if (hasOpenRollout) return "ROLLOUT_AVAILABLE";
  if (compatibility === "WARNING" || compatibility === "BLOCKED") return "REVIEW_REQUIRED";
  return "NOT_REQUIRED";
}

export async function getCustomerUpdateCenter(customerUid: string): Promise<{
  currentVersion: string | null;
  currentReleaseId: number | null;
  latestStableVersion: string | null;
  latestStableReleaseId: number | null;
  status: CustomerUpdateCenterStatus;
  updatePolicy: string;
  autoExecutable: false;
  releaseNotes: StructuredReleaseNotes | null;
  compatibilitySummary: {
    total: number;
    compatible: number;
    warning: number;
    blocked: number;
    unknown: number;
  };
  products: Array<
    ProductCompatibilityRow & {
      productMigration: ProductMigrationHint;
      actionLabel: string;
    }
  >;
  releaseHistory: Awaited<ReturnType<typeof listCustomerVisibleReleases>>;
  openRollouts: Array<{ id: number; status: string; targetReleaseId: number }>;
  banner: {
    show: boolean;
    message: string;
    releaseId: number | null;
    dismissed: boolean;
  };
  note: string;
}> {
  const [client, activeId] = await Promise.all([
    getClientUpdateState(customerUid),
    getActiveStableReleaseId(),
  ]);

  const currentReleaseId = client?.client.currentReleaseId ?? null;
  const currentVersion = client?.client.currentReleaseVersion ?? null;
  const latestStable = activeId ? await getPlatformReleaseById(activeId) : null;
  const latestEligible =
    latestStable && customerFacingRelease(latestStable) ? latestStable : null;

  const report = await listPlatformCompatibilityReport({
    releaseId: latestEligible?.id ?? null,
    customerUid,
    limit: 200,
  });

  const openRollouts = await listOpenRolloutsForCustomer(customerUid);
  const rolloutReleaseIds = new Set(openRollouts.map((r) => Number(r.target_release_id)));

  const summary = {
    total: report.rows.length,
    compatible: report.rows.filter((r) => r.compatibility === "COMPATIBLE").length,
    warning: report.rows.filter((r) => r.compatibility === "WARNING").length,
    blocked: report.rows.filter((r) => r.compatibility === "BLOCKED").length,
    unknown: report.rows.filter((r) => r.compatibility === "UNKNOWN").length,
  };

  let status: CustomerUpdateCenterStatus = "CURRENT";
  if (summary.blocked > 0 || summary.warning > 0) {
    status = "COMPATIBILITY_REVIEW";
  } else if (latestEligible) {
    if (currentVersion) {
      const cmp = compareSemver(latestEligible.version, currentVersion);
      if (cmp != null && cmp > 0) status = "UPDATE_AVAILABLE";
      else status = "CURRENT";
    } else {
      // No assigned current platform release — treat newer stable as available to review
      status = "UPDATE_AVAILABLE";
    }
  }

  // Policy: AUTO never executes
  if (autoPolicyIsExecutable()) {
    throw new Error("AUTO must never be executable");
  }

  const products = report.rows.map((row) => {
    const hasRollout = latestEligible
      ? rolloutReleaseIds.has(latestEligible.id)
      : openRollouts.length > 0;
    const hint = productMigrationHint(row.compatibility, hasRollout);
    return {
      ...row,
      productMigration: hint,
      actionLabel:
        hint === "ROLLOUT_AVAILABLE"
          ? "PRODUCT REVIEW AVAILABLE"
          : hint === "REVIEW_REQUIRED"
            ? "REVIEW REQUIRED"
            : "NOT REQUIRED",
    };
  });

  const releaseHistory = await listCustomerVisibleReleases(customerUid);
  let bannerDismissed = false;
  if (latestEligible) {
    const view = await getViewState(customerUid, latestEligible.id);
    bannerDismissed = view.state === "DISMISSED";
  }

  const showBanner =
    (status === "UPDATE_AVAILABLE" || status === "COMPATIBILITY_REVIEW") &&
    latestEligible != null &&
    !bannerDismissed;

  return {
    currentVersion,
    currentReleaseId,
    latestStableVersion: latestEligible?.version ?? null,
    latestStableReleaseId: latestEligible?.id ?? null,
    status,
    updatePolicy: client?.client.updatePolicy ?? "MANUAL",
    autoExecutable: false,
    releaseNotes: report.releaseNotes,
    compatibilitySummary: summary,
    products,
    releaseHistory,
    openRollouts: openRollouts.map((r) => ({
      id: Number(r.id),
      status: r.status,
      targetReleaseId: Number(r.target_release_id),
    })),
    banner: {
      show: showBanner,
      message:
        status === "COMPATIBILITY_REVIEW"
          ? `Platform update may need a compatibility review${
              latestEligible ? ` (${latestEligible.version})` : ""
            }`
          : latestEligible
            ? `AR360 ${latestEligible.version} is available`
            : "Platform Update Available",
      releaseId: latestEligible?.id ?? null,
      dismissed: bannerDismissed,
    },
    note: "Platform Update is separate from Product Update. Viewing this page does not change your products.",
  };
}

export async function getCustomerReleaseDetail(input: {
  customerUid: string;
  releaseId: number;
}): Promise<{
  release: {
    id: number;
    version: string;
    title: string;
    publishedAt: string | null;
    isLatestStable: boolean;
  };
  currentVersion: string | null;
  targetVersion: string;
  releaseNotes: StructuredReleaseNotes;
  overallCompatibility: CompatibilityCode;
  products: Array<
    ProductCompatibilityRow & {
      productMigration: ProductMigrationHint;
      actionLabel: string;
    }
  >;
  updatePolicy: string;
  approvalRequired: boolean;
  openRollouts: Array<{
    id: number;
    status: string;
    migrationPlanId: number;
    progress: { pending: number; pass: number; blocked: number; unhealthy: number } | null;
  }>;
  viewState: CustomerReleaseViewState;
  productUpdateReviewedAt: string | null;
  note: string;
} | null> {
  const release = await getPlatformReleaseById(input.releaseId);
  if (!release || !customerFacingRelease(release)) return null;

  // Verify no cross-customer leakage: only this customer's products
  const owned = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM products WHERE customer_uid = ?`,
    [input.customerUid],
  );
  void owned;

  const [client, activeId, view, rollouts] = await Promise.all([
    getClientUpdateState(input.customerUid),
    getActiveStableReleaseId(),
    getViewState(input.customerUid, input.releaseId),
    listOpenRolloutsForCustomer(input.customerUid, input.releaseId),
  ]);

  const report = await listPlatformCompatibilityReport({
    releaseId: release.id,
    customerUid: input.customerUid,
    limit: 200,
  });

  let overall: CompatibilityCode = "UNKNOWN";
  if (report.rows.some((r) => r.compatibility === "BLOCKED")) overall = "BLOCKED";
  else if (report.rows.some((r) => r.compatibility === "WARNING")) overall = "WARNING";
  else if (report.rows.every((r) => r.compatibility === "COMPATIBLE")) overall = "COMPATIBLE";
  else if (report.rows.length === 0) overall = "UNKNOWN";
  else overall = "COMPATIBLE";

  const hasRollout = rollouts.length > 0;
  const products = report.rows.map((row) => {
    const hint = productMigrationHint(row.compatibility, hasRollout);
    return {
      ...row,
      productMigration: hint,
      actionLabel:
        hint === "ROLLOUT_AVAILABLE"
          ? "PRODUCT REVIEW AVAILABLE"
          : hint === "REVIEW_REQUIRED"
            ? "REVIEW REQUIRED"
            : "NOT REQUIRED",
    };
  });

  const openRollouts = [];
  for (const r of rollouts) {
    const summary = await getMigrationPlanSummary(Number(r.migration_plan_id));
    openRollouts.push({
      id: Number(r.id),
      status: r.status,
      migrationPlanId: Number(r.migration_plan_id),
      progress: summary
        ? {
            pending: summary.counts.pending,
            pass: summary.counts.pass,
            blocked: summary.counts.blocked,
            unhealthy: summary.counts.unhealthy,
          }
        : null,
    });
  }

  const notes = await getStructuredNotes(release);
  const policy = client?.client.updatePolicy ?? "MANUAL";

  return {
    release: {
      id: release.id,
      version: release.version,
      title: release.title,
      publishedAt: release.publishedAt,
      isLatestStable: activeId === release.id,
    },
    currentVersion: client?.client.currentReleaseVersion ?? null,
    targetVersion: release.version,
    releaseNotes: notes,
    overallCompatibility: overall,
    products,
    updatePolicy: policy,
    approvalRequired: policy === "APPROVAL_REQUIRED",
    openRollouts,
    viewState: view.state,
    productUpdateReviewedAt: view.productUpdateReviewedAt,
    note: "Review only. No product configuration changes happen until a controlled product update is executed by Master Admin via existing rollout.",
  };
}

/** Customer may only access rollouts owned by their customer_uid. */
export async function getCustomerOwnedRolloutPreview(input: {
  customerUid: string;
  rolloutId: number;
}): Promise<{
  rolloutId: number;
  status: string;
  targetReleaseId: number;
  products: Array<{ productId: string; status: string }>;
  note: string;
} | null> {
  const rows = await query<{
    id: number;
    status: string;
    target_release_id: number;
    migration_plan_id: number;
    customer_uid: string;
  }>(
    `SELECT id, status, target_release_id, migration_plan_id, customer_uid
       FROM ar360_customer_rollouts
      WHERE id = ? LIMIT 1`,
    [input.rolloutId],
  );
  const row = rows[0];
  if (!row || row.customer_uid !== input.customerUid) return null;

  const summary = await getMigrationPlanSummary(Number(row.migration_plan_id));
  return {
    rolloutId: Number(row.id),
    status: row.status,
    targetReleaseId: Number(row.target_release_id),
    products: (summary?.products || []).map((p) => ({
      productId: p.productId,
      status: p.status,
    })),
    note: "Read-only product update preview. Execution remains Master Admin / Phase 9.",
  };
}

export function platformUpdateCenterIsReadOnly(): true {
  return true;
}

export function autoUpdateIsExecutable(): false {
  return false;
}
