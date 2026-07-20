import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";

loadEnvConfig(process.cwd());

const uri = process.env.MYSQL_URL || process.env.DATABASE_URL;
const connectionOptions = uri
  ? { uri, multipleStatements: true }
  : {
      host: process.env.MYSQL_HOST || "localhost",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "arstudio",
      multipleStatements: true,
    };

const conn = await mysql.createConnection(connectionOptions);
const [cols] = await conn.query(
  "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'session_version'",
);
if (!Array.isArray(cols) || cols.length === 0) {
  await conn.query("ALTER TABLE users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 1");
  console.log("Added users.session_version");
} else {
  console.log("users.session_version already exists");
}
await conn.end();
