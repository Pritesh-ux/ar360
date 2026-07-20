import { query } from "@/lib/db";
import { insertCaptureEvent } from "@/lib/object-capture/repository";
import { OBJECT_CAPTURE_STATUSES, type ObjectCaptureStatus } from "@/lib/object-capture/types";
import { notifyObjectCaptureJobQueued } from "@/lib/queue";
import { assertCaptureRetryAllowed } from "@/lib/object-capture/operations";
import {
  notifyCaptureProductCreated,
  notifyCaptureReviewChanged,
  notifyCaptureStatus,
} from "@/lib/object-capture/notifications";

export const CAPTURE_REVIEW_STATUSES = [
  "unreviewed", "in_review", "approved", "rejected", "recapture_requested",
] as const;
export const CAPTURE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type CaptureReviewStatus = (typeof CAPTURE_REVIEW_STATUSES)[number];
export type CapturePriority = (typeof CAPTURE_PRIORITIES)[number];

export type AdminCaptureJob = {
  id: string; customerUid: string; customerName: string; customerEmail: string | null;
  planId: string | null; subscriptionStatus: string | null; subscriptionEndsAt: string | null;
  productId: string | null; productTitle: string | null;
  status: ObjectCaptureStatus; reviewStatus: CaptureReviewStatus; assignedAdminId: number | null;
  assignedAdminName: string | null; priority: CapturePriority; reviewReason: string | null;
  progress: number; photoCount: number; processingStage: string | null; processingEngine: string | null;
  workerId: string | null; modelKey: string | null; thumbnailKey: string | null;
  errorMessage: string | null; processingLog: string | null; retryCount: number;
  qualityScore: number | null; coverageScore: number | null; blurCount: number | null;
  duplicateCount: number | null; exposureStatus: string | null; suggestions: unknown;
  createdAt: string; updatedAt: string; startedAt: string | null; completedAt: string | null;
};

type JobRow = {
  id: string; customer_uid: string; customer_name: string | null; customer_email: string | null;
  plan_id: string | null; subscription_status: string | null; subscription_ends_at: Date | string | null;
  product_id: string | null; product_title: string | null;
  status: ObjectCaptureStatus; review_status: CaptureReviewStatus; assigned_admin_id: number | null;
  assigned_admin_name: string | null; priority: CapturePriority; review_reason: string | null;
  progress: number; photo_count: number; processing_stage: string | null; processing_engine: string | null;
  worker_id: string | null; model_key: string | null; thumbnail_key: string | null;
  error_message: string | null; processing_log: string | null; retry_count: number;
  quality_score: number | null; coverage_score: number | null; blur_count: number | null;
  duplicate_count: number | null; exposure_status: string | null; suggestions: string | null;
  created_at: Date | string; updated_at: Date | string; started_at: Date | string | null;
  completed_at: Date | string | null;
};

const SELECT_JOB = `SELECT j.*, COALESCE(c.company_name,c.contact_name,c.email,j.customer_uid) customer_name,
 c.email customer_email, COALESCE(cs.plan_id,c.plan_id) plan_id, cs.status subscription_status,
 cs.current_period_end subscription_ends_at, p.title product_title, ma.name assigned_admin_name
 FROM object_capture_jobs j
 LEFT JOIN customers c ON c.customer_uid=j.customer_uid
 LEFT JOIN customer_subscriptions cs ON cs.customer_uid=j.customer_uid
 LEFT JOIN products p ON p.id=j.product_id AND p.customer_uid=j.customer_uid
 LEFT JOIN master_admins ma ON ma.id=j.assigned_admin_id`;

function iso(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}
function affectedRows(result: unknown) {
  return Number((result as { affectedRows?: number }).affectedRows || 0);
}
function mapJob(row: JobRow): AdminCaptureJob {
  let suggestions: unknown = row.suggestions;
  if (typeof suggestions === "string") {
    try { suggestions = JSON.parse(suggestions); } catch {}
  }
  return {
    id: row.id, customerUid: row.customer_uid, customerName: row.customer_name || row.customer_uid,
    customerEmail: row.customer_email, planId: row.plan_id, subscriptionStatus: row.subscription_status,
    subscriptionEndsAt: iso(row.subscription_ends_at), productId: row.product_id,
    productTitle: row.product_title, status: row.status, reviewStatus: row.review_status,
    assignedAdminId: row.assigned_admin_id, assignedAdminName: row.assigned_admin_name,
    priority: row.priority, reviewReason: row.review_reason, progress: Number(row.progress),
    photoCount: Number(row.photo_count), processingStage: row.processing_stage,
    processingEngine: row.processing_engine, workerId: row.worker_id, modelKey: row.model_key,
    thumbnailKey: row.thumbnail_key, errorMessage: row.error_message, processingLog: row.processing_log,
    retryCount: Number(row.retry_count), qualityScore: row.quality_score, coverageScore: row.coverage_score,
    blurCount: row.blur_count, duplicateCount: row.duplicate_count, exposureStatus: row.exposure_status,
    suggestions, createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!,
    startedAt: iso(row.started_at), completedAt: iso(row.completed_at),
  };
}

export type AdminCaptureFilters = {
  search?: string; status?: string; reviewStatus?: string; assignee?: string;
  priority?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number;
};

function whereFor(filters: AdminCaptureFilters) {
  const clauses: string[] = [];
  const values: Array<string | number> = [];
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim().slice(0, 100)}%`;
    clauses.push("(j.id LIKE ? OR j.customer_uid LIKE ? OR c.company_name LIKE ? OR c.contact_name LIKE ? OR c.email LIKE ? OR j.product_id LIKE ?)");
    values.push(term, term, term, term, term, term);
  }
  if (filters.status && (OBJECT_CAPTURE_STATUSES as readonly string[]).includes(filters.status)) {
    clauses.push("j.status=?"); values.push(filters.status);
  }
  if (filters.reviewStatus && (CAPTURE_REVIEW_STATUSES as readonly string[]).includes(filters.reviewStatus)) {
    clauses.push("j.review_status=?"); values.push(filters.reviewStatus);
  }
  if (filters.priority && (CAPTURE_PRIORITIES as readonly string[]).includes(filters.priority)) {
    clauses.push("j.priority=?"); values.push(filters.priority);
  }
  if (filters.assignee === "unassigned") clauses.push("j.assigned_admin_id IS NULL");
  else if (filters.assignee && /^\d+$/.test(filters.assignee)) {
    clauses.push("j.assigned_admin_id=?"); values.push(Number(filters.assignee));
  }
  if (filters.dateFrom) { clauses.push("j.created_at>=?"); values.push(`${filters.dateFrom} 00:00:00`); }
  if (filters.dateTo) { clauses.push("j.created_at<DATE_ADD(?,INTERVAL 1 DAY)"); values.push(`${filters.dateTo} 00:00:00`); }
  return { sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", values };
}

export async function listAdminCaptureJobs(filters: AdminCaptureFilters) {
  const page = Math.max(1, Math.floor(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(filters.pageSize || 20)));
  const where = whereFor(filters);
  const [count, rows, metrics, assignees] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*) total FROM object_capture_jobs j LEFT JOIN customers c ON c.customer_uid=j.customer_uid${where.sql}`, where.values),
    query<JobRow>(`${SELECT_JOB}${where.sql} ORDER BY FIELD(j.priority,'urgent','high','normal','low'), j.created_at ASC LIMIT ? OFFSET ?`, [...where.values, pageSize, (page - 1) * pageSize]),
    query<{ total: number; queued: number; processing: number; review: number; failed: number }>(
      `SELECT COUNT(*) total, SUM(status='queued') queued, SUM(status='processing') processing,
       SUM(status='completed' AND review_status IN ('unreviewed','in_review')) review, SUM(status='failed') failed
       FROM object_capture_jobs`),
    query<{ id: number; name: string }>("SELECT id,name FROM master_admins WHERE status='Active' ORDER BY name"),
  ]);
  const total = Number(count[0]?.total || 0);
  return {
    jobs: rows.map(mapJob),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    metrics: Object.fromEntries(Object.entries(metrics[0] || {}).map(([key, value]) => [key, Number(value || 0)])),
    assignees,
  };
}

export async function getAdminCaptureJob(id: string) {
  const rows = await query<JobRow>(`${SELECT_JOB} WHERE j.id=? LIMIT 1`, [id]);
  if (!rows[0]) return null;
  const job = mapJob(rows[0]);
  const [images, analysis, events, notes] = await Promise.all([
    query<Record<string, unknown>>("SELECT id,original_name,media_type,byte_size,width,height,quality_status,blur_score,brightness,duplicate_of,angle_label,created_at FROM object_capture_images WHERE job_id=? ORDER BY created_at", [id]),
    query<Record<string, unknown>>("SELECT image_id,blur_score,brightness,duplicate_score,angle,quality_score,remarks FROM object_capture_analysis WHERE job_id=? ORDER BY created_at", [id]),
    query<Record<string, unknown>>("SELECT id,event_type,from_status,to_status,message,actor_user_id,metadata,created_at FROM object_capture_events WHERE job_id=? ORDER BY created_at,id", [id]),
    query<Record<string, unknown>>(`SELECT n.id,n.body,n.created_at,n.admin_id,ma.name admin_name
      FROM object_capture_admin_notes n LEFT JOIN master_admins ma ON ma.id=n.admin_id
      WHERE n.job_id=? ORDER BY n.created_at DESC`, [id]),
  ]);
  return {
    job,
    images: images.map((image) => ({ ...image, assetUrl: `/api/master-admin/object-capture/jobs/${id}/assets/source-${image.id}` })),
    analysis, events, notes,
  };
}

export async function mutateAdminCaptureJob(
  id: string,
  action: string,
  input: { assignedAdminId?: number | null; priority?: CapturePriority; reviewStatus?: CaptureReviewStatus; reason: string; note?: string },
  adminId: number,
) {
  const before = await getAdminCaptureJob(id);
  if (!before) return null;
  const reason = input.reason.trim().slice(0, 500);
  if (!reason) throw new Error("A reason is required.");
  if (action === "assign") {
    await query("UPDATE object_capture_jobs SET assigned_admin_id=?,updated_at=NOW() WHERE id=?", [input.assignedAdminId ?? null, id]);
  } else if (action === "priority" && input.priority && CAPTURE_PRIORITIES.includes(input.priority)) {
    await query("UPDATE object_capture_jobs SET priority=?,updated_at=NOW() WHERE id=?", [input.priority, id]);
  } else if (action === "review" && input.reviewStatus && CAPTURE_REVIEW_STATUSES.includes(input.reviewStatus)) {
    await query(`UPDATE object_capture_jobs SET review_status=?,review_reason=?,reviewed_at=NOW(),
      reviewed_by_admin_id=?,updated_at=NOW() WHERE id=?`, [input.reviewStatus, reason, adminId, id]);
    await notifyCaptureReviewChanged({
      jobId: id,
      customerUid: before.job.customerUid,
      reviewStatus: input.reviewStatus,
      reason,
    });
  } else if (action === "note" && input.note?.trim()) {
    await query("INSERT INTO object_capture_admin_notes(job_id,admin_id,body) VALUES(?,?,?)", [id, adminId, input.note.trim().slice(0, 2000)]);
  } else if (action === "retry") {
    if (!["failed", "cancelled"].includes(before.job.status)) throw new Error("Only failed or cancelled jobs can be retried.");
    await assertCaptureRetryAllowed(before.job.customerUid, before.job.retryCount);
    const result = await query(`UPDATE object_capture_jobs SET status='queued',progress=25,retry_count=retry_count+1,
      error_message=NULL,locked_at=NULL,lease_token=NULL,lease_expires_at=NULL,heartbeat_at=NULL,
      cancel_requested_at=NULL,started_at=NULL,updated_at=NOW()
      WHERE id=? AND status=? AND retry_count=?`, [id, before.job.status, before.job.retryCount]);
    if (affectedRows(result) !== 1) throw new Error("Capture job changed before retry could be applied.");
    await notifyObjectCaptureJobQueued(id);
  } else if (action === "cancel") {
    if (before.job.status === "processing") {
      const result = await query(`UPDATE object_capture_jobs
        SET cancel_requested_at=NOW(),processing_stage='cancelling',updated_at=NOW()
        WHERE id=? AND status='processing' AND cancel_requested_at IS NULL`, [id]);
      if (affectedRows(result) !== 1) throw new Error("Capture job changed before cancellation could be requested.");
    } else if (!["completed", "cancelled"].includes(before.job.status)) {
      const result = await query(`UPDATE object_capture_jobs
        SET status='cancelled',progress=0,cancelled_at=NOW(),cancel_requested_at=NOW(),updated_at=NOW()
        WHERE id=? AND status=?`, [id, before.job.status]);
      if (affectedRows(result) !== 1) throw new Error("Capture job changed before cancellation could be applied.");
    } else throw new Error("This job cannot be cancelled.");
  } else if (action === "fail") {
    if (["completed", "cancelled"].includes(before.job.status)) throw new Error("This job cannot be failed.");
    const result = await query(`UPDATE object_capture_jobs
      SET status='failed',progress=0,error_message=?,processing_stage='admin_failed',
          lease_token=NULL,lease_expires_at=NULL,heartbeat_at=NULL,locked_at=NULL,updated_at=NOW()
      WHERE id=? AND status=?`, [reason, id, before.job.status]);
    if (affectedRows(result) !== 1) throw new Error("Capture job changed before failure could be applied.");
    await notifyCaptureStatus({
      jobId: id,
      customerUid: before.job.customerUid,
      status: "failed",
      error: reason,
    });
  } else if (action === "create_product") {
    if (before.job.status !== "completed" || !before.job.modelKey) throw new Error("A completed model is required.");
    const productId = before.job.productId || `oc_${id}`;
    await query(`INSERT INTO products(id,customer_uid,user_id,title,category,model_url,file_name,status,views,settings,material_settings,variants,hotspots)
      SELECT ?,j.customer_uid,j.user_id,?,'Object Capture',?,'model.glb','Draft',0,'{}','{}','[{"id":"default","name":"Default"}]','[]'
      FROM object_capture_jobs j WHERE j.id=?
      ON DUPLICATE KEY UPDATE updated_at=NOW()`, [productId, `Captured Product ${id.slice(0, 8)}`, `/api/object-capture/jobs/${id}/assets/model`, id]);
    await query("UPDATE object_capture_jobs SET product_id=?,updated_at=NOW() WHERE id=?", [productId, id]);
    await notifyCaptureProductCreated({
      jobId: id,
      customerUid: before.job.customerUid,
      productId,
    });
  } else {
    throw new Error("Unsupported action.");
  }
  await insertCaptureEvent({
    jobId: id, customerUid: before.job.customerUid, eventType: `admin_${action}`,
    message: `Admin action: ${action}. ${reason}`, metadata: { adminId, reason },
  });
  return { before, after: await getAdminCaptureJob(id) };
}
