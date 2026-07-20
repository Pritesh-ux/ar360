-- Migration 28: Quote snapshots and Enterprise payment invoice links
-- Adds fields only; no additional Enterprise tables are created.

ALTER TABLE enterprise_custom_plans
  ADD COLUMN IF NOT EXISTS priority_support TINYINT(1) NOT NULL DEFAULT 0 AFTER custom_branding;

ALTER TABLE enterprise_quotes
  ADD COLUMN IF NOT EXISTS plan_name VARCHAR(160) NOT NULL DEFAULT 'Custom Enterprise' AFTER custom_plan_id,
  ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT UNSIGNED NULL AFTER currency,
  ADD COLUMN IF NOT EXISTS bandwidth_limit_bytes BIGINT UNSIGNED NULL AFTER storage_limit_bytes,
  ADD COLUMN IF NOT EXISTS product_limit INT UNSIGNED NULL AFTER bandwidth_limit_bytes,
  ADD COLUMN IF NOT EXISTS model_limit INT UNSIGNED NULL AFTER product_limit,
  ADD COLUMN IF NOT EXISTS ar_experience_limit INT UNSIGNED NULL AFTER model_limit,
  ADD COLUMN IF NOT EXISTS team_member_limit INT UNSIGNED NULL AFTER ar_experience_limit,
  ADD COLUMN IF NOT EXISTS custom_branding TINYINT(1) NOT NULL DEFAULT 0 AFTER team_member_limit,
  ADD COLUMN IF NOT EXISTS priority_support TINYINT(1) NOT NULL DEFAULT 0 AFTER custom_branding,
  ADD COLUMN IF NOT EXISTS dedicated_infrastructure TINYINT(1) NOT NULL DEFAULT 0 AFTER priority_support,
  ADD COLUMN IF NOT EXISTS sla_support TINYINT(1) NOT NULL DEFAULT 0 AFTER dedicated_infrastructure,
  ADD COLUMN IF NOT EXISTS support_level VARCHAR(100) NULL AFTER sla_support,
  ADD COLUMN IF NOT EXISTS plan_notes TEXT NULL AFTER support_level;
