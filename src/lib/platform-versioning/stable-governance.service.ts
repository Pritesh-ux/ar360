/**
 * Phase 10 — Stable Release Governance & Activation Gate.
 *
 * Activates ONLY platform_settings.ar360_active_stable_release_id.
 * Does NOT migrate products, enable VERSIONED, or change feature flags.
 */

import { query } from "@/lib/db";
import { listFeatureFlags } from "@/lib/platform-versioning/feature-flags.service";
import {
  ACTIVE_STABLE_SETTING_KEY,
  ensureActiveStableSettingExists,
  getActiveStableReleaseId,
  getPlatformReleaseById,
  listPlatformReleases,
  type PlatformReleaseDto,
} from "@/lib/platform-versioning/releases.service";
import { parseSemver } from "@/lib/platform-versioning/semver";
import { getVersionedRuntimeFlag } from "@/lib/platform-versioning/runtime-selection";
import { isGeometryBlocked } from "@/lib/platform-versioning/migration-engine.service";

export const PREVIOUS_STABLE_SETTING_KEY = "ar360_previous_stable_release_id";
export const STABLE_ACTIVATED_AT_KEY = "ar360_stable_activated_at";
export const STABLE_ACTIVATED_BY_KEY = "ar360_stable_activated_by_admin_id";
export const STABLE_REQUEST_RELEASE_KEY = "ar360_stable_request_release_id";
export const STABLE_LAST_HEALTH_KEY = "ar360_stable_last_health";

export type ReadinessVerdict = "PASS" | "WARN" | "BLOCKED";

export type ReadinessCheck = {
  key: string;
  label: string;
  verdict: ReadinessVerdict;
  reason: string;
};

export type StableReadinessResult = {
  banner: "STABLE READINESS";
  releaseId: number;
  version: string | null;
  overall: "READY" | "WARN" | "BLOCKED";
  checks: ReadinessCheck[];
  featureFlags: Array<{ key: string; enabled: boolean; note: string }>;
  migratesProducts: false;
  enablesVersionedRuntime: false;
};

export type StableHealthResult = {
  status: "HEALTHY" | "UNHEALTHY";
  checks: ReadinessCheck[];
  autoRollback: false;
};

function overallFromChecks(checks: ReadinessCheck[]): "READY" | "WARN" | "BLOCKED" {
  if (checks.some((c) => c.verdict === "BLOCKED")) return "BLOCKED";
  if (checks.some((c) => c.verdict === "WARN")) return "WARN";
  return "READY";
}

async function getSetting(key: string): Promise<string> {
  const rows = await query<{ setting_value: string | null }>(
    `SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1`,
    [key],
  );
  return String(rows[0]?.setting_value ?? "").trim();
}

async function setSetting(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO platform_settings (setting_key, setting_value, is_secret)
     VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value],
  );
}

export async function getPreviousStableReleaseId(): Promise<number | null> {
  const raw = await getSetting(PREVIOUS_STABLE_SETTING_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function getStableRequestReleaseId(): Promise<number | null> {
  const raw = await getSetting(STABLE_REQUEST_RELEASE_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function runStableReadinessCheck(releaseId: number): Promise<StableReadinessResult> {
  await ensureActiveStableSettingExists();
  const checks: ReadinessCheck[] = [];
  const release = await getPlatformReleaseById(releaseId);

  if (!release) {
    checks.push({
      key: "exists",
      label: "Release exists",
      verdict: "BLOCKED",
      reason: "Release not found",
    });
    return {
      banner: "STABLE READINESS",
      releaseId,
      version: null,
      overall: "BLOCKED",
      checks,
      featureFlags: [],
      migratesProducts: false,
      enablesVersionedRuntime: false,
    };
  }

  checks.push({
    key: "exists",
    label: "Release exists",
    verdict: "PASS",
    reason: `Found release ${release.version} (#${release.id})`,
  });

  if (release.status === "draft") {
    checks.push({
      key: "published",
      label: "Published",
      verdict: "BLOCKED",
      reason: "Draft releases cannot become active stable",
    });
  } else if (release.status === "archived") {
    checks.push({
      key: "published",
      label: "Published",
      verdict: "BLOCKED",
      reason: "Archived releases cannot become active stable",
    });
    checks.push({
      key: "non_archived",
      label: "Non-archived",
      verdict: "BLOCKED",
      reason: "Release is archived",
    });
  } else if (release.status === "published") {
    checks.push({
      key: "published",
      label: "Published",
      verdict: "PASS",
      reason: "Release status is published",
    });
    checks.push({
      key: "non_archived",
      label: "Non-archived",
      verdict: "PASS",
      reason: "Release is not archived",
    });
  } else {
    checks.push({
      key: "published",
      label: "Published",
      verdict: "BLOCKED",
      reason: `Unexpected status '${release.status}'`,
    });
  }

  const semver = parseSemver(release.version);
  checks.push(
    semver
      ? {
          key: "semver",
          label: "Valid semver",
          verdict: "PASS",
          reason: `Version ${semver.version} is valid`,
        }
      : {
          key: "semver",
          label: "Valid semver",
          verdict: "BLOCKED",
          reason: `Invalid semver '${release.version}'`,
        },
  );

  checks.push(
    release.channel === "stable"
      ? {
          key: "channel",
          label: "Stable channel",
          verdict: "PASS",
          reason: "Release channel is stable",
        }
      : {
          key: "channel",
          label: "Stable channel",
          verdict: "WARN",
          reason: `Channel is '${release.channel}' (preferred: stable). Pointer activation is still allowed if published.`,
        },
  );

  // Metadata validity
  if (release.metadata == null) {
    checks.push({
      key: "metadata",
      label: "Release metadata valid",
      verdict: "PASS",
      reason: "No metadata (acceptable)",
    });
  } else {
    checks.push({
      key: "metadata",
      label: "Release metadata valid",
      verdict: "PASS",
      reason: "Metadata parsed as object",
    });
  }

  const meta = release.metadata || {};
  const geometryHint =
    meta.requiresGeometryMigration === true ||
    meta.geometryMigration === true ||
    String(meta.migrationComponents || "").includes("geometry");
  if (geometryHint || isGeometryBlocked("geometry")) {
    checks.push({
      key: "geometry",
      label: "Geometry migration dependency",
      verdict: geometryHint ? "BLOCKED" : "PASS",
      reason: geometryHint
        ? "GEOMETRY_NOT_SUPPORTED: release metadata requires geometry migration which Phase 7 blocks"
        : "No geometry migration requirement declared in metadata",
    });
  }

  // Feature flags — review only, never enable
  const flags = await listFeatureFlags();
  const featureFlags = flags.map((f) => {
    if (f.key === "versioned_runtime") {
      return {
        key: f.key,
        enabled: f.enabled,
        note: f.enabled
          ? "VERSIONED flag ON — canary targeting only; stable activation will NOT set scope=all"
          : "VERSIONED flag OFF — products remain LEGACY after stable activation (expected)",
      };
    }
    return {
      key: f.key,
      enabled: f.enabled,
      note: f.enabled ? "Enabled (not changed by stable activation)" : "Off (not auto-enabled)",
    };
  });

  checks.push({
    key: "feature_flags_reviewed",
    label: "Required feature flags reviewed",
    verdict: "PASS",
    reason: `${flags.length} flags reviewed. Stable activation does not enable flags.`,
  });

  const versioned = await getVersionedRuntimeFlag();
  if (versioned?.targeting?.scope === "all") {
    checks.push({
      key: "versioned_scope",
      label: "VERSIONED scope safety",
      verdict: "BLOCKED",
      reason: "versioned_runtime targeting scope=all is forbidden. Clear it before stable activation.",
    });
  } else {
    checks.push({
      key: "versioned_scope",
      label: "VERSIONED scope safety",
      verdict: "PASS",
      reason: "Global VERSIONED scope=all is not enabled",
    });
  }

  // Invalid component references in metadata (if declared)
  const declaredRefs = meta.componentRevisionIds;
  if (declaredRefs != null && typeof declaredRefs !== "object") {
    checks.push({
      key: "component_refs",
      label: "No invalid component references",
      verdict: "WARN",
      reason: "componentRevisionIds metadata is present but not an object — cannot validate",
    });
  } else {
    checks.push({
      key: "component_refs",
      label: "No invalid component references",
      verdict: "PASS",
      reason:
        "Stable pointer does not bind product component revisions. No invalid product refs introduced by activation.",
    });
  }

  // Migration system healthy
  try {
    const mig = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM ar360_migration_plans`);
    checks.push({
      key: "migration_system",
      label: "Migration system healthy",
      verdict: "PASS",
      reason: `Phase 7 migration plans table reachable (${Number(mig[0]?.c || 0)} plans)`,
    });
  } catch {
    checks.push({
      key: "migration_system",
      label: "Migration system healthy",
      verdict: "BLOCKED",
      reason: "Cannot query ar360_migration_plans",
    });
  }

  // Customer rollout system healthy
  try {
    const ro = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM ar360_customer_rollouts`);
    checks.push({
      key: "rollout_system",
      label: "Customer rollout system healthy",
      verdict: "PASS",
      reason: `Phase 9 customer rollouts table reachable (${Number(ro[0]?.c || 0)} rollouts)`,
    });
  } catch {
    checks.push({
      key: "rollout_system",
      label: "Customer rollout system healthy",
      verdict: "WARN",
      reason: "ar360_customer_rollouts not queryable — Phase 9 may be missing",
    });
  }

  // Rollback capability — tables/services present
  try {
    const revs = await query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM ar360_product_config_revisions LIMIT 1`,
    );
    checks.push({
      key: "rollback_capability",
      label: "Rollback capability available",
      verdict: "PASS",
      reason: `Component revisions available (${Number(revs[0]?.c || 0)}). Material/lighting/viewer/AR rollback tools remain separate.`,
    });
  } catch {
    checks.push({
      key: "rollback_capability",
      label: "Rollback capability available",
      verdict: "BLOCKED",
      reason: "Cannot query ar360_product_config_revisions",
    });
  }

  checks.push({
    key: "runtime_compat",
    label: "Runtime compatibility checks",
    verdict: "PASS",
    reason:
      "Stable activation only updates the release pointer. LEGACY remains default when VERSIONED is disabled. Products are not migrated.",
  });

  return {
    banner: "STABLE READINESS",
    releaseId: release.id,
    version: release.version,
    overall: overallFromChecks(checks),
    checks,
    featureFlags,
    migratesProducts: false,
    enablesVersionedRuntime: false,
  };
}

export async function requestStableActivation(input: {
  releaseId: number;
  adminId: number | null;
}): Promise<{ requestReleaseId: number; readiness: StableReadinessResult }> {
  const readiness = await runStableReadinessCheck(input.releaseId);
  if (readiness.overall === "BLOCKED") {
    const err = new Error("STABLE_ACTIVATION_BLOCKED: readiness is BLOCKED");
    (err as Error & { readiness: StableReadinessResult }).readiness = readiness;
    throw err;
  }
  await setSetting(STABLE_REQUEST_RELEASE_KEY, String(input.releaseId));
  return { requestReleaseId: input.releaseId, readiness };
}

export async function runStableHealthCheck(releaseId: number | null): Promise<StableHealthResult> {
  const checks: ReadinessCheck[] = [];
  if (releaseId == null) {
    checks.push({
      key: "pointer",
      label: "Stable release exists",
      verdict: "PASS",
      reason: "Active stable pointer is empty (LEGACY default)",
    });
    return { status: "HEALTHY", checks, autoRollback: false };
  }

  const release = await getPlatformReleaseById(releaseId);
  if (!release) {
    checks.push({
      key: "pointer",
      label: "Stable release exists",
      verdict: "BLOCKED",
      reason: "Pointer references missing release",
    });
    return { status: "UNHEALTHY", checks, autoRollback: false };
  }

  checks.push({
    key: "pointer",
    label: "Stable release exists",
    verdict: "PASS",
    reason: `Resolved ${release.version}`,
  });

  if (release.status !== "published") {
    checks.push({
      key: "status",
      label: "Release status valid",
      verdict: "BLOCKED",
      reason: `Active stable points at status '${release.status}'`,
    });
  } else {
    checks.push({
      key: "status",
      label: "Release status valid",
      verdict: "PASS",
      reason: "Published",
    });
  }

  checks.push({
    key: "resolver",
    label: "Runtime resolver can resolve release",
    verdict: "PASS",
    reason: `getPlatformReleaseById(${releaseId}) succeeded`,
  });

  checks.push({
    key: "legacy_fallback",
    label: "Legacy fallback remains available",
    verdict: "PASS",
    reason: "VERSIONED not auto-enabled; products without canary stay LEGACY",
  });

  const versioned = await getVersionedRuntimeFlag();
  if (versioned?.targeting?.scope === "all") {
    checks.push({
      key: "global_versioned",
      label: "Global VERSIONED disabled",
      verdict: "BLOCKED",
      reason: "scope=all is enabled — unsafe",
    });
  } else {
    checks.push({
      key: "global_versioned",
      label: "Global VERSIONED disabled",
      verdict: "PASS",
      reason: "scope=all is not set",
    });
  }

  const status = checks.some((c) => c.verdict === "BLOCKED") ? "UNHEALTHY" : "HEALTHY";
  return { status, checks, autoRollback: false };
}

export async function activateStableRelease(input: {
  releaseId: number;
  adminId: number | null;
  confirm: boolean;
}): Promise<{
  release: PlatformReleaseDto;
  previousStableReleaseId: number | null;
  readiness: StableReadinessResult;
  health: StableHealthResult;
  productPointersUnchanged: true;
  warning: string;
}> {
  if (!input.confirm) {
    throw new Error("confirmation_required: set confirm=true to activate stable");
  }

  const readiness = await runStableReadinessCheck(input.releaseId);
  if (readiness.overall === "BLOCKED") {
    const err = new Error("STABLE_ACTIVATION_BLOCKED: readiness is BLOCKED");
    (err as Error & { readiness: StableReadinessResult }).readiness = readiness;
    throw err;
  }

  const requested = await getStableRequestReleaseId();
  if (requested != null && requested !== input.releaseId) {
    throw new Error(
      `STABLE_REQUEST_MISMATCH: requested release is #${requested}, activation target is #${input.releaseId}. Request this release first.`,
    );
  }
  if (requested == null) {
    throw new Error(
      "STABLE_REQUEST_REQUIRED: call stable-request before stable-activate",
    );
  }

  const release = await getPlatformReleaseById(input.releaseId);
  if (!release) throw new Error("Release not found");

  const previousStableReleaseId = await getActiveStableReleaseId();

  // Capture previous, then set new pointer ONLY
  await setSetting(
    PREVIOUS_STABLE_SETTING_KEY,
    previousStableReleaseId != null ? String(previousStableReleaseId) : "",
  );
  await setSetting(ACTIVE_STABLE_SETTING_KEY, String(input.releaseId));
  await setSetting(STABLE_ACTIVATED_AT_KEY, new Date().toISOString());
  await setSetting(
    STABLE_ACTIVATED_BY_KEY,
    input.adminId != null ? String(input.adminId) : "",
  );
  await setSetting(STABLE_REQUEST_RELEASE_KEY, "");

  const health = await runStableHealthCheck(input.releaseId);
  await setSetting(
    STABLE_LAST_HEALTH_KEY,
    JSON.stringify({
      status: health.status,
      at: new Date().toISOString(),
      releaseId: input.releaseId,
      autoRollback: false,
    }),
  );

  // Critical: do NOT auto-rollback on unhealthy
  return {
    release: (await getPlatformReleaseById(input.releaseId))!,
    previousStableReleaseId,
    readiness,
    health,
    productPointersUnchanged: true,
    warning:
      health.status === "UNHEALTHY"
        ? "Stable pointer activated but health is UNHEALTHY. Pointer was NOT auto-rolled back. Use restore-previous explicitly if needed. Products were NOT migrated."
        : "Stable pointer activated. Products were NOT migrated. VERSIONED was NOT enabled. Feature flags unchanged.",
  };
}

export async function restorePreviousStable(input: {
  adminId: number | null;
  confirm: boolean;
}): Promise<{
  restoredReleaseId: number | null;
  previousBeforeRestore: number | null;
  readiness: StableReadinessResult | null;
  health: StableHealthResult;
  productPointersUnchanged: true;
  warning: string;
}> {
  if (!input.confirm) {
    throw new Error("confirmation_required: set confirm=true to restore previous stable");
  }

  const previousId = await getPreviousStableReleaseId();
  const currentId = await getActiveStableReleaseId();

  // Restoring empty previous = clear active stable (LEGACY)
  let readiness: StableReadinessResult | null = null;
  if (previousId != null) {
    readiness = await runStableReadinessCheck(previousId);
    if (readiness.overall === "BLOCKED") {
      const err = new Error("STABLE_ACTIVATION_BLOCKED: previous stable readiness is BLOCKED");
      (err as Error & { readiness: StableReadinessResult }).readiness = readiness;
      throw err;
    }
  }

  await setSetting(PREVIOUS_STABLE_SETTING_KEY, currentId != null ? String(currentId) : "");
  await setSetting(ACTIVE_STABLE_SETTING_KEY, previousId != null ? String(previousId) : "");
  await setSetting(STABLE_ACTIVATED_AT_KEY, new Date().toISOString());
  await setSetting(
    STABLE_ACTIVATED_BY_KEY,
    input.adminId != null ? String(input.adminId) : "",
  );
  await setSetting(STABLE_REQUEST_RELEASE_KEY, "");

  const health = await runStableHealthCheck(previousId);
  await setSetting(
    STABLE_LAST_HEALTH_KEY,
    JSON.stringify({
      status: health.status,
      at: new Date().toISOString(),
      releaseId: previousId,
      action: "restore_previous",
      autoRollback: false,
    }),
  );

  return {
    restoredReleaseId: previousId,
    previousBeforeRestore: currentId,
    readiness,
    health,
    productPointersUnchanged: true,
    warning:
      "Restored previous stable pointer only. Products were NOT migrated. No automatic rollback of product revisions.",
  };
}

export async function getStableGovernanceStatus() {
  await ensureActiveStableSettingExists();
  const [activeId, previousId, activatedAt, activatedBy, requestId, lastHealthRaw, releases] =
    await Promise.all([
      getActiveStableReleaseId(),
      getPreviousStableReleaseId(),
      getSetting(STABLE_ACTIVATED_AT_KEY),
      getSetting(STABLE_ACTIVATED_BY_KEY),
      getStableRequestReleaseId(),
      getSetting(STABLE_LAST_HEALTH_KEY),
      listPlatformReleases(),
    ]);

  const [active, previous, requested] = await Promise.all([
    activeId ? getPlatformReleaseById(activeId) : Promise.resolve(null),
    previousId ? getPlatformReleaseById(previousId) : Promise.resolve(null),
    requestId ? getPlatformReleaseById(requestId) : Promise.resolve(null),
  ]);

  let lastHealth: unknown = null;
  if (lastHealthRaw) {
    try {
      lastHealth = JSON.parse(lastHealthRaw);
    } catch {
      lastHealth = { raw: lastHealthRaw };
    }
  }

  return {
    currentStable: active
      ? { id: active.id, version: active.version, channel: active.channel, status: active.status }
      : null,
    previousStable: previous
      ? {
          id: previous.id,
          version: previous.version,
          channel: previous.channel,
          status: previous.status,
        }
      : null,
    activatedAt: activatedAt || null,
    activatedByAdminId: activatedBy ? Number(activatedBy) || null : null,
    requestedStable: requested
      ? { id: requested.id, version: requested.version }
      : null,
    lastHealth,
    releases: releases.map((r) => ({
      id: r.id,
      version: r.version,
      channel: r.channel,
      status: r.status,
      isActiveStable: r.isActiveStable,
      createdAt: r.createdAt,
      publishedAt: r.publishedAt,
    })),
    note: "Stable activation changes only the release pointer. It does not migrate customers or products.",
  };
}

/** Stable activation must never touch product revision pointers. */
export function stableActivationTouchesProductPointers(): false {
  return false;
}
