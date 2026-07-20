import { loadProjectEnv, requireReachableServer } from "./lib/env-utils.mjs";

loadProjectEnv();

const baseUrl = process.argv[2] || process.env.APP_URL || "http://localhost:3000";

const paths = [
  ["/api/health", (status) => status === 200],
  ["/api/billing/plans", (status) => status === 200 || status === 401],
  ["/", (status) => status === 200],
  ["/faq", (status) => status === 200],
  ["/contact", (status) => status === 200],
  ["/privacy", (status) => status === 200],
  ["/terms", (status) => status === 200],
  ["/pricing", (status) => status === 200],
  ["/login", (status) => status === 200],
  ["/forgot-password", (status) => status === 200],
  ["/dashboard", (status) => (status >= 300 && status < 400) || status === 401 || status === 403],
  ["/dashboard/object-capture", (status) => (status >= 300 && status < 400) || status === 401 || status === 403],
  ["/api/dashboard/overview", (status) => status === 401 || status === 403],
  ["/api/object-capture/jobs", (status) => status === 401 || status === 403],
];

console.log(`Customer e2e smoke: ${baseUrl}`);
await requireReachableServer(baseUrl);

let failed = false;
for (const [path, expect] of paths) {
  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    const ok = expect(res.status);
    console.log(`${ok ? "OK" : "FAIL"} ${res.status} ${path}`);
    if (!ok) failed = true;
  } catch (error) {
    console.log(`FAIL ${path} ${error instanceof Error ? error.message : error}`);
    failed = true;
  }
}

if (failed) process.exit(1);
