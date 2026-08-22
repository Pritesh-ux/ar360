import type { JobQueueName } from "@/lib/queue/types";
import { resolveJobQueueBackend } from "@/lib/queue/types";

const QUEUE_KEY_PREFIX = "ar360:queue:";

 
let client: any = undefined;

export function getRedisQueueKey(queue: JobQueueName) {
  return `${QUEUE_KEY_PREFIX}${queue}`;
}

export async function getRedisClient() {
  if (client !== undefined) return client;

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    client = null;
    return null;
  }

  try {
    const { createClient } = await import("redis");
    const redis = createClient({ url });
    redis.on("error", (error) => console.warn("[redis]", error));
    await redis.connect();
    client = redis;
    return client;
  } catch (error) {
    console.warn("[redis] unavailable:", error);
    client = null;
    return null;
  }
}

export async function enqueueRedisJob(queue: JobQueueName, jobId: string) {
  if (resolveJobQueueBackend() !== "redis") return;

  const redis = await getRedisClient();
  if (!redis) {
    throw new Error("JOB_QUEUE_BACKEND=redis requires REDIS_URL.");
  }

  await redis.rPush(getRedisQueueKey(queue), jobId);
}

export async function pingRedis(): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;
  const pong = await redis.ping();
  return pong === "PONG";
}
