-- Migration 60: Visual Landing Editor — draft document + showcase media/style fields

CREATE TABLE IF NOT EXISTS website_landing_drafts (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  document_json LONGTEXT NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  updated_by BIGINT UNSIGNED NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'website_showcases' AND COLUMN_NAME = 'image_path'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE website_showcases ADD COLUMN image_path VARCHAR(255) NULL AFTER glb_settings',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'website_showcases' AND COLUMN_NAME = 'benefits'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE website_showcases ADD COLUMN benefits JSON NULL AFTER image_path',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'website_showcases' AND COLUMN_NAME = 'style_settings'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE website_showcases ADD COLUMN style_settings JSON NULL AFTER benefits',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'website_sections' AND COLUMN_NAME = 'style_settings'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE website_sections ADD COLUMN style_settings JSON NULL AFTER glb_settings',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'website_cards' AND COLUMN_NAME = 'style_settings'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE website_cards ADD COLUMN style_settings JSON NULL AFTER features',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'website_categories' AND COLUMN_NAME = 'deleted_at'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE website_categories ADD COLUMN deleted_at DATETIME NULL AFTER visibility',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'website_showcases' AND COLUMN_NAME = 'deleted_at'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE website_showcases ADD COLUMN deleted_at DATETIME NULL AFTER visibility',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Seed default use-case cover images from static public assets when empty.
UPDATE website_showcases s
JOIN website_categories c ON c.category_uid = s.category_uid
SET s.image_path = CONCAT('/home/use-cases/', c.slug, '.webp')
WHERE (s.image_path IS NULL OR s.image_path = '')
  AND c.slug IN ('furniture','tiles','shoes','packaging','electronics','jewelry','fashion','automotive');

INSERT INTO website_settings (setting_key, setting_value) VALUES
  ('free_trial_popup_phone_image', '/home/free-trial-ar-phone.png'),
  ('free_trial_popup_phone_image_mobile', '/home/free-trial-ar-phone.png'),
  ('free_trial_popup_visible', '1')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
