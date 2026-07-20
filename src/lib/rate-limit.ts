import { redisCheckRateLimit } from "@/lib/rate-limit-redis";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupExpired(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitOptions = {
  /** Unique scope, e.g. "auth:login" */
  scope: string;
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
};

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function memoryCheckRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupExpired(now);

  const bucketKey = `${options.scope}:${key}`;
  const windowMs = options.windowSec * 1000;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      limit: options.limit,
      remaining: Math.max(0, options.limit - 1),
      retryAfterSec: options.windowSec,
    };
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const redisResult = await redisCheckRateLimit(key, options).catch(() => null);
  if (redisResult) return redisResult;
  return memoryCheckRateLimit(key, options);
}

export function rateLimitResponse(result: RateLimitResult) {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfterSec),
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
    },
  });
}

export async function enforceRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult | Response> {
  const ip = getClientIp(request);
  const result = await checkRateLimit(ip, options);
  if (!result.allowed) return rateLimitResponse(result);
  return result;
}

/** For server actions — pass IP from headers() */
export async function enforceRateLimitForKey(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  return checkRateLimit(key || "unknown", options);
}
