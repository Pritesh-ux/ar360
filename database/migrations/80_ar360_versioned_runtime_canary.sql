-- Migration 80: Phase 4 versioned runtime canary foundation.
-- Does NOT activate versioned runtime globally.
-- Does NOT migrate products. Pointers alone never switch runtime.

INSERT INTO ar360_feature_flags (flag_key, description, enabled, targeting, metadata)
SELECT
  'versioned_runtime',
  'Controlled versioned product runtime (canary selected products only). Default OFF.',
  0,
  JSON_OBJECT('scope', 'selected_products', 'productIds', JSON_ARRAY()),
  JSON_OBJECT('phase', 4, 'viewerWired', true, 'globalForbidden', true)
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM ar360_feature_flags WHERE flag_key = 'versioned_runtime'
);

-- Ensure targeting shape exists even if flag was created earlier without it.
UPDATE ar360_feature_flags
SET targeting = JSON_OBJECT('scope', 'selected_products', 'productIds', JSON_ARRAY()),
    metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.phase', 4, '$.globalForbidden', true)
WHERE flag_key = 'versioned_runtime'
  AND (
    targeting IS NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(targeting, '$.scope')) IS NULL
    OR JSON_EXTRACT(targeting, '$.productIds') IS NULL
  );

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '4', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

-- Keep active stable empty = legacy global runtime.
INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_active_stable_release_id', '', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_active_stable_release_id'
);
