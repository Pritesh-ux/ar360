-- Master Admin production billing controls and durable operational state.

ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS mandate_status VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS next_charge_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS last_failure_code VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS last_failure_message TEXT NULL;

ALTER TABLE billing_plan_price_versions
  ADD COLUMN IF NOT EXISTS publish_status VARCHAR(32) NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS publish_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_synced_at DATETIME NULL;

ALTER TABLE billing_refunds
  ADD COLUMN IF NOT EXISTS payment_uid VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS admin_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS billing_credit_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  credit_note_uid VARCHAR(64) NOT NULL,
  invoice_uid VARCHAR(64) NOT NULL,
  refund_uid VARCHAR(64) NOT NULL,
  credit_note_number VARCHAR(80) NULL,
  amount_paise BIGINT UNSIGNED NOT NULL,
  status ENUM('draft','issued','void') NOT NULL DEFAULT 'draft',
  issued_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_credit_note_uid (credit_note_uid),
  UNIQUE KEY uq_billing_credit_note_refund (refund_uid),
  KEY idx_billing_credit_note_invoice (invoice_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_admin_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alert_uid VARCHAR(64) NOT NULL,
  alert_type ENUM('webhook_backlog','unmatched_event','stuck_event','provider_mismatch','missing_mapping','subscription_halted') NOT NULL,
  severity ENUM('warning','error','critical') NOT NULL DEFAULT 'warning',
  status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  entity_type VARCHAR(80) NULL,
  entity_id VARCHAR(191) NULL,
  summary VARCHAR(500) NOT NULL,
  details JSON NULL,
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME NULL,
  acknowledged_by_admin_id BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_admin_alert_uid (alert_uid),
  UNIQUE KEY uq_billing_admin_alert_open_entity (alert_type, entity_type, entity_id, status),
  KEY idx_billing_admin_alert_queue (status, severity, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_provider_health (
  provider VARCHAR(32) NOT NULL,
  provider_mode ENUM('test','live') NOT NULL,
  last_connectivity_test_at DATETIME NULL,
  connectivity_ok TINYINT(1) NULL,
  connectivity_error TEXT NULL,
  last_webhook_at DATETIME NULL,
  last_webhook_event VARCHAR(128) NULL,
  last_webhook_failure_at DATETIME NULL,
  last_webhook_failure TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, provider_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO billing_provider_health (provider, provider_mode)
VALUES ('razorpay', 'test'), ('razorpay', 'live')
ON DUPLICATE KEY UPDATE provider = VALUES(provider);

