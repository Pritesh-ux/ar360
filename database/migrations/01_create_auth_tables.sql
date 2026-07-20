-- Migration 01: Create Auth Tables
-- Tables: master_admins, users, auth_login_logs, customers, login_logs

CREATE TABLE IF NOT EXISTS master_admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_uid VARCHAR(191) NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('Active','Disabled') NOT NULL DEFAULT 'Active',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_code_hash VARCHAR(255) NULL,
  two_factor_expires_at DATETIME NULL,
  two_factor_attempts INT NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_uid VARCHAR(191) NULL UNIQUE,
  name VARCHAR(160) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  status ENUM('Active','Suspended','Deleted') NOT NULL DEFAULT 'Active',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_code_hash VARCHAR(255) NULL,
  two_factor_expires_at DATETIME NULL,
  two_factor_attempts INT NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_login_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_type ENUM('customer','master_admin') NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  email VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('success','failed','blocked') NOT NULL,
  reason VARCHAR(255) NOT NULL DEFAULT '',
  ip_hash VARCHAR(64) NOT NULL DEFAULT '',
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_login_logs_actor (actor_type, actor_id),
  INDEX idx_auth_login_logs_email (email),
  INDEX idx_auth_login_logs_status (status),
  INDEX idx_auth_login_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL UNIQUE,
  customer_uid VARCHAR(40) NULL UNIQUE,
  company_name VARCHAR(180) NULL,
  contact_name VARCHAR(160) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(60) NULL,
  country VARCHAR(100) NULL,
  plan_id VARCHAR(80) NOT NULL DEFAULT 'free',
  status ENUM('Active','Suspended','Deleted') NOT NULL DEFAULT 'Active',
  storage_used_mb DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  bandwidth_used_mb DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_email (email),
  INDEX idx_customers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  customer_uid VARCHAR(40) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('Success','Failed','Suspicious','Locked','Blocked') NOT NULL DEFAULT 'Success',
  risk ENUM('Low','Medium','High') NOT NULL DEFAULT 'Low',
  ip VARCHAR(60) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  country VARCHAR(100) NOT NULL DEFAULT '',
  device VARCHAR(60) NOT NULL DEFAULT '',
  browser VARCHAR(80) NOT NULL DEFAULT '',
  os VARCHAR(60) NOT NULL DEFAULT '',
  method VARCHAR(40) NOT NULL DEFAULT 'Password',
  session_status VARCHAR(40) NOT NULL DEFAULT 'Active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ll_customer (customer_uid),
  INDEX idx_ll_status (status),
  INDEX idx_ll_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
