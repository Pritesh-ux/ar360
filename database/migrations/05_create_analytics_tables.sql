-- Migration 05: Create Analytics Tables
-- Tables: analytics_events, analytics_sessions, analytics_daily

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
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
  INDEX idx_ae_customer (customer_uid),
  INDEX idx_ae_product (product_uid),
  INDEX idx_ae_session (session_id),
  INDEX idx_ae_event (event),
  INDEX idx_ae_created (created_at),
  INDEX idx_ae_customer_product (customer_uid, product_uid),
  INDEX idx_ae_customer_created (customer_uid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id VARCHAR(64) NOT NULL PRIMARY KEY,
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
  INDEX idx_as_customer (customer_uid),
  INDEX idx_as_product (product_uid),
  INDEX idx_as_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
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
  avg_duration INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_ad_customer_product_date (customer_uid, product_uid, date),
  INDEX idx_ad_customer (customer_uid),
  INDEX idx_ad_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
