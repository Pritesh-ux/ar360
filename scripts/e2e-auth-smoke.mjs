import { loadProjectEnv, requireReachableServer } from "./lib/env-utils.mjs";

loadProjectEnv();

const baseUrl = process.argv[2] || process.env.APP_URL || "http://localhost:3000";
const secret = process.env.SMOKE_TEST_SECRET || "";
const email = process.env.SEED_CUSTOMER_EMAIL || "customer@ar360.com";
const password = process.env.SEED_CUSTOMER_PASSWORD || "Customer@12345";

if (!secret) {
  console.error("SMOKE_TEST_SECRET is required for auth smoke tests.");
  console.error("Add to .env.local for staging/CI only — never in production.");
  process.exit(1);
}

console.log(`Auth smoke test: ${baseUrl}`);
await requireReachableServer(baseUrl);

const jar = { cookie: "" };

async function fetchWithCookies(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (jar.cookie) headers.cookie = jar.cookie;

  const res = await fetch(url, { ...options, headers, redirect: "manual" });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    jar.cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  }
  return res;
}

let failed = false;

try {
  const loginRes = await fetchWithCookies(`${baseUrl}/api/internal/smoke-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, email, password }),
  });

  if (!loginRes.ok) {
    console.log(`FAIL ${loginRes.status} smoke-login`);
    failed = true;
  } else {
    console.log(`OK ${loginRes.status} smoke-login`);
  }
} catch (error) {
  console.log(`FAIL smoke-login ${error instanceof Error ? error.message : error}`);
  failed = true;
}

const authedPaths = [
  ["/api/customer/bootstrap", (s) => s === 200],
  ["/api/dashboard/overview", (s) => s === 200 || s === 403],
  ["/api/products", (s) => s === 200],
  ["/api/billing/subscription", (s) => s === 200],
];

for (const [path, expect] of authedPaths) {
  try {
    const res = await fetchWithCookies(`${baseUrl}${path}`);
    const ok = expect(res.status);
    console.log(`${ok ? "OK" : "FAIL"} ${res.status} ${path}`);
    if (!ok) failed = true;
  } catch (error) {
    console.log(`FAIL ${path} ${error instanceof Error ? error.message : error}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("\nAuth smoke passed.\n");
