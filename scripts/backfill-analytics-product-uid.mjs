/**
 * One-shot backfill: normalize analytics_events.product_uid → products.id
 * and rebuild analytics_daily from events (app timezone = DB session).
 *
 * Usage: node --import tsx scripts/backfill-analytics-product-uid.mjs
 *     or: npx tsx scripts/backfill-analytics-product-uid.ts
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function main() {
  // Lazy load after env so dotenv from db still works if present
  const { query } = await import("../src/lib/db.ts").catch(async () => {
    // Fallback for compiled/mjs runners
    return require("../src/lib/db");
  });

  console.log("[backfill] normalizing analytics_events.product_uid → products.id");

  // Match public_id / viewer_slug to internal id (skip already-correct ids)
  const updatedPublic = await query(
    `UPDATE analytics_events e
       INNER JOIN products p ON p.public_id = e.product_uid
       SET e.product_uid = p.id
     WHERE e.product_uid <> p.id`,
  );
  console.log("[backfill] public_id matches updated:", updatedPublic);

  const updatedSlug = await query(
    `UPDATE analytics_events e
       INNER JOIN products p ON p.viewer_slug = e.product_uid
       SET e.product_uid = p.id
     WHERE e.product_uid <> p.id`,
  );
  console.log("[backfill] viewer_slug matches updated:", updatedSlug);

  // Sessions
  await query(
    `UPDATE analytics_sessions s
       INNER JOIN products p ON p.public_id = s.product_uid
       SET s.product_uid = p.id
     WHERE s.product_uid <> p.id`,
  );
  await query(
    `UPDATE analytics_sessions s
       INNER JOIN products p ON p.viewer_slug = s.product_uid
       SET s.product_uid = p.id
     WHERE s.product_uid <> p.id`,
  );

  // Canonicalize legacy event names
  await query(`UPDATE analytics_events SET event = 'qr_scan' WHERE event = 'download_qr'`);
  await query(`UPDATE analytics_events SET event = 'open_embed' WHERE event = 'embed_open'`);

  console.log("[backfill] rebuilding analytics_daily from events");
  await query(`DELETE FROM analytics_daily`);

  await query(
    `INSERT INTO analytics_daily
       (customer_uid, product_uid, date, views, unique_visitors, ar_launches,
        screenshots, shares, copy_links, qr_scans, avg_duration)
     SELECT
       e.customer_uid,
       e.product_uid,
       DATE(e.created_at) AS date,
       SUM(e.event = 'viewer_open') AS views,
       COUNT(DISTINCT e.ip_hash) AS unique_visitors,
       SUM(e.event = 'ar_launch_success') AS ar_launches,
       SUM(e.event = 'screenshot') AS screenshots,
       SUM(e.event IN ('share_native', 'share_view')) AS shares,
       SUM(e.event = 'copy_link') AS copy_links,
       SUM(e.event IN ('qr_scan', 'download_qr')) AS qr_scans,
       0 AS avg_duration
     FROM analytics_events e
     GROUP BY e.customer_uid, e.product_uid, DATE(e.created_at)`,
  );

  // Best-effort embed_views column if present
  try {
    await query(
      `UPDATE analytics_daily d
       INNER JOIN (
         SELECT customer_uid, product_uid, DATE(created_at) AS date,
                SUM(event IN ('open_embed','embed_open')) AS embed_views
         FROM analytics_events
         GROUP BY customer_uid, product_uid, DATE(created_at)
       ) s ON s.customer_uid = d.customer_uid
          AND s.product_uid = d.product_uid
          AND s.date = d.date
       SET d.embed_views = s.embed_views`,
    );
  } catch {
    console.log("[backfill] embed_views column skipped (missing or unsupported)");
  }

  console.log("[backfill] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill] failed", err);
  process.exit(1);
});
