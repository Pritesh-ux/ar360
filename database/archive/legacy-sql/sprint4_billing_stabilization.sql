CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(80) NOT NULL,
  plan_id VARCHAR(40) NOT NULL DEFAULT 'trial',
  status VARCHAR(30) NOT NULL DEFAULT 'trialing',
  billing_period VARCHAR(30) NULL,
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  grace_ends_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  provider VARCHAR(40) NULL,
  provider_subscription_id VARCHAR(191) NULL,
  provider_customer_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_subscription_customer (customer_uid),
  INDEX idx_customer_subscriptions_plan (plan_id),
  INDEX idx_customer_subscriptions_status (status)
);

CREATE TABLE IF NOT EXISTS billing_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(64) NOT NULL,
  subscription_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(80) NOT NULL,
  title VARCHAR(191) NOT NULL,
  description TEXT NULL,
  amount_paise INT NULL,
  currency VARCHAR(12) NOT NULL DEFAULT 'INR',
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer_uid (customer_uid),
  KEY idx_event_type (event_type),
  KEY idx_created_at (created_at)
);

UPDATE customer_subscriptions SET plan_id = 'trial' WHERE plan_id IN ('free', 'trial');
UPDATE customer_subscriptions SET plan_id = 'basic' WHERE plan_id IN ('starter', 'basic');
UPDATE customer_subscriptions SET plan_id = 'professional' WHERE plan_id IN ('pro', 'professional');
UPDATE customer_subscriptions SET plan_id = 'enterprise' WHERE plan_id IN ('business', 'enterprise');
