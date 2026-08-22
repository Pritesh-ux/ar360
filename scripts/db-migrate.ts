import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";
import fs from "fs/promises";
import path from "path";

loadEnvConfig(process.cwd());

const database = process.env.MYSQL_DATABASE || "arstudio";
const uri = process.env.MYSQL_URL || process.env.DATABASE_URL;

function escapeSqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

function stripIdentifier(value: string): string {
  return value.replace(/`/g, "");
}

/** MySQL 8.0 does not support ADD COLUMN IF NOT EXISTS — rewrite for idempotent migrations. */
function addColumnIfMissingBlock(table: string, column: string, definition: string): string {
  const tbl = stripIdentifier(table);
  const col = stripIdentifier(column);
  const alterSql = `ALTER TABLE ${tbl} ADD COLUMN ${col} ${definition.trim()}`;
  const escaped = escapeSqlLiteral(alterSql);
  return [
    `SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tbl}' AND COLUMN_NAME = '${col}');`,
    `SET @sql := IF(@has_col = 0, '${escaped}', 'SELECT 1');`,
    `PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;`,
  ].join("\n");
}

function addIndexIfMissingBlock(table: string, indexName: string, columnsPart: string, unique = false): string {
  const tbl = stripIdentifier(table);
  const idx = stripIdentifier(indexName);
  const alterSql = `ALTER TABLE ${tbl} ADD ${unique ? "UNIQUE " : ""}INDEX ${idx} ${columnsPart.trim()}`;
  const escaped = escapeSqlLiteral(alterSql);
  return [
    `SET @has_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tbl}' AND INDEX_NAME = '${idx}');`,
    `SET @sql := IF(@has_idx = 0, '${escaped}', 'SELECT 1');`,
    `PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;`,
  ].join("\n");
}

function dropIndexIfExistsBlock(table: string, indexName: string): string {
  const tbl = stripIdentifier(table);
  const idx = stripIdentifier(indexName);
  const alterSql = `ALTER TABLE ${tbl} DROP INDEX ${idx}`;
  const escaped = escapeSqlLiteral(alterSql);
  return [
    `SET @has_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tbl}' AND INDEX_NAME = '${idx}');`,
    `SET @sql := IF(@has_idx > 0, '${escaped}', 'SELECT 1');`,
    `PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;`,
  ].join("\n");
}

function expandAlterTableBody(table: string, body: string): string {
  const blocks: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/,\s*$/, "");
    if (!line) continue;

    const dropMatch = line.match(/^DROP\s+INDEX\s+IF\s+EXISTS\s+(`?\w+`?)$/i);
    if (dropMatch) {
      blocks.push(dropIndexIfExistsBlock(table, dropMatch[1]));
      continue;
    }

    const columnMatch = line.match(/^ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(`?\w+`?)\s+(.+)$/i);
    if (columnMatch) {
      blocks.push(addColumnIfMissingBlock(table, columnMatch[1], columnMatch[2]));
      continue;
    }

    const uniqueIndexMatch = line.match(/^ADD\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(`?\w+`?)\s*(\(.+\))$/i);
    if (uniqueIndexMatch) {
      blocks.push(addIndexIfMissingBlock(table, uniqueIndexMatch[1], uniqueIndexMatch[2], true));
      continue;
    }

    const indexMatch = line.match(/^ADD\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(`?\w+`?)\s*(\(.+\))$/i);
    if (indexMatch) {
      blocks.push(addIndexIfMissingBlock(table, indexMatch[1], indexMatch[2]));
    }
  }
  return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}

export function normalizeMySqlMigration(sql: string): string {
  let normalized = sql;

  // Single-line ALTER statements only (^ anchor avoids re-processing generated PREPARE blocks).
  normalized = normalized.replace(
    /^[ \t]*ALTER\s+TABLE\s+(`?\w+`?)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(`?\w+`?)\s+([^;\n]+);[ \t]*$/gim,
    (_, table, column, definition) => `${addColumnIfMissingBlock(table, column, definition)}\n`,
  );

  normalized = normalized.replace(
    /^[ \t]*ALTER\s+TABLE\s+(`?\w+`?)\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)(`?\w+`?)\s+([^;\n]+);[ \t]*$/gim,
    (_, table, column, definition) => `${addColumnIfMissingBlock(table, column, definition)}\n`,
  );

  normalized = normalized.replace(
    /^[ \t]*ALTER\s+TABLE\s+(`?\w+`?)\s+ADD\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(`?\w+`?)\s*(\([^)]+\));[ \t]*$/gim,
    (_, table, indexName, columnsPart) => `${addIndexIfMissingBlock(table, indexName, columnsPart)}\n`,
  );

  normalized = normalized.replace(
    /^[ \t]*ALTER\s+TABLE\s+(`?\w+`?)\s+ADD\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(`?\w+`?)\s*(\([^)]+\));[ \t]*$/gim,
    (_, table, indexName, columnsPart) => `${addIndexIfMissingBlock(table, indexName, columnsPart, true)}\n`,
  );

  normalized = normalized.replace(
    /^[ \t]*ALTER\s+TABLE\s+(`?\w+`?)\s+DROP\s+INDEX\s+IF\s+EXISTS\s+(`?\w+`?);[ \t]*$/gim,
    (_, table, indexName) => `${dropIndexIfExistsBlock(table, indexName)}\n`,
  );

  // CREATE [UNIQUE] INDEX IF NOT EXISTS — MySQL 8.0 has no IF NOT EXISTS for indexes.
  normalized = normalized.replace(
    /CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(`?\w+`?)\s*\n\s*ON\s+(`?\w+`?)\s*(\([^)]+\));/gi,
    (_, unique, indexName, table, columnsPart) =>
      `${addIndexIfMissingBlock(table, indexName, columnsPart, Boolean(unique?.trim()))}\n`,
  );

  normalized = normalized.replace(
    /^[ \t]*CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(`?\w+`?)\s+ON\s+(`?\w+`?)\s*(\([^)]+\));[ \t]*$/gim,
    (_, unique, indexName, table, columnsPart) =>
      `${addIndexIfMissingBlock(table, indexName, columnsPart, Boolean(unique?.trim()))}\n`,
  );

  // Multi-line ALTER blocks (DROP INDEX / ADD COLUMN / ADD INDEX per line).
  normalized = normalized.replace(
    /ALTER\s+TABLE\s+(`?\w+`?)\s*\n((?:[ \t]+(?:DROP\s+INDEX\s+IF\s+EXISTS|ADD\s+(?:UNIQUE\s+)?(?:COLUMN|INDEX)\s+IF\s+NOT\s+EXISTS)[^\n]*\n?)+);/gi,
    (_, table, body) => expandAlterTableBody(table, body),
  );

  return normalized;
}

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

  const connection = await mysql.createConnection(connectionOptions as mysql.ConnectionOptions);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const migrationsDir = path.resolve(process.cwd(), "database", "migrations");
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

  console.log(`Found ${sqlFiles.length} migration files.`);

  for (const file of sqlFiles) {
    const [rows] = await connection.execute<Array<{ id: number }>>(
      "SELECT id FROM migrations WHERE name = ? LIMIT 1",
      [file],
    );
    if (rows.length > 0) {
      console.log(`Migration ${file} already executed. Skipping.`);
      continue;
    }

    console.log(`Executing migration ${file}...`);
    const sqlPath = path.join(migrationsDir, file);
    const sqlContent = await fs.readFile(sqlPath, "utf-8");

    if (sqlContent.trim()) {
      const normalized = normalizeMySqlMigration(sqlContent);
      await connection.query(normalized);
    }

    await connection.execute("INSERT INTO migrations (name) VALUES (?)", [file]);
    console.log(`Migration ${file} completed successfully.`);
  }

  await connection.end();
  console.log("All migrations executed successfully.");
}

main().catch((error) => {
  console.error("Migration failed:");
  console.error(error);
  process.exit(1);
});
