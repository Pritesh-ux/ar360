import fs from "node:fs/promises";
import path from "node:path";
import { loadProjectEnv } from "./lib/env-utils.mjs";

loadProjectEnv();

const sourceRoot = path.resolve(
  process.argv[2] || process.env.STORAGE_ROOT || path.join(process.cwd(), "storage", "Customers"),
);
const outDir = path.resolve(process.argv[3] || path.join(process.cwd(), "backups", "storage"));
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(outDir, `customers-${stamp}`);

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

console.log(`Backing up customer storage`);
console.log(`  from: ${sourceRoot}`);
console.log(`  to:   ${target}`);

try {
  await fs.access(sourceRoot);
} catch {
  console.error(`Source directory not found: ${sourceRoot}`);
  process.exit(1);
}

await fs.mkdir(outDir, { recursive: true });
await copyDir(sourceRoot, target);

console.log("\nStorage backup complete.\n");
