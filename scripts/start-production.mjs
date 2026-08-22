/**
 * Production start for local/VPS:
 * loads .env from project root (and deploy/), then runs deploy/server.js.
 * Standalone server does not auto-load dotenv like `next dev` does.
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployDir = path.join(root, "deploy");
const serverJs = path.join(deployDir, "server.js");

function loadEnvFile(filePath, { override = false } = {}) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Same precedence family as Next.js: base → production → local overrides.
loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.production"));
loadEnvFile(path.join(root, ".env.local"), { override: true });
loadEnvFile(path.join(root, ".env.production.local"), { override: true });
// Packaged VPS layout: secrets live next to server.js
loadEnvFile(path.join(deployDir, ".env"), { override: true });

process.env.NODE_ENV = "production";

const secret = String(process.env.AUTH_SECRET || "").trim();
if (!secret || secret.length < 32 || secret === "dev-only-change-this-auth-secret") {
  console.error("");
  console.error("✗ AUTH_SECRET must be a strong 32+ character value for production start.");
  console.error("  Set it in the project-root .env (or deploy/.env), then retry:");
  console.error("    npm run start");
  console.error("");
  process.exit(1);
}

if (!fs.existsSync(serverJs)) {
  console.error("");
  console.error("✗ deploy/server.js not found.");
  console.error("  Build/pack first:");
  console.error("    npm run build");
  console.error("    npm run deploy:pack");
  console.error("");
  process.exit(1);
}

const child = spawn(process.execPath, [serverJs], {
  cwd: deployDir,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
