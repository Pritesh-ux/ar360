-- Migration 53: Enterprise installment / partial payment ledger.

ALTER TABLE enterprise_quotes
  ADD COLUMN IF NOT EXISTS collection_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid' AFTER status,
  ADD COLUMN IF NOT EXISTS paid_paise BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER collection_status;

ALTER TABLE enterprise_payments
  ADD COLUMN IF NOT EXISTS due_at DATE NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS installment_label VARCHAR(80) NULL AFTER due_at,
  ADD COLUMN IF NOT EXISTS source ENUM('manual','razorpay_link') NOT NULL DEFAULT 'manual' AFTER installment_label,
  ADD COLUMN IF NOT EXISTS provider_payment_link_id VARCHAR(80) NULL AFTER source,
  ADD COLUMN IF NOT EXISTS reminder_sent_for_days INT NULL AFTER provider_payment_link_id;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'enterprise_payments'
    AND INDEX_NAME = 'idx_enterprise_payments_due'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_enterprise_payments_due ON enterprise_payments (due_at, status)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'enterprise_payments'
    AND INDEX_NAME = 'idx_enterprise_payments_provider_link'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_enterprise_payments_provider_link ON enterprise_payments (provider_payment_link_id)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill paid totals from existing paid payments.
UPDATE enterprise_quotes q
LEFT JOIN (
  SELECT quote_id, COALESCE(SUM(amount_paise), 0) AS paid_sum
  FROM enterprise_payments
  WHERE status = 'paid'
  GROUP BY quote_id
) p ON p.quote_id = q.id
SET
  q.paid_paise = COALESCE(p.paid_sum, 0),
  q.collection_status = CASE
    WHEN COALESCE(p.paid_sum, 0) <= 0 THEN 'unpaid'
    WHEN COALESCE(p.paid_sum, 0) >= q.price_paise THEN 'paid'
    ELSE 'partial'
  END;
