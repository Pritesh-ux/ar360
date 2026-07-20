-- Migration 21: plan_level on billing_plans for upgrade hierarchy
-- Idempotent: skip ADD if column already exists.

SET @has_plan_level := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'plan_level'
);
SET @sql := IF(
  @has_plan_level = 0,
  'ALTER TABLE billing_plans ADD COLUMN plan_level INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE billing_plans SET plan_level = 0 WHERE id IN ('trial', 'free');
UPDATE billing_plans SET plan_level = 1 WHERE id IN ('basic', 'starter');
UPDATE billing_plans SET plan_level = 2 WHERE id IN ('professional', 'pro');
UPDATE billing_plans SET plan_level = 3 WHERE id IN ('enterprise', 'business', 'agency');
