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

  // Ensure migrations table exists
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
    const [rows]: any = await connection.execute("SELECT id FROM migrations WHERE name = ? LIMIT 1", [file]);
    if (rows.length > 0) {
      console.log(`Migration ${file} already executed. Skipping.`);
      continue;
    }

    console.log(`Executing migration ${file}...`);
    const sqlPath = path.join(migrationsDir, file);
    const sqlContent = await fs.readFile(sqlPath, "utf-8");

    if (sqlContent.trim()) {
      await connection.query(sqlContent);
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
