CREATE TABLE IF NOT EXISTS storage_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_uid VARCHAR(80) NULL,
  audit_type VARCHAR(80) NOT NULL DEFAULT 'product_json',
  scanned_count INT NOT NULL DEFAULT 0,
  critical_count INT NOT NULL DEFAULT 0,
  warning_count INT NOT NULL DEFAULT 0,
  repaired_count INT NOT NULL DEFAULT 0,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_storage_audit_type (audit_type),
  INDEX idx_storage_audit_created (created_at)
);
