import { loadProjectEnv, waitForHealth } from "./lib/env-utils.mjs";

loadProjectEnv();

const baseUrl = process.argv[2] || process.env.APP_URL || "http://localhost:3000";
const workerSecret = process.env.WORKER_SECRET || "";

console.log(`Object capture worker smoke: ${baseUrl}`);

if (!(await waitForHealth(baseUrl, 30))) {
  console.error("Server did not become healthy in time.");
  process.exit(1);
}

let failed = false;

try {
  const res = await fetch(`${baseUrl}/api/ready`);
  const ok = res.status === 200 || res.status === 503;
  console.log(`${ok ? "OK" : "FAIL"} ${res.status} /api/ready`);
  if (!ok) failed = true;
} catch (error) {
  console.log(`FAIL /api/ready ${error instanceof Error ? error.message : error}`);
  failed = true;
}

try {
  const res = await fetch(`${baseUrl}/api/object-capture/worker/run`, {
    method: "POST",
    headers: workerSecret ? { "x-worker-secret": workerSecret } : {},
  });
  const ok = res.status === 200 || res.status === 401;
  console.log(`${ok ? "OK" : "FAIL"} ${res.status} /api/object-capture/worker/run`);
  if (!ok) failed = true;
} catch (error) {
  console.log(`FAIL /api/object-capture/worker/run ${error instanceof Error ? error.message : error}`);
  failed = true;
}

if (failed) process.exit(1);
