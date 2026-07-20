import type mysql from "mysql2/promise";
import { getPool, query } from "@/lib/db";
import type {
  ObjectCaptureEvent,
  ObjectCaptureImage,
  ObjectCaptureJob,
  ObjectCaptureStatus,
} from "./types";
import { assertObjectCaptureTransition } from "./workflow-policy";
import { assertCaptureRetryAllowed, reserveCaptureJob } from "./operations";
import { notifyCaptureStatus } from "./notifications";

export async function insertCaptureJob(customerUid: string, userId: number) {
  const id = await reserveCaptureJob(customerUid, userId);
  await insertCaptureEvent({
    jobId: id,
    customerUid,
    eventType: "job_created",
    toStatus: "pending",
    message: "Capture job created.",
    actorUserId: userId,
  });
  return getCaptureJobForCustomer(id, customerUid);
}

export async function getCaptureJobForCustomer(jobId: string, customerUid: string) {
  const rows = await query<ObjectCaptureJob>(
    "SELECT * FROM object_capture_jobs WHERE id=? AND customer_uid=? LIMIT 1",
    [jobId, customerUid],
  );
  return rows[0] || null;
}

export async function getCaptureJobForWorker(jobId: string) {
  const rows = await query<ObjectCaptureJob>(
    "SELECT * FROM object_capture_jobs WHERE id=? LIMIT 1",
    [jobId],
  );
  return rows[0] || null;
}

export type CaptureJobListOptions = {
  page?: number;
  pageSize?: number;
  status?: ObjectCaptureStatus | "";
  search?: string;
  from?: string;
  to?: string;
};

export async function listCaptureJobsForCustomer(
  customerUid: string,
  options: CaptureJobListOptions = {},
) {
  const page = Math.max(1, Math.floor(options.page || 1));
  const pageSize = Math.max(1, Math.min(50, Math.floor(options.pageSize || 10)));
  const clauses = ["customer_uid=?"];
  const values: Array<string | number> = [customerUid];
  if (options.status) {
    clauses.push("status=?");
    values.push(options.status);
  }
  if (options.search?.trim()) {
    clauses.push("(id LIKE ? OR product_id LIKE ? OR processing_stage LIKE ?)");
    const term = `%${options.search.trim().slice(0, 100)}%`;
    values.push(term, term, term);
  }
  if (options.from) {
    clauses.push("created_at >= ?");
    values.push(`${options.from} 00:00:00`);
  }
  if (options.to) {
    clauses.push("created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(`${options.to} 00:00:00`);
  }
  const where = clauses.join(" AND ");
  const totalRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM object_capture_jobs WHERE ${where}`,
    values,
  );
  const jobs = await query<ObjectCaptureJob>(
    `SELECT * FROM object_capture_jobs WHERE ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  const total = Number(totalRows[0]?.total || 0);
  return { jobs, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function transitionCaptureJob(
  jobId: string,
  customerUid: string,
  to: ObjectCaptureStatus,
  patch: Record<string, string | number | Date | null> = {},
) {
  const current = await getCaptureJobForCustomer(jobId, customerUid);
  if (!current) return null;
  assertObjectCaptureTransition(current.status, to);
  const allowed = new Set([
    "progress", "photo_count", "model_key", "model_url", "thumbnail_key", "thumbnail_url",
    "error_message", "processing_stage", "processing_engine", "worker_id", "locked_at",
    "started_at", "completed_at", "cancelled_at", "quality_score", "coverage_score",
    "blur_count", "duplicate_count", "exposure_status", "suggestions", "product_id",
    "retry_count", "cancel_requested_at", "lease_token", "lease_expires_at", "heartbeat_at",
    "override_requested_at", "override_requested_by", "override_reason",
  ]);
  const entries = Object.entries(patch).filter(([key]) => allowed.has(key));
  const assignments = ["status=?", ...entries.map(([key]) => `\`${key}\`=?`), "updated_at=NOW()"];
  const result = await query(
    `UPDATE object_capture_jobs SET ${assignments.join(", ")} WHERE id=? AND customer_uid=? AND status=?`,
    [to, ...entries.map(([, value]) => value), jobId, customerUid, current.status],
  );
  const changed = Number((result as unknown as { affectedRows?: number }).affectedRows || 0);
  if (!changed) {
    throw new Error("Object Capture job changed while this action was being applied. Refresh and try again.");
  }
  await insertCaptureEvent({
    jobId,
    customerUid,
    eventType: "status_changed",
    fromStatus: current.status,
    toStatus: to,
    message: `Job moved from ${current.status} to ${to}.`,
  });
  await notifyCaptureStatus({
    jobId,
    customerUid,
    userId: current.user_id,
    status: to,
    error: typeof patch.error_message === "string" ? patch.error_message : null,
  }).catch(() => undefined);
  return getCaptureJobForCustomer(jobId, customerUid);
}

export async function insertCaptureEvent(input: {
  jobId: string;
  customerUid: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  message: string;
  actorUserId?: number | null;
  metadata?: Record<string, unknown> | null;
}) {
  await query(
    `INSERT INTO object_capture_events
     (job_id, customer_uid, event_type, from_status, to_status, message, actor_user_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.jobId, input.customerUid, input.eventType, input.fromStatus || null,
      input.toStatus || null, input.message.slice(0, 500), input.actorUserId || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
}

export async function listCaptureEvents(jobId: string, customerUid: string) {
  return query<ObjectCaptureEvent>(
    `SELECT * FROM object_capture_events
     WHERE job_id=? AND customer_uid=? ORDER BY created_at ASC, id ASC`,
    [jobId, customerUid],
  );
}

export async function insertCaptureImage(image: ObjectCaptureImage) {
  await query(
    `INSERT INTO object_capture_images
       (id, job_id, customer_uid, storage_key, original_name, media_type, byte_size, width, height, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      image.id, image.job_id, image.customer_uid, image.storage_key, image.original_name,
      image.media_type, image.byte_size, image.width, image.height,
    ],
  );
}

export async function reserveCaptureUpload(jobId: string, customerUid: string) {
  const result = await query(
    `UPDATE object_capture_jobs
     SET status='uploading', progress=10, updated_at=NOW()
     WHERE id=? AND customer_uid=? AND status='pending' AND photo_count=0`,
    [jobId, customerUid],
  );
  const reserved = Number((result as unknown as { affectedRows?: number }).affectedRows || 0) === 1;
  if (reserved) {
    await insertCaptureEvent({
      jobId,
      customerUid,
      eventType: "upload_started",
      fromStatus: "pending",
      toStatus: "uploading",
      message: "Photo upload reserved.",
    });
  }
  return reserved;
}

export async function listCaptureImages(jobId: string, customerUid: string) {
  return query<ObjectCaptureImage>(
    "SELECT * FROM object_capture_images WHERE job_id=? AND customer_uid=? ORDER BY created_at ASC",
    [jobId, customerUid],
  );
}

export async function updateCaptureJobForWorker(
  jobId: string,
  values: Record<string, string | number | Date | null>,
) {
  const allowed = new Set([
    "status", "progress", "processing_stage", "processing_engine", "worker_id", "locked_at",
    "started_at", "completed_at", "model_key", "model_url", "thumbnail_key", "thumbnail_url",
    "error_message", "lease_token", "lease_expires_at", "heartbeat_at", "cancel_requested_at",
    "source_expires_at", "cleanup_completed_at", "compute_seconds", "output_bytes",
  ]);
  const entries = Object.entries(values).filter(([key]) => allowed.has(key));
  if (!entries.length) return;
  await query(
    `UPDATE object_capture_jobs SET ${entries.map(([key]) => `\`${key}\`=?`).join(", ")}, updated_at=NOW() WHERE id=?`,
    [...entries.map(([, value]) => value), jobId],
  );
}

export type CaptureJobLease = ObjectCaptureJob & { lease_token: string };

export async function recoverStaleCaptureJobs() {
  const result = await query<{ affectedRows: number }>(
    `UPDATE object_capture_jobs
     SET status=IF(cancel_requested_at IS NULL, 'queued', 'cancelled'),
         processing_stage=IF(cancel_requested_at IS NULL, 'recovered', 'cancelled'),
         worker_id=NULL, lease_token=NULL, locked_at=NULL, lease_expires_at=NULL,
         heartbeat_at=NULL, cancelled_at=IF(cancel_requested_at IS NULL, cancelled_at, NOW()),
         updated_at=NOW()
     WHERE status='processing' AND (
       lease_expires_at < NOW()
       OR (lease_expires_at IS NULL AND locked_at < TIMESTAMPADD(MINUTE, -5, NOW()))
     )`,
  );
  return Number((result as unknown as { affectedRows?: number }).affectedRows || 0);
}

export async function claimNextCaptureJob(workerId: string, leaseSeconds = 90) {
  const pool = await getPool();
  const connection = await pool.getConnection();
  const leaseToken = crypto.randomUUID();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE object_capture_jobs
       SET status=IF(cancel_requested_at IS NULL, 'queued', 'cancelled'),
           processing_stage=IF(cancel_requested_at IS NULL, 'recovered', 'cancelled'),
           worker_id=NULL, lease_token=NULL, locked_at=NULL, lease_expires_at=NULL,
           heartbeat_at=NULL, cancelled_at=IF(cancel_requested_at IS NULL, cancelled_at, NOW()),
           updated_at=NOW()
       WHERE status='processing' AND (
         lease_expires_at < NOW()
         OR (lease_expires_at IS NULL AND locked_at < TIMESTAMPADD(MINUTE, -5, NOW()))
       )`,
    );
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM object_capture_jobs
       WHERE status='queued' AND cancel_requested_at IS NULL
       ORDER BY FIELD(priority,'urgent','high','normal','low'), created_at ASC
       LIMIT 1 FOR UPDATE`,
    );
    const job = rows[0] as ObjectCaptureJob | undefined;
    if (!job) {
      await connection.commit();
      return null;
    }
    await connection.execute(
      `UPDATE object_capture_jobs SET status='processing', progress=30,
       processing_engine='colmap-openmvs-blender', processing_stage='claimed',
       worker_id=?, lease_token=?, locked_at=NOW(), heartbeat_at=NOW(),
       lease_expires_at=TIMESTAMPADD(SECOND, ?, NOW()), attempt=attempt+1,
       started_at=COALESCE(started_at, NOW()), error_message=NULL, updated_at=NOW()
       WHERE id=? AND status='queued'`,
      [workerId, leaseToken, leaseSeconds, job.id],
    );
    await connection.commit();
    await insertCaptureEvent({
      jobId: job.id,
      customerUid: job.customer_uid,
      eventType: "processing_started",
      fromStatus: "queued",
      toStatus: "processing",
      message: `Worker ${workerId} claimed the job.`,
    });
    return (await getCaptureJobForWorker(job.id)) as CaptureJobLease;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function heartbeatCaptureJob(
  jobId: string,
  leaseToken: string,
  leaseSeconds: number,
  patch: { stage?: string; progress?: number; log?: string } = {},
) {
  const entries: string[] = [
    "heartbeat_at=NOW()",
    "lease_expires_at=TIMESTAMPADD(SECOND, ?, NOW())",
    "locked_at=NOW()",
  ];
  const values: Array<string | number> = [leaseSeconds];
  if (patch.stage) {
    entries.push("processing_stage=?");
    values.push(patch.stage);
  }
  if (patch.progress !== undefined) {
    entries.push("progress=?");
    values.push(Math.max(0, Math.min(99, Math.round(patch.progress))));
  }
  if (patch.log) {
    entries.push("processing_log=RIGHT(CONCAT(COALESCE(processing_log, ''), ?), 65535)");
    values.push(`\n[${new Date().toISOString()}] ${patch.log.slice(0, 4000)}`);
  }
  const result = await query(
    `UPDATE object_capture_jobs SET ${entries.join(", ")}, updated_at=NOW()
     WHERE id=? AND lease_token=? AND status='processing'`,
    [...values, jobId, leaseToken],
  );
  return Number((result as unknown as { affectedRows?: number }).affectedRows || 0) === 1;
}

export async function heartbeatCaptureWorker(workerId: string, currentJobId: string | null) {
  await query(
    `INSERT INTO object_capture_workers (worker_id,heartbeat_at,current_job_id,version,metadata)
     VALUES (?,NOW(),?,?,?)
     ON DUPLICATE KEY UPDATE heartbeat_at=NOW(),current_job_id=VALUES(current_job_id),
       version=VALUES(version),metadata=VALUES(metadata)`,
    [
      workerId,
      currentJobId,
      process.env.npm_package_version || null,
      JSON.stringify({ hostname: process.env.COMPUTERNAME || process.env.HOSTNAME || null }),
    ],
  );
}

export async function isCaptureJobCancellationRequested(jobId: string, leaseToken: string) {
  const rows = await query<{ cancel_requested_at: Date | null; status: ObjectCaptureStatus }>(
    "SELECT cancel_requested_at, status FROM object_capture_jobs WHERE id=? AND lease_token=? LIMIT 1",
    [jobId, leaseToken],
  );
  return !rows[0] || rows[0].status !== "processing" || Boolean(rows[0].cancel_requested_at);
}

export async function requestCaptureJobCancellation(jobId: string, customerUid: string) {
  const job = await getCaptureJobForCustomer(jobId, customerUid);
  if (!job) return null;
  if (job.status === "processing") {
    const result = await query(
      `UPDATE object_capture_jobs SET cancel_requested_at=NOW(),
       processing_stage='cancelling', updated_at=NOW()
       WHERE id=? AND customer_uid=? AND status='processing' AND cancel_requested_at IS NULL`,
      [jobId, customerUid],
    );
    if (Number((result as unknown as { affectedRows?: number }).affectedRows || 0) !== 1) {
      throw new Error("Object Capture job changed while cancellation was being requested. Refresh and try again.");
    }
    return getCaptureJobForCustomer(jobId, customerUid);
  }
  return transitionCaptureJob(jobId, customerUid, "cancelled", {
    progress: 0,
    cancelled_at: new Date(),
    cancel_requested_at: new Date(),
  });
}

export async function finishCaptureJob(
  jobId: string,
  leaseToken: string,
  outcome:
    | { status: "completed"; modelKey: string; modelUrl: string }
    | { status: "failed"; error: string }
    | { status: "cancelled" },
) {
  const current = await getCaptureJobForWorker(jobId);
  const values =
    outcome.status === "completed"
      ? {
          status: "completed", progress: 100, processing_stage: "completed",
          model_key: outcome.modelKey, model_url: outcome.modelUrl,
          completed_at: new Date(), error_message: null,
          source_expires_at: new Date(
            Date.now() + Math.max(1, Number(process.env.OC_SOURCE_RETENTION_DAYS || 30)) * 86_400_000,
          ),
        }
      : outcome.status === "failed"
        ? {
            status: "failed", progress: 0, processing_stage: "failed",
            error_message: outcome.error.slice(0, 1000),
          }
        : {
            status: "cancelled", progress: 0, processing_stage: "cancelled",
            cancelled_at: new Date(), error_message: null,
          };
  const entries = Object.entries(values);
  const completionGuard = outcome.status === "completed" ? " AND cancel_requested_at IS NULL" : "";
  const result = await query(
    `UPDATE object_capture_jobs SET
       ${entries.map(([key]) => `\`${key}\`=?`).join(", ")},
       lease_token=NULL, lease_expires_at=NULL, heartbeat_at=NULL, locked_at=NULL, updated_at=NOW()
     WHERE id=? AND lease_token=? AND status='processing'${completionGuard}`,
    [...entries.map(([, value]) => value), jobId, leaseToken],
  );
  const finished = Number((result as unknown as { affectedRows?: number }).affectedRows || 0) === 1;
  if (finished && current) {
    await insertCaptureEvent({
      jobId,
      customerUid: current.customer_uid,
      eventType: `processing_${outcome.status}`,
      fromStatus: "processing",
      toStatus: outcome.status,
      message: outcome.status === "failed" ? outcome.error : `Processing ${outcome.status}.`,
    });
    await notifyCaptureStatus({
      jobId,
      customerUid: current.customer_uid,
      userId: current.user_id,
      status: outcome.status,
      error: outcome.status === "failed" ? outcome.error : null,
    }).catch(() => undefined);
  }
  return finished;
}

export async function assertCaptureJobRetryAllowed(job: ObjectCaptureJob) {
  await assertCaptureRetryAllowed(job.customer_uid, job.retry_count);
}
