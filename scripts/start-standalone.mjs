/**
 * Next.js standalone needs static assets + root env beside server.js.
 * Without env, AUTH_SECRET mismatches and master-admin APIs return Unauthorized.
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const serverJs = path.join(standalone, "server.js");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Load root .env into this process so child inherits AUTH_SECRET / DB vars
loadEnvConfig(root);

if (!fs.existsSync(serverJs)) {
  console.error("Missing .next/standalone/server.js. Run: npm run build");
  process.exit(1);
}

const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");
const standaloneUploads = path.join(publicDest, "uploads");
const persistentUploads = path.join(publicSrc, "uploads");

if (!fs.existsSync(staticSrc)) {
  console.error("Missing .next/static. Run: npm run build");
  process.exit(1);
}

console.log("Copying .next/static -> .next/standalone/.next/static ...");
copyDir(staticSrc, staticDest);

if (fs.existsSync(publicSrc)) {
  if (fs.existsSync(standaloneUploads)) {
    console.log("Persisting standalone uploads -> public/uploads ...");
    copyDir(standaloneUploads, persistentUploads);
  }
  console.log("Copying public -> .next/standalone/public ...");
  copyDir(publicSrc, publicDest);
}

copyFileIfExists(path.join(root, ".env"), path.join(standalone, ".env"));
copyFileIfExists(path.join(root, ".env.local"), path.join(standalone, ".env.local"));

if (!process.env.AUTH_SECRET && !process.env.SESSION_SECRET) {
  console.warn(
    "WARNING: AUTH_SECRET is not set. Master admin sessions will fail with Unauthorized.",
  );
}

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT || "3000";
const objectCaptureRoot =
  process.env.OBJECT_CAPTURE_STORAGE_ROOT ||
  path.join(root, "storage", "private", "object-capture");
fs.mkdirSync(objectCaptureRoot, { recursive: true });

console.log(
  `Starting standalone on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port} (bind ${hostname})`,
);

const child = spawn(process.execPath, [serverJs], {
  cwd: standalone,
  env: {
    ...process.env,
    HOSTNAME: hostname,
    PORT: port,
    AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE || "false",
    AR360_PROJECT_ROOT: root,
    // Keep capture inputs and reconstruction output outside .next/standalone and public/.
    // This survives application rebuilds and is never served as a static asset.
    OBJECT_CAPTURE_STORAGE_ROOT: objectCaptureRoot,
  },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
