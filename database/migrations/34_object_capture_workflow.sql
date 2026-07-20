-- Migration 34: production Object Capture workflow and customer ownership.
CREATE TABLE IF NOT EXISTS object_capture_jobs (
  id VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(64) NULL,
  user_id BIGINT UNSIGNED NULL,
  product_id VARCHAR(160) NULL,
  status ENUM('pending','uploading','validating','queued','processing','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  photo_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  processing_engine VARCHAR(64) NULL,
  processing_stage VARCHAR(64) NULL,
  worker_id VARCHAR(64) NULL,
  model_key VARCHAR(512) NULL,
  model_url TEXT NULL,
  thumbnail_key VARCHAR(512) NULL,
  thumbnail_url TEXT NULL,
  error_message VARCHAR(1000) NULL,
  processing_log MEDIUMTEXT NULL,
  quality_score TINYINT UNSIGNED NULL,
  coverage_score TINYINT UNSIGNED NULL,
  blur_count SMALLINT UNSIGNED NULL,
  duplicate_count SMALLINT UNSIGNED NULL,
  exposure_status VARCHAR(64) NULL,
  suggestions JSON NULL,
  retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_at DATETIME NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_oc_jobs_customer_created (customer_uid, created_at),
  KEY idx_oc_jobs_queue (status, locked_at, created_at),
  KEY idx_oc_jobs_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS customer_uid VARCHAR(64) NULL AFTER id;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS model_key VARCHAR(512) NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS thumbnail_key VARCHAR(512) NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS processing_engine VARCHAR(64) NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS processing_stage VARCHAR(64) NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS worker_id VARCHAR(64) NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS processing_log MEDIUMTEXT NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS quality_score TINYINT UNSIGNED NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS coverage_score TINYINT UNSIGNED NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS blur_count SMALLINT UNSIGNED NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS duplicate_count SMALLINT UNSIGNED NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS exposure_status VARCHAR(64) NULL;
ALTER TABLE object_capture_jobs ADD COLUMN IF NOT EXISTS suggestions JSON NULL;
ALTER TABLE object_capture_jobs MODIFY COLUMN status ENUM('pending','uploading','validating','queued','processing','completed','failed','cancelled') NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS object_capture_images (
  id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(64) NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  media_type VARCHAR(32) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  width SMALLINT UNSIGNED NOT NULL,
  height SMALLINT UNSIGNED NOT NULL,
  image_url TEXT NULL,
  quality_status VARCHAR(32) NOT NULL DEFAULT 'Good',
  blur_score TINYINT UNSIGNED NULL,
  brightness TINYINT UNSIGNED NULL,
  duplicate_of VARCHAR(64) NULL,
  angle_label VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_oc_images_job (job_id),
  KEY idx_oc_images_customer (customer_uid),
  CONSTRAINT fk_oc_images_job FOREIGN KEY (job_id) REFERENCES object_capture_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS customer_uid VARCHAR(64) NULL AFTER job_id;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS storage_key VARCHAR(512) NULL;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS original_name VARCHAR(255) NULL;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS media_type VARCHAR(32) NULL;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS byte_size INT UNSIGNED NULL;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS width SMALLINT UNSIGNED NULL;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS height SMALLINT UNSIGNED NULL;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS blur_score TINYINT UNSIGNED NULL;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS brightness TINYINT UNSIGNED NULL;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS duplicate_of VARCHAR(64) NULL;
ALTER TABLE object_capture_images ADD COLUMN IF NOT EXISTS angle_label VARCHAR(64) NULL;
ALTER TABLE object_capture_images MODIFY COLUMN image_url TEXT NULL;

CREATE TABLE IF NOT EXISTS object_capture_analysis (
  id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  image_id VARCHAR(64) NULL,
  image_url TEXT NULL,
  blur_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  brightness TINYINT UNSIGNED NOT NULL DEFAULT 0,
  duplicate_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  angle VARCHAR(32) NULL,
  quality_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  remarks TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_oc_analysis_job (job_id),
  CONSTRAINT fk_oc_analysis_job FOREIGN KEY (job_id) REFERENCES object_capture_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE object_capture_analysis ADD COLUMN IF NOT EXISTS image_id VARCHAR(64) NULL AFTER job_id;

CREATE TABLE IF NOT EXISTS object_capture_quality_summary (
  job_id VARCHAR(64) NOT NULL,
  quality_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  coverage_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  blur_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  duplicate_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  exposure_status VARCHAR(32) NOT NULL DEFAULT 'Good',
  suggestions JSON NULL,
  can_process BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_id),
  CONSTRAINT fk_oc_summary_job FOREIGN KEY (job_id) REFERENCES object_capture_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
