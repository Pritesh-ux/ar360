export type CaptureJobStatus =
  | "pending"
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

export type CaptureJob = {
  id: string;
  status: CaptureJobStatus;
  progress: number;
  photoCount: number;
  modelUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  processingStartedAt?: number;
};

export type CaptureImage = {
  id: string;
  jobId: string;
  imageUrl: string;
  qualityStatus: string;
  createdAt: string;
};

const globalForCapture = globalThis as typeof globalThis & {
  objectCaptureJobs?: Map<string, CaptureJob>;
  objectCaptureImages?: CaptureImage[];
};

export const captureJobs =
  globalForCapture.objectCaptureJobs ?? new Map<string, CaptureJob>();

export const captureImages = globalForCapture.objectCaptureImages ?? [];

globalForCapture.objectCaptureJobs = captureJobs;
globalForCapture.objectCaptureImages = captureImages;

export function getUpdatedJob(job: CaptureJob) {
  if (job.status !== "processing" || !job.processingStartedAt) return job;

  const elapsed = Date.now() - job.processingStartedAt;
  const nextProgress = Math.min(95, 35 + Math.floor(elapsed / 120));

  if (elapsed > 8000) {
    job.status = "completed";
    job.progress = 100;
    job.modelUrl = "/models/object-capture-placeholder.glb";
    job.updatedAt = new Date().toISOString();
    return job;
  }

  job.progress = nextProgress;
  job.updatedAt = new Date().toISOString();
  return job;
}