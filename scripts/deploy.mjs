import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync, spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const deploy = path.resolve(root, process.env.DEPLOY_DIR || "deploy");
const standalone = path.join(root, ".next", "standalone");
const zipPath = path.resolve(root, process.env.DEPLOY_ZIP || "deploy.zip");

const args = new Set(process.argv.slice(2));
const packOnly = args.has("--pack-only");
const skipMigrate = args.has("--skip-migrate");
const skipTests = args.has("--skip-tests");
const skipLint = args.has("--skip-lint");

function run(label, command, env = {}) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${command}`);
  const result = spawnSync(command, {
    shell: true,
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    console.error(`\n✗ Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

function runOptional(label, command) {
  console.log(`\n▶ ${label} (optional)`);
  try {
    execSync(command, { cwd: root, stdio: "inherit" });
  } catch {
    console.warn(`  ⚠ Skipped ${label} — database may be unavailable locally.`);
  }
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    console.log(`Cleaning ${dir}...`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true, force: true });
  }
}

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/** Standalone server.js does not load .env — inject a tiny loader for deploy/.env */
function injectStandaloneEnvLoader(serverPath) {
  const original = fs.readFileSync(serverPath, "utf8");
  if (original.includes("/* ar360-env-loader */")) return;
  const loader = `/* ar360-env-loader */
(function () {
  var fs = require("fs");
  var path = require("path");
  function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    var lines = fs.readFileSync(filePath, "utf8").split(/\\r?\\n/);
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.charAt(0) === "#") continue;
      var eq = t.indexOf("=");
      if (eq <= 0) continue;
      var key = t.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      // AR360_DEPLOY_TARGET must come from deploy/.env — authoritative for staging gates.
      if (process.env[key] !== undefined && key !== "AR360_DEPLOY_TARGET") continue;
      var value = t.slice(eq + 1).trim();
      if (
        (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
        (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
  var dir = __dirname;
  loadEnvFile(path.join(dir, ".env"));
  loadEnvFile(path.join(dir, ".env.production"));
  loadEnvFile(path.join(dir, ".env.local"));
})();
`;
  fs.writeFileSync(serverPath, loader + original, "utf8");
}

function sanitizePackageJson(src, dest) {
  const pkgData = JSON.parse(fs.readFileSync(src, "utf-8"));
  const sanitized = {
    name: pkgData.name || "ar360-studio-ui",
    version: pkgData.version || "0.1.0",
    private: pkgData.private ?? true,
    engines: pkgData.engines || { node: ">=20" },
    scripts: { start: "node server.js" },
    dependencies: pkgData.dependencies || {},
  };
  if (pkgData.optionalDependencies) {
    sanitized.optionalDependencies = pkgData.optionalDependencies;
  }
  fs.writeFileSync(dest, JSON.stringify(sanitized, null, 2), "utf-8");
}

function packDeploy() {
  const serverJs = path.join(standalone, "server.js");
  if (!fs.existsSync(serverJs)) {
    console.error("Error: .next/standalone/server.js not found. Run build first.");
    process.exit(1);
  }

  cleanDir(deploy);
  fs.mkdirSync(deploy, { recursive: true });

  fs.copyFileSync(serverJs, path.join(deploy, "server.js"));
  injectStandaloneEnvLoader(path.join(deploy, "server.js"));
  copyDir(path.join(standalone, ".next"), path.join(deploy, ".next"));

  const copiedCache = path.join(deploy, ".next", "cache");
  if (fs.existsSync(copiedCache)) {
    fs.rmSync(copiedCache, { recursive: true, force: true });
  }

  copyDir(path.join(root, "public"), path.join(deploy, "public"));
  copyDir(path.join(root, ".next", "static"), path.join(deploy, ".next", "static"));
  copyDir(path.join(root, "database"), path.join(deploy, "database"));
  copyDir(path.join(root, "scripts"), path.join(deploy, "scripts"));
  copyDir(path.join(standalone, "node_modules"), path.join(deploy, "node_modules"));

  fs.mkdirSync(path.join(deploy, "storage", "Customers"), { recursive: true });
  fs.mkdirSync(path.join(deploy, "storage", "private", "object-capture"), { recursive: true });

  // Staging-only: pack Jewelry Gem#0 fixture into deploy public (not production).
  // Lives under public so staging swap's storage preserve cannot drop it.
  const deployTarget = (process.env.AR360_DEPLOY_TARGET || "").trim().toLowerCase();
  if (deployTarget === "staging") {
    const pocGlbSrc = path.join(
      root,
      "storage",
      "Customers",
      "CUS-169432",
      "Products",
      "PRD_AE4ZBKQY",
      "model.glb",
    );
    const pocGlbDst = path.join(
      deploy,
      "public",
      "experiments",
      "gem-renderer",
      "fixtures",
      "jewelry.glb",
    );
    if (fs.existsSync(pocGlbSrc)) {
      fs.mkdirSync(path.dirname(pocGlbDst), { recursive: true });
      fs.copyFileSync(pocGlbSrc, pocGlbDst);
      console.log("  · packed staging POC jewelry.glb into deploy/public/experiments/…");
    } else {
      console.warn("  · WARN: local jewelry GLB missing — Gem#0 may 404 on staging");
    }
  }

  copyFileIfExists(path.join(root, ".env.example"), path.join(deploy, ".env.example"));
  copyFileIfExists(path.join(root, ".env.staging.example"), path.join(deploy, ".env.staging.example"));
  copyFileIfExists(path.join(root, "package-lock.json"), path.join(deploy, "package-lock.json"));
  copyFileIfExists(path.join(root, "ecosystem.config.js"), path.join(deploy, "ecosystem.config.js"));
  copyFileIfExists(path.join(root, "ecosystem.staging.config.js"), path.join(deploy, "ecosystem.staging.config.js"));
  copyFileIfExists(path.join(root, "docs", "ENVIRONMENT.md"), path.join(deploy, "docs", "ENVIRONMENT.md"));
  copyFileIfExists(path.join(root, "docs", "SERVER_SETUP.md"), path.join(deploy, "docs", "SERVER_SETUP.md"));
  copyFileIfExists(path.join(root, "docs", "STAGING.md"), path.join(deploy, "docs", "STAGING.md"));

  const standalonePkgPath = path.join(standalone, "package.json");
  const fallbackPkgPath = path.join(root, "package.json");
  sanitizePackageJson(
    fs.existsSync(standalonePkgPath) ? standalonePkgPath : fallbackPkgPath,
    path.join(deploy, "package.json"),
  );

  console.log("\n✔ Deployment package written to deploy/");
}

function createZip() {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${deploy.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
      { stdio: "inherit" },
    );
  } else {
    execSync(`cd "${deploy}" && zip -r "${zipPath}" . -x "*.git*"`, { stdio: "inherit" });
  }

  const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log(`\n✔ deploy.zip created (${sizeMb} MB)`);
}

async function main() {
  console.log("=== AR360 Production Deploy Pipeline ===\n");

  if (!packOnly) {
    run("Install dependencies", "npm ci");
    run("Typecheck", "npm run typecheck");
    if (!skipLint) {
      run("Lint", "npm run lint");
    } else {
      console.log("\n▶ Lint (skipped via --skip-lint)");
    }

    if (!skipTests) {
      run("Unit tests", "npm run test:unit");
    }

    run("Security audit (master admin)", "npm run audit:master-admin-security");

    run("Production build", "npm run build", {
      AUTH_SECRET: process.env.AUTH_SECRET || "deploy-build-auth-secret-minimum-32-characters",
      WORKER_SECRET: process.env.WORKER_SECRET || "deploy-build-worker-secret-minimum-32-chars",
      SKIP_RUNTIME_DDL: "true",
    });

    if (!skipMigrate) {
      runOptional("Database migrations", "npm run db:migrate");
    }
  }

  packDeploy();
  createZip();

  console.log("\n=== Deploy complete ===");
  console.log("Upload deploy.tar (preferred) or deploy.zip to the VPS.");
  console.log("IMPORTANT: Use scripts/vps/swap-deploy.sh so .env, storage/, and public/uploads/ are preserved.");
  console.log("CMS landing images live under public/uploads — never overwrite that folder bare.");
  console.log("  tar -cf deploy.tar -C deploy .");
  console.log("  scp deploy.tar root@VPS:/var/www/ar360/deploy-new.tar");
  console.log("  ssh root@VPS 'bash /var/www/ar360/deploy/scripts/vps/swap-deploy.sh'");
  console.log("Or after first extract: bash scripts/vps/swap-deploy.sh");
}

main().catch((error) => {
  console.error("Deploy failed:", error);
  process.exit(1);
});
