import { query } from "@/lib/db";

async function addColumnIfMissing(table: string, column: string, definition: string, options?: { force?: boolean }) {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  const skip =
    !options?.force &&
    (flag === "true" ||
      flag === "1" ||
      (flag !== "false" && flag !== "0" && process.env.NODE_ENV === "production"));
  if (skip) return;

  const [{ total = 0 } = { total: 0 }] = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  if (Number(total) === 0) {
    await query(`ALTER TABLE \`${table.replace(/`/g, "``")}\` ADD COLUMN \`${column.replace(/`/g, "``")}\` ${definition}`);
  }
}

let sessionVersionColumnEnsured = false;

/** Required for auth — runs even in production when the column is missing. */
export async function ensureSessionVersionColumn() {
  if (sessionVersionColumnEnsured) return;
  await addColumnIfMissing("users", "session_version", "INT UNSIGNED NOT NULL DEFAULT 1", { force: true });
  sessionVersionColumnEnsured = true;
}

export async function ensureAccountSchema() {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  const skip =
    flag === "true" ||
    flag === "1" ||
    (flag !== "false" && flag !== "0" && process.env.NODE_ENV === "production");
  if (skip) return;

  await addColumnIfMissing("users", "session_version", "INT UNSIGNED NOT NULL DEFAULT 1");
  await addColumnIfMissing("customers", "business_type", "VARCHAR(80) NULL");
  await addColumnIfMissing("customers", "website", "VARCHAR(255) NULL");
  await addColumnIfMissing("customers", "address_line1", "VARCHAR(255) NULL");
  await addColumnIfMissing("customers", "state", "VARCHAR(100) NULL");
  await addColumnIfMissing("customers", "city", "VARCHAR(100) NULL");
  await addColumnIfMissing("customers", "postal_code", "VARCHAR(20) NULL");
  await addColumnIfMissing("customers", "profile_image_url", "TEXT NULL");
  await addColumnIfMissing("customer_notifications", "dedupe_key", "VARCHAR(120) NULL");
  await addColumnIfMissing("support_ticket_messages", "is_internal", "TINYINT(1) NOT NULL DEFAULT 0");

  await query(`
    CREATE TABLE IF NOT EXISTS customer_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      session_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      device VARCHAR(40) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(60) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      ip_hash VARCHAR(64) NOT NULL DEFAULT '',
      user_agent VARCHAR(255) NOT NULL DEFAULT '',
      last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_sessions_uid (session_uid),
      INDEX idx_customer_sessions_user (user_id, revoked_at),
      INDEX idx_customer_sessions_customer (customer_uid, last_active_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS customer_activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      activity_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      event_type VARCHAR(60) NOT NULL,
      title VARCHAR(255) NOT NULL,
      detail VARCHAR(512) NOT NULL DEFAULT '',
      meta_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_activity_uid (activity_uid),
      INDEX idx_customer_activity_customer (customer_uid, created_at),
      INDEX idx_customer_activity_type (event_type, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS data_export_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending','processing','ready','failed','expired') NOT NULL DEFAULT 'pending',
      file_path VARCHAR(512) NULL,
      error_message VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      expires_at DATETIME NULL,
      UNIQUE KEY uq_data_export_uid (request_uid),
      INDEX idx_data_export_customer (customer_uid, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS account_deletion_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending','approved','cancelled','completed') NOT NULL DEFAULT 'pending',
      reason VARCHAR(512) NULL,
      scheduled_for DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cancelled_at DATETIME NULL,
      completed_at DATETIME NULL,
      UNIQUE KEY uq_deletion_request_uid (request_uid),
      INDEX idx_deletion_request_customer (customer_uid, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
