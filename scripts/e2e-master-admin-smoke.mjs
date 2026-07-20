#!/usr/bin/env node
/**
 * Master Admin smoke test — pages load without 5xx; protected APIs reject unauthenticated access.
 */
const baseUrl = process.argv[2] || process.env.APP_URL || "http://localhost:3000";

const pages = [
  "/master-admin/login",
  "/master-admin",
  "/master-admin/customers",
  "/master-admin/subscriptions",
  "/master-admin/products",
  "/master-admin/object-capture",
  "/master-admin/viewer-analytics",
  "/master-admin/billing",
  "/master-admin/coupons",
  "/master-admin/storage",
  "/master-admin/support-tickets",
  "/master-admin/email-center",
  "/master-admin/system-health",
  "/master-admin/audit-logs",
  "/master-admin/activity-logs",
  "/master-admin/login-logs",
  "/master-admin/admins",
  "/master-admin/settings",
];

const protectedApis = [
  "/api/master-admin/customers",
  "/api/master-admin/subscriptions",
  "/api/master-admin/billing",
  "/api/master-admin/coupons",
  "/api/master-admin/storage",
  "/api/master-admin/support-tickets",
  "/api/master-admin/email-center",
  "/api/master-admin/audit-logs",
  "/api/master-admin/activity-logs",
  "/api/master-admin/system-health",
  "/api/master-admin/admins",
  "/api/master-admin/settings",
  "/api/master-admin/viewer-analytics",
  "/api/master-admin/object-capture/jobs",
];

const publicApis = [
  "/api/health",
];

let failed = false;

async function check(label, url, expect) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    const ok = expect(res);
    console.log(`${ok ? "OK" : "FAIL"} ${res.status} ${label}`);
    if (!ok) failed = true;
  } catch (error) {
    console.log(`FAIL ${label} ${error.message}`);
    failed = true;
  }
}

console.log(`\nMaster Admin smoke: ${baseUrl}\n`);

console.log("## Pages (no 5xx)");
for (const path of pages) {
  await check(path, `${baseUrl}${path}`, (res) => res.status < 500);
}

console.log("\n## Protected APIs (expect 401/403 without session)");
for (const path of protectedApis) {
  await check(path, `${baseUrl}${path}`, (res) => res.status === 401 || res.status === 403);
}

console.log("\n## Public APIs");
for (const path of publicApis) {
  await check(path, `${baseUrl}${path}`, (res) => res.status === 200 || res.status === 503);
}

if (failed) {
  console.log("\nMaster Admin smoke FAILED\n");
  process.exit(1);
}
console.log("\nMaster Admin smoke PASSED\n");
