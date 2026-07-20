-- Master Admin Object Capture queue, review workflow, and RBAC.
ALTER TABLE object_capture_jobs
  ADD COLUMN IF NOT EXISTS review_status ENUM('unreviewed','in_review','approved','rejected','recapture_requested') NOT NULL DEFAULT 'unreviewed' AFTER status,
  ADD COLUMN IF NOT EXISTS assigned_admin_id BIGINT UNSIGNED NULL AFTER review_status,
  ADD COLUMN IF NOT EXISTS priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal' AFTER assigned_admin_id,
  ADD COLUMN IF NOT EXISTS review_reason VARCHAR(500) NULL AFTER priority,
  ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL AFTER review_reason,
  ADD COLUMN IF NOT EXISTS reviewed_by_admin_id BIGINT UNSIGNED NULL AFTER reviewed_at,
  ADD INDEX IF NOT EXISTS idx_oc_jobs_admin_queue (review_status, priority, assigned_admin_id, created_at);

CREATE TABLE IF NOT EXISTS object_capture_admin_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id VARCHAR(64) NOT NULL,
  admin_id BIGINT UNSIGNED NULL,
  body VARCHAR(2000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_oc_admin_notes_job (job_id, created_at),
  CONSTRAINT fk_oc_admin_notes_job FOREIGN KEY (job_id)
    REFERENCES object_capture_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO admin_permissions (code, name, category, description) VALUES
('object_capture.read', 'View Object Capture', 'object_capture', 'View capture queue, jobs, images, and processing details'),
('object_capture.manage', 'Manage Object Capture', 'object_capture', 'Assign, review, retry, cancel, and prioritize capture jobs'),
('object_capture.download', 'Download Object Capture assets', 'object_capture', 'Download capture models, logs, and queue exports');

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
JOIN admin_permissions p ON p.code IN ('object_capture.read', 'object_capture.manage', 'object_capture.download')
WHERE r.code IN ('super_admin', 'operations_admin');

INSERT IGNORE INTO admin_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM admin_roles r
JOIN admin_permissions p ON p.code = 'object_capture.read'
WHERE r.code IN ('support_admin', 'content_admin', 'analytics_viewer', 'read_only');
