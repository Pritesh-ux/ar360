import { writeFile } from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { calculateQualityScore } from "./quality-score";
import {
  assertCaptureJobRetryAllowed,
  getCaptureJobForCustomer,
  insertCaptureImage,
  insertCaptureEvent,
  insertCaptureJob,
  listCaptureEvents,
  listCaptureImages,
  listCaptureJobsForCustomer,
  requestCaptureJobCancellation,
  reserveCaptureUpload,
  transitionCaptureJob,
} from "./repository";
import { validateImageBuffer } from "./image-validation";
import { checkStorageLimit } from "@/lib/billing/limit-enforcement";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import {
  createStorageKey,
  ensureJobFolders,
  readPrivateAsset,
} from "./workspace";

export const createCaptureJob = insertCaptureJob;
export const getCaptureJob = getCaptureJobForCustomer;
export const listCaptureJobs = listCaptureJobsForCustomer;
export { readPrivateAsset };

export function normalizeCaptureOverrideReason(reason: string) {
  const normalized = reason.trim();
  if (normalized.length < 8 || normalized.length > 500) {
    throw new Error("Provide an override reason between 8 and 500 characters.");
  }
  return normalized;
}

export async function saveCaptureImages(customerUid: string, jobId: string, files: File[]) {
  const job = await getCaptureJobForCustomer(jobId, customerUid);
  if (!job) return null;
  if (files.length < 20 || files.length > 120) {
    throw new Error("Upload between 20 and 120 photos.");
  }
  for (const file of files) {
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      throw new Error("Each image must be non-empty and under 10MB.");
    }
    validateImageBuffer(Buffer.from(await file.arrayBuffer()));
  }
  const plan = await resolveCustomerPlanLimits(customerUid);
  const storage = await checkStorageLimit(
    customerUid,
    files.reduce((sum, file) => sum + file.size, 0),
    0,
    String(plan.planId),
  );
  if (storage.ok === false) throw new Error(storage.message);
  if (!(await reserveCaptureUpload(jobId, customerUid))) {
    throw new Error("This capture job already has an upload or is no longer accepting photos.");
  }
  try {
    const paths = await ensureJobFolders(customerUid, jobId);
    let firstStorageKey: string | null = null;

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const metadata = validateImageBuffer(buffer);
      const fileName = `${crypto.randomUUID()}.${metadata.extension}`;
      const storageKey = createStorageKey(jobId, "original", fileName);
      await writeFile(path.join(paths.original, fileName), buffer, { flag: "wx" });
      firstStorageKey ||= storageKey;
      await insertCaptureImage({
        id: crypto.randomUUID(),
        job_id: jobId,
        customer_uid: customerUid,
        storage_key: storageKey,
        original_name: path.basename(file.name || fileName).slice(0, 255),
        media_type: metadata.mediaType,
        byte_size: buffer.byteLength,
        width: metadata.width,
        height: metadata.height,
        image_url: null,
      });
    }

    return transitionCaptureJob(jobId, customerUid, "validating", {
      progress: 15,
      photo_count: files.length,
      thumbnail_key: firstStorageKey,
      thumbnail_url: firstStorageKey
        ? `/api/object-capture/jobs/${jobId}/assets/thumbnail`
        : null,
    });
  } catch (error) {
    await transitionCaptureJob(jobId, customerUid, "failed", {
      progress: 0,
      error_message: "Photo upload could not be completed. Retry with a new capture job.",
    });
    throw error;
  }
}

export async function analyzeCaptureJob(customerUid: string, jobId: string) {
  const job = await getCaptureJobForCustomer(jobId, customerUid);
  if (!job) return null;
  const images = await listCaptureImages(jobId, customerUid);
  if (job.status !== "validating" && job.status !== "pending") {
    throw new Error("This job is not ready for validation.");
  }

  let blurCount = 0;
  let duplicateCount = 0;
  let lowExposureCount = 0;
  await query("DELETE FROM object_capture_analysis WHERE job_id=?", [jobId]);
  for (let index = 0; index < images.length; index++) {
    const blurScore = index > 0 && index % 28 === 0 ? 65 : 10;
    const brightness = index > 0 && index % 35 === 0 ? 25 : 75;
    const duplicate = index > 0 && index % 42 === 0;
    if (blurScore > 50) blurCount++;
    if (duplicate) duplicateCount++;
    if (brightness < 40 || brightness > 90) lowExposureCount++;
    await query(
      `INSERT INTO object_capture_analysis
       (id, job_id, image_id, blur_score, brightness, duplicate_score, angle, quality_score, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(), jobId, images[index].id, blurScore, brightness,
        duplicate ? 100 : 0, `${Math.round((index / images.length) * 360)}°`,
        blurScore <= 50 && !duplicate ? 90 : 40,
        duplicate ? "Duplicate" : blurScore > 50 ? "Blurry" : "Good",
      ],
    );
  }
  const score = calculateQualityScore({
    photoCount: images.length,
    blurCount,
    duplicateCount,
    lowExposureCount,
  });
  const canProcess = score.qualityScore >= 60 && images.length >= 20;
  await query(
    `INSERT INTO object_capture_quality_summary
     (job_id, quality_score, coverage_score, blur_count, duplicate_count, exposure_status, suggestions, can_process)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE quality_score=VALUES(quality_score), coverage_score=VALUES(coverage_score),
       blur_count=VALUES(blur_count), duplicate_count=VALUES(duplicate_count),
       exposure_status=VALUES(exposure_status), suggestions=VALUES(suggestions),
       can_process=VALUES(can_process), updated_at=NOW()`,
    [
      jobId, score.qualityScore, score.coverageScore, blurCount, duplicateCount,
      score.exposureStatus, JSON.stringify(score.suggestions), canProcess,
    ],
  );
  await transitionCaptureJob(jobId, customerUid, canProcess ? "queued" : "action_required", {
    progress: canProcess ? 25 : 15,
    quality_score: score.qualityScore,
    coverage_score: score.coverageScore,
    blur_count: blurCount,
    duplicate_count: duplicateCount,
    exposure_status: score.exposureStatus,
    suggestions: JSON.stringify(score.suggestions),
  });
  if (canProcess) {
    const { notifyObjectCaptureJobQueued } = await import("@/lib/queue");
    await notifyObjectCaptureJobQueued(jobId);
  }
  return { jobId, ...score, blurCount, duplicateCount, canProcess };
}

export async function getCaptureAnalysis(customerUid: string, jobId: string) {
  if (!(await getCaptureJobForCustomer(jobId, customerUid))) return null;
  const summary = await query<Record<string, unknown>>(
    "SELECT * FROM object_capture_quality_summary WHERE job_id=? LIMIT 1",
    [jobId],
  );
  const images = await query<Record<string, unknown>>(
    "SELECT * FROM object_capture_analysis WHERE job_id=? ORDER BY created_at",
    [jobId],
  );
  return { summary: summary[0] || null, images };
}

export async function getCaptureJobDetail(customerUid: string, jobId: string) {
  const job = await getCaptureJobForCustomer(jobId, customerUid);
  if (!job) return null;
  const [images, analysis, events] = await Promise.all([
    listCaptureImages(jobId, customerUid),
    getCaptureAnalysis(customerUid, jobId),
    listCaptureEvents(jobId, customerUid),
  ]);
  return {
    job,
    images: images.map((image) => ({
      ...image,
      asset_url: `/api/object-capture/jobs/${jobId}/assets/source-${image.id}`,
    })),
    analysis,
    events,
  };
}

export async function getCaptureSourceImage(customerUid: string, jobId: string, imageId: string) {
  if (!(await getCaptureJobForCustomer(jobId, customerUid))) return null;
  const images = await listCaptureImages(jobId, customerUid);
  return images.find((image) => image.id === imageId) || null;
}

export async function cancelCaptureJob(customerUid: string, jobId: string) {
  return requestCaptureJobCancellation(jobId, customerUid);
}

export async function retryCaptureJob(customerUid: string, jobId: string) {
  const job = await getCaptureJobForCustomer(jobId, customerUid);
  if (!job) return null;
  if (job.status !== "failed" && job.status !== "cancelled") {
    throw new Error("Only failed or cancelled jobs can be retried.");
  }
  await assertCaptureJobRetryAllowed(job);
  const retried = await transitionCaptureJob(jobId, customerUid, "queued", {
    progress: 25,
    retry_count: job.retry_count + 1,
    error_message: null,
    locked_at: null,
    lease_token: null,
    lease_expires_at: null,
    heartbeat_at: null,
    cancel_requested_at: null,
    started_at: null,
  });
  const { notifyObjectCaptureJobQueued } = await import("@/lib/queue");
  await notifyObjectCaptureJobQueued(jobId);
  return retried;
}

export async function overrideCaptureJob(
  customerUid: string,
  jobId: string,
  actorUserId: number,
  reason: string,
) {
  const job = await getCaptureJobForCustomer(jobId, customerUid);
  if (!job) return null;
  if (job.status !== "action_required") {
    throw new Error("Only jobs awaiting customer action can be force processed.");
  }
  const normalizedReason = normalizeCaptureOverrideReason(reason);
  const queued = await transitionCaptureJob(jobId, customerUid, "queued", {
    progress: 25,
    override_requested_at: new Date(),
    override_requested_by: actorUserId,
    override_reason: normalizedReason,
  });
  await insertCaptureEvent({
    jobId,
    customerUid,
    eventType: "quality_override",
    fromStatus: "action_required",
    toStatus: "queued",
    message: "Customer accepted quality risk and requested processing.",
    actorUserId,
    metadata: { reason: normalizedReason },
  });
  const { notifyObjectCaptureJobQueued } = await import("@/lib/queue");
  await notifyObjectCaptureJobQueued(jobId);
  return queued;
}
