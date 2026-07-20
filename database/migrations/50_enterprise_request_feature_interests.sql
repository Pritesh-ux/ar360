-- Prospect interest flags on enterprise quote requests (Contact Sales form).

ALTER TABLE enterprise_requests
  ADD COLUMN IF NOT EXISTS needs_qr TINYINT(1) NOT NULL DEFAULT 0 AFTER needs_sla,
  ADD COLUMN IF NOT EXISTS needs_embed TINYINT(1) NOT NULL DEFAULT 0 AFTER needs_qr,
  ADD COLUMN IF NOT EXISTS needs_share TINYINT(1) NOT NULL DEFAULT 0 AFTER needs_embed,
  ADD COLUMN IF NOT EXISTS needs_ar TINYINT(1) NOT NULL DEFAULT 0 AFTER needs_share,
  ADD COLUMN IF NOT EXISTS needs_analytics TINYINT(1) NOT NULL DEFAULT 0 AFTER needs_ar;
