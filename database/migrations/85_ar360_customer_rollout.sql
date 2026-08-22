-- AR360 Phase 9 — controlled customer rollout (wraps Phase 7 migration engine).
-- One client + explicitly selected products. No scope=all. No AUTO execution.

CREATE TABLE IF NOT EXISTS ar360_customer_rollouts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_uid VARCHAR(40) NOT NULL,
  migration_plan_id BIGINT UNSIGNED NOT NULL,
  current_release_id BIGINT UNSIGNED NULL,
  target_release_id BIGINT UNSIGNED NOT NULL,
  update_policy_snapshot ENUM('MANUAL', 'APPROVAL_REQUIRED', 'AUTO') NOT NULL DEFAULT 'MANUAL',
  status ENUM(
    'READY',
    'PREVIEW',
    'CANARY',
    'BATCHING',
    'PAUSED',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'READY',
  product_ids_json JSON NOT NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  last_activity_at DATETIME NULL,
  notes VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_ar360_rollout_customer (customer_uid),
  KEY idx_ar360_rollout_status (status),
  KEY idx_ar360_rollout_plan (migration_plan_id),
  KEY idx_ar360_rollout_target (target_release_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '9', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

UPDATE platform_settings
   SET setting_value = '9'
 WHERE setting_key = 'ar360_runtime_phase';
