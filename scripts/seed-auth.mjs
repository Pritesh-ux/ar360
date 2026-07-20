import nextEnv from "@next/env";
import mysql from "mysql2/promise";
import { randomBytes, scryptSync } from "crypto";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const database = process.env.MYSQL_DATABASE || "arstudio";
const uri = process.env.MYSQL_URL || process.env.DATABASE_URL;

const customerEmail = (process.env.SEED_CUSTOMER_EMAIL || "customer@arstudio.local").toLowerCase();
const customerPassword = process.env.SEED_CUSTOMER_PASSWORD || "Customer@12345";
const customerName = process.env.SEED_CUSTOMER_NAME || "Demo Customer";
const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@arstudio.local").toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
const adminName = process.env.SEED_ADMIN_NAME || "Master Admin";

function escapeIdentifier(value) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

function userUid() {
  return `USR-${randomBytes(10).toString("hex").toUpperCase()}`;
}

function adminUid() {
  return `ADM-${randomBytes(10).toString("hex").toUpperCase()}`;
}

function customerUid() {
  return `CUS-${Math.floor(100000 + Math.random() * 899999)}`;
}

async function ensureDatabase() {
  if (uri) return;
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
}

async function addColumnIfMissing(connection, table, column, definition) {
  const [[{ total }]] = await connection.execute(
    "SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  if (Number(total) === 0) await connection.query(`ALTER TABLE ${escapeIdentifier(table)} ADD COLUMN ${escapeIdentifier(column)} ${definition}`);
}

async function addIndexIfMissing(connection, table, indexName, sql) {
  const [[{ total }]] = await connection.execute(
    "SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
    [table, indexName],
  );
  if (Number(total) === 0) await connection.query(sql);
}

async function ensureSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS master_admins (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      admin_uid VARCHAR(191) NULL,
      name VARCHAR(160) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      status ENUM('Active','Disabled') NOT NULL DEFAULT 'Active',
      two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      two_factor_code_hash VARCHAR(255) NULL,
      two_factor_expires_at DATETIME NULL,
      two_factor_attempts INT NOT NULL DEFAULT 0,
      last_login_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_master_admins_email (email),
      UNIQUE KEY uq_master_admins_admin_uid (admin_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_uid VARCHAR(191) NULL,
      name VARCHAR(160) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      status ENUM('Active','Suspended','Deleted') NOT NULL DEFAULT 'Active',
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      two_factor_code_hash VARCHAR(255) NULL,
      two_factor_expires_at DATETIME NULL,
      two_factor_attempts INT NOT NULL DEFAULT 0,
      last_login_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_email (email),
      UNIQUE KEY uq_users_user_uid (user_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS auth_login_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_type ENUM('customer','master_admin') NOT NULL,
      actor_id BIGINT UNSIGNED NULL,
      email VARCHAR(255) NOT NULL DEFAULT '',
      status ENUM('success','failed','blocked') NOT NULL,
      reason VARCHAR(255) NOT NULL DEFAULT '',
      ip_hash VARCHAR(64) NOT NULL DEFAULT '',
      user_agent VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_auth_login_logs_actor (actor_type, actor_id),
      INDEX idx_auth_login_logs_email (email),
      INDEX idx_auth_login_logs_status (status),
      INDEX idx_auth_login_logs_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      customer_uid VARCHAR(40) NOT NULL,
      company_name VARCHAR(180) NULL,
      contact_name VARCHAR(160) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(60) NULL,
      country VARCHAR(100) NULL,
      plan_id VARCHAR(80) NOT NULL DEFAULT 'free',
      status ENUM('Active','Suspended','Deleted') NOT NULL DEFAULT 'Active',
      storage_used_mb DECIMAL(12,2) NOT NULL DEFAULT 0,
      bandwidth_used_mb DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_customers_user_id (user_id),
      UNIQUE KEY uq_customers_customer_uid (customer_uid),
      INDEX idx_customers_email (email),
      INDEX idx_customers_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(connection, "master_admins", "admin_uid", "VARCHAR(191) NULL");
  await addColumnIfMissing(connection, "users", "user_uid", "VARCHAR(191) NULL");
  await addColumnIfMissing(connection, "users", "role", "ENUM('user','admin') NOT NULL DEFAULT 'user'");

  await addIndexIfMissing(connection, "master_admins", "uq_master_admins_email", "ALTER TABLE master_admins ADD UNIQUE INDEX uq_master_admins_email (email)");
  await addIndexIfMissing(connection, "master_admins", "uq_master_admins_admin_uid", "ALTER TABLE master_admins ADD UNIQUE INDEX uq_master_admins_admin_uid (admin_uid)");
  await addIndexIfMissing(connection, "users", "uq_users_email", "ALTER TABLE users ADD UNIQUE INDEX uq_users_email (email)");
  await addIndexIfMissing(connection, "users", "uq_users_user_uid", "ALTER TABLE users ADD UNIQUE INDEX uq_users_user_uid (user_uid)");
  await addIndexIfMissing(connection, "customers", "uq_customers_user_id", "ALTER TABLE customers ADD UNIQUE INDEX uq_customers_user_id (user_id)");
  await addIndexIfMissing(connection, "customers", "uq_customers_customer_uid", "ALTER TABLE customers ADD UNIQUE INDEX uq_customers_customer_uid (customer_uid)");
}

async function main() {
  await ensureDatabase();

  const connection = uri
    ? await mysql.createConnection(uri)
    : await mysql.createConnection({
        host: process.env.MYSQL_HOST || "127.0.0.1",
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database,
      });

  await ensureSchema(connection);

  await connection.execute(
    `INSERT INTO master_admins (admin_uid, name, email, password_hash, status, two_factor_enabled)
     VALUES (?, ?, ?, ?, 'Active', FALSE)
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), status = 'Active', two_factor_enabled = FALSE`,
    [adminUid(), adminName, adminEmail, hashPassword(adminPassword)],
  );

  await connection.execute(
    `INSERT INTO users (user_uid, name, email, password_hash, role, status, email_verified, two_factor_enabled)
     VALUES (?, ?, ?, ?, 'user', 'Active', TRUE, FALSE)
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), status = 'Active', two_factor_enabled = FALSE`,
    [userUid(), customerName, customerEmail, hashPassword(customerPassword)],
  );

  const [[customerUser]] = await connection.execute("SELECT id, name, email FROM users WHERE email = ? LIMIT 1", [customerEmail]);
  const [[existingCustomer]] = await connection.execute("SELECT customer_uid FROM customers WHERE user_id = ? LIMIT 1", [customerUser.id]);

  if (!existingCustomer) {
    await connection.execute(
      "INSERT INTO customers (user_id, customer_uid, contact_name, email, plan_id, status) VALUES (?, ?, ?, ?, 'free', 'Active')",
      [customerUser.id, customerUid(), customerUser.name, customerUser.email],
    );
  }

  await connection.end();

  console.log("Customer account ready:");
  console.log(`Email: ${customerEmail}`);
  console.log(`Password: ${customerPassword}`);
  console.log("");
  console.log("Master admin account ready:");
  console.log(`Email: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
}

main().catch((error) => {
  console.error("Auth seed failed:");
  console.error(error);
  process.exit(1);
});
