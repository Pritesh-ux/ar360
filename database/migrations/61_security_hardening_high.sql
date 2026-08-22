-- Security hardening (High findings): coupon redemption uniqueness + admin DB permission

-- Deduplicate before unique index (keep earliest redemption per coupon+customer)
DELETE cr FROM coupon_redemptions cr
INNER JOIN coupon_redemptions newer
  ON newer.coupon_uid = cr.coupon_uid
 AND newer.customer_uid = cr.customer_uid
 AND newer.id > cr.id;

SET @has_uq := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'coupon_redemptions'
    AND INDEX_NAME = 'uq_coupon_customer'
);

SET @sql := IF(
  @has_uq = 0,
  'ALTER TABLE coupon_redemptions ADD UNIQUE KEY uq_coupon_customer (coupon_uid, customer_uid)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_order := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'coupon_redemptions'
    AND COLUMN_NAME = 'order_uid'
);

SET @sql := IF(
  @has_order = 0,
  'ALTER TABLE coupon_redemptions ADD COLUMN order_uid VARCHAR(64) NULL AFTER customer_uid, ADD INDEX idx_coupon_redemptions_order (order_uid)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO admin_permissions (code, name, category, description) VALUES
('database.query', 'Query database', 'settings', 'Run SELECT-only queries in the admin SQL console');

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, 'database.query'
FROM admin_roles r
WHERE r.code = 'super_admin';
