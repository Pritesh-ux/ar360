-- Plan feature gates controllable from Master Admin.
-- Bandwidth for yearly subscriptions resets on calendar-month windows; storage stays plan-scoped.

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS allow_ar TINYINT(1) NOT NULL DEFAULT 1 AFTER priority_support,
  ADD COLUMN IF NOT EXISTS allow_qr TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_ar,
  ADD COLUMN IF NOT EXISTS allow_share TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_qr,
  ADD COLUMN IF NOT EXISTS allow_viewer TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_share,
  ADD COLUMN IF NOT EXISTS allow_upload TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_viewer;

UPDATE billing_plans SET allow_ar = 1, allow_qr = 1, allow_share = 1, allow_viewer = 1, allow_upload = 1
 WHERE id IN ('trial','starter','pro','business','enterprise','basic','professional');
