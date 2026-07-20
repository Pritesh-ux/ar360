CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  storage_gb DECIMAL(10,2) NOT NULL DEFAULT 0,
  bandwidth_gb DECIMAL(10,2) NOT NULL DEFAULT 0,
  product_limit INT NOT NULL DEFAULT 0,
  price_monthly_inr INT NULL,
  price_yearly_inr INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(80) NOT NULL,
  plan_id VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'trialing',
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_subscriptions_customer (customer_uid),
  INDEX idx_customer_subscriptions_plan (plan_id),
  INDEX idx_customer_subscriptions_status (status)
);

CREATE TABLE IF NOT EXISTS customer_usage_monthly (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(80) NOT NULL,
  period_ym VARCHAR(7) NOT NULL,
  products_used INT NOT NULL DEFAULT 0,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  bandwidth_bytes BIGINT NOT NULL DEFAULT 0,
  viewer_opens INT NOT NULL DEFAULT 0,
  ar_launches INT NOT NULL DEFAULT 0,
  screenshots INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_period (customer_uid, period_ym),
  INDEX idx_usage_customer (customer_uid)
);

INSERT INTO plans (id, name, storage_gb, bandwidth_gb, product_limit, price_monthly_inr, price_yearly_inr)
VALUES
('trial', 'STARTER', 0.1, 1, 1, 0, 0),
('basic', 'BASIC', 0.5, 5, 5, 249, 2499),
('professional', 'PROFESSIONAL', 5, 50, 50, 999, 9999),
('enterprise', 'ENTERPRISE', 25, 250, 250, NULL, NULL)
ON DUPLICATE KEY UPDATE
name = VALUES(name),
storage_gb = VALUES(storage_gb),
bandwidth_gb = VALUES(bandwidth_gb),
product_limit = VALUES(product_limit),
price_monthly_inr = VALUES(price_monthly_inr),
price_yearly_inr = VALUES(price_yearly_inr);
