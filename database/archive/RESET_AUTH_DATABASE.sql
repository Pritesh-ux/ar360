USE arstudio;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS master_admins;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE master_admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_uid VARCHAR(191) NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('Active','Disabled') NOT NULL DEFAULT 'Active',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_code_hash VARCHAR(255) NULL,
  two_factor_expires_at DATETIME NULL,
  two_factor_attempts INT NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_master_admins_email (email),
  UNIQUE KEY uq_master_admins_admin_uid (admin_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_uid VARCHAR(191) NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
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
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_user_uid (user_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  company_name VARCHAR(180) NULL,
  contact_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(60) NULL,
  country VARCHAR(100) NULL,
  plan_id VARCHAR(80) NOT NULL DEFAULT 'free',
  status ENUM('Active','Suspended','Deleted') NOT NULL DEFAULT 'Active',
  storage_used_mb DECIMAL(12,2) NOT NULL DEFAULT 0,
  bandwidth_used_mb DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_user_id (user_id),
  UNIQUE KEY uq_customers_customer_uid (customer_uid),
  INDEX idx_customers_email (email),
  INDEX idx_customers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
