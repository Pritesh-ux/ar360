-- Migration 79: Phase 2 release manager columns + safe stable pointer setting.
-- Does NOT activate a renderer release. Does NOT migrate products.

ALTER TABLE ar360_platform_releases ADD COLUMN IF NOT EXISTS title VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE ar360_platform_releases ADD COLUMN IF NOT EXISTS created_by_admin_id BIGINT UNSIGNED NULL;
ALTER TABLE ar360_platform_releases ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE ar360_platform_releases ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Support archive lifecycle. Keep 'retired' as alias for older Phase 1 drafts.
ALTER TABLE ar360_platform_releases
  MODIFY COLUMN status ENUM('draft', 'published', 'archived', 'retired') NOT NULL DEFAULT 'draft';

UPDATE ar360_platform_releases
SET status = 'archived'
WHERE status = 'retired';

-- Active Stable pointer foundation: EMPTY = legacy runtime (current production).
-- Do NOT set this to 1.0.0 — publishing a release does not activate the renderer.
INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_active_stable_release_id', '', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_active_stable_release_id'
);

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_release_manager_phase', '2', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_release_manager_phase'
);
