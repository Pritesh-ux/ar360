import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db";
import { getJobPaths, getObjectCaptureStorageRoot } from "./workspace";

type CleanupJob = {
  id: string;
  customer_uid: string;
  status: string;
  source_expires_at: Date | string | null;
};

async function pathBytes(target: string): Promise<number> {
  try {
    const info = await stat(target);
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;
    const entries = await readdir(target, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => pathBytes(path.join(target, entry.name)))))
      .reduce((sum, size) => sum + size, 0);
  } catch {
    return 0;
  }
}

async function removeOwnedPath(target: string, customerUid: string, jobId: string) {
  const expected = getJobPaths(customerUid, jobId).base;
  const root = getObjectCaptureStorageRoot();
  const resolved = path.resolve(target);
  if (resolved !== expected && !resolved.startsWith(`${expected}${path.sep}`)) {
    throw new Error("Cleanup refused a path outside the owned capture workspace.");
  }
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error("Cleanup refused a path outside Object Capture storage.");
  }
  const bytes = await pathBytes(resolved);
  await rm(resolved, { recursive: true, force: true });
  return bytes;
}

export async function runObjectCaptureCleanup(workerId = "cleanup") {
  const partialHours = Math.max(1, Number(process.env.OC_PARTIAL_UPLOAD_RETENTION_HOURS || 24));
  const cancelledDays = Math.max(1, Number(process.env.OC_CANCELLED_RETENTION_DAYS || 7));
  const sourceDays = Math.max(1, Number(process.env.OC_SOURCE_RETENTION_DAYS || 30));
  const run = await query<{ insertId?: number }>(
    "INSERT INTO object_capture_cleanup_runs(worker_id) VALUES(?)",
    [workerId],
  );
  const runId = Number((run as unknown as { insertId?: number }).insertId || 0);
  const jobs = await query<CleanupJob>(
    `SELECT id,customer_uid,status,
       COALESCE(source_expires_at,TIMESTAMPADD(DAY,?,COALESCE(completed_at,updated_at))) source_expires_at
     FROM object_capture_jobs
     WHERE cleanup_completed_at IS NULL AND (
       (status IN ('pending','uploading') AND updated_at<TIMESTAMPADD(HOUR,-?,NOW()))
       OR (status='cancelled' AND updated_at<TIMESTAMPADD(DAY,-?,NOW()))
       OR (status='failed' AND updated_at<TIMESTAMPADD(DAY,-1,NOW()))
       OR (status IN ('completed','failed') AND
         COALESCE(source_expires_at,TIMESTAMPADD(DAY,?,COALESCE(completed_at,updated_at)))<NOW())
     ) ORDER BY updated_at ASC LIMIT 500`,
    [sourceDays, partialHours, cancelledDays, sourceDays],
  );
  let removedPaths = 0;
  let reclaimedBytes = 0;
  let errors = 0;
  for (const job of jobs) {
    try {
      const paths = getJobPaths(job.customer_uid, job.id);
      if (["pending", "uploading", "cancelled"].includes(job.status)) {
        reclaimedBytes += await removeOwnedPath(paths.base, job.customer_uid, job.id);
        removedPaths++;
        if (job.status === "pending" || job.status === "uploading") {
          await query(
            `UPDATE object_capture_jobs SET status='cancelled',cancelled_at=NOW(),
             error_message='Partial upload expired',updated_at=NOW()
             WHERE id=? AND customer_uid=? AND status IN ('pending','uploading')`,
            [job.id, job.customer_uid],
          );
        }
      } else if (job.status === "failed") {
        const sourceExpired = job.source_expires_at
          ? new Date(job.source_expires_at).getTime() <= Date.now()
          : false;
        for (const target of sourceExpired
          ? [paths.original, paths.processed, paths.textures, paths.output]
          : [paths.processed, paths.textures, paths.output]) {
          reclaimedBytes += await removeOwnedPath(target, job.customer_uid, job.id);
          removedPaths++;
        }
        if (!sourceExpired) continue;
      } else if (job.status === "completed") {
        reclaimedBytes += await removeOwnedPath(paths.original, job.customer_uid, job.id);
        removedPaths++;
        await query("DELETE FROM object_capture_images WHERE job_id=? AND customer_uid=?", [
          job.id,
          job.customer_uid,
        ]);
      }
      await query(
        `UPDATE object_capture_jobs SET cleanup_completed_at=NOW(),
         source_expires_at=COALESCE(source_expires_at,TIMESTAMPADD(DAY,?,completed_at))
         WHERE id=? AND customer_uid=?`,
        [sourceDays, job.id, job.customer_uid],
      );
    } catch {
      errors++;
    }
  }
  await query(
    `UPDATE object_capture_cleanup_runs SET completed_at=NOW(),scanned_jobs=?,
     removed_paths=?,reclaimed_bytes=?,errors=? WHERE id=?`,
    [jobs.length, removedPaths, reclaimedBytes, errors, runId],
  );
  return { runId, scannedJobs: jobs.length, removedPaths, reclaimedBytes, errors };
}
