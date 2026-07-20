import crypto from "crypto";
import { DbObjectCaptureJobQueue } from "@/lib/queue/db-job-queue";
import { RedisObjectCaptureJobQueue } from "@/lib/queue/redis-job-queue";
import { resolveJobQueueBackend } from "@/lib/queue/types";
import type { JobQueue } from "@/lib/queue/types";

export { notifyObjectCaptureJobQueued } from "@/lib/queue/redis-job-queue";
export { OBJECT_CAPTURE_QUEUE_NAME } from "@/lib/queue/db-job-queue";
export type { ClaimJobOptions, JobQueue, JobQueueName, QueuedJob } from "@/lib/queue/types";
export { resolveJobQueueBackend } from "@/lib/queue/types";

let cachedQueue: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (cachedQueue) return cachedQueue;

  cachedQueue =
    resolveJobQueueBackend() === "redis"
      ? new RedisObjectCaptureJobQueue()
      : new DbObjectCaptureJobQueue();

  return cachedQueue;
}

export function createWorkerId(prefix = "worker"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
