-- AR360 Phase 5B — component revision lifecycle columns.
-- Immutable drafts / active / archived. Does not mutate existing config_json bodies.
-- Does NOT enable VERSIONED globally or activate stable release.

ALTER TABLE ar360_product_config_revisions
  ADD COLUMN IF NOT EXISTS component_kind ENUM(
    'config',
    'geometry',
    'material',
    'lighting',
    'viewer',
    'ar'
  ) NOT NULL DEFAULT 'config' AFTER revision_number,
  ADD COLUMN IF NOT EXISTS component_revision_number INT UNSIGNED NULL AFTER component_kind,
  ADD COLUMN IF NOT EXISTS status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'active' AFTER source,
  ADD COLUMN IF NOT EXISTS parent_revision_id BIGINT UNSIGNED NULL AFTER status,
  ADD COLUMN IF NOT EXISTS notes VARCHAR(512) NULL AFTER reason,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NULL AFTER created_at,
  ADD COLUMN IF NOT EXISTS updated_by_admin_id BIGINT UNSIGNED NULL AFTER created_by_user_id,
  ADD UNIQUE INDEX IF NOT EXISTS uq_ar360_rev_component_number (product_uid, component_kind, component_revision_number),
  ADD INDEX IF NOT EXISTS idx_ar360_rev_status (product_uid, component_kind, status),
  ADD INDEX IF NOT EXISTS idx_ar360_rev_parent (parent_revision_id);

UPDATE ar360_product_config_revisions
   SET component_revision_number = COALESCE(component_revision_number, revision_number)
 WHERE component_revision_number IS NULL;

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '5b', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

UPDATE platform_settings
   SET setting_value = '5b'
 WHERE setting_key = 'ar360_runtime_phase';
