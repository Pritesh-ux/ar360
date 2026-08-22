/**
 * Phase 6D — VIEWER-ONLY rollback & recovery.
 * Changes only products.active_viewer_revision_id.
 * Does not implement AR/geometry rollback or auto-rollback of AR.
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

export type ViewerRollbackTarget = PointerRollbackTarget;
export type ViewerRollbackValidation = PointerRollbackValidation;
export type ViewerHealthResult = PointerHealthResult;

export function validateViewerSettings(settings: unknown) {
  return validateKindSpecificSettings("viewer", settings);
}

export async function validateViewerRollbackTarget(input: {
  productId: string;
  targetRevisionId: number;
}): Promise<ViewerRollbackValidation> {
  return validatePointerRollbackTarget({ kind: "viewer", ...input });
}

export async function listViewerRollbackTargets(productId: string) {
  const result = await listPointerRollbackTargets("viewer", productId);
  return {
    productId: result.productId,
    currentViewerRevisionId: result.currentRevisionId,
    targets: result.targets,
  };
}

export async function previewViewerRollback(input: {
  productId: string;
  targetRevisionId: number;
}) {
  const preview = await previewPointerRollback({ kind: "viewer", ...input });
  if (!preview) return null;
  return {
    ...preview,
    currentViewer: preview.currentSettings,
    proposedViewer: preview.proposedSettings,
  };
}

export async function runViewerRollbackHealthCheck(productId: string) {
  return runPointerRollbackHealthCheck("viewer", productId);
}

export async function rollbackViewerRevision(input: {
  productId: string;
  targetRevisionId: number;
  adminId: number | null;
  reason?: string;
}) {
  return rollbackPointerRevision({ kind: "viewer", ...input });
}

export function isEligibleViewerRollbackStatus(status: string): boolean {
  return isEligiblePointerRollbackStatus(status);
}

export function assertViewerRollbackKind(kind: string): boolean {
  return assertPointerRollbackKind("viewer", kind);
}
