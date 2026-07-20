-- Object Capture operations: quotas, usage ledger, worker health, retention, and notifications.
ALTER TABLE object_capture_jobs
  ADD COLUMN IF NOT EXISTS source_expires_at DATETIME NULL AFTER completed_at,
  ADD COLUMN IF NOT EXISTS cleanup_completed_at DATETIME NULL AFTER source_expires_at,
  ADD COLUMN IF NOT EXISTS compute_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER attempt,
  ADD COLUMN IF NOT EXISTS output_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER compute_seconds,
  ADD INDEX IF NOT EXISTS idx_oc_jobs_cleanup (status, source_expires_at, cleanup_completed_at),
  ADD INDEX IF NOT EXISTS idx_oc_jobs_priority_queue (status, priority, created_at);

CREATE TABLE IF NOT EXISTS object_capture_usage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_uid VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  usage_type ENUM('capture','compute_seconds') NOT NULL,
  quantity BIGINT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_oc_usage_job_type (job_id, usage_type),
  KEY idx_oc_usage_customer_period (customer_uid, period_start, usage_type),
  CONSTRAINT fk_oc_usage_job FOREIGN KEY (job_id)
    REFERENCES object_capture_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS object_capture_workers (
  worker_id VARCHAR(64) NOT NULL,
  heartbeat_at DATETIME NOT NULL,
  current_job_id VARCHAR(64) NULL,
  version VARCHAR(64) NULL,
  metadata JSON NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (worker_id),
  KEY idx_oc_workers_heartbeat (heartbeat_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS object_capture_cleanup_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_id VARCHAR(64) NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  scanned_jobs INT UNSIGNED NOT NULL DEFAULT 0,
  removed_paths INT UNSIGNED NOT NULL DEFAULT 0,
  reclaimed_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  errors INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_oc_cleanup_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
