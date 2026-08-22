-- AR360 Phase 8 — client update policy / release eligibility.
-- Policy layer only. Does NOT auto-migrate products or enable AUTO execution.

CREATE TABLE IF NOT EXISTS ar360_client_update_policies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_uid VARCHAR(40) NOT NULL,
  current_release_id BIGINT UNSIGNED NULL,
  target_release_id BIGINT UNSIGNED NULL,
  update_policy ENUM('MANUAL', 'APPROVAL_REQUIRED', 'AUTO') NOT NULL DEFAULT 'MANUAL',
  status ENUM(
    'CURRENT',
    'UPDATE_AVAILABLE',
    'PENDING_APPROVAL',
    'MIGRATION_IN_PROGRESS',
    'PAUSED',
    'UP_TO_DATE',
    'BLOCKED'
  ) NOT NULL DEFAULT 'CURRENT',
  approved_by_admin_id BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  last_update_at DATETIME NULL,
  notes VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ar360_client_update_customer (customer_uid),
  KEY idx_ar360_client_update_status (status),
  KEY idx_ar360_client_update_policy (update_policy),
  KEY idx_ar360_client_update_target (target_release_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Do NOT backfill policies for existing clients — default MANUAL is virtual until first write.

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '8', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

UPDATE platform_settings
   SET setting_value = '8'
 WHERE setting_key = 'ar360_runtime_phase';
