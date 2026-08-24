/**
 * AR360 staging VPS deploy helper.
 * Builds a deploy artifact, uploads to /var/www/ar360-staging only,
 * and runs swap-deploy-staging.sh remotely.
 *
 * Refuses production paths and PM2 names. Does not deploy to /var/www/ar360.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { assertStagingSignupGateInArtifact } from "./lib/staging-artifact-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envLocalPath = path.join(root, ".env.local");
const envPath = path.join(root, ".env");

const FORBIDDEN_DIR = "/var/www/ar360";
const REQUIRED_DIR = "/var/www/ar360-staging";
const FORBIDDEN_PM2 = "ar360-web";
const REQUIRED_PM2 = "ar360-staging-web";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.charAt(0) === "#") continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = t.slice(eq + 1).trim();
    if (
      (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
      (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(envLocalPath);
loadEnvFile(envPath);

function normalizePosixPath(p) {
  return String(p || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
}

function isForbiddenProductionDir(dir) {
  const n = normalizePosixPath(dir);
  if (!n) return false;
  if (n === FORBIDDEN_DIR) return true;
  if (n.startsWith(`${FORBIDDEN_DIR}/`)) return true;
  return false;
}

function die(message) {
  console.error(`\n❌ STAGING DEPLOY ABORTED: ${message}`);
  process.exit(1);
}

const host = process.env.VPS_STAGING_HOST || process.env.VPS_HOST;
const user = process.env.VPS_STAGING_USER || process.env.VPS_USER;
const port = process.env.VPS_STAGING_PORT || process.env.VPS_PORT || "22";
const dir = normalizePosixPath(process.env.VPS_STAGING_DIR || REQUIRED_DIR);
const keyPath = process.env.VPS_STAGING_SSH_KEY_PATH || process.env.VPS_SSH_KEY_PATH;
const pm2Name = process.env.VPS_STAGING_PM2_NAME || REQUIRED_PM2;
const deployTarget = (process.env.AR360_DEPLOY_TARGET || "").trim().toLowerCase();

console.log("=== AR360 STAGING VPS Deploy ===");

if (deployTarget && deployTarget !== "staging") {
  die(`AR360_DEPLOY_TARGET='${deployTarget}' — must be 'staging' (or unset)`);
}

if (!host || !user) {
  die(
    "Set VPS_STAGING_HOST and VPS_STAGING_USER (or VPS_HOST/VPS_USER) in .env.local — values are not printed.",
  );
}

if (!dir) {
  die("VPS_STAGING_DIR is required (expected /var/www/ar360-staging)");
}

if (isForbiddenProductionDir(dir)) {
  die(`VPS_STAGING_DIR/VPS_DIR='${dir}' targets production — refused`);
}

if (dir !== REQUIRED_DIR) {
  die(`VPS_STAGING_DIR must be exactly ${REQUIRED_DIR} (got '${dir}')`);
}

// Note: VPS_DIR may still point at production in .env.local for prod deploys.
// Staging uses VPS_STAGING_DIR only; production path is never passed to scp/ssh below.

if (pm2Name === FORBIDDEN_PM2) {
  die(`PM2 name '${FORBIDDEN_PM2}' is forbidden for staging`);
}

if (pm2Name !== REQUIRED_PM2) {
  die(`PM2 name must be '${REQUIRED_PM2}' (got '${pm2Name}')`);
}

console.log(`- Host: ${host}`);
console.log(`- User: ${user}`);
console.log(`- Port: ${port}`);
console.log(`- Target Directory: ${dir}`);
console.log(`- PM2 App Name: ${pm2Name}`);
if (keyPath) console.log("- Private Key: (set)");
console.log("------------------------------------\n");

function runLocal(label, command, args = [], options = {}) {
  console.log(`▶ Running: ${label}`);
  console.log(`  $ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    shell: options.shell ?? true,
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    die(`Failed: ${label}`);
  }
}

// Force staging target for build artifacts and fail-closed local validation.
process.env.AR360_DEPLOY_TARGET = "staging";

// Build + pack (skip local migrate — staging DB migrations are run on the VPS)
runLocal("Build & Package Deploy Artifact", "npm", [
  "run",
  "deploy",
  "--",
  "--skip-migrate",
  "--skip-lint",
]);

const deployDir = path.resolve(root, "deploy");
if (!fs.existsSync(path.join(deployDir, "server.js"))) {
  die("deploy/server.js missing after pack");
}

try {
  assertStagingSignupGateInArtifact(deployDir);
} catch (error) {
  die(error instanceof Error ? error.message : String(error));
}

if (!fs.existsSync(path.join(deployDir, "ecosystem.staging.config.js"))) {
  die("Deploy artifact missing ecosystem.staging.config.js");
}
if (!fs.existsSync(path.join(deployDir, "scripts/vps/verify-staging-runtime.sh"))) {
  die("Deploy artifact missing scripts/vps/verify-staging-runtime.sh");
}

const tarName = "deploy-new.tar";
const tarPath = path.resolve(root, tarName);
if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);

if (process.platform === "win32") {
  runLocal("Create deploy-new.tar", "tar", ["-cf", tarName, "-C", "deploy", "."]);
} else {
  runLocal("Create deploy-new.tar", "tar", ["-cf", tarName, "-C", "deploy", "."]);
}

if (!fs.existsSync(tarPath)) {
  die("deploy-new.tar was not created");
}

const sshArgs = ["-p", port];
const scpArgs = ["-P", port];
if (keyPath) {
  sshArgs.push("-i", keyPath);
  scpArgs.push("-i", keyPath);
}

const remoteTar = `${user}@${host}:${dir}/deploy-new.tar`;
console.log("\n▶ Uploading deploy-new.tar to staging VPS...");
runLocal("SCP Upload Artifact", "scp", [...scpArgs, tarName, remoteTar], { shell: false });

const remoteCommands = [
  `test -d "${REQUIRED_DIR}"`,
  `cd "${REQUIRED_DIR}"`,
  `test -f deploy-new.tar`,
  `rm -rf /tmp/ar360-staging-swap-bootstrap`,
  `mkdir -p /tmp/ar360-staging-swap-bootstrap`,
  // Windows-created tars often prefix members with "./"
  `tar -xf deploy-new.tar -C /tmp/ar360-staging-swap-bootstrap ./scripts/vps/swap-deploy-staging.sh ./scripts/vps/verify-staging-runtime.sh || tar -xf deploy-new.tar -C /tmp/ar360-staging-swap-bootstrap scripts/vps/swap-deploy-staging.sh scripts/vps/verify-staging-runtime.sh`,
  `sed -i 's/\\r$//' /tmp/ar360-staging-swap-bootstrap/scripts/vps/*.sh`,
  `bash /tmp/ar360-staging-swap-bootstrap/scripts/vps/swap-deploy-staging.sh`,
].join(" && ");

console.log("\n▶ Running staging swap on VPS...");
runLocal("SSH Staging Swap", "ssh", [...sshArgs, `${user}@${host}`, remoteCommands], { shell: false });

console.log("\n▶ Verifying staging signup is blocked (HTTP)...");
const verifySignup = spawnSync(
  "node",
  [path.join(root, "scripts", "verify-staging-signup-block.mjs"), `https://staging.ar360studio.com`],
  { cwd: root, stdio: "inherit", shell: true },
);
if (verifySignup.status !== 0) {
  die("Staging signup block HTTP verification failed");
}

console.log("\n✔ Staging deploy finished (production /var/www/ar360 was not targeted).");
