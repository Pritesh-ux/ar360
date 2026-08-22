-- Migration 78: AR360 versioning foundation (Phase 1)
-- Additive only. Does NOT change viewer/QR/subscription/product-save behavior.
-- Does NOT activate Preview/Beta. Does NOT enforce compatibility.
-- Idempotent: safe to re-run SQL patterns; revision_1 unique per product.

-- ---------------------------------------------------------------------------
-- 1) Release channels (preview / beta / stable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ar360_release_channels (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_customer_facing TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ar360_release_channel_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ar360_release_channels (code, display_name, is_default, is_customer_facing)
SELECT * FROM (
  SELECT 'stable' AS code, 'Stable' AS display_name, 1 AS is_default, 1 AS is_customer_facing
  UNION ALL SELECT 'beta', 'Beta', 0, 0
  UNION ALL SELECT 'preview', 'Preview', 0, 0
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM ar360_release_channels c WHERE c.code = seed.code
);

-- ---------------------------------------------------------------------------
-- 2) Platform releases (semver). No release is activated in Phase 1.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ar360_platform_releases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(32) NOT NULL,
  major INT UNSIGNED NOT NULL,
  minor INT UNSIGNED NOT NULL,
  patch INT UNSIGNED NOT NULL,
  channel_code VARCHAR(32) NOT NULL DEFAULT 'stable',
  status ENUM('draft', 'published', 'retired') NOT NULL DEFAULT 'draft',
  release_notes TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME NULL,
  UNIQUE KEY uq_ar360_platform_release_ver_channel (version, channel_code),
  INDEX idx_ar360_platform_release_semver (major, minor, patch),
  INDEX idx_ar360_platform_release_channel (channel_code),
  INDEX idx_ar360_platform_release_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Baseline draft only — NOT published, NOT customer-activated.
INSERT INTO ar360_platform_releases (
  version, major, minor, patch, channel_code, status, release_notes, metadata
)
SELECT
  '1.0.0',
  1,
  0,
  0,
  'stable',
  'draft',
  'AR360 versioning foundation baseline (not activated).',
  JSON_OBJECT('phase', 1, 'activated', false)
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM ar360_platform_releases r
  WHERE r.version = '1.0.0' AND r.channel_code = 'stable'
);

-- ---------------------------------------------------------------------------
-- 3) Feature flags foundation (disabled). NOT subscription entitlements.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ar360_feature_flags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  flag_key VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  targeting JSON NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ar360_feature_flag_key (flag_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ar360_feature_flags (flag_key, description, enabled, targeting, metadata)
SELECT seed.flag_key, seed.description, 0, JSON_OBJECT('scope', 'none'), JSON_OBJECT('phase', 1)
FROM (
  SELECT 'new_reflection_engine' AS flag_key, 'New reflection / IBL engine (disabled foundation).' AS description
  UNION ALL SELECT 'new_material_engine', 'New material engine (disabled foundation).'
  UNION ALL SELECT 'new_lighting_engine', 'New lighting engine (disabled foundation).'
  UNION ALL SELECT 'new_ar_engine', 'New AR engine (disabled foundation).'
  UNION ALL SELECT 'new_viewer', 'New viewer shell (disabled foundation).'
  UNION ALL SELECT 'new_post_processing', 'New post-processing (disabled foundation).'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM ar360_feature_flags f WHERE f.flag_key = seed.flag_key
);

-- ---------------------------------------------------------------------------
-- 4) Immutable product configuration revisions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ar360_product_config_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_uid VARCHAR(160) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL DEFAULT '',
  revision_number INT UNSIGNED NOT NULL,
  config_json JSON NOT NULL,
  asset_refs_json JSON NOT NULL,
  material_revision_id BIGINT UNSIGNED NULL,
  lighting_revision_id BIGINT UNSIGNED NULL,
  viewer_revision_id BIGINT UNSIGNED NULL,
  ar_revision_id BIGINT UNSIGNED NULL,
  geometry_revision_id BIGINT UNSIGNED NULL,
  renderer_compat_label VARCHAR(64) NOT NULL DEFAULT 'legacy-current',
  platform_release_id BIGINT UNSIGNED NULL,
  source ENUM(
    'legacy_backfill',
    'editor_save',
    'migration',
    'rollback',
    'manual'
  ) NOT NULL DEFAULT 'legacy_backfill',
  reason VARCHAR(255) NOT NULL DEFAULT '',
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ar360_pcr_product_revision (product_uid, revision_number),
  INDEX idx_ar360_pcr_customer (customer_uid),
  INDEX idx_ar360_pcr_product (product_uid),
  INDEX idx_ar360_pcr_compat (renderer_compat_label),
  INDEX idx_ar360_pcr_source (source),
  INDEX idx_ar360_pcr_platform_release (platform_release_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5) Active pointers on products (foundation only — viewer does not read these yet)
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS active_config_revision_id BIGINT UNSIGNED NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active_material_revision_id BIGINT UNSIGNED NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active_lighting_revision_id BIGINT UNSIGNED NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active_viewer_revision_id BIGINT UNSIGNED NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active_ar_revision_id BIGINT UNSIGNED NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active_geometry_revision_id BIGINT UNSIGNED NULL;
ALTER TABLE products ADD INDEX IF NOT EXISTS idx_products_active_config_rev (active_config_revision_id);

-- ---------------------------------------------------------------------------
-- 6) Legacy backfill: revision_1 from current MySQL product state (non-destructive)
--    Does not regenerate QR, public_id, viewer_slug, assets, or visual config.
-- ---------------------------------------------------------------------------
INSERT INTO ar360_product_config_revisions (
  product_uid,
  customer_uid,
  revision_number,
  config_json,
  asset_refs_json,
  renderer_compat_label,
  platform_release_id,
  source,
  reason
)
SELECT
  p.id,
  COALESCE(p.customer_uid, ''),
  1,
  JSON_OBJECT(
    'schemaVersion', 1,
    'source', 'legacy_backfill',
    'productIdentity', JSON_OBJECT(
      'id', p.id,
      'publicId', p.public_id,
      'viewerSlug', p.viewer_slug,
      'status', p.status,
      'title', p.title,
      'editVersion', p.version
    ),
    'settings', COALESCE(p.settings, JSON_OBJECT()),
    'materialSettings', COALESCE(p.material_settings, JSON_OBJECT()),
    'variants', COALESCE(p.variants, JSON_ARRAY()),
    'hotspots', COALESCE(p.hotspots, JSON_ARRAY()),
    'components', JSON_OBJECT(
      'material', JSON_OBJECT('alignedToRevision', 1),
      'lighting', JSON_OBJECT('alignedToRevision', 1),
      'viewer', JSON_OBJECT('alignedToRevision', 1),
      'ar', JSON_OBJECT('alignedToRevision', 1),
      'geometry', JSON_OBJECT('alignedToRevision', 1)
    )
  ),
  JSON_OBJECT(
    'modelUrl', p.model_url,
    'fileName', p.file_name,
    'productFolder', p.product_folder,
    'thumbnailUrl', p.thumbnail_url,
    'qrUrl', p.qr_url,
    'posterRef', IF(
      p.poster IS NULL OR p.poster LIKE 'data:%',
      NULL,
      LEFT(p.poster, 512)
    ),
    'files', JSON_ARRAY(
      JSON_OBJECT('role', 'model', 'hint', 'model.glb'),
      JSON_OBJECT('role', 'modelArLite', 'hint', 'model.ar.glb'),
      JSON_OBJECT('role', 'usdz', 'hint', 'model.usdz')
    ),
    'note', 'Binary assets are referenced, not copied. Disk enrichment may fill hashes later.'
  ),
  'legacy-current',
  (SELECT r.id FROM ar360_platform_releases r WHERE r.version = '1.0.0' AND r.channel_code = 'stable' LIMIT 1),
  'legacy_backfill',
  'Phase 1 non-destructive legacy snapshot'
FROM products p
WHERE NOT EXISTS (
  SELECT 1
  FROM ar360_product_config_revisions existing
  WHERE existing.product_uid = p.id
    AND existing.revision_number = 1
);

-- Point component self-refs at the same revision row (foundation; future may diverge).
UPDATE ar360_product_config_revisions
SET
  material_revision_id = COALESCE(material_revision_id, id),
  lighting_revision_id = COALESCE(lighting_revision_id, id),
  viewer_revision_id = COALESCE(viewer_revision_id, id),
  ar_revision_id = COALESCE(ar_revision_id, id),
  geometry_revision_id = COALESCE(geometry_revision_id, id)
WHERE revision_number = 1
  AND (
    material_revision_id IS NULL
    OR lighting_revision_id IS NULL
    OR viewer_revision_id IS NULL
    OR ar_revision_id IS NULL
    OR geometry_revision_id IS NULL
  );

-- Set active pointers only when missing (do not overwrite later intentional pointers).
UPDATE products p
INNER JOIN ar360_product_config_revisions r
  ON r.product_uid = p.id
 AND r.revision_number = 1
SET
  p.active_config_revision_id = COALESCE(p.active_config_revision_id, r.id),
  p.active_material_revision_id = COALESCE(p.active_material_revision_id, r.id),
  p.active_lighting_revision_id = COALESCE(p.active_lighting_revision_id, r.id),
  p.active_viewer_revision_id = COALESCE(p.active_viewer_revision_id, r.id),
  p.active_ar_revision_id = COALESCE(p.active_ar_revision_id, r.id),
  p.active_geometry_revision_id = COALESCE(p.active_geometry_revision_id, r.id)
WHERE p.active_config_revision_id IS NULL
   OR p.active_material_revision_id IS NULL
   OR p.active_lighting_revision_id IS NULL
   OR p.active_viewer_revision_id IS NULL
   OR p.active_ar_revision_id IS NULL
   OR p.active_geometry_revision_id IS NULL;
