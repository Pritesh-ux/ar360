import { DbObjectCaptureJobQueue } from "@/lib/queue/db-job-queue";
import type { ClaimJobOptions, JobQueue, QueuedJob } from "@/lib/queue/types";

const dbQueue = new DbObjectCaptureJobQueue();

export class RedisObjectCaptureJobQueue implements JobQueue {
  async claimNext(options: ClaimJobOptions): Promise<QueuedJob | null> {
    return dbQueue.claimNext(options);
  }

  async complete(jobId: string, result: Record<string, unknown> = {}) {
    return dbQueue.complete(jobId, result);
  }

  async fail(jobId: string, message: string) {
    return dbQueue.fail(jobId, message);
  }
}

export async function notifyObjectCaptureJobQueued(jobId: string) {
  // Native reconstruction workers poll and atomically claim the MySQL row.
  // Retaining this compatibility hook avoids changing API callers.
  void jobId;
}
