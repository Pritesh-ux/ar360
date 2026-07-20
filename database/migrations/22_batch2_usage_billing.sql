-- Migration 22: Batch 2 — usage metering, QR/share limits, bandwidth events, checkout expiry

-- Plan limits for QR codes and share links
ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS qr_limit INT NULL;
ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS share_link_limit INT NULL;

UPDATE billing_plans SET qr_limit = 3, share_link_limit = 5 WHERE id IN ('trial', 'free') AND qr_limit IS NULL;
UPDATE billing_plans SET qr_limit = 20, share_link_limit = NULL WHERE id IN ('basic', 'starter') AND qr_limit IS NULL;
UPDATE billing_plans SET qr_limit = 100, share_link_limit = NULL WHERE id IN ('professional', 'pro') AND qr_limit IS NULL;
UPDATE billing_plans SET qr_limit = NULL, share_link_limit = NULL WHERE id IN ('enterprise', 'business', 'agency') AND qr_limit IS NULL;

-- Checkout pending protection
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL;

-- Webhook idempotency hardening
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'received';
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS error_message TEXT NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64) NULL;

-- Bandwidth usage events (canonical delivery log)
CREATE TABLE IF NOT EXISTS bandwidth_usage_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(64) NOT NULL,
  product_id VARCHAR(160) NULL,
  asset_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(40) NOT NULL,
  bytes_transferred BIGINT UNSIGNED NOT NULL DEFAULT 0,
  measurement_mode ENUM('recorded','estimated') NOT NULL DEFAULT 'recorded',
  viewer_type VARCHAR(40) NULL,
  share_link_id BIGINT UNSIGNED NULL,
  qr_code_id BIGINT UNSIGNED NULL,
  session_id VARCHAR(64) NULL,
  billing_period_key VARCHAR(32) NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bandwidth_events_customer_period (customer_uid, billing_period_key),
  INDEX idx_bandwidth_events_occurred (occurred_at),
  INDEX idx_bandwidth_events_session (session_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product asset lifecycle columns (non-destructive)
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS asset_type VARCHAR(40) NULL;
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL;
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP;
