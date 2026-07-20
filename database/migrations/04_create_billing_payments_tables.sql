-- Migration 04: Create Billing Payments Tables
-- Tables: payments, billing_orders, billing_payments, billing_history, billing_invoices, billing_webhook_events

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_uid VARCHAR(80) NOT NULL UNIQUE,
  customer_uid VARCHAR(40) NOT NULL,
  invoice VARCHAR(80) NOT NULL DEFAULT '',
  plan_id VARCHAR(80) NOT NULL DEFAULT '',
  billing_cycle ENUM('Monthly','Yearly','Free','Custom') NOT NULL DEFAULT 'Monthly',
  amount INT NOT NULL DEFAULT 0,
  gst INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  status ENUM('Paid','Pending','Failed','Refunded') NOT NULL DEFAULT 'Pending',
  gateway VARCHAR(80) NOT NULL DEFAULT '',
  transaction_id VARCHAR(160) NOT NULL DEFAULT '',
  payment_method VARCHAR(80) NOT NULL DEFAULT '',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_customer (customer_uid),
  INDEX idx_payments_status (status),
  INDEX idx_payments_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_uid VARCHAR(64) NOT NULL UNIQUE,
  customer_uid VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NULL,
  plan_id VARCHAR(64) NOT NULL,
  billing_period ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  razorpay_order_id VARCHAR(128) NOT NULL UNIQUE,
  amount_paise INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status ENUM('created','paid','failed','cancelled') NOT NULL DEFAULT 'created',
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_billing_orders_customer (customer_uid),
  INDEX idx_billing_orders_plan (plan_id),
  INDEX idx_billing_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payment_uid VARCHAR(64) NOT NULL UNIQUE,
  customer_uid VARCHAR(64) NOT NULL,
  order_uid VARCHAR(64) NOT NULL,
  razorpay_order_id VARCHAR(128) NOT NULL,
  razorpay_payment_id VARCHAR(128) NULL,
  razorpay_signature VARCHAR(255) NULL,
  amount_paise INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status ENUM('created','captured','failed','refunded') NOT NULL DEFAULT 'created',
  raw_payload JSON NULL,
  subscription_id BIGINT UNSIGNED NULL,
  invoice_uid VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_billing_payments_customer (customer_uid),
  INDEX idx_billing_payments_order (order_uid),
  INDEX idx_billing_payments_razorpay_payment (razorpay_payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_uid VARCHAR(64) NOT NULL UNIQUE,
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  event_type VARCHAR(128) NOT NULL,
  provider_event_id VARCHAR(128) NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSON NOT NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_billing_webhook_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
