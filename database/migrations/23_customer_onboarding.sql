-- Migration 23: Customer onboarding state (Batch 2.5)

CREATE TABLE IF NOT EXISTS customer_onboarding (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(64) NOT NULL,
  status ENUM('not_started','in_progress','completed','skipped') NOT NULL DEFAULT 'not_started',
  current_step TINYINT UNSIGNED NOT NULL DEFAULT 1,
  completed_at DATETIME NULL,
  skipped_at DATETIME NULL,
  business_type VARCHAR(80) NULL,
  primary_goal VARCHAR(120) NULL,
  secondary_goals_json JSON NULL,
  preferred_creation_method VARCHAR(40) NULL,
  sample_product_created TINYINT(1) NOT NULL DEFAULT 0,
  sample_product_id VARCHAR(160) NULL,
  checklist_dismissed_at DATETIME NULL,
  signup_source VARCHAR(40) NOT NULL DEFAULT 'signup',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_onboarding_customer (customer_uid),
  INDEX idx_onboarding_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_website VARCHAR(255) NULL;

-- Existing customers: mark onboarding completed (safe backfill)
INSERT IGNORE INTO customer_onboarding (customer_uid, status, current_step, completed_at, signup_source)
SELECT c.customer_uid, 'completed', 4, COALESCE(c.created_at, NOW()), 'legacy'
  FROM customers c
 WHERE NOT EXISTS (
   SELECT 1 FROM customer_onboarding o WHERE o.customer_uid = c.customer_uid
 );
