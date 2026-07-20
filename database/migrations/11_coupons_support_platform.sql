-- Migration 11: Master Admin platform tables (coupons, support, settings, storage snapshots)
-- Idempotent: safe to run on databases that already have runtime DDL from ensureAppSchema()

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
  setting_value TEXT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX idx_coupons_type (discount_type),
  INDEX idx_coupons_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  coupon_uid VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL DEFAULT '',
  amount_saved_paise INT NOT NULL DEFAULT 0,
  redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_coupon_redemptions_coupon (coupon_uid),
  INDEX idx_coupon_redemptions_customer (customer_uid),
  INDEX idx_coupon_redemptions_date (redeemed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX idx_support_tickets_created (created_at),
  INDEX idx_support_tickets_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Composite indexes for common admin filters (skip if index already exists via runtime DDL)

-- billing_payments admin filters
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'billing_payments' AND index_name = 'idx_bp_status_created'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_bp_status_created ON billing_payments (status, created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- customers admin filters
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'customers' AND index_name = 'idx_customers_status_plan'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_customers_status_plan ON customers (status, plan_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
