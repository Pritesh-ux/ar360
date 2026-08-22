/**
 * Apply default landing navbar to website_navigation (keeps footer links).
 * Run: node scripts/sync-landing-navigation.mjs
 */
import nextEnv from "@next/env";
import mysql from "mysql2/promise";
import { DEFAULT_LANDING_NAVBAR, DEFAULT_LANDING_FOOTER } from "../src/lib/website/default-navigation.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "arstudio",
  });

  await connection.execute("DELETE FROM website_navigation WHERE menu_type = 'navbar'");

  for (const item of DEFAULT_LANDING_NAVBAR) {
    await connection.execute(
      `INSERT INTO website_navigation (nav_uid, menu_type, label, link_url, sort_order, visibility)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE label = VALUES(label), link_url = VALUES(link_url), sort_order = VALUES(sort_order), visibility = 1`,
      [item.uid, item.type, item.label, item.url, item.order],
    );
  }

  for (const item of DEFAULT_LANDING_FOOTER) {
    await connection.execute(
      `INSERT INTO website_navigation (nav_uid, menu_type, label, link_url, sort_order, visibility)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE label = VALUES(label), link_url = VALUES(link_url), sort_order = VALUES(sort_order), visibility = 1`,
      [item.uid, item.type, item.label, item.url, item.order],
    );
  }

  const [rows] = await connection.execute(
    "SELECT label, link_url, sort_order FROM website_navigation WHERE menu_type = 'navbar' ORDER BY sort_order",
  );

  await connection.end();

  console.log("Landing navbar updated in Master Admin CMS:");
  for (const row of rows) {
    console.log(`  ${row.sort_order}. ${row.label} → ${row.link_url}`);
  }
  console.log("\nRefresh http://localhost:3000/ to see the header.");
}

main().catch((error) => {
  console.error("sync-landing-navigation failed:", error.message);
  process.exit(1);
});
