-- Migration 26: Batch 5 — Account, Support, Security and Production Readiness
-- Idempotent column/index additions

SET @has_sv := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'session_version'
);
SET @sql := IF(@has_sv = 0, 'ALTER TABLE users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_bt := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'business_type'
);
SET @sql := IF(@has_bt = 0, 'ALTER TABLE customers ADD COLUMN business_type VARCHAR(80) NULL AFTER company_name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_web := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'website'
);
SET @sql := IF(@has_web = 0, 'ALTER TABLE customers ADD COLUMN website VARCHAR(255) NULL AFTER business_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_addr := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'address_line1'
);
SET @sql := IF(@has_addr = 0, 'ALTER TABLE customers ADD COLUMN address_line1 VARCHAR(255) NULL AFTER website', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_state := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'state'
);
SET @sql := IF(@has_state = 0, 'ALTER TABLE customers ADD COLUMN state VARCHAR(100) NULL AFTER country', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_city := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'city'
);
SET @sql := IF(@has_city = 0, 'ALTER TABLE customers ADD COLUMN city VARCHAR(100) NULL AFTER state', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_postal := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'postal_code'
);
SET @sql := IF(@has_postal = 0, 'ALTER TABLE customers ADD COLUMN postal_code VARCHAR(20) NULL AFTER city', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_img := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'profile_image_url'
);
SET @sql := IF(@has_img = 0, 'ALTER TABLE customers ADD COLUMN profile_image_url TEXT NULL AFTER postal_code', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_dedupe := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND COLUMN_NAME = 'dedupe_key'
);
SET @sql := IF(@has_dedupe = 0, 'ALTER TABLE customer_notifications ADD COLUMN dedupe_key VARCHAR(120) NULL AFTER href', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_dedupe_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND INDEX_NAME = 'idx_customer_notifications_dedupe'
);
SET @sql := IF(@has_dedupe_idx = 0, 'CREATE INDEX idx_customer_notifications_dedupe ON customer_notifications (customer_uid, dedupe_key)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_internal := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_ticket_messages' AND COLUMN_NAME = 'is_internal'
);
SET @sql := IF(@has_internal = 0, 'ALTER TABLE support_ticket_messages ADD COLUMN is_internal TINYINT(1) NOT NULL DEFAULT 0 AFTER body', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
