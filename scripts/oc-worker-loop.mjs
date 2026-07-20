import { loadProjectEnv, requireReachableServer } from "./lib/env-utils.mjs";

loadProjectEnv();

const baseUrl = process.argv[2] || process.env.APP_URL || "http://localhost:3000";
const workerSecret = process.env.WORKER_SECRET || "";
const isProd = process.env.NODE_ENV === "production";

if (!workerSecret && isProd) {
  console.error("WORKER_SECRET is required in production.");
  console.error('PowerShell: $env:WORKER_SECRET="your-secret"; npm run worker:oc');
  console.error("Cmd:        set WORKER_SECRET=your-secret && npm run worker:oc");
  process.exit(1);
}

const intervalMs = Number(process.env.OC_WORKER_INTERVAL_MS || 15000);
const headers = workerSecret ? { "x-worker-secret": workerSecret } : {};

console.log(`Object capture worker loop → ${baseUrl} every ${intervalMs}ms`);
if (!workerSecret) {
  console.log("Dev mode: no WORKER_SECRET set (matches local worker-auth bypass).");
}

async function runOnce() {
  try {
    const res = await fetch(`${baseUrl}/api/object-capture/worker/run`, {
      method: "POST",
      headers,
    });
    const data = await res.json().catch(() => ({}));
    const stamp = new Date().toISOString();
    if (!res.ok) {
      console.error(`[${stamp}] worker error ${res.status}`, data.error || data);
      return;
    }
    console.log(`[${stamp}] ${data.message || "ok"}`, data.job?.id ? `job=${data.job.id}` : "");
  } catch (error) {
    console.error(`[${new Date().toISOString()}] worker request failed`, error);
  }
}

await requireReachableServer(baseUrl);
await runOnce();
setInterval(runOnce, intervalMs);
