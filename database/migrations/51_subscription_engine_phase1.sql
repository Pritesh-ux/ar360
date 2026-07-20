-- Phase 1 subscription engine: Object Capture limits on plans (DB-backed, no plan-name hardcoding).

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS allow_object_capture TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_upload,
  ADD COLUMN IF NOT EXISTS oc_captures_per_month INT NULL AFTER allow_object_capture,
  ADD COLUMN IF NOT EXISTS oc_compute_seconds_per_month INT NULL AFTER oc_captures_per_month,
  ADD COLUMN IF NOT EXISTS oc_concurrent_jobs INT NULL AFTER oc_compute_seconds_per_month,
  ADD COLUMN IF NOT EXISTS oc_max_retries INT NULL AFTER oc_concurrent_jobs;

ALTER TABLE enterprise_custom_plans
  ADD COLUMN IF NOT EXISTS allow_object_capture TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_embed,
  ADD COLUMN IF NOT EXISTS oc_captures_per_month INT NULL AFTER allow_object_capture,
  ADD COLUMN IF NOT EXISTS oc_compute_seconds_per_month INT NULL AFTER oc_captures_per_month,
  ADD COLUMN IF NOT EXISTS oc_concurrent_jobs INT NULL AFTER oc_compute_seconds_per_month,
  ADD COLUMN IF NOT EXISTS oc_max_retries INT NULL AFTER oc_concurrent_jobs;

-- Seed OC defaults matching previous hardcoded map (only where NULL).
UPDATE billing_plans SET
  allow_object_capture = 1,
  oc_captures_per_month = 1,
  oc_compute_seconds_per_month = 3600,
  oc_concurrent_jobs = 1,
  oc_max_retries = 1
WHERE id IN ('trial', 'free') AND oc_captures_per_month IS NULL;

UPDATE billing_plans SET
  allow_object_capture = 1,
  oc_captures_per_month = 5,
  oc_compute_seconds_per_month = 36000,
  oc_concurrent_jobs = 1,
  oc_max_retries = 2
WHERE id IN ('starter', 'basic') AND oc_captures_per_month IS NULL;

UPDATE billing_plans SET
  allow_object_capture = 1,
  oc_captures_per_month = 25,
  oc_compute_seconds_per_month = 180000,
  oc_concurrent_jobs = 2,
  oc_max_retries = 3
WHERE id IN ('pro', 'professional') AND oc_captures_per_month IS NULL;

UPDATE billing_plans SET
  allow_object_capture = 1,
  oc_captures_per_month = 100,
  oc_compute_seconds_per_month = 720000,
  oc_concurrent_jobs = 4,
  oc_max_retries = 4
WHERE id = 'business' AND oc_captures_per_month IS NULL;

UPDATE billing_plans SET
  allow_object_capture = 1,
  oc_captures_per_month = 1000,
  oc_compute_seconds_per_month = 7200000,
  oc_concurrent_jobs = 10,
  oc_max_retries = 5
WHERE id IN ('enterprise', 'agency') AND oc_captures_per_month IS NULL;

-- Helpful indexes (no-op if already present on some MySQL versions via IF NOT EXISTS unsupported — use procedure-safe adds in app ensure*).
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_uid_status
  ON customer_subscriptions (customer_uid, status);
