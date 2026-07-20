-- Migration 16: User panel schema — notifications, preferences, share links, QR scan events
-- Idempotent: safe to re-run on existing databases

-- ---------------------------------------------------------------------------
-- Customer notifications (user panel bell)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_uid VARCHAR(80) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  category ENUM('billing','support','product','subscription','storage','system','security') NOT NULL DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  body VARCHAR(512) NOT NULL DEFAULT '',
  href VARCHAR(512) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_notifications_uid (notification_uid),
  INDEX idx_customer_notifications_customer_read (customer_uid, is_read),
  INDEX idx_customer_notifications_user_read (user_id, is_read),
  INDEX idx_customer_notifications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- User preferences (theme, grid/list, notifications prefs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  customer_uid VARCHAR(64) NOT NULL DEFAULT '',
  theme VARCHAR(32) NOT NULL DEFAULT 'light',
  default_product_view ENUM('grid','list') NOT NULL DEFAULT 'grid',
  items_per_page INT UNSIGNED NOT NULL DEFAULT 12,
  date_format VARCHAR(32) NOT NULL DEFAULT 'dmy',
  language VARCHAR(16) NOT NULL DEFAULT 'en',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  email_notification_preferences_json JSON NULL,
  dashboard_preferences_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_preferences_user (user_id),
  INDEX idx_user_preferences_customer (customer_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Share links (Share Center)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS share_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  share_uid VARCHAR(80) NOT NULL,
  public_id VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  product_id VARCHAR(160) NOT NULL,
  link_type ENUM('public','qr','embed','email') NOT NULL DEFAULT 'public',
  slug VARCHAR(120) NULL,
  token VARCHAR(64) NOT NULL,
  destination_url TEXT NOT NULL,
  status ENUM('active','expired','archived','disabled') NOT NULL DEFAULT 'active',
  expires_at DATETIME NULL,
  password_hash VARCHAR(255) NULL,
  allowed_domains_json JSON NULL,
  viewer_config_json JSON NULL,
  view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  qr_scan_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_share_links_uid (share_uid),
  UNIQUE KEY uq_share_links_public (public_id),
  UNIQUE KEY uq_share_links_token (token),
  INDEX idx_share_links_customer_status (customer_uid, status),
  INDEX idx_share_links_product (product_id),
  INDEX idx_share_links_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Share events (Share Center analytics detail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS share_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  share_link_id BIGINT UNSIGNED NOT NULL,
  share_uid VARCHAR(80) NOT NULL DEFAULT '',
  customer_uid VARCHAR(64) NOT NULL DEFAULT '',
  product_id VARCHAR(160) NOT NULL DEFAULT '',
  event_type VARCHAR(40) NOT NULL,
  anonymous_session_id VARCHAR(64) NOT NULL DEFAULT '',
  referrer VARCHAR(255) NOT NULL DEFAULT '',
  device VARCHAR(20) NOT NULL DEFAULT 'unknown',
  browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
  country VARCHAR(80) NOT NULL DEFAULT '',
  duration_seconds INT UNSIGNED NULL,
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_share_events_share_created (share_link_id, created_at),
  INDEX idx_share_events_customer_created (customer_uid, created_at),
  INDEX idx_share_events_product_created (product_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- QR scan events (deduplicated scan tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qr_scan_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  qr_code_id BIGINT UNSIGNED NOT NULL,
  qr_uid VARCHAR(64) NOT NULL DEFAULT '',
  customer_uid VARCHAR(64) NOT NULL DEFAULT '',
  product_id VARCHAR(160) NOT NULL DEFAULT '',
  anonymous_session_id VARCHAR(64) NOT NULL DEFAULT '',
  device VARCHAR(20) NOT NULL DEFAULT 'unknown',
  browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
  country VARCHAR(80) NOT NULL DEFAULT '',
  source VARCHAR(40) NOT NULL DEFAULT 'qr',
  referrer VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_qr_scan_events_qr_created (qr_code_id, created_at),
  INDEX idx_qr_scan_events_customer_created (customer_uid, created_at),
  INDEX idx_qr_scan_events_session_qr (anonymous_session_id, qr_code_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Products — additive columns for user panel filters and lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags JSON NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS processing_error VARCHAR(512) NULL;

-- ---------------------------------------------------------------------------
-- product_qr_codes — multi-QR support and lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE product_qr_codes ADD COLUMN IF NOT EXISTS qr_uid VARCHAR(64) NULL;
ALTER TABLE product_qr_codes ADD COLUMN IF NOT EXISTS name VARCHAR(160) NOT NULL DEFAULT 'Main QR';
ALTER TABLE product_qr_codes ADD COLUMN IF NOT EXISTS status ENUM('active','expired','archived','processing') NOT NULL DEFAULT 'active';
ALTER TABLE product_qr_codes ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL;
ALTER TABLE product_qr_codes ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL;
ALTER TABLE product_qr_codes ADD COLUMN IF NOT EXISTS style_json JSON NULL;

UPDATE product_qr_codes SET qr_uid = public_id WHERE qr_uid IS NULL OR qr_uid = '';

-- Drop one-QR-per-product constraint (allows multiple QR codes per product)
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_qr_codes'
    AND INDEX_NAME = 'uq_product_qr_product'
);
SET @ddl := IF(
  @idx_exists > 0,
  'ALTER TABLE product_qr_codes DROP INDEX uq_product_qr_product',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_qr_codes'
    AND INDEX_NAME = 'idx_product_qr_product'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_product_qr_product ON product_qr_codes (product_id)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_qr_codes'
    AND INDEX_NAME = 'uq_product_qr_uid'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX uq_product_qr_uid ON product_qr_codes (qr_uid)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_qr_codes'
    AND INDEX_NAME = 'idx_product_qr_status'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_product_qr_status ON product_qr_codes (customer_uid, status, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Normalize legacy plan_id values
UPDATE customers SET plan_id = 'trial' WHERE plan_id = 'free';
