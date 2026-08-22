-- Shopper Enquire leads + workspace WhatsApp/Enquire defaults.
-- Existing products.settings Viewer CTA is unchanged.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS contact_whatsapp_number VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS contact_whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_enquire_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_enquire_label VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS contact_whatsapp_label VARCHAR(40) NULL;

CREATE TABLE IF NOT EXISTS product_enquiries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  enquiry_uid VARCHAR(40) NOT NULL,
  customer_uid VARCHAR(40) NOT NULL,
  workspace_uid VARCHAR(40) NULL,
  client_uid VARCHAR(40) NULL,
  product_id VARCHAR(160) NOT NULL,
  product_title VARCHAR(255) NOT NULL,
  visitor_name VARCHAR(120) NOT NULL,
  visitor_phone VARCHAR(40) NOT NULL,
  visitor_email VARCHAR(190) NULL,
  message VARCHAR(2000) NULL,
  status ENUM('new','contacted','converted','closed') NOT NULL DEFAULT 'new',
  source VARCHAR(40) NOT NULL DEFAULT 'viewer',
  viewer_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_enquiries_uid (enquiry_uid),
  INDEX idx_enquiries_customer_created (customer_uid, created_at),
  INDEX idx_enquiries_customer_status (customer_uid, status),
  INDEX idx_enquiries_product (product_id),
  INDEX idx_enquiries_client (client_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
