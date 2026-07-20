-- Feature gates + QR/Share limits for enterprise custom plans (per-deal control).

ALTER TABLE enterprise_custom_plans
  ADD COLUMN IF NOT EXISTS allow_viewer TINYINT(1) NOT NULL DEFAULT 1 AFTER custom_branding,
  ADD COLUMN IF NOT EXISTS allow_upload TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_viewer,
  ADD COLUMN IF NOT EXISTS allow_ar TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_upload,
  ADD COLUMN IF NOT EXISTS allow_qr TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_ar,
  ADD COLUMN IF NOT EXISTS allow_share TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_qr,
  ADD COLUMN IF NOT EXISTS allow_embed TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_share,
  ADD COLUMN IF NOT EXISTS advanced_analytics TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_embed,
  ADD COLUMN IF NOT EXISTS qr_limit INT NULL AFTER advanced_analytics,
  ADD COLUMN IF NOT EXISTS share_link_limit INT NULL AFTER qr_limit;
