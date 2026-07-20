-- Migration 18: Payment method display metadata (provider references only — no card numbers)
-- Idempotent

CREATE TABLE IF NOT EXISTS payment_methods (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_method_uid VARCHAR(80) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  provider_customer_id VARCHAR(191) NULL,
  provider_payment_method_id VARCHAR(191) NOT NULL,
  brand VARCHAR(32) NOT NULL DEFAULT '',
  last_four VARCHAR(4) NOT NULL DEFAULT '',
  exp_month TINYINT UNSIGNED NULL,
  exp_year SMALLINT UNSIGNED NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('active','expired','removed') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_methods_uid (payment_method_uid),
  INDEX idx_payment_methods_customer_default (customer_uid, is_default),
  INDEX idx_payment_methods_provider_ref (provider, provider_payment_method_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
