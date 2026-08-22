/**
 * Phase 6D — AR-ONLY rollback & recovery.
 * Changes only products.active_ar_revision_id.
 * Does not implement viewer/geometry rollback or auto-rollback of Viewer.
 */

import {
  assertPointerRollbackKind,
  isEligiblePointerRollbackStatus,
  listPointerRollbackTargets,
  previewPointerRollback,
  rollbackPointerRevision,
  runPointerRollbackHealthCheck,
  validateKindSpecificSettings,
  validatePointerRollbackTarget,
  type PointerHealthResult,
  type PointerRollbackTarget,
  type PointerRollbackValidation,
} from "@/lib/platform-versioning/pointer-rollback-core";

export type ArRollbackTarget = PointerRollbackTarget;
export type ArRollbackValidation = PointerRollbackValidation;
export type ArHealthResult = PointerHealthResult;

export function validateArSettings(settings: unknown) {
  return validateKindSpecificSettings("ar", settings);
}

export async function validateArRollbackTarget(input: {
  productId: string;
  targetRevisionId: number;
}): Promise<ArRollbackValidation> {
  return validatePointerRollbackTarget({ kind: "ar", ...input });
}

export async function listArRollbackTargets(productId: string) {
  const result = await listPointerRollbackTargets("ar", productId);
  return {
    productId: result.productId,
    currentArRevisionId: result.currentRevisionId,
    targets: result.targets,
  };
}

export async function previewArRollback(input: {
  productId: string;
  targetRevisionId: number;
}) {
  const preview = await previewPointerRollback({ kind: "ar", ...input });
  if (!preview) return null;
  return {
    ...preview,
    currentAr: preview.currentSettings,
    proposedAr: preview.proposedSettings,
  };
}

export async function runArRollbackHealthCheck(productId: string) {
  return runPointerRollbackHealthCheck("ar", productId);
}

export async function rollbackArRevision(input: {
  productId: string;
  targetRevisionId: number;
  adminId: number | null;
  reason?: string;
}) {
  return rollbackPointerRevision({ kind: "ar", ...input });
}

export function isEligibleArRollbackStatus(status: string): boolean {
  return isEligiblePointerRollbackStatus(status);
}

export function assertArRollbackKind(kind: string): boolean {
  return assertPointerRollbackKind("ar", kind);
}
