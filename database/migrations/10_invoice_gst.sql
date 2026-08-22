-- Migration 10: Invoice GST tables and billing_invoices extensions
-- MySQL 8.0 compatible (no ADD COLUMN IF NOT EXISTS)

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_counters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  financial_year VARCHAR(16) NOT NULL UNIQUE,
  last_number INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'invoice_number');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN invoice_number VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'subtotal_paise');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN subtotal_paise INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'cgst_paise');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN cgst_paise INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'sgst_paise');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN sgst_paise INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'igst_paise');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN igst_paise INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'gst_rate');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'seller_gstin');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN seller_gstin VARCHAR(32) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'buyer_gstin');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN buyer_gstin VARCHAR(32) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'buyer_name');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN buyer_name VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'buyer_email');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN buyer_email VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'buyer_address');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN buyer_address TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'invoice_html');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_invoices ADD COLUMN invoice_html LONGTEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
