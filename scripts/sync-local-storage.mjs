/**
 * Recalculate customers.storage_used_mb from disk (local dev).
 * Run: npx tsx scripts/sync-local-storage.mjs
 */
import nextEnv from "@next/env";
import { query } from "../src/lib/db.ts";
import { recalculateCustomerStorage } from "../src/lib/storage.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const rows = await query(
    "SELECT customer_uid FROM customers WHERE customer_uid IS NOT NULL AND customer_uid != ''",
  );

  let totalMb = 0;
  for (const row of rows) {
    const mb = await recalculateCustomerStorage(row.customer_uid).catch(() => 0);
    totalMb += mb;
    if (mb > 0) {
      console.log(`${row.customer_uid}: ${mb.toFixed(2)} MB`);
    }
  }

  console.log(`Synced ${rows.length} customer(s). Total: ${totalMb.toFixed(2)} MB`);
}

main().catch((error) => {
  console.error("sync-local-storage failed:", error.message);
  process.exit(1);
});
