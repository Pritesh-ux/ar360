-- Durable Razorpay webhook ingestion and recurring finalization.

ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS event_created_at BIGINT UNSIGNED NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(191) NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(191) NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS provider_refund_id VARCHAR(191) NULL;
ALTER TABLE billing_webhook_events MODIFY COLUMN provider_event_id VARCHAR(191) NULL;
ALTER TABLE billing_webhook_events MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'received';

CREATE INDEX IF NOT EXISTS idx_billing_webhook_claim
  ON billing_webhook_events (status, available_at, locked_until);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_subscription
  ON billing_webhook_events (provider_mode, provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_payment
  ON billing_webhook_events (provider_mode, provider_payment_id);

ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS provider_status VARCHAR(40) NULL;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS mandate_status ENUM('pending','authorized','failed','revoked') NOT NULL DEFAULT 'pending';
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS provider_event_created_at BIGINT UNSIGNED NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_subscription_provider
  ON customer_subscriptions (provider, provider_mode, provider_subscription_id);

ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS provider_event_created_at BIGINT UNSIGNED NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_provider
  ON billing_payments (provider, provider_mode, razorpay_payment_id);

ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS provider_event_created_at BIGINT UNSIGNED NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_invoice_provider_payment
  ON billing_invoices (provider_mode, razorpay_payment_id);

ALTER TABLE billing_refunds ADD COLUMN IF NOT EXISTS provider_event_created_at BIGINT UNSIGNED NULL;

ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(191) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_history_dedupe ON billing_history (dedupe_key);

CREATE TABLE IF NOT EXISTS billing_notification_outbox (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  outbox_uid VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  channel ENUM('in_app','email') NOT NULL,
  notification_type VARCHAR(80) NOT NULL,
  dedupe_key VARCHAR(191) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('pending','delivering','delivered','failed','dead') NOT NULL DEFAULT 'pending',
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  lock_token VARCHAR(64) NULL,
  last_error TEXT NULL,
  delivered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_outbox_uid (outbox_uid),
  UNIQUE KEY uq_billing_outbox_dedupe (channel, dedupe_key),
  KEY idx_billing_outbox_claim (status, available_at, locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
