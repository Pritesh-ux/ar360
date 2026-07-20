import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { pingRedis } from "@/lib/queue/redis-client";
import { resolveJobQueueBackend } from "@/lib/queue/types";
import { getMissingRequiredEnv, isAuthSecretStrong } from "@/lib/production/env";
import { getStorageAdapter, ensureActiveStorageRoot } from "@/lib/storage/adapter";
import { verifyS3BucketAccess } from "@/lib/storage/s3-config";
import { getLiveBillingReadiness } from "@/lib/billing/production-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const missing = getMissingRequiredEnv();
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, status: "missing_env", missing, checks, timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }

  try {
    await query("SELECT 1 AS ok");
    checks.database = { ok: true };
  } catch (error) {
    checks.database = {
      ok: false,
      detail: error instanceof Error ? error.message : "DB error",
    };
  }

  try {
    const adapter = await getStorageAdapter();
    if (adapter.backend === "s3") {
      const s3 = await verifyS3BucketAccess();
      checks.storage = s3;
    } else {
      const root = await ensureActiveStorageRoot();
      checks.storage = { ok: Boolean(root), detail: root || "local storage root unavailable" };
    }
  } catch (error) {
    checks.storage = {
      ok: false,
      detail: error instanceof Error ? error.message : "Storage unavailable",
    };
  }

  if (process.env.REDIS_URL?.trim()) {
    const redisOk = await pingRedis();
    checks.redis = { ok: redisOk, detail: redisOk ? "connected" : "unreachable" };
  }

  if (resolveJobQueueBackend() === "redis") {
    checks.jobQueue = {
      ok: checks.redis?.ok === true,
      detail: checks.redis?.ok ? "redis" : "JOB_QUEUE_BACKEND=redis but REDIS_URL unreachable",
    };
  } else {
    checks.jobQueue = { ok: true, detail: "db" };
  }

  checks.authSecret = {
    ok: process.env.NODE_ENV !== "production" || isAuthSecretStrong(),
    detail: isAuthSecretStrong() ? "strong" : "weak-or-default",
  };

  const billing = await getLiveBillingReadiness().catch((error) => ({
    required: true,
    ok: false,
    checks: {
      billing: {
        ok: false,
        detail: error instanceof Error ? error.message : "billing readiness failed",
      },
    },
  }));
  checks.billing = {
    ok: billing.ok,
    detail: billing.required
      ? Object.entries(billing.checks)
          .filter(([, check]) => !check.ok)
          .map(([name, check]) => `${name}: ${check.detail}`)
          .join("; ") || "live rollout ready"
      : "live rollout disabled",
  };

  const ok = Object.values(checks).every((check) => check.ok);

  return NextResponse.json(
    {
      ok,
      status: ok ? "ready" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
