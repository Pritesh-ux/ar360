import type { RateLimitOptions, RateLimitResult } from "@/lib/rate-limit";
import { getRedisClient } from "@/lib/queue/redis-client";

export async function redisCheckRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult | null> {
  const redis = await getRedisClient();
  if (!redis) return null;

  const bucketKey = `rl:${options.scope}:${key}`;
  const count = Number(await redis.incr(bucketKey));

  if (count === 1) {
    await redis.expire(bucketKey, options.windowSec);
  }

  const ttl = Number(await redis.ttl(bucketKey));
  const retryAfterSec = ttl > 0 ? ttl : options.windowSec;

  if (count > options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      retryAfterSec,
    };
  }

  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSec,
  };
}
