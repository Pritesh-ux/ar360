-- Migration 27: Enterprise custom-plan sales workflow
-- Intentionally limited to the six Enterprise sales tables.

CREATE TABLE IF NOT EXISTS enterprise_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_uid VARCHAR(32) NOT NULL,
  company_name VARCHAR(191) NOT NULL,
  contact_name VARCHAR(160) NOT NULL,
  business_email VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  company_website VARCHAR(500) NULL,
  country VARCHAR(100) NOT NULL,
  industry VARCHAR(120) NOT NULL,
  expected_products INT UNSIGNED NULL,
  expected_storage_gb INT UNSIGNED NULL,
  expected_monthly_bandwidth_gb INT UNSIGNED NULL,
  needs_more_storage TINYINT(1) NOT NULL DEFAULT 0,
  needs_more_bandwidth TINYINT(1) NOT NULL DEFAULT 0,
  needs_more_products TINYINT(1) NOT NULL DEFAULT 0,
  needs_team_members TINYINT(1) NOT NULL DEFAULT 0,
  needs_custom_branding TINYINT(1) NOT NULL DEFAULT 0,
  needs_dedicated_infrastructure TINYINT(1) NOT NULL DEFAULT 0,
  needs_priority_support TINYINT(1) NOT NULL DEFAULT 0,
  needs_sla TINYINT(1) NOT NULL DEFAULT 0,
  additional_requirements TEXT NULL,
  assigned_admin_id BIGINT UNSIGNED NULL,
  status ENUM('new','contacted','negotiating','quoted','waiting_payment','active','rejected','closed') NOT NULL DEFAULT 'new',
  customer_id BIGINT UNSIGNED NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'pricing',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enterprise_requests_uid (request_uid),
  INDEX idx_enterprise_requests_status_created (status, created_at),
  INDEX idx_enterprise_requests_assignee (assigned_admin_id, status),
  INDEX idx_enterprise_requests_email (business_email),
  CONSTRAINT fk_enterprise_requests_assignee FOREIGN KEY (assigned_admin_id) REFERENCES master_admins(id) ON DELETE SET NULL,
  CONSTRAINT fk_enterprise_requests_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enterprise_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_uid VARCHAR(40) NOT NULL,
  request_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NULL,
  event_type ENUM('note','status_change','assignment','quote','payment','contract') NOT NULL DEFAULT 'note',
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enterprise_notes_uid (note_uid),
  INDEX idx_enterprise_notes_request_created (request_id, created_at),
  CONSTRAINT fk_enterprise_notes_request FOREIGN KEY (request_id) REFERENCES enterprise_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_enterprise_notes_admin FOREIGN KEY (admin_id) REFERENCES master_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enterprise_custom_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  custom_plan_uid VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  billing_cycle ENUM('monthly','yearly') NOT NULL,
  price_paise BIGINT UNSIGNED NOT NULL,
  storage_limit_bytes BIGINT UNSIGNED NULL,
  bandwidth_limit_bytes BIGINT UNSIGNED NULL,
  product_limit INT UNSIGNED NULL,
  model_limit INT UNSIGNED NULL,
  ar_experience_limit INT UNSIGNED NULL,
  team_member_limit INT UNSIGNED NULL,
  custom_branding TINYINT(1) NOT NULL DEFAULT 0,
  dedicated_infrastructure TINYINT(1) NOT NULL DEFAULT 0,
  sla_support TINYINT(1) NOT NULL DEFAULT 0,
  support_level VARCHAR(100) NULL,
  notes TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_reusable TINYINT(1) NOT NULL DEFAULT 1,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enterprise_custom_plans_uid (custom_plan_uid),
  INDEX idx_enterprise_custom_plans_active (is_active, is_reusable),
  CONSTRAINT chk_enterprise_custom_plan_price CHECK (price_paise > 0),
  CONSTRAINT fk_enterprise_custom_plans_creator FOREIGN KEY (created_by_admin_id) REFERENCES master_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enterprise_quotes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quote_uid VARCHAR(40) NOT NULL,
  request_id BIGINT UNSIGNED NOT NULL,
  custom_plan_id BIGINT UNSIGNED NULL,
  quote_number VARCHAR(40) NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  billing_cycle ENUM('monthly','yearly') NOT NULL,
  price_paise BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  valid_until DATE NOT NULL,
  terms TEXT NULL,
  status ENUM('draft','sent','accepted','expired','rejected','superseded') NOT NULL DEFAULT 'draft',
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enterprise_quotes_uid (quote_uid),
  UNIQUE KEY uq_enterprise_quotes_number (quote_number),
  UNIQUE KEY uq_enterprise_quotes_request_version (request_id, version),
  INDEX idx_enterprise_quotes_request_status (request_id, status),
  INDEX idx_enterprise_quotes_validity (valid_until, status),
  CONSTRAINT chk_enterprise_quote_price CHECK (price_paise > 0),
  CONSTRAINT fk_enterprise_quotes_request FOREIGN KEY (request_id) REFERENCES enterprise_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_enterprise_quotes_plan FOREIGN KEY (custom_plan_id) REFERENCES enterprise_custom_plans(id) ON DELETE SET NULL,
  CONSTRAINT fk_enterprise_quotes_creator FOREIGN KEY (created_by_admin_id) REFERENCES master_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enterprise_contracts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_uid VARCHAR(40) NOT NULL,
  request_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  custom_plan_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT NULL,
  starts_on DATE NOT NULL,
  expires_on DATE NOT NULL,
  status ENUM('draft','active','expired','cancelled','renewed') NOT NULL DEFAULT 'draft',
  renewal_of_contract_id BIGINT UNSIGNED NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enterprise_contracts_uid (contract_uid),
  INDEX idx_enterprise_contracts_request (request_id),
  INDEX idx_enterprise_contracts_customer_status (customer_id, status),
  INDEX idx_enterprise_contracts_expiry (expires_on, status),
  CONSTRAINT chk_enterprise_contract_dates CHECK (expires_on >= starts_on),
  CONSTRAINT fk_enterprise_contracts_request FOREIGN KEY (request_id) REFERENCES enterprise_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_enterprise_contracts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_enterprise_contracts_plan FOREIGN KEY (custom_plan_id) REFERENCES enterprise_custom_plans(id) ON DELETE RESTRICT,
  CONSTRAINT fk_enterprise_contracts_subscription FOREIGN KEY (subscription_id) REFERENCES customer_subscriptions(id) ON DELETE SET NULL,
  CONSTRAINT fk_enterprise_contracts_renewal FOREIGN KEY (renewal_of_contract_id) REFERENCES enterprise_contracts(id) ON DELETE SET NULL,
  CONSTRAINT fk_enterprise_contracts_creator FOREIGN KEY (created_by_admin_id) REFERENCES master_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enterprise_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_uid VARCHAR(40) NOT NULL,
  request_id BIGINT UNSIGNED NOT NULL,
  quote_id BIGINT UNSIGNED NOT NULL,
  contract_id BIGINT UNSIGNED NULL,
  invoice_id BIGINT UNSIGNED NULL,
  invoice_number VARCHAR(80) NULL,
  amount_paise BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  payment_link VARCHAR(2048) NULL,
  transaction_id VARCHAR(191) NULL,
  payment_method VARCHAR(80) NULL,
  paid_at DATETIME NULL,
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  notes TEXT NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enterprise_payments_uid (payment_uid),
  UNIQUE KEY uq_enterprise_payments_transaction (transaction_id),
  INDEX idx_enterprise_payments_request_status (request_id, status),
  INDEX idx_enterprise_payments_quote (quote_id),
  INDEX idx_enterprise_payments_paid (paid_at, status),
  CONSTRAINT chk_enterprise_payment_amount CHECK (amount_paise > 0),
  CONSTRAINT fk_enterprise_payments_request FOREIGN KEY (request_id) REFERENCES enterprise_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_enterprise_payments_quote FOREIGN KEY (quote_id) REFERENCES enterprise_quotes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_enterprise_payments_contract FOREIGN KEY (contract_id) REFERENCES enterprise_contracts(id) ON DELETE SET NULL,
  CONSTRAINT fk_enterprise_payments_invoice FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE SET NULL,
  CONSTRAINT fk_enterprise_payments_creator FOREIGN KEY (created_by_admin_id) REFERENCES master_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enterprise sales queue permissions. These inserts do not add data tables.
INSERT IGNORE INTO admin_permissions (code, name, category, description) VALUES
('enterprise_requests.read', 'View Enterprise requests', 'enterprise', 'List, export, and view Enterprise sales requests'),
('enterprise_requests.manage', 'Manage Enterprise requests', 'enterprise', 'Assign, annotate, and update Enterprise sales requests');

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
JOIN admin_permissions p ON p.code IN ('enterprise_requests.read', 'enterprise_requests.manage')
WHERE r.code IN ('super_admin', 'operations_admin', 'billing_admin');
