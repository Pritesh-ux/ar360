-- AR360 Phase 7 — controlled product migration / upgrade engine.
-- Selected products only. No scope=all. No geometry migration. No stable activation.

CREATE TABLE IF NOT EXISTS ar360_migration_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  release_id BIGINT UNSIGNED NULL,
  title VARCHAR(200) NOT NULL,
  status ENUM(
    'DRAFT',
    'PREVIEW',
    'CANARY',
    'BATCHING',
    'PAUSED',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT',
  rollout_mode ENUM('selected_products') NOT NULL DEFAULT 'selected_products',
  batch_size INT UNSIGNED NOT NULL DEFAULT 10,
  components_json JSON NOT NULL,
  notes VARCHAR(512) NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  paused_reason VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_ar360_mig_plans_status (status),
  KEY idx_ar360_mig_plans_release (release_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ar360_migration_plan_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  product_uid VARCHAR(160) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL DEFAULT '',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('PENDING', 'BLOCKED', 'PASS', 'UNHEALTHY', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  snapshot_before_json JSON NULL,
  proposed_json JSON NOT NULL,
  applied_json JSON NULL,
  validation_code VARCHAR(64) NULL,
  validation_message VARCHAR(512) NULL,
  health_json JSON NULL,
  error_message VARCHAR(512) NULL,
  batch_index INT UNSIGNED NULL,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ar360_mig_plan_product (plan_id, product_uid),
  KEY idx_ar360_mig_prod_status (plan_id, status),
  KEY idx_ar360_mig_prod_sort (plan_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '7', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

UPDATE platform_settings
   SET setting_value = '7'
 WHERE setting_key = 'ar360_runtime_phase';
