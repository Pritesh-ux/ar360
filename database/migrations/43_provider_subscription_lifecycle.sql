-- Provider-aware lifecycle, scheduled plan changes, renewal state, and reconciliation.
ALTER TABLE customer_subscriptions
  MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'trialing';
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_attempt_count INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS next_retry_at DATETIME NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS halted_at DATETIME NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS last_reconciled_at DATETIME NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS reconciliation_required TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS billing_scheduled_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  change_uid VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  provider_subscription_id VARCHAR(191) NOT NULL,
  change_type ENUM('upgrade','downgrade','cancellation') NOT NULL,
  from_plan_id VARCHAR(40) NOT NULL,
  to_plan_id VARCHAR(40) NULL,
  to_price_version_id BIGINT UNSIGNED NULL,
  effective_at DATETIME NOT NULL,
  status ENUM('scheduled','applied','cancelled','failed') NOT NULL DEFAULT 'scheduled',
  provider_response JSON NULL,
  applied_at DATETIME NULL,
  failure_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_scheduled_change_uid (change_uid),
  KEY idx_billing_scheduled_due (status, effective_at),
  KEY idx_billing_scheduled_customer (customer_uid, created_at),
  CONSTRAINT fk_billing_scheduled_price FOREIGN KEY (to_price_version_id)
    REFERENCES billing_plan_price_versions(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_reconciliation_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_uid VARCHAR(64) NOT NULL,
  status ENUM('running','completed','failed') NOT NULL DEFAULT 'running',
  scanned_count INT UNSIGNED NOT NULL DEFAULT 0,
  repaired_count INT UNSIGNED NOT NULL DEFAULT 0,
  issue_count INT UNSIGNED NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_reconciliation_run_uid (run_uid),
  KEY idx_billing_reconciliation_run_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_reconcile
  ON customer_subscriptions (provider, reconciliation_required, last_reconciled_at);
