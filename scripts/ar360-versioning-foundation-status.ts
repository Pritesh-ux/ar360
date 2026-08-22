/**
 * Ops helper: report Phase 1 versioning foundation status (read-only).
 * Does not mutate products, QR, subscriptions, or revision immutability.
 *
 * Run: npx tsx scripts/ar360-versioning-foundation-status.ts
 */
import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";

loadEnvConfig(process.cwd());

type CountRow = { c: number | string };

async function count(sql: string): Promise<number> {
  const rows = await query<CountRow>(sql);
  return Number(rows[0]?.c || 0);
}

async function main() {
  const tables = [
    "ar360_release_channels",
    "ar360_platform_releases",
    "ar360_feature_flags",
    "ar360_product_config_revisions",
  ];

  for (const table of tables) {
    const rows = await query<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
      [table],
    );
    if (!rows[0]) {
      console.log(`MISSING table: ${table}`);
      continue;
    }
    console.log(`OK table: ${table}`);
  }

  const products = await count("SELECT COUNT(*) AS c FROM products");
  const clients = await count("SELECT COUNT(*) AS c FROM clients").catch(() => -1);
  const subscriptions = await count("SELECT COUNT(*) AS c FROM customer_subscriptions").catch(
    () => -1,
  );
  const qr = await count("SELECT COUNT(*) AS c FROM product_qr_codes").catch(() => -1);
  const rev1 = await count(
    "SELECT COUNT(*) AS c FROM ar360_product_config_revisions WHERE revision_number = 1",
  ).catch(() => -1);
  const withPointer = await count(
    "SELECT COUNT(*) AS c FROM products WHERE active_config_revision_id IS NOT NULL",
  ).catch(() => -1);
  const publishedReleases = await count(
    "SELECT COUNT(*) AS c FROM ar360_platform_releases WHERE status = 'published'",
  ).catch(() => -1);
  const enabledFlags = await count(
    "SELECT COUNT(*) AS c FROM ar360_feature_flags WHERE enabled = 1",
  ).catch(() => -1);

  console.log(
    JSON.stringify(
      {
        products,
        clients,
        subscriptions,
        qr,
        revision1Count: rev1,
        productsWithActivePointer: withPointer,
        publishedReleases,
        enabledFeatureFlags: enabledFlags,
        note: "Phase 1 foundation status only. Viewer does not use pointers yet.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
