#!/usr/bin/env node
/**
 * Master Admin production QA — TypeScript, security audit, unit tests, optional live smoke.
 *
 * Usage:
 *   node scripts/master-admin-qa.mjs
 *   node scripts/master-admin-qa.mjs http://localhost:3000
 *   node scripts/master-admin-qa.mjs --skip-build
 *   node scripts/master-admin-qa.mjs --skip-smoke http://localhost:3000
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const npmCommand = () => (process.platform === "win32" ? "npm.cmd" : "npm");
function nodeCommand() {
  const p = process.execPath;
  return p.includes(" ") ? `"${p}"` : p;
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit", shell: true });
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const baseUrl = args[0] || process.env.APP_URL || "";
const skipSmoke = flags.has("--skip-smoke");
const skipBuild = flags.has("--skip-build");

const requiredDocs = [
  "docs/master-admin-production-readiness.md",
  "docs/master-admin-ops.md",
  "docs/master-admin-architecture.md",
  "docs/master-admin-permissions.md",
];

const requiredServices = [
  "src/lib/master-admin/audit-logs.service.ts",
  "src/lib/master-admin/activity-logs.service.ts",
  "src/lib/master-admin/system-health.service.ts",
  "src/lib/master-admin/admins.service.ts",
];

let failed = false;

function step(name, fn) {
  process.stdout.write(`\n> ${name}\n`);
  try {
    fn();
    console.log(`OK ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

console.log("\nMaster Admin Production QA\n");

step("Required documentation", () => {
  for (const file of requiredDocs) {
    if (!fs.existsSync(path.join(process.cwd(), file))) {
      throw new Error(`Missing ${file}`);
    }
  }
});

step("Required Stage 15 services", () => {
  for (const file of requiredServices) {
    if (!fs.existsSync(path.join(process.cwd(), file))) {
      throw new Error(`Missing ${file}`);
    }
  }
});

step("TypeScript (tsc --noEmit)", () => {
  execSync("npx tsc --noEmit", { stdio: "inherit" });
});

step("Master Admin security audit", () => {
  run(`${nodeCommand()} scripts/master-admin-security-audit.mjs`);
});

step("Unit tests", () => {
  execSync(`${npmCommand()} run test`, { stdio: "inherit", shell: true });
});

if (!skipBuild) {
  step("Production build", () => {
    execSync(`${npmCommand()} run build`, {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, SKIP_RUNTIME_DDL: "true" },
    });
  });
}

if (!skipSmoke && baseUrl) {
  step(`Live smoke (${baseUrl})`, () => {
    run(`${nodeCommand()} scripts/e2e-master-admin-smoke.mjs ${baseUrl}`);
    run(`${nodeCommand()} scripts/security-header-check.mjs ${baseUrl}`);
  });
} else if (!skipSmoke) {
  console.log("\n> Live smoke skipped (pass base URL or set APP_URL)\n");
}

if (failed) {
  console.log("\nMaster Admin QA FAILED\n");
  process.exit(1);
}
console.log("\nMaster Admin QA PASSED\n");
