/**
 * Phase 11 — SaaS platform / customer / product version isolation + compatibility.
 *
 * Diagnostic only. Does NOT migrate products, change billing, or enable VERSIONED.
 * Reuses Phase 7/9/10 systems for reports — does not replace them.
 */

import { query } from "@/lib/db";
import { capturePointerSnapshot } from "@/lib/platform-versioning/activation-safety.service";
import { getRevisionById } from "@/lib/platform-versioning/component-revisions.service";
import { getClientUpdateState } from "@/lib/platform-versioning/client-update-policy.service";
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
import { getVersionedRuntimeFlag } from "@/lib/platform-versioning/runtime-selection";

export type CompatibilityCode = "COMPATIBLE" | "WARNING" | "BLOCKED" | "UNKNOWN";

export type ComponentVersionLabel = {
  revisionId: number | null;
  componentRevisionNumber: number | null;
  label: string;
};

export type ProductCompatibilityRow = {
  productId: string;
  title: string | null;
  customerUid: string;
  companyName: string | null;
  platformReleaseId: number | null;
  platformVersion: string | null;
  config: ComponentVersionLabel;
  material: ComponentVersionLabel;
  lighting: ComponentVersionLabel;
  viewer: ComponentVersionLabel;
  ar: ComponentVersionLabel;
  geometry: ComponentVersionLabel;
  compatibility: CompatibilityCode;
  reason: string;
};

export type CustomerPlatformStatus = {
  platformVersion: string | null;
  platformReleaseId: number | null;
  status: "CURRENT" | "UPDATE_AVAILABLE" | "COMPATIBILITY_REVIEW";
  releaseNotes: StructuredReleaseNotes | null;
  compatibilitySummary: {
    total: number;
    compatible: number;
    warning: number;
    blocked: number;
    unknown: number;
  };
  note: string;
};

async function labelForPointer(
  revisionId: number | null,
): Promise<ComponentVersionLabel> {
  if (revisionId == null) {
    return { revisionId: null, componentRevisionNumber: null, label: "—" };
  }
  const row = await getRevisionById(revisionId);
  if (!row) {
    return {
      revisionId,
      componentRevisionNumber: null,
      label: `#${revisionId} (missing)`,
    };
  }
  const n =
    row.component_revision_number != null
      ? Number(row.component_revision_number)
      : Number(row.revision_number);
  return {
    revisionId,
    componentRevisionNumber: n,
    label: `v${n}`,
  };
}

export async function evaluateProductCompatibility(input: {
  productId: string;
  platformRelease: PlatformReleaseDto | null;
}): Promise<ProductCompatibilityRow> {
  const products = await query<{
    id: string;
    title: string | null;
    customer_uid: string | null;
  }>(`SELECT id, title, customer_uid FROM products WHERE id = ? LIMIT 1`, [input.productId]);

  const product = products[0];
  if (!product) {
    return {
      productId: input.productId,
      title: null,
      customerUid: "",
      companyName: null,
      platformReleaseId: input.platformRelease?.id ?? null,
      platformVersion: input.platformRelease?.version ?? null,
      config: { revisionId: null, componentRevisionNumber: null, label: "—" },
      material: { revisionId: null, componentRevisionNumber: null, label: "—" },
      lighting: { revisionId: null, componentRevisionNumber: null, label: "—" },
      viewer: { revisionId: null, componentRevisionNumber: null, label: "—" },
      ar: { revisionId: null, componentRevisionNumber: null, label: "—" },
      geometry: { revisionId: null, componentRevisionNumber: null, label: "—" },
      compatibility: "BLOCKED",
      reason: "Product not found",
    };
  }

  const customerUid = String(product.customer_uid || "");
  const company = customerUid
    ? await query<{ company_name: string | null }>(
        `SELECT company_name FROM customers WHERE customer_uid = ? LIMIT 1`,
        [customerUid],
      )
    : [];

  const snap = await capturePointerSnapshot(input.productId);
  const [config, material, lighting, viewer, ar, geometry] = await Promise.all([
    labelForPointer(snap?.config ?? null),
    labelForPointer(snap?.material ?? null),
    labelForPointer(snap?.lighting ?? null),
    labelForPointer(snap?.viewer ?? null),
    labelForPointer(snap?.ar ?? null),
    labelForPointer(snap?.geometry ?? null),
  ]);

  let compatibility: CompatibilityCode = "UNKNOWN";
  let reason = "No platform release selected for comparison";

  if (!input.platformRelease) {
    compatibility = "UNKNOWN";
    reason = "No active stable platform release — LEGACY default. Diagnostic only.";
  } else if (input.platformRelease.status !== "published") {
    compatibility = "BLOCKED";
    reason = `Platform release ${input.platformRelease.version} is not published`;
  } else if (!snap?.config) {
    compatibility = "WARNING";
    reason = "Missing foundation config revision pointer (legacy path may still render)";
  } else if (config.label.includes("missing")) {
    compatibility = "BLOCKED";
    reason = "Config pointer references a missing revision";
  } else if (
    [material, lighting, viewer, ar].some((c) => c.label.includes("missing"))
  ) {
    compatibility = "BLOCKED";
    reason = "One or more component pointers reference missing revisions";
  } else {
    // Different component revision numbers are EXPECTED — not a warning.
    const notes = await getReleaseNotesForRelease(input.platformRelease);
    if (notes.breakingChanges.length > 0) {
      compatibility = "WARNING";
      reason = `Platform ${input.platformRelease.version} lists breaking changes — review before any Phase 7/9 migration. Products unchanged.`;
    } else {
      compatibility = "COMPATIBLE";
      reason = `Product configuration is diagnostically compatible with platform ${input.platformRelease.version}. Independent component revisions are expected. No automatic migration.`;
    }
  }

  // Geometry migration still unsupported — if platform notes claim geometry migration, warn
  if (input.platformRelease) {
    const notes = await getReleaseNotesForRelease(input.platformRelease);
    const geoClaim = [...notes.breakingChanges, ...notes.compatibilityNotes, notes.summary]
      .join(" ")
      .toLowerCase()
      .includes("geometry migration");
    if (geoClaim && compatibility !== "BLOCKED") {
      compatibility = "WARNING";
      reason =
        "Platform notes mention geometry migration; Phase 7 blocks geometry migration. Diagnostic only.";
    }
  }

  return {
    productId: product.id,
    title: product.title,
    customerUid,
    companyName: company[0]?.company_name ?? null,
    platformReleaseId: input.platformRelease?.id ?? null,
    platformVersion: input.platformRelease?.version ?? null,
    config,
    material,
    lighting,
    viewer,
    ar,
    geometry,
    compatibility,
    reason,
  };
}

async function getReleaseNotesForRelease(
  release: PlatformReleaseDto,
): Promise<StructuredReleaseNotes> {
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

export async function listPlatformCompatibilityReport(input?: {
  releaseId?: number | null;
  customerUid?: string | null;
  limit?: number;
}): Promise<{
  platformRelease: {
    id: number;
    version: string;
    channel: string;
    status: string;
  } | null;
  releaseNotes: StructuredReleaseNotes | null;
  rows: ProductCompatibilityRow[];
  isolation: {
    platformReleaseMutatesProducts: false;
    productVersionsIndependent: true;
    subscriptionIndependent: true;
  };
}> {
  let release: PlatformReleaseDto | null = null;
  if (input?.releaseId) {
    release = await getPlatformReleaseById(input.releaseId);
  } else {
    const activeId = await getActiveStableReleaseId();
    release = activeId ? await getPlatformReleaseById(activeId) : null;
    if (!release) {
      // Prefer latest published for diagnostic display when stable empty
      const published = await listPlatformReleases({ status: "published" });
      release = published[0] ?? null;
    }
  }

  const limit = Math.min(500, Math.max(1, input?.limit ?? 100));
  const params: Array<string | number> = [];
  let where = "WHERE 1=1";
  if (input?.customerUid) {
    where += " AND customer_uid = ?";
    params.push(input.customerUid);
  }
  params.push(limit);

  const products = await query<{ id: string }>(
    `SELECT id FROM products ${where} ORDER BY id ASC LIMIT ?`,
    params,
  );

  const rows: ProductCompatibilityRow[] = [];
  for (const p of products) {
    rows.push(
      await evaluateProductCompatibility({
        productId: p.id,
        platformRelease: release,
      }),
    );
  }

  return {
    platformRelease: release
      ? {
          id: release.id,
          version: release.version,
          channel: release.channel,
          status: release.status,
        }
      : null,
    releaseNotes: release ? await getReleaseNotesForRelease(release) : null,
    rows,
    isolation: {
      platformReleaseMutatesProducts: false,
      productVersionsIndependent: true,
      subscriptionIndependent: true,
    },
  };
}

export async function getCustomerPlatformInformationalStatus(
  customerUid: string,
): Promise<CustomerPlatformStatus> {
  const activeId = await getActiveStableReleaseId();
  const release = activeId ? await getPlatformReleaseById(activeId) : null;
  const publishedFallback = release
    ? null
    : (await listPlatformReleases({ status: "published" }))[0] ?? null;
  const platform = release || publishedFallback;

  const report = await listPlatformCompatibilityReport({
    releaseId: platform?.id ?? null,
    customerUid,
    limit: 200,
  });

  const summary = {
    total: report.rows.length,
    compatible: report.rows.filter((r) => r.compatibility === "COMPATIBLE").length,
    warning: report.rows.filter((r) => r.compatibility === "WARNING").length,
    blocked: report.rows.filter((r) => r.compatibility === "BLOCKED").length,
    unknown: report.rows.filter((r) => r.compatibility === "UNKNOWN").length,
  };

  const client = await getClientUpdateState(customerUid);
  let status: CustomerPlatformStatus["status"] = "CURRENT";

  if (summary.blocked > 0 || summary.warning > 0) {
    status = "COMPATIBILITY_REVIEW";
  } else if (
    client?.client.status === "UPDATE_AVAILABLE" ||
    client?.client.status === "PENDING_APPROVAL" ||
    (client?.client.targetReleaseId != null &&
      client.client.currentReleaseId !== client.client.targetReleaseId)
  ) {
    status = "UPDATE_AVAILABLE";
  } else {
    status = "CURRENT";
  }

  return {
    platformVersion: platform?.version ?? null,
    platformReleaseId: platform?.id ?? null,
    status,
    releaseNotes: report.releaseNotes,
    compatibilitySummary: summary,
    note: "Informational only. No product migration starts from this view. Use Master Admin Phase 7/9 for controlled upgrades.",
  };
}

/** Isolation invariants — unit-testable constants. */
export function platformReleaseMutatesProducts(): false {
  return false;
}

export function productComponentVersionsMustMatch(): false {
  return false;
}

export function platformReleaseMutatesSubscriptions(): false {
  return false;
}

export async function assertVersionedNotGlobal(): Promise<boolean> {
  const flag = await getVersionedRuntimeFlag();
  if (!flag) return true;
  return flag.targeting.scope !== "all";
}
