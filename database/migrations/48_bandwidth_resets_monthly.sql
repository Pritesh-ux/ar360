-- Per-plan: when yearly billed, reset bandwidth on calendar month (opt-in).
-- Default OFF — only plans you enable show this behavior / marketing copy.

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS bandwidth_resets_monthly TINYINT(1) NOT NULL DEFAULT 0 AFTER unlimited_bandwidth;
