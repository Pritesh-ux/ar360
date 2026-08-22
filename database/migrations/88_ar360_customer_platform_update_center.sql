-- AR360 Phase 12 — customer platform update center (viewed state).
-- Read-only viewing. Does NOT migrate products or change billing.

CREATE TABLE IF NOT EXISTS ar360_customer_platform_release_views (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_uid VARCHAR(40) NOT NULL,
  release_id BIGINT UNSIGNED NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dismissed_at DATETIME NULL,
  product_update_reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ar360_cust_release_view (customer_uid, release_id),
  KEY idx_ar360_cust_release_view_customer (customer_uid),
  KEY idx_ar360_cust_release_view_release (release_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_settings (setting_key, setting_value, is_secret)
SELECT 'ar360_runtime_phase', '12', 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'ar360_runtime_phase'
);

UPDATE platform_settings
   SET setting_value = '12'
 WHERE setting_key = 'ar360_runtime_phase';
