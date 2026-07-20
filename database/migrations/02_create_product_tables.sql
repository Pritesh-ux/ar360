-- Migration 02: Create Product Tables
-- Tables: products, product_versions, product_assets

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
