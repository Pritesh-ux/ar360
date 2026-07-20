-- Sprint 6 — Master Admin Stabilization
-- Safe migration for MariaDB/MySQL. Run if master-admin subscription actions fail.

CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(80) NOT NULL,
  plan_id VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'trialing',
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_subscription_customer (customer_uid),
  INDEX idx_customer_subscriptions_plan (plan_id),
  INDEX idx_customer_subscriptions_status (status)
);

CREATE TABLE IF NOT EXISTS master_admin_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id VARCHAR(128) NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_master_admin_audit_entity (entity_type, entity_id),
  INDEX idx_master_admin_audit_action (action),
  INDEX idx_master_admin_audit_created (created_at)
);

-- Add optional subscription lifecycle columns only if your MySQL supports ADD COLUMN IF NOT EXISTS.
-- If this fails in older MariaDB, add these columns manually from phpMyAdmin.
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS cancelled_at DATETIME NULL;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS provider VARCHAR(40) NULL;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(160) NULL;
