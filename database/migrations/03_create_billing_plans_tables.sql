-- Migration 03: Create Billing Plans Tables
-- Tables: plans, billing_plans, customer_subscriptions

CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  monthly_price INT NOT NULL DEFAULT 0,
  yearly_price INT NOT NULL DEFAULT 0,
  products VARCHAR(80) NOT NULL DEFAULT '0',
  storage VARCHAR(80) NOT NULL DEFAULT '',
  bandwidth VARCHAR(80) NOT NULL DEFAULT '',
  views VARCHAR(80) NOT NULL DEFAULT '',
  team_members VARCHAR(80) NOT NULL DEFAULT '1',
  analytics VARCHAR(120) NOT NULL DEFAULT 'Basic',
  api_access BOOLEAN NOT NULL DEFAULT FALSE,
  custom_branding BOOLEAN NOT NULL DEFAULT FALSE,
  white_label BOOLEAN NOT NULL DEFAULT FALSE,
  support VARCHAR(160) NOT NULL DEFAULT 'Email',
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_plans (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  tagline VARCHAR(180) NULL,
  description TEXT NULL,
  storage_gb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  bandwidth_gb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  products INT NOT NULL DEFAULT 0,
  price_monthly_inr INT NULL,
  price_yearly_inr INT NULL,
  trial_hours INT NULL,
  popular TINYINT(1) NOT NULL DEFAULT 0,
  badge VARCHAR(80) NULL,
  icon VARCHAR(40) NOT NULL DEFAULT 'paper',
  features_json JSON NULL,
  custom_branding TINYINT(1) NOT NULL DEFAULT 0,
  advanced_analytics TINYINT(1) NOT NULL DEFAULT 0,
  embed_viewer TINYINT(1) NOT NULL DEFAULT 0,
  priority_processing TINYINT(1) NOT NULL DEFAULT 0,
  priority_support TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  billing_period VARCHAR(30) NULL,
  provider VARCHAR(40) NULL,
  provider_subscription_id VARCHAR(191) NULL,
  provider_customer_id VARCHAR(191) NULL,
  grace_ends_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_subscription_customer (customer_uid),
  INDEX idx_customer_subscriptions_plan (plan_id),
  INDEX idx_customer_subscriptions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
