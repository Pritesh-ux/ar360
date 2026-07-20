-- Migration 29: Idempotent paid Enterprise activation links.
-- Adds only linkage/idempotency fields to the existing Enterprise workflow.

ALTER TABLE enterprise_requests
  ADD COLUMN IF NOT EXISTS activation_email_sent_at DATETIME NULL AFTER customer_id;

ALTER TABLE enterprise_payments
  ADD COLUMN IF NOT EXISTS subscription_id BIGINT NULL AFTER invoice_id;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'enterprise_payments'
    AND INDEX_NAME = 'uq_enterprise_payments_invoice'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX uq_enterprise_payments_invoice ON enterprise_payments (invoice_id)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'enterprise_payments'
    AND INDEX_NAME = 'idx_enterprise_payments_subscription'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_enterprise_payments_subscription ON enterprise_payments (subscription_id)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'enterprise_payments'
    AND CONSTRAINT_NAME = 'fk_enterprise_payments_subscription'
);
SET @ddl := IF(
  @fk_exists = 0,
  'ALTER TABLE enterprise_payments ADD CONSTRAINT fk_enterprise_payments_subscription FOREIGN KEY (subscription_id) REFERENCES customer_subscriptions(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
