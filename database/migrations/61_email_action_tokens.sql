-- Secure email deep-link tokens (Stripe/GitHub-style signed one-time actions).
-- Opaque token in URL; claims + HMAC signature stored server-side for audit/integrity.

CREATE TABLE IF NOT EXISTS email_action_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  claims_signature CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  customer_uid VARCHAR(64) NULL,
  email VARCHAR(255) NOT NULL,
  action VARCHAR(64) NOT NULL,
  destination_path VARCHAR(500) NOT NULL,
  single_use TINYINT(1) NOT NULL DEFAULT 1,
  expires_unix INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_action_token_hash (token_hash),
  KEY idx_email_action_user (user_id),
  KEY idx_email_action_email (email),
  KEY idx_email_action_expires (expires_at),
  KEY idx_email_action_customer (customer_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_action_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_id BIGINT UNSIGNED NULL,
  token_hash CHAR(64) NULL,
  user_id BIGINT UNSIGNED NULL,
  email VARCHAR(255) NULL,
  action VARCHAR(64) NULL,
  event_type VARCHAR(64) NOT NULL,
  session_user_id BIGINT UNSIGNED NULL,
  session_email VARCHAR(255) NULL,
  detail VARCHAR(1000) NULL,
  ip_hash VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_email_action_audit_token (token_id),
  KEY idx_email_action_audit_user (user_id),
  KEY idx_email_action_audit_event (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
