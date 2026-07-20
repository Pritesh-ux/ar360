-- Migration 06: Create Enterprise Tables
-- Tables: workspaces, workspace_members, workspace_invites, audit_logs, api_keys, api_key_logs, webhooks, webhook_deliveries, usage_counters, usage_daily, custom_domains

CREATE TABLE IF NOT EXISTS workspaces (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_uid VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  logo_url TEXT NULL,
  brand_color VARCHAR(20) NULL DEFAULT '#B8FF3C',
  brand_name VARCHAR(180) NULL,
  accent_color VARCHAR(20) NULL,
  viewer_watermark BOOLEAN NOT NULL DEFAULT FALSE,
  remove_branding BOOLEAN NOT NULL DEFAULT FALSE,
  custom_viewer_theme VARCHAR(40) NULL DEFAULT 'default',
  owner_user_id BIGINT UNSIGNED NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  plan VARCHAR(80) NOT NULL DEFAULT 'starter',
  status ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_workspaces_owner (owner_user_id),
  INDEX idx_workspaces_customer (customer_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_uid VARCHAR(40) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('owner','admin','editor','viewer','billing') NOT NULL DEFAULT 'viewer',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wm_workspace_user (workspace_uid, user_id),
  INDEX idx_wm_workspace (workspace_uid),
  INDEX idx_wm_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_invites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_uid VARCHAR(40) NOT NULL,
  invited_by_user_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  role ENUM('admin','editor','viewer','billing') NOT NULL DEFAULT 'viewer',
  token VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wi_workspace (workspace_uid),
  INDEX idx_wi_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_uid VARCHAR(40) NOT NULL DEFAULT '',
  customer_uid VARCHAR(40) NOT NULL DEFAULT '',
  user_id BIGINT UNSIGNED NULL,
  actor_name VARCHAR(160) NOT NULL DEFAULT '',
  actor_email VARCHAR(255) NOT NULL DEFAULT '',
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(60) NOT NULL DEFAULT '',
  resource_id VARCHAR(160) NOT NULL DEFAULT '',
  resource_label VARCHAR(255) NOT NULL DEFAULT '',
  meta JSON NULL,
  ip_hash VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_al_workspace (workspace_uid),
  INDEX idx_al_customer (customer_uid),
  INDEX idx_al_user (user_id),
  INDEX idx_al_action (action),
  INDEX idx_al_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  key_uid VARCHAR(40) NOT NULL UNIQUE,
  workspace_uid VARCHAR(40) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  key_hash VARCHAR(128) NOT NULL UNIQUE,
  key_prefix VARCHAR(12) NOT NULL,
  scopes JSON NOT NULL,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  last_used_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ak_workspace (workspace_uid),
  INDEX idx_ak_customer (customer_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_key_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  key_uid VARCHAR(40) NOT NULL,
  workspace_uid VARCHAR(40) NOT NULL,
  endpoint VARCHAR(255) NOT NULL DEFAULT '',
  method VARCHAR(10) NOT NULL DEFAULT '',
  status_code SMALLINT UNSIGNED NOT NULL DEFAULT 200,
  ip_hash VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_akl_key (key_uid),
  INDEX idx_akl_workspace (workspace_uid),
  INDEX idx_akl_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhooks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  webhook_uid VARCHAR(40) NOT NULL UNIQUE,
  workspace_uid VARCHAR(40) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  url TEXT NOT NULL,
  secret_hash VARCHAR(128) NOT NULL,
  events JSON NOT NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wh_workspace (workspace_uid),
  INDEX idx_wh_customer (customer_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  webhook_uid VARCHAR(40) NOT NULL,
  workspace_uid VARCHAR(40) NOT NULL,
  event VARCHAR(80) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
  response_status SMALLINT UNSIGNED NULL,
  response_body TEXT NULL,
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_retry_at DATETIME NULL,
  delivered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wd_webhook (webhook_uid),
  INDEX idx_wd_workspace (workspace_uid),
  INDEX idx_wd_status (status),
  INDEX idx_wd_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usage_counters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_uid VARCHAR(40) NOT NULL UNIQUE,
  customer_uid VARCHAR(40) NOT NULL,
  storage_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  bandwidth_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  product_count INT UNSIGNED NOT NULL DEFAULT 0,
  total_views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_ar_launches BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_asset_downloads BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_uc_customer (customer_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usage_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_uid VARCHAR(40) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  date DATE NOT NULL,
  storage_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  bandwidth_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  ar_launches INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_ud_workspace_date (workspace_uid, date),
  INDEX idx_ud_customer (customer_uid),
  INDEX idx_ud_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_domains (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_uid VARCHAR(40) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  domain VARCHAR(253) NOT NULL UNIQUE,
  verification_token VARCHAR(64) NOT NULL,
  status ENUM('pending','verified','failed') NOT NULL DEFAULT 'pending',
  ssl_status ENUM('none','pending','active') NOT NULL DEFAULT 'none',
  verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cd_workspace (workspace_uid),
  INDEX idx_cd_customer (customer_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
