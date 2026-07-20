-- Migration 25: Batch 4 Growth Tools — permanent QR, embed configs, CTA analytics
-- Idempotent column/index additions

CREATE TABLE IF NOT EXISTS qr_code_sequence (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  next_val INT UNSIGNED NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO qr_code_sequence (id, next_val) VALUES (1, 1);

SET @has_qr_code := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_qr_codes' AND COLUMN_NAME = 'qr_code'
);
SET @sql := IF(@has_qr_code = 0, 'ALTER TABLE product_qr_codes ADD COLUMN qr_code VARCHAR(16) NULL AFTER public_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_unique_scans := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_qr_codes' AND COLUMN_NAME = 'unique_scans'
);
SET @sql := IF(@has_unique_scans = 0, 'ALTER TABLE product_qr_codes ADD COLUMN unique_scans BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER scans', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_last_scan := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_qr_codes' AND COLUMN_NAME = 'last_scan_at'
);
SET @sql := IF(@has_last_scan = 0, 'ALTER TABLE product_qr_codes ADD COLUMN last_scan_at DATETIME NULL AFTER unique_scans', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_ar_launches := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_qr_codes' AND COLUMN_NAME = 'ar_launches'
);
SET @sql := IF(@has_ar_launches = 0, 'ALTER TABLE product_qr_codes ADD COLUMN ar_launches BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER last_scan_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_qr_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_qr_codes' AND INDEX_NAME = 'idx_product_qr_code'
);
SET @sql := IF(@has_qr_idx = 0, 'CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE product_qr_codes q
INNER JOIN (
  SELECT product_id, MIN(id) AS keep_id
  FROM product_qr_codes
  WHERE deleted_at IS NULL
  GROUP BY product_id
  HAVING COUNT(*) > 1
) d ON q.product_id = d.product_id AND q.id <> d.keep_id
SET q.deleted_at = NOW(), q.status = 'archived'
WHERE q.deleted_at IS NULL;

SET @row := 0;
UPDATE product_qr_codes
SET qr_code = CONCAT('QR-', LPAD((@row := @row + 1), 6, '0'))
WHERE qr_code IS NULL OR qr_code = ''
ORDER BY id ASC;

UPDATE qr_code_sequence SET next_val = GREATEST(next_val, (SELECT COUNT(*) FROM product_qr_codes) + 1) WHERE id = 1;

CREATE TABLE IF NOT EXISTS product_embed_configs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  product_id VARCHAR(160) NOT NULL,
  public_id VARCHAR(180) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  allowed_domains_json JSON NULL,
  view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  unique_visitors BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_view_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_embed_product (product_id),
  INDEX idx_embed_customer (customer_uid),
  INDEX idx_embed_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS embed_view_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  embed_config_id BIGINT UNSIGNED NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  product_id VARCHAR(160) NOT NULL,
  anonymous_session_id VARCHAR(64) NOT NULL DEFAULT '',
  referrer_domain VARCHAR(255) NOT NULL DEFAULT '',
  device VARCHAR(20) NOT NULL DEFAULT 'unknown',
  browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
  country VARCHAR(80) NOT NULL DEFAULT '',
  duration_seconds INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_embed_events_config (embed_config_id, created_at),
  INDEX idx_embed_events_customer (customer_uid, created_at),
  INDEX idx_embed_events_product (product_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_ar_launched := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qr_scan_events' AND COLUMN_NAME = 'ar_launched'
);
SET @sql := IF(@has_ar_launched = 0, 'ALTER TABLE qr_scan_events ADD COLUMN ar_launched TINYINT(1) NOT NULL DEFAULT 0 AFTER country', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_link_name := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'share_links' AND COLUMN_NAME = 'link_name'
);
SET @sql := IF(@has_link_name = 0, 'ALTER TABLE share_links ADD COLUMN link_name VARCHAR(160) NULL AFTER slug', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_share_views := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'analytics_daily' AND COLUMN_NAME = 'share_views'
);
SET @sql := IF(@has_share_views = 0, 'ALTER TABLE analytics_daily ADD COLUMN share_views INT UNSIGNED NOT NULL DEFAULT 0 AFTER qr_scans', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_embed_views := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'analytics_daily' AND COLUMN_NAME = 'embed_views'
);
SET @sql := IF(@has_embed_views = 0, 'ALTER TABLE analytics_daily ADD COLUMN embed_views INT UNSIGNED NOT NULL DEFAULT 0 AFTER share_views', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_cta_clicks := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'analytics_daily' AND COLUMN_NAME = 'cta_clicks'
);
SET @sql := IF(@has_cta_clicks = 0, 'ALTER TABLE analytics_daily ADD COLUMN cta_clicks INT UNSIGNED NOT NULL DEFAULT 0 AFTER embed_views', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_qr_scan_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qr_scan_events' AND INDEX_NAME = 'idx_qr_scan_events_qr_created'
);
SET @sql := IF(@has_qr_scan_idx = 0, 'CREATE INDEX idx_qr_scan_events_qr_created ON qr_scan_events (qr_code_id, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_share_evt_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'share_events' AND INDEX_NAME = 'idx_share_events_type_created'
);
SET @sql := IF(@has_share_evt_idx = 0, 'CREATE INDEX idx_share_events_type_created ON share_events (event_type, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_analytics_evt_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'analytics_events' AND INDEX_NAME = 'idx_analytics_events_source'
);
SET @sql := IF(@has_analytics_evt_idx = 0, 'CREATE INDEX idx_analytics_events_source ON analytics_events (event, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
