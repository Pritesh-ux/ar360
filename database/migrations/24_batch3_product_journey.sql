-- Migration 24: Batch 3 Product Journey
-- Expands product status model, description, editor versioning metadata

SET @has_desc := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'description'
);
SET @sql := IF(@has_desc = 0, 'ALTER TABLE products ADD COLUMN description TEXT NULL AFTER category', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_editor := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'last_editor_user_id'
);
SET @sql := IF(@has_editor = 0, 'ALTER TABLE products ADD COLUMN last_editor_user_id BIGINT UNSIGNED NULL AFTER version', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE products
  MODIFY COLUMN status ENUM('Draft', 'published') NOT NULL DEFAULT 'Draft';

UPDATE products SET status = 'Draft' WHERE LOWER(status) IN ('draft', '', 'archived', 'archive', 'disabled', 'unpublished');
UPDATE products SET status = 'published' WHERE LOWER(status) IN ('published', 'active', 'publish');

CREATE TABLE IF NOT EXISTS product_edit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_uid VARCHAR(160) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pel_product (product_uid),
  INDEX idx_pel_customer (customer_uid),
  INDEX idx_pel_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
