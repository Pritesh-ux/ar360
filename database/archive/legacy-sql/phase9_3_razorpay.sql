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
);

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_billing_payments_customer (customer_uid),
  INDEX idx_billing_payments_order (order_uid),
  INDEX idx_billing_payments_razorpay_payment (razorpay_payment_id)
);

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
);
