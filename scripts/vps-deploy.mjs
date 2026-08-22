import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envLocalPath = path.join(root, ".env.local");
const envPath = path.join(root, ".env");

// 1. Env Loader
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

const host = process.env.VPS_HOST;
const user = process.env.VPS_USER;
const port = process.env.VPS_PORT || "22";
const dir = process.env.VPS_DIR;
const keyPath = process.env.VPS_SSH_KEY_PATH;
const pm2Name = process.env.VPS_PM2_NAME || "ar360-web";

console.log("=== AR360 VPS Deploy Setup Check ===");

// 2. Validate Env Variables
if (!host || !user || !dir) {
  console.error("\n❌ Error: Missing required VPS variables in `.env.local`.");
  console.error("Please add the following variables to your .env.local file:");
  console.error("  VPS_HOST=your_vps_ip_or_domain");
  console.error("  VPS_USER=root_or_deploy_user");
  console.error("  VPS_DIR=/var/www/ar360 (target directory on your VPS)");
  console.error("\nOptional variables:");
  console.error("  VPS_PORT=22");
  console.error("  VPS_SSH_KEY_PATH=~/.ssh/id_rsa");
  console.error("  VPS_PM2_NAME=ar360-web");
  process.exit(1);
}

console.log(`- Host: ${host}`);
console.log(`- User: ${user}`);
console.log(`- Port: ${port}`);
console.log(`- Target Directory: ${dir}`);
if (keyPath) console.log(`- Private Key: ${keyPath}`);
console.log(`- PM2 App Name: ${pm2Name}`);
console.log("------------------------------------\n");

// Helper to run a local command
function runLocal(label, command, args = []) {
  console.log(`▶ Running: ${label}`);
  console.log(`  $ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    shell: true,
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`❌ Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

// 3. Step 1: Run Local Deploy/Build Pipeline
runLocal("Build & Package Deploy Artifact", "npm", ["run", "deploy"]);

const zipFile = path.resolve(root, "deploy.zip");
if (!fs.existsSync(zipFile)) {
  console.error("❌ Error: deploy.zip was not generated. Check deploy script logs.");
  process.exit(1);
}

// 4. Construct SSH / SCP Options
const sshArgs = ["-p", port];
const scpArgs = ["-P", port];
if (keyPath) {
  sshArgs.push("-i", keyPath);
  scpArgs.push("-i", keyPath);
}

// Ensure remote path is properly quoted in scp
const remoteTarget = `${user}@${host}:${dir}/deploy.zip`;

// 5. Step 2: Upload deploy.zip
console.log("\n▶ Uploading deploy.zip to VPS...");
runLocal("SCP Upload Artifact", "scp", [...scpArgs, "deploy.zip", remoteTarget]);

// 6. Step 3: Run SSH command on VPS to deploy
console.log("\n▶ Deploying on VPS over SSH...");

// The command block to execute on the VPS
const remoteCommands = [
  `cd "${dir}"`,
  `echo "=== Extracting deploy artifact ==="`,
  `test -f deploy-new.tar || test -f deploy.zip`,
  `if [ -f scripts/vps/swap-deploy.sh ]; then bash scripts/vps/swap-deploy.sh; elif [ -f deploy/scripts/vps/swap-deploy.sh ]; then bash deploy/scripts/vps/swap-deploy.sh; else echo "Missing scripts/vps/swap-deploy.sh — refusing unsafe unzip that would wipe public/uploads"; exit 1; fi`,
  `echo "=== VPS deployment finished ==="`
].join(" && ");

runLocal("SSH Remote Deploy Execution", "ssh", [
  ...sshArgs,
  `${user}@${host}`,
  `"${remoteCommands}"`
]);

console.log("\n🚀 Success! AR360 Studio has been successfully built, uploaded, and updated on your VPS.");
