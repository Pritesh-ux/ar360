CREATE TABLE IF NOT EXISTS api_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  route VARCHAR(255) NOT NULL,
  method VARCHAR(16) NOT NULL,
  status_code INT NULL,
  duration_ms INT NULL,
  customer_uid VARCHAR(80) NULL,
  admin_uid VARCHAR(80) NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_api_audit_route (route),
  INDEX idx_api_audit_created_at (created_at)
);
