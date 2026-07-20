-- Migration 35: durable leases and cancellation for native Object Capture workers.
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS lease_token VARCHAR(64) NULL AFTER worker_id;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS lease_expires_at DATETIME NULL AFTER locked_at;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS heartbeat_at DATETIME NULL AFTER lease_expires_at;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS cancel_requested_at DATETIME NULL AFTER cancelled_at;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS attempt SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER retry_count;

CREATE INDEX idx_oc_jobs_lease
  ON object_capture_jobs (status, lease_expires_at);
