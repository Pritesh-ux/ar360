import mysql from "mysql2/promise";

export type QueryValue = string | number | boolean | Date | null;

const globalForMysql = globalThis as typeof globalThis & {
  mysqlPool?: mysql.Pool;
  mysqlDatabaseReady?: boolean;
};

function getDatabaseUrl() {
  return process.env.MYSQL_URL || process.env.DATABASE_URL;
}

function escapeIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

async function ensureDatabase() {
  if (globalForMysql.mysqlDatabaseReady || getDatabaseUrl()) return;

  const database = process.env.MYSQL_DATABASE || "arstudio";
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.end();
  globalForMysql.mysqlDatabaseReady = true;
}

function createPool() {
  const uri = getDatabaseUrl();

  if (uri) {
    return mysql.createPool({ uri, waitForConnections: true, connectionLimit: 10 });
  }

  return mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "arstudio",
    waitForConnections: true,
    connectionLimit: 10,
  });
}

export async function getPool() {
  await ensureDatabase();
  if (!globalForMysql.mysqlPool) globalForMysql.mysqlPool = createPool();
  return globalForMysql.mysqlPool;
}

export async function query<T>(sql: string, values: QueryValue[] = []): Promise<T[]> {
  const pool = await getPool();
  const [rows] = await pool.execute(sql, values);
  return rows as T[];
}

async function addIndexIfMissing(table: string, index: string, sql: string) {
  if (shouldSkipRuntimeDdl()) return;
  const [{ total = 0 } = { total: 0 }] = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
    [table, index],
  );
  if (Number(total) === 0) await query(sql);
}

/** When true, runtime CREATE/ALTER is skipped — apply database/migrations instead. */
function shouldSkipRuntimeDdl(): boolean {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  if (shouldSkipRuntimeDdl()) return;
  const [{ total = 0 } = { total: 0 }] = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  if (Number(total) === 0) await query(`ALTER TABLE ${escapeIdentifier(table)} ADD COLUMN ${escapeIdentifier(column)} ${definition}`);
}

export async function ensureAuthSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();

  await query(`
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

  await query(`
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

  await query(`
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

  await query(`
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

  // Safe additive migrations only. These do not change primary key types.
  // If your old local table was UUID/VARCHAR based, reset the local DB once with the SQL I give you.
  await addColumnIfMissing("master_admins", "admin_uid", "VARCHAR(191) NULL");
  await addColumnIfMissing("master_admins", "last_login_at", "DATETIME NULL");

  await addColumnIfMissing("users", "user_uid", "VARCHAR(191) NULL");
  await addColumnIfMissing("users", "name", "VARCHAR(160) NOT NULL DEFAULT ''");
  await addColumnIfMissing("users", "role", "ENUM('user','admin') NOT NULL DEFAULT 'user'");
  await addColumnIfMissing("users", "status", "ENUM('Active','Suspended','Deleted') NOT NULL DEFAULT 'Active'");
  await addColumnIfMissing("users", "email_verified", "BOOLEAN NOT NULL DEFAULT FALSE");
  await addColumnIfMissing("users", "two_factor_enabled", "BOOLEAN NOT NULL DEFAULT FALSE");
  await addColumnIfMissing("users", "two_factor_code_hash", "VARCHAR(255) NULL");
  await addColumnIfMissing("users", "two_factor_expires_at", "DATETIME NULL");
  await addColumnIfMissing("users", "two_factor_attempts", "INT NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "last_login_at", "DATETIME NULL");

  await addColumnIfMissing("customers", "user_id", "BIGINT UNSIGNED NULL");
  await addColumnIfMissing("customers", "customer_uid", "VARCHAR(40) NULL");
  await addColumnIfMissing("customers", "company_name", "VARCHAR(180) NULL");
  await addColumnIfMissing("customers", "contact_name", "VARCHAR(160) NULL");
  await addColumnIfMissing("customers", "email", "VARCHAR(255) NULL");
  await addColumnIfMissing("customers", "phone", "VARCHAR(60) NULL");
  await addColumnIfMissing("customers", "country", "VARCHAR(100) NULL");
  await addColumnIfMissing("customers", "plan_id", "VARCHAR(80) NOT NULL DEFAULT 'free'");
  await addColumnIfMissing("customers", "status", "ENUM('Active','Suspended','Deleted') NOT NULL DEFAULT 'Active'");
  await addColumnIfMissing("customers", "storage_used_mb", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await addColumnIfMissing("customers", "bandwidth_used_mb", "DECIMAL(12,2) NOT NULL DEFAULT 0");

  await addIndexIfMissing("master_admins", "uq_master_admins_email", "ALTER TABLE master_admins ADD UNIQUE INDEX uq_master_admins_email (email)");
  await addIndexIfMissing("master_admins", "uq_master_admins_admin_uid", "ALTER TABLE master_admins ADD UNIQUE INDEX uq_master_admins_admin_uid (admin_uid)");
  await addIndexIfMissing("users", "uq_users_email", "ALTER TABLE users ADD UNIQUE INDEX uq_users_email (email)");
  await addIndexIfMissing("users", "uq_users_user_uid", "ALTER TABLE users ADD UNIQUE INDEX uq_users_user_uid (user_uid)");
  await addIndexIfMissing("customers", "uq_customers_user_id", "ALTER TABLE customers ADD UNIQUE INDEX uq_customers_user_id (user_id)");
  await addIndexIfMissing("customers", "uq_customers_customer_uid", "ALTER TABLE customers ADD UNIQUE INDEX uq_customers_customer_uid (customer_uid)");
  await addIndexIfMissing("auth_login_logs", "idx_auth_login_logs_actor", "ALTER TABLE auth_login_logs ADD INDEX idx_auth_login_logs_actor (actor_type, actor_id)");
  await addIndexIfMissing("auth_login_logs", "idx_auth_login_logs_email", "ALTER TABLE auth_login_logs ADD INDEX idx_auth_login_logs_email (email)");
  await addIndexIfMissing("auth_login_logs", "idx_auth_login_logs_status", "ALTER TABLE auth_login_logs ADD INDEX idx_auth_login_logs_status (status)");
  await addIndexIfMissing("auth_login_logs", "idx_auth_login_logs_created", "ALTER TABLE auth_login_logs ADD INDEX idx_auth_login_logs_created (created_at)");
}

export async function ensureProductSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(160) PRIMARY KEY,
      user_id BIGINT UNSIGNED NULL,
      customer_uid VARCHAR(40) NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(160) NULL,
      model_url TEXT NULL,
      file_name VARCHAR(255) NULL,
      poster LONGTEXT NULL,
      thumbnail_url TEXT NULL,
      qr_url TEXT NULL,
      product_folder TEXT NULL,
      status ENUM('Draft', 'draft', 'published') NOT NULL DEFAULT 'Draft',
      views INT NOT NULL DEFAULT 0,
      settings JSON NULL,
      material_settings JSON NULL,
      variants JSON NULL,
      hotspots JSON NULL,
      viewer_slug VARCHAR(180) NULL,
      public_id VARCHAR(180) NULL,
      version INT NOT NULL DEFAULT 1,
      published_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_products_user_id (user_id),
      INDEX idx_products_customer_uid (customer_uid),
      INDEX idx_products_public_id (public_id),
      INDEX idx_products_viewer_slug (viewer_slug)
    )
  `);
  await addColumnIfMissing("products", "customer_uid", "VARCHAR(40) NULL");
  await addColumnIfMissing("products", "thumbnail_url", "TEXT NULL");
  await addColumnIfMissing("products", "qr_url", "TEXT NULL");
  await addColumnIfMissing("products", "product_folder", "TEXT NULL");
  await addColumnIfMissing("products", "tags", "JSON NULL");
  await addColumnIfMissing("products", "deleted_at", "DATETIME NULL");
  await addColumnIfMissing("products", "archived_at", "DATETIME NULL");
  await addColumnIfMissing("products", "processing_error", "VARCHAR(512) NULL");
  await addColumnIfMissing("products", "description", "TEXT NULL");
  await addColumnIfMissing("products", "last_editor_user_id", "BIGINT UNSIGNED NULL");
}

export async function ensurePlanSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();
  await query(`
    CREATE TABLE IF NOT EXISTS plans (
      id VARCHAR(80) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT NULL,
      monthly_price INT NOT NULL DEFAULT 0,
      yearly_price INT NOT NULL DEFAULT 0,
      products VARCHAR(80) NOT NULL DEFAULT '0',
      storage VARCHAR(80) NOT NULL DEFAULT '',
      bandwidth VARCHAR(80) NOT NULL DEFAULT '',
      views VARCHAR(80) NOT NULL DEFAULT '',
      team_members VARCHAR(80) NOT NULL DEFAULT '1',
      analytics VARCHAR(120) NOT NULL DEFAULT 'Basic',
      api_access BOOLEAN NOT NULL DEFAULT FALSE,
      custom_branding BOOLEAN NOT NULL DEFAULT FALSE,
      white_label BOOLEAN NOT NULL DEFAULT FALSE,
      support VARCHAR(160) NOT NULL DEFAULT 'Email',
      status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
      popular BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

export async function ensureAnalyticsSchema(): Promise<void> {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();

  await query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      customer_uid VARCHAR(40) NOT NULL DEFAULT '',
      product_uid VARCHAR(160) NOT NULL DEFAULT '',
      session_id VARCHAR(64) NOT NULL DEFAULT '',
      event VARCHAR(60) NOT NULL,
      device VARCHAR(20) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
      os VARCHAR(20) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      city VARCHAR(120) NOT NULL DEFAULT '',
      language VARCHAR(20) NOT NULL DEFAULT '',
      screen_width SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      screen_height SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      referrer VARCHAR(255) NOT NULL DEFAULT '',
      url VARCHAR(512) NOT NULL DEFAULT '',
      ip_hash VARCHAR(32) NOT NULL DEFAULT '',
      meta JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_ae_customer (customer_uid),
      INDEX idx_ae_product (product_uid),
      INDEX idx_ae_session (session_id),
      INDEX idx_ae_event (event),
      INDEX idx_ae_created (created_at),
      INDEX idx_ae_customer_product (customer_uid, product_uid),
      INDEX idx_ae_customer_created (customer_uid, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS analytics_sessions (
      session_id VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(40) NOT NULL DEFAULT '',
      product_uid VARCHAR(160) NOT NULL DEFAULT '',
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME NULL,
      duration INT UNSIGNED NULL,
      device VARCHAR(20) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
      os VARCHAR(20) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      city VARCHAR(120) NOT NULL DEFAULT '',
      PRIMARY KEY (session_id),
      INDEX idx_as_customer (customer_uid),
      INDEX idx_as_product (product_uid),
      INDEX idx_as_started (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS analytics_daily (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      customer_uid VARCHAR(40) NOT NULL DEFAULT '',
      product_uid VARCHAR(160) NOT NULL DEFAULT '',
      date DATE NOT NULL,
      views INT UNSIGNED NOT NULL DEFAULT 0,
      unique_visitors INT UNSIGNED NOT NULL DEFAULT 0,
      ar_launches INT UNSIGNED NOT NULL DEFAULT 0,
      screenshots INT UNSIGNED NOT NULL DEFAULT 0,
      shares INT UNSIGNED NOT NULL DEFAULT 0,
      copy_links INT UNSIGNED NOT NULL DEFAULT 0,
      qr_scans INT UNSIGNED NOT NULL DEFAULT 0,
      share_views INT UNSIGNED NOT NULL DEFAULT 0,
      embed_views INT UNSIGNED NOT NULL DEFAULT 0,
      cta_clicks INT UNSIGNED NOT NULL DEFAULT 0,
      avg_duration INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ad_customer_product_date (customer_uid, product_uid, date),
      INDEX idx_ad_customer (customer_uid),
      INDEX idx_ad_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing("analytics_daily", "share_views", "INT UNSIGNED NOT NULL DEFAULT 0");
  await addColumnIfMissing("analytics_daily", "embed_views", "INT UNSIGNED NOT NULL DEFAULT 0");
  await addColumnIfMissing("analytics_daily", "cta_clicks", "INT UNSIGNED NOT NULL DEFAULT 0");
}

export async function ensureAdminSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();

  await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      payment_uid VARCHAR(80) NOT NULL,
      customer_uid VARCHAR(40) NOT NULL,
      invoice VARCHAR(80) NOT NULL DEFAULT '',
      plan_id VARCHAR(80) NOT NULL DEFAULT '',
      billing_cycle ENUM('Monthly','Yearly','Free','Custom') NOT NULL DEFAULT 'Monthly',
      amount INT NOT NULL DEFAULT 0,
      gst INT NOT NULL DEFAULT 0,
      total INT NOT NULL DEFAULT 0,
      status ENUM('Paid','Pending','Failed','Refunded') NOT NULL DEFAULT 'Pending',
      gateway VARCHAR(80) NOT NULL DEFAULT '',
      transaction_id VARCHAR(160) NOT NULL DEFAULT '',
      payment_method VARCHAR(80) NOT NULL DEFAULT '',
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_payments_uid (payment_uid),
      INDEX idx_payments_customer (customer_uid),
      INDEX idx_payments_status (status),
      INDEX idx_payments_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NULL,
      customer_uid VARCHAR(40) NOT NULL DEFAULT '',
      email VARCHAR(255) NOT NULL DEFAULT '',
      status ENUM('Success','Failed','Suspicious','Locked','Blocked') NOT NULL DEFAULT 'Success',
      risk ENUM('Low','Medium','High') NOT NULL DEFAULT 'Low',
      ip VARCHAR(60) NOT NULL DEFAULT '',
      city VARCHAR(120) NOT NULL DEFAULT '',
      country VARCHAR(100) NOT NULL DEFAULT '',
      device VARCHAR(60) NOT NULL DEFAULT '',
      browser VARCHAR(80) NOT NULL DEFAULT '',
      os VARCHAR(60) NOT NULL DEFAULT '',
      method VARCHAR(40) NOT NULL DEFAULT 'Password',
      session_status VARCHAR(40) NOT NULL DEFAULT 'Active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_ll_customer (customer_uid),
      INDEX idx_ll_status (status),
      INDEX idx_ll_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
      setting_value TEXT NULL,
      is_secret BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

}

export async function ensureAdminRbacSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();

  await query(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      code VARCHAR(64) NOT NULL,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(255) NOT NULL DEFAULT '',
      is_system BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_admin_roles_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_permissions (
      code VARCHAR(80) NOT NULL,
      name VARCHAR(120) NOT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'general',
      description VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (code),
      INDEX idx_admin_permissions_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_role_permissions (
      role_id BIGINT UNSIGNED NOT NULL,
      permission_code VARCHAR(80) NOT NULL,
      PRIMARY KEY (role_id, permission_code),
      INDEX idx_admin_role_permissions_code (permission_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing("master_admins", "role_id", "BIGINT UNSIGNED NULL");
  await addIndexIfMissing("master_admins", "idx_master_admins_role", "ALTER TABLE master_admins ADD INDEX idx_master_admins_role (role_id)");
}

export async function ensureAdminNotificationsSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();

  await query(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      notification_uid VARCHAR(80) NOT NULL,
      admin_id BIGINT UNSIGNED NULL,
      category ENUM('billing','support','customer','product','system','security') NOT NULL DEFAULT 'system',
      title VARCHAR(255) NOT NULL,
      body VARCHAR(512) NOT NULL DEFAULT '',
      href VARCHAR(512) NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      dismissed_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_admin_notifications_uid (notification_uid),
      INDEX idx_admin_notifications_admin_read (admin_id, is_read),
      INDEX idx_admin_notifications_created (created_at),
      INDEX idx_admin_notifications_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await addColumnIfMissing("admin_notifications", "dismissed_at", "DATETIME NULL");
  await addIndexIfMissing(
    "admin_notifications",
    "idx_admin_notifications_visible",
    "ALTER TABLE admin_notifications ADD INDEX idx_admin_notifications_visible (admin_id, dismissed_at, is_read, created_at)",
  );
}

export async function ensureBillingSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();

  await query(`
    CREATE TABLE IF NOT EXISTS billing_orders (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_uid VARCHAR(64) NOT NULL UNIQUE,
      customer_uid VARCHAR(64) NOT NULL,
      user_id VARCHAR(128) NULL,
      plan_id VARCHAR(64) NOT NULL,
      billing_period ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
      razorpay_order_id VARCHAR(128) NOT NULL UNIQUE,
      amount_paise INT NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      status ENUM('created','paid','failed','cancelled') NOT NULL DEFAULT 'created',
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_billing_orders_customer (customer_uid),
      INDEX idx_billing_orders_plan (plan_id),
      INDEX idx_billing_orders_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS billing_payments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      payment_uid VARCHAR(64) NOT NULL UNIQUE,
      customer_uid VARCHAR(64) NOT NULL,
      order_uid VARCHAR(64) NOT NULL,
      razorpay_order_id VARCHAR(128) NOT NULL,
      razorpay_payment_id VARCHAR(128) NULL,
      razorpay_signature VARCHAR(255) NULL,
      amount_paise INT NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      status ENUM('created','captured','failed','refunded') NOT NULL DEFAULT 'created',
      raw_payload JSON NULL,
      subscription_id BIGINT UNSIGNED NULL,
      invoice_uid VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_billing_payments_customer (customer_uid),
      INDEX idx_billing_payments_order (order_uid),
      INDEX idx_billing_payments_razorpay_payment (razorpay_payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS billing_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_uid VARCHAR(64) NOT NULL,
      subscription_id BIGINT UNSIGNED NULL,
      event_type VARCHAR(80) NOT NULL,
      title VARCHAR(191) NOT NULL,
      description TEXT NULL,
      amount_paise INT NULL,
      currency VARCHAR(12) NOT NULL DEFAULT 'INR',
      meta JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_customer_uid (customer_uid),
      KEY idx_event_type (event_type),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS billing_invoices (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      invoice_uid VARCHAR(64) NOT NULL UNIQUE,
      customer_uid VARCHAR(64) NOT NULL,
      subscription_id BIGINT UNSIGNED NULL,
      plan_id VARCHAR(64) NOT NULL,
      period ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
      amount_paise INT NOT NULL DEFAULT 0,
      tax_paise INT NOT NULL DEFAULT 0,
      total_paise INT NOT NULL DEFAULT 0,
      currency VARCHAR(12) NOT NULL DEFAULT 'INR',
      status ENUM('draft','paid','failed','void','refunded') NOT NULL DEFAULT 'draft',
      razorpay_payment_id VARCHAR(191) NULL,
      paid_at DATETIME NULL,
      due_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_customer_uid (customer_uid),
      KEY idx_status (status),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS billing_webhook_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      event_uid VARCHAR(64) NOT NULL UNIQUE,
      provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
      event_type VARCHAR(128) NOT NULL,
      provider_event_id VARCHAR(128) NULL,
      signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
      payload JSON NOT NULL,
      processed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_billing_webhook_type (event_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS billing_profiles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_uid VARCHAR(64) NOT NULL UNIQUE,
      company_name VARCHAR(191) NULL,
      billing_name VARCHAR(191) NULL,
      billing_email VARCHAR(191) NULL,
      billing_phone VARCHAR(40) NULL,
      gstin VARCHAR(32) NULL,
      address_line1 VARCHAR(255) NULL,
      address_line2 VARCHAR(255) NULL,
      city VARCHAR(100) NULL,
      state VARCHAR(100) NULL,
      postal_code VARCHAR(32) NULL,
      country VARCHAR(80) NOT NULL DEFAULT 'India',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_billing_profiles_customer (customer_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS invoice_counters (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      financial_year VARCHAR(16) NOT NULL UNIQUE,
      last_number INT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing("billing_invoices", "invoice_number", "VARCHAR(80) NULL");
  await addColumnIfMissing("billing_invoices", "subtotal_paise", "INT NOT NULL DEFAULT 0");
  await addColumnIfMissing("billing_invoices", "cgst_paise", "INT NOT NULL DEFAULT 0");
  await addColumnIfMissing("billing_invoices", "sgst_paise", "INT NOT NULL DEFAULT 0");
  await addColumnIfMissing("billing_invoices", "igst_paise", "INT NOT NULL DEFAULT 0");
  await addColumnIfMissing("billing_invoices", "gst_rate", "DECIMAL(5,2) NOT NULL DEFAULT 18.00");
  await addColumnIfMissing("billing_invoices", "seller_gstin", "VARCHAR(32) NULL");
  await addColumnIfMissing("billing_invoices", "buyer_gstin", "VARCHAR(32) NULL");
  await addColumnIfMissing("billing_invoices", "buyer_name", "VARCHAR(191) NULL");
  await addColumnIfMissing("billing_invoices", "buyer_email", "VARCHAR(191) NULL");
  await addColumnIfMissing("billing_invoices", "buyer_address", "TEXT NULL");
  await addColumnIfMissing("billing_invoices", "invoice_html", "LONGTEXT NULL");
}

export async function ensureCouponsSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();

  await query(`
    CREATE TABLE IF NOT EXISTS coupons (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      coupon_uid VARCHAR(64) NOT NULL,
      code VARCHAR(64) NOT NULL,
      description VARCHAR(255) NOT NULL DEFAULT '',
      discount_type ENUM('percentage','fixed','free_trial') NOT NULL DEFAULT 'percentage',
      discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      usage_count INT UNSIGNED NOT NULL DEFAULT 0,
      usage_limit INT UNSIGNED NOT NULL DEFAULT 0,
      revenue_saved_paise INT NOT NULL DEFAULT 0,
      expires_at DATETIME NULL,
      status ENUM('active','expired','disabled') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_coupons_uid (coupon_uid),
      UNIQUE KEY uq_coupons_code (code),
      INDEX idx_coupons_status (status),
      INDEX idx_coupons_expires (expires_at),
      INDEX idx_coupons_type (discount_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      coupon_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL DEFAULT '',
      amount_saved_paise INT NOT NULL DEFAULT 0,
      redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_coupon_redemptions_coupon (coupon_uid),
      INDEX idx_coupon_redemptions_date (redeemed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS storage_usage_snapshots (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      snapshot_date DATE NOT NULL,
      total_storage_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      total_bandwidth_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      customer_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_storage_snapshots_date (snapshot_date),
      INDEX idx_storage_snapshots_date (snapshot_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureSupportTicketsSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();

  await query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      ticket_uid VARCHAR(64) NOT NULL,
      ticket_number VARCHAR(32) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL DEFAULT '',
      customer_name VARCHAR(191) NOT NULL DEFAULT '',
      customer_email VARCHAR(191) NOT NULL DEFAULT '',
      subject VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category ENUM('technical','billing','account','feature','other') NOT NULL DEFAULT 'technical',
      priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
      status ENUM('open','pending','resolved','closed') NOT NULL DEFAULT 'open',
      assigned_to VARCHAR(191) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_support_tickets_uid (ticket_uid),
      UNIQUE KEY uq_support_tickets_number (ticket_number),
      INDEX idx_support_tickets_status (status),
      INDEX idx_support_tickets_priority (priority),
      INDEX idx_support_tickets_category (category),
      INDEX idx_support_tickets_assigned (assigned_to),
      INDEX idx_support_tickets_customer (customer_uid),
      INDEX idx_support_tickets_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      ticket_uid VARCHAR(64) NOT NULL,
      author_type ENUM('admin','customer','system') NOT NULL DEFAULT 'admin',
      author_name VARCHAR(191) NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_ticket_messages_ticket (ticket_uid),
      INDEX idx_ticket_messages_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureAppSchema() {
  await ensureAuthSchema();
  await ensureProductSchema();
  await ensureQrSchema();
  await ensurePlanSchema();
  await ensureAnalyticsSchema();
  await ensureAdminSchema();
  await ensureBillingSchema();
  await ensureCouponsSchema();
  await ensureSupportTicketsSchema();
  await ensureAdminRbacSchema();
  await ensureAdminNotificationsSchema();
  const { ensureUserPanelSchema } = await import("@/lib/user-panel/schema");
  await ensureUserPanelSchema();
  const { ensureAccountSchema } = await import("@/lib/account/schema");
  await ensureAccountSchema();
  // Enterprise schema — imported lazily to avoid circular deps
  const { ensureEnterpriseSchema } = await import("@/lib/enterprise/schema");
  await ensureEnterpriseSchema();
}

export async function ensureQrSchema() {
  if (shouldSkipRuntimeDdl()) return;
  await ensureDatabase();
  await query(`
    CREATE TABLE IF NOT EXISTS product_qr_codes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      customer_uid VARCHAR(40) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      product_id VARCHAR(160) NOT NULL,
      public_id VARCHAR(64) NOT NULL,
      destination_url TEXT NOT NULL,
      foreground_color VARCHAR(7) NOT NULL DEFAULT '#111111',
      background_color VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
      pattern_style VARCHAR(32) NOT NULL DEFAULT 'classic',
      corner_style VARCHAR(32) NOT NULL DEFAULT 'square',
      logo_url LONGTEXT NULL,
      logo_size INT NOT NULL DEFAULT 20,
      frame_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      frame_style VARCHAR(32) NOT NULL DEFAULT 'simple',
      frame_color VARCHAR(7) NOT NULL DEFAULT '#A8FF00',
      frame_text VARCHAR(160) NOT NULL DEFAULT 'Scan to view in 3D / AR',
      scans BIGINT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_product_qr_product (product_id),
      UNIQUE KEY uq_product_qr_public (public_id),
      INDEX idx_product_qr_customer (customer_uid),
      INDEX idx_product_qr_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
