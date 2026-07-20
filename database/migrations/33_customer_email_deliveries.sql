-- Migration 33: idempotent customer lifecycle email delivery tracking.
CREATE TABLE IF NOT EXISTS email_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient VARCHAR(191) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  template VARCHAR(120) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'sent',
  provider_message_id VARCHAR(191) NULL,
  error_message TEXT NULL,
  metadata JSON NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_logs_recipient (recipient),
  KEY idx_email_logs_status (status),
  KEY idx_email_logs_created (created_at),
  KEY idx_email_logs_template (template)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_email_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_uid VARCHAR(64) NOT NULL,
  dedupe_key VARCHAR(191) NOT NULL,
  template_id VARCHAR(80) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  status ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
  attempts INT UNSIGNED NOT NULL DEFAULT 1,
  provider_message_id VARCHAR(255) NULL,
  error_message VARCHAR(1000) NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_email_delivery (customer_uid, dedupe_key),
  KEY idx_customer_email_status (status, updated_at),
  CONSTRAINT fk_customer_email_delivery_customer
    FOREIGN KEY (customer_uid) REFERENCES customers(customer_uid)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
