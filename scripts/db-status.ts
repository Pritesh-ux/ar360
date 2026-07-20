import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";
import fs from "fs/promises";
import path from "path";

loadEnvConfig(process.cwd());

const database = process.env.MYSQL_DATABASE || "arstudio";
const uri = process.env.MYSQL_URL || process.env.DATABASE_URL;

async function main() {
  const connectionOptions = uri
    ? { uri, multipleStatements: true }
    : {
        host: process.env.MYSQL_HOST || "localhost",
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database,
        multipleStatements: true,
      };

  const connection = await mysql.createConnection(connectionOptions as any);

  const migrationsDir = path.resolve(process.cwd(), "database", "migrations");
  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  await connection.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [executedRows]: any = await connection.execute("SELECT name, executed_at FROM migrations ORDER BY name");
  const executed = new Map<string, string>(
    executedRows.map((row: { name: string; executed_at: Date | string }) => [
      row.name,
      row.executed_at instanceof Date ? row.executed_at.toISOString() : String(row.executed_at),
    ]),
  );

  const pending = files.filter((file) => !executed.has(file));

  console.log("=== AR360 Database Migration Status ===");
  console.log(`Database: ${database}`);
  console.log(`Migration files: ${files.length}`);
  console.log(`Executed: ${executed.size}`);
  console.log(`Pending: ${pending.length}`);
  console.log("");

  if (pending.length > 0) {
    console.log("Pending migrations:");
    for (const file of pending) console.log(`  - ${file}`);
    console.log("");
  }

  console.log("Executed migrations:");
  for (const file of files) {
    const stamp = executed.get(file);
    console.log(`  ${stamp ? "✓" : "○"} ${file}${stamp ? ` (${stamp})` : ""}`);
  }

  const tableChecks = [
    "customers",
    "products",
    "billing_plans",
    "customer_subscriptions",
    "billing_payments",
    "billing_invoices",
    "coupons",
    "support_tickets",
    "storage_usage_snapshots",
    "platform_settings",
    "customer_notifications",
    "user_preferences",
    "share_links",
    "share_events",
    "qr_scan_events",
    "payment_methods",
  ];

  console.log("");
  console.log("Key table row counts:");
  for (const table of tableChecks) {
    try {
      const [rows]: any = await connection.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      console.log(`  ${table}: ${Number(rows[0]?.count || 0).toLocaleString("en-IN")}`);
    } catch {
      console.log(`  ${table}: (missing)`);
    }
  }

  await connection.end();

  if (pending.length > 0) {
    console.log("");
    console.log("Run `npm run db:migrate` to apply pending migrations.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("db:status failed:");
  console.error(error);
  process.exit(1);
});
