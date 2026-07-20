-- Customer-panel workflow, audit trail, and idempotent product linking.
ALTER TABLE object_capture_jobs
  MODIFY COLUMN status ENUM(
    'pending','uploading','validating','action_required','queued',
    'processing','completed','failed','cancelled'
  ) NOT NULL DEFAULT 'pending';

ALTER TABLE object_capture_jobs
  ADD COLUMN IF NOT EXISTS override_requested_at DATETIME NULL AFTER retry_count,
  ADD COLUMN IF NOT EXISTS override_requested_by BIGINT UNSIGNED NULL AFTER override_requested_at,
  ADD COLUMN IF NOT EXISTS override_reason VARCHAR(500) NULL AFTER override_requested_by;

CREATE TABLE IF NOT EXISTS object_capture_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NULL,
  message VARCHAR(500) NOT NULL DEFAULT '',
  actor_user_id BIGINT UNSIGNED NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_oc_events_job_created (job_id, created_at),
  KEY idx_oc_events_customer_created (customer_uid, created_at),
  CONSTRAINT fk_oc_events_job FOREIGN KEY (job_id)
    REFERENCES object_capture_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
