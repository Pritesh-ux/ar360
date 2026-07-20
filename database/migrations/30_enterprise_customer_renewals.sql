-- Migration 30: Customer-initiated Enterprise contract renewals.
-- Keeps renewal requests inside the existing six-table Enterprise sales schema.

ALTER TABLE enterprise_requests
  ADD COLUMN IF NOT EXISTS renewal_of_contract_id BIGINT UNSIGNED NULL AFTER customer_id;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'enterprise_requests'
    AND INDEX_NAME = 'uq_enterprise_requests_renewal_contract'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX uq_enterprise_requests_renewal_contract ON enterprise_requests (renewal_of_contract_id)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'enterprise_requests'
    AND CONSTRAINT_NAME = 'fk_enterprise_requests_renewal_contract'
);
SET @ddl := IF(
  @fk_exists = 0,
  'ALTER TABLE enterprise_requests ADD CONSTRAINT fk_enterprise_requests_renewal_contract FOREIGN KEY (renewal_of_contract_id) REFERENCES enterprise_contracts(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
