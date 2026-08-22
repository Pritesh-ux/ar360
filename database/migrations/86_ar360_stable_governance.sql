-- AR360 Phase 10 — stable release governance metadata (pointer only).
-- Does NOT migrate products. Does NOT enable VERSIONED. Does NOT set a stable release.

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_previous_stable_release_id', '', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_previous_stable_release_id'
);

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_stable_activated_at', '', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_stable_activated_at'
);

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_stable_activated_by_admin_id', '', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_stable_activated_by_admin_id'
);

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_stable_request_release_id', '', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_stable_request_release_id'
);

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_stable_last_health', '', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_stable_last_health'
);

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '10', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

UPDATE platform_settings
   SET setting_value = '10'
 WHERE setting_key = 'ar360_runtime_phase';
