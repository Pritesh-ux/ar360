-- Migration 15: Admin ops performance indexes (audit, email, activity filters)
-- Idempotent: safe to re-run (skips when table missing)

SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_admin_audit_logs'
);
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'master_admin_audit_logs'
    AND INDEX_NAME = 'idx_master_admin_audit_admin'
);
SET @ddl := IF(
  @tbl_exists = 0 OR @idx_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_master_admin_audit_admin ON master_admin_audit_logs (admin_id, created_at)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
);
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND INDEX_NAME = 'idx_products_updated_at'
);
SET @ddl := IF(
  @tbl_exists = 0 OR @idx_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_products_updated_at ON products (updated_at)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_payments'
);
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'billing_payments'
    AND INDEX_NAME = 'idx_billing_payments_status_updated'
);
SET @ddl := IF(
  @tbl_exists = 0 OR @idx_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_billing_payments_status_updated ON billing_payments (status, updated_at)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_logs'
);
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'email_logs'
    AND INDEX_NAME = 'idx_email_logs_status_created'
);
SET @ddl := IF(
  @tbl_exists = 0 OR @idx_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_email_logs_status_created ON email_logs (status, created_at)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_tickets'
);
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'support_tickets'
    AND INDEX_NAME = 'idx_support_tickets_status_priority'
);
SET @ddl := IF(
  @tbl_exists = 0 OR @idx_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_support_tickets_status_priority ON support_tickets (status, priority, created_at)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
