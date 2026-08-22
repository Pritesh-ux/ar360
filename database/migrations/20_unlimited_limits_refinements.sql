-- Migration 20: Add unlimited storage/bandwidth columns
-- MySQL 8.0 compatible (idempotent)

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'unlimited_storage');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_plans ADD COLUMN unlimited_storage TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'unlimited_bandwidth');
SET @sql := IF(@has_col = 0, 'ALTER TABLE billing_plans ADD COLUMN unlimited_bandwidth TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_subscriptions' AND COLUMN_NAME = 'unlimited_storage');
SET @sql := IF(@has_col = 0, 'ALTER TABLE customer_subscriptions ADD COLUMN unlimited_storage TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_subscriptions' AND COLUMN_NAME = 'unlimited_bandwidth');
SET @sql := IF(@has_col = 0, 'ALTER TABLE customer_subscriptions ADD COLUMN unlimited_bandwidth TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
