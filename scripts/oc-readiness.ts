import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";
import { loadReconstructionConfig } from "../src/lib/object-capture/worker/reconstruction-pipeline";
import { getObjectCaptureStorageRoot } from "../src/lib/object-capture/workspace";

loadEnvConfig(process.cwd());

type Check = { name: string; ok: boolean; detail: string; action?: string };
const quiet = process.argv.includes("--quiet");

async function canLaunch(command: string, args: string[]) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
    const timer = setTimeout(() => {
      child.kill();
      resolve(true);
    }, 5_000);
    child.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function checkBinary(name: string, command: string, envName: string, args = ["--help"]): Promise<Check> {
  const hasPath = path.isAbsolute(command) || command.includes("/") || command.includes("\\");
  if (hasPath) {
    try {
      await access(command, constants.R_OK | constants.X_OK);
    } catch {
      return {
        name,
        ok: false,
        detail: "configured executable is missing or inaccessible",
        action: `Set ${envName} to the full executable path.`,
      };
    }
  }
  const ok = await canLaunch(command, args);
  return {
    name,
    ok,
    detail: ok ? "executable is available" : "executable was not found on PATH",
    action: ok ? undefined : `Install ${name} or set ${envName} to its full executable path.`,
  };
}

async function checkWorkspace(): Promise<Check> {
  try {
    const root = getObjectCaptureStorageRoot();
    await mkdir(root, { recursive: true });
    const probe = path.join(root, `.oc-readiness-${process.pid}`);
    await writeFile(probe, "private workspace probe", { flag: "wx" });
    await readFile(probe, "utf8");
    await rm(probe, { force: true });
    const info = await stat(root);
    if (!info.isDirectory()) throw new Error("not-directory");
    if (process.platform !== "win32" && (info.mode & 0o002) !== 0) {
      return {
        name: "Private workspace",
        ok: false,
        detail: "workspace is writable by every OS user",
        action: `Remove world-write permission from ${root}.`,
      };
    }
    return { name: "Private workspace", ok: true, detail: `read/write available at ${root}` };
  } catch {
    return {
      name: "Private workspace",
      ok: false,
      detail: "private workspace cannot be created or written",
      action: "Set OBJECT_CAPTURE_STORAGE_ROOT to a persistent, non-public directory writable by the app and worker users.",
    };
  }
}

async function checkMigrations(): Promise<Check> {
  let connection: mysql.Connection | undefined;
  try {
    const uri = process.env.MYSQL_URL || process.env.DATABASE_URL;
    connection = uri
      ? await mysql.createConnection(uri)
      : await mysql.createConnection({
          host: process.env.MYSQL_HOST || "localhost",
          port: Number(process.env.MYSQL_PORT || 3306),
          user: process.env.MYSQL_USER || "root",
          password: process.env.MYSQL_PASSWORD || "",
          database: process.env.MYSQL_DATABASE || "arstudio",
        });
    const files = (await readdir(path.resolve("database", "migrations")))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const [rows] = await connection.query<mysql.RowDataPacket[]>("SELECT name FROM migrations");
    const applied = new Set(rows.map((row) => String(row.name)));
    const pending = files.filter((file) => !applied.has(file));
    return pending.length === 0
      ? { name: "DB migrations", ok: true, detail: `${files.length} migration(s) applied` }
      : {
          name: "DB migrations",
          ok: false,
          detail: `${pending.length} pending: ${pending.join(", ")}`,
          action: "Run npm run db:migrate before starting Object Capture workers.",
        };
  } catch {
    return {
      name: "DB migrations",
      ok: false,
      detail: "database or migrations table is unavailable",
      action: "Verify MYSQL_HOST/MYSQL_PORT/MYSQL_USER/MYSQL_DATABASE and run npm run db:migrate.",
    };
  } finally {
    await connection?.end().catch(() => undefined);
  }
}

async function main() {
  const config = loadReconstructionConfig();
  const checks = await Promise.all([
    checkBinary("COLMAP", config.colmap, "COLMAP_PATH"),
    checkBinary("OpenMVS InterfaceCOLMAP", config.interfaceColmap, "OPENMVS_INTERFACE_COLMAP_PATH"),
    checkBinary("OpenMVS DensifyPointCloud", config.densifyPointCloud, "OPENMVS_DENSIFY_PATH"),
    checkBinary("OpenMVS ReconstructMesh", config.reconstructMesh, "OPENMVS_RECONSTRUCT_PATH"),
    checkBinary("OpenMVS RefineMesh", config.refineMesh, "OPENMVS_REFINE_PATH"),
    checkBinary("OpenMVS TextureMesh", config.textureMesh, "OPENMVS_TEXTURE_PATH"),
    checkBinary("Blender", config.blender, "BLENDER_PATH", ["--version"]),
    checkWorkspace(),
    checkMigrations(),
  ]);
  const failed = checks.filter((check) => !check.ok);
  if (!quiet || failed.length > 0) {
    console.log("Object Capture deployment readiness");
    for (const check of checks) {
      console.log(`${check.ok ? "[OK]" : "[FAIL]"} ${check.name}: ${check.detail}`);
      if (check.action) console.log(`       Action: ${check.action}`);
    }
    console.log(failed.length === 0 ? "READY: Object Capture worker can start." : `NOT READY: ${failed.length} check(s) failed.`);
  }
  if (failed.length > 0) process.exitCode = 1;
}

main().catch(() => {
  console.error("Object Capture readiness could not run. Check timeout and path environment values.");
  process.exitCode = 1;
});
