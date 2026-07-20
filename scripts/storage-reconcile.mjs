/**
 * Admin-safe storage reconciliation report.
 * Usage: node scripts/storage-reconcile.mjs [--customer=<uid>]
 */
import mysql from "mysql2/promise";

const customerFilter = process.argv.find((arg) => arg.startsWith("--customer="))?.split("=")[1] || null;

function env(name, fallback) {
  return process.env[name] || fallback;
}

async function main() {
  const conn = await mysql.createConnection({
    host: env("MYSQL_HOST", "127.0.0.1"),
    port: Number(env("MYSQL_PORT", "3306")),
    user: env("MYSQL_USER", "root"),
    password: env("MYSQL_PASSWORD", ""),
    database: env("MYSQL_DATABASE", "ar360"),
  });

  const where = customerFilter ? "WHERE a.customer_uid = ?" : "";
  const params = customerFilter ? [customerFilter] : [];

  const [assets] = await conn.query(
    `SELECT a.id, a.customer_uid, a.product_uid, a.file_path, a.size_bytes, a.status, a.deleted_at
       FROM product_assets a
       ${where}
      ORDER BY a.customer_uid, a.product_uid`,
    params,
  );

  const [totals] = await conn.query(
    `SELECT customer_uid, COALESCE(SUM(size_bytes), 0) AS total_bytes, COUNT(*) AS asset_count
       FROM product_assets
       ${customerFilter ? "WHERE customer_uid = ? AND (deleted_at IS NULL)" : "WHERE deleted_at IS NULL"}
      GROUP BY customer_uid`,
    customerFilter ? [customerFilter] : [],
  );

  const missingSize = assets.filter((row) => !row.size_bytes || Number(row.size_bytes) <= 0);
  const deletedWithSize = assets.filter((row) => row.deleted_at && Number(row.size_bytes) > 0);

  console.log("=== AR360 Storage Reconciliation Report ===");
  console.log(`Assets scanned: ${assets.length}`);
  console.log(`Customers with active assets: ${totals.length}`);
  console.log(`Assets missing size_bytes: ${missingSize.length}`);
  console.log(`Soft-deleted assets still counted: ${deletedWithSize.length}`);
  console.log("");
  console.log("Per-customer totals (active assets):");
  for (const row of totals) {
    const gb = (Number(row.total_bytes) / (1024 ** 3)).toFixed(3);
    console.log(`  ${row.customer_uid}: ${row.asset_count} assets, ${gb} GB`);
  }

  if (missingSize.length) {
    console.log("");
    console.log("Assets needing size_bytes backfill:");
    for (const row of missingSize.slice(0, 20)) {
      console.log(`  #${row.id} ${row.customer_uid}/${row.product_uid} path=${row.file_path || "n/a"}`);
    }
    if (missingSize.length > 20) console.log(`  ... and ${missingSize.length - 20} more`);
  }

  await conn.end();
}

main().catch((error) => {
  console.error("Reconciliation failed:", error);
  process.exit(1);
});
