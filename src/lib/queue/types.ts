export type JobQueueName = "object_capture" | (string & {});

export type JobStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface QueuedJob {
  id: string;
  queue: JobQueueName;
  payload: Record<string, unknown>;
  status: JobStatus;
  workerId?: string | null;
  attempts?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClaimJobOptions {
  queue: JobQueueName;
  workerId: string;
}

export interface JobQueue {
  claimNext(options: ClaimJobOptions): Promise<QueuedJob | null>;
  complete(jobId: string, result?: Record<string, unknown>): Promise<void>;
  fail(jobId: string, message: string): Promise<void>;
}

export type JobQueueBackend = "db" | "redis";

export function resolveJobQueueBackend(): JobQueueBackend {
  const raw = String(process.env.JOB_QUEUE_BACKEND || "db").toLowerCase();
  return raw === "redis" ? "redis" : "db";
}
