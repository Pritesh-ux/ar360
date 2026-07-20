import { getPool, query } from "@/lib/db";
import { assertCan } from "@/lib/billing/permissions";
import { resolveCustomerPlanLimits, resolvePlanLimits } from "@/lib/billing/resolve-plan-limits";
import type { PlanLimits } from "@/lib/billing/plan-enforcement";

export type CaptureLimits = {
  capturesPerMonth: number;
  computeSecondsPerMonth: number;
  concurrentJobs: number;
  maxRetries: number;
};

/** Safe defaults only when DB columns are null (not plan-name switches). */
const FALLBACK_LIMITS: CaptureLimits = {
  capturesPerMonth: 5,
  computeSecondsPerMonth: 36_000,
  concurrentJobs: 1,
  maxRetries: 2,
};

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function optionalPositive(value: number | null | undefined, fallback: number) {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) < 0) return fallback;
  return Math.floor(Number(value));
}

/** Build OC limits from DB-backed PlanLimits (+ optional global env override). */
export function captureLimitsFromPlan(plan: PlanLimits): CaptureLimits {
  return {
    capturesPerMonth: positiveInt(
      process.env.OC_CAPTURES_PER_MONTH,
      optionalPositive(plan.ocCapturesPerMonth, FALLBACK_LIMITS.capturesPerMonth),
    ),
    computeSecondsPerMonth: positiveInt(
      process.env.OC_COMPUTE_SECONDS_PER_MONTH,
      optionalPositive(plan.ocComputeSecondsPerMonth, FALLBACK_LIMITS.computeSecondsPerMonth),
    ),
    concurrentJobs: positiveInt(
      process.env.OC_CONCURRENT_JOBS,
      optionalPositive(plan.ocConcurrentJobs, FALLBACK_LIMITS.concurrentJobs),
    ),
    maxRetries: positiveInt(
      process.env.OC_MAX_RETRIES,
      optionalPositive(plan.ocMaxRetries, FALLBACK_LIMITS.maxRetries),
    ),
  };
}

/** @deprecated Prefer captureLimitsFromPlan / resolveCaptureLimitsForCustomer — kept for sync test helpers. */
export function resolveCaptureLimits(planId: string): CaptureLimits {
  void planId;
  return { ...FALLBACK_LIMITS };
}

export async function resolveCaptureLimitsForCustomer(customerUid: string): Promise<CaptureLimits> {
  const plan = await resolveCustomerPlanLimits(customerUid);
  return captureLimitsFromPlan(plan);
}

export async function resolveCaptureLimitsForPlanId(planId: string): Promise<CaptureLimits> {
  const plan = await resolvePlanLimits(planId);
  return captureLimitsFromPlan(plan);
}

export async function getCaptureUsage(customerUid: string) {
  const rows = await query<{ captures: number; computeSeconds: number }>(
    `SELECT
       COALESCE(SUM(usage_type='capture' AND quantity),0) captures,
       COALESCE(SUM(IF(usage_type='compute_seconds',quantity,0)),0) computeSeconds
     FROM object_capture_usage
     WHERE customer_uid=? AND period_start=DATE_FORMAT(CURDATE(),'%Y-%m-01')`,
    [customerUid],
  ).catch(() => [{ captures: 0, computeSeconds: 0 }]);
  return {
    captures: Number(rows[0]?.captures || 0),
    computeSeconds: Number(rows[0]?.computeSeconds || 0),
  };
}

export async function reserveCaptureJob(customerUid: string, userId: number) {
  const permission = await assertCan(customerUid, "object_capture");
  if (permission.allowed === false) throw new Error(permission.message);
  if (permission.context.limits.allowObjectCapture === false) {
    throw new Error("Object Capture is not included in your current plan.");
  }
  const limits = captureLimitsFromPlan(permission.context.limits);
  const pool = await getPool();
  const connection = await pool.getConnection();
  const id = crypto.randomUUID();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT customer_uid FROM customers WHERE customer_uid=? FOR UPDATE", [customerUid]);
    const [activeRows] = await connection.execute(
      `SELECT COUNT(*) total FROM object_capture_jobs
       WHERE customer_uid=? AND status IN ('pending','uploading','validating','action_required','queued','processing')`,
      [customerUid],
    ) as unknown as [{ total: number }[], unknown];
    const [usageRows] = await connection.execute(
      `SELECT COUNT(*) total FROM object_capture_jobs
       WHERE customer_uid=? AND created_at>=DATE_FORMAT(CURDATE(),'%Y-%m-01')`,
      [customerUid],
    ) as unknown as [{ total: number }[], unknown];
    const [computeRows] = await connection.execute(
      `SELECT COALESCE(SUM(quantity),0) total FROM object_capture_usage
       WHERE customer_uid=? AND usage_type='compute_seconds'
         AND period_start=DATE_FORMAT(CURDATE(),'%Y-%m-01')`,
      [customerUid],
    ) as unknown as [{ total: number }[], unknown];
    if (Number(activeRows[0]?.total || 0) >= limits.concurrentJobs) {
      throw new Error(`Your plan allows ${limits.concurrentJobs} concurrent Object Capture job(s).`);
    }
    if (Number(usageRows[0]?.total || 0) >= limits.capturesPerMonth) {
      throw new Error(`Your monthly Object Capture limit of ${limits.capturesPerMonth} has been reached.`);
    }
    if (Number(computeRows[0]?.total || 0) >= limits.computeSecondsPerMonth) {
      throw new Error("Your monthly Object Capture compute allowance has been reached.");
    }
    await connection.execute(
      `INSERT INTO object_capture_jobs (id,customer_uid,user_id,status,progress,photo_count)
       VALUES (?,?,?,'pending',0,0)`,
      [id, customerUid, userId],
    );
    await connection.execute(
      `INSERT IGNORE INTO object_capture_usage
       (customer_uid,job_id,usage_type,quantity,period_start)
       VALUES (?,?,'capture',1,DATE_FORMAT(CURDATE(),'%Y-%m-01'))`,
      [customerUid, id],
    );
    await connection.commit();
    return id;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function assertCaptureRetryAllowed(customerUid: string, retryCount: number) {
  const limits = await resolveCaptureLimitsForCustomer(customerUid);
  if (retryCount >= limits.maxRetries) {
    throw new Error(`This plan allows at most ${limits.maxRetries} capture retries.`);
  }
}

export async function recordCaptureCompute(
  jobId: string,
  customerUid: string,
  seconds: number,
  outputBytes = 0,
) {
  const quantity = Math.max(0, Math.ceil(seconds));
  await query(
    `INSERT INTO object_capture_usage (customer_uid,job_id,usage_type,quantity,period_start)
     VALUES (?,?,'compute_seconds',?,DATE_FORMAT(CURDATE(),'%Y-%m-01'))
     ON DUPLICATE KEY UPDATE quantity=GREATEST(quantity,VALUES(quantity))`,
    [customerUid, jobId, quantity],
  );
  await query(
    "UPDATE object_capture_jobs SET compute_seconds=?,output_bytes=GREATEST(output_bytes,?) WHERE id=?",
    [quantity, Math.max(0, Math.floor(outputBytes)), jobId],
  );
}
