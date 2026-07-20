import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { loadProjectEnv } from "./lib/env-utils.mjs";

loadProjectEnv();

const outDir = path.resolve(process.argv[2] || path.join(process.cwd(), "backups", "mysql"));
const host = process.env.MYSQL_HOST || "127.0.0.1";
const port = process.env.MYSQL_PORT || "3306";
const user = process.env.MYSQL_USER || "root";
const password = process.env.MYSQL_PASSWORD ?? "";
const database = process.env.MYSQL_DATABASE || "arstudio";

await fs.mkdir(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(outDir, `${database}-${stamp}.sql`);

const args = [
  `-h${host}`,
  `-P${port}`,
  `-u${user}`,
  ...(password ? [`-p${password}`] : []),
  "--single-transaction",
  "--routines",
  "--triggers",
  database,
];

console.log(`Backing up MySQL database "${database}" to ${target}`);

await new Promise((resolve, reject) => {
  const dump = spawn("mysqldump", args, { stdio: ["ignore", "pipe", "inherit"] });
  const chunks = [];

  dump.stdout.on("data", (chunk) => chunks.push(chunk));
  dump.on("error", (error) => reject(error));
  dump.on("close", async (code) => {
    if (code !== 0) {
      reject(new Error(`mysqldump exited ${code}`));
      return;
    }
    await fs.writeFile(target, Buffer.concat(chunks));
    resolve(undefined);
  });
});

const stat = await fs.stat(target);
console.log(`Backup complete (${stat.size} bytes)\n`);
