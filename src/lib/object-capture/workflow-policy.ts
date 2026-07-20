import type { ObjectCaptureStatus } from "./types";

const transitions: Record<ObjectCaptureStatus, readonly ObjectCaptureStatus[]> = {
  pending: ["uploading", "validating", "queued", "cancelled"],
  uploading: ["validating", "failed", "cancelled"],
  validating: ["action_required", "queued", "failed", "cancelled"],
  action_required: ["queued", "cancelled"],
  queued: ["processing", "cancelled"],
  processing: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["queued", "cancelled"],
  cancelled: ["queued"],
};

export function canTransitionObjectCaptureJob(
  from: ObjectCaptureStatus,
  to: ObjectCaptureStatus,
): boolean {
  return transitions[from].includes(to);
}

export function assertObjectCaptureTransition(
  from: ObjectCaptureStatus,
  to: ObjectCaptureStatus,
): void {
  if (!canTransitionObjectCaptureJob(from, to)) {
    throw new Error(`Object Capture job cannot transition from ${from} to ${to}.`);
  }
}

export function isTerminalObjectCaptureStatus(status: ObjectCaptureStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
