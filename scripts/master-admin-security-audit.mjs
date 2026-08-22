#!/usr/bin/env node
/**
 * Static security audit for Master Admin API routes.
 * Fails if routes lack auth guards or re-introduce demo auto-seed patterns.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "src", "app", "api", "master-admin");

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name === "route.ts") files.push(full);
  }
  return files;
}

const AUTH_PATTERNS = [
  /guardAdminPermission\s*\(/,
  /requireApiAdmin\s*\(/,
  /getCurrentMasterAdminWithPermissions\s*\(/,
  /requireApiAdminPermission\s*\(/,
];

const AUDIT_PATTERNS = [/writeMasterAdminAudit\s*\(/, /logAdminAudit\s*\(/];

const FORBIDDEN_PATTERNS = [
  { name: "coupon auto-seed", re: /seedCoupons|coupon-seed/ },
  { name: "ticket auto-seed", re: /seedSupportTickets|ticket-seed/ },
  { name: "eval()", re: /\beval\s*\(/ },
];

const EXPORT_ROUTE_HINT = /export\s*===\s*["']csv["']|export=csv/;
const EXPORT_GUARD = /exports\.download/;

const routes = walk(apiRoot);
const findings = [];

for (const file of routes) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  const source = fs.readFileSync(file, "utf8");
  const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]);

  if (methods.length === 0) continue;

  const hasAuth = AUTH_PATTERNS.some((re) => re.test(source));
  if (!hasAuth) {
    findings.push({ severity: "error", file: rel, issue: "Missing admin auth guard" });
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.re.test(source)) {
      findings.push({ severity: "error", file: rel, issue: `Forbidden pattern: ${pattern.name}` });
    }
  }

  if (EXPORT_ROUTE_HINT.test(source) && !EXPORT_GUARD.test(source)) {
    findings.push({ severity: "warn", file: rel, issue: "CSV export may lack exports.download permission check" });
  }

  if (AUDIT_PATTERNS.some((re) => re.test(source)) && /PATCH|POST|DELETE/.test(methods.join(","))) {
    // informational pass — mutation routes with audit are good
  } else if (/PATCH|POST|DELETE/.test(methods.join(",")) && !/test-email/.test(rel)) {
    const isReadOnlyPost = /action\s*===\s*["']retry["']|action\s*===\s*["']send["']/.test(source);
    if (!isReadOnlyPost && !AUDIT_PATTERNS.some((re) => re.test(source)) && !/impersonat/.test(rel)) {
      findings.push({ severity: "info", file: rel, issue: "Mutation route without writeMasterAdminAudit (review manually)" });
    }
  }
}

console.log("\nMaster Admin Security Audit\n");
console.log(`Routes scanned: ${routes.length}`);

const errors = findings.filter((f) => f.severity === "error");
const warnings = findings.filter((f) => f.severity === "warn");
const infos = findings.filter((f) => f.severity === "info");

if (errors.length) {
  console.log("\nERRORS:");
  for (const item of errors) console.log(`  - ${item.file}: ${item.issue}`);
}
if (warnings.length) {
  console.log("\nWARNINGS:");
  for (const item of warnings) console.log(`  - ${item.file}: ${item.issue}`);
}
if (infos.length) {
  console.log("\nINFO (manual review):");
  for (const item of infos.slice(0, 15)) console.log(`  - ${item.file}: ${item.issue}`);
  if (infos.length > 15) console.log(`  ... and ${infos.length - 15} more`);
}

const outDir = path.join(root, "reports");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "master-admin-security-audit.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), routes: routes.length, findings }, null, 2),
);
console.log("\nSaved: reports/master-admin-security-audit.json");

if (errors.length) {
  console.log("\nStatus: FAILED");
  process.exit(1);
}
console.log("\nStatus: PASSED");
