import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";

loadEnvConfig(process.cwd());

const database = process.env.MYSQL_DATABASE || "arstudio";
const uri = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQL_URL_EMPTY;

function escapeIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

async function main() {
  if (!uri) {
    const rootConnection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || "localhost",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
    });

    await rootConnection.query(
      `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await rootConnection.end();
  }

  const connection = uri
    ? await mysql.createConnection(uri)
    : await mysql.createConnection({
        host: process.env.MYSQL_HOST || "localhost",
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database,
      });

  await connection.query("SELECT 1");
  await connection.end();

  console.log(`MySQL connection OK (${database})`);
}

main().catch((error) => {
  console.error("MySQL connection failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
