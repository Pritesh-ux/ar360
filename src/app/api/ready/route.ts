import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { pingRedis } from "@/lib/queue/redis-client";
import { resolveJobQueueBackend } from "@/lib/queue/types";
import { getMissingRequiredEnv, isAuthSecretStrong } from "@/lib/production/env";
import { getStorageAdapter, ensureActiveStorageRoot } from "@/lib/storage/adapter";
import { verifyS3BucketAccess } from "@/lib/storage/s3-config";
import { getLiveBillingReadiness } from "@/lib/billing/production-readiness";
import { toPublicReadyPayload } from "@/lib/production/ready-payload";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { toPublicReadyPayload } from "@/lib/production/ready-payload";

function secretsEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function hasInternalReadyAccess(request: NextRequest): boolean {
  const provided =
    request.headers.get("x-ar360-internal-key")?.trim() ||
    request.headers.get("x-ar360-worker-secret")?.trim() ||
    "";
  if (!provided) return false;
  const expected =
    process.env.AR360_INTERNAL_KEY?.trim() ||
    process.env.WORKER_SECRET?.trim() ||
    "";
  if (!expected || expected.length < 16) return false;
  return secretsEqual(provided, expected);
}

export async function GET(request: NextRequest) {
  const detailed = hasInternalReadyAccess(request);
  const missing = getMissingRequiredEnv();
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  const timestamp = new Date().toISOString();

  if (missing.length > 0) {
    const checkOk = { env: false };
    if (!detailed) {
      return NextResponse.json(toPublicReadyPayload({ ok: false, checkOk, timestamp }), {
        status: 503,
      });
    }
    return NextResponse.json(
      { ok: false, status: "missing_env", missing, checks, timestamp },
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
      checks.storage = {
        ok: Boolean(root),
        detail: detailed ? root || "local storage root unavailable" : undefined,
      };
    }
  } catch (error) {
    checks.storage = {
      ok: false,
      detail: detailed
        ? error instanceof Error
          ? error.message
          : "Storage unavailable"
        : undefined,
    };
  }

  if (process.env.REDIS_URL?.trim()) {
    const redisOk = await pingRedis();
    checks.redis = {
      ok: redisOk,
      detail: detailed ? (redisOk ? "connected" : "unreachable") : undefined,
    };
  }

  if (resolveJobQueueBackend() === "redis") {
    checks.jobQueue = {
      ok: checks.redis?.ok === true,
      detail: detailed
        ? checks.redis?.ok
          ? "redis"
          : "JOB_QUEUE_BACKEND=redis but REDIS_URL unreachable"
        : undefined,
    };
  } else {
    checks.jobQueue = { ok: true, detail: detailed ? "db" : undefined };
  }

  checks.authSecret = {
    ok: process.env.NODE_ENV !== "production" || isAuthSecretStrong(),
    detail: detailed ? (isAuthSecretStrong() ? "strong" : "weak-or-default") : undefined,
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
    detail: detailed
      ? billing.required
        ? Object.entries(billing.checks)
            .filter(([, check]) => !check.ok)
            .map(([name, check]) => `${name}: ${check.detail}`)
            .join("; ") || "live rollout ready"
        : "live rollout disabled"
      : undefined,
  };

  const internalKey = String(process.env.AR360_INTERNAL_KEY || "").trim();
  checks.ar360InternalKey = {
    ok: process.env.NODE_ENV !== "production" || internalKey.length >= 16,
    detail: detailed
      ? internalKey.length >= 16
        ? "configured"
        : "missing — set AR360_INTERNAL_KEY for custom domains / internal APIs"
      : undefined,
  };

  const ok = Object.values(checks).every((check) => check.ok);
  const checkOk = Object.fromEntries(
    Object.entries(checks).map(([name, check]) => [name, check.ok]),
  );

  if (!detailed) {
    return NextResponse.json(toPublicReadyPayload({ ok, checkOk, timestamp }), {
      status: ok ? 200 : 503,
    });
  }

  const deployTarget = String(process.env.AR360_DEPLOY_TARGET || "")
    .trim()
    .toLowerCase();

  return NextResponse.json(
    {
      ok,
      status: ok ? "ready" : "degraded",
      deployTarget: deployTarget || "unset",
      checks,
      timestamp,
    },
    { status: ok ? 200 : 503 },
  );
}
