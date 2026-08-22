-- AR360 Phase 6B — controlled update safety / change records.
-- Does NOT enable global VERSIONED, bulk migration, or stable release.
-- Snapshots are pointer/audit only — no asset binary copies.

CREATE TABLE IF NOT EXISTS ar360_component_change_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_uid VARCHAR(160) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL DEFAULT '',
  component_kind ENUM('geometry', 'material', 'lighting', 'viewer', 'ar') NOT NULL,
  from_revision_id BIGINT UNSIGNED NULL,
  to_revision_id BIGINT UNSIGNED NULL,
  status ENUM(
    'READY',
    'PREVIEW',
    'CANARY',
    'ACTIVE',
    'UNHEALTHY',
    'ROLLED_BACK',
    'BLOCKED'
  ) NOT NULL,
  snapshot_json JSON NOT NULL,
  health_json JSON NULL,
  block_code VARCHAR(64) NULL,
  block_reason VARCHAR(512) NULL,
  reason VARCHAR(512) NULL,
  admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_ar360_change_product_created (product_uid, created_at),
  KEY idx_ar360_change_product_kind (product_uid, component_kind, status),
  KEY idx_ar360_change_to_rev (to_revision_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '6b', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

UPDATE platform_settings
   SET setting_value = '6b'
 WHERE setting_key = 'ar360_runtime_phase';
