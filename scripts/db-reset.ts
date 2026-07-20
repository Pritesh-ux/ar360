import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";
import { execSync } from "child_process";

loadEnvConfig(process.cwd());

const database = process.env.MYSQL_DATABASE || "arstudio";
const isProduction = process.env.NODE_ENV === "production";
const isAllowed = process.env.RESET_DATABASE_ALLOWED === "true";

function escapeIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

async function main() {
  if (isProduction && !isAllowed) {
    console.error("CRITICAL ERROR: Database reset is blocked in production environment.");
    console.error("To bypass, set RESET_DATABASE_ALLOWED=true in your environment.");
    process.exit(1);
  }

  console.log(`Resetting database "${database}"...`);

  // Connect to MySQL server to drop/create database
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
  });

  console.log(`Dropping database "${database}"...`);
  await connection.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(database)}`);

  console.log(`Creating database "${database}"...`);
  await connection.query(
    `CREATE DATABASE ${escapeIdentifier(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );

  await connection.end();
  console.log("Database recreated successfully.");

  // Execute migrations
  console.log("Running migrations...");
  execSync("npx tsx scripts/db-migrate.ts", { stdio: "inherit" });

  // Execute seeders
  console.log("Running seeders...");
  execSync("npx tsx scripts/db-seed.ts", { stdio: "inherit" });

  console.log("Database reset completed successfully.");
}

main().catch((error) => {
  console.error("Database reset failed:");
  console.error(error);
  process.exit(1);
});
