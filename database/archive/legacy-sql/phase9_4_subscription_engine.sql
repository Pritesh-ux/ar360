CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(64) NOT NULL,
  plan_id VARCHAR(64) NOT NULL,
  period ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  status ENUM('trial','active','pending_payment','past_due','cancelled','expired','grace') NOT NULL DEFAULT 'trial',
  razorpay_subscription_id VARCHAR(191) NULL,
  razorpay_customer_id VARCHAR(191) NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  trial_ends_at DATETIME NULL,
  grace_ends_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_subscription (customer_uid),
  KEY idx_customer_uid (customer_uid),
  KEY idx_plan_id (plan_id),
  KEY idx_status (status)
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

CREATE TABLE IF NOT EXISTS billing_invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_uid VARCHAR(64) NOT NULL UNIQUE,
  customer_uid VARCHAR(64) NOT NULL,
  subscription_id BIGINT UNSIGNED NULL,
  plan_id VARCHAR(64) NOT NULL,
  period ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  amount_paise INT NOT NULL DEFAULT 0,
  tax_paise INT NOT NULL DEFAULT 0,
  total_paise INT NOT NULL DEFAULT 0,
  currency VARCHAR(12) NOT NULL DEFAULT 'INR',
  status ENUM('draft','paid','failed','void','refunded') NOT NULL DEFAULT 'draft',
  razorpay_payment_id VARCHAR(191) NULL,
  paid_at DATETIME NULL,
  due_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customer_uid (customer_uid),
  KEY idx_status (status),
  KEY idx_created_at (created_at)
);

ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS subscription_id BIGINT UNSIGNED NULL;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS invoice_uid VARCHAR(64) NULL;
