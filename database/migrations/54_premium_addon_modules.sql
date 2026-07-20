-- Migration 54: Premium SaaS Addon Modules (Client Management and Team Management)

CREATE TABLE IF NOT EXISTS addon_modules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  description TEXT NULL,
  monthly_price INT NOT NULL DEFAULT 0,
  yearly_price INT NOT NULL DEFAULT 0,
  one_time_price INT NULL,
  trial_days INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  business_available BOOLEAN NOT NULL DEFAULT TRUE,
  enterprise_available BOOLEAN NOT NULL DEFAULT TRUE,
  custom_available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  visibility VARCHAR(30) NOT NULL DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_addons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  addon_slug VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  billing_type VARCHAR(30) NOT NULL DEFAULT 'monthly',
  activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_addon (user_id, addon_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_uid VARCHAR(40) NOT NULL UNIQUE,
  customer_uid VARCHAR(40) NOT NULL,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(60) NULL,
  company_name VARCHAR(180) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  tags JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_clients_customer (customer_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_resources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_uid VARCHAR(40) NOT NULL,
  resource_type VARCHAR(60) NOT NULL,
  resource_id VARCHAR(160) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_client_resource (client_uid, resource_type, resource_id),
  INDEX idx_client_resource_lookup (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_uid VARCHAR(40) NOT NULL UNIQUE,
  workspace_uid VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  permissions JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wr_workspace (workspace_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_client_access (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_uid VARCHAR(40) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  client_uid VARCHAR(40) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_member_client (workspace_uid, user_id, client_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_uid VARCHAR(40) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ma_workspace_user (workspace_uid, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO addon_modules (name, slug, description, monthly_price, yearly_price, one_time_price, trial_days, enabled, business_available, enterprise_available, custom_available, sort_order)
VALUES 
('Client Management', 'client-management', 'Premium CRM module for managing clients, workspaces, custom domains, and viewing client specific 3D model/AR analytics.', 499, 4999, 14999, 7, 1, 1, 1, 1, 1),
('Team Management', 'team-management', 'Collaborative multi-user seat workspace management, granular role permissions configuration, and audit logs tracking.', 299, 2999, 9999, 7, 1, 1, 1, 1, 2)
ON DUPLICATE KEY UPDATE name=name;
