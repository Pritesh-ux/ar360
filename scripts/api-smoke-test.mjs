import { loadProjectEnv, requireReachableServer } from "./lib/env-utils.mjs";

loadProjectEnv();

const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const endpoints = [
  ["GET", "/api/billing/plans"],
  ["GET", "/api/billing/entitlement?action=viewer"],
  ["GET", "/api/billing/entitlement?action=upload"],
  ["GET", "/api/billing/subscription"],
  ["GET", "/api/billing/history"],
  ["GET", "/api/billing/invoices"],
  ["GET", "/api/master-admin/payments"],
  ["GET", "/api/master-admin/subscriptions"],
];

async function run() {
  console.log(`API smoke test: ${baseUrl}`);
  await requireReachableServer(baseUrl);

  const results = [];

  for (const [method, path] of endpoints) {
    const url = `${baseUrl}${path}`;
    const started = Date.now();
    try {
      const res = await fetch(url, { method, redirect: "manual" });
      const ms = Date.now() - started;
      const text = await res.text();
      const ok = res.status < 500;
      results.push({ method, path, status: res.status, ok, ms, preview: text.slice(0, 120).replace(/\s+/g, " ") });
    } catch (error) {
      results.push({
        method,
        path,
        status: "ERR",
        ok: false,
        ms: Date.now() - started,
        preview: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.table(results.map(({ method, path, status, ok, ms }) => ({ method, path, status, ok, ms })));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log("\nFailures / server errors:");
    for (const fail of failed) console.log(`- ${fail.method} ${fail.path}: ${fail.status} ${fail.preview}`);
    process.exitCode = 1;
  }
}

run();
