-- AR360 Studio Database Schema Definition
-- Consolidated schema containing all 31 system tables.

-- =============================================================================
-- SECTION 1: AUTH & CUSTOMER ACCOUNT TABLES
-- =============================================================================

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


-- =============================================================================
-- SECTION 2: PRODUCTS, VARIANT CONFIGURATIONS & ASSETS
-- =============================================================================

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(160) PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  customer_uid VARCHAR(40) NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(160) NULL,
  model_url TEXT NULL,
  file_name VARCHAR(255) NULL,
  poster LONGTEXT NULL,
  thumbnail_url TEXT NULL,
  qr_url TEXT NULL,
  product_folder TEXT NULL,
  status ENUM('Draft', 'draft', 'published') NOT NULL DEFAULT 'Draft',
  views INT NOT NULL DEFAULT 0,
  settings JSON NULL,
  material_settings JSON NULL,
  variants JSON NULL,
  hotspots JSON NULL,
  viewer_slug VARCHAR(180) NULL,
  public_id VARCHAR(180) NULL,
  version INT NOT NULL DEFAULT 1,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_user_id (user_id),
  INDEX idx_products_customer_uid (customer_uid),
  INDEX idx_products_public_id (public_id),
  INDEX idx_products_viewer_slug (viewer_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_uid VARCHAR(160) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  workspace_uid VARCHAR(40) NOT NULL DEFAULT '',
  version_number INT UNSIGNED NOT NULL DEFAULT 1,
  created_by_user_id BIGINT UNSIGNED NULL,
  label VARCHAR(120) NOT NULL DEFAULT '',
  snapshot JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pv_product (product_uid),
  INDEX idx_pv_customer (customer_uid),
  INDEX idx_pv_workspace (workspace_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_uid VARCHAR(160) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  file_path VARCHAR(255) NULL,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_assets_customer (customer_uid),
  INDEX idx_product_assets_product (product_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- SECTION 3: SUBSCRIPTION PLANS & CLIENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  monthly_price INT NOT NULL DEFAULT 0,
  yearly_price INT NOT NULL DEFAULT 0,
  products VARCHAR(80) NOT NULL DEFAULT '0',
  storage VARCHAR(80) NOT NULL DEFAULT '',
  bandwidth VARCHAR(80) NOT NULL DEFAULT '',
  views VARCHAR(80) NOT NULL DEFAULT '',
  team_members VARCHAR(80) NOT NULL DEFAULT '1',
  analytics VARCHAR(120) NOT NULL DEFAULT 'Basic',
  api_access BOOLEAN NOT NULL DEFAULT FALSE,
  custom_branding BOOLEAN NOT NULL DEFAULT FALSE,
  white_label BOOLEAN NOT NULL DEFAULT FALSE,
  support VARCHAR(160) NOT NULL DEFAULT 'Email',
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_plans (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  tagline VARCHAR(180) NULL,
  description TEXT NULL,
  storage_gb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  bandwidth_gb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  products INT NOT NULL DEFAULT 0,
  price_monthly_inr INT NULL,
  price_yearly_inr INT NULL,
  trial_hours INT NULL,
  popular TINYINT(1) NOT NULL DEFAULT 0,
  badge VARCHAR(80) NULL,
  icon VARCHAR(40) NOT NULL DEFAULT 'paper',
  features_json JSON NULL,
  custom_branding TINYINT(1) NOT NULL DEFAULT 0,
  advanced_analytics TINYINT(1) NOT NULL DEFAULT 0,
  embed_viewer TINYINT(1) NOT NULL DEFAULT 0,
  priority_processing TINYINT(1) NOT NULL DEFAULT 0,
  priority_support TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(80) NOT NULL,
  plan_id VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'trialing',
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  billing_period VARCHAR(30) NULL,
  provider VARCHAR(40) NULL,
  provider_subscription_id VARCHAR(191) NULL,
  provider_customer_id VARCHAR(191) NULL,
  grace_ends_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_subscription_customer (customer_uid),
  INDEX idx_customer_subscriptions_plan (plan_id),
  INDEX idx_customer_subscriptions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- SECTION 4: PAYMENTS, INVOICING & ORDERS (RAZORPAY + MANUAL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_uid VARCHAR(80) NOT NULL UNIQUE,
  customer_uid VARCHAR(40) NOT NULL,
  invoice VARCHAR(80) NOT NULL DEFAULT '',
  plan_id VARCHAR(80) NOT NULL DEFAULT '',
  billing_cycle ENUM('Monthly','Yearly','Free','Custom') NOT NULL DEFAULT 'Monthly',
  amount INT NOT NULL DEFAULT 0,
  gst INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  status ENUM('Paid','Pending','Failed','Refunded') NOT NULL DEFAULT 'Pending',
  gateway VARCHAR(80) NOT NULL DEFAULT '',
  transaction_id VARCHAR(160) NOT NULL DEFAULT '',
  payment_method VARCHAR(80) NOT NULL DEFAULT '',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_customer (customer_uid),
  INDEX idx_payments_status (status),
  INDEX idx_payments_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_uid VARCHAR(64) NOT NULL UNIQUE,
  customer_uid VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NULL,
  plan_id VARCHAR(64) NOT NULL,
  billing_period ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  razorpay_order_id VARCHAR(128) NOT NULL UNIQUE,
  amount_paise INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status ENUM('created','paid','failed','cancelled') NOT NULL DEFAULT 'created',
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_billing_orders_customer (customer_uid),
  INDEX idx_billing_orders_plan (plan_id),
  INDEX idx_billing_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payment_uid VARCHAR(64) NOT NULL UNIQUE,
  customer_uid VARCHAR(64) NOT NULL,
  order_uid VARCHAR(64) NOT NULL,
  razorpay_order_id VARCHAR(128) NOT NULL,
  razorpay_payment_id VARCHAR(128) NULL,
  razorpay_signature VARCHAR(255) NULL,
  amount_paise INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status ENUM('created','captured','failed','refunded') NOT NULL DEFAULT 'created',
  raw_payload JSON NULL,
  subscription_id BIGINT UNSIGNED NULL,
  invoice_uid VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_billing_payments_customer (customer_uid),
  INDEX idx_billing_payments_order (order_uid),
  INDEX idx_billing_payments_razorpay_payment (razorpay_payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(64) NOT NULL,
  subscription_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(80) NOT NULL,
  title VARCHAR(191) NOT NULL,
  description TEXT NULL,
  amount_paise INT NULL,
  currency VARCHAR(12) NOT NULL DEFAULT 'INR',
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer_uid (customer_uid),
  KEY idx_event_type (event_type),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_uid VARCHAR(64) NOT NULL UNIQUE,
  customer_uid VARCHAR(64) NOT NULL,
  subscription_id BIGINT UNSIGNED NULL,
  plan_id VARCHAR(64) NOT NULL,
  period ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  amount_paise INT NOT NULL DEFAULT 0,
  tax_paise INT NOT NULL DEFAULT 0,
  total_paise INT NOT NULL DEFAULT 0,
  currency VARCHAR(12) NOT NULL DEFAULT 'INR',
  status ENUM('draft','paid','failed','void','refunded') NOT NULL DEFAULT 'draft',
  razorpay_payment_id VARCHAR(191) NULL,
  paid_at DATETIME NULL,
  due_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customer_uid (customer_uid),
  KEY idx_status (status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_uid VARCHAR(64) NOT NULL UNIQUE,
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  event_type VARCHAR(128) NOT NULL,
  provider_event_id VARCHAR(128) NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSON NOT NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_billing_webhook_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- SECTION 5: ANALYTICS EVENTS & TIME SERIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(40) NOT NULL DEFAULT '',
  product_uid VARCHAR(160) NOT NULL DEFAULT '',
  session_id VARCHAR(64) NOT NULL DEFAULT '',
  event VARCHAR(60) NOT NULL,
  device VARCHAR(20) NOT NULL DEFAULT 'unknown',
  browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
  os VARCHAR(20) NOT NULL DEFAULT 'unknown',
  country VARCHAR(80) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  language VARCHAR(20) NOT NULL DEFAULT '',
  screen_width SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  screen_height SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  referrer VARCHAR(255) NOT NULL DEFAULT '',
  url VARCHAR(512) NOT NULL DEFAULT '',
  ip_hash VARCHAR(32) NOT NULL DEFAULT '',
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ae_customer (customer_uid),
  INDEX idx_ae_product (product_uid),
  INDEX idx_ae_session (session_id),
  INDEX idx_ae_event (event),
  INDEX idx_ae_created (created_at),
  INDEX idx_ae_customer_product (customer_uid, product_uid),
  INDEX idx_ae_customer_created (customer_uid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id VARCHAR(64) NOT NULL PRIMARY KEY,
  customer_uid VARCHAR(40) NOT NULL DEFAULT '',
  product_uid VARCHAR(160) NOT NULL DEFAULT '',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  duration INT UNSIGNED NULL,
  device VARCHAR(20) NOT NULL DEFAULT 'unknown',
  browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
  os VARCHAR(20) NOT NULL DEFAULT 'unknown',
  country VARCHAR(80) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  INDEX idx_as_customer (customer_uid),
  INDEX idx_as_product (product_uid),
  INDEX idx_as_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(40) NOT NULL DEFAULT '',
  product_uid VARCHAR(160) NOT NULL DEFAULT '',
  date DATE NOT NULL,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  unique_visitors INT UNSIGNED NOT NULL DEFAULT 0,
  ar_launches INT UNSIGNED NOT NULL DEFAULT 0,
  screenshots INT UNSIGNED NOT NULL DEFAULT 0,
  shares INT UNSIGNED NOT NULL DEFAULT 0,
  copy_links INT UNSIGNED NOT NULL DEFAULT 0,
  qr_scans INT UNSIGNED NOT NULL DEFAULT 0,
  avg_duration INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_ad_customer_product_date (customer_uid, product_uid, date),
  INDEX idx_ad_customer (customer_uid),
  INDEX idx_ad_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- SECTION 6: ENTERPRISE, TEAM MEMBERS & WORKSPACES
-- =============================================================================

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
