import { loadProjectEnv, requireReachableServer } from "./lib/env-utils.mjs";

loadProjectEnv();

const baseUrl = process.argv[2] || process.env.APP_URL || "http://localhost:3000";
const workerSecret = process.env.WORKER_SECRET || "";
const isProd = process.env.NODE_ENV === "production";
const intervalMs = Math.max(
  5 * 60 * 1000,
  Number(process.env.LIFECYCLE_EMAIL_INTERVAL_MS || 60 * 60 * 1000),
);

if (!workerSecret && isProd) {
  console.error("WORKER_SECRET is required in production.");
  process.exit(1);
}

const headers = workerSecret ? { "x-worker-secret": workerSecret } : {};
let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  try {
    const response = await fetch(`${baseUrl}/api/internal/lifecycle-notifications/run`, {
      method: "POST",
      headers,
    });
    const data = await response.json().catch(() => ({}));
    const stamp = new Date().toISOString();
    if (!response.ok) {
      console.error(`[${stamp}] lifecycle worker error ${response.status}`, data.error || data);
      return;
    }
    console.log(
      `[${stamp}] lifecycle notifications`,
      `processed=${data.processed || 0}`,
      `reminded=${data.reminded || 0}`,
      `expired=${data.expired || 0}`,
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] lifecycle worker request failed`, error);
  } finally {
    running = false;
  }
}

await requireReachableServer(baseUrl);
await runOnce();
setInterval(runOnce, intervalMs);
