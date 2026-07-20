import { loadProjectEnv, requireReachableServer } from "./lib/env-utils.mjs";

loadProjectEnv();

const baseUrl = process.argv[2] || process.env.APP_URL || "http://localhost:3000";
const workerSecret = process.env.WORKER_SECRET || "";

console.log(`Storage smoke: ${baseUrl} (backend=${process.env.STORAGE_BACKEND || "local"})`);
await requireReachableServer(baseUrl);

let failed = false;

function mark(ok, label) {
  console.log(`${ok ? "OK" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

try {
  const ready = await fetch(`${baseUrl}/api/ready`);
  const data = await ready.json().catch(() => ({}));
  mark(ready.ok || ready.status === 503, `/api/ready ${ready.status}`);
  if (data.checks?.storage) {
    mark(data.checks.storage.ok, `storage check (${data.checks.storage.detail || "n/a"})`);
  }
} catch (error) {
  mark(false, `/api/ready ${error instanceof Error ? error.message : error}`);
}

if (!workerSecret && process.env.NODE_ENV === "production") {
  console.error("WORKER_SECRET required for storage smoke in production.");
  process.exit(1);
}

try {
  const res = await fetch(`${baseUrl}/api/internal/storage-smoke`, {
    method: "POST",
    headers: workerSecret ? { "x-worker-secret": workerSecret } : {},
  });
  const data = await res.json().catch(() => ({}));
  mark(res.ok && data.success, `storage write/delete (${data.backend || "unknown"})`);
  if (!res.ok) console.log("  ", data.error || data);
} catch (error) {
  mark(false, `storage-smoke ${error instanceof Error ? error.message : error}`);
}

if (process.env.STORAGE_BACKEND === "s3") {
  console.log("\nS3 mode validated.");
} else {
  console.log("\nLocal storage mode validated (set STORAGE_BACKEND=s3 to test cloud storage).");
}

if (failed) process.exit(1);
console.log("\nStorage smoke passed.\n");
