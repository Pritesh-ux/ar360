-- Migration 40: production-native Razorpay subscriptions (phase 1).
-- Additive by design: historical orders, payments, invoices, and subscriptions keep their IDs.

-- Repair billing plan columns that older runtime-created schemas may be missing.
ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS unlimited_storage TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS unlimited_bandwidth TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS plan_level INT NOT NULL DEFAULT 0;
ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS qr_limit INT NULL;
ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS share_link_limit INT NULL;
ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS sales_channel ENUM('self_service','manual') NOT NULL DEFAULT 'self_service';
ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS canonical_alias_of VARCHAR(40) NULL;

-- Canonical rows are copied from their former names when available. Alias rows remain readable.
INSERT INTO billing_plans
  (id, name, tagline, description, storage_gb, bandwidth_gb, products,
   price_monthly_inr, price_yearly_inr, trial_hours, popular, badge, icon,
   features_json, custom_branding, advanced_analytics, embed_viewer,
   priority_processing, priority_support, is_active, sort_order,
   unlimited_storage, unlimited_bandwidth, plan_level, qr_limit, share_link_limit, sales_channel)
SELECT 'starter', 'STARTER', tagline, description, storage_gb, bandwidth_gb, products,
       price_monthly_inr, price_yearly_inr, trial_hours, popular, badge, icon,
       features_json, custom_branding, advanced_analytics, embed_viewer,
       priority_processing, priority_support, is_active, 1,
       unlimited_storage, unlimited_bandwidth, 1, qr_limit, share_link_limit, 'self_service'
FROM billing_plans WHERE id = 'basic'
  AND NOT EXISTS (SELECT 1 FROM billing_plans p WHERE p.id = 'starter');

INSERT INTO billing_plans
  (id, name, tagline, description, storage_gb, bandwidth_gb, products,
   price_monthly_inr, price_yearly_inr, trial_hours, popular, badge, icon,
   features_json, custom_branding, advanced_analytics, embed_viewer,
   priority_processing, priority_support, is_active, sort_order,
   unlimited_storage, unlimited_bandwidth, plan_level, qr_limit, share_link_limit, sales_channel)
SELECT 'pro', 'PRO', tagline, description, storage_gb, bandwidth_gb, products,
       price_monthly_inr, price_yearly_inr, trial_hours, popular, badge, icon,
       features_json, custom_branding, advanced_analytics, embed_viewer,
       priority_processing, priority_support, is_active, 2,
       unlimited_storage, unlimited_bandwidth, 2, qr_limit, share_link_limit, 'self_service'
FROM billing_plans WHERE id = 'professional'
  AND NOT EXISTS (SELECT 1 FROM billing_plans p WHERE p.id = 'pro');

-- The former fixed top tier becomes Business only as a new catalog row. Existing
-- enterprise references are deliberately not rewritten because they may be contracts.
INSERT INTO billing_plans
  (id, name, tagline, description, storage_gb, bandwidth_gb, products,
   price_monthly_inr, price_yearly_inr, trial_hours, popular, badge, icon,
   features_json, custom_branding, advanced_analytics, embed_viewer,
   priority_processing, priority_support, is_active, sort_order,
   unlimited_storage, unlimited_bandwidth, plan_level, qr_limit, share_link_limit, sales_channel)
SELECT 'business', 'BUSINESS', tagline, description, storage_gb, bandwidth_gb, products,
       price_monthly_inr, price_yearly_inr, trial_hours, popular, badge, icon,
       features_json, custom_branding, advanced_analytics, embed_viewer,
       priority_processing, priority_support, is_active, 3,
       unlimited_storage, unlimited_bandwidth, 3, qr_limit, share_link_limit, 'self_service'
FROM billing_plans WHERE id = 'enterprise'
  AND NOT EXISTS (SELECT 1 FROM billing_plans p WHERE p.id = 'business');

INSERT IGNORE INTO billing_plans
  (id, name, storage_gb, bandwidth_gb, products, price_monthly_inr,
   price_yearly_inr, icon, is_active, sort_order, plan_level, sales_channel)
VALUES
  ('trial', 'TRIAL', 0.10, 1, 1, 0, 0, 'paper', 1, 0, 0, 'self_service'),
  ('starter', 'STARTER', 0.50, 5, 5, 249, 2499, 'plane', 1, 1, 1, 'self_service'),
  ('pro', 'PRO', 5, 50, 50, 999, 9999, 'rocket', 1, 2, 2, 'self_service'),
  ('business', 'BUSINESS', 25, 250, 250, NULL, NULL, 'planet', 1, 3, 3, 'self_service'),
  ('enterprise', 'ENTERPRISE', 25, 250, 250, NULL, NULL, 'planet', 1, 4, 4, 'manual');

UPDATE billing_plans SET canonical_alias_of = 'starter', is_active = 0 WHERE id = 'basic';
UPDATE billing_plans SET canonical_alias_of = 'pro', is_active = 0 WHERE id = 'professional';
UPDATE billing_plans SET plan_level = 0 WHERE id IN ('trial','free');
UPDATE billing_plans SET plan_level = 1 WHERE id IN ('starter','basic');
UPDATE billing_plans SET plan_level = 2 WHERE id IN ('pro','professional');
UPDATE billing_plans SET plan_level = 3 WHERE id = 'business';
UPDATE billing_plans SET plan_level = 4, sales_channel = 'manual',
  price_monthly_inr = NULL, price_yearly_inr = NULL WHERE id = 'enterprise';

-- Immutable price snapshots. New prices are inserted as new versions; consumers
-- reference the version used at checkout instead of mutable billing_plans prices.
CREATE TABLE IF NOT EXISTS billing_plan_price_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  price_version_uid VARCHAR(64) NOT NULL,
  plan_id VARCHAR(40) NOT NULL,
  billing_interval ENUM('monthly','yearly') NOT NULL,
  provider_mode ENUM('test','live') NOT NULL,
  version INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  subtotal_paise BIGINT UNSIGNED NOT NULL,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  gst_paise BIGINT UNSIGNED NOT NULL,
  total_paise BIGINT UNSIGNED NOT NULL,
  gst_inclusive TINYINT(1) NOT NULL DEFAULT 1,
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  provider_plan_id VARCHAR(191) NULL,
  active_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retired_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_price_uid (price_version_uid),
  UNIQUE KEY uq_billing_price_version (plan_id, billing_interval, provider_mode, version),
  UNIQUE KEY uq_billing_price_provider_plan (provider, provider_mode, provider_plan_id),
  KEY idx_billing_price_active (plan_id, billing_interval, provider_mode, retired_at),
  CONSTRAINT chk_billing_price_total CHECK (total_paise = subtotal_paise + gst_paise),
  CONSTRAINT chk_billing_price_self_service CHECK (plan_id <> 'enterprise')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_checkout_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  checkout_session_uid VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NULL,
  plan_id VARCHAR(40) NOT NULL,
  price_version_id BIGINT UNSIGNED NOT NULL,
  billing_interval ENUM('monthly','yearly') NOT NULL,
  provider_mode ENUM('test','live') NOT NULL,
  provider_customer_id VARCHAR(191) NULL,
  provider_subscription_id VARCHAR(191) NULL,
  provider_order_id VARCHAR(191) NULL,
  status ENUM('created','opened','completed','expired','cancelled','failed') NOT NULL DEFAULT 'created',
  idempotency_key VARCHAR(191) NOT NULL,
  expires_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  failure_code VARCHAR(100) NULL,
  failure_message TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_checkout_uid (checkout_session_uid),
  UNIQUE KEY uq_billing_checkout_idempotency (customer_uid, idempotency_key),
  UNIQUE KEY uq_billing_checkout_provider_subscription (provider_mode, provider_subscription_id),
  KEY idx_billing_checkout_customer_status (customer_uid, status, created_at),
  CONSTRAINT fk_billing_checkout_price FOREIGN KEY (price_version_id)
    REFERENCES billing_plan_price_versions(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Native subscription linkage and safe legacy classification.
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS price_version_id BIGINT UNSIGNED NULL;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS checkout_session_uid VARCHAR(64) NULL;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS provider_plan_id VARCHAR(191) NULL;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS provider_mode ENUM('test','live') NULL;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS sales_channel ENUM('self_service','manual','legacy') NOT NULL DEFAULT 'legacy';
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS quantity INT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS classification_status ENUM('canonical','contract_confirmed','ambiguous_legacy') NOT NULL DEFAULT 'canonical';
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS classification_note VARCHAR(500) NULL;

UPDATE customer_subscriptions s
JOIN enterprise_contracts ec ON ec.subscription_id = s.id
SET s.classification_status = 'contract_confirmed',
    s.sales_channel = 'manual',
    s.classification_note = CONCAT('Enterprise contract ', ec.contract_uid)
WHERE s.plan_id = 'enterprise';

UPDATE customer_subscriptions s
LEFT JOIN enterprise_contracts ec ON ec.subscription_id = s.id
SET s.classification_status = 'ambiguous_legacy',
    s.classification_note = 'Pre-migration enterprise could be former Business; manual review required'
WHERE s.plan_id = 'enterprise' AND ec.id IS NULL;

-- Extend both the legacy and canonical ledgers without changing historical values.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_mode ENUM('test','live') NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(191) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(191) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(191) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_session_uid VARCHAR(64) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS price_version_id BIGINT UNSIGNED NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_paise BIGINT UNSIGNED NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gst_paise BIGINT UNSIGNED NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS total_paise BIGINT UNSIGNED NULL;

ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS provider VARCHAR(32) NOT NULL DEFAULT 'razorpay';
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS provider_mode ENUM('test','live') NULL;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(191) NULL;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS checkout_session_uid VARCHAR(64) NULL;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS price_version_id BIGINT UNSIGNED NULL;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS fee_paise BIGINT UNSIGNED NULL;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS tax_paise BIGINT UNSIGNED NULL;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS captured_at DATETIME NULL;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS failure_code VARCHAR(100) NULL;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS failure_description TEXT NULL;

ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS checkout_session_uid VARCHAR(64) NULL;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS price_version_id BIGINT UNSIGNED NULL;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS provider_invoice_id VARCHAR(191) NULL;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(191) NULL;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS provider_mode ENUM('test','live') NULL;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS supply_state_code VARCHAR(8) NULL;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100) NULL;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS price_snapshot JSON NULL;

CREATE TABLE IF NOT EXISTS billing_refunds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  refund_uid VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  billing_payment_id BIGINT NULL,
  invoice_uid VARCHAR(64) NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  provider_mode ENUM('test','live') NOT NULL,
  provider_payment_id VARCHAR(191) NOT NULL,
  provider_refund_id VARCHAR(191) NULL,
  amount_paise BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM('created','pending','processed','failed') NOT NULL DEFAULT 'created',
  reason VARCHAR(191) NULL,
  failure_code VARCHAR(100) NULL,
  raw_payload JSON NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_refund_uid (refund_uid),
  UNIQUE KEY uq_billing_refund_provider (provider, provider_mode, provider_refund_id),
  KEY idx_billing_refund_payment (provider_payment_id),
  KEY idx_billing_refund_customer (customer_uid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Durable webhook inbox: leases and retries allow crash-safe at-least-once processing.
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS provider_mode ENUM('test','live') NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(191) NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS headers_json JSON NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS processing_started_at DATETIME NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS lock_token VARCHAR(64) NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS attempt_count INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS last_error TEXT NULL;
ALTER TABLE billing_webhook_events ADD COLUMN IF NOT EXISTS dead_lettered_at DATETIME NULL;
UPDATE billing_webhook_events
SET dedupe_key = CONCAT(provider, ':legacy:', event_uid)
WHERE dedupe_key IS NULL;

SET @webhook_dedupe_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_webhook_events'
    AND INDEX_NAME = 'uq_billing_webhook_dedupe'
);
SET @ddl := IF(@webhook_dedupe_index = 0,
  'CREATE UNIQUE INDEX uq_billing_webhook_dedupe ON billing_webhook_events (dedupe_key)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS billing_reconciliation_issues (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  issue_uid VARCHAR(64) NOT NULL,
  issue_type VARCHAR(80) NOT NULL,
  severity ENUM('info','warning','error','critical') NOT NULL DEFAULT 'warning',
  status ENUM('open','investigating','resolved','ignored') NOT NULL DEFAULT 'open',
  customer_uid VARCHAR(64) NULL,
  subscription_id BIGINT NULL,
  provider VARCHAR(32) NULL,
  provider_mode ENUM('test','live') NULL,
  provider_object_type VARCHAR(50) NULL,
  provider_object_id VARCHAR(191) NULL,
  local_object_type VARCHAR(50) NULL,
  local_object_id VARCHAR(191) NULL,
  summary VARCHAR(500) NOT NULL,
  details JSON NULL,
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  resolved_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_reconciliation_uid (issue_uid),
  UNIQUE KEY uq_billing_reconciliation_open_object
    (issue_type, provider_mode, provider_object_id, local_object_id),
  KEY idx_billing_reconciliation_queue (status, severity, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO billing_reconciliation_issues
  (issue_uid, issue_type, severity, customer_uid, subscription_id,
   local_object_type, local_object_id, summary, details)
SELECT CONCAT('bri_m40_sub_', s.id), 'ambiguous_legacy_plan', 'warning',
       s.customer_uid, s.id, 'customer_subscription', CAST(s.id AS CHAR),
       'Legacy enterprise plan requires Business/Enterprise classification',
       JSON_OBJECT('plan_id', s.plan_id, 'preserved', TRUE)
FROM customer_subscriptions s
WHERE s.classification_status = 'ambiguous_legacy'
ON DUPLICATE KEY UPDATE last_seen_at = last_seen_at;

INSERT INTO billing_reconciliation_issues
  (issue_uid, issue_type, severity, customer_uid, local_object_type,
   local_object_id, summary, details)
SELECT CONCAT('bri_m40_customer_', c.id), 'ambiguous_legacy_plan', 'warning',
       c.customer_uid, 'customer', CAST(c.id AS CHAR),
       'Customer plan mirror says enterprise without a confirmed contract',
       JSON_OBJECT('plan_id', c.plan_id, 'preserved', TRUE)
FROM customers c
LEFT JOIN customer_subscriptions s
  ON s.customer_uid = c.customer_uid AND s.classification_status = 'contract_confirmed'
WHERE c.plan_id = 'enterprise' AND s.id IS NULL
ON DUPLICATE KEY UPDATE last_seen_at = last_seen_at;

-- Append-only audit ledger. Application code only inserts; hash fields support
-- tamper-evident chaining without making audit history depend on mutable entities.
CREATE TABLE IF NOT EXISTS billing_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  audit_uid VARCHAR(64) NOT NULL,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actor_type ENUM('system','customer','admin','webhook','reconciler') NOT NULL,
  actor_id VARCHAR(191) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(191) NOT NULL,
  customer_uid VARCHAR(64) NULL,
  request_id VARCHAR(191) NULL,
  idempotency_key VARCHAR(191) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  metadata JSON NULL,
  previous_hash CHAR(64) NULL,
  entry_hash CHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_audit_uid (audit_uid),
  UNIQUE KEY uq_billing_audit_hash (entry_hash),
  KEY idx_billing_audit_entity (entity_type, entity_id, occurred_at),
  KEY idx_billing_audit_customer (customer_uid, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
