-- Phase 2: Custom Domain plan gate + domain metadata columns.

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS allow_custom_domain TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_object_capture;

UPDATE billing_plans SET allow_custom_domain = 0
WHERE id IN ('trial', 'free', 'starter', 'basic', 'pro', 'professional');

UPDATE billing_plans SET allow_custom_domain = 1
WHERE id IN ('business', 'enterprise', 'agency');

ALTER TABLE enterprise_custom_plans
  ADD COLUMN IF NOT EXISTS allow_custom_domain TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_object_capture;

ALTER TABLE custom_domains
  ADD COLUMN IF NOT EXISTS is_primary TINYINT(1) NOT NULL DEFAULT 0 AFTER ssl_status,
  ADD COLUMN IF NOT EXISTS last_check_at DATETIME NULL AFTER is_primary,
  ADD COLUMN IF NOT EXISTS last_error VARCHAR(500) NULL AFTER last_check_at;

CREATE INDEX IF NOT EXISTS idx_cd_status_domain ON custom_domains (status, domain);
CREATE INDEX IF NOT EXISTS idx_cd_customer_primary ON custom_domains (customer_uid, is_primary);
