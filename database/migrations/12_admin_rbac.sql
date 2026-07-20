-- Migration 12: Master Admin RBAC (roles, permissions, role assignments)
-- Idempotent: safe to re-run on databases that already have partial runtime DDL

CREATE TABLE IF NOT EXISTS admin_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_permissions (
  code VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  description VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (code),
  INDEX idx_admin_permissions_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_code VARCHAR(80) NOT NULL,
  PRIMARY KEY (role_id, permission_code),
  INDEX idx_admin_role_permissions_code (permission_code),
  CONSTRAINT fk_admin_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES admin_roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_role_permissions_permission
    FOREIGN KEY (permission_code) REFERENCES admin_permissions (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link master admins to a single role (nullable during rollout; super_admin assigned below)
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_admins' AND COLUMN_NAME = 'role_id'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE master_admins ADD COLUMN role_id BIGINT UNSIGNED NULL AFTER status',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_admins' AND INDEX_NAME = 'idx_master_admins_role'
);
SET @idx_ddl := IF(
  @idx_exists = 0,
  'ALTER TABLE master_admins ADD INDEX idx_master_admins_role (role_id)',
  'SELECT 1'
);
PREPARE idx_stmt FROM @idx_ddl;
EXECUTE idx_stmt;
DEALLOCATE PREPARE idx_stmt;

-- ─── Permissions ─────────────────────────────────────────────────────────────

INSERT IGNORE INTO admin_permissions (code, name, category, description) VALUES
('customers.read', 'View customers', 'customers', 'List and view customer accounts'),
('customers.update', 'Update customers', 'customers', 'Edit customer profile fields'),
('customers.suspend', 'Suspend customers', 'customers', 'Suspend or reactivate customer accounts'),
('customers.delete', 'Delete customers', 'customers', 'Permanently delete customer accounts'),
('customers.impersonate', 'Impersonate customers', 'customers', 'Sign in as a customer for support'),
('subscriptions.read', 'View subscriptions', 'subscriptions', 'List and view subscription records'),
('subscriptions.update', 'Update subscriptions', 'subscriptions', 'Change plans and subscription status'),
('subscriptions.cancel', 'Cancel subscriptions', 'subscriptions', 'Cancel active subscriptions'),
('billing.read', 'View billing', 'billing', 'View payments, invoices, and revenue'),
('billing.refund', 'Issue refunds', 'billing', 'Refund completed payments'),
('billing.manual_payment', 'Record manual payments', 'billing', 'Create or adjust manual payment entries'),
('invoices.generate', 'Generate invoices', 'billing', 'Generate or regenerate invoices'),
('products.read', 'View products', 'products', 'List and view customer products'),
('products.update', 'Update products', 'products', 'Edit product metadata and status'),
('products.delete', 'Delete products', 'products', 'Remove products from the platform'),
('storage.read', 'View storage', 'storage', 'View storage usage and audits'),
('storage.cleanup', 'Storage cleanup', 'storage', 'Run storage cleanup operations'),
('coupons.read', 'View coupons', 'coupons', 'List coupon codes and redemptions'),
('coupons.manage', 'Manage coupons', 'coupons', 'Create, edit, and disable coupons'),
('tickets.read', 'View support tickets', 'support', 'List and view support tickets'),
('tickets.manage', 'Manage support tickets', 'support', 'Assign, reply, and close tickets'),
('analytics.read', 'View analytics', 'analytics', 'View platform and viewer analytics'),
('admins.manage', 'Manage admins', 'admins', 'Create admin accounts and assign roles'),
('settings.read', 'View settings', 'settings', 'View platform configuration'),
('settings.manage', 'Manage settings', 'settings', 'Update platform configuration'),
('audit.read', 'View audit logs', 'audit', 'View admin and security audit trails'),
('exports.download', 'Download exports', 'exports', 'Export CSV and report downloads');

-- ─── Roles ───────────────────────────────────────────────────────────────────

INSERT IGNORE INTO admin_roles (code, name, description, is_system) VALUES
('super_admin', 'Super Admin', 'Full platform access including admin management', TRUE),
('operations_admin', 'Operations Admin', 'Customer, product, and storage operations', TRUE),
('billing_admin', 'Billing Admin', 'Billing, subscriptions, and refunds', TRUE),
('support_admin', 'Support Admin', 'Customer support and ticket management', TRUE),
('content_admin', 'Content Admin', 'Product catalog oversight', TRUE),
('analytics_viewer', 'Analytics Viewer', 'Read-only analytics and reporting', TRUE),
('read_only', 'Read Only', 'Read-only access across admin modules', TRUE);

-- Helper: grant permissions to a role by code
-- super_admin gets all permissions explicitly (also bypassed in application code)

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'super_admin';

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
JOIN admin_permissions p ON p.code IN (
  'customers.read', 'customers.update', 'customers.suspend',
  'subscriptions.read', 'subscriptions.update',
  'products.read', 'products.update', 'products.delete',
  'storage.read', 'storage.cleanup',
  'analytics.read', 'exports.download', 'audit.read'
)
WHERE r.code = 'operations_admin';

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
JOIN admin_permissions p ON p.code IN (
  'customers.read',
  'subscriptions.read', 'subscriptions.update', 'subscriptions.cancel',
  'billing.read', 'billing.refund', 'billing.manual_payment', 'invoices.generate',
  'analytics.read', 'exports.download'
)
WHERE r.code = 'billing_admin';

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
JOIN admin_permissions p ON p.code IN (
  'customers.read',
  'subscriptions.read',
  'tickets.read', 'tickets.manage'
)
WHERE r.code = 'support_admin';

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
JOIN admin_permissions p ON p.code IN (
  'products.read', 'products.update', 'products.delete',
  'storage.read', 'analytics.read'
)
WHERE r.code = 'content_admin';

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
JOIN admin_permissions p ON p.code IN (
  'customers.read', 'subscriptions.read', 'billing.read',
  'products.read', 'storage.read', 'coupons.read', 'tickets.read',
  'analytics.read', 'audit.read', 'exports.download'
)
WHERE r.code = 'analytics_viewer';

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
JOIN admin_permissions p ON p.code LIKE '%.read'
WHERE r.code = 'read_only';

-- Assign super_admin to all existing master admins without a role
UPDATE master_admins ma
JOIN admin_roles r ON r.code = 'super_admin'
SET ma.role_id = r.id
WHERE ma.role_id IS NULL;
