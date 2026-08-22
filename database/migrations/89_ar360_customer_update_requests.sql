-- AR360 Phase 13 — customer approval + update execution gateway.
-- Request layer only. Execution remains Phase 9 Customer Rollout + Phase 7 Migration Engine.
-- Does NOT mutate products, billing, QR, or subscriptions.

CREATE TABLE IF NOT EXISTS ar360_customer_update_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_uid VARCHAR(40) NOT NULL,
  release_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  update_policy_snapshot VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  approval_required TINYINT(1) NOT NULL DEFAULT 0,
  requested_by_user_id INT UNSIGNED NULL,
  requested_at DATETIME NULL,
  approved_by_admin_id INT UNSIGNED NULL,
  approved_at DATETIME NULL,
  rejected_by_admin_id INT UNSIGNED NULL,
  rejected_at DATETIME NULL,
  reject_reason VARCHAR(512) NULL,
  cancelled_at DATETIME NULL,
  stale_at DATETIME NULL,
  stale_reason VARCHAR(255) NULL,
  product_selection_json JSON NOT NULL,
  preview_snapshot_json JSON NOT NULL,
  rollout_id BIGINT UNSIGNED NULL,
  notes VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_ar360_cur_customer (customer_uid),
  KEY idx_ar360_cur_release (release_id),
  KEY idx_ar360_cur_status (status),
  KEY idx_ar360_cur_rollout (rollout_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '13', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

UPDATE platform_settings
   SET setting_value = '13'
 WHERE setting_key = 'ar360_runtime_phase';
