-- Migration 17: User panel performance indexes
-- Idempotent: safe to re-run

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND INDEX_NAME = 'idx_products_customer_status'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_products_customer_status ON products (customer_uid, status, deleted_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND INDEX_NAME = 'idx_products_customer_folder'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_products_customer_folder ON products (customer_uid, product_folder(120))',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND INDEX_NAME = 'idx_products_customer_category'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_products_customer_category ON products (customer_uid, category)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND INDEX_NAME = 'idx_products_customer_created'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_products_customer_created ON products (customer_uid, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'support_tickets'
    AND INDEX_NAME = 'idx_support_tickets_customer_status'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_support_tickets_customer_status ON support_tickets (customer_uid, status, updated_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_subscriptions'
    AND INDEX_NAME = 'idx_customer_subscriptions_status_end'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_customer_subscriptions_status_end ON customer_subscriptions (status, current_period_end)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'billing_invoices'
    AND INDEX_NAME = 'idx_billing_invoices_customer_created'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_billing_invoices_customer_created ON billing_invoices (customer_uid, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
