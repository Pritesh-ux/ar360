-- AR360 Phase 11 — SaaS platform / customer / product version isolation.
-- Structured release notes only. Does NOT migrate products or change billing.

ALTER TABLE ar360_platform_releases
  ADD COLUMN IF NOT EXISTS release_notes_json JSON NULL;

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '11', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

UPDATE platform_settings
   SET setting_value = '11'
 WHERE setting_key = 'ar360_runtime_phase';
