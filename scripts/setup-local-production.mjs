/**
 * Configure local XAMPP to mirror production limits/settings (no VPS deploy).
 * Run: node scripts/setup-local-production.mjs
 */
import nextEnv from "@next/env";
import fs from "fs";
import mysql from "mysql2/promise";
import path from "path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const envPath = path.join(process.cwd(), ".env");
const storageRoot = path.resolve(process.cwd(), "storage", "Customers");

/** Match Hostinger VPS plan: 50 GB disk, 4 TB/month bandwidth (45 GB reserved for customer files). */
const PRODUCTION_LIKE_LIMITS = {
  platformStorageLimitGb: 45,
  platformBandwidthLimitGb: 4096,
};

function upsertEnvLines(content, entries) {
  const lines = content.split(/\r?\n/);
  const keys = new Set(entries.map(([key]) => key));
  const kept = lines.filter((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    return !(match && keys.has(match[1]));
  });
  const block = entries.map(([key, value]) => `${key}=${value}`).join("\n");
  const trimmed = kept.join("\n").replace(/\n+$/, "");
  return `${trimmed}\n\n# Production-like local config (setup-local-production.mjs)\n${block}\n`;
}

async function main() {
  fs.mkdirSync(storageRoot, { recursive: true });

  const envEntries = [
    ["STORAGE_ROOT", storageRoot.replace(/\\/g, "/")],
    ["ASSET_PROXY_ENFORCE", "auto"],
    ["SKIP_RUNTIME_DDL", "false"],
  ];
  fs.writeFileSync(envPath, upsertEnvLines(fs.readFileSync(envPath, "utf8"), envEntries), "utf8");
  loadEnvConfig(process.cwd(), true);

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "arstudio",
  });

  for (const [key, value] of Object.entries(PRODUCTION_LIKE_LIMITS)) {
    await connection.execute(
      `INSERT INTO platform_settings (setting_key, setting_value, is_secret)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [key, String(value)],
    );
  }

  const [customers] = await connection.execute(
    "SELECT customer_uid FROM customers WHERE customer_uid IS NOT NULL AND customer_uid != ''",
  );

  await connection.end();

  console.log("Local production-like setup complete.");
  console.log(`- STORAGE_ROOT: ${storageRoot}`);
  console.log(`- Platform storage limit: ${PRODUCTION_LIKE_LIMITS.platformStorageLimitGb} GB`);
  console.log(`- Platform bandwidth limit: ${PRODUCTION_LIKE_LIMITS.platformBandwidthLimitGb} GB/month (4 TB)`);
  console.log(`- Customers in DB: ${customers.length}`);
  console.log("");
  console.log("Next:");
  console.log("  1. npm run dev");
  console.log("  2. Master Admin -> Storage Manager (refresh)");
  console.log("  3. Upload/re-save a product to sync used storage");
  console.log("");
  console.log("To sync storage totals from disk, run:");
  console.log("  npx tsx scripts/sync-local-storage.mjs");
}

main().catch((error) => {
  console.error("setup-local-production failed:", error.message);
  process.exit(1);
});
