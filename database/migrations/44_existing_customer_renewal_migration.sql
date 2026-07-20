-- Existing paid one-time terms transition to native subscriptions only at renewal.
-- billing_orders remains an immutable legacy ledger; no historical order is rewritten.

ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS term_mode VARCHAR(40) NOT NULL DEFAULT 'canonical';
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS legacy_migrated_at DATETIME NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS legacy_term_end DATETIME NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_state VARCHAR(40) NOT NULL DEFAULT 'not_applicable';
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_invited_at DATETIME NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_consent_at DATETIME NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_terms_version VARCHAR(40) NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_consent_idempotency VARCHAR(191) NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_checkout_session_uid VARCHAR(64) NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_provider_subscription_id VARCHAR(191) NULL;
ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS legacy_expired_at DATETIME NULL;

ALTER TABLE billing_checkout_sessions
  ADD COLUMN IF NOT EXISTS start_at DATETIME NULL;
ALTER TABLE billing_checkout_sessions
  ADD COLUMN IF NOT EXISTS checkout_purpose VARCHAR(40) NOT NULL DEFAULT 'new_subscription';

CREATE TABLE IF NOT EXISTS billing_renewal_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_uid VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(80) NOT NULL,
  subscription_id BIGINT NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  idempotency_key VARCHAR(191) NOT NULL,
  effective_at DATETIME NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_renewal_event_uid (event_uid),
  UNIQUE KEY uq_billing_renewal_event_idempotency (idempotency_key),
  KEY idx_billing_renewal_event_customer (customer_uid, created_at),
  KEY idx_billing_renewal_event_subscription (subscription_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_renewal_due
  ON customer_subscriptions (term_mode, renewal_state, current_period_end);

-- Contract evidence wins. An enterprise label by itself is not contract evidence.
UPDATE customer_subscriptions s
JOIN enterprise_contracts ec ON ec.subscription_id = s.id
SET s.classification_status = 'contract_confirmed',
    s.sales_channel = 'manual',
    s.classification_note = CONCAT('Enterprise contract ', ec.contract_uid)
WHERE s.plan_id = 'enterprise';

UPDATE customer_subscriptions s
LEFT JOIN enterprise_contracts ec ON ec.subscription_id = s.id
SET s.classification_status = 'ambiguous_legacy',
    s.classification_note = 'Enterprise label has no linked contract evidence; admin review required'
WHERE s.plan_id = 'enterprise' AND ec.id IS NULL;

INSERT INTO billing_reconciliation_issues
  (issue_uid, issue_type, severity, customer_uid, subscription_id,
   local_object_type, local_object_id, summary, details)
SELECT CONCAT('bri_m44_enterprise_', s.id), 'ambiguous_enterprise_contract', 'warning',
       s.customer_uid, s.id, 'customer_subscription', CAST(s.id AS CHAR),
       'Enterprise row has no contract evidence and must not be auto-converted',
       JSON_OBJECT('plan_id', s.plan_id, 'auto_convert_to_business', FALSE)
FROM customer_subscriptions s
WHERE s.plan_id = 'enterprise' AND s.classification_status = 'ambiguous_legacy'
ON DUPLICATE KEY UPDATE last_seen_at = last_seen_at;
