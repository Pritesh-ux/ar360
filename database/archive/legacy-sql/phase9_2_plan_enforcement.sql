CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(64) NOT NULL,
  plan_id VARCHAR(64) NOT NULL DEFAULT 'trial',
  status VARCHAR(32) NOT NULL DEFAULT 'trialing',
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_subscription (customer_uid),
  KEY idx_plan_status (plan_id, status)
);

CREATE TABLE IF NOT EXISTS product_assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(64) NOT NULL,
  product_uid VARCHAR(64) NULL,
  asset_type VARCHAR(32) NOT NULL,
  path TEXT NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer_assets (customer_uid),
  KEY idx_product_assets (product_uid)
);

INSERT INTO customer_subscriptions (customer_uid, plan_id, status, trial_started_at, trial_ends_at)
SELECT c.customer_uid, 'trial', 'trialing', NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR)
FROM customers c
LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
WHERE s.customer_uid IS NULL;
