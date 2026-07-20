import type { ClaimJobOptions, JobQueue, JobQueueName, QueuedJob } from "./types";

const OBJECT_CAPTURE_QUEUE: JobQueueName = "object_capture";

/** DB-backed queue for object-capture jobs (status column on object_capture_jobs). */
export class DbObjectCaptureJobQueue implements JobQueue {
  async claimNext(options: ClaimJobOptions): Promise<QueuedJob | null> {
    if (options.queue !== OBJECT_CAPTURE_QUEUE) return null;
    throw new Error("Object Capture jobs must be claimed by the native lease worker.");
  }

  async complete(jobId: string, result: Record<string, unknown>): Promise<void> {
    void jobId;
    void result;
    throw new Error("Object Capture completion requires a valid native worker lease.");
  }

  async fail(jobId: string, message: string): Promise<void> {
    void jobId;
    void message;
    throw new Error("Object Capture failure updates require a valid native worker lease.");
  }
}

export { OBJECT_CAPTURE_QUEUE as OBJECT_CAPTURE_QUEUE_NAME };
